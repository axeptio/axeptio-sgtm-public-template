// Headless runner for the GTM custom-template tests embedded in template.tpl.
//
// GTM stores template unit tests as YAML scenarios in the ___TESTS___ section and
// only runs them inside the GTM UI "Tests" tab — Google ships no CLI runner. This
// file reproduces just enough of GTM's Test API (runCode / mock / mockObject /
// assertApi / assertThat / fail) to execute those same scenarios under Node's
// built-in test runner, so the suite gates every PR. The scenarios are the single
// source of truth: they run unchanged here and in the GTM UI.
//
// It runs the REAL sandboxed source extracted from template.tpl (never a copy), so
// a regression in the template's routing makes a scenario fail here.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import { test } from 'node:test';
import yaml from 'js-yaml';

const TPL_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'template.tpl');

// --- Parse the .tpl into its ___SECTION___ blocks. ----------------------------
function parseTemplate(src) {
  const names = src.match(/___[A-Z_]+___/g) || [];
  const chunks = src.split(/___[A-Z_]+___/);
  const sections = {};
  names.forEach((name, i) => {
    sections[name] = chunks[i + 1].trim();
  });
  return sections;
}

const sections = parseTemplate(readFileSync(TPL_PATH, 'utf8'));
const sandboxSource = sections.___SANDBOXED_JS_FOR_SERVER___;
const parsedTests = yaml.load(sections.___TESTS___ || '') || {};
const scenarios = parsedTests.scenarios || [];
const sharedSetup = parsedTests.setup || '';

if (!sandboxSource) {
  throw new Error('Could not extract ___SANDBOXED_JS_FOR_SERVER___ from template.tpl');
}

// --- Synchronous promise. -----------------------------------------------------
// GTM resolves a mocked sendHttpRequest()'s promise synchronously inside runCode,
// so the .then()/.catch() side effects (setResponseStatus, gtmOnSuccess, ...) have
// already happened when runCode returns and assertions run right after it. A native
// Promise would defer those to a later microtask and the assertions would race it.
class SyncPromise {
  constructor(executor) {
    this.state = 'pending';
    this.value = undefined;
    const settle = (state) => (v) => {
      if (this.state === 'pending') {
        this.state = state;
        this.value = v;
      }
    };
    try {
      executor(settle('fulfilled'), settle('rejected'));
    } catch (err) {
      settle('rejected')(err);
    }
  }
  static create(executor) { return new SyncPromise(executor); }
  static resolve(v) { return new SyncPromise((res) => res(v)); }
  static reject(e) { return new SyncPromise((_, rej) => rej(e)); }
  then(onFulfilled, onRejected) {
    const handler = this.state === 'fulfilled' ? onFulfilled : onRejected;
    if (typeof handler !== 'function') {
      return this.state === 'fulfilled'
        ? SyncPromise.resolve(this.value)
        : SyncPromise.reject(this.value);
    }
    try {
      return SyncPromise.resolve(handler(this.value));
    } catch (err) {
      return SyncPromise.reject(err);
    }
  }
  catch(onRejected) { return this.then(undefined, onRejected); }
}

// --- Spies. -------------------------------------------------------------------
function spy(impl) {
  const fn = (...args) => {
    fn.calls.push(args);
    return typeof impl === 'function' ? impl(...args) : undefined;
  };
  fn.calls = [];
  return fn;
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  // Require b to own every key of a; with equal key counts this guarantees the
  // key sets are identical, so {a: undefined} no longer matches {b: 1}.
  return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
}

// --- Per-scenario GTM Test API. -----------------------------------------------
function buildTestApi() {
  const mocks = {};      // explicit mock()/mockObject() overrides
  const apiSpies = {};   // auto-created spies for required()'d APIs not mocked
  const gtmOnSuccess = spy();
  const gtmOnFailure = spy();

  // require() inside the template: a mock wins, else a cached tracked spy. A bare
  // spy returns undefined, which is the correct default for the response-writing
  // APIs and for getRequestHeader (header absent). getAllEventData/getRequestMethod
  // must be mocked by the scenario or the template throws — a clear failure.
  const requireShim = (name) => {
    if (name in mocks) return mocks[name];
    if (name === 'logToConsole') return (apiSpies[name] = apiSpies[name] || spy());
    if (!apiSpies[name]) apiSpies[name] = spy();
    return apiSpies[name];
  };

  const resolveSpy = (name) => {
    if (name === 'gtmOnSuccess') return gtmOnSuccess;
    if (name === 'gtmOnFailure') return gtmOnFailure;
    if (name in mocks) return mocks[name];
    if (name in apiSpies) return apiSpies[name];
    throw new Error(`assertApi: no mock or recorded call for '${name}'`);
  };

  const runCode = (data) => {
    const context = vm.createContext({
      require: requireShim,
      data: Object.assign({}, data, { gtmOnSuccess, gtmOnFailure }),
      Object, Array, JSON, Math, String, Number,
    });
    vm.runInContext(`(function () {\n${sandboxSource}\n})();`, context, { timeout: 2000 });
  };

  const assertApi = (name) => {
    const fn = resolveSpy(name);
    return {
      wasCalled() {
        if (fn.calls.length === 0) throw new Error(`Expected ${name} to be called`);
      },
      wasNotCalled() {
        if (fn.calls.length > 0) throw new Error(`Expected ${name} not to be called`);
      },
      wasCalledWith(...expected) {
        const hit = fn.calls.some((call) => deepEqual(call, expected));
        if (!hit) {
          throw new Error(
            `Expected ${name} to be called with ${JSON.stringify(expected)}; ` +
            `actual calls: ${JSON.stringify(fn.calls)}`,
          );
        }
      },
    };
  };

  const assertThat = (value, msg) => ({
    isEqualTo(expected) {
      if (!deepEqual(value, expected)) {
        throw new Error(`${msg || 'assertThat'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(value)}`);
      }
    },
    isStrictlyEqualTo(expected) {
      if (value !== expected) throw new Error(`${msg || 'assertThat'}: expected ${expected}, got ${value}`);
    },
    isUndefined() {
      if (value !== undefined) throw new Error(`${msg || 'assertThat'}: expected undefined, got ${JSON.stringify(value)}`);
    },
    contains(sub) {
      if (typeof value !== 'string' || value.indexOf(sub) === -1) {
        throw new Error(`${msg || 'assertThat'}: expected "${value}" to contain "${sub}"`);
      }
    },
  });

  const mock = (name, impl) => {
    mocks[name] = typeof impl === 'function' ? spy(impl) : impl;
  };
  const mockObject = (name, obj) => {
    const out = {};
    for (const key of Object.keys(obj)) {
      out[key] = typeof obj[key] === 'function' ? spy(obj[key]) : obj[key];
    }
    mocks[name] = out;
  };

  return {
    runCode, mock, mockObject, assertApi, assertThat,
    fail: (m) => { throw new Error(`fail(): ${m || ''}`); },
    log: () => {},
    Promise: SyncPromise,
    JSON, Math, Object, Array, String, Number,
  };
}

// --- Register one Node test per scenario. -------------------------------------
if (scenarios.length === 0) {
  test('template.tpl has at least one ___TESTS___ scenario', () => {
    throw new Error('No scenarios found in template.tpl ___TESTS___');
  });
}

for (const scenario of scenarios) {
  test(scenario.name, () => {
    const api = buildTestApi();
    const context = vm.createContext(api);
    vm.runInContext(`${sharedSetup}\n${scenario.code}`, context, { timeout: 3000 });
  });
}

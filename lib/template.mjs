// Shared template.tpl tooling for the headless unit runner (test/run-tpl-tests.mjs)
// and the integration harness (integration/). Pure extraction — no runner-specific
// behavior lives here.

import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';

// --- Parse the .tpl into its ___SECTION___ blocks. ----------------------------
export function parseTemplate(src) {
  const names = src.match(/___[A-Z_]+___/g) || [];
  const chunks = src.split(/___[A-Z_]+___/);
  const sections = {};
  names.forEach((name, i) => {
    sections[name] = chunks[i + 1].trim();
  });
  return sections;
}

export function loadTemplate(tplPath) {
  const sections = parseTemplate(readFileSync(tplPath, 'utf8'));
  const sandboxSource = sections.___SANDBOXED_JS_FOR_SERVER___;
  if (!sandboxSource) {
    throw new Error('Could not extract ___SANDBOXED_JS_FOR_SERVER___ from template.tpl');
  }
  const tests = yaml.load(sections.___TESTS___ || '') || {};
  return { sections, sandboxSource, tests };
}

// --- Spies. -------------------------------------------------------------------
export function spy(impl) {
  const fn = (...args) => {
    fn.calls.push(args);
    return typeof impl === 'function' ? impl(...args) : undefined;
  };
  fn.calls = [];
  return fn;
}

export function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  // Require b to own every key of a; with equal key counts this guarantees the
  // key sets are identical, so {a: undefined} no longer matches {b: 1}.
  return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
}

// Runs the REAL ___SANDBOXED_JS_FOR_SERVER___ from template.tpl as close to the
// sGTM request lifecycle as possible without Google's runtime: the
// sendHttpRequest shim performs a real HTTP request (rewritten to the local
// mock upstream), and the response-writing APIs capture what would be returned
// to the caller.
//
// Fidelity contract: bytes cross the sandbox boundary with a latin1
// byte<->string convention, so these tests prove the template relays whatever
// the runtime hands it, byte for byte. Real sGTM stringifies bodies as UTF-8 —
// only the live e2e suite (e2e/proxy-e2e.mjs) can prove end-to-end binary
// integrity on a real tagging server. This harness complements e2e; it never
// replaces it.

import vm from 'node:vm';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadTemplate, spy } from '../../lib/template.mjs';

const TPL_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'template.tpl');

export const { sandboxSource, sections } = loadTemplate(TPL_PATH);

// Mirror of the send_http permission in ___SERVER_PERMISSIONS___ ("specific"
// allowedUrls: https://*.axept.io/* and https://*.axeptio.eu/*). The shim
// enforces it BEFORE rewriting to the local mock, so the rewrite can never
// mask a URL the real GTM sandbox would reject. A test in
// proxy-integration.mjs asserts the permission section still matches this
// mirror, closing the drift loop.
const ALLOWED_URLS = [/^https:\/\/[^/]+\.axept\.io\//, /^https:\/\/[^/]+\.axeptio\.eu\//];

export function assertUrlAllowed(url) {
  if (!ALLOWED_URLS.some((re) => re.test(url))) {
    throw new Error(`send_http permission would reject URL: ${url}`);
  }
}

// Executes the tag once and resolves with what it returned to the caller.
//   path/queryString/method/body/requestHeaders — the incoming request
//   (queryString without leading '?', body as string or Buffer, header lookup
//   case-insensitive like sGTM's).
//   data — tag configuration (proxyBasePath, enableLogging).
//   upstreamPort — the mock-upstream server port.
export function runProxyTag({
  path = '/',
  queryString = '',
  method = 'GET',
  body,
  requestHeaders = {},
  data = {},
  upstreamPort,
} = {}) {
  return new Promise((resolve, reject) => {
    const result = { status: undefined, headers: {}, body: '', logs: [] };
    const gtmOnSuccess = spy();
    const gtmOnFailure = spy();

    const timer = setTimeout(
      () => reject(new Error('returnResponse was not called within 2s')),
      2000,
    );

    const headerLookup = (name) => {
      const wanted = String(name).toLowerCase();
      for (const key of Object.keys(requestHeaders)) {
        if (key.toLowerCase() === wanted) return requestHeaders[key];
      }
      return undefined;
    };

    const sendHttpRequest = (url, options = {}, requestBody) => {
      assertUrlAllowed(url);
      const u = new URL(url);
      const rewritten = `http://127.0.0.1:${upstreamPort}/${u.host}${u.pathname}${u.search}`;
      return new Promise((res, rej) => {
        const req = http.request(
          rewritten,
          { method: options.method || 'GET', headers: options.headers || {} },
          (r) => {
            const chunks = [];
            r.on('data', (c) => chunks.push(c));
            r.on('end', () => res({
              statusCode: r.statusCode,
              headers: r.headers,
              body: Buffer.concat(chunks).toString('latin1'),
            }));
            r.on('error', rej);
          },
        );
        req.on('error', rej);
        if (requestBody !== undefined && requestBody !== null) {
          req.write(Buffer.isBuffer(requestBody) ? requestBody : Buffer.from(requestBody, 'latin1'));
        }
        req.end();
      });
    };

    const apis = {
      getRequestPath: () => path,
      getRequestQueryString: () => queryString,
      getRequestBody: () => (Buffer.isBuffer(body) ? body.toString('latin1') : body),
      getRequestHeader: headerLookup,
      getRequestMethod: () => method,
      logToConsole: (...args) => { result.logs.push(args); },
      sendHttpRequest,
      setResponseStatus: (s) => { result.status = s; },
      setResponseBody: (b) => { result.body = b; },
      setResponseHeader: (k, v) => { result.headers[String(k).toLowerCase()] = v; },
      returnResponse: () => {
        clearTimeout(timer);
        // Resolve via microtask so the template's post-returnResponse calls
        // (data.gtmOnSuccess/Failure) have run before the test's await resumes.
        queueMicrotask(() => resolve({
          status: result.status,
          headers: result.headers,
          body: Buffer.from(result.body || '', 'latin1'),
          gtmOnSuccessCalls: gtmOnSuccess.calls.length,
          gtmOnFailureCalls: gtmOnFailure.calls.length,
          logs: result.logs,
        }));
      },
    };

    const context = vm.createContext({
      require: (name) => {
        if (name in apis) return apis[name];
        throw new Error(`integration runtime: template required unshimmed API '${name}'`);
      },
      data: Object.assign({}, data, { gtmOnSuccess, gtmOnFailure }),
      Object, Array, JSON, Math, String, Number,
    });

    try {
      vm.runInContext(`(function () {\n${sandboxSource}\n})();`, context, { timeout: 2000 });
    } catch (err) {
      clearTimeout(timer);
      reject(err);
    }
  });
}

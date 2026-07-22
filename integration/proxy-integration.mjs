// Integration matrix for the reverse-proxy template: real sandboxed JS, real
// HTTP, local mock upstreams (zero network egress — everything binds
// 127.0.0.1). Covers what the mocked ___TESTS___ scenarios cannot: byte
// integrity, real header traffic, and status/error semantics over the wire.
// See integration/lib/gtm-runtime.mjs for the fidelity contract vs live e2e.
//
// Not discovered by bare `node --test` (which only picks up test/): run with
// `npm run integration`.

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startMockUpstream, patternBytes } from './lib/mock-upstream.mjs';
import { runProxyTag, assertUrlAllowed, sections } from './lib/gtm-runtime.mjs';

let mock;
before(async () => { mock = await startMockUpstream(); });
after(() => mock.close());
beforeEach(() => { mock.requests.length = 0; });

const run = (opts) => runProxyTag({ upstreamPort: mock.port, ...opts });

// --- Permission-mirror drift guard. -------------------------------------------
test('send_http permission section still matches the shim mirror', () => {
  const perms = sections.___SERVER_PERMISSIONS___;
  assert.match(perms, /https:\/\/\*\.axept\.io\/\*/);
  assert.match(perms, /https:\/\/\*\.axeptio\.eu\/\*/);
  assertUrlAllowed('https://api.axept.io/v1/app');
  assertUrlAllowed('https://static.axeptio.eu/x.js');
  for (const bad of ['https://evil.example.com/', 'http://api.axept.io/v1', 'https://axept.io/x', 'https://api.axept.io.evil.com/']) {
    assert.throws(() => assertUrlAllowed(bad), /send_http permission/, bad);
  }
});

// --- 1. Routing: every namespace reaches its origin with the prefix remapped. --
const ROUTING = [
  ['/static-eu/echo', 'static.axeptio.eu', '/echo'],
  ['/static/echo', 'static.axept.io', '/echo'],
  ['/client/echo', 'client.axept.io', '/echo'],
  ['/api/v1/echo', 'api.axept.io', '/v1/echo'],
  ['/favicons/echo', 'favicons.axept.io', '/echo'],
  ['/fonts/echo', 'fonts.axept.io', '/echo'],
  ['/consents', 'api.axept.io', '/v1/app/consents'],
];

for (const [path, host, route] of ROUTING) {
  test(`routes ${path} to ${host}${route}`, async () => {
    await run({ path });
    assert.equal(mock.requests.length, 1);
    assert.equal(mock.requests[0].host, host);
    assert.equal(mock.requests[0].route, route);
  });
}

// --- 2. Binary relay is byte-identical. ----------------------------------------
for (const [path, ct] of [['/fonts/bin/pattern?ct=font%2Fwoff2', 'font/woff2'], ['/favicons/bin/pattern?ct=image%2Fpng', 'image/png']]) {
  test(`binary relay through ${path.split('/')[1]} is byte-identical`, async () => {
    const [p, q] = path.split('?');
    const res = await run({ path: p, queryString: q });
    assert.equal(res.status, 200);
    assert.ok(res.body.equals(patternBytes()), 'relayed bytes differ from upstream bytes');
    assert.equal(res.headers['content-type'], ct);
    assert.equal(res.gtmOnSuccessCalls, 1);
  });
}

// --- 3. Request preservation: method, body, query, header allowlist. -----------
test('POST body query and allowlisted headers reach the upstream verbatim', async () => {
  const body = '{"token":"abc","accept":true}';
  const res = await run({
    path: '/api/v1/echo',
    queryString: 'clientId=abc&v=1',
    method: 'POST',
    body,
    requestHeaders: {
      'content-type': 'application/json',
      'User-Agent': 'sgtm-integration',
      'X-Forwarded-For': '203.0.113.7',
      'Cookie': 'secret=1',
    },
  });
  assert.equal(res.status, 200);
  const echo = JSON.parse(res.body.toString());
  assert.equal(echo.method, 'POST');
  assert.equal(echo.route, '/v1/echo');
  assert.equal(echo.query, 'clientId=abc&v=1');
  assert.equal(Buffer.from(echo.bodyBase64, 'base64').toString(), body);
  // Allowlisted headers forwarded (case-insensitive lookup), others never leak.
  assert.equal(echo.headers['content-type'], 'application/json');
  assert.equal(echo.headers['user-agent'], 'sgtm-integration');
  assert.equal(echo.headers['x-forwarded-for'], undefined);
  assert.equal(echo.headers['cookie'], undefined);
});

for (const method of ['GET', 'OPTIONS', 'HEAD']) {
  test(`${method} method is preserved to the upstream`, async () => {
    await run({ path: '/client/echo', method });
    assert.equal(mock.requests[0].method, method);
  });
}

// --- 4. Status relay: verbatim status, success/failure split at 400. -----------
const STATUSES = [
  [301, 1, 0],
  [304, 1, 0],
  [404, 0, 1],
  [500, 0, 1],
];

for (const [status, success, failure] of STATUSES) {
  test(`upstream ${status} is relayed verbatim`, async () => {
    const res = await run({ path: `/static/status/${status}` });
    assert.equal(res.status, status);
    assert.equal(res.gtmOnSuccessCalls, success);
    assert.equal(res.gtmOnFailureCalls, failure);
    if (status === 301) assert.equal(res.headers['location'], 'https://example.com/moved');
  });
}

// --- 5. Hop-by-hop response headers are stripped over real HTTP. ---------------
test('hop-by-hop response headers are stripped and normal headers relayed', async () => {
  const res = await run({ path: '/client/hop-headers' });
  assert.equal(res.status, 200);
  assert.equal(res.headers['x-custom'], 'keep-me');
  for (const dropped of ['connection', 'keep-alive', 'proxy-authenticate', 'upgrade', 'content-length']) {
    assert.equal(res.headers[dropped], undefined, `expected ${dropped} to be stripped`);
  }
});

// --- 6. Upstream connection error maps to a deterministic 502. -----------------
test('upstream connection error returns 502 Bad Gateway', async () => {
  const res = await run({ path: '/api/v1/network-error' });
  assert.equal(res.status, 502);
  assert.equal(res.body.toString(), 'Bad Gateway');
  assert.equal(res.gtmOnFailureCalls, 1);
});

// --- 7. Proxy base path stripping over the full request flow. ------------------
for (const basePath of ['/axeptio', 'axeptio', '/axeptio/']) {
  test(`base path "${basePath}" is stripped before routing`, async () => {
    const res = await run({ path: '/axeptio/static/echo', data: { proxyBasePath: basePath } });
    assert.equal(res.status, 200);
    assert.equal(mock.requests[0].host, 'static.axept.io');
  });
}

for (const basePath of ['/', '']) {
  test(`root base path "${basePath}" leaves routing untouched`, async () => {
    const res = await run({ path: '/static/echo', data: { proxyBasePath: basePath } });
    assert.equal(res.status, 200);
    assert.equal(mock.requests[0].host, 'static.axept.io');
  });
}

test('base path never mis-strips the non-boundary prefix axeptiofoo', async () => {
  const res = await run({ path: '/axeptiofoo/static/echo', data: { proxyBasePath: '/axeptio' } });
  assert.equal(res.status, 404);
  assert.equal(mock.requests.length, 0);
});

// --- 8. Unmatched path: 404, no upstream traffic. ------------------------------
test('unmatched path returns 404 without contacting any upstream', async () => {
  const res = await run({ path: '/nope' });
  assert.equal(res.status, 404);
  assert.equal(res.body.toString(), 'Not Found');
  assert.equal(res.gtmOnFailureCalls, 1);
  assert.equal(mock.requests.length, 0);
});

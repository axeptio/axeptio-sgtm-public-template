// End-to-end tests against a LIVE test sGTM container running this template.
//
// Unlike the unit suite (test/run-tpl-tests.mjs), this hits a real tagging server
// over HTTP and checks the proxy actually forwards each Axeptio namespace to the
// right upstream — including byte-correct relay of the binary /fonts and /favicons
// assets, the risk flagged in PR #10 (sGTM stringifies bodies as UTF-8, which can
// corrupt binary responses).
//
// It is account-agnostic: point it at any container by setting TAGGING_URL.
//
//   TAGGING_URL=https://sgtm-test.example.com \
//   PROXY_BASE_PATH=/axeptio \
//   node --test e2e/proxy-e2e.mjs
//
// With no TAGGING_URL it SKIPS every test (exit 0), so CI stays green until the
// Addingwell test container + secret are wired up. Each case is anchored on the
// upstream: if the sample asset 404s upstream the case is marked SKIPPED (not
// passed), so a stale sample never produces a false negative or a false success.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const TAGGING_URL = (process.env.TAGGING_URL || '').replace(/\/+$/, '');
const BASE_PATH = process.env.PROXY_BASE_PATH || '';

// One sample per namespace: the path the proxy receives (after the base path) and
// the upstream origin it must be forwarded to. `compare`:
//   'bytes'     — proxied body must be byte-identical to the upstream asset
//                 (static files; the only way to catch binary relay corruption).
//   'reachable' — dynamic endpoint: assert the proxy relays the upstream status
//                 (a byte compare would be flaky). Covers the namespace without
//                 asserting a moving body.
// Override any path via env once the real container/assets are known.
const ROUTES = [
  { ns: 'static',    path: process.env.E2E_STATIC_PATH   || '/static/axeptio.js',          upstream: 'https://static.axept.io',   compare: 'bytes' },
  { ns: 'client',    path: process.env.E2E_CLIENT_PATH   || '/client/axeptio.json',        upstream: 'https://client.axept.io',   compare: 'bytes' },
  { ns: 'static-eu', path: process.env.E2E_STATICEU_PATH || '/static-eu/axeptio.js',       upstream: 'https://static.axeptio.eu', compare: 'bytes' },
  { ns: 'fonts',     path: process.env.E2E_FONT_PATH     || '/fonts/axeptio.woff2',        upstream: 'https://fonts.axept.io',    compare: 'bytes' },
  { ns: 'favicons',  path: process.env.E2E_FAVICON_PATH  || '/favicons/axeptio.png',       upstream: 'https://favicons.axept.io', compare: 'bytes' },
  // /api/v1/ forwards to api.axept.io/v1/ — needs a real, GET-able sample
  // (e.g. an app-config endpoint for a test clientId) via E2E_API_PATH.
  { ns: 'api',       path: process.env.E2E_API_PATH      || '/api/v1/app/your-client-id',  upstream: 'https://api.axept.io',      compare: 'reachable' },
];

const enabled = TAGGING_URL.length > 0;
if (!enabled) {
  console.log('TAGGING_URL not set — skipping e2e (set it to a test container tagging URL to run).');
}

const proxyUrl = (routePath) => `${TAGGING_URL}${BASE_PATH}${routePath}`;

// Mirror the template's routing: strip the namespace prefix (first path segment)
// and append the remainder to the upstream origin. `/static/foo.js` ->
// `https://static.axept.io/foo.js`; `/api/v1/app/x` -> `https://api.axept.io/v1/app/x`.
const upstreamFor = (route) => `${route.upstream}${route.path.replace(/^\/[^/]+\//, '/')}`;

for (const route of ROUTES) {
  test(`${route.ns}: proxy forwards to ${route.upstream} (${route.compare})`, { skip: !enabled }, async (t) => {
    const direct = await fetch(upstreamFor(route));
    if (!direct.ok) {
      // Don't claim a pass for a case we couldn't actually verify.
      t.skip(`upstream ${upstreamFor(route)} returned ${direct.status}; set E2E_${route.ns.toUpperCase()}_PATH to a valid asset`);
      return;
    }
    const proxied = await fetch(proxyUrl(route.path));

    if (route.compare === 'reachable') {
      // Dynamic endpoint: confirm the proxy reached the upstream and relayed its
      // status rather than swallowing it or returning a 404 from a misroute.
      assert.equal(proxied.status, direct.status, `${route.ns}: proxy status should match upstream (${direct.status})`);
      const body = Buffer.from(await proxied.arrayBuffer());
      assert.ok(body.length > 0, `${route.ns}: proxied body should be non-empty`);
      return;
    }

    // Static asset: the proxied body must equal the upstream byte-for-byte. This
    // catches both wrong-upstream forwarding and binary relay corruption.
    assert.equal(proxied.status, 200, `proxy ${proxyUrl(route.path)} should return 200`);
    const proxiedBytes = Buffer.from(await proxied.arrayBuffer());
    const directBytes = Buffer.from(await direct.arrayBuffer());
    assert.ok(
      proxiedBytes.equals(directBytes),
      `${route.ns}: proxied bytes (${proxiedBytes.length}) differ from upstream (${directBytes.length}) — wrong upstream or relay corruption`,
    );
  });
}

test('unmatched path returns 404 from the proxy', { skip: !enabled }, async () => {
  const res = await fetch(proxyUrl('/definitely-not-a-namespace'));
  assert.equal(res.status, 404, 'an unmatched path should 404');
});

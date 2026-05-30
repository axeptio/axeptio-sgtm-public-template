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
// Addingwell test container + secret are wired up. Each asset path is fetched from
// the upstream first; if the sample path 404s upstream it is skipped (not failed),
// so a stale sample never produces a false negative.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const TAGGING_URL = (process.env.TAGGING_URL || '').replace(/\/+$/, '');
const BASE_PATH = process.env.PROXY_BASE_PATH || '';

// Sample asset per namespace: the path the proxy receives (after the base path)
// and the upstream origin it must be forwarded to. Override the paths via env once
// the real container is known (the defaults are representative, not guaranteed).
const ROUTES = [
  { ns: 'static',    path: process.env.E2E_STATIC_PATH   || '/static/axeptio.js',   upstream: 'https://static.axept.io',  binary: false },
  { ns: 'client',    path: process.env.E2E_CLIENT_PATH   || '/client/axeptio.json', upstream: 'https://client.axept.io',  binary: false },
  { ns: 'static-eu', path: process.env.E2E_STATICEU_PATH || '/static-eu/axeptio.js',upstream: 'https://static.axeptio.eu',binary: false },
  { ns: 'fonts',     path: process.env.E2E_FONT_PATH     || '/fonts/axeptio.woff2', upstream: 'https://fonts.axept.io',    binary: true },
  { ns: 'favicons',  path: process.env.E2E_FAVICON_PATH  || '/favicons/axeptio.png',upstream: 'https://favicons.axept.io', binary: true },
];

const enabled = TAGGING_URL.length > 0;
if (!enabled) {
  console.log('TAGGING_URL not set — skipping e2e (set it to a test container tagging URL to run).');
}

function proxyUrl(routePath) {
  return `${TAGGING_URL}${BASE_PATH}${routePath}`;
}

// Resolve `/static/foo.js` -> upstream `https://static.axept.io/foo.js` (strip the
// namespace prefix, keep the remainder) to mirror the template's routing.
function upstreamFor(route) {
  const rest = route.path.replace(/^\/[^/]+\//, '/');
  return `${route.upstream}${rest}`;
}

for (const route of ROUTES) {
  test(`${route.ns}: proxy forwards to ${route.upstream} (byte-correct=${route.binary})`, { skip: !enabled }, async () => {
    // Anchor on the upstream: if the sample asset is gone upstream, skip rather
    // than fail (keeps the suite honest about what it actually verified).
    const direct = await fetch(upstreamFor(route));
    if (!direct.ok) {
      console.log(`  skip ${route.ns}: upstream ${upstreamFor(route)} returned ${direct.status}; set E2E_${route.ns.toUpperCase()}_PATH to a valid asset`);
      return;
    }
    const directBytes = Buffer.from(await direct.arrayBuffer());

    const proxied = await fetch(proxyUrl(route.path));
    assert.equal(proxied.status, 200, `proxy ${proxyUrl(route.path)} should return 200`);
    const proxiedBytes = Buffer.from(await proxied.arrayBuffer());

    if (route.binary) {
      // The whole point: binary assets must come back byte-identical.
      assert.ok(
        proxiedBytes.equals(directBytes),
        `${route.ns}: proxied bytes (${proxiedBytes.length}) differ from upstream (${directBytes.length}) — binary relay corruption`,
      );
    } else {
      assert.ok(proxiedBytes.length > 0, `${route.ns}: proxied body should be non-empty`);
    }
  });
}

test('unmatched path returns 404 from the proxy', { skip: !enabled }, async () => {
  const res = await fetch(proxyUrl('/definitely-not-a-namespace'));
  assert.equal(res.status, 404, 'an unmatched path should 404');
});

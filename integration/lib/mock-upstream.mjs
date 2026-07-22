// Local fixture server standing in for the Axeptio upstream origins during
// integration tests. The gtm-runtime shim rewrites https://<host>/<path> to
// http://127.0.0.1:<port>/<host>/<path>, so the first path segment names the
// emulated origin: one server covers all origins while every test can assert
// exactly which origin was hit and with what.

import http from 'node:http';

// Deterministic 4KB binary covering every byte value 0x00-0xFF, including
// sequences that are invalid UTF-8 — the corruption class the byte-identity
// tests exist to catch — without committing binary blobs to git.
export function patternBytes() {
  return Buffer.from(Array.from({ length: 4096 }, (_, i) => (i * 7 + 13) & 0xff));
}

export function startMockUpstream() {
  // Every request the emulated origins received, for test assertions.
  const requests = [];

  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const url = new URL(req.url, 'http://mock');
      const [, host, ...rest] = url.pathname.split('/');
      const route = '/' + rest.join('/');
      requests.push({ method: req.method, host, route, query: url.search.slice(1), headers: req.headers, body });

      // The /api/v1/ namespace remaps to the upstream's /v1/ prefix; fixtures
      // are addressed the same on every origin, so drop it before dispatch.
      const fixture = route.replace(/^\/v1/, '');

      if (fixture.startsWith('/bin/pattern')) {
        res.writeHead(200, { 'Content-Type': url.searchParams.get('ct') || 'application/octet-stream' });
        res.end(patternBytes());
      } else if (fixture.startsWith('/echo')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          method: req.method,
          route,
          query: url.search.slice(1),
          headers: req.headers,
          bodyBase64: body.toString('base64'),
        }));
      } else if (fixture.startsWith('/status/')) {
        const status = Number(fixture.split('/')[2]);
        const headers = { 'X-Marker': 'status-fixture' };
        if (status === 301) headers.Location = 'https://example.com/moved';
        res.writeHead(status, headers);
        // 204/304 must not carry a body; Node enforces this.
        res.end(status === 204 || status === 304 ? undefined : `status-${status}`);
      } else if (fixture.startsWith('/hop-headers')) {
        // Hop-by-hop headers the template must strip, plus one it must relay.
        // Transfer-Encoding itself would break Node's response framing, so the
        // strip list's other members stand in for it.
        res.writeHead(200, {
          'Keep-Alive': 'timeout=5',
          'Proxy-Authenticate': 'Basic',
          'Upgrade': 'h2c',
          'X-Custom': 'keep-me',
        });
        res.end('hop');
      } else if (fixture.startsWith('/network-error')) {
        req.socket.destroy();
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('mock: no fixture for ' + route);
      }
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({
        port: server.address().port,
        requests,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

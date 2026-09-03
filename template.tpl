___TERMS_OF_SERVICE___

By creating or modifying this file you agree to Google Tag Manager's Community
Template Gallery Developer Terms of Service available at
https://developers.google.com/tag-manager/gallery-tos (or such other URL as
Google may provide), as modified from time to time.


___INFO___

{
  "type": "TAG",
  "id": "cvt_temp_public_id",
  "version": 1,
  "securityGroups": [],
  "displayName": "Axeptio CMP (Server-Side)",
  "brand": {
    "id": "github.com_axeptio",
    "displayName": "Axeptio"
  },
  "categories": [
    "TAG_MANAGEMENT",
    "UTILITY"
  ],
  "description": "Serve the Axeptio consent management platform from your own first-party domain. The tag reverse-proxies every Axeptio origin through your tagging server, so the CMP script, configuration and consent calls travel first-party and are not shortened by ITP cookie lifetime limits.",
  "containerContexts": [
    "SERVER"
  ]
}


___TEMPLATE_PARAMETERS___

[
  {
    "type": "TEXT",
    "name": "projectId",
    "displayName": "Axeptio Project ID",
    "simpleValueType": true,
    "help": "Optional. Your unique Axeptio Project ID (clientId). Reference only — not used at runtime; the proxy forwards requests as-is. Reserved for identification and future validation."
  },
  {
    "type": "TEXT",
    "name": "cookieVersion",
    "displayName": "Cookie Version",
    "simpleValueType": true,
    "help": "Optional. The version of the cookies managed by Axeptio. Reference only — not used at runtime by this proxy tag."
  },
  {
    "type": "TEXT",
    "name": "proxyBasePath",
    "displayName": "Proxy Base Path",
    "simpleValueType": true,
    "defaultValue": "",
    "help": "The path portion of the SDK 'proxyBaseUrl' served by this container. For proxyBaseUrl 'https://sgtm.example.com/axeptio' set this to '/axeptio'. Leave empty if the container is mounted at the domain root. It is stripped from the request path before route matching."
  },
  {
    "type": "CHECKBOX",
    "name": "enableLogging",
    "checkboxText": "Enable debug logging",
    "simpleValueType": true,
    "defaultValue": false,
    "help": "Log matched routes and upstream URLs to the GTM Server console (debug environments only)."
  }
]


___SANDBOXED_JS_FOR_SERVER___

const getRequestPath = require('getRequestPath');
const getRequestQueryString = require('getRequestQueryString');
const getRequestBody = require('getRequestBody');
const sendHttpRequest = require('sendHttpRequest');
const getRequestHeader = require('getRequestHeader');
const getRequestMethod = require('getRequestMethod');
const logToConsole = require('logToConsole');
const setResponseStatus = require('setResponseStatus');
const setResponseBody = require('setResponseBody');
const setResponseHeader = require('setResponseHeader');
const returnResponse = require('returnResponse');

const requestHeaders = {};

// Content-Length / Content-Encoding are intentionally NOT forwarded: the HTTP
// client sets Content-Length for the body it actually sends, and forwarding a
// stale length (or an encoding the body no longer has) can cause upstream
// request failures or hung connections.
const headerNames = [
  'Accept',
  'Accept-Language',
  'Cache-Control',
  'Content-Type',
  'Dnt',
  'Forwarded',
  'If-Match',
  'If-Modified-Since',
  'If-None-Match',
  'If-Range',
  'If-Unmodified-Since',
  'Origin',
  'Pragma',
  'Priority',
  'Range',
  'Referer',
  'Sec-Ch-Ua',
  'Sec-Ch-Ua-Mobile',
  'Sec-Ch-Ua-Platform',
  'Sec-Fetch-Dest',
  'Sec-Fetch-Mode',
  'Sec-Fetch-Site',
  'Traceparent',
  'User-Agent',
  'Via'
];

headerNames.forEach((headerName) => {
  const value = getRequestHeader(headerName);
  if (value !== undefined && value !== null) {
    requestHeaders[headerName] = value;
  }
});


const requestBody = getRequestBody();

// proxyBaseUrl namespace -> upstream Axeptio origin. Most specific prefixes
// first so '/static-eu/' is never shadowed by '/static/'.
const routes = [
  { prefix: '/static-eu/', upstream: 'https://static.axeptio.eu/' },
  { prefix: '/static/', upstream: 'https://static.axept.io/' },
  { prefix: '/client/', upstream: 'https://client.axept.io/' },
  { prefix: '/api/v1/', upstream: 'https://api.axept.io/v1/' },
  { prefix: '/favicons/', upstream: 'https://favicons.axept.io/' },
  { prefix: '/fonts/', upstream: 'https://fonts.axept.io/' }
];

// Hop-by-hop and framing headers that must not be relayed from the upstream
// response: they describe a single connection and the GTM HTTP client computes
// its own framing. Forwarding them can corrupt the response to the client.
const droppedResponseHeaders = {
  'connection': true,
  'keep-alive': true,
  'proxy-authenticate': true,
  'proxy-authorization': true,
  'te': true,
  'trailer': true,
  'transfer-encoding': true,
  'upgrade': true,
  'content-length': true
};

// Strip the configured proxy base path (e.g. '/axeptio') before matching.
// Normalize to a leading slash and no trailing slash, then strip only on a
// path boundary so '/axeptio' never mis-strips '/axeptiofoo/...'.
let path = getRequestPath() || '/';
let basePath = data.proxyBasePath || '';
if (basePath) {
  if (basePath.indexOf('/') !== 0) {
    basePath = '/' + basePath;
  }
  while (basePath.length > 1 && basePath.charAt(basePath.length - 1) === '/') {
    basePath = basePath.substring(0, basePath.length - 1);
  }
  // A base path of just '/' (e.g. user entered '/' or '////') means root mount;
  // treat it as empty so routing is not silently broken.
  if (basePath === '/') {
    basePath = '';
  }
}
if (basePath) {
  if (path === basePath) {
    path = '/';
  } else if (path.indexOf(basePath + '/') === 0) {
    path = path.substring(basePath.length);
  }
}

// Preserve the original query string. getRequestQueryString() returns the query
// without a leading '?', or '' when there is none.
const rawQuery = getRequestQueryString();
const queryString = rawQuery ? '?' + rawQuery : '';

// Preserve the original HTTP method via the read_request lifecycle API
// (getRequestMethod needs no permission). It is authoritative for the incoming
// request, including GET/POST/OPTIONS/HEAD; 'GET' is only a defensive default.
const method = getRequestMethod() || 'GET';

// Resolve the upstream URL from the matched namespace, or the legacy
// '/consents' alias for installs created before namespace routing existed.
let upstreamUrl = null;
for (let i = 0; i < routes.length; i++) {
  if (path.indexOf(routes[i].prefix) === 0) {
    upstreamUrl = routes[i].upstream + path.substring(routes[i].prefix.length) + queryString;
    break;
  }
}
if (!upstreamUrl && path === '/consents') {
  upstreamUrl = 'https://api.axept.io/v1/app/consents' + queryString;
}

if (upstreamUrl) {
  if (data.enableLogging) {
    logToConsole('Axeptio proxy: ' + method + ' ' + path + ' -> ' + upstreamUrl);
  }
  sendHttpRequest(upstreamUrl, {
    headers: requestHeaders,
    method: method
  }, requestBody).then(response => {
    // Relay the upstream response verbatim whatever the status code, so
    // redirects (3xx), caching (304) and errors (4xx/5xx) reach the caller
    // instead of being swallowed into an empty response.
    setResponseStatus(response.statusCode);
    setResponseBody(response.body);
    for (let key in response.headers) {
      const value = response.headers[key];
      if (value === undefined || value === null) {
        continue;
      }
      if (droppedResponseHeaders[key.toLowerCase()]) {
        continue;
      }
      setResponseHeader(key, value);
    }
    returnResponse();
    if (response.statusCode >= 200 && response.statusCode < 400) {
      data.gtmOnSuccess();
    } else {
      data.gtmOnFailure();
    }
  }).catch(() => {
    // Network error / timeout reaching the upstream: return a deterministic
    // 502 rather than leaving the request hanging.
    setResponseStatus(502);
    setResponseBody('Bad Gateway');
    returnResponse();
    data.gtmOnFailure();
  });
} else {
  // No namespace matched: respond with an explicit 404 and mark the tag as
  // failed so misroutes are diagnosable instead of looking like a successful
  // execution in Preview/monitoring.
  setResponseStatus(404);
  setResponseBody('Not Found');
  returnResponse();
  data.gtmOnFailure();
}


___SERVER_PERMISSIONS___

[
  {
    "instance": {
      "key": {
        "publicId": "logging",
        "versionId": "1"
      },
      "param": [
        {
          "key": "environments",
          "value": {
            "type": 1,
            "string": "debug"
          }
        }
      ]
    },
    "clientAnnotations": {
      "isEditedByUser": true
    },
    "isRequired": true
  },
  {
    "instance": {
      "key": {
        "publicId": "send_http",
        "versionId": "1"
      },
      "param": [
        {
          "key": "allowedUrls",
          "value": {
            "type": 1,
            "string": "specific"
          }
        },
        {
          "key": "urls",
          "value": {
            "type": 2,
            "listItem": [
              {
                "type": 1,
                "string": "https://*.axept.io/*"
              },
              {
                "type": 1,
                "string": "https://*.axeptio.eu/*"
              }
            ]
          }
        }
      ]
    },
    "clientAnnotations": {
      "isEditedByUser": true
    },
    "isRequired": true
  },
  {
    "instance": {
      "key": {
        "publicId": "read_request",
        "versionId": "1"
      },
      "param": [
        {
          "key": "requestAccess",
          "value": {
            "type": 1,
            "string": "any"
          }
        },
        {
          "key": "headerAccess",
          "value": {
            "type": 1,
            "string": "any"
          }
        },
        {
          "key": "queryParameterAccess",
          "value": {
            "type": 1,
            "string": "any"
          }
        }
      ]
    },
    "clientAnnotations": {
      "isEditedByUser": true
    },
    "isRequired": true
  },
  {
    "instance": {
      "key": {
        "publicId": "access_response",
        "versionId": "1"
      },
      "param": [
        {
          "key": "writeResponseAccess",
          "value": {
            "type": 1,
            "string": "any"
          }
        },
        {
          "key": "writeHeaderAccess",
          "value": {
            "type": 1,
            "string": "any"
          }
        }
      ]
    },
    "clientAnnotations": {
      "isEditedByUser": true
    },
    "isRequired": true
  },
  {
    "instance": {
      "key": {
        "publicId": "return_response",
        "versionId": "1"
      },
      "param": []
    },
    "isRequired": true
  }
]


___TESTS___

setup: |-
  let sent;
  function mockRequest(path, method) {
    mock('getRequestPath', () => path);
    mock('getRequestQueryString', () => '');
    mock('getRequestBody', () => 'BODY');
    mock('getRequestMethod', () => method);
  }
  function mockUpstream(response) {
    sent = undefined;
    mock('sendHttpRequest', (url, opts, body) => {
      sent = { url: url, method: opts.method, body: body };
      return Promise.create((resolve) => resolve(response));
    });
  }
  function mockUpstreamError() {
    mock('sendHttpRequest', () => Promise.create((resolve, reject) => reject('network')));
  }
scenarios:
- name: 'api v1 consent POST is forwarded to api axept io method and body preserved'
  code: |-
    mockRequest('/api/v1/app/consents', 'POST');
    mockUpstream({ statusCode: 200, body: 'OK', headers: {} });
    runCode({ proxyBasePath: '' });
    assertThat(sent.url).isEqualTo('https://api.axept.io/v1/app/consents');
    assertThat(sent.method).isEqualTo('POST');
    assertThat(sent.body).isEqualTo('BODY');
    assertApi('setResponseStatus').wasCalledWith(200);
    assertApi('returnResponse').wasCalled();
    assertApi('gtmOnSuccess').wasCalled();
    assertApi('gtmOnFailure').wasNotCalled();
- name: 'static asset GET is forwarded to static axept io'
  code: |-
    mockRequest('/static/foo.js', 'GET');
    mockUpstream({ statusCode: 200, body: 'x', headers: {} });
    runCode({ proxyBasePath: '' });
    assertThat(sent.url).isEqualTo('https://static.axept.io/foo.js');
    assertThat(sent.method).isEqualTo('GET');
    assertApi('gtmOnSuccess').wasCalled();
- name: 'client config GET is forwarded to client axept io'
  code: |-
    mockRequest('/client/config.json', 'GET');
    mockUpstream({ statusCode: 200, body: 'x', headers: {} });
    runCode({ proxyBasePath: '' });
    assertThat(sent.url).isEqualTo('https://client.axept.io/config.json');
- name: 'favicon GET is forwarded to favicons axept io'
  code: |-
    mockRequest('/favicons/x.png', 'GET');
    mockUpstream({ statusCode: 200, body: 'x', headers: {} });
    runCode({ proxyBasePath: '' });
    assertThat(sent.url).isEqualTo('https://favicons.axept.io/x.png');
- name: 'font GET is forwarded to fonts axept io'
  code: |-
    mockRequest('/fonts/x.woff2', 'GET');
    mockUpstream({ statusCode: 200, body: 'x', headers: {} });
    runCode({ proxyBasePath: '' });
    assertThat(sent.url).isEqualTo('https://fonts.axept.io/x.woff2');
- name: 'static-eu is routed to static axeptio eu and not shadowed by the static path'
  code: |-
    mockRequest('/static-eu/app.js', 'GET');
    mockUpstream({ statusCode: 200, body: 'x', headers: {} });
    runCode({ proxyBasePath: '' });
    assertThat(sent.url).isEqualTo('https://static.axeptio.eu/app.js');
- name: 'proxy base path is stripped before route matching'
  code: |-
    mockRequest('/axeptio/api/v1/app', 'POST');
    mockUpstream({ statusCode: 200, body: 'x', headers: {} });
    runCode({ proxyBasePath: '/axeptio' });
    assertThat(sent.url).isEqualTo('https://api.axept.io/v1/app');
- name: 'base path is not mis-stripped on a non-boundary prefix axeptiofoo'
  code: |-
    mockRequest('/axeptiofoo/api/v1/app', 'GET');
    runCode({ proxyBasePath: '/axeptio' });
    assertApi('sendHttpRequest').wasNotCalled();
    assertApi('setResponseStatus').wasCalledWith(404);
    assertApi('gtmOnFailure').wasCalled();
- name: 'query string is preserved on the forwarded URL'
  code: |-
    mockRequest('/api/v1/app', 'GET');
    mock('getRequestQueryString', () => 'clientId=abc&v=1');
    mockUpstream({ statusCode: 200, body: 'x', headers: {} });
    runCode({ proxyBasePath: '' });
    assertThat(sent.url).isEqualTo('https://api.axept.io/v1/app?clientId=abc&v=1');
- name: 'legacy consents alias is forwarded to api axept io v1 app consents'
  code: |-
    mockRequest('/consents', 'POST');
    mockUpstream({ statusCode: 200, body: 'x', headers: {} });
    runCode({ proxyBasePath: '' });
    assertThat(sent.url).isEqualTo('https://api.axept.io/v1/app/consents');
- name: 'a 3xx upstream status is relayed verbatim and counts as success'
  code: |-
    mockRequest('/client/config.json', 'GET');
    mockUpstream({ statusCode: 302, body: '', headers: {} });
    runCode({ proxyBasePath: '' });
    assertApi('setResponseStatus').wasCalledWith(302);
    assertApi('gtmOnSuccess').wasCalled();
    assertApi('gtmOnFailure').wasNotCalled();
- name: 'a 5xx upstream status is relayed verbatim and counts as failure'
  code: |-
    mockRequest('/api/v1/app', 'GET');
    mockUpstream({ statusCode: 500, body: 'err', headers: {} });
    runCode({ proxyBasePath: '' });
    assertApi('setResponseStatus').wasCalledWith(500);
    assertApi('gtmOnFailure').wasCalled();
    assertApi('gtmOnSuccess').wasNotCalled();
- name: 'an upstream network error returns a deterministic 502'
  code: |-
    mockRequest('/api/v1/app', 'GET');
    mockUpstreamError();
    runCode({ proxyBasePath: '' });
    assertApi('setResponseStatus').wasCalledWith(502);
    assertApi('setResponseBody').wasCalledWith('Bad Gateway');
    assertApi('gtmOnFailure').wasCalled();
- name: 'an unmatched path returns 404 and does not call upstream'
  code: |-
    mockRequest('/random', 'GET');
    runCode({ proxyBasePath: '' });
    assertApi('sendHttpRequest').wasNotCalled();
    assertApi('setResponseStatus').wasCalledWith(404);
    assertApi('setResponseBody').wasCalledWith('Not Found');
    assertApi('gtmOnFailure').wasCalled();
- name: 'hop-by-hop response headers are dropped while normal headers are relayed'
  code: |-
    let headersSet = {};
    mockRequest('/static/a.css', 'GET');
    sent = undefined;
    mock('sendHttpRequest', (url, opts, body) => {
      return Promise.create((resolve) => resolve({
        statusCode: 200,
        body: 'x',
        headers: { 'Content-Type': 'text/css', 'Transfer-Encoding': 'chunked' }
      }));
    });
    mock('setResponseHeader', (key, value) => { headersSet[key] = value; });
    runCode({ proxyBasePath: '' });
    assertThat(headersSet['Content-Type']).isEqualTo('text/css');
    assertThat(headersSet['Transfer-Encoding']).isUndefined();


___NOTES___

Axeptio CMP (Server-Side) — a first-party reverse proxy for Axeptio.

The Axeptio JS SDK, when configured with 'proxyBaseUrl', sends all of its traffic
to your own domain instead of Axeptio's. This tag receives those requests in your
tagging server and forwards each one to the matching Axeptio origin, so the CMP
script, its configuration and the visitor's consent calls all travel first-party.

Routes ('*' is the remainder of the path, forwarded as-is):

  /static/*     ->  https://static.axept.io/*
  /client/*     ->  https://client.axept.io/*
  /api/v1/*     ->  https://api.axept.io/v1/*
  /favicons/*   ->  https://favicons.axept.io/*
  /fonts/*      ->  https://fonts.axept.io/*
  /static-eu/*  ->  https://static.axeptio.eu/*

The legacy '/consents' path is still accepted and forwarded to
https://api.axept.io/v1/app/consents. Anything unmatched returns a 404.

Forwarding is transparent: the HTTP method, the query string and the relevant
request and response headers are preserved, and the upstream status code is
relayed as-is.

Setup

  - Proxy Base Path must be the path part of the SDK's 'proxyBaseUrl'. For
    'https://sgtm.example.com/axeptio' set '/axeptio'; leave it empty when the
    container is mounted at the domain root. It is stripped before route
    matching.
  - Trigger this tag on ALL incoming requests to the proxy domain. Every
    namespace above flows through it, so a trigger scoped to consent alone
    breaks the CMP.
  - Axeptio Project ID and Cookie Version are reference only. They are not used
    at runtime; the SDK already carries the client id.
  - /fonts/* and /favicons/* serve binary assets and there is no fallback to
    Google Fonts in proxy mode. A misconfigured binary route fails silently.

Source, tests and documentation:
https://github.com/axeptio/axeptio-sgtm-public-template

# Claiming inbound requests

**In server-side GTM a Tag cannot claim an HTTP request.** A Client claims it; the Tag
runs only afterwards, on an event that Client dispatched. This template is a Tag. It
ships no Client — so the Client is a piece of setup **you** have to provide, and without
it the proxy tag never runs at all.

This page explains why, what the tag does and does not do, why the sibling Axeptio
*client* template does not fill the gap, and gives a reference Client you can paste into
your container.

- [1. Why a Client is required](#1-why-a-client-is-required)
- [2. What our tag does and does not do](#2-what-our-tag-does-and-does-not-do)
- [3. Why the Axeptio client template is not the answer](#3-why-the-axeptio-client-template-is-not-the-answer)
- [4. The reference Client](#4-the-reference-client)
- [5. What is verified and what is not](#5-what-is-verified-and-what-is-not)

---

## 1. Why a Client is required

Google's [introduction to server-side tagging](https://developers.google.com/tag-platform/tag-manager/server-side/intro)
describes the split:

> Clients are adapters between the software running on a user's device and your server
> container.

> Every request that comes into the container will be processed by each client in
> priority order, highest priority client first. The first thing each client will do is
> decide whether it knows how to process that kind of request. If it can, the client
> "claims" the request and continues on to the next stage of processing.

Claiming is not something a tag may do. From the
[Server-side tagging APIs reference](https://developers.google.com/tag-platform/tag-manager/server-side/api),
on `claimRequest`:

> Use this API in a client to claim the request. Once a request is claimed, the
> container does not run additional clients.
>
> This API throws an exception if called in a tag or variable. This API throws an
> exception if called after the client returns.

The associated permissions for `claimRequest` are listed as **None** — it is gated by
template *type*, not by a permission you could grant to a tag.

This template declares `"type": "TAG"` (`template.tpl:12`) and calls `claimRequest`
nowhere: `grep -n claimRequest template.tpl` returns zero matches, and so does the same
grep over `test/`, `integration/` and `e2e/`. (This page and the README name the API in
prose, so a repository-wide grep now matches those; the template and its test suites do
not call it.) So a raw
request to `https://sgtm.example.com/axeptio/client/…` reaches the container, is offered
to each Client in priority order, and if **no Client claims it** the proxy tag is never
reached, however its triggers are configured.

The chain is always three links, not one:

```
inbound HTTP request
  └─ a Client claims it                      (claimRequest)
       └─ that Client dispatches an event    (runContainer)
            └─ a trigger matching that event fires the Axeptio proxy tag
```

Miss any link and the symptom is the same, and misleading: the container answers, but
the proxy never runs.

## 2. What our tag does and does not do

The tag is a pure forwarder. Its eleven sandboxed-API imports (`template.tpl:70-80`) are
`getRequestPath`, `getRequestQueryString`, `getRequestBody`, `sendHttpRequest`,
`getRequestHeader`, `getRequestMethod`, `logToConsole`, `setResponseStatus`,
`setResponseBody`, `setResponseHeader` and `returnResponse`. There is no `claimRequest`
and no `runContainer` in that list.

What it *does*, once something has caused it to run:

| Behaviour | Where |
| --- | --- |
| Normalises the **Proxy Base Path** (leading slash, no trailing slash, a bare `/` means root mount) and strips it only on a path boundary, so `/axeptio` never mis-strips `/axeptiofoo` | `template.tpl:152-176` |
| Matches the remaining path against six namespaces — `/static-eu/`, `/static/`, `/client/`, `/api/v1/`, `/favicons/`, `/fonts/` — most specific first | `template.tpl:128-135` |
| Accepts the legacy `/consents` alias, forwarding it to `https://api.axept.io/v1/app/consents` | `template.tpl:197-198` |
| Sets the response status, body and headers from the upstream response, calls `returnResponse()`, then `data.gtmOnSuccess()` | `template.tpl:212-226` |
| On an upstream failure, answers `502` and calls `data.gtmOnFailure()` | `template.tpl:233-236` |
| On an unmatched path, answers `404` and calls `data.gtmOnFailure()` | `template.tpl:242-245` |

A tag writing the response is not a hack. Google describes `returnResponse` as flushing
what *other* templates set:

> Flushes the response that was previously set by other templates using the APIs that
> modify the response, including setCookie, setPixelResponse, setResponseBody,
> setResponseHeader, and setResponseStatus.

So "one template composes the response, another flushes it" is the documented shape. The
genuinely open question is **who flushes**: our tag calls `returnResponse()` itself
(`template.tpl:224`, `:235`, `:244`), while the same reference says "It is recommended
that this API be used from a client template." See
[section 5](#5-what-is-verified-and-what-is-not).

## 3. Why the Axeptio client template is not the answer

Axeptio publishes a second, separate gallery template,
[`axeptio-client-sgtm-public-template`](https://github.com/axeptio/axeptio-client-sgtm-public-template),
which is `"type": "CLIENT"`. It is tempting to assume the two are a matched pair. **They
are not**, and pairing them breaks the proxy. Four reasons, all from that repository's
own `template.tpl`:

1. **Nothing is configurable.** Its `___TEMPLATE_PARAMETERS___` is the empty list `[]`
   (line 34). There is no Proxy Base Path field, so it cannot be told where your
   `proxyBaseUrl` is mounted.
2. **Its claim predicate is hardcoded and narrow.** Line 95 is
   `if (requestPath.indexOf('/consents') > -1) {`, and line 97 is the `claimRequest()`
   inside it. It claims only paths *containing* `/consents`. None of the six proxy
   namespaces — `/static/`, `/client/`, `/api/v1/`, `/favicons/`, `/fonts/`,
   `/static-eu/` — matches, so the SDK bundle, the assets and the fonts are never
   claimed. It is also a substring test, not a boundary-safe prefix test.
3. **Its callback replaces any tag's response.** Inside `runContainer(obj, …)` (line
   154) it calls `setPixelResponse()` (line 156) and then `returnResponse()` (line 165).
   `setPixelResponse` stages a 1×1 GIF body with its own content type, so whatever the
   proxy tag had staged from the Axeptio upstream would be overwritten before the flush.
4. **It was never written for proxying.** The word "proxy" appears nowhere in that
   repository — not in the template, not in its README. It dispatches
   `event_name: 'consents'` (line 104) and mirrors Axeptio consent cookies. It is a
   consent-measurement client: a different product that happens to share the brand.

Treat the two templates as unrelated gallery listings. Use the Client in
[section 4](#4-the-reference-client) instead.

## 4. The reference Client

Create a **new** server Client template in your container (Templates → Client Templates
→ New) and paste the blocks below. It is deliberately minimal: match, claim, dispatch.

> **This Client is derived from Google's documented server-side API, not from an observed
> Axeptio deployment.** It is not shipped, versioned or tested by Axeptio. Read
> [section 5](#5-what-is-verified-and-what-is-not) before relying on it.

### `___TEMPLATE_PARAMETERS___`

One field, mirroring the tag's, so the two agree on where the proxy is mounted:

```json
[
  {
    "type": "TEXT",
    "name": "proxyBasePath",
    "displayName": "Proxy Base Path",
    "simpleValueType": true,
    "defaultValue": "",
    "help": "Must be identical to the Proxy Base Path configured on the Axeptio proxy tag: the path portion of the SDK 'proxyBaseUrl'. For proxyBaseUrl 'https://sgtm.example.com/axeptio' set this to '/axeptio'. Leave empty if the container is mounted at the domain root."
  }
]
```

### `___SANDBOXED_JS_FOR_SERVER___`

```js
// Axeptio proxy Client — reference implementation.
//
// DERIVED FROM GOOGLE'S DOCUMENTED SERVER-SIDE API, NOT FROM AN OBSERVED
// DEPLOYMENT. Axeptio neither ships nor tests this Client, and no automated test
// in the axeptio-sgtm-public-template repository exercises the claim path.
// Validate it against your own container before trusting it in production.
// See docs/claiming-inbound-requests.md, section 5.

const claimRequest = require('claimRequest');
const getRequestPath = require('getRequestPath');
const runContainer = require('runContainer');

// The namespaces the Axeptio proxy tag knows how to forward. Keep this list in
// sync with the `routes` table in the tag template (template.tpl:128-135).
const NAMESPACES = [
  '/static-eu/',
  '/static/',
  '/client/',
  '/api/v1/',
  '/favicons/',
  '/fonts/'
];

// Normalise the base path exactly as the tag does (template.tpl:152-169):
// leading slash, no trailing slash, and a bare '/' means "root mount".
let basePath = data.proxyBasePath || '';
if (basePath) {
  if (basePath.indexOf('/') !== 0) {
    basePath = '/' + basePath;
  }
  while (basePath.length > 1 && basePath.charAt(basePath.length - 1) === '/') {
    basePath = basePath.substring(0, basePath.length - 1);
  }
  if (basePath === '/') {
    basePath = '';
  }
}

const path = getRequestPath() || '/';

// Boundary-safe matching, mirroring template.tpl:170-176. A base path of
// '/axeptio' must match '/axeptio' and '/axeptio/api/v1/...', but NEVER
// '/axeptiofoo'.
let mine = false;
if (basePath) {
  mine = (path === basePath) || (path.indexOf(basePath + '/') === 0);
} else {
  // Root mount: claiming every path would starve every other client in the
  // container (once a request is claimed, no further clients run), so match
  // only the namespaces the tag actually forwards.
  for (let i = 0; i < NAMESPACES.length; i++) {
    if (path.indexOf(NAMESPACES[i]) === 0) {
      mine = true;
      break;
    }
  }
  if (!mine && path === '/consents') {
    mine = true; // legacy alias, template.tpl:197-198
  }
}

if (mine) {
  claimRequest();

  // Dispatch one event the proxy tag's trigger can match on. The name is
  // arbitrary but must match the trigger you create (see below). Keep it
  // distinct from 'consents', which the unrelated Axeptio client template uses.
  runContainer({ event_name: 'axeptio_proxy', path: path }, () => {
    // Deliberately EMPTY.
    //
    // Do NOT call setPixelResponse() here: it would overwrite the upstream body
    // and content type the proxy tag staged, turning every proxied asset into a
    // 1x1 GIF. The tag stages the response and calls returnResponse() itself
    // (template.tpl:212-224); whether that tag-issued call is honoured is the
    // open question in section 5 of the doc, NOT something this snippet settles.
    // If the response never reaches the browser, calling returnResponse() from
    // this callback instead is the alternative to test.
  });
}
```

### `___SERVER_PERMISSIONS___`

Only two permissions are needed. `claimRequest` needs none — Google lists its associated
permissions as "None".

```json
[
  {
    "instance": {
      "key": { "publicId": "read_request", "versionId": "1" },
      "param": [
        { "key": "requestAccess", "value": { "type": 1, "string": "any" } },
        { "key": "headerAccess", "value": { "type": 1, "string": "any" } },
        { "key": "queryParameterAccess", "value": { "type": 1, "string": "any" } }
      ]
    },
    "clientAnnotations": { "isEditedByUser": true },
    "isRequired": true
  },
  {
    "instance": {
      "key": { "publicId": "run_container", "versionId": "1" },
      "param": []
    },
    "isRequired": true
  }
]
```

`read_request` is what `getRequestPath` requires; `run_container` is what `runContainer`
requires. Two permissions against the tag's five (`logging`, `send_http`, `read_request`,
`access_response`, `return_response`): this Client makes no outbound call and never
touches the response.

The three `read_request` sub-options are shown as `any` because that is the shape used by
the published templates in this repository and its sibling — Google's permission reference
describes `read_request` as covering "the request headers, query parameters, body, path,
or remote IP address" and allows narrowing it, but does not publish the exact values the
narrowed form takes in a `.tpl`, so no narrower literal is asserted here. The Client's
*code* reads only `getRequestPath()`. If your container policy requires tighter access,
narrow it in the GTM permission editor rather than by hand-editing this block.

### The custom trigger — the step most often missed

Claiming and dispatching is not enough. `runContainer` runs the container's variables,
triggers and tags in the scope of the event you passed it. If **no trigger matches that
event**, the container runs and no tag does anything. The request is still answered —
just not by the proxy. Create the trigger explicitly:

1. In the server container, go to **Triggers → New**.
2. Choose trigger type **Custom**.
3. Fire on **Some Events**, with the condition `Event Name` **equals** `axeptio_proxy` —
   the exact `event_name` your Client dispatches.
4. Attach that trigger to the Axeptio proxy tag, and to that tag only.

### Wiring checklist

1. The Client's **Proxy Base Path**, the tag's **Proxy Base Path** and the path part of
   the SDK's `proxyBaseUrl` are all identical. All three, or routing silently 404s.
2. The Client is registered under **Clients** (not merely created as a template), with a
   priority high enough that no other client claims the Axeptio paths first.
3. A **Custom** trigger on `axeptio_proxy` fires the proxy tag.
4. Nothing else in the container claims those paths or writes to the response for that
   event.

## 5. What is verified and what is not

This section is the reason this page ships as documentation rather than as a second
`.tpl` in this repository: **no test here exercises the claim path**, so shipping a
Client template would mean publishing untested code into a gallery listing.

**What the test suites actually cover.** All of them run the *real* sandboxed source
extracted from `template.tpl`, and all of them invoke the tag's code directly through a
shim:

- the `___TESTS___` scenarios inside `template.tpl`, executed by `test/run-tpl-tests.mjs`
  — the runner reproduces GTM's Test API (`runCode` / `mock` / `assertApi`) so the same
  scenarios run unchanged here and in the GTM UI. `runCode` starts at the tag;
- `integration/proxy-integration.mjs` — real sandboxed JS over real HTTP against local
  mock upstreams. It proves byte integrity, header traffic and status semantics. It still
  starts at the tag.

Neither harness contains the string `claimRequest`, and neither simulates a Client, so
**neither proves anything about whether a Client can be made to invoke this tag.**

**The one suite that would prove it has not run.** `e2e/proxy-e2e.mjs` hits a live tagging
server over HTTP, which is the only place the Client → trigger → tag chain exists. It
reads the `TAGGING_URL` environment variable, which `.github/workflows/e2e.yml` populates
from the repository secret `SGTM_TEST_TAGGING_URL`. **With no `TAGGING_URL` it skips every
case and exits 0** — so its result is only evidence when that secret is configured. As of
the commit that added this page it was not (`gh secret list` and `gh variable list` on
this repository both returned nothing), and the suite had never executed against a
container. Check the current state before treating a green e2e run as proof:

```bash
gh secret list   # is SGTM_TEST_TAGGING_URL configured?
gh run list --workflow e2e.yml   # and did the run actually exercise the routes?
```

A green `npm run e2e` with the secret unset is not evidence of anything.

**Consequences, stated plainly:**

- The reference Client in [section 4](#4-the-reference-client) is **derived from Google's
  published API reference, not from an observed deployment.** Its normalisation and
  boundary matching are transcribed from code that *is* tested (`template.tpl:152-176`);
  its claim and dispatch behaviour is not.
- **Open behaviour — who flushes the response.** Our tag calls `returnResponse()` itself
  (`template.tpl:224`, `:235`, `:244`), while Google's reference says of that API: "It is
  recommended that this API be used from a client template." Whether a tag-issued flush
  is honoured in a server container, or whether the Client must flush from its
  `runContainer` callback once the tag has staged the response, **is unproven here.** This
  document does not settle it. If your proxied responses arrive empty or never arrive,
  that is the first thing to test: move the flush into the Client's callback and compare.
- The `event_name` value `axeptio_proxy` is a suggestion, not a protocol. Nothing in
  `template.tpl` reads it; only your trigger does.

If you validate any of this against a real container, please
[open an issue](https://github.com/axeptio/axeptio-sgtm-public-template/issues). The first
observed deployment is what would turn this page into something we can ship as a template.

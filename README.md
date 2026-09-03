<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/logo-axeptio-white.svg">
    <img src="assets/logo-axeptio.svg" alt="Axeptio" width="180">
  </picture>
</p>

# Axeptio CMP (Server-Side) — Google Tag Manager Template

[![GTM Gallery](https://img.shields.io/badge/GTM_Gallery-Axeptio_CMP_Server--Side-4285F4?logo=googletagmanager&logoColor=white)](https://tagmanager.google.com/gallery/#/owners/axeptio/templates/axeptio-sgtm-public-template)
[![Release](https://img.shields.io/github/v/release/axeptio/axeptio-sgtm-public-template)](https://github.com/axeptio/axeptio-sgtm-public-template/releases)
[![License](https://img.shields.io/github/license/axeptio/axeptio-sgtm-public-template)](./LICENSE)
[![Validate gallery contract](https://github.com/axeptio/axeptio-sgtm-public-template/actions/workflows/validate-gallery.yml/badge.svg)](https://github.com/axeptio/axeptio-sgtm-public-template/actions/workflows/validate-gallery.yml)
[![Test template](https://github.com/axeptio/axeptio-sgtm-public-template/actions/workflows/test.yml/badge.svg)](https://github.com/axeptio/axeptio-sgtm-public-template/actions/workflows/test.yml)

The official [Axeptio](https://www.axept.io/) consent management tag for Google Tag Manager
**server** containers.

It reverse-proxies every Axeptio origin through your tagging server, so the CMP script, its
configuration and the visitor's consent calls all travel first-party: out of reach of
ad-blockers and ITP, on cookie lifetimes your own domain controls, over a data path you own.

The tag is a transparent proxy. It renders no consent UI and makes no consent decisions — that
is the Axeptio SDK's job, loaded on the page by the
[Axeptio CMP tag](https://github.com/axeptio/axeptio-gtm-public-template). This tag only carries
its traffic.

**[▶ Axeptio CMP (Server-Side) in the Community Template Gallery](https://tagmanager.google.com/gallery/#/owners/axeptio/templates/axeptio-sgtm-public-template)**

## Installing

In your GTM **server** container: **Templates → Tag Templates → Search Gallery**, look for
**Axeptio CMP (Server-Side)**, and add it to your workspace. Then create a tag from the template
and set the **Proxy Base Path** to match your SDK's `proxyBaseUrl`.

Trigger it on **all** incoming requests to your proxy domain. Every Axeptio namespace flows
through this one tag, so a trigger scoped to consent submissions alone will break the CMP.

A tag cannot claim an inbound request by itself — that is a **Client**'s job, and no built-in
Client claims these paths. Pair this template with
[axeptio-client-sgtm-public-template](https://github.com/axeptio/axeptio-client-sgtm-public-template),
which claims Axeptio requests and hands them to this tag. Client templates are not distributed
through the gallery, so import that one into your container manually
(**Templates → New → ⋮ → Import**).

Step-by-step setup lives in the Help Center:

👉 **[Axeptio Help Center](https://support.axeptio.eu/en/)**

## Configuration

| Field | Default | What it does |
| --- | --- | --- |
| **Axeptio Project ID** | — | Your Axeptio project identifier (`clientId`). Reference only — **not used at runtime**; the SDK already carries it. Kept for identification and future validation. |
| **Cookie Version** | — | The version of the cookies managed by Axeptio. Reference only — **not used at runtime** by this proxy tag. |
| **Proxy Base Path** | *(empty)* | The path part of the SDK's `proxyBaseUrl`, stripped before route matching. For `https://sgtm.example.com/axeptio`, set `/axeptio`. Leave empty when the container is mounted at the domain root. |
| **Enable debug logging** | off | Logs each matched route and upstream URL to the GTM Server console. Debug environments only. |

### Pairing with the SDK's `proxyBaseUrl`

The Axeptio JS SDK can route **all** of its network traffic through your own first-party domain
instead of Axeptio's. You enable it with a single setting on your site:

```js
window.axeptioSettings = {
  clientId: 'your-project-id',
  proxyBaseUrl: 'https://sgtm.example.com/axeptio'
};
```

The SDK then rewrites every request onto path namespaces under your proxy domain. **This
template is the reverse proxy** that receives them in your server container — hosted by
Addingwell, Stape, or any sGTM provider — and forwards each to the matching Axeptio origin.

Three things have to line up:

1. The **path** part of `proxyBaseUrl` matches the tag's **Proxy Base Path**
   (`https://sgtm.example.com/axeptio` → `/axeptio`; a root mount → leave it empty).
2. The proxy domain resolves to the server container running this tag.
3. The tag's trigger fires for **every** proxied path, not just consent.

### Route table

| Incoming path (under `proxyBaseUrl`) | Forwarded to |
| --- | --- |
| `/static/*` | `https://static.axept.io/*` |
| `/client/*` | `https://client.axept.io/*` |
| `/api/v1/*` | `https://api.axept.io/v1/*` |
| `/favicons/*` | `https://favicons.axept.io/*` |
| `/fonts/*` | `https://fonts.axept.io/*` |
| `/static-eu/*` | `https://static.axeptio.eu/*` |

The legacy `/consents` path is still accepted, and forwarded to
`https://api.axept.io/v1/app/consents` for backward compatibility. Anything unmatched returns a
`404`.

Forwarding is transparent: the HTTP method, the query string and the relevant request and
response headers are preserved, and the upstream status code is relayed as-is, so redirects,
`304`s and errors reach the caller instead of being swallowed.

**Caveat — binary assets.** `/fonts/*` and `/favicons/*` serve fonts and icons, and in proxy
mode the SDK has no fallback to Google Fonts. A misconfigured binary route fails silently, with
web fonts simply not rendering. Verify those two routes return byte-correct responses in your
environment.

<details>
<summary><strong>Verifying the proxy</strong></summary>

Use the **Preview** tool in your server container:

1. **Namespace routing** — send a request to each path (`/api/v1/...`, `/client/...`,
   `/static/...`, `/fonts/...`, `/favicons/...`, `/static-eu/...`) and confirm it reaches the
   matching upstream and returns the expected status.
2. **Method & query preservation** — confirm `GET` and `POST` and the original query string are
   forwarded unchanged (a consent submission to `/api/v1/app/consents` is a `POST`).
3. **Binary asset relay** — confirm `/fonts/*` and `/favicons/*` return byte-correct assets: web
   fonts render, the favicon loads.
4. **Base path** — with a Proxy Base Path set, confirm requests under it (`/axeptio/api/v1/...`)
   match, and that an unknown path returns a `404`.

</details>

## Related templates

| Template | Purpose |
| --- | --- |
| [axeptio-gtm-public-template](https://github.com/axeptio/axeptio-gtm-public-template) | The **Axeptio CMP tag** for web containers — loads the CMP and drives Google Consent Mode v2 |
| [axeptio-gtm-public-variable](https://github.com/axeptio/axeptio-gtm-public-variable) | GTM **variable** exposing Axeptio consent state to your other tags |
| [axeptio-client-sgtm-public-template](https://github.com/axeptio/axeptio-client-sgtm-public-template) | The server-side **Client** that claims Axeptio requests for this tag |

## Support

- **A bug in this template** — open an [issue](https://github.com/axeptio/axeptio-sgtm-public-template/issues).
- **Your Axeptio account, configuration or billing** — [support@axeptio.eu](mailto:support@axeptio.eu).

## Versioning

Releases follow [Semantic Versioning](https://semver.org/); see
[CHANGELOG.md](./CHANGELOG.md) and the
[releases](https://github.com/axeptio/axeptio-sgtm-public-template/releases).

**Cutting a release does not publish it.** The Community Template Gallery reads this
repository's default branch, `master`, so a release reaches GTM users only once `develop` is
promoted to `master` — a deliberate, manual step. After that the gallery refreshes on Google's
own schedule, so a new version usually appears there **two to three days** later.

See [docs/release-automation.md](./docs/release-automation.md) for the full flow.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the commit message conventions, how to run the
template's tests, the gallery contract this repository has to satisfy, and the licensing terms
contributions are accepted under.

`CHANGELOG.md`, `.release-please-manifest.json` and the `versions:` history in `metadata.yaml`
are all generated — see [docs/release-automation.md](./docs/release-automation.md).

## License

Licensed under the [Apache License 2.0](./LICENSE).

The [Community Template Gallery](https://developers.google.com/tag-platform/tag-manager/templates/gallery)
requires the `LICENSE` file to contain **only** Apache 2.0 — a template whose licence
does not match is removed from the gallery automatically. Do not replace it.

Versions `1.2.0` and `1.3.0` were published under Axeptio's licensing terms and those
releases remain governed by them. Every other version, before and after, is Apache 2.0.

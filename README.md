<h1>
  <img src="https://axeptio.imgix.net/2024/07/e444a7b2-ea3d-4471-a91c-6be23e0c3cbb.png" alt="Descrizione immagine" width="80" style="vertical-align: middle; margin-right: 10px;" />
  Axeptio sGTM Public Template
</h1>
<br>

This repository provides a **Google Tag Manager (GTM) Server-Side** template that acts as a **first-party reverse proxy** for **Axeptio**. When the Axeptio JS SDK is configured with `proxyBaseUrl`, it routes all of its traffic through your own domain; this tag receives those requests in your sGTM container and forwards each one to the correct Axeptio origin. Serving Axeptio first-party this way keeps consent/tracking traffic out of reach of ad-blockers and ITP, extends cookie lifetimes, and gives you full control over the data flow — all while staying compliant with GDPR and the ePrivacy Directive.

> **Scope:** this template is a transparent proxy. It does not itself render consent UI or make consent decisions — that is the Axeptio SDK's job. See [First-party proxy with Addingwell / Stape](#first-party-proxy-with-addingwell--stape-proxybaseurl) for the full request flow.

<br>

## 📑 Table of Contents

1. [About Axeptio](#about-axeptio)
2. [Key Features of Axeptio](#key-features-of-axeptio)
3. [Benefits of Using sGTM with Axeptio](#benefits-of-using-sgtm-with-axeptio)
4. [How to Import and Use the Template in GTM Server-Side](#how-to-import-and-use-the-template-in-gtm-server-side)
   - [Step 1: Import the Template into GTM Server-Side](#step-1-import-the-template-into-gtm-server-side)
   - [Step 2: Configure the Tag](#step-2-configure-the-tag)
   - [Step 3: Test the Configuration](#step-3-test-the-configuration)
5. [Troubleshooting and Support](#troubleshooting-and-support)
6. [Versioning and Releases](#versioning-and-releases)


<br><br>

## 🍪About Axeptio
[Axeptio](https://www.axept.io/) is a highly configurable **Consent Management Platform (CMP)** that enables websites to collect, manage, and store user consent data in a **transparent** and **privacy-first** manner. It is designed to facilitate compliance with global data privacy laws such as **GDPR** and the **ePrivacy Directive**. Axeptio allows users to customize consent forms and manage user preferences with ease while offering a seamless experience across web environments.
<br><br>
## Key Features of this template
- **Full first-party proxy**: forwards all six Axeptio `proxyBaseUrl` namespaces (`/static`, `/client`, `/api/v1`, `/favicons`, `/fonts`, `/static-eu`) to their upstream Axeptio hosts.
- **Transparent forwarding**: preserves the HTTP method, query string, and relevant request/response headers, and relays the upstream status code as-is.
- **Configurable mount path**: works whether your `proxyBaseUrl` is at the domain root or under a sub-path.
- **Least privilege**: only requests the GTM permissions it actually uses, with outbound calls scoped to Axeptio domains.

<br><br> 

## Benefits of Using sGTM with Axeptio
By proxying Axeptio through **GTM Server-Side** (sGTM) on your own domain, you gain:

- **Ad-blocker / ITP resilience**: Because Axeptio is served first-party, consent and tracking requests are not blocked by browser privacy protections or ad-blockers.
- **Prolonged Cookie Lifespan**: First-party cookies set through your domain are not subject to the short lifetimes browsers impose on third-party cookies.
- **Enhanced Data Security & Control**: All Axeptio traffic flows through infrastructure you control, so you own the data path between your site and Axeptio.
- **Improved Performance**: Requests resolve on your own domain/edge instead of multiple third-party origins.
<br><br>

## 🛠How to Import and Use the Template in GTM Server-Side
Follow these steps to integrate the **Axeptio sGTM** template with your **GTM Server-Side** container:
### Step 1: Import the Template into GTM Server-Side
1. Clone or download this repository to your local machine.
2. Open your **GTM Server-Side** container in **Google Tag Manager**.
3. Navigate to the **Templates** section.
4. Click on **Import** and upload the **JSON** file for the **Axeptio sGTM tag template**.
### Step 2: Configure the Tag
1. After the template has been imported, go to the **Tags** section in your GTM Server-Side container.
2. Click on **New Tag**, and then select the Axeptio sGTM template you just imported.
3. Configure the tag settings:
   - **Axeptio Project ID**: Optional. Your unique **Axeptio Project ID** (your `clientId`). Reference only — it is **not used at runtime** by this proxy tag (the SDK already carries `clientId`); it is kept for identification and possible future validation.
   - **Cookie Version**: Optional. The version of the cookies managed by Axeptio. Reference only — **not used at runtime** by this proxy tag.
   - **Proxy Base Path**: The path portion of the SDK `proxyBaseUrl` served by this container. For a `proxyBaseUrl` of `https://sgtm.example.com/axeptio`, set this to `/axeptio`. Leave it empty if the container is mounted at the domain root.
   - **Enable debug logging**: Optional. Logs each matched route and upstream URL to the GTM Server console (use in debug environments only).
4. Define the **Triggers** that will fire the Axeptio tag. Because the tag proxies every Axeptio request, fire it on all incoming requests to your proxy domain (e.g. a Client/trigger that claims requests whose path starts with your **Proxy Base Path**), not only on consent acceptance.

### Step 3: Test the Configuration
Use the **Preview** tool in GTM Server-Side to verify the tag proxies traffic correctly:
1. **Namespace routing** — send a request to each path (`/api/v1/...`, `/client/...`, `/static/...`, `/fonts/...`, `/favicons/...`, `/static-eu/...`) and confirm it reaches the matching Axeptio upstream and returns the expected status.
2. **Method & query preservation** — confirm `GET` vs `POST` and the original query string are forwarded unchanged (e.g. a consent submission to `/api/v1/app/consents` is a `POST`).
3. **Binary asset relay** — confirm `/fonts/*` and `/favicons/*` return byte-correct assets (web fonts render, favicon loads), not corrupted bodies.
4. **Base path** — if you set a **Proxy Base Path**, confirm requests under it (e.g. `/axeptio/api/v1/...`) match, and that an unknown path returns a `404`.
<br><br>
## First-party proxy with Addingwell / Stape (`proxyBaseUrl`)

The Axeptio JS SDK can route **all** of its network traffic through your own first-party domain instead of Axeptio's domains. This avoids ad-blocker / ITP restrictions, keeps consent traffic in a first-party context, and gives you full control over the data flow.

You enable it with a single SDK setting on your site:

```js
window.axeptioSettings = {
  clientId: 'your-project-id',
  proxyBaseUrl: 'https://sgtm.example.com/axeptio'
};
```

When `proxyBaseUrl` is set, the SDK rewrites every request from Axeptio's origins onto path namespaces under your proxy domain. **This template is the reverse proxy** that receives those paths in your GTM Server-Side container (hosted by Addingwell, Stape, or any sGTM provider) and forwards each one to the correct Axeptio origin:

| Incoming path (under `proxyBaseUrl`) | Forwarded to |
| --- | --- |
| `/static/*` | `https://static.axept.io/*` |
| `/client/*` | `https://client.axept.io/*` |
| `/api/v1/*` | `https://api.axept.io/v1/*` |
| `/favicons/*` | `https://favicons.axept.io/*` |
| `/fonts/*` | `https://fonts.axept.io/*` |
| `/static-eu/*` | `https://static.axeptio.eu/*` |

The legacy `/consents` path is still accepted and forwarded to `https://api.axept.io/v1/app/consents` for backward compatibility.

**Setup checklist**

1. The **path** part of `proxyBaseUrl` must match the tag's **Proxy Base Path** field (e.g. `proxyBaseUrl: 'https://sgtm.example.com/axeptio'` → Proxy Base Path `/axeptio`; root mount → leave empty).
2. The proxy domain (`sgtm.example.com`) must route to the GTM Server-Side container running this tag.
3. The tag's trigger must fire for **all** proxied paths, not just consent — every namespace above flows through it.

**Caveat — static assets / fonts:** the `/fonts/*` and `/favicons/*` namespaces serve binary assets. As noted in the SDK's proxy documentation, there is no fallback to Google Fonts in proxy mode — if a binary route is misconfigured, web fonts may fail silently. Verify these routes return byte-correct responses in your environment.

## Troubleshooting and Support🧑‍💻
If you encounter any issues during the installation or configuration of the **Axeptio sGTM tag**, please consult the following resources:

- [Official Axeptio Documentation](https://www.axept.io/)
- [Google Tag Manager Server-Side Documentation](https://developers.google.com/tag-platform/tag-manager/server-side)

<br>

Axeptio helps you provide a better user experience while ensuring compliance with data protection laws. If you have any questions or suggestions for improving this template, feel free to open an issue or submit a pull request.

<br><br>

## Versioning and Releases

This repository follows [Semantic Versioning](https://semver.org/) and uses
[Conventional Commits](https://www.conventionalcommits.org/). Releases are
automated with [release-please](https://github.com/googleapis/release-please):
when conventional commits land on `master`, a release pull request is kept up to
date and, once merged, the version is bumped, the [CHANGELOG](./CHANGELOG.md) is
updated, a git tag and a [GitHub Release](../../releases) are published, and the
GTM `versions:` history in `metadata.yaml` is appended automatically.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the commit message conventions.

# Project Instructions for AI Agents

## What this repo is

Not an application. It is the public source for the **Axeptio server-side (sGTM) tag**, shaped as a
submission to the [GTM Community Template Gallery](https://tagmanager.google.com/gallery). Two files
are the product:

- **`template.tpl`** — the GTM custom template, in Google's own block format (`___INFO___`,
  `___TEMPLATE_PARAMETERS___`, `___SANDBOXED_JS_FOR_SERVER___`, `___SERVER_PERMISSIONS___`,
  `___TESTS___`, `___NOTES___`).
  It declares `"containerContexts": ["SERVER"]`: this tag runs in a tagging server, not a browser.
  The tag reverse-proxies the Axeptio origins so the CMP is served first-party.
- **`metadata.yaml`** — the gallery's published version history (`versions:`, one commit SHA plus
  `changeNotes` per version, newest first). This is what the gallery actually serves.

Everything else is licensing, tests, or release automation.

## Build & test

There is no build and no compile.

```bash
npm ci && npm test                     # ___TESTS___ scenarios + the .test.mjs files
npm run integration                    # real sandboxed JS over real HTTP against a local mock
npm run e2e                            # live container; NO-OP unless SGTM_TEST_TAGGING_URL is set
python3 scripts/validate-gallery.py    # gallery contract — see below (Python 3.7+, PyYAML)
```

`npm test` is a bare `node --test`, so **everything under `test/` is auto-discovered**. That is why
the shared `.tpl` parser lives in `lib/template.mjs` at the repo root rather than under `test/`.
`test/run-tpl-tests.mjs` shims GTM's Test API and runs the `___TESTS___` scenarios against the real
sandboxed source, so the same scenarios run unchanged in the GTM UI **Tests** tab. Add coverage by
adding a scenario to that block, not by writing a separate test file.

**A green `npm run e2e` proves nothing on its own.** `e2e/proxy-e2e.mjs` skips every case and exits 0
when `SGTM_TEST_TAGGING_URL` is unset, which it is — the repo has no secrets or variables configured.

## The gallery contract — load-bearing

`scripts/validate-gallery.py` enforces it, and CI runs it on every PR and on pushes to `develop`
and `master`. Run it locally before touching `LICENSE`, `metadata.yaml` or `template.tpl`.

- **Never replace `LICENSE`.** The gallery requires it to contain **only** Apache 2.0 and delists
  any template whose licence differs, with no notification and no status page. This is not
  hypothetical: ENG-13012 swapped in Axeptio's proprietary notice, and the sibling web template
  `axeptio-gtm-public-template` was delisted within ~24h (SUP-1008). Gallery distribution and
  proprietary licensing are mutually exclusive. If the licence must change, the template leaves the
  gallery — a business decision, not a code change.
- **Never hand-edit the `versions:` list**, `CHANGELOG.md` or `.release-please-manifest.json`. All
  are generated; `scripts/update-metadata-version.mjs` prepends the released SHA after each release
  and maintains the `# Latest version` / `# Older versions` markers.
- `___INFO___` should keep 1-3 `categories`, and its `displayName` must stay distinct from the web
  template's ("Axeptio CMP"), which is a separate gallery listing under the same brand.

## Two branches: `develop` integrates, `master` publishes

**Branch from `develop` and target `develop`.** Releases are cut there. `master` is the *published*
branch — the gallery reads from the repository's **default** branch, which is and must stay
`master` — and it is reached only by promoting `develop` (`Promote develop to master`,
`workflow_dispatch`). CI fails a PR into `master` from anything but `develop` or `hotfix/*`.

- **Never merge `master` back into `develop`.** It makes release-please prune commits from the
  changelog — which is published as the template's gallery release notes — and it fails every
  future promotion PR. Cherry-pick a hotfix onto `develop` through a normal PR instead.
- `release-please.yml` pins `target-branch: develop`. The default is the repository's *default*
  branch, so leaving it out silently targets `master`.
- Two things the release run does that look redundant and are not: it **re-signs** the release PR
  commit (release-please writes it through the API unsigned, and the Compliance ruleset has no
  bypass — that blocked v2.0.0), and it opens the metadata sync as a **PR** rather than pushing
  (a direct push carries no check run and is rejected with `GH013` — that is how v2.0.0's gallery
  entry went missing).

Full flow: [docs/release-automation.md](docs/release-automation.md).

## Conventions

- **Conventional Commits are mandatory** — `Lint commits` checks every commit and the PR title.
  Types and scopes live in `commitlint.config.mjs`. The PR title is a release artifact, not
  hygiene: `merge_commit_message: PR_TITLE` means release-please parses it too.
- PRs land as **merge commits** (squash is disabled), so every commit in the branch reaches
  `develop` and is parsed. Tidy the history before merging.
- Work on a branch, open a PR, never commit to a protected branch directly.

# How to Contribute

We'd love to accept your patches and contributions to this project. There are
just a few small guidelines you need to follow.

## Contributions and licensing

This template is distributed under the [Apache License 2.0](./LICENSE). By
submitting a contribution you agree that it is provided under, and may be
redistributed as part of this project under, that licence.

The [Community Template Gallery](https://developers.google.com/tag-platform/tag-manager/templates/gallery)
requires the `LICENSE` file to contain **only** Apache 2.0. A template whose
licence does not match is removed from the gallery automatically, so the licence
cannot be changed while the template is distributed there.

## Code reviews

All submissions, including submissions by project members, require review. We
use GitHub pull requests for this purpose. Consult
[GitHub Help](https://help.github.com/articles/about-pull-requests/) for more
information on using pull requests.

## Testing the template

The tag's routing logic is covered by unit tests written as GTM
[custom-template test scenarios](https://developers.google.com/tag-platform/tag-manager/templates/tests)
in the `___TESTS___` section of `template.tpl`. They are the single source of
truth — runnable both in the GTM UI **Tests** tab and headlessly:

```
npm ci      # one-time, installs the js-yaml dev dependency
npm test    # runs every ___TESTS___ scenario against the real template source
```

`test/run-tpl-tests.mjs` shims GTM's Test API (`runCode` / `mock` / `assertApi` /
`assertThat`) and executes the actual `___SANDBOXED_JS_FOR_SERVER___` code under
Node's built-in test runner, so a change that breaks routing fails the suite. Add
or update a scenario in `___TESTS___` whenever you change the tag's behaviour.

Beyond the mocked scenarios, a hermetic integration suite runs the same real
sandboxed source over real HTTP against a local mock of the Axeptio upstreams
(binds `127.0.0.1` only — no network egress):

```
npm run integration   # byte-identical binary relay, header allowlist/strip,
                      # status/error relay, base-path stripping over the wire
```

See `integration/lib/gtm-runtime.mjs` for its fidelity contract: it complements
the live e2e suite (`npm run e2e`), which remains the only proof of end-to-end
binary integrity on a real tagging server.

A CI check (`Test template`) runs `npm test` and `npm run integration` on every
pull request and **must pass before merging** (add it to the branch's required
status checks).

## Commit & pull request conventions

This project uses [Conventional Commits](https://www.conventionalcommits.org/)
to drive automated [Semantic Versioning](https://semver.org/) and changelog
generation via [release-please](https://github.com/googleapis/release-please).

A commit / PR title must follow:

```
<type>(<optional scope>): <description>
```

**Allowed types**

| Type       | Effect on version | Use for                                    |
| ---------- | ----------------- | ------------------------------------------ |
| `feat`     | minor bump        | a new feature                              |
| `fix`      | patch bump        | a bug fix                                  |
| `docs`     | none              | documentation only                         |
| `refactor` | none              | code change that isn't a fix or feature    |
| `perf`     | none              | performance improvement                    |
| `test`     | none              | tests                                      |
| `ci`       | none              | CI / GitHub Actions changes                |
| `build`    | none              | build system or dependencies               |
| `chore`    | none              | maintenance / tooling                      |
| `revert`   | none              | reverting a previous commit                |

A breaking change is signalled by a `!` after the type (e.g. `feat!: ...`) or a
`BREAKING CHANGE:` footer, and triggers a major bump.

**Suggested scopes:** `template`, `metadata`, `docs`, `ci`, `deps`.

Examples:

```
feat(template): add support for the new consent purpose
fix(template): correct the cookie expiry check
docs: clarify the import steps
```

**Important notes**

- Pull requests are merged with a **merge commit** (squash and rebase merges are
  disabled on this repository), so **every commit in the branch lands on
  `develop`** and is parsed by release-please. The **PR title** must also be a
  valid Conventional Commit, because release-please parses it too. A CI check
  (`Lint commits`) enforces both: the title, and every commit in the branch.
  Tidy the branch history before merging.
- Releases, the `CHANGELOG.md`, git tags, GitHub Releases, and the `versions:`
  history in `metadata.yaml` are **all generated automatically**. Do not edit
  versions or the changelog by hand.

## The gallery contract

This repository is not just source: it is a submission to the
[Community Template Gallery](https://developers.google.com/tag-platform/tag-manager/templates/gallery),
which imposes requirements on the repository itself — not just on the template code. Break one and
Google **silently delists the template** a couple of days later, with no notification on the pull
request and no submission-status page to check.

A CI check, `Validate gallery contract`, runs on every pull request and on pushes to `develop` and
`master`. Run it yourself before touching `LICENSE`, `metadata.yaml` or `template.tpl`:

```bash
pip install pyyaml          # one-time; the script needs Python 3.7+
python3 scripts/validate-gallery.py
```

It reports every violation at once. The rules most easily broken by accident:

- **`LICENSE` must contain *only* Apache 2.0.** Not "Apache 2.0 plus a notice" — only. Replacing it
  removes the template from the gallery; that is what SUP-1008 was on the web template.
- **`___INFO___` should declare `categories`** — 1 to 3 values from Google's list, most relevant
  first.
- **`versions:` entries must be real commits on the branch, newest first.** Never edit that list by
  hand; it is generated on release by `scripts/update-metadata-version.mjs`.

## Which branch to target

**Branch from `develop` and open your pull request against `develop`.** That is where work is
integrated and where releases are cut.

`master` is the *published* branch: the GTM Community Template Gallery reads `template.tpl`,
`metadata.yaml` and `LICENSE` from it, so a push to `master` puts your change in front of every
container that installed the tag. It is reached only by promoting `develop`, and CI fails a pull
request opened against `master` from anything but `develop` or a `hotfix/*` branch. If you opened
one by habit, re-target it — no need to start over:

```
gh pr edit <number> --base develop
```

One rule with no automated guard on the branch itself: **never merge `master` back into `develop`.**
It makes release-please prune commits from the changelog — which is published as the template's
gallery release notes — and it fails every future promotion PR.

See [docs/release-automation.md](docs/release-automation.md) for the full flow.

## Community Guidelines

Please be respectful and constructive in issues and pull requests. For questions
about the template or Axeptio, see the [Axeptio documentation](https://www.axept.io/).

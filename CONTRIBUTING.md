# How to Contribute

We'd love to accept your patches and contributions to this project. There are
just a few small guidelines you need to follow.

## Contributor License Agreement

Contributions to this project must be accompanied by a Contributor License
Agreement. You (or your employer) retain the copyright to your contribution;
this simply gives us permission to use and redistribute your contributions as
part of the project. Head over to <https://cla.developers.google.com/> to see
your current agreements on file or to sign a new one.

You generally only need to submit a CLA once, so if you've already submitted one
(even if it was for a different project), you probably don't need to do it
again.

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

A CI check (`Test template`) runs `npm test` on every pull request and **must
pass before merging** (add it to the branch's required status checks).

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

- Because pull requests are **squash-merged**, the **PR title** becomes the
  commit message on `master` — so the PR title itself must be a valid
  Conventional Commit. A CI check (`Lint commits`) enforces this.
- Releases, the `CHANGELOG.md`, git tags, GitHub Releases, and the `versions:`
  history in `metadata.yaml` are **all generated automatically**. Do not edit
  versions or the changelog by hand.

## Community Guidelines

This project follows
[Google's Open Source Community Guidelines](https://opensource.google.com/conduct/).

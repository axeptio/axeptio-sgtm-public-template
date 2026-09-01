# Release Automation

Releases are driven by [Conventional Commits](https://www.conventionalcommits.org/) and
[release-please](https://github.com/googleapis/release-please). Every merge to `develop` maintains a
release PR; merging that PR cuts the release. **Cutting a release does not publish it** — that
happens when `develop` is promoted to `master`.

## Branch flow

```
feature branch ──PR──> develop ──> release PR ──> tag + GitHub Release ──> metadata.yaml synced
                          │                                                    (on develop)
                          │
                          └──promotion PR──> master ──> GTM Community Template Gallery
                                             (default)
```

- **`develop` is the integration and release branch.** Feature PRs target it, release-please targets
  it, and `CHANGELOG.md`, `.release-please-manifest.json` and `metadata.yaml` are all written there.
- **`master` is the published branch, and stays the *default* branch.** The gallery reads
  `metadata.yaml`, `template.tpl` and `LICENSE` from the repository's default branch, so making
  `develop` the default would publish every release the moment it was cut and promotion would mean
  nothing. It is also why `release-please.yml` pins `target-branch: develop` instead of relying on
  the default — the fallback is the *default* branch, which would silently mis-target the release PR
  at the branch this flow releases *to*.
- Only `develop` (a promotion) and `hotfix/*` may open a PR against `master`. The
  `Only develop and hotfixes may target master` step in `Lint commits` enforces it.

Pull requests are merged with a **merge commit** (squash and rebase merges are disabled on this
repository), so every commit in the branch lands on `develop` — and every one of them is parsed by
release-please to work out the next version. Merge commits themselves are ignored. Tidy the branch
history before merging; `Lint commits` rejects a non-conventional commit anywhere in it.

### `master` is never merged back into `develop`

This is the one rule that is easy to break and expensive to undo.

`Lint commits` fails any PR whose branch contains a merge whose *merged-in* parent is already on the
base branch (`Reject merges of the base branch into the PR branch`). A promotion PR passes that
guard because it carries only feature merges, whose merged-in parents are feature branches. **One
`master → develop` merge commit would put a `master` commit on the merged-in side of `develop`'s
history and fail every promotion PR from then on.**

Nothing needs a back-merge anyway: every generated file is produced on `develop` and travels
downstream with the promotion, so `develop` is never behind. If a `hotfix/*` branch has to land on
`master` directly, cherry-pick the same change onto `develop` through a normal PR — do not merge.

## Promoting a release

Publishing is manual and deliberate.

1. Run the **Promote develop to master** workflow (`.github/workflows/promote.yml`,
   `workflow_dispatch`). It opens — or refreshes — the `develop → master` PR titled
   `chore(release): promote develop to master`, with a body listing the tags about to go live.
   Equivalent by hand:
   `gh pr create --base master --head develop --title 'chore(release): promote develop to master'`
2. Review it. `Validate gallery contract`, `Validate commit messages`, `Validate PR title` and
   `Test template` all run; the gallery contract check is the one that matters, because it is the
   last gate before the template reaches real GTM containers.
3. Merge it with a merge commit. That push to `master` is the publication: Google polls the
   repository and the new version appears in the gallery within 2 to 3 days.

## Workflows

- **`commitlint.yml`** (`Lint commits`) — two jobs on every PR:

  | Job | What it checks |
  | --- | --- |
  | `Validate commit messages` | every commit in the PR against `commitlint.config.mjs` — these are the ones release-please reads. Also rejects a branch that merges its base branch into itself, and a PR into `master` that is not a promotion or a `hotfix/*` |
  | `Validate PR title` | the PR title is a valid Conventional Commit — and a release trigger in its own right |

  The PR title is a release artifact, not hygiene: the repository is set to
  `merge_commit_message: PR_TITLE`, so GitHub writes the title into the body of the merge commit and
  release-please parses it like any other commit. A PR into `develop` titled `fix:` cuts a release
  even when none of its commits do.

  **The release PR is exempt from the merge check.** release-please keeps its PR current by merging
  `develop` into its own branch every time `develop` moves, so without an exemption the guard would
  block every release. That is safe for the reason the guard exists: the branch holds only generated
  files, carries no contributor commits that could be pruned, and its changelog is computed before
  the merge. The exemption is scoped to `axeptio-bot` **and** a `release-please--` branch name, so it
  cannot be claimed by naming a branch to match.

- **`release-please.yml`** (`Release`) — fires on push to `develop`, with `target-branch: develop`
  pinned. release-please works out the next version and opens (or updates) a release PR that updates
  `CHANGELOG.md` and bumps `.release-please-manifest.json`. Merging that PR tags the commit and
  publishes a GitHub Release.

  Two things happen alongside it:

  - **The release PR gets re-signed.** release-please authenticates with a PAT and writes its commit
    through the GitHub API, which does not sign. The `Compliance` ruleset requires verified
    signatures and has no bypass actor, so an unsigned commit makes the release PR unmergeable by
    anyone, admin included — that blocked v2.0.0. `Detect an unsigned release PR` and
    `Sign the release PR commit` rebuild the branch as one commit signed with the bot's GPG key.
  - **The metadata sync goes through a PR**, not a push. A direct push carries no check run, so a
    branch with a required status check rejects it:
    `GH013 - Required status check "Run template tests" is expected`. That is exactly what happened
    on v2.0.0: the release shipped and its `metadata.yaml` entry did not, leaving the gallery version
    history a release behind with no signal. The sync PR also means the generated entry is validated
    by `Validate gallery contract` before it lands.

- **`promote.yml`** (`Promote develop to master`) — `workflow_dispatch` only. Opens the
  `develop → master` PR that publishes. It never merges.

- **`validate-gallery.yml`** (`Validate gallery contract`) and **`test.yml`** (`Test template`) run
  on both branches. A required status check that never runs blocks the merge rather than passing it,
  so both must fire on `develop` as well as `master`.

- **`e2e.yml`** (`E2E (live test container)`) — `workflow_dispatch` and a weekly schedule. Scheduled
  runs use the default branch, `master`, which is what is actually live. It is a no-op unless
  `SGTM_TEST_TAGGING_URL` is set, so a green run is not evidence the proxy works.

## GTM Gallery version history

The gallery publishes template versions from the `versions:` list in `metadata.yaml` — one entry per
published version, each a commit SHA plus change notes, newest first.

`scripts/update-metadata-version.mjs` keeps that list in sync. It takes `RELEASE_TAG` and
`RELEASE_SHA` from the release-please outputs, derives `changeNotes` from the top section of
`CHANGELOG.md`, and prepends the entry directly under the `versions:` key. It uses only Node
built-ins and edits the file textually, so the licence header and existing entries are preserved
byte for byte.

The notes are filtered before they are published: internal scopes (`ci`, `build`, `chore`, `docs`,
`test`) are dropped, merge commits that restate their own branch are dropped, and markdown is
flattened, because the gallery renders the notes as plain text. `test/update-metadata-version.test.mjs`
covers each filter.

**Never hand-edit the `versions:` list, `CHANGELOG.md` or `.release-please-manifest.json.`** All
three are generated.

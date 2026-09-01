// Proves the gallery filter in scripts/update-metadata-version.mjs, which turns
// the newest CHANGELOG.md section into the "What's new" text the GTM Community
// Template Gallery publishes.
//
// The published notes are only ever seen after a release, in a listing nobody on
// the team reads, so a regression here is silent: v1.3.0 shipped three `**ci:**`
// lines about the staging push script, one of them twice because release-please
// credited the merge commit with a restatement of its own branch. Every filter
// gets a bullet that must not survive it, and the whole render is asserted line
// for line so a new leak fails the run.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildChangeNotes } from '../scripts/update-metadata-version.mjs';

const REPO = 'https://github.com/axeptio/axeptio-sgtm-public-template';
// release-please's trailing commit reference, "([abc1234](url))".
const ref = (sha) => `([${sha}](${REPO}/commit/${sha}00000000000000000000000000000))`;

// One synthetic release section holding one bullet per filter, plus an older
// section that must not contribute (only the newest release is published).
const CHANGELOG = [
  '# Changelog',
  '',
  `## [1.4.0](${REPO}/compare/v1.3.0...v1.4.0) (2026-09-01)`,
  '',
  '',
  '### ⚠ BREAKING CHANGES',
  '',
  `* **template:** the Proxy Base URL field is now required ${ref('aaaaaaa')}`,
  '',
  '### Features',
  '',
  `* **template:** relay binary responses byte-identically ${ref('bbbbbbb')}`,
  `* **template:** relay binary responses byte-identically ${ref('ccccccc')}`,
  `* **proxy:** forward the visitor IP on X-Forwarded-For ${ref('ddddddd')}`,
  '',
  '### Bug Fixes',
  '',
  `* **ci:** add Tag Manager API staging push script ${ref('eeeeeee')}`,
  `* **template:** source request path/query/body from request APIs ${ref('fffffff')}`,
  '',
  '### Documentation',
  '',
  `* expand the README and correct the gallery description ${ref('1111111')}`,
  '',
  `## [1.3.0](${REPO}/compare/v1.2.1...v1.3.0) (2026-07-22)`,
  '',
  '### Features',
  '',
  `* **template:** an older release nobody should see again ${ref('2222222')}`,
  '',
].join('\n');

// fffffff stands in for the merge commit release-please credits with the PR
// title (v1.3.0's duplicated staging-push line was PR #26's merge).
const MERGES = new Set(['fffffff']);
const isMergeCommit = (sha) => MERGES.has(sha);

const notes = buildChangeNotes(CHANGELOG, { tag: 'v1.4.0', isMergeCommit });
const lines = notes.split('\n');

test('publishes exactly the gallery-worthy bullets, in order', () => {
  assert.deepEqual(lines, [
    '- the Proxy Base URL field is now required',
    '- relay binary responses byte-identically',
    '- proxy: forward the visitor IP on X-Forwarded-For',
  ]);
});

test('keeps a breaking change', () => {
  assert.ok(lines.includes('- the Proxy Base URL field is now required'), notes);
});

test('drops a ci-scoped bullet even though it sits under Bug Fixes', () => {
  assert.ok(!/staging push script/.test(notes), notes);
});

test('drops the merge commit that restates the branch commits', () => {
  assert.ok(!/request APIs/.test(notes), notes);
});

test('keeps a repeated subject once', () => {
  const repeats = lines.filter((l) => l === '- relay binary responses byte-identically');
  assert.equal(repeats.length, 1, notes);
});

test('strips the implied template scope and its markdown', () => {
  assert.ok(!notes.includes('**'), notes);
  assert.ok(!notes.includes('template:'), notes);
});

test('keeps another scope as plain "scope: subject"', () => {
  assert.ok(lines.includes('- proxy: forward the visitor IP on X-Forwarded-For'), notes);
});

test('drops the Documentation section', () => {
  assert.ok(!/README/.test(notes), notes);
});

test('reads only the newest release section', () => {
  assert.ok(!/older release/.test(notes), notes);
});

test('strips inline links from a subject', () => {
  const changelog = [
    '## [2.0.0](compare) (2026-09-01)',
    '',
    '### Features',
    '',
    `* **template:** follow [the gallery contract](${REPO}/blob/master/metadata.yaml) ${ref('3333333')}`,
  ].join('\n');
  assert.equal(
    buildChangeNotes(changelog, { tag: 'v2.0.0' }),
    '- follow the gallery contract',
  );
});

test('strips inline bold from a subject', () => {
  const changelog = [
    '## [2.0.0](compare) (2026-09-01)',
    '',
    '### Features',
    '',
    `* **template:** make **X** required ${ref('5555555')}`,
  ].join('\n');
  assert.equal(buildChangeNotes(changelog, { tag: 'v2.0.0' }), '- make X required');
});

test('keeps an unscoped bullet', () => {
  const changelog = [
    '## [2.0.0](compare) (2026-09-01)',
    '',
    '### Features',
    '',
    `* add the request timeout field ${ref('6666666')}`,
  ].join('\n');
  assert.equal(buildChangeNotes(changelog, { tag: 'v2.0.0' }), '- add the request timeout field');
});

test('accepts the "-" bullet form', () => {
  const changelog = [
    '## [2.0.0](compare) (2026-09-01)',
    '',
    '### Features',
    '',
    `- **template:** add the request timeout field ${ref('6666666')}`,
    '- rename the Proxy Base URL label',
  ].join('\n');
  assert.equal(
    buildChangeNotes(changelog, { tag: 'v2.0.0' }),
    '- add the request timeout field\n- rename the Proxy Base URL label',
  );
});

test('falls back to a bare "Release" when no tag is passed', () => {
  assert.equal(buildChangeNotes('', {}), 'Release');
  assert.equal(buildChangeNotes(''), 'Release');
});

test('keeps every bullet when no isMergeCommit is injected', () => {
  const changelog = [
    '## [2.0.0](compare) (2026-09-01)',
    '',
    '### Bug Fixes',
    '',
    `* **template:** source request path/query/body from request APIs ${ref('fffffff')}`,
  ].join('\n');
  assert.equal(
    buildChangeNotes(changelog, { tag: 'v2.0.0' }),
    '- source request path/query/body from request APIs',
  );
});

test('falls back to "Release <tag>" when every bullet is filtered out', () => {
  const changelog = [
    '## [2.0.0](compare) (2026-09-01)',
    '',
    '### Documentation',
    '',
    `* expand the README ${ref('1111111')}`,
    '',
    '### Bug Fixes',
    '',
    `* **ci:** pin the runner image ${ref('4444444')}`,
  ].join('\n');
  assert.equal(buildChangeNotes(changelog, { tag: 'v2.0.0' }), 'Release v2.0.0');
});

test('falls back to "Release <tag>" when the changelog has no release section', () => {
  assert.equal(buildChangeNotes('', { tag: 'v2.0.0' }), 'Release v2.0.0');
  assert.equal(buildChangeNotes('# Changelog\n', { tag: 'v2.0.0' }), 'Release v2.0.0');
});

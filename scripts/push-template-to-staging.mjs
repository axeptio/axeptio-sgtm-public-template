#!/usr/bin/env node
// Publishes the local template.tpl into a staging GTM Server container via the
// Tag Manager API v2, so the live e2e suite always validates the current
// template instead of a manually-imported (possibly stale) copy.
//
// Flow (default mode):
//   1. GET  versions:live                 -> record the current live version id
//   2. POST workspaces                    -> ephemeral workspace ci-sync-<sha>
//   3. GET  workspaces/W/templates        -> find the template by display name
//   4. no-op check: local == remote       -> delete workspace, exit changed=false
//   5. PUT  templates/T?fingerprint=<fp>  -> replace templateData
//   6. POST workspaces/W:create_version   -> compile + snapshot (fails loud on
//                                            compilerError / dirty syncStatus)
//   7. POST versions/V:publish?fingerprint=<fp>  -> make it live
//   8. best-effort delete the ephemeral workspace (create_version usually
//      consumes it; tolerate an already-gone workspace)
//
// Auth: Application Default Credentials (google-auth-library). In CI these come
// from google-github-actions/auth (Workload Identity Federation); locally, from
// `gcloud auth application-default login`. The service account / user must be a
// member of the GTM container with Edit + Publish (GTM's own ACL, not GCP IAM).
//
// Modes:
//   --dry-run            steps 1-4 only: prove auth, locate the template, report
//                        whether a publish WOULD happen. Creates and deletes an
//                        ephemeral workspace but never versions or publishes.
//   --rollback <id>      re-publish an existing container version id (GTM's
//                        canonical rollback), then exit. No workspace/version.
//
// Env:
//   GTM_ACCOUNT_ID     (required) numeric account id
//   GTM_CONTAINER_ID   (required) numeric container id of the staging container
//   GTM_TEMPLATE_NAME  (optional) template display name; default "Axeptio CMP"
//   GTM_VERSION_NAME   (optional) label for the created version; default "ci <sha>"
//   GTM_API_MIN_INTERVAL_MS (optional) min spacing between API calls; default 4000
//                        (GTM's default quota is ~0.25 QPS / 10k per day)
//   GITHUB_SHA / GITHUB_OUTPUT  consumed when present (CI); optional locally.
//
// Node built-ins + google-auth-library only. No googleapis SDK.

import { readFileSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { GoogleAuth } from 'google-auth-library';

const TPL_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'template.tpl');
const API_BASE = 'https://tagmanager.googleapis.com/tagmanager/v2';

// Union of every scope the flow touches. Note tagmanager.delete.containers:
// deleting the ephemeral workspace needs it, beyond edit/version/publish.
const SCOPES = [
  'https://www.googleapis.com/auth/tagmanager.edit.containers',
  'https://www.googleapis.com/auth/tagmanager.edit.containerversions',
  'https://www.googleapis.com/auth/tagmanager.publish',
  'https://www.googleapis.com/auth/tagmanager.delete.containers',
];

// --- CLI / env ----------------------------------------------------------------

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const rollbackIdx = args.indexOf('--rollback');
const rollbackVersionId = rollbackIdx !== -1 ? args[rollbackIdx + 1] : null;
if (rollbackIdx !== -1 && !/^\d+$/.test(rollbackVersionId || '')) {
  // Reject a missing id or the next flag (e.g. `--rollback --dry-run`) up front,
  // rather than letting it become a confusing API 404.
  fail('--rollback requires a numeric container version id, e.g. --rollback 42');
}

const accountId = requireEnv('GTM_ACCOUNT_ID');
const containerId = requireEnv('GTM_CONTAINER_ID');
const templateName = process.env.GTM_TEMPLATE_NAME?.trim() || 'Axeptio CMP';
const sha = (process.env.GITHUB_SHA || 'local').slice(0, 7);
const versionName = process.env.GTM_VERSION_NAME?.trim() || `ci ${sha}`;
const minIntervalMs = Number(process.env.GTM_API_MIN_INTERVAL_MS || 4000);
if (!Number.isFinite(minIntervalMs) || minIntervalMs < 0) {
  fail('GTM_API_MIN_INTERVAL_MS must be a non-negative number.');
}

const containerPath = `accounts/${accountId}/containers/${containerId}`;

function requireEnv(name) {
  const v = process.env[name]?.trim();
  if (!v) fail(`${name} must be set.`);
  return v;
}

function fail(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

// GitHub Actions step output; a plain log elsewhere.
function setOutput(key, value) {
  console.log(`  ${key}=${value}`);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  }
}

// --- Rate-limited API client --------------------------------------------------

const auth = new GoogleAuth({ scopes: SCOPES });
let client;
let lastCallAt = 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class ApiError extends Error {
  constructor(status, method, path, body) {
    super(`${method} ${path} -> ${status}: ${body}`);
    this.status = status;
  }
}

// One request, honoring a minimum inter-call interval and retrying on 429/5xx
// with exponential backoff. `path` is relative to API_BASE; `query` is an
// object; `body` is JSON-serialized when present. Throws ApiError on a
// non-retryable non-2xx so callers can react to specific statuses (e.g. a 404
// from versions:live meaning "no live version yet"); the top-level handler
// turns any uncaught ApiError into a clean failure.
async function api(method, path, { query, body } = {}) {
  if (!client) client = await auth.getClient();

  const url = new URL(`${API_BASE}/${path}`);
  for (const [k, v] of Object.entries(query || {})) {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  }

  for (let attempt = 0; ; attempt++) {
    const wait = lastCallAt + minIntervalMs - Date.now();
    if (wait > 0) await sleep(wait);
    lastCallAt = Date.now();

    const { token } = await client.getAccessToken();
    // Fail fast rather than sending "Authorization: Bearer undefined", which
    // turns a credential problem into an opaque 401. Throw (not fail) so the
    // caller's cleanup runs.
    if (!token) throw new Error('ADC returned no access token; check credentials and scopes.');
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();

    if (res.status === 429 || res.status >= 500) {
      if (attempt >= 5) {
        throw new ApiError(res.status, method, path, `after ${attempt + 1} attempts: ${text}`);
      }
      const backoff = Math.min(60000, 2 ** attempt * 1000);
      console.warn(`  ${res.status} on ${method} ${path}; retrying in ${backoff}ms`);
      await sleep(backoff);
      continue;
    }

    if (!res.ok) throw new ApiError(res.status, method, path, text);
    return text ? JSON.parse(text) : {};
  }
}

// --- Flow steps ---------------------------------------------------------------

// GTM stores templateData with normalized trailing whitespace; compare loosely
// so an incidental trailing newline never forces a needless republish.
const norm = (s) => (s || '').replace(/\s+$/, '');

async function getLiveVersionId() {
  // A brand-new container has no live version yet; GTM answers 404. Any other
  // error (auth, permission, network) must surface, not be swallowed.
  try {
    const live = await api('GET', `${containerPath}/versions:live`);
    return live?.containerVersionId || null;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

async function findTemplate(workspacePath) {
  const res = await api('GET', `${workspacePath}/templates`);
  const match = (res.template || []).find((t) => t.name === templateName);
  if (!match) {
    // Throw (not fail): main()'s catch must run to clean up the workspace.
    throw new Error(`No template named "${templateName}" in the staging container. ` +
      `Import it once in the GTM UI, then re-run.`);
  }
  return match;
}

async function rollback() {
  console.log(`Rollback: re-publishing container version ${rollbackVersionId}`);
  // Emit the same output set as the default flow so downstream steps behave
  // consistently across modes.
  const previousLiveVersion = await getLiveVersionId();
  setOutput('previous_live_version', previousLiveVersion ?? '');
  const version = await api('GET', `${containerPath}/versions/${rollbackVersionId}`);
  await api('POST', `${containerPath}/versions/${rollbackVersionId}:publish`, {
    query: { fingerprint: version.fingerprint },
  });
  setOutput('changed', 'true');
  setOutput('published_version', rollbackVersionId);
  console.log(`Rollback complete: version ${rollbackVersionId} is now live.`);
}

async function main() {
  const localData = readFileSync(TPL_PATH, 'utf8');

  if (rollbackVersionId) {
    await rollback();
    return;
  }

  const previousLiveVersion = await getLiveVersionId();
  setOutput('previous_live_version', previousLiveVersion ?? '');

  // Ephemeral workspace based on the latest container version, so we never
  // touch pending edits in anyone else's workspace.
  const workspace = await api('POST', `${containerPath}/workspaces`, {
    body: { name: `ci-sync-${sha}`, description: `Automated template sync for ${versionName}` },
  });
  const workspacePath = workspace.path;
  console.log(`Created ephemeral workspace ${workspace.workspaceId}`);

  // Always try to clean the workspace up, even on an error path. A successful
  // create_version consumes the workspace, so a 404 here is expected and benign
  // — tolerate it silently and only warn on a genuine cleanup failure.
  let workspaceLives = true;
  const deleteWorkspace = async () => {
    if (!workspaceLives) return;
    workspaceLives = false;
    try {
      await api('DELETE', workspacePath);
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) {
        console.warn(`  workspace cleanup: ${err.message}`);
      }
    }
  };

  try {
    const template = await findTemplate(workspacePath);

    if (norm(template.templateData) === norm(localData)) {
      console.log('Staging template already matches local template.tpl; nothing to publish.');
      await deleteWorkspace();
      setOutput('changed', 'false');
      return;
    }

    if (dryRun) {
      console.log('[dry-run] Template differs; a real run would update, version and publish.');
      await deleteWorkspace();
      // changed=true reflects "a publish would happen" — consistent with the
      // log and with the no-op branch above, which reports changed=false.
      setOutput('changed', 'true');
      return;
    }

    // Replace only templateData; echo back the rest of the resource (incl.
    // galleryReference) so nothing else is disturbed. fingerprint guards
    // against a concurrent edit landing between our GET and PUT. The template
    // resource carries its own API-relative `path`.
    await api('PUT', template.path, {
      query: { fingerprint: template.fingerprint },
      body: { ...template, templateData: localData },
    });
    console.log('Updated templateData in the ephemeral workspace.');

    const created = await api('POST', `${workspacePath}:create_version`, {
      body: { name: versionName, notes: `Automated sync of template.tpl at ${sha}` },
    });
    // Throw (not fail) on these: main()'s catch cleans up the workspace, which
    // create_version leaves intact when it does not produce a version.
    if (created.compilerError) {
      throw new Error('create_version reported a compilerError; not publishing.');
    }
    if (created.syncStatus && (created.syncStatus.mergeConflict || created.syncStatus.syncError)) {
      throw new Error(`create_version reported a dirty syncStatus: ${JSON.stringify(created.syncStatus)}`);
    }
    const version = created.containerVersion;
    if (!version?.containerVersionId) {
      throw new Error('create_version returned no container version; nothing to publish.');
    }
    console.log(`Created container version ${version.containerVersionId}`);

    await api('POST', `${containerPath}/versions/${version.containerVersionId}:publish`, {
      query: { fingerprint: version.fingerprint },
    });
    console.log(`Published version ${version.containerVersionId} to the staging container.`);

    // create_version usually consumes the workspace, but don't rely on it:
    // attempt the delete regardless (a 404 is tolerated) so a workspace can
    // never leak if that behavior ever changes.
    await deleteWorkspace();

    setOutput('changed', 'true');
    setOutput('published_version', version.containerVersionId);
  } catch (err) {
    await deleteWorkspace();
    throw err;
  }
}

main().catch((err) => fail(err.stack || err.message));

const OWNER = process.env.GITHUB_OWNER || 'brandismtechnologies2023-eng';
const REPO = process.env.GITHUB_REPO || 'bluweing_all_child_websites';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const API = 'https://api.github.com';

function headers() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN is not configured on the server');
  return {
    Authorization: `token ${token}`,
    'User-Agent': 'bluewing-admin-panel',
    Accept: 'application/vnd.github+json',
  };
}

// Short-lived in-memory cache, keyed by path. Warm serverless instances reuse
// this across invocations, cutting GitHub API calls and giving us a stale
// fallback to serve from if GitHub has a transient hiccup.
const CACHE_TTL_MS = 20 * 1000;
const cache = new Map(); // path -> { result, at }

// Reads a JSON file from the repo. Returns { data, sha }. If missing, returns { data: fallback, sha: null }.
async function readJson(path, fallback, useCache = true) {
  const cached = cache.get(path);
  if (useCache && cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.result;
  }

  try {
    const res = await fetch(
      `${API}/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`,
      { headers: headers() }
    );
    if (res.status === 404) {
      const result = { data: fallback, sha: null };
      cache.set(path, { result, at: Date.now() });
      return result;
    }
    if (!res.ok) throw new Error(`GitHub read failed (${res.status}): ${await res.text()}`);
    const json = await res.json();
    const content = Buffer.from(json.content, 'base64').toString('utf-8');
    const result = { data: JSON.parse(content), sha: json.sha };
    cache.set(path, { result, at: Date.now() });
    return result;
  } catch (err) {
    if (cached) return cached.result; // serve stale rather than fail outright
    throw err;
  }
}

// Writes a JSON file back to the repo (creates or updates).
async function writeJson(path, data, message) {
  const { sha } = await readJson(path, null, false).catch(() => ({ sha: null }));
  cache.delete(path);
  const body = {
    message,
    content: Buffer.from(JSON.stringify(data, null, 2), 'utf-8').toString('base64'),
    branch: BRANCH,
  };
  if (sha) body.sha = sha;
  const res = await fetch(`${API}/repos/${OWNER}/${REPO}/contents/${path}`, {
    method: 'PUT',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GitHub write failed (${res.status}): ${await res.text()}`);
  return res.json();
}

module.exports = { readJson, writeJson };

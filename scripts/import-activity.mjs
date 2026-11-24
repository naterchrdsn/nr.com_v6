import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';

const ROOT = new URL('../', import.meta.url);
const OUTPUT = fileURLToPath(new URL('src/data/imported-updates.json', ROOT));
const CONFIG = new URL('config/activity-sources.json', ROOT);
const MAX_BYTES = 2_000_000;
const MAX_PAGES = 3;
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const markdown = s => s.replace(/[\\`*_{}\[\]()<>!#|~]/g, '\\$&');

function validateSource(source) {
  if (!source || !/^(?:Nacho-Labs-LLC|naterchrdsn)\/[A-Za-z0-9_.-]+$/.test(source.repo) || !source.name?.trim()) throw new Error('Invalid curated own-work source');
}

function validateRelease(release, source) {
  if (!Number.isSafeInteger(release.id) || release.id <= 0 || typeof release.draft !== 'boolean' || typeof release.prerelease !== 'boolean') throw new Error('Invalid release identity or visibility flags');
  if (release.draft || release.prerelease) return;
  const date = release.published_at;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString() !== date.replace('Z', '.000Z')) throw new Error('Invalid release publication date');
  const url = new URL(release.html_url);
  if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.port || url.username || url.password || url.search || url.hash || !url.pathname.startsWith(`/${source.repo}/releases/tag/`) || url.pathname === `/${source.repo}/releases/tag/`) throw new Error('Unsafe or foreign release URL');
  if (typeof release.tag_name !== 'string' || !release.tag_name.trim() || (release.name != null && typeof release.name !== 'string')) throw new Error('Invalid release name');
}

export function mergeReleases(existing, batches) {
  const records = new Map();
  for (const post of existing) {
    if (!/^github:release:[1-9]\d*$/.test(post.guid) || records.has(post.guid)) throw new Error('Invalid or duplicate existing imported identity');
    records.set(post.guid, post);
  }
  for (const { source, releases } of batches) {
    validateSource(source);
    if (!Array.isArray(releases)) throw new Error('Invalid release list');
    for (const release of releases) validateRelease(release, source);
    const latest = releases.filter(r => !r.draft && !r.prerelease).sort((a, b) => compare(b.published_at, a.published_at) || b.id - a.id)[0];
    if (!latest) continue;
    const guid = `github:release:${latest.id}`;
    const previous = records.get(guid);
    if (previous && previous.sourceUrl !== latest.html_url) throw new Error(`Release identity/source collision: ${guid}`);
    // Existing releases are immutable snapshots: don't churn dates, identity or prose on refresh.
    if (previous) continue;
    const name = latest.name?.trim() || latest.tag_name;
    records.set(guid, {
      slug: `github-release-${latest.id}`,
      title: `${source.name}: ${name}`,
      description: `Release ${name} from ${source.name} on GitHub.`,
      publishedAt: latest.published_at.slice(0, 10),
      format: 'update', categories: ['development'], published: true,
      body: `Release **${markdown(name)}** from ${markdown(source.name)}. See the original GitHub release for release notes and downloads.`,
      sourceUrl: latest.html_url, sourceName: `${source.name} on GitHub`, guid,
    });
  }
  return [...records.values()].sort((a, b) => compare(b.publishedAt, a.publishedAt) || compare(a.guid, b.guid));
}

export async function githubJSON(url, fetcher = fetch) {
  // Public unauthenticated requests only: no private releases or ambient credentials.
  const response = await fetcher(url, {
    headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'naterichardson-public-activity' },
    signal: AbortSignal.timeout(15_000), redirect: 'error',
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`GitHub ${response.status}: ${url}; rate remaining=${response.headers.get('x-ratelimit-remaining') ?? '?'} reset=${response.headers.get('x-ratelimit-reset') ?? '?'} retry-after=${response.headers.get('retry-after') ?? '?'}. No records written; retry manually later.`);
  }
  if (Number(response.headers.get('content-length')) > MAX_BYTES) { await response.body?.cancel(); throw new Error('GitHub response byte limit exceeded'); }
  let bytes = 0;
  const chunks = [];
  for await (const chunk of response.body) {
    bytes += chunk.byteLength;
    if (bytes > MAX_BYTES) throw new Error('GitHub response byte limit exceeded');
    chunks.push(Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function fetchSource(source, fetcher) {
  validateSource(source);
  const base = `https://api.github.com/repos/${source.repo}`;
  const repo = await githubJSON(base, fetcher);
  if (repo.full_name !== source.repo || repo.private !== false || repo.visibility !== 'public' || repo.fork !== false || repo.archived !== false) throw new Error(`Source must be public, owned, nonfork and nonarchived: ${source.repo}`);
  const releases = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const batch = await githubJSON(`${base}/releases?per_page=100&page=${page}`, fetcher);
    if (!Array.isArray(batch)) throw new Error(`Invalid release list: ${source.repo}`);
    releases.push(...batch);
    if (batch.length < 100) return { source, releases };
  }
  throw new Error(`Release pagination cap reached for ${source.repo}; no records written. Review source before raising bound.`);
}

export async function runImport({ sources, output = OUTPUT, write = false, fetcher = fetch, validate, log = console.log } = {}) {
  if (!sources) {
    const config = JSON.parse(await readFile(CONFIG, 'utf8'));
    sources = config.githubReleases;
  }
  if (!Array.isArray(sources) || !sources.length || sources.length > 8 || new Set(sources.map(s => s.repo)).size !== sources.length) throw new Error('Expected 1–8 unique curated sources');
  const original = await readFile(output, 'utf8');
  const existing = JSON.parse(original);
  if (!Array.isArray(existing)) throw new Error('Imported registry must be an array');
  const batches = [];
  // Sequential and bounded: stop on any failure, retaining the entire previous file.
  for (const source of sources) {
    try {
      const batch = await fetchSource(source, fetcher);
      const selected = mergeReleases([], [batch]);
      log(`${source.repo}: ${batch.releases.length} fetched; ${selected.length ? selected[0].guid + ' ' + selected[0].publishedAt : 'no published stable releases'}`);
      batches.push(batch);
    } catch (error) { throw new Error(`${source.repo}: ${error.message}`, { cause: error }); }
  }
  const posts = mergeReleases(existing, batches);
  if (!validate) {
    const { validatePublications } = await import('../src/data/publication.ts');
    const others = await Promise.all(['migrated-posts.json', 'authored-posts.json'].map(async name => JSON.parse(await readFile(new URL(`src/data/${name}`, ROOT), 'utf8'))));
    validate = result => validatePublications([...others.flat(), ...result]);
  }
  validate(posts);
  const text = JSON.stringify(posts, null, 2) + '\n';
  if (write && text !== original) {
    if (await readFile(output, 'utf8') !== original) throw new Error('Registry changed during fetch; refusing overwrite');
    const temporary = `${output}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, text, { flag: 'wx' });
      await rename(temporary, output);
    } finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
  }
  log(`${write ? 'Write' : 'Dry-run (no files changed)'}: ${posts.length} total updates, ${posts.length - existing.length} new; ${text === original ? 'unchanged bytes' : 'changes available'}`);
  return posts;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.some(arg => !['--write', '--status'].includes(arg)) || (args.includes('--write') && args.includes('--status'))) {
    console.error('Usage: node scripts/import-activity.mjs [--write | --status] (default: dry-run)');
    process.exitCode = 1;
  } else {
    runImport({ write: args.includes('--write') }).catch(error => { console.error(error.message); process.exitCode = 1; });
  }
}

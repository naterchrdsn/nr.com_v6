import test from 'node:test';
import assert from 'node:assert/strict';

const load = () => import('../scripts/import-activity.mjs');

test('rejects unsafe or foreign release URLs, malformed dates and IDs', async () => {
  const { mergeReleases } = await load();
  for (const changes of [
    { html_url: 'javascript:alert(1)' }, { html_url: 'https://user:pass@github.com/x/y' },
    { html_url: 'https://example.com/release' }, { html_url: 'https://github.com/other/repo/releases/tag/v1' },
    { published_at: '2026-02-30T00:00:00Z' }, { id: '1' }, { draft: undefined },
  ]) assert.throws(() => mergeReleases([], [{ source, releases: [{ ...release(1), ...changes }] }]));
});

test('dedupes, deterministically sorts, preserves history and bytes across reruns', async () => {
  const { mergeReleases } = await load();
  const first = mergeReleases([], [{ source, releases: [release(1)] }]);
  const batch = [{ source, releases: [release(2), release(2), { ...release(3), draft: true }, { ...release(4), prerelease: true }] }];
  const merged = mergeReleases(first, batch);
  assert.deepEqual(merged.map(p => p.guid), ['github:release:1', 'github:release:2']);
  assert.equal(JSON.stringify(mergeReleases(merged, batch)), JSON.stringify(merged));
  assert.deepEqual(mergeReleases(merged, [{ source, releases: [] }]), merged);
});

test('CLI failures preserve exact output and dry-run never writes', async () => {
  const { runImport } = await load();
  const { mkdtemp, writeFile, readFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = await mkdtemp(join(tmpdir(), 'activity-test-'));
  const output = join(dir, 'updates.json');
  try {
    await writeFile(output, '[]\n');
    const repo = { full_name: source.repo, private: false, visibility: 'public', fork: false, archived: false };
    const fetcher = async url => new Response(JSON.stringify(url.includes('/releases?') ? [release(1)] : repo));
    const options = { sources: [source], output, fetcher, validate: () => {}, log: () => {} };
    await runImport(options);
    assert.equal(await readFile(output, 'utf8'), '[]\n');
    await assert.rejects(runImport({ ...options, write: true, fetcher: async () => new Response('rate limit', { status: 403, headers: { 'retry-after': '60' } }) }), /403|rate/i);
    assert.equal(await readFile(output, 'utf8'), '[]\n');
    await runImport({ ...options, write: true });
    const saved = await readFile(output, 'utf8');
    await runImport({ ...options, write: true });
    assert.equal(await readFile(output, 'utf8'), saved);
    await assert.rejects(runImport({ ...options, write: true, fetcher: async () => new Response(JSON.stringify({ ...repo, fork: true })) }), /public|fork|owned/i);
    assert.equal(await readFile(output, 'utf8'), saved);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('bounded public API reads reject oversized, malformed and rate-limited responses', async () => {
  const { githubJSON } = await load();
  const url = 'https://api.github.com/repos/Nacho-Labs-LLC/point-grab';
  for (const response of [
    new Response('x', { status: 429, headers: { 'retry-after': '60' } }),
    new Response('invalid json'),
    new Response('x', { headers: { 'content-length': '2000001' } }),
    new Response('x'.repeat(2_000_001)),
  ]) await assert.rejects(githubJSON(url, async (_, options) => {
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(options.headers.Authorization, undefined);
    return response;
  }));
});

test('all-source transaction preserves registry on late failure, page cap or validation failure', async () => {
  const { runImport } = await load();
  const { mkdtemp, writeFile, readFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = await mkdtemp(join(tmpdir(), 'activity-transaction-'));
  const output = join(dir, 'updates.json');
  const other = { repo: 'Nacho-Labs-LLC/fridgeshare', name: 'FridgeShare' };
  const publicRepo = s => ({ full_name: s.repo, private: false, visibility: 'public', fork: false, archived: false });
  const response = data => new Response(JSON.stringify(data));
  try {
    await writeFile(output, '[]\n');
    const options = { sources: [source, other], output, write: true, validate: () => {}, log: () => {} };
    await assert.rejects(runImport({ ...options, fetcher: async url => {
      if (url.includes('fridgeshare')) return new Response('', { status: 503 });
      return response(url.includes('/releases?') ? [release(1)] : publicRepo(source));
    } }), /503/);
    assert.equal(await readFile(output, 'utf8'), '[]\n');
    let pages = 0;
    await assert.rejects(runImport({ ...options, sources: [source], fetcher: async url => {
      if (!url.includes('/releases?')) return response(publicRepo(source));
      pages++;
      return response(Array.from({ length: 100 }, () => release(1)));
    } }), /pagination cap/);
    assert.equal(pages, 3);
    assert.equal(await readFile(output, 'utf8'), '[]\n');
    await assert.rejects(runImport({ ...options, sources: [source], validate: () => { throw new Error('invalid schema'); }, fetcher: async url => response(url.includes('/releases?') ? [release(1)] : publicRepo(source)) }), /invalid schema/);
    assert.equal(await readFile(output, 'utf8'), '[]\n');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

const source = { repo: 'Nacho-Labs-LLC/point-grab', name: 'point-grab' };
const release = (id, date = '2026-11-20T10:00:00Z') => ({ id, tag_name: `v${id}`, name: `Version ${id}`, published_at: date, draft: false, prerelease: false, html_url: `https://github.com/${source.repo}/releases/tag/v${id}` });

test('latest stable own release becomes attributed update with numeric identity', async () => {
  const { mergeReleases } = await load();
  const posts = mergeReleases([], [{ source, releases: [release(1), release(2, '2026-11-21T10:00:00Z')] }]);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].guid, 'github:release:2');
  assert.equal(posts[0].publishedAt, '2026-11-21');
  assert.equal(posts[0].sourceUrl, release(2).html_url);
  assert.equal(posts[0].published, true);
  assert.match(posts[0].body, /Release.*Version 2/);
  assert.match(posts[0].sourceName, /point-grab/);
});

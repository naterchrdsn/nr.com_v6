import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import baseline from './migration-baseline.json' with { type: 'json' };

test('all six original publications survive verbatim with legacy identities', async () => {
  const module = await import('../src/data/publication.ts').catch(() => null);
  assert.ok(module, 'native publication registry must exist');
  const { PUBLICATIONS, PUBLISHED_POSTS } = module;
  assert.equal(baseline.length, 6);
  for (const original of baseline) {
    const migrated = PUBLICATIONS.find(p => p.slug === original.slug);
    assert.ok(migrated, original.slug);
    const { guid, ...record } = migrated;
    // Snapshot generated directly from the original ESSAYS records before migration.
    assert.equal(createHash('sha256').update(JSON.stringify(record)).digest('hex'), original.sha256, original.slug);
    assert.equal(guid, `https://nacholabs.net/posts/${original.slug}`);
  }
  assert.deepEqual(PUBLISHED_POSTS.map(p => p.publishedAt), [...PUBLISHED_POSTS].map(p => p.publishedAt).sort().reverse());
});

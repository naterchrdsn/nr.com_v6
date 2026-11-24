import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PUBLISHED_POSTS, validatePublications, FORMATS } from '../src/data/publication.ts';
const fixture = { slug: 'test-only', title: 'Fixture', description: 'Test only', body: '# Fixture\n\nFull **native** body.\n\n<script>alert(1)</script>\n\n[bad](javascript:alert)', published: false, publishedAt: '2026-01-01', categories: ['development'], format: 'note' };

test('all native formats validate; attribution, dates and identities are enforced', () => {
  for (const format of FORMATS) validatePublications([{ ...fixture, format, sourceUrl: 'https://example.com/original', sourceName: 'Original author' }]);
  for (const format of ['link', 'quote']) assert.throws(() => validatePublications([{ ...fixture, format }]), /attribution/);
  for (const change of [{ publishedAt: '2026-02-30' }, { sourceUrl: 'javascript:alert(1)', sourceName: 'No' }, { categories: ['../bad'] }, { published: 'true' }]) assert.throws(() => validatePublications([{ ...fixture, ...change }]));
  assert.throws(() => validatePublications([fixture, fixture]), /slug/);
  assert.throws(() => validatePublications([fixture, { ...fixture, slug: 'different', guid: 'same' }, { ...fixture, slug: 'third', guid: 'same' }]), /GUID/);
});

test('short feed entries contain full sanitized Markdown and RSS preserves legacy GUIDs', async () => {
  const render = await import('../src/lib/publication.ts').catch(() => null);
  assert.ok(render, 'publication renderer must exist');
  assert.match(render.bodyHtml(fixture), /<strong>native<\/strong>/);
  assert.doesNotMatch(render.bodyHtml(fixture), /<h1|<script|javascript:/);
  assert.match(render.bodyHtml({ ...fixture, format: 'quote' }), /^<blockquote>/);
  const feed = render.rss(PUBLISHED_POSTS);
  assert.equal((feed.match(/<item>/g) ?? []).length, PUBLISHED_POSTS.length);
  for (const p of PUBLISHED_POSTS) {
    assert.ok(feed.includes(p.guid));
    assert.ok(feed.includes(`https://naterichardson.com/posts/${p.slug}/`));
  }
  assert.match(feed, /content:encoded/);
  assert.match(feed, /dc:creator>Nate Richardson/);
});

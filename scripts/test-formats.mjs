// Disposable production build: synthetic test posts never enter the real registry or dist.
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, symlinkSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { chromium, expect } from '@playwright/test';
import { FORMATS, PUBLISHED_POSTS } from '../src/data/publication.ts';

// Authored records are replaced by fixtures; migrated/imported records remain.
const authoredSlugs = new Set(JSON.parse(readFileSync(new URL('../src/data/authored-posts.json', import.meta.url), 'utf8')).map(post => post.slug));
const retainedPosts = PUBLISHED_POSTS.filter(post => !authoredSlugs.has(post.slug));
const expectedPublishedCount = retainedPosts.length + FORMATS.length;

const root = fileURLToPath(new URL('../', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'publication-formats-'));
let server, browser;
try {
  for (const path of ['src', 'astro.config.mjs', 'tsconfig.json', 'package.json']) cpSync(join(root, path), join(dir, path), { recursive: true });
  symlinkSync(join(root, 'node_modules'), join(dir, 'node_modules'), 'dir');
  const fixtures = FORMATS.map(format => ({ slug: `fixture-${format}`, title: `Fixture ${format}`, description: 'Disposable test excerpt.', body: `Full **${format}** fixture body.\n\n<script>alert('unsafe')</script>`, format, categories: ['test-only'], publishedAt: '2026-01-01', published: true, sourceUrl: 'https://example.com/original?x=1&y=2', sourceName: 'Test source & author', guid: `urn:test:${format}` }));
  writeFileSync(join(dir, 'src/data/authored-posts.json'), JSON.stringify([...fixtures, { ...fixtures[0], slug: 'hidden-draft', published: false, guid: 'urn:test:draft' }]));
  const build = spawnSync(process.execPath, [join(root, 'node_modules/astro/bin/astro.mjs'), 'build'], { cwd: dir, encoding: 'utf8' });
  assert.equal(build.status, 0, `${build.stdout}\n${build.stderr}`);
  server = createServer((req, res) => {
    try {
      const path = new URL(req.url, 'http://localhost').pathname;
      const file = resolve(dir, 'dist', `.${path.endsWith('/') ? `${path}index.html` : path}`);
      if (!file.startsWith(join(dir, 'dist/'))) throw new Error('Invalid path');
      const types = { '.html': 'text/html', '.xml': 'application/xml', '.css': 'text/css', '.js': 'application/javascript' };
      res.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream');
      res.end(readFileSync(file));
    } catch { res.statusCode = 404; res.end('Not found'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, javaScriptEnabled: false });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${origin}/posts/`);
    for (const format of FORMATS) {
      const card = page.locator(`[data-post][data-format="${format}"]`).filter({ hasText: `Fixture ${format}` });
      await expect(card).toBeVisible();
      if (format === 'article') { await expect(card).toContainText('Disposable test excerpt.'); await expect(card.locator('.prose')).toHaveCount(0); }
      else { await expect(card.locator('.prose')).toContainText(`Full ${format} fixture body.`); }
      await expect(card.locator('.post-source a')).toHaveAttribute('href', 'https://example.com/original?x=1&y=2');
      if (format === 'quote') await expect(card.locator('blockquote')).toBeVisible();
    }
    await expect(page.locator('[data-post]')).toHaveCount(expectedPublishedCount);
    await expect(page.getByText('hidden-draft')).toHaveCount(0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.getByRole('heading', { name: 'Fixture note', exact: true }).getByRole('link').click();
    await expect(page.locator('h1')).toHaveText('Fixture note');
    await page.getByRole('link', { name: 'Test only', exact: true }).click();
    await expect(page.locator('[data-post]')).toHaveCount(5);
    await page.locator('.archive-filters').getByRole('link', { name: 'Quotes', exact: true }).click();
    await expect(page.locator('[data-post]')).toHaveCount(1);
    assert.deepEqual(errors, []);
    await context.close();
  }
  const page = await browser.newPage();
  const xml = readFileSync(join(dir, 'dist/rss.xml'), 'utf8');
  const parsed = await page.evaluate(xml => {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    return { errors: doc.querySelectorAll('parsererror').length, items: [...doc.querySelectorAll('item')].map(item => ({ guid: item.querySelector('guid').textContent, html: item.getElementsByTagNameNS('http://purl.org/rss/1.0/modules/content/', 'encoded')[0].textContent })) };
  }, xml);
  assert.equal(parsed.errors, 0);
  assert.equal(parsed.items.length, expectedPublishedCount);
  for (const format of FORMATS) {
    const item = parsed.items.find(item => item.guid === `urn:test:${format}`);
    assert.ok(item.html.includes(`<strong>${format}</strong>`));
    assert.ok(item.html.includes('Test source &amp; author'));
    assert.ok(!item.html.includes('<script>'));
  }
  console.log('Mixed-format production build verified in Chromium at 390px and 1440px: full short posts, article excerpts, source attribution, quotes, no-JS navigation, hidden drafts, valid full-content RSS.');
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  rmSync(dir, { recursive: true, force: true });
}

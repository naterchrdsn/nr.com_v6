import { test, expect } from '@playwright/test';
import { PUBLISHED_POSTS, FORMATS, CATEGORIES } from '../src/data/publication.ts';

test('native archives and details work without JavaScript at every viewport', async ({ browser, baseURL }, testInfo) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: testInfo.project.use.viewport, baseURL });
  const page = await context.newPage();
  await page.goto('/posts/');
  await expect(page.getByRole('heading', { name: 'Posts', exact: true })).toBeVisible();
  await expect(page.locator('[data-post]')).toHaveCount(PUBLISHED_POSTS.length);
  await expect(page.locator('[data-post] h2').first()).toHaveText(PUBLISHED_POSTS[0].title);
  await page.screenshot({ path: testInfo.outputPath('publication-archive.png'), fullPage: true });
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://naterichardson.com/posts/');
  for (const format of FORMATS) {
    await page.goto(`/posts/format/${format}/`);
    await expect(page.locator('[data-post]')).toHaveCount(PUBLISHED_POSTS.filter(p => p.format === format).length);
    expect((await page.request.get(`/posts/format/${format}/rss.xml`)).status()).toBe(200);
  }
  for (const category of CATEGORIES) {
    await page.goto(`/posts/category/${category}/`);
    await expect(page.locator('[data-post]')).toHaveCount(PUBLISHED_POSTS.filter(p => p.categories.includes(category)).length);
  }
  for (const post of PUBLISHED_POSTS) {
    await page.goto(`/posts/${post.slug}/`);
    await expect(page.locator('h1')).toHaveText(post.title);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('.prose')).not.toBeEmpty();
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article');
    await expect(page.locator('meta[property="article:published_time"]')).toHaveAttribute('content', `${post.publishedAt}T00:00:00Z`);
    await expect(page.locator('meta[name="author"]')).toHaveAttribute('content', 'Nate Richardson');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.screenshot({ path: testInfo.outputPath('publication-detail.png'), fullPage: true });
  await context.close();
});

test('homepage keeps six destinations and replaces only the publication star', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.destination')).toHaveCount(6);
  await expect(page.locator('.destination').first()).toHaveAttribute('href', '/posts/');
  await expect(page.locator('.destination strong').first()).toHaveText('Posts');
  await expect(page.locator('link[rel="alternate"][type="application/rss+xml"]').first()).toHaveAttribute('href', '/rss.xml');
  expect(await page.locator('.destination').evaluateAll(links => links.slice(1).map(a => a.getAttribute('href')))).toEqual(['https://nacholabs.net/projects', 'https://github.com/naterchrdsn', 'https://www.linkedin.com/in/naterchrdsn/', 'https://bsky.app/profile/naterichardson.com', 'https://x.com/naterchrdsn']);
  await page.locator('.destination').first().getByText('Posts', { exact: true }).click();
  await expect(page.locator('h1')).toHaveText('Posts');
  await page.locator('[data-post] h2 a').first().click();
  await expect(page.locator('h1')).toHaveText(PUBLISHED_POSTS[0].title);
});

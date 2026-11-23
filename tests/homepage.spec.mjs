import { test, expect } from '@playwright/test';

async function position(page, i = 0) {
  return page.locator('.destination').nth(i).evaluate(a => ({ x: parseFloat(a.style.left), y: parseFloat(a.style.top) }));
}

async function movableStar(page) {
  await page.locator('.star-handle').first().scrollIntoViewIfNeeded();
  return page.evaluate(() => {
    const links = [...document.querySelectorAll('.destination')];
    const bounds = document.querySelector('.map').getBoundingClientRect();
    const identity = document.querySelector('.identity').getBoundingClientRect();
    const footer = document.querySelector('.bottom').getBoundingClientRect();
    const overlap = (a, b) => a.left < b.right + 8 && a.right > b.left - 8 && a.top < b.bottom + 8 && a.bottom > b.top - 8;
    for (let i = 0; i < links.length; i++) {
      const r = links[i].getBoundingClientRect();
      const h = document.querySelectorAll('.star-handle')[i].getBoundingClientRect();
      if (h.top < 5 || h.bottom > innerHeight - 5) continue;
      for (const [dx, dy] of [[8, 0], [-8, 0], [0, 8], [0, -8]]) {
        const a = { left: r.left + dx, right: r.right + dx, top: r.top + dy, bottom: r.bottom + dy };
        if (a.left < Math.max(bounds.left + 8, 12) || a.right > Math.min(bounds.right - 8, innerWidth - 12) || a.top < bounds.top + 8 || a.bottom > (innerWidth < 1100 ? bounds.bottom - 8 : footer.top - 20)) continue;
        if (overlap(a, identity) || links.some((link, j) => j !== i && overlap(a, link.getBoundingClientRect()))) continue;
        return { i, x: h.x + h.width / 2, y: h.y + h.height / 2, dx, dy };
      }
    }
    return null;
  });
}

test('homepage metadata, destinations, and instructions', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('.destination')).toHaveCount(6);
  await expect(page.locator('.star-handle')).toHaveCount(6);
  await expect(page.locator('.sky-note')).toContainText('every page load');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://naterichardson.com/');
  await expect(page.locator('meta[name="twitter:creator"]')).toHaveAttribute('content', '@naterchrdsn');
  const schema = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
  expect(schema.sameAs).toContain('https://x.com/naterchrdsn');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  expect(errors).toEqual([]);
});

test('reload and New sky generate different arrangements', async ({ page }) => {
  await page.goto('/');
  const seed = await page.locator('.constellation').getAttribute('data-sky-seed');
  await page.reload();
  await expect(page.locator('.constellation')).not.toHaveAttribute('data-sky-seed', seed);
  const next = await page.locator('.constellation').getAttribute('data-sky-seed');
  await page.locator('#new-sky').click();
  await expect(page.locator('.constellation')).not.toHaveAttribute('data-sky-seed', next);
});

test('real mouse or touch drag moves a star without opening its link', async ({ page, context, isMobile }) => {
  await page.goto('/');
  const p = await movableStar(page);
  expect(p).not.toBeNull();
  const before = await position(page, p.i);
  if (isMobile) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p.x + p.dx, y: p.y + p.dy }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
  } else {
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.move(p.x + p.dx, p.y + p.dy, { steps: 4 });
    await page.mouse.up();
  }
  expect(await position(page, p.i)).toEqual({ x: before.x + p.dx, y: before.y + p.dy });
  await expect(page.locator('.dragging')).toHaveCount(0);
  await expect(page.locator('#status')).toContainText('Star repositioned');
  expect(new URL(page.url()).pathname).toBe('/');
  const hit = await page.locator('.destination').nth(p.i).evaluate(a => {
    const r = a.querySelector('strong').getBoundingClientRect();
    return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('a')?.href === a.href;
  });
  expect(hit).toBe(true);
});

test('arrow keys move stars; Escape restores a mouse drag', async ({ page }) => {
  await page.goto('/');
  const p = await movableStar(page);
  expect(p).not.toBeNull();
  const before = await position(page, p.i);
  const handle = page.locator('.star-handle').nth(p.i);
  await handle.focus();
  const key = p.dx > 0 ? 'ArrowRight' : p.dx < 0 ? 'ArrowLeft' : p.dy > 0 ? 'ArrowDown' : 'ArrowUp';
  await page.keyboard.press(key);
  expect(await position(page, p.i)).toEqual({ x: before.x + p.dx, y: before.y + p.dy });
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - p.dx, box.y + box.height / 2 - p.dy);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  expect(await position(page, p.i)).toEqual({ x: before.x + p.dx, y: before.y + p.dy });
});

test('reduced motion starts paused and remains draggable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('#pause')).toHaveText('Resume motion');
  await expect(page.locator('#pause')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#new-sky').click();
  await expect(page.locator('#pause')).toHaveText('Resume motion');
  await page.locator('#replay').click();
  await expect(page.locator('#status')).toContainText('illuminated');
});

test('existing Matomo container sends site 3 pageview successfully', async ({ page }) => {
  const responsePromise = page.waitForResponse(r => {
    const request = r.request();
    // The existing container uses a protocol-relative tracker URL. A local HTTP
    // preview redirects to HTTPS; verify the final tracking response, not its 301.
    return r.url().startsWith('https://analytics.therchrdsns.com/matomo.php') && (r.status() < 300 || r.status() >= 400) && (r.url() + (request.postData() || '')).includes('idsite=3');
  }, { timeout: 20000 });
  await page.goto('/');
  const response = await responsePromise;
  expect(response.ok(), `Matomo ${response.request().method()} returned ${response.status()}`).toBe(true);
  const trackers = await page.evaluate(() => window.Matomo.getAsyncTrackers().map(t => ({ id: t.getSiteId(), views: t.getNumTrackedPageViews() })));
  expect(trackers.some(t => t.id === '3' && t.views > 0)).toBe(true);
});

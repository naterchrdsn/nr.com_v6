import { test, expect } from '@playwright/test';

test('New galaxy is the only scene control', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.controls button')).toHaveCount(1);
  await expect(page.locator('.controls button')).toHaveText('New galaxy ↗');
  await expect(page.locator('#pause, #replay')).toHaveCount(0);
});

test('pulse scheduler visits every star once per shuffle with quiet, nonoverlapping gaps', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(() => {
    const { createPulses, rng } = window.ConstellationGeometry;
    const orders = [], gaps = [], durations = [];
    for (const seed of [1, 37, 51874, 987654]) {
      const pulses = createPulses(6, rng(seed));
      let previous = -1, end = 0, start = 0;
      const order = [];
      for (let step = 0; step < 4000; step++) {
        const t = step * 0.05;
        const p = pulses.tick(0.05);
        if (p.index !== previous) {
          if (p.index >= 0) { order.push(p.index); if (end) gaps.push(t - end); start = t; }
          else { end = t; durations.push(t - start); }
          previous = p.index;
        }
      }
      orders.push(order);
    }
    return { orders, gaps, durations };
  });
  for (const order of result.orders) {
    expect(order.length).toBeGreaterThan(12);
    for (let i = 0; i + 6 <= order.length; i += 6) expect([...order.slice(i, i + 6)].sort()).toEqual([0, 1, 2, 3, 4, 5]);
    expect(order.every((star, i) => i === 0 || star !== order[i - 1])).toBe(true);
  }
  expect(new Set(result.orders.map(o => o.slice(0, 6).join(','))).size).toBeGreaterThan(1);
  expect(result.gaps.every(gap => gap >= 4.3 && gap <= 8.5)).toBe(true);
  expect(result.durations.every(duration => duration >= 3.5 && duration <= 3.7)).toBe(true);
});

test('real animation pulses one point and immediately respects reduced motion', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Animation timing is viewport-independent; mobile uses the same renderer.');
  await page.goto('/');
  await expect(page.locator('#sky')).toHaveAttribute('data-motion', 'animated');
  await expect.poll(() => page.locator('#sky').getAttribute('data-pulse-star'), { timeout: 7000 }).toMatch(/^[0-5]$/);
  await page.screenshot({ path: testInfo.outputPath('star-pulse.png') });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('#sky')).toHaveAttribute('data-motion', 'static');
  await expect(page.locator('#sky')).toHaveAttribute('data-pulse-star', '-1');
  const before = await page.locator('#sky').evaluate(c => c.toDataURL());
  await page.waitForTimeout(350);
  expect(await page.locator('#sky').evaluate(c => c.toDataURL())).toEqual(before);
  await page.locator('#new-sky').click();
  await expect(page.locator('#sky')).toHaveAttribute('data-galaxy-seed', await page.locator('.constellation').getAttribute('data-sky-seed'));
  await expect(page.locator('#sky')).toHaveAttribute('data-pulse-star', '-1');
});

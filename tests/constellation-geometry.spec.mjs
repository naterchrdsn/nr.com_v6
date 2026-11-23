import { test, expect } from '@playwright/test';

test('enlarged destination text grows the galaxy instead of colliding', async ({ page }) => {
  await page.goto('/');
  await page.addStyleTag({ content: '.destination strong { font-size: 34px !important; } .destination small { font-size: 18px !important; }' });
  await page.evaluate(() => dispatchEvent(new Event('resize')));
  const failures = await page.locator('.destination').evaluateAll(links => {
    const rs = links.map(a => a.getBoundingClientRect());
    return rs.flatMap((a, i) => {
      const invalid = !Number.isFinite(parseFloat(links[i].style.left)) || a.left < 0 || a.right > innerWidth;
      const collision = rs.some((b, j) => j > i && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top);
      return invalid || collision ? [i] : [];
    });
  });
  expect(failures).toEqual([]);
});

test('New sky changes the painted galaxy while paused; dragging does not regenerate it', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('#sky')).toHaveAttribute('data-galaxy-seed', await page.locator('.constellation').getAttribute('data-sky-seed'));
  const before = await page.locator('#sky').evaluate(c => c.toDataURL());
  await page.locator('#new-sky').click();
  await expect(page.locator('#sky')).toHaveAttribute('data-galaxy-seed', await page.locator('.constellation').getAttribute('data-sky-seed'));
  await page.evaluate(() => { scrollTo(0, 0); });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
  const after = await page.locator('#sky').evaluate(c => c.toDataURL());
  expect(after).not.toEqual(before);
  const scene = await page.evaluate(() => JSON.stringify(document.querySelector('.constellation').galaxy));
  await page.locator('.star-handle').first().focus();
  await page.keyboard.press('ArrowRight');
  expect(await page.evaluate(() => JSON.stringify(document.querySelector('.constellation').galaxy))).toEqual(scene);
  await expect(page.locator('#pause')).toHaveText('Resume motion');
});

// Sweep deterministic seeds in a real browser: label geometry, not abstract
// point distance, is the constraint that matters for this navigation surface.
test('mathematical skies stay readable across seeds and responsive boundaries', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'This sweep sets its own desktop/mobile viewports.');
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const originalOrder = await page.locator('.destination').evaluateAll(as => as.map(a => a.href));
  const stats = [];
  for (const width of [320, 390, 700, 768, 1099, 1100, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    // Let the browser deliver resize before inspecting synchronous layouts.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
    const result = await page.evaluate(() => {
      const root = document.querySelector('.constellation');
      const links = [...document.querySelectorAll('.destination')];
      const map = document.querySelector('.map').getBoundingClientRect();
      const identity = document.querySelector('.identity').getBoundingClientRect();
      const footer = document.querySelector('.bottom');
      const floor = innerWidth < 1100 ? map.bottom : footer.getBoundingClientRect().top + parseFloat(getComputedStyle(footer).paddingTop);
      const failures = [], families = new Set(), signatures = new Set();
      const originalRandom = crypto.getRandomValues;
      const overlap = (a, b, gap = 0) => a.left < b.right + gap && a.right + gap > b.left && a.top < b.bottom + gap && a.bottom + gap > b.top;
      try {
        for (let i = 1; i <= 60; i++) {
          const seed = Math.imul(i, 2654435761) >>> 0;
          crypto.getRandomValues = array => { array[0] = seed; return array; };
          document.querySelector('#new-sky').click();
          if (root.dataset.skySeed !== String(seed)) failures.push({ i, reason: 'layout could not fit' });
          const rects = links.map(a => a.getBoundingClientRect());
          rects.forEach((a, j) => {
            if (a.left < 11 || a.right > innerWidth - 11 || a.top < map.top || a.bottom > floor) failures.push({ i, j, reason: 'bounds' });
            if (overlap(a, identity, 8)) failures.push({ i, j, reason: 'intro collision' });
            if (rects.some((b, k) => k > j && overlap(a, b, 12))) failures.push({ i, j, reason: 'label collision' });
          });
          const points = links.map(a => { const r = a.querySelector('.star').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
          const scene = root.galaxy;
          if (scene.seed !== seed || scene.family !== root.dataset.skyFamily) failures.push({ i, reason: 'galaxy and navigation disagree' });
          points.forEach((p, j) => {
            const x = p.x - map.left, y = p.y - map.top;
            let distance = Infinity;
            scene.paths.forEach(path => path.slice(1).forEach((b, k) => {
              const a = path[k], dx = b.x - a.x, dy = b.y - a.y;
              const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1)));
              distance = Math.min(distance, Math.hypot(x - a.x - t * dx, y - a.y - t * dy));
            }));
            if (distance > 1) failures.push({ i, j, reason: 'star is not on a galaxy arm', distance });
          });
          const edges = JSON.parse(root.dataset.skyEdges);
          if (JSON.stringify(edges) !== JSON.stringify(window.ConstellationGeometry.tree(points))) failures.push({ i, reason: 'renderer tree out of sync' });
          if (edges.length !== links.length - 1 || new Set(edges.flat()).size !== links.length) failures.push({ i, reason: 'disconnected tree' });
          families.add(root.dataset.skyFamily);
          signatures.add(JSON.stringify(rects.map(r => [r.x, r.y])));
        }
      } finally { crypto.getRandomValues = originalRandom; }
      return { width: innerWidth, failures, families: [...families].sort(), unique: signatures.size };
    });
    expect(result.failures, JSON.stringify(result)).toEqual([]);
    expect(result.families, JSON.stringify(result)).toEqual(['serpentine', 'spiral', 'starburst']);
    expect(result.unique).toBe(60);
    expect(await page.locator('.destination').evaluateAll(as => as.map(a => a.href))).toEqual(originalOrder);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    stats.push(result);
    if (width === 1440 || width === 390) {
      for (const family of ['serpentine', 'spiral', 'starburst']) {
        for (let attempt = 0; attempt < 30; attempt++) {
          if (await page.locator('.constellation').getAttribute('data-sky-family') === family) break;
          await page.locator('#new-sky').click();
        }
        await expect(page.locator('.constellation')).toHaveAttribute('data-sky-family', family);
        await expect(page.locator('#sky')).toHaveAttribute('data-galaxy-family', family);
        await page.screenshot({ path: testInfo.outputPath(`${family}-${width}.png`), fullPage: true });
      }
    }
  }
  console.log('Seed sweep:', JSON.stringify(stats));
});

test('the renderer follows a manually moved star without snapping it back', async ({ page }) => {
  await page.goto('/');
  await page.locator('.star-handle').first().focus();
  const geometry = await page.evaluate(() => {
    const links = [...document.querySelectorAll('.destination')];
    const points = () => links.map(a => { const r = a.querySelector('.star').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    const before = points();
    // A scroll must only refresh connection geometry, not regenerate the sky.
    const link = links[0];
    link.style.left = `${parseFloat(link.style.left) + 3}px`;
    dispatchEvent(new Event('scroll'));
    return { before, after: points(), edges: JSON.parse(document.querySelector('.constellation').dataset.skyEdges), expected: window.ConstellationGeometry.tree(points()) };
  });
  expect(geometry.after[0].x).toBe(geometry.before[0].x + 3);
  expect(geometry.edges).toEqual(geometry.expected);
});

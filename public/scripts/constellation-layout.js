(() => {
  'use strict';
  const root = document.querySelector('.constellation');
  const map = root.querySelector('.map');
  const links = [...map.querySelectorAll('.destination')];
  const status = root.querySelector('#status');
  let seed = crypto.getRandomValues(new Uint32Array(1))[0];

  function layout() {
    const random = window.ConstellationGeometry.rng(seed ^ 0x9e3779b9);
    const mobile = innerWidth < 1100;
    const bounds = map.getBoundingClientRect();
    const identity = root.querySelector('.identity').getBoundingClientRect();
    const footer = root.querySelector('.bottom');
    const bottom = footer.getBoundingClientRect();
    const left = mobile ? 12 : Math.max(identity.right + 40, innerWidth * 0.44) - bounds.left;
    const right = bounds.width - (mobile ? 12 : 44);
    const top = mobile ? 8 : 96;
    const floor = mobile ? bounds.height - 8 : bottom.top + parseFloat(getComputedStyle(footer).paddingTop) - bounds.top - 38;
    const sizes = links.map(link => {
      link.style.transform = 'none';
      link.style.width = 'max-content';
      link.style.maxWidth = `${Math.min(260, right - left)}px`;
      return link.getBoundingClientRect();
    });
    const spanX = Math.max(0, right - left - Math.max(...sizes.map(r => r.width)));
    const spanY = Math.max(0, floor - top - Math.max(...sizes.map(r => r.height)));
    const maxHeight = Math.max(...sizes.map(r => r.height));
    const needed = (maxHeight + 20) * (links.length - 1);
    if (spanY < needed) {
      // Text enlargement must grow the scene, never silently leave old stars.
      if (mobile) map.style.height = `${bounds.height + needed - spanY + 1}px`;
      else root.style.minHeight = `${root.getBoundingClientRect().height + needed - spanY + 1}px`;
      layout();
      return;
    }
    const field = window.ConstellationGeometry.galaxy(seed);
    const paths = field.paths.map(path => path.map(p => ({ x: left + 10.5 + p.x * spanX, y: top + maxHeight / 2 + p.y * spanY })));
    const slots = links.map((_, i) => i);
    if (!mobile) {
      for (let i = slots.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [slots[i], slots[j]] = [slots[j], slots[i]];
      }
    }
    const positions = sizes.map((size, i) => {
      // Intersect the actual galaxy arms with six loose vertical bands.
      // This retains each galaxy's silhouette without crushing its labels.
      const t = slots[i] / (links.length - 1) + (slots[i] > 0 && slots[i] < links.length - 1 ? (random() - 0.5) * 0.02 : 0);
      const y = top + maxHeight / 2 + t * spanY;
      const crossings = [];
      paths.forEach(path => path.slice(1).forEach((b, j) => {
        const a = path[j];
        if (y < Math.min(a.y, b.y) - 0.001 || y > Math.max(a.y, b.y) + 0.001 || Math.abs(b.y - a.y) < 0.00001) return;
        const u = Math.max(0, Math.min(1, (y - a.y) / (b.y - a.y)));
        crossings.push(a.x + (b.x - a.x) * u);
      }));
      const x = crossings[Math.floor(random() * crossings.length)];
      return { x: Math.round(x - 10.5), y: Math.round(y - size.height / 2) };
    });
    links.forEach((link, i) => {
      link.style.left = `${positions[i].x}px`;
      link.style.top = `${positions[i].y}px`;
    });
    root.dataset.skySeed = String(seed);
    root.dataset.skyFamily = field.family;
    const box = root.getBoundingClientRect();
    const scene = { ...field, paths, offsetX: bounds.left - box.left, offsetY: bounds.top - box.top, width: box.width, height: box.height };
    root.galaxy = scene;
    dispatchEvent(new CustomEvent('galaxychange', { detail: scene }));
    // The renderer reads actual DOM star positions, including while paused.
    dispatchEvent(new Event('scroll'));
  }

  root.querySelector('#new-sky').addEventListener('click', () => {
    seed = crypto.getRandomValues(new Uint32Array(1))[0];
    layout();
    status.textContent = 'New constellation generated.';
  });
  addEventListener('resize', layout);
  layout();
})();

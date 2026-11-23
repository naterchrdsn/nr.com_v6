(() => {
  'use strict';
  const root = document.querySelector('.constellation');
  const map = root.querySelector('.map');
  const links = [...map.querySelectorAll('.destination')];
  const status = root.querySelector('#status');
  let seed = crypto.getRandomValues(new Uint32Array(1))[0];

  function rng(value) {
    let n = value >>> 0;
    return () => {
      n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
      return n / 4294967296;
    };
  }

  function layout() {
    const random = rng(seed);
    const mobile = innerWidth < 1100;
    const bounds = map.getBoundingClientRect();
    const identity = root.querySelector('.identity').getBoundingClientRect();
    const bottom = root.querySelector('.bottom').getBoundingClientRect();
    const columns = mobile ? 1 : 2;
    const rows = Math.ceil(links.length / columns);
    const left = mobile ? 12 : Math.max(identity.right + 40, innerWidth * 0.44) - bounds.left;
    const right = bounds.width - (mobile ? 12 : 44);
    const top = mobile ? 8 : 96;
    const height = mobile ? bounds.height - 16 : Math.max(300, bottom.top - bounds.top - top - 38);
    const cellWidth = (right - left) / columns;
    const cellHeight = height / rows;
    const slots = Array.from({ length: links.length }, (_, i) => i);
    // Stable DOM/tab order; randomized visual placement only.
    for (let i = slots.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [slots[i], slots[j]] = [slots[j], slots[i]];
    }
    links.forEach((link, i) => {
      const slot = mobile ? i : slots[i];
      link.style.transform = 'none';
      link.style.maxWidth = `${Math.max(180, cellWidth - 12)}px`;
      const rect = link.getBoundingClientRect();
      const spareX = Math.max(0, cellWidth - rect.width - 12);
      const spareY = Math.max(0, cellHeight - rect.height - 12);
      const x = left + (slot % columns) * cellWidth + random() * spareX;
      const y = top + Math.floor(slot / columns) * cellHeight + random() * spareY;
      link.style.left = `${Math.round(x)}px`;
      link.style.top = `${Math.round(y)}px`;
    });
    root.dataset.skySeed = String(seed);
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

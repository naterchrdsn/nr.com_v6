(() => {
  'use strict';
  const root = document.querySelector('.constellation');
  const canvas = document.querySelector('#sky');
  const ctx = canvas.getContext('2d');
  const links = [...root.querySelectorAll('.destination')];
  const pause = root.querySelector('#pause');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const geometry = window.ConstellationGeometry;
  let w = 0, h = 0, cloud = null, scene = null, points = [], edges = [];
  let time = 0, birth = reduce.matches ? 7 : 0, paused = reduce.matches;
  let raf = 0, bakeFrame = 0, last = 0, active = -1;
  const randomStars = geometry.rng(51874);
  const stars = Array.from({ length: 450 }, () => ({
    x: randomStars(), y: randomStars(), r: 0.25 + randomStars() * 1.05,
    a: 0.1 + randomStars() * 0.65, phase: randomStars() * Math.PI * 2,
  }));

  function bloom(c, x, y, radius, rgb, alpha) {
    const gradient = c.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(${rgb},${alpha})`);
    gradient.addColorStop(0.35, `rgba(${rgb},${alpha * 0.5})`);
    gradient.addColorStop(1, `rgba(${rgb},0)`);
    c.fillStyle = gradient;
    c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  // Reusable soft stamps keep generation out of the animation hot path.
  const colors = ['65,85,170', '139,53,139', '34,113,150', '161,116,191', '199,189,237', '3,6,18'];
  const stamps = colors.map(rgb => {
    const stamp = document.createElement('canvas');
    stamp.width = stamp.height = 128;
    bloom(stamp.getContext('2d'), 64, 64, 64, rgb, 1);
    return stamp;
  });

  function bake() {
    if (!scene) return;
    const random = geometry.rng(scene.seed ^ 0x51ed270b);
    const scale = Math.min(1, 1400 / scene.width);
    cloud = document.createElement('canvas');
    cloud.width = Math.ceil(scene.width * scale);
    cloud.height = Math.ceil(scene.height * scale);
    const c = cloud.getContext('2d');
    c.scale(scale, scale);
    const radius = (35 + Math.min(scene.width, scene.height) * 0.038) * scene.thickness * (scene.family === 'spiral' ? 0.85 : 1);
    function stamp(x, y, size, color, alpha, stretch = 1) {
      c.globalAlpha = alpha;
      c.drawImage(stamps[color], x - size * stretch, y - size, size * 2 * stretch, size * 2);
    }
    // Layer diffuse gas, mottled knots, then dark dust lanes. There is no
    // stroked outline: even a radial starburst remains a field of soft wisps.
    for (const layer of ['gas', 'dust', 'knots']) {
      c.globalCompositeOperation = layer === 'dust' ? 'source-over' : 'screen';
      scene.paths.forEach((path, arm) => path.forEach((point, i) => {
        if (i % 2) return;
        const x = point.x + scene.offsetX;
        const y = point.y + scene.offsetY;
        const taper = 0.35 + Math.sin((i / (path.length - 1)) * Math.PI) * 0.65;
        const angle = random() * Math.PI * 2;
        const spread = layer === 'gas' ? radius * 0.38 : radius * 0.2;
        const dx = Math.cos(angle) * random() * spread;
        const dy = Math.sin(angle) * random() * spread;
        if (layer === 'gas') {
          const color = (Math.floor(scene.hue * 3) + arm + Math.floor(i / 35)) % 4;
          stamp(x + dx, y + dy, radius * (0.55 + random() * 0.7) * taper, color, 0.10 + random() * 0.09, 1.1);
        } else if (layer === 'dust') {
          stamp(x + dx, y + dy, radius * (0.15 + random() * 0.32), 5, 0.07 + random() * 0.1);
        } else {
          stamp(x + dx, y + dy, radius * (0.025 + random() * 0.1), 4, 0.035 + random() * 0.1);
        }
      }));
    }
    // Fixed, seed-specific young stars embedded in the shared gas paths.
    c.globalCompositeOperation = 'screen';
    c.globalAlpha = 1;
    scene.paths.forEach(path => {
      for (let i = 0; i < 70; i++) {
        const p = path[Math.floor(random() * path.length)];
        bloom(c, p.x + scene.offsetX + (random() - 0.5) * radius, p.y + scene.offsetY + (random() - 0.5) * radius, 0.5 + random() * 2.2, '198,207,250', 0.15 + random() * 0.35);
      }
    });
    canvas.dataset.galaxySeed = String(scene.seed);
    canvas.dataset.galaxyFamily = scene.family;
  }

  function positions() {
    points = links.map(link => {
      const r = link.querySelector('.star').getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    edges = geometry.tree(points);
    root.dataset.skyEdges = JSON.stringify(edges);
  }

  function draw() {
    const e = 1 - Math.pow(1 - Math.min(1, birth / 5), 3);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#080b1b';
    ctx.fillRect(0, 0, w, h);
    if (cloud && scene) {
      const box = root.getBoundingClientRect();
      ctx.globalAlpha = 0.28 + e * 0.72;
      // Scene coordinates follow the document, so scrolling never separates
      // the galaxy from its navigation stars on a tall mobile page.
      ctx.drawImage(cloud, box.left, box.top, scene.width, scene.height);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'screen';
    for (const star of stars) {
      ctx.fillStyle = `rgba(214,225,255,${star.a * (0.5 + e * 0.5) * (0.9 + Math.sin(time * 0.4 + star.phase) * 0.1)})`;
      ctx.beginPath(); ctx.arc(star.x * w, star.y * h, star.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = e;
    for (const [i, j] of edges) {
      const a = points[i], b = points[j], highlight = active === i || active === j;
      ctx.strokeStyle = highlight ? 'rgba(224,208,255,.85)' : 'rgba(178,191,225,.25)';
      ctx.lineWidth = highlight ? 1.4 : 0.65;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      if (highlight) {
        const t = paused ? 0.5 : (time * 0.16) % 1;
        bloom(ctx, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, 25, '179,159,255', 0.33);
      }
    }
    points.forEach((p, i) => bloom(ctx, p.x, p.y, active === i ? 65 : 25, active === i ? '230,174,250' : '117,161,242', active === i ? 0.33 : 0.18));
    const origin = points[0];
    if (origin && birth < 5 && !reduce.matches) {
      const wave = Math.min(1, birth / 4);
      ctx.strokeStyle = `rgba(215,189,249,${Math.sin(wave * Math.PI) * 0.1})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(origin.x, origin.y, wave * Math.max(w, h) * 0.7, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function frame(ts) {
    raf = 0;
    if (paused || document.hidden) return;
    const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.016;
    last = ts; time += dt; birth += dt; draw();
    raf = requestAnimationFrame(frame);
  }
  function start() {
    if (!raf && !paused && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); }
  }
  function sync() {
    pause.textContent = paused ? 'Resume motion' : 'Pause motion';
    pause.setAttribute('aria-pressed', String(paused));
    if (paused) { cancelAnimationFrame(raf); raf = 0; birth = Math.max(5, birth); draw(); }
    else start();
  }
  function resize() {
    w = innerWidth; h = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, 1.6);
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    positions(); draw();
  }
  addEventListener('galaxychange', event => {
    scene = event.detail;
    cancelAnimationFrame(bakeFrame);
    // Coalesce rapid resizes; cloud textures are cached, not painted per frame.
    bakeFrame = requestAnimationFrame(() => { bakeFrame = 0; bake(); positions(); draw(); });
  });
  pause.addEventListener('click', () => { paused = !paused; sync(); });
  root.querySelector('#replay').addEventListener('click', () => {
    if (paused || reduce.matches) {
      birth = 7; active = 0; draw();
      root.querySelector('#status').textContent = 'First light: the constellation is illuminated.';
    } else {
      birth = 0; start();
      root.querySelector('#status').textContent = 'Replaying first light.';
    }
  });
  links.forEach((link, i) => {
    const on = () => { active = i; draw(); };
    const off = () => { active = -1; draw(); };
    link.addEventListener('mouseenter', on); link.addEventListener('focus', on);
    link.addEventListener('mouseleave', off); link.addEventListener('blur', off);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else start();
  });
  reduce.addEventListener('change', () => { paused = reduce.matches; if (paused) birth = 7; sync(); });
  addEventListener('scroll', () => { positions(); if (paused) draw(); }, { passive: true });
  addEventListener('resize', resize);
  resize(); sync();
})();

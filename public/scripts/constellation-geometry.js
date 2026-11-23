(() => {
  'use strict';

  function rng(value) {
    let n = value >>> 0;
    return () => {
      n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
      return n / 4294967296;
    };
  }

  // One shared field: the cloud renderer and the navigation sample exactly
  // the same paths. Changing the seed changes the galaxy, not just its stars.
  function galaxy(seed) {
    const random = rng(seed);
    const family = ['serpentine', 'spiral', 'starburst'][Math.floor(random() * 3)];
    const rotation = random() * Math.PI * 2;
    const phase = random() * Math.PI * 2;
    const frequency = 0.8 + random() * 0.7;
    const turn = 3.8 + random() * 2;
    const arms = family === 'serpentine' ? 1 : family === 'spiral' ? 2 + Math.floor(random() * 2) : 4 + Math.floor(random() * 3);
    const paths = Array.from({ length: arms }, (_, arm) => {
      const angle = arm * Math.PI * 2 / arms + (random() - 0.5) * 0.3;
      const reach = 0.8 + random() * 0.4;
      const bend = (random() - 0.5) * 0.9;
      return Array.from({ length: 181 }, (_, i) => {
        const t = i / 180;
        let x, y;
        if (family === 'serpentine') {
          x = Math.sin(t * Math.PI * 2 * frequency + phase) * 0.55 + Math.sin(t * Math.PI * 4 + phase) * 0.1;
          y = (t - 0.5) * 2;
        } else {
          const theta = angle + (family === 'spiral' ? turn * t : bend * t + Math.sin(t * 4 + phase) * 0.12);
          const radius = reach * (family === 'spiral' ? (Math.exp(t * 1.8) - 1) / (Math.exp(1.8) - 1) : t);
          x = Math.cos(theta) * radius;
          y = Math.sin(theta) * radius;
        }
        return { x: x * Math.cos(rotation) - y * Math.sin(rotation), y: x * Math.sin(rotation) + y * Math.cos(rotation) };
      });
    });
    const points = paths.flat();
    const minX = Math.min(...points.map(p => p.x)), minY = Math.min(...points.map(p => p.y));
    const width = Math.max(...points.map(p => p.x)) - minX || 1;
    const height = Math.max(...points.map(p => p.y)) - minY || 1;
    return {
      seed, family, thickness: 0.65 + random() * 0.6, hue: random(),
      paths: paths.map(path => path.map(p => ({ x: (p.x - minX) / width, y: (p.y - minY) / height }))),
    };
  }

  // Euclidean minimum spanning tree: a connected, crossing-free network
  // without imposing navigation order on the constellation's silhouette.
  function tree(points) {
    if (!points.length) return [];
    const visited = new Set([0]);
    const edges = [];
    while (visited.size < points.length) {
      let best = null, distance = Infinity;
      for (const a of visited) {
        for (let b = 0; b < points.length; b++) {
          if (visited.has(b)) continue;
          const d = (points[a].x - points[b].x) ** 2 + (points[a].y - points[b].y) ** 2;
          if (d < distance) { distance = d; best = [a, b]; }
        }
      }
      edges.push(best);
      visited.add(best[1]);
    }
    return edges;
  }

  window.ConstellationGeometry = Object.freeze({ rng, galaxy, tree });
})();

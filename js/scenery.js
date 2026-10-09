// Per-circuit scenery: sky / time of day, ground, trees, water, hills, city blocks,
// grandstands, pit building, floodlights and landmarks. Everything is procedural and
// approximate; positions are relative to the simplified layouts in tracks.js.
//
// Theme fields:
//   time: 'day' | 'dusk' | 'night'           ground: 'grass' | 'dry' | 'desert' | 'urban' | 'dunes'
//   trees: { kind: 'broad'|'pine'|'palm', count }
//   water: { sides: ['N','S','E','W'], margin } or { inside: scale } (lake inside the lap)
//   hills: { h, dist, dir? }                 urban: { rows, minH, maxH, palette }
//   skyline: { dir: 'N'|'S'|'E'|'W'|'all', count, minH, maxH, dist }
//   landmarks: [{ type, u, v, ... }]          u/v = position across the track's bounding box (0..1, v=0 north)
//   floodlights, boats, dunes, runoff ('tarmac'|'grass'), stadium: { from, to } (fraction of the lap)
const THEMES = {
  albertpark:  { time: 'day', ground: 'grass', trees: { kind: 'broad', count: 1000 }, water: { inside: 0.45 },
                 skyline: { dir: 'N', count: 45, minH: 60, maxH: 240, dist: 900 } },
  shanghai:    { time: 'day', ground: 'grass', trees: { kind: 'broad', count: 300 },
                 skyline: { dir: 'E', count: 35, minH: 40, maxH: 160, dist: 1200 }, landmarks: [{ type: 'shanghaiBridge' }] },
  suzuka:      { time: 'day', ground: 'grass', trees: { kind: 'pine', count: 1600 }, hills: { h: 220, dist: 700 },
                 landmarks: [{ type: 'ferris', r: 32, u: 0.9, v: 0.95 }] },
  miami:       { time: 'day', ground: 'urban', trees: { kind: 'palm', count: 350 }, runoff: 'tarmac',
                 landmarks: [{ type: 'stadium', u: 0.45, v: 0.5 }], urban: { rows: 1, minH: 6, maxH: 18, palette: 'miami' } },
  montreal:    { time: 'day', ground: 'grass', trees: { kind: 'broad', count: 900 }, water: { sides: ['E', 'W'], margin: 60 },
                 landmarks: [{ type: 'biosphere', u: 0.95, v: 0.0 }], skyline: { dir: 'N', count: 45, minH: 60, maxH: 220, dist: 1000 } },
  // Monaco: Port Hercule fills the space between the swimming-pool section, Rascasse and the road from
  // the tunnel exit to Tabac; the open sea lies beyond it and off the coast below the tunnel. The rock
  // of Monaco-Ville closes the harbour to the south. (Map coordinates, same as the track points.)
  monaco:      { time: 'day', ground: 'urban', trees: { kind: 'palm', count: 120 }, boats: 70,
                 water: { poly: [[-200, -62], [-120, -50], [-40, -40], [-12, -44], [15, -32], [40, -14], [75, -7], [125, 6], [165, 19],
                   [215, 44], [255, 61], [305, 91], [343, 126], [370, 160], [392, 200], [408, 240], [420, 285], [430, 350], [438, 420],
                   [470, 470], [700, 700], [6000, 700], [6000, -6000], [350, -6000], [350, -900], [250, -600], [120, -575], [-60, -562],
                   [-112, -543], [-172, -444], [-198, -392], [-203, -340], [-199, -300], [-214, -230], [-240, -186], [-246, -140],
                   [-236, -96], [-216, -70]] },
                 urban: { rows: 3, minH: 15, maxH: 70, palette: 'monaco' }, hills: { h: 500, dist: 450, dir: 'N' } },
  barcelona:   { time: 'day', ground: 'dry', trees: { kind: 'pine', count: 400 }, hills: { h: 260, dist: 900 } },
  redbullring: { time: 'day', ground: 'grass', trees: { kind: 'pine', count: 1000 }, hills: { h: 1000, dist: 900 } },
  silverstone: { time: 'day', ground: 'grass', trees: { kind: 'broad', count: 350 } },
  spa:         { time: 'day', ground: 'grass', trees: { kind: 'pine', count: 2400 }, hills: { h: 320, dist: 600 } },
  hungaroring: { time: 'day', ground: 'dry', trees: { kind: 'broad', count: 600 }, hills: { h: 130, dist: 600 } },
  zandvoort:   { time: 'day', ground: 'dunes', trees: { kind: 'pine', count: 250 }, dunes: 220, water: { sides: ['W'], margin: 300 } },
  monza:       { time: 'day', ground: 'grass', trees: { kind: 'broad', count: 2600 } },
  madrid:      { time: 'day', ground: 'dry', trees: { kind: 'broad', count: 200 }, runoff: 'tarmac',
                 urban: { rows: 1, minH: 12, maxH: 26, palette: 'ifema' }, skyline: { dir: 'S', count: 40, minH: 60, maxH: 250, dist: 1000 } },
  baku:        { time: 'dusk', ground: 'urban', trees: { kind: 'palm', count: 150 }, water: { sides: ['S'], margin: 40 },
                 urban: { rows: 2, minH: 15, maxH: 45, palette: 'baku' }, landmarks: [{ type: 'flames', u: 0.0, v: 0.3 }] },
  sepang:      { time: 'day', ground: 'grass', trees: { kind: 'palm', count: 900 }, hills: { h: 140, dist: 900 } },
  singapore:   { time: 'night', ground: 'urban', trees: { kind: 'broad', count: 250 }, water: { sides: ['S'], margin: 60 }, floodlights: true,
                 urban: { rows: 2, minH: 25, maxH: 130, palette: 'glass' },
                 landmarks: [{ type: 'mbs', u: 1.0, v: 1.0 }, { type: 'ferris', r: 75, u: 1.0, v: 0.3 }] },
  cota:        { time: 'day', ground: 'dry', trees: { kind: 'broad', count: 250 }, landmarks: [{ type: 'cotaTower', u: 0.9, v: 0.15 }],
                 stadium: { from: 0.57, to: 0.66 } },
  mexico:      { time: 'day', ground: 'grass', trees: { kind: 'broad', count: 350 }, stadium: { from: 0.8, to: 0.9 },
                 skyline: { dir: 'all', count: 80, minH: 30, maxH: 160, dist: 1100 } },
  interlagos:  { time: 'day', ground: 'grass', trees: { kind: 'broad', count: 500 },
                 skyline: { dir: 'all', count: 160, minH: 25, maxH: 120, dist: 350 } },
  lasvegas:    { time: 'night', ground: 'urban', trees: { kind: 'palm', count: 80 }, floodlights: true,
                 urban: { rows: 2, minH: 40, maxH: 190, palette: 'vegas' }, landmarks: [{ type: 'sphere', u: 0.7, v: 0.3 }] },
  lusail:      { time: 'night', ground: 'desert', trees: { kind: 'palm', count: 60 }, runoff: 'tarmac', floodlights: true },
  yasmarina:   { time: 'dusk', ground: 'desert', runoff: 'grass', trees: { kind: 'palm', count: 250 }, floodlights: true,
                 water: { sides: ['S'], margin: 120 }, boats: 45, landmarks: [{ type: 'yasHotel', at: 0.86 }] },
};

const ENVIRONMENTS = {
  day:   { top: 0x3f7fd0, horizon: 0xc4dcf0, fog: [0xc4dcf0, 900, 7000], hemi: [0xe6f2ff, 0x55683a, 0.8],
           sun: [0xffffff, 0.75, 300, 600, 200], stars: false },
  dusk:  { top: 0x1f2f66, horizon: 0xf2a066, fog: [0xd99a6c, 700, 6000], hemi: [0xffd8b8, 0x3b3530, 0.72],
           sun: [0xffb070, 0.6, -500, 180, 300], stars: false },
  night: { top: 0x03050c, horizon: 0x1c2440, fog: [0x121829, 600, 5000], hemi: [0xc4d2ff, 0x2a2a2a, 0.9],
           sun: [0xffffff, 0.35, 100, 800, 100], stars: true },
};

// Spatial index over the centerline for fast "how far is this point from the track" checks.
function makeTrackIndex(T) {
  const C = 40, map = new Map();
  const key = (a, b) => a * 100003 + b;
  for (let i = 0; i < T.n; i += 2) {
    const k = key(Math.floor(T.x[i] / C), Math.floor(T.z[i] / C));
    let a = map.get(k); if (!a) map.set(k, a = []);
    a.push(i);
  }
  // Distance to the nearest centerline point (Infinity if none within maxR).
  // With y given, only track points at a similar height count.
  function nearest(x, z, maxR = 300, y = null) {
    const cx = Math.floor(x / C), cz = Math.floor(z / C), R = Math.ceil(maxR / C);
    let best = Infinity;
    for (let r = 0; r <= R; r++) {
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const a = map.get(key(cx + dx, cz + dz));
        if (!a) continue;
        for (const i of a) {
          if (y !== null && Math.abs(T.y[i] - y) > 3) continue;
          const d = (T.x[i] - x) ** 2 + (T.z[i] - z) ** 2;
          if (d < best) best = d;
        }
      }
      if (best <= (r * C) ** 2) break;
    }
    return Math.sqrt(best);
  }
  return { nearest };
}

function buildScenery(ctx) {
  const { T, group, ribbon, canvasTex, speckle } = ctx;
  const theme = THEMES[T.def.id] || { time: 'day', ground: 'grass' };
  const env = ENVIRONMENTS[theme.time];
  const night = theme.time === 'night', dusk = theme.time === 'dusk';
  const idx = T.index;
  const updaters = [];

  // Seeded random so each circuit always looks the same.
  let seed = 0;
  for (const ch of T.def.id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rand = () => {
    seed = (seed + 0x6D2B79F5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rr = (a, b) => a + (b - a) * rand();

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < T.n; i++) {
    minX = Math.min(minX, T.x[i]); maxX = Math.max(maxX, T.x[i]);
    minZ = Math.min(minZ, T.z[i]); maxZ = Math.max(maxZ, T.z[i]);
  }
  const cx0 = (minX + maxX) / 2, cz0 = (minZ + maxZ) / 2;
  const radius = Math.max(maxX - minX, maxZ - minZ) / 2;
  const walled = !!T.def.walls;
  const clearOf = walled ? T.hw + T.def.walls.offset + 4 : T.hw + 30;   // keep scenery behind the barriers

  // ---------- Water ----------
  const waterTests = [];
  if (theme.water) {
    const w = theme.water;
    const mat = new THREE.MeshPhongMaterial({ color: night ? 0x0b1830 : 0x1f6390, shininess: 90, specular: 0x8899aa });
    const FAR = 9000;
    if (w.inside || w.poly) {
      const pts = [];
      if (w.poly) for (const [x, y] of w.poly) pts.push(T.fromMap(x, y));
      else {
        // Lake inside the lap: centred on the infield point furthest from the track (the bounding
        // box centre can sit right by a straight on a long thin lap), then rays cast out from it,
        // each stopping well short of the road, scaled by `inside`.
        const inLap = (x, z) => {
          let r = false;
          for (let i = 0, j = T.n - 1; i < T.n; j = i++) {
            if ((T.z[i] > z) !== (T.z[j] > z) && x < (T.x[j] - T.x[i]) * (z - T.z[i]) / (T.z[j] - T.z[i]) + T.x[i]) r = !r;
          }
          return r;
        };
        let lx = cx0, lz = cz0, best = -1;
        for (let gx = minX; gx <= maxX; gx += 25) for (let gz = minZ; gz <= maxZ; gz += 25) {
          const d = idx.nearest(gx, gz, 600);
          if (d > best && inLap(gx, gz)) { best = d; lx = gx; lz = gz; }
        }
        const clear = clearOf + 15, RAYS = 160, len = [];
        for (let k = 0; k < RAYS; k++) {
          const a = k / RAYS * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
          let r = 0;
          while (r < 4000 && idx.nearest(lx + dx * (r + 5), lz + dz * (r + 5), clear + 5) >= clear) r += 5;
          len.push(r);
        }
        for (let k = 0; k < RAYS; k++) {   // no spikes: never longer than the neighbours allow
          const r = Math.min(len[k], len[(k + 1) % RAYS] * 1.15, len[(k + RAYS - 1) % RAYS] * 1.15);
          const a = k / RAYS * Math.PI * 2, s = Math.min(1, w.inside * 2);
          pts.push([lx + Math.cos(a) * r * s, lz + Math.sin(a) * r * s]);
        }
      }
      const shape = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], -p[1])));
      const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat);
      m.rotation.x = -Math.PI / 2; m.position.y = 0.04;
      group.add(m);
      waterTests.push((x, z) => {
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, zi] = pts[i], [xj, zj] = pts[j];
          if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
        }
        return inside;
      });
    }
    for (const side of w.sides || []) {
      const m = w.margin;
      let x0, x1, z0, z1, test;
      if (side === 'N') { z1 = minZ - m; z0 = z1 - FAR; x0 = cx0 - FAR; x1 = cx0 + FAR; test = (x, z) => z < z1; }
      if (side === 'S') { z0 = maxZ + m; z1 = z0 + FAR; x0 = cx0 - FAR; x1 = cx0 + FAR; test = (x, z) => z > z0; }
      if (side === 'W') { x1 = minX - m; x0 = x1 - FAR; z0 = cz0 - FAR; z1 = cz0 + FAR; test = (x, z) => x < x1; }
      if (side === 'E') { x0 = maxX + m; x1 = x0 + FAR; z0 = cz0 - FAR; z1 = cz0 + FAR; test = (x, z) => x > x0; }
      const pm = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), mat);
      pm.rotation.x = -Math.PI / 2;
      pm.position.set((x0 + x1) / 2, 0.04, (z0 + z1) / 2);
      group.add(pm);
      waterTests.push(test);
    }
  }
  const isWater = (x, z) => waterTests.some(t => t(x, z));

  // ---------- Ground ----------
  // Ground textures: layered colour patches, then thousands of short blades / grains.
  const GROUND = {
    grass:  { base: '#46852f', tones: ['#3b7428', '#52933a', '#5c9b3f', '#3f7a2b', '#6aa548'], blades: ['#2f6420', '#5f9e40', '#78b356', '#447f2d', '#8cbf62'], soil: 'rgba(90,70,40,0.25)' },
    dry:    { base: '#7c9443', tones: ['#8a9a4c', '#6f8a3a', '#9aa15a', '#7a8d42'], blades: ['#a3a35c', '#6b8436', '#b9b26e', '#5d7a2e'], soil: 'rgba(120,95,55,0.35)' },
    desert: { base: '#c9a66b', tones: ['#d2b07a', '#bf9a60', '#d9bc8a', '#c4a068'], blades: ['#e0c595', '#b08a55', '#cfae78'], soil: 'rgba(140,105,65,0.35)' },
    urban:  { base: '#8b8d90', tones: ['#94969a', '#808286', '#9a9ca0'], blades: ['#a5a7aa', '#76787c'], soil: 'rgba(60,60,60,0.25)' },
    dunes:  { base: '#b5ad78', tones: ['#c4b987', '#9fa265', '#cfc497', '#8f9c58'], blades: ['#7e9a4a', '#d6cb9c', '#6f8c3e'], soil: 'rgba(150,130,90,0.3)' },
  }[theme.ground];
  const blades = theme.ground !== 'urban' && theme.ground !== 'desert';
  const groundTex = canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = GROUND.base; g.fillRect(0, 0, w, h);
    const wrap = (fn) => { for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) fn(ox, oy); };
    for (let i = 0; i < 260; i++) {                       // soft colour patches (tile seamlessly)
      const x = rand() * w, y = rand() * h, r = 20 + rand() * 110;
      const grd = g.createRadialGradient(0, 0, 0, 0, 0, r);
      grd.addColorStop(0, GROUND.tones[i % GROUND.tones.length]); grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = 0.35;
      wrap((ox, oy) => { g.save(); g.translate(x + ox, y + oy); g.fillStyle = grd; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill(); g.restore(); });
    }
    g.globalAlpha = 1;
    for (let i = 0; i < 1800; i++) {                      // bare soil specks
      g.fillStyle = GROUND.soil; g.fillRect(rand() * w, rand() * h, 2 + rand() * 3, 2 + rand() * 3);
    }
    if (blades) {
      g.lineCap = 'round';
      for (let i = 0; i < 70000; i++) {                   // individual grass blades
        const x = rand() * w, y = rand() * h, len = 3 + rand() * 7, a = -Math.PI / 2 + (rand() - 0.5) * 0.9;
        g.strokeStyle = GROUND.blades[Math.floor(rand() * GROUND.blades.length)];
        g.globalAlpha = 0.35 + rand() * 0.5;
        g.lineWidth = 0.8 + rand() * 1.2;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke();
      }
      g.globalAlpha = 1;
    } else {
      speckle(g, w, h, 'rgba(0,0,0,0)', 0.25, 90000, 2);
    }
  });
  groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;

  // Terrain: follows the track's elevation near the circuit, eases to a base level further out,
  // and drops below sea level under water.
  const hilly = T.g.some(v => v > 0.5);
  const baseH = hilly && !theme.water ? T.g.reduce((a, b) => a + b, 0) / T.n : 0;
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const MARGIN = 1100, L = radius * 2 + MARGIN * 2, M = Math.min(400, Math.ceil(L / 12)), step = L / M;
  const gx0 = cx0 - L / 2, gz0 = cz0 - L / 2;
  const H = new Float32Array((M + 1) * (M + 1));
  if (hilly) {
    const B = 60, buckets = new Map(), bk = (a, b) => a * 100003 + b;
    for (let i = 0; i < T.n; i += 3) {
      const k = bk(Math.floor(T.x[i] / B), Math.floor(T.z[i] / B));
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(i);
    }
    const RB = 4;   // search radius in buckets (240 m)
    for (let r = 0; r <= M; r++) for (let c = 0; c <= M; c++) {
      const x = gx0 + c * step, z = gz0 + r * step;
      const bx = Math.floor(x / B), bz = Math.floor(z / B);
      let ws = 0, hs = 0, d2min = Infinity, near = -1;
      for (let dx = -RB; dx <= RB; dx++) for (let dz = -RB; dz <= RB; dz++) {
        const a = buckets.get(bk(bx + dx, bz + dz));
        if (!a) continue;
        for (const i of a) {
          const d2 = (T.x[i] - x) ** 2 + (T.z[i] - z) ** 2;
          const w = 1 / (d2 + 400);
          ws += w; hs += w * T.g[i];
          if (d2 < d2min) { d2min = d2; near = i; }
        }
      }
      let h = baseH;
      if (near >= 0) {
        // Exact ground height at the nearest point of the track (refine between samples).
        let best = near, bd = d2min;
        for (let o = -3; o <= 3; o++) {
          const j = (near + o + T.n) % T.n, d2 = (T.x[j] - x) ** 2 + (T.z[j] - z) ** 2;
          if (d2 < bd) { bd = d2; best = j; }
        }
        const dmin = Math.sqrt(bd);
        h = hs / ws;
        const t = smooth(T.hw + 14, T.hw + 70, dmin);
        h = T.g[best] * (1 - t) + h * t;
        h = h * (1 - smooth(200, 900, dmin)) + baseH * smooth(200, 900, dmin);
        if (dmin < T.hw + 26) h -= 0.06;
      }
      if (isWater(x, z)) h = Math.min(h, -4);
      H[r * (M + 1) + c] = h;
    }
  } else if (theme.water) {
    for (let r = 0; r <= M; r++) for (let c = 0; c <= M; c++) {
      if (isWater(gx0 + c * step, gz0 + r * step)) H[r * (M + 1) + c] = -4;
    }
  }
  // Height of the terrain mesh at (x, z), interpolated on the same two triangles per grid cell
  // that the mesh is drawn with, so things placed on it (including the car) sit exactly on it.
  const groundAt = (x, z) => {
    const fc = (x - gx0) / step, fr = (z - gz0) / step;
    if (fc < 0 || fr < 0 || fc >= M || fr >= M) return baseH;
    const c = Math.floor(fc), r = Math.floor(fr), u = fc - c, v = fr - r, k = r * (M + 1) + c;
    const h00 = H[k], h10 = H[k + 1], h01 = H[k + M + 1], h11 = H[k + M + 2];
    return u + v <= 1
      ? h00 + (h10 - h00) * u + (h01 - h00) * v
      : h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
  };
  // The grid is coarser than the road, so in dips a flat triangle can bulge up through the asphalt
  // (and gravel traps). Probe across the road and sink any triangle that would cover it - only by
  // as much as needed, so the verges don't turn into trenches.
  const CLEAR = 0.12;
  const sinkAt = (x, z, y) => {
    const fc = (x - gx0) / step, fr = (z - gz0) / step;
    if (fc < 0 || fr < 0 || fc >= M || fr >= M) return;
    const e = groundAt(x, z) - (y - CLEAR);
    if (e <= 0) return;
    const c = Math.floor(fc), r = Math.floor(fr), k = r * (M + 1) + c;
    const tri = fc - c + fr - r <= 1 ? [k, k + 1, k + M + 1] : [k + M + 2, k + M + 1, k + 1];
    for (const v of tri) H[v] -= e;
  };
  for (let i = 0; i < T.n; i++) {
    const j = (i + 1) % T.n, gv = !T.def.walls && T.gravel[i];
    const left = gv === 1 ? T.hw + 23 : T.hw + 2.5, right = gv === -1 ? T.hw + 23 : T.hw + 2.5;
    for (const f of [0, 0.5]) {
      const x = T.x[i] + (T.x[j] - T.x[i]) * f, z = T.z[i] + (T.z[j] - T.z[i]) * f;
      const y = T.g[i] + (T.g[j] - T.g[i]) * f;
      for (let o = -right; o <= left; o += 2) sinkAt(x + T.nx[i] * o, z + T.nz[i] * o, y);
    }
  }
  T.groundAt = groundAt;
  T.waterLevel = theme.water ? 0.04 : -Infinity;   // water surface, so the car doesn't sink to the seabed

  const tgeo = new THREE.PlaneGeometry(L, L, M, M).rotateX(-Math.PI / 2);
  const tp = tgeo.attributes.position, tcol = [];
  const ph = rand() * 10;
  for (let k = 0; k < tp.count; k++) {
    tp.setY(k, H[k]);
    // Large-scale colour variation so the ground texture doesn't look tiled.
    const x = tp.getX(k), z = tp.getZ(k);
    const n = 0.5 + 0.25 * Math.sin(x * 0.011 + ph) * Math.sin(z * 0.013 - ph) + 0.25 * Math.sin(x * 0.037 + z * 0.029 + ph * 2);
    const f = 0.86 + n * 0.22;
    tcol.push(f, f * (blades ? 1.02 : 1), f * 0.96);
  }
  tgeo.translate(cx0, 0, cz0);
  tgeo.setAttribute('color', new THREE.Float32BufferAttribute(tcol, 3));
  tgeo.computeVertexNormals();
  const tTex = groundTex.clone(); tTex.needsUpdate = true;
  tTex.repeat.set(L / 11, L / 11);
  const terrainMat = new THREE.MeshLambertMaterial({ map: tTex, vertexColors: true, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 });
  group.add(new THREE.Mesh(tgeo, terrainMat));
  const groundMats = [terrainMat];   // ground surfaces, so snow can cover them
  // Far ground beyond the terrain patch: a frame round it, not one big plane - at the average
  // height it would otherwise slice through the low parts of a hilly circuit. The patch is already
  // at baseH along its edges, so the frame tucks just under them.
  const S = radius * 2 + 18000, IN = L / 2 - 60, OUT = S / 2;
  const farMat = new THREE.MeshLambertMaterial({ map: groundTex.clone() });
  farMat.map.needsUpdate = true; farMat.map.repeat.set(1 / 40, 1 / 40);
  groundMats.push(farMat);
  for (const [w, d, ox, oz] of [[2 * OUT, OUT - IN, 0, (OUT + IN) / 2], [2 * OUT, OUT - IN, 0, -(OUT + IN) / 2],
    [OUT - IN, 2 * IN, (OUT + IN) / 2, 0], [OUT - IN, 2 * IN, -(OUT + IN) / 2, 0]]) {
    const geo = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2);
    const uv = geo.attributes.uv, p = geo.attributes.position;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, p.getX(k) + ox, p.getZ(k) + oz);   // world-scaled UVs so strips line up
    const far = new THREE.Mesh(geo, farMat);
    far.position.set(cx0 + ox, baseH - 0.4, cz0 + oz);
    group.add(far);
  }

  // Mowing stripes in the grass run-off of permanent circuits.
  if (blades && !walled && !theme.runoff) {
    const stripes = canvasTex(8, 64, (g, w, h) => {
      g.fillStyle = 'rgba(255,255,170,0.10)'; g.fillRect(0, 0, w, h / 2);
      g.fillStyle = 'rgba(0,30,0,0.10)'; g.fillRect(0, h / 2, w, h / 2);
    });
    stripes.wrapS = stripes.wrapT = THREE.RepeatWrapping;
    const mat = new THREE.MeshBasicMaterial({ map: stripes, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    group.add(new THREE.Mesh(ribbon(T.hw + 25, T.hw + 1.4, 0.0, 12, null), mat));
    group.add(new THREE.Mesh(ribbon(-T.hw - 1.4, -T.hw - 25, 0.0, 12, null), mat));
  }

  // Wide run-off around the track (tarmac in the desert / city, grass verge at Yas Marina).
  if (theme.runoff && !walled) {
    const col = theme.runoff === 'grass' ? '#4f9638' : '#6d6f73';
    const tex = canvasTex(64, 64, (g, w, h) => speckle(g, w, h, col, 0.15, 1500, 2));
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    const mat = new THREE.MeshLambertMaterial({ map: tex, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    group.add(new THREE.Mesh(ribbon(T.hw + 24, -T.hw - 24, 0.015, 12, null), mat));
    if (theme.runoff === 'grass') groundMats.push(mat);
  }

  // ---------- Sky ----------
  const skyGeo = new THREE.SphereGeometry(9000, 32, 16);
  const top = new THREE.Color(env.top), hor = new THREE.Color(env.horizon), col = [];
  const p = skyGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = Math.max(0, p.getY(i) / 9000);
    const c = hor.clone().lerp(top, Math.pow(t, 0.55));
    col.push(c.r, c.g, c.b);
  }
  skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.renderOrder = -1;
  if (env.stars) {
    const sp = [];
    for (let i = 0; i < 900; i++) {
      const a = rand() * Math.PI * 2, e = Math.asin(rand() * 0.95 + 0.05);
      sp.push(Math.cos(a) * Math.cos(e) * 8500, Math.sin(e) * 8500, Math.sin(a) * Math.cos(e) * 8500);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    sky.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false })));
  }

  // ---------- Helpers ----------
  const dummy = new THREE.Object3D();
  const instanced = (geo, mat, list, colors) => {
    if (!list.length) return null;
    const m = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((t, i) => {
      dummy.position.set(t.x, t.y !== undefined ? t.y : groundAt(t.x, t.z) + (t.dy || 0), t.z);
      dummy.rotation.set(0, t.ry || 0, 0);
      dummy.scale.set(t.sx || t.s || 1, t.sy || t.s || 1, t.sz || t.s || 1);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      if (colors) m.setColorAt(i, colors[i]);
    });
    group.add(m);
    return m;
  };
  const free = (x, z, clear) => !isWater(x, z) && idx.nearest(x, z, clear + 5) >= clear;
  // Find a clear spot near a point in the bounding box (spiral outwards).
  const placeAt = (u, v, clear) => {
    const bx = minX + u * (maxX - minX), bz = minZ + v * (maxZ - minZ);
    for (let r = 0; r < 1500; r += 25) {
      for (let a = 0; a < Math.PI * 2; a += r ? 25 / r : 7) {
        const x = bx + Math.cos(a) * r, z = bz + Math.sin(a) * r;
        if (idx.nearest(x, z, clear + 5) >= clear && !isWater(x, z)) return [x, z];
      }
    }
    return [bx, bz];
  };
  const trackPoint = (i, side, off) => [T.x[i] + T.nx[i] * side * off, T.z[i] + T.nz[i] * side * off];
  // A whole rectangular footprint (centre x/z, heading ry, half-sizes hx across and hz along) is at
  // least `clear` from the track and out of the water - checking only the centre lets long stands
  // and buildings beside a bend poke onto the road.
  const footprintClear = (x, z, ry, hx, hz, clear) => {
    const c = Math.cos(ry), s = Math.sin(ry);
    const nx = Math.max(1, Math.ceil(hx / 6)), nz = Math.max(1, Math.ceil(hz / 6));
    for (let a = -nx; a <= nx; a++) for (let b = -nz; b <= nz; b++) {
      if (Math.abs(a) !== nx && Math.abs(b) !== nz) continue;    // perimeter only
      const lx = a / nx * hx, lz = b / nz * hz;
      const px = x + lx * c + lz * s, pz = z - lx * s + lz * c;
      if (isWater(px, pz) || idx.nearest(px, pz, clear + 5) < clear) return false;
    }
    return true;
  };
  // Footprints of stands, garages and buildings already placed, so they don't intersect each other.
  const OCC = 60, occ = new Map(), okey = (a, b) => a * 100003 + b;
  const obb = (x, z, ry, hx, hz) => ({ x, z, hx, hz, c: Math.cos(ry), s: Math.sin(ry), r: Math.hypot(hx, hz) });
  const obbHit = (A, B) => {
    if (Math.hypot(A.x - B.x, A.z - B.z) > A.r + B.r) return false;
    // Separating axis test on the two boxes' local axes.
    for (const [ax, az] of [[A.c, -A.s], [A.s, A.c], [B.c, -B.s], [B.s, B.c]]) {
      const proj = O => Math.abs((O.c * ax - O.s * az) * O.hx) + Math.abs((O.s * ax + O.c * az) * O.hz);
      if (Math.abs((B.x - A.x) * ax + (B.z - A.z) * az) > proj(A) + proj(B)) return false;
    }
    return true;
  };
  const occupied = (o) => {
    const cx = Math.floor(o.x / OCC), cz = Math.floor(o.z / OCC), R = Math.ceil((o.r + 40) / OCC);
    for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) {
      for (const p of occ.get(okey(cx + dx, cz + dz)) || []) if (obbHit(o, p)) return true;
    }
    return false;
  };
  const occupy = (o) => {
    const k = okey(Math.floor(o.x / OCC), Math.floor(o.z / OCC));
    if (!occ.has(k)) occ.set(k, []);
    occ.get(k).push(o);
  };

  // Window textures for buildings (lit at night).
  const winTex = canvasTex(64, 128, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(40,50,70,0.55)';
    for (let y = 6; y < h; y += 12) for (let x = 4; x < w; x += 10) g.fillRect(x, y, 6, 7);
  });
  const litTex = canvasTex(64, 128, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    for (let y = 6; y < h; y += 12) for (let x = 4; x < w; x += 10) {
      if (rand() < 0.55) { g.fillStyle = rand() < 0.8 ? '#ffd58a' : '#bfe3ff'; g.fillRect(x, y, 6, 7); }
    }
  });
  const buildingMat = () => new THREE.MeshLambertMaterial({
    map: winTex, emissive: night || dusk ? 0xffffff : 0x000000, emissiveMap: night || dusk ? litTex : null,
    emissiveIntensity: night ? 0.9 : 0.35,
  });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const PALETTES = {
    monaco: [0xf2dcc0, 0xe8c9a2, 0xf5e9d6, 0xe6b98f, 0xf0d6c8, 0xd9c2a7],
    glass:  [0x8fa6bf, 0x6f879f, 0xa8bcd0, 0x5d7189, 0xc9d3dd],
    vegas:  [0xe9e2d4, 0xc8b38a, 0x9fb0c4, 0xd9c7a6, 0x7c8ea6, 0xf2efe8],
    baku:   [0xd8c29a, 0xcdb48a, 0xe2d2b4, 0xbfa880],
    miami:  [0xf2f2f2, 0xe8ecef, 0xd6e4ec, 0xf5e6d3],
    ifema:  [0xe9e9e9, 0xcfd4d8, 0xb8c0c8],
    city:   [0xb9bdc2, 0x9aa3ad, 0xd3d0c8, 0x8d97a3, 0xc7c2b8],
  };

  // ---------- Distant skyline ----------
  if (theme.skyline) {
    const s = theme.skyline, list = [], cols = [];
    const dirAng = { N: -Math.PI / 2, S: Math.PI / 2, E: 0, W: Math.PI }[s.dir];
    for (let k = 0; k < s.count * 3 && list.length < s.count; k++) {
      const a = s.dir === 'all' ? rand() * Math.PI * 2 : dirAng + rr(-0.5, 0.5);
      const r = radius + s.dist + rr(0, 700);
      const x = cx0 + Math.cos(a) * r, z = cz0 + Math.sin(a) * r;
      if (!free(x, z, 120)) continue;
      const w = rr(20, 45);
      list.push({ x, z, ry: rand() * Math.PI, sx: w, sy: rr(s.minH, s.maxH), sz: w * rr(0.7, 1.3) });
      cols.push(new THREE.Color(PALETTES.city[Math.floor(rand() * PALETTES.city.length)]));
    }
    instanced(boxGeo, buildingMat(), list, cols);
  }

  // ---------- Hills / mountains ----------
  if (theme.hills) {
    const hl = theme.hills, SEG = 120, rows = [0, 500, 1400, 3200];
    const r0 = radius + hl.dist;
    const dirAng = hl.dir ? { N: -Math.PI / 2, S: Math.PI / 2, E: 0, W: Math.PI }[hl.dir] : null;
    const pos = [], colr = [], ind = [];
    const n1 = rand() * 10, n2 = rand() * 10;
    for (let s = 0; s <= SEG; s++) {
      const a = s / SEG * Math.PI * 2;
      let dirF = 1;
      if (dirAng !== null) dirF = Math.max(0.03, Math.cos(a - dirAng)) ** 1.5;
      const noise = 0.55 + 0.25 * Math.sin(a * 3 + n1) + 0.2 * Math.sin(a * 7 + n2);
      rows.forEach((dr, ri) => {
        const r = r0 + dr;
        const h = ri === 0 ? 0 : hl.h * noise * dirF * [0, 0.45, 1, 0.8][ri] * (0.85 + 0.3 * Math.sin(a * 13 + ri));
        pos.push(cx0 + Math.cos(a) * r, baseH - 0.5 + h, cz0 + Math.sin(a) * r);
        const c = new THREE.Color(theme.ground === 'dry' ? 0x7d8a4a : 0x3d6b2c);
        if (h > 650) c.lerp(new THREE.Color(0xf4f6f8), Math.min(1, (h - 650) / 250));
        else if (h > 350) c.lerp(new THREE.Color(0x77736a), (h - 350) / 600);
        colr.push(c.r, c.g, c.b);
      });
    }
    const R = rows.length;
    for (let s = 0; s < SEG; s++) for (let ri = 0; ri < R - 1; ri++) {
      const a = s * R + ri, b = (s + 1) * R + ri;
      ind.push(a, a + 1, b, b, a + 1, b + 1);
    }
    const hg = new THREE.BufferGeometry();
    hg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    hg.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
    hg.setIndex(ind);
    hg.computeVertexNormals();
    group.add(new THREE.Mesh(hg, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide })));
  }

  // ---------- Trees ----------
  // Merge non-indexed geometries (position, normal, color) into one.
  const mergeGeo = list => {
    const parts = list.map(g => (g.index ? g.toNonIndexed() : g));
    const out = new THREE.BufferGeometry();
    for (const name of ['position', 'normal', 'color']) {
      const arr = new Float32Array(parts.reduce((n, g) => n + g.attributes[name].array.length, 0));
      let off = 0;
      for (const g of parts) { arr.set(g.attributes[name].array, off); off += g.attributes[name].array.length; }
      out.setAttribute(name, new THREE.BufferAttribute(arr, 3));
    }
    return out;
  };
  // Colour a geometry with a vertical gradient (darker low / inside, lighter on top) plus noise,
  // and push its vertices around a little so crowns look organic.
  const shade = (geo, lo, hi, y0, y1, jitter = 0) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const p = g.attributes.position, c = [], A = new THREE.Color(lo), Bc = new THREE.Color(hi), tmp = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      if (jitter) {
        const k = 1 + (Math.sin(p.getX(i) * 7.1 + p.getY(i) * 3.3) * 0.5 + Math.sin(p.getZ(i) * 5.7) * 0.5) * jitter;
        p.setXYZ(i, p.getX(i) * k, p.getY(i), p.getZ(i) * k);
      }
      const t = Math.min(1, Math.max(0, (p.getY(i) - y0) / (y1 - y0)));
      tmp.copy(A).lerp(Bc, t);
      const n = 0.9 + 0.2 * rand();
      c.push(tmp.r * n, tmp.g * n, tmp.b * n);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    g.computeVertexNormals();
    return g;
  };
  const bark = 0x5a4232, barkLight = 0x7a5c44;
  function treeVariant(kind) {
    const parts = [];
    if (kind === 'pine') {
      const hgt = rr(11, 16);
      parts.push(shade(new THREE.CylinderGeometry(0.14, 0.32, hgt * 0.45, 6).translate(0, hgt * 0.22, 0), bark, barkLight, 0, 5));
      const tiers = 5;
      for (let t = 0; t < tiers; t++) {
        const y = hgt * (0.25 + t * 0.15), r = 2.9 * (1 - t / (tiers + 0.6)), hh = hgt * 0.3;
        parts.push(shade(new THREE.ConeGeometry(r, hh, 9, 2).translate(rr(-0.1, 0.1), y + hh / 2, rr(-0.1, 0.1)),
          0x173d1c, 0x3b6e35, y, y + hh, 0.12));
      }
    } else if (kind === 'palm') {
      const hgt = rr(8, 12), lean = rr(0.4, 1.4), segs = 6;
      for (let k = 0; k < segs; k++) {   // gently curving trunk
        const y0 = hgt * k / segs, y1 = hgt * (k + 1) / segs;
        const x0 = lean * (k / segs) ** 2, x1 = lean * ((k + 1) / segs) ** 2;
        const seg = new THREE.CylinderGeometry(0.2 - k * 0.012, 0.23 - k * 0.012, y1 - y0 + 0.05, 7);
        seg.rotateZ(-Math.atan2(x1 - x0, y1 - y0)).translate((x0 + x1) / 2, (y0 + y1) / 2, 0);
        parts.push(shade(seg, 0x6e5a40, 0x9a8462, 0, hgt));
      }
      const fronds = 11;
      for (let f = 0; f < fronds; f++) {    // drooping fronds made of tapering strips
        const a = f / fronds * Math.PI * 2 + rr(-0.2, 0.2), len = rr(3.6, 4.8), up = rr(0.4, 0.9);
        const pos = [], N = 6;
        for (let k = 0; k <= N; k++) {
          const t = k / N, w = 0.55 * Math.sin(Math.PI * Math.min(1, t * 1.15)) + 0.05;
          const d = t * len, y = up * t * 2 - 1.9 * t * t;
          for (const sd of [-1, 1]) pos.push(d, y, sd * w);
        }
        const tri = [];
        for (let k = 0; k < N; k++) {
          const i = k * 2;
          tri.push(...[i, i + 1, i + 2, i + 1, i + 3, i + 2].flatMap(j => pos.slice(j * 3, j * 3 + 3)));
        }
        const fg = new THREE.BufferGeometry();
        fg.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3));
        fg.rotateY(a).translate(lean, hgt, 0);
        parts.push(shade(fg, 0x2f5a22, 0x6c9c3c, hgt - 2, hgt + 1));
      }
      parts.push(shade(new THREE.IcosahedronGeometry(0.35, 0).translate(lean, hgt - 0.2, 0), 0x5b4a2a, 0x8b6f3a, hgt - 1, hgt));
    } else {   // broadleaf: several overlapping leafy clumps
      const hgt = rr(7, 11);
      parts.push(shade(new THREE.CylinderGeometry(0.18, 0.38, hgt * 0.55, 7).translate(0, hgt * 0.27, 0), bark, barkLight, 0, hgt * 0.5));
      parts.push(shade(new THREE.CylinderGeometry(0.06, 0.12, 2.2, 5).rotateZ(0.8).translate(0.7, hgt * 0.5, 0), bark, barkLight, 0, hgt));
      parts.push(shade(new THREE.CylinderGeometry(0.06, 0.12, 2.0, 5).rotateZ(-0.7).translate(-0.6, hgt * 0.47, 0.2), bark, barkLight, 0, hgt));
      const clumps = 6 + Math.floor(rand() * 4);
      for (let k = 0; k < clumps; k++) {
        const a = rand() * Math.PI * 2, rad = rr(0.4, 2.0), r = rr(1.6, 2.7);
        const y = hgt * rr(0.62, 0.95);
        parts.push(shade(new THREE.IcosahedronGeometry(r, 1).scale(1, 0.85, 1)
          .translate(Math.cos(a) * rad, y, Math.sin(a) * rad), 0x234d1a, 0x5f9a3a, hgt * 0.45, hgt * 1.15, 0.18));
      }
    }
    return mergeGeo(parts);
  }

  if (theme.trees) {
    const tr = theme.trees, VARIANTS = 4;
    const lists = Array.from({ length: VARIANTS }, () => []), cols = Array.from({ length: VARIANTS }, () => []);
    const shadows = [];
    const reach = Math.max(500, radius * 0.9);
    const ph1 = rand() * 6, ph2 = rand() * 6;
    let placed = 0;
    for (let k = 0; k < tr.count * 8 && placed < tr.count; k++) {
      const x = cx0 + rr(-radius - reach, radius + reach), z = cz0 + rr(-radius - reach, radius + reach);
      const patch = Math.sin(x * 0.006 + ph1) * Math.sin(z * 0.007 + ph2);   // forests grow in clumps
      if (patch < -0.15 && tr.kind !== 'palm') continue;
      if (!free(x, z, clearOf)) continue;
      if (idx.nearest(x, z, reach) > reach) continue;
      const v = placed % VARIANTS, s = rr(0.75, 1.3);
      lists[v].push({ x, z, ry: rand() * 6.28, s });
      cols[v].push(new THREE.Color(1, 1, 1).multiplyScalar(rr(0.85, 1.12)).offsetHSL(rr(-0.02, 0.02), 0, 0));
      shadows.push({ x, z, dy: 0.08, ry: rand() * 6.28, s: s * (tr.kind === 'pine' ? 5.5 : 7) });
      placed++;
    }
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: tr.kind === 'palm' ? THREE.DoubleSide : THREE.FrontSide });
    for (let v = 0; v < VARIANTS; v++) instanced(treeVariant(tr.kind), mat, lists[v], cols[v]);
    // Soft contact shadows under the trees
    const shTex = canvasTex(64, 64, (g, w, h) => {
      const grd = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
      grd.addColorStop(0, 'rgba(0,20,0,0.45)'); grd.addColorStop(1, 'rgba(0,20,0,0)');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
    });
    instanced(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false }), shadows);
  }

  // ---------- Dunes (Zandvoort) ----------
  if (theme.dunes) {
    const list = [], cols = [];
    for (let k = 0; k < theme.dunes * 6 && list.length < theme.dunes; k++) {
      const x = cx0 + rr(-radius * 1.6, radius * 1.6), z = cz0 + rr(-radius * 1.6, radius * 1.6);
      const s = rr(25, 60);
      if (!free(x, z, clearOf + s)) continue;
      list.push({ x, z, ry: rand() * 6.28, sx: s, sy: rr(6, 16), sz: s * rr(0.5, 1) });
      cols.push(new THREE.Color(rand() < 0.5 ? 0xc9bd86 : 0x8ea255));
    }
    instanced(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: 0xffffff }), list, cols);
  }

  // ---------- Boats (harbours / marinas) ----------
  // Motor yachts: a hull with a pointed bow, teak deck and two decks of superstructure with dark
  // window bands, a few proportions, built 30 m long and scaled to size.
  if (theme.boats) {
    const paint = (geo, color) => {
      const g = geo.index ? geo.toNonIndexed() : geo, c = new THREE.Color(color), cols = [];
      for (let i = 0; i < g.attributes.position.count; i++) cols.push(c.r, c.g, c.b);
      g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      g.deleteAttribute('uv');
      g.computeVertexNormals();
      return g;
    };
    // Plan view: square stern at z0, straight sides, curving in to a point at the bow (+z).
    const plan = (beam, z0, z1, bow) => {
      const s = new THREE.Shape(), b = beam / 2;
      s.moveTo(-b, -z0); s.lineTo(b, -z0); s.lineTo(b, -(z1 - bow));
      s.quadraticCurveTo(b, -z1, 0, -z1); s.quadraticCurveTo(-b, -z1, -b, -(z1 - bow)); s.lineTo(-b, -z0);
      return s;
    };
    // Extrude a plan upwards from y0 by h (shape y is -z after the rotation).
    const slab = (shape, y0, h, color) => paint(new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false })
      .rotateX(-Math.PI / 2).translate(0, y0, 0), color);
    const yacht = (beam, hullCol, tiers) => {
      const parts = [
        slab(plan(beam, -15, 15, 11), -0.8, 3, hullCol),                       // hull
        slab(plan(beam * 1.01, -15.05, 15.05, 11), 0.15, 0.35, 0x1f3550),     // boot stripe at the waterline
        slab(plan(beam * 0.94, -14.6, 14.4, 10.5), 2.2, 0.12, 0xb08a5a),      // teak deck
      ];
      tiers.forEach(([w, z0, z1, h], k) => {
        const y = 2.32 + tiers.slice(0, k).reduce((a, t) => a + t[3], 0);
        parts.push(slab(plan(beam * w, z0, z1, 3), y, h, 0xf7f7f5));
        parts.push(slab(plan(beam * w * 1.02, z0 - 0.05, z1 + 0.08, 3), y + h * 0.35, h * 0.4, 0x1c2632));   // windows
      });
      const top = 2.32 + tiers.reduce((a, t) => a + t[3], 0);
      parts.push(paint(new THREE.BoxGeometry(0.3, 2.4, 0.3).translate(0, top + 1.2, -3), 0xdedede));   // mast
      parts.push(paint(new THREE.BoxGeometry(beam * 0.4, 0.25, 1.2).translate(0, top + 1.6, -3), 0xdedede));   // radar arch
      return mergeGeo(parts);
    };
    const VARIANTS = [
      yacht(6.4, 0xfafafa, [[0.78, -11, 7, 2.4], [0.6, -7, 3, 2]]),
      yacht(6, 0x1d2f4a, [[0.8, -10, 6, 2.3], [0.62, -6, 2, 1.9], [0.45, -4, 0, 1.6]]),   // dark-hulled superyacht
      yacht(5.6, 0xf2f2ee, [[0.75, -9, 5, 2.2]]),
    ];
    const lists = VARIANTS.map(() => []);
    for (let k = 0, placed = 0; k < theme.boats * 40 && placed < theme.boats; k++) {
      const x = cx0 + rr(-radius - 400, radius + 400), z = cz0 + rr(-radius - 400, radius + 400);
      if (!isWater(x, z) || idx.nearest(x, z, 400) > 350) continue;
      const L = rr(16, 55), s = L / 30, ry = rand() * Math.PI * 2;
      const fp = obb(x, z, ry, 3.5 * s + 2, L / 2 + 3);
      // The whole boat in the water, off the quay and clear of the other boats.
      let wet = true;
      for (const [a, b] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const lx = a * fp.hx, lz = b * fp.hz;
        if (!isWater(x + lx * fp.c + lz * fp.s, z - lx * fp.s + lz * fp.c)) wet = false;
      }
      if (!wet || idx.nearest(x, z, 60) < 30 + L / 2 || occupied(fp)) continue;
      occupy(fp);
      lists[placed++ % VARIANTS.length].push({ x, z, y: 0, ry, s });
    }
    const mat = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 70, specular: 0x666666 });
    VARIANTS.forEach((g, v) => instanced(g, mat, lists[v]));
  }

  // ---------- Grandstands ----------
  // Home-crowd shirt colours (local favourites), mixed with a general crowd.
  const HOME = {
    monza: ['#c8102e', '#c8102e', '#e8102a', '#ffd400'], silverstone: ['#ff8000', '#1e3a8a', '#ffffff', '#ff8000'],
    zandvoort: ['#ff6a00', '#ff6a00', '#ff8000', '#ff6a00'], redbullring: ['#ff6a00', '#1b2a5c', '#ff6a00'],
    spa: ['#ff6a00', '#ffd400', '#ff6a00'], mexico: ['#1fa34a', '#ffffff', '#d81e2c', '#1b2a5c'],
    interlagos: ['#1fa34a', '#ffd400', '#1fa34a'], albertpark: ['#ff8000', '#ffd400', '#1fa34a'],
    madrid: ['#d81e2c', '#ffd400', '#1fa34a'], barcelona: ['#d81e2c', '#ffd400', '#1fa34a'],
    suzuka: ['#ff8000', '#d81e2c', '#ffffff', '#1b2a5c'], cota: ['#ff8000', '#c8102e', '#1e3a8a'],
  }[T.def.id] || [];
  const SHIRTS = HOME.concat(['#e63946', '#f1faee', '#ffb703', '#219ebc', '#ff8000', '#2a9d8f', '#1d1d1d', '#e5e5e5', '#d62828', '#6c757d', '#3a86ff']);
  const SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];
  // One texture = one row of 32 seats (people sitting, seat backs, some empty seats).
  const crowdTex = canvasTex(1024, 64, (g, w, h) => {
    const seat = rand() < 0.5 ? '#2f5d9c' : '#b33a3a';
    g.fillStyle = '#4a4f57'; g.fillRect(0, 0, w, h);
    const sw = w / 32;
    for (let k = 0; k < 32; k++) {
      const x = k * sw;
      g.fillStyle = seat; g.fillRect(x + 2, h * 0.45, sw - 4, h * 0.5);            // seat back
      if (rand() < 0.92) {                                                          // spectator
        g.fillStyle = SHIRTS[Math.floor(rand() * SHIRTS.length)];
        g.fillRect(x + sw * 0.12, h * 0.36, sw * 0.76, h * 0.64);                   // torso
        g.fillStyle = SKIN[Math.floor(rand() * SKIN.length)];
        g.beginPath(); g.arc(x + sw / 2, h * 0.24, sw * 0.24, 0, Math.PI * 2); g.fill();   // head
        if (rand() < 0.25) { g.fillStyle = rand() < 0.5 ? '#111' : SHIRTS[0] || '#c8102e'; g.fillRect(x + sw * 0.25, h * 0.05, sw * 0.5, h * 0.12); }  // cap
        if (rand() < 0.08) { g.fillStyle = SHIRTS[Math.floor(rand() * SHIRTS.length)]; g.fillRect(x + sw * 0.7, 0, sw * 0.8, h * 0.3); }   // waving flag
      }
    }
  });
  crowdTex.wrapS = THREE.RepeatWrapping;
  const crowdMat = new THREE.MeshLambertMaterial({ map: crowdTex, side: THREE.DoubleSide, emissive: 0x333333, emissiveMap: crowdTex });
  const concreteMat = new THREE.MeshLambertMaterial({ color: 0xb7b2a8, side: THREE.DoubleSide });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0xe8eaed, side: THREE.DoubleSide });
  const steelMat = new THREE.MeshLambertMaterial({ color: 0x9aa0a6, side: THREE.DoubleSide });
  const fasciaMat = new THREE.MeshLambertMaterial({ color: 0xe10600, side: THREE.DoubleSide });
  const adTex = canvasTex(1024, 64, (g, w, h) => {
    const boards = [['#e10600', '#ffffff', 'FORMULA 1'], ['#111111', '#ffffff', T.def.name.toUpperCase()], ['#ffffff', '#111111', String(T.def.country).toUpperCase()],
      ['#1e3a8a', '#ffffff', '2026'], ['#ffd400', '#111111', 'ROUND ' + T.def.round]];
    const bw = w / 5;
    boards.forEach(([bg, fg, txt], k) => {
      g.fillStyle = bg; g.fillRect(k * bw, 0, bw, h);
      g.fillStyle = fg; g.font = '900 30px Segoe UI, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(txt, k * bw + bw / 2, h / 2 + 2, bw - 16);
    });
  });
  adTex.wrapS = THREE.RepeatWrapping;
  const adMat = new THREE.MeshLambertMaterial({ map: adTex, side: THREE.DoubleSide, emissive: night ? 0x444444 : 0, emissiveMap: night ? adTex : null });

  // Quad helper for custom geometry (four corners, uv rect).
  const quads = () => ({ pos: [], uv: [], idx: [] });
  const quad = (Q, a, b, c, d, u0 = 0, v0 = 0, u1 = 1, v1 = 1) => {
    const n = Q.pos.length / 3;
    Q.pos.push(...a, ...b, ...c, ...d);
    Q.uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
    Q.idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
  };
  const quadGeo = Q => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(Q.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(Q.uv, 2));
    g.setIndex(Q.idx);
    g.computeVertexNormals();
    return g;
  };

  // A grandstand in local space: x = away from the track, y = up, z = along the track.
  let standNo = 0;
  const barrier = walled ? T.hw + T.def.walls.offset : T.hw + 26;   // barrier line (tyre wall at the edge of run-off)
  function stand(i, side, off, len = 46, depth = 16, height = 12, roof = true) {
    const [x, z] = trackPoint(i, side, off);
    // Along its whole length the stand must sit behind the barrier (the roof may overhang the
    // barrier, never the track), clear of other stands and buildings.
    const roofFront = roof ? -3.5 : 0, mid = (roofFront + depth + 1.5) / 2, gmid = (depth + 1.5) / 2;
    const at = m => [x + T.nx[i] * side * m, z + T.nz[i] * side * m];
    const [gx, gz] = at(gmid), [rx, rz] = at(roofFront);
    if (!footprintClear(gx, gz, T.hd[i], gmid, len / 2 + 0.5, barrier + 0.3)) return;
    if (roof && !footprintClear(rx, rz, T.hd[i], 0, len / 2 + 0.5, T.hw + 1.5)) return;
    const fp = obb(...at(mid), T.hd[i], (depth + 1.5 - roofFront) / 2, len / 2 + 0.5);
    if (occupied(fp)) return;
    occupy(fp);
    const s = new THREE.Group();
    s.position.set(x, T.y[i], z);
    s.rotation.y = T.hd[i];
    s.scale.x = side;
    const front = 1.3, rows = Math.max(6, Math.round(height / 0.75)), rise = (height - front) / rows, tread = depth / rows;
    const z0 = -len / 2, z1 = len / 2, seatsU = len / (0.55 * 32);
    const people = quads(), steps = quads();
    for (let r = 0; r < rows; r++) {
      const xa = r * tread, ya = front + r * rise;
      // Spectators sit on each step; the row of people faces the track and leans back a little.
      quad(people, [xa + 0.1, ya, z1], [xa + 0.1, ya, z0], [xa + 0.28, ya + rise + 0.8, z0], [xa + 0.28, ya + rise + 0.8, z1], 0, 0, seatsU, 1);
      quad(steps, [xa, ya + rise, z1], [xa, ya + rise, z0], [xa + tread, ya + rise, z0], [xa + tread, ya + rise, z1]);
      quad(steps, [xa, ya, z1], [xa, ya, z0], [xa, ya + rise, z0], [xa, ya + rise, z1]);
    }
    s.add(new THREE.Mesh(quadGeo(people), crowdMat));
    s.add(new THREE.Mesh(quadGeo(steps), concreteMat));
    // Aisle stairways
    const slope = Math.atan2(height - front, depth), slen = Math.hypot(height - front, depth);
    for (let az = z0 + 10; az < z1 - 4; az += 12) {
      const a = new THREE.Mesh(new THREE.BoxGeometry(slen, 0.25, 1.3), concreteMat);
      a.position.set(depth / 2, front + (height - front) / 2 + 0.55, az); a.rotation.z = slope;
      s.add(a);
    }
    // Front wall with advertising boards, railing, side walls, back wall with the stand name
    const fw = new THREE.Mesh(new THREE.BoxGeometry(0.3, front, len), concreteMat);
    fw.position.set(-0.15, front / 2, 0); s.add(fw);
    const ads = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.9), adMat);
    ads.position.set(-0.32, front / 2, 0); ads.rotation.y = -Math.PI / 2; ads.scale.x = side;   // keep text readable when mirrored
    adTex.repeat.set(len / 40, 1);
    s.add(ads);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, len), steelMat);
    rail.position.set(-0.1, front + 0.95, 0); s.add(rail);
    for (const zz of [z0, z1]) {
      const sw = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(depth + 0.6, 0), new THREE.Vector2(depth + 0.6, height + 1.5), new THREE.Vector2(0, front + 0.6)]);
      const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sw, { depth: 0.4, bevelEnabled: false }), concreteMat);
      m.position.z = zz - (zz < 0 ? 0.4 : 0); s.add(m);
    }
    standNo++;
    const nameTex = canvasTex(512, 64, (g, w, h) => {
      g.fillStyle = '#1c2633'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffffff'; g.font = '900 40px Segoe UI, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('GRANDSTAND ' + standNo, w / 2, h / 2 + 2);
    });
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.4, height + 2, len), concreteMat);
    back.position.set(depth + 0.4, (height + 2) / 2, 0); s.add(back);
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(len * 0.6, 24), 3), new THREE.MeshLambertMaterial({ map: nameTex, side: THREE.DoubleSide }));
    banner.position.set(depth + 0.62, height - 1.5, 0); banner.rotation.y = Math.PI / 2; banner.scale.x = side;
    s.add(banner);
    // Cantilever roof: columns at the back, struts out to a thin roof with a coloured fascia
    if (roof) {
      const top = height + 7;
      const r = new THREE.Mesh(new THREE.BoxGeometry(depth + 5, 0.35, len + 1), roofMat);
      r.position.set(depth / 2 - 1.5, top, 0); r.rotation.z = -0.07;
      s.add(r);
      const fas = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.9, len + 1), fasciaMat);
      fas.position.set(-4, top + 0.3, 0); s.add(fas);
      for (let zz = z0 + 2; zz <= z1 - 2; zz += 11) {
        const c = new THREE.Mesh(new THREE.BoxGeometry(0.6, top + 1, 0.6), steelMat);
        c.position.set(depth + 1.2, (top + 1) / 2, zz); s.add(c);
        const strutLen = Math.hypot(depth + 5, 3);
        const st = new THREE.Mesh(new THREE.BoxGeometry(strutLen, 0.25, 0.25), steelMat);
        st.position.set(depth / 2 - 1.5, top - 0.55, zz); st.rotation.z = -0.07;
        s.add(st);
      }
    }
    group.add(s);
  }
  const standOff = walled ? T.hw + T.def.walls.offset + 5 : T.hw + 30;
  for (let o = -100; o <= 100; o += 24) stand((o + T.n) % T.n, 1, standOff);
  // Stands on the outside of the tightest corners.
  if (!walled) {
    const corners = [];
    for (let i = 0; i < T.n; i++) if (T.curv[i] > 1 / 120) corners.push(i);
    corners.sort((a, b) => T.curv[b] - T.curv[a]);
    const used = [];
    for (const i of corners) {
      if (used.length >= 5) break;
      if (used.some(j => Math.min(Math.abs(i - j), T.n - Math.abs(i - j)) < 150)) continue;
      used.push(i);
      stand(i, -Math.sign(T.turn[i]) || 1, T.hw + 32, 60, 18, 13);
    }
  }
  if (theme.stadium) {   // track runs through a stadium (Foro Sol, COTA stadium section)
    const a = Math.floor(theme.stadium.from * T.n), b = Math.floor(theme.stadium.to * T.n);
    for (let i = a; i < b; i += 22) for (const side of [1, -1]) stand(i, side, T.hw + 27, 44, 30, 24, false);
  }

  // Big video screen beside the main straight
  {
    const i = (T.n - 55) % T.n, [x, z] = trackPoint(i, 1, standOff - 6);
    if (free(x, z, standOff - 8)) {
      const scr = canvasTex(512, 300, (g, w, h) => {
        g.fillStyle = '#05070c'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#e10600'; g.fillRect(0, 0, w, 44);
        g.fillStyle = '#fff'; g.font = '900 28px Segoe UI, Arial'; g.textBaseline = 'middle';
        g.fillText('ROUND ' + T.def.round + ' · ' + T.def.name.toUpperCase(), 16, 23);
        g.font = '700 22px Segoe UI, Arial';
        DRIVERS.slice().sort((a, b) => b.skill - a.skill).slice(0, 10).forEach((d, k) => {
          const y = 66 + k * 23;
          g.fillStyle = k % 2 ? '#111722' : '#0b1018'; g.fillRect(0, y - 11, w, 23);
          g.fillStyle = '#9aa7b4'; g.fillText(String(k + 1).padStart(2, ' '), 16, y);
          g.fillStyle = '#' + teamOf(d).body.toString(16).padStart(6, '0'); g.fillRect(54, y - 8, 6, 16);
          g.fillStyle = '#fff'; g.fillText(d.code + '   ' + d.name, 70, y);
        });
      });
      const sg = new THREE.Group();
      sg.position.set(x, T.y[i], z); sg.rotation.y = T.hd[i] - Math.PI / 2 + 0.35;
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(14, 8.2), new THREE.MeshBasicMaterial({ map: scr }));
      panel.position.y = 12; sg.add(panel);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(14.8, 9, 0.6), new THREE.MeshLambertMaterial({ color: 0x1b1f26 }));
      frame.position.set(0, 12, -0.35); sg.add(frame);
      for (const dx of [-4, 4]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.7, 8, 0.7), steelMat);
        leg.position.set(dx, 4, -0.4); sg.add(leg);
      }
      group.add(sg);
    }
  }

  // ---------- Pit lane, garages and pit wall (permanent circuits) ----------
  {
    const PIT = T.pitSamples, TAPER = 45, N = T.n;
    const offAt = (o) => off => [T.x[(o + N) % N] + T.nx[(o + N) % N] * -off, T.z[(o + N) % N] + T.nz[(o + N) % N] * -off];
    const garageOff = walled ? T.hw + T.def.walls.offset + 10 : T.hw + 22;
    if (!walled) {
      // Pit lane surface: fast lane + working lane, white boundary lines; tapers into the track at entry/exit.
      const pitTex = canvasTex(256, 128, (g, w, h) => {
        speckle(g, w, h, '#3d3e42', 0.15, 6000, 2);
        g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, 6, h); g.fillRect(w * 0.55, 0, 4, h); g.fillRect(w - 6, 0, 6, h);
      });
      pitTex.wrapT = THREE.RepeatWrapping;
      const Q = quads();
      let prev = null;
      for (let o = -PIT - TAPER; o <= PIT + TAPER; o++) {
        const k = (o + N) % N, t = Math.min(1, (PIT + TAPER - Math.abs(o)) / TAPER);
        const e = t * t * (3 - 2 * t);
        const inner = T.hw + 0.4 + 2.1 * e, outer = T.hw + 0.4 + 15.6 * e;
        const P = offAt(o), a = P(inner), b = P(outer), y = T.y[k] + 0.035, v = o * 2 / 10;
        const cur = { a: [a[0], y, a[1]], b: [b[0], y, b[1]], v };
        if (prev) {
          const n = Q.pos.length / 3;
          Q.pos.push(...prev.a, ...prev.b, ...cur.b, ...cur.a);
          Q.uv.push(0, prev.v, 1, prev.v, 1, cur.v, 0, cur.v);
          Q.idx.push(n, n + 2, n + 1, n, n + 3, n + 2);
        }
        prev = cur;
      }
      group.add(new THREE.Mesh(quadGeo(Q), new THREE.MeshLambertMaterial({ map: pitTex, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 })));

      // Catch fence on top of the pit wall
      const fenceTex = canvasTex(64, 64, (g, w, h) => {
        g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(200,205,210,0.9)'; g.lineWidth = 2;
        for (let d = -w; d < w * 2; d += 16) { g.beginPath(); g.moveTo(d, 0); g.lineTo(d + h, h); g.moveTo(d + h, 0); g.lineTo(d, h); g.stroke(); }
      });
      fenceTex.wrapS = fenceTex.wrapT = THREE.RepeatWrapping;
      const F = quads();
      for (let o = -PIT; o < PIT; o += 2) {
        const k0 = (o + N) % N, k1 = (o + 2 + N) % N;
        if (!T.wallR[k0] || T.wallR[k0] > T.hw + 2) continue;
        const a = offAt(o)(T.hw + 1.5), b = offAt(o + 2)(T.hw + 1.5);
        quad(F, [a[0], T.y[k0] + 1.1, a[1]], [b[0], T.y[k1] + 1.1, b[1]], [b[0], T.y[k1] + 4.2, b[1]], [a[0], T.y[k0] + 4.2, a[1]], o / 4, 0, (o + 2) / 4, 3);
      }
      group.add(new THREE.Mesh(quadGeo(F), new THREE.MeshBasicMaterial({ map: fenceTex, transparent: true, side: THREE.DoubleSide, depthWrite: false })));
      // Fence posts
      const posts = [];
      for (let o = -PIT; o < PIT; o += 4) {
        const [px, pz] = offAt(o)(T.hw + 1.5);
        posts.push({ x: px, z: pz, y: T.y[(o + N) % N] + 1.1, sx: 0.12, sy: 3.1, sz: 0.12 });
      }
      instanced(boxGeo, steelMat, posts);
    }

    // Garages: one per team (in team colours, lit inside), plus FIA / F1 units at the ends.
    const glass = new THREE.MeshPhongMaterial({ color: 0x9fb8cc, shininess: 90, emissive: night ? 0x333a44 : 0 });
    const shell = new THREE.MeshLambertMaterial({ color: 0xe9ebee });
    const roofTop = new THREE.MeshLambertMaterial({ color: 0x9aa0a6 });
    const upper = [], tyres = [], boxesDrawn = [];
    const units = [];
    for (let o = -70; o <= 70; o += 10) units.push(o);
    const firstTeam = Math.floor((units.length - TEAMS.length) / 2);
    units.forEach((o, u) => {
      const i = (o + N) % N;
      const [x, z] = trackPoint(i, -1, garageOff);
      const gf = obb(x + T.nx[i] * -1, z + T.nz[i] * -1, T.hd[i], 8, 9.8);
      if (!free(x, z, garageOff - 3) || occupied(gf)) return;
      occupy(gf);
      const team = TEAMS[u - firstTeam];
      const col = team ? '#' + team.body.toString(16).padStart(6, '0') : '#1c2633';
      const label = team ? team.name.toUpperCase() : (u < firstTeam ? 'FIA' : 'FORMULA 1');
      const front = canvasTex(512, 256, (g, w, h) => {
        g.fillStyle = '#eef0f2'; g.fillRect(0, 0, w, h);
        g.fillStyle = col; g.fillRect(0, 0, w, 52);
        g.fillStyle = team && team.body > 0xd0d0d0 ? '#111' : '#fff';
        g.font = '900 34px Segoe UI, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(label, w / 2, 28);
        // Open door: dark interior, back wall in team colour, strip lights on the ceiling
        g.fillStyle = '#20242b'; g.fillRect(28, 70, w - 56, h - 70);
        g.fillStyle = col; g.globalAlpha = 0.55; g.fillRect(60, 110, w - 120, h - 140); g.globalAlpha = 1;
        g.fillStyle = '#fffbe8';
        for (let k = 0; k < 5; k++) g.fillRect(60 + k * 85, 78, 50, 5);
        g.fillStyle = '#3a3f47'; g.fillRect(0, 52, w, 18);
      });
      const mats = [new THREE.MeshLambertMaterial({ map: front, emissive: night ? 0x555555 : 0, emissiveMap: night ? front : null }), shell, roofTop, shell, shell, shell];
      const gm = new THREE.Mesh(boxGeo, mats);
      gm.scale.set(14, 7, 19.6); gm.position.set(x, T.y[i], z); gm.rotation.y = T.hd[i];
      group.add(gm);
      upper.push({ x: x + T.nx[i] * -2, z: z + T.nz[i] * -2, y: T.y[i] + 7, ry: T.hd[i], sx: 10, sy: 5, sz: 19.6 });
      if (!walled) {
        // Tyre stacks either side of the garage door
        for (const dz of [-8.6, 8.6]) {
          const [tx, tz] = trackPoint(i, -1, garageOff - 7.8);
          tyres.push({ x: tx + Math.sin(T.hd[i]) * dz, z: tz + Math.cos(T.hd[i]) * dz, y: T.y[i], s: 1 });
        }
        // Pit box painted on the working lane
        if (team) {
          const bt = canvasTex(128, 192, (g, w, h) => {
            g.clearRect(0, 0, w, h);
            g.strokeStyle = col; g.lineWidth = 10; g.strokeRect(8, 8, w - 16, h - 16);
            g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.strokeRect(20, 20, w - 40, h - 40);
            g.fillStyle = col; g.fillRect(w / 2 - 3, 20, 6, h - 40);
          });
          const pb = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 7), new THREE.MeshLambertMaterial({ map: bt, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
          const [bx, bz] = trackPoint(i, -1, T.hw + 13.3);
          pb.position.set(bx, T.y[i] + 0.05, bz); pb.rotation.set(-Math.PI / 2, 0, T.hd[i] + Math.PI);
          group.add(pb);
          // Team stand on the pit wall
          const [sx, sz] = trackPoint(i, -1, T.hw + 2.2);
          const st = new THREE.Group();
          st.position.set(sx, T.y[i], sz); st.rotation.y = T.hd[i];
          const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 6), shell); base.position.y = 0.6; st.add(base);
          const scr = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.8, 5.6), new THREE.MeshLambertMaterial({ color: 0x0b0e14, emissive: 0x112233 }));
          scr.position.set(0.3, 1.7, 0); st.add(scr);
          const cap = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.18, 6.4), new THREE.MeshLambertMaterial({ color: team.body }));
          cap.position.y = 2.6; st.add(cap);
          for (const dz of [-2.9, 2.9]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.4, 0.1), steelMat); p.position.set(-0.6, 1.9, dz); st.add(p); }
          group.add(st);
        }
      }
    });
    instanced(boxGeo, glass, upper);
    if (tyres.length) {
      const tyreTex = canvasTex(64, 64, (g, w, h) => {
        g.fillStyle = '#141414'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#2a2a2a'; for (let y = 0; y < h; y += 16) g.fillRect(0, y, w, 3);
      });
      instanced(new THREE.CylinderGeometry(0.34, 0.34, 1.3, 16).translate(0, 0.65, 0), new THREE.MeshLambertMaterial({ map: tyreTex }), tyres);
    }

    if (!walled) {
      // Pit exit light (red / green) and pit entry speed-limit sign
      const ex = (PIT + 8) % N, [lx, lz] = offAt(PIT + 8)(T.hw + 9);
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.2, 0.25), steelMat);
      pole.position.set(lx, T.y[ex] + 1.6, lz); group.add(pole);
      for (const [dy, c] of [[0.35, 0xff2222], [-0.35, 0x22ff55]]) {
        const l = new THREE.Mesh(new THREE.CircleGeometry(0.22, 16), new THREE.MeshBasicMaterial({ color: c }));
        l.position.set(lx, T.y[ex] + 2.9 + dy, lz); l.rotation.y = T.hd[ex] + Math.PI; group.add(l);
      }
      const en = (N - PIT - 30) % N, [sx, sz] = offAt(-PIT - 30)(T.hw + 4);
      const sign = canvasTex(128, 128, (g, w, h) => {
        g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill();
        g.strokeStyle = '#d10000'; g.lineWidth = 14; g.beginPath(); g.arc(64, 64, 54, 0, 7); g.stroke();
        g.fillStyle = '#111'; g.font = '900 52px Segoe UI, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('80', 64, 68);
      });
      const sm = new THREE.Mesh(new THREE.CircleGeometry(0.8, 24), new THREE.MeshBasicMaterial({ map: sign }));
      sm.position.set(sx, T.y[en] + 2.6, sz); sm.rotation.y = T.hd[en] + Math.PI; group.add(sm);
      const sp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 0.12), steelMat);
      sp.position.set(sx, T.y[en] + 1.1, sz); group.add(sp);
    }
  }

  // ---------- City blocks lining street circuits ----------
  // Placed after the stands and garages so they fit round them. Each block's whole footprint has to
  // clear the barriers (and every other part of the circuit), the water and the blocks already built.
  if (theme.urban) {
    const u = theme.urban, list = [], cols = [], pal = PALETTES[u.palette];
    const base = T.hw + (T.def.walls ? T.def.walls.offset : 6) + 7;
    const clear = T.hw + (T.def.walls ? T.def.walls.offset + 3 : 8);
    for (let i = 0; i < T.n; i += 9) {
      for (const side of [1, -1]) {
        for (let r = 0; r < u.rows; r++) {
          if (rand() < 0.2) continue;
          const w = rr(14, 30), d = rr(14, 28), h = rr(u.minH, u.maxH) * (r ? 1.35 : 1);
          const off = base + r * 34 + d / 2 + rr(0, 4);
          const [x, z] = trackPoint(i, side, off);
          const fp = obb(x, z, T.hd[i], d / 2 + 1, w / 2 + 1);   // +1 m: a narrow street between neighbours
          if (!footprintClear(x, z, T.hd[i], d / 2, w / 2, clear) || occupied(fp)) continue;
          occupy(fp);
          // On a slope, stand on the lowest ground under the footprint (not the centre's) so no corner
          // floats, and grow by the drop so the roof stays where it would be on the high side.
          let lo = Infinity, hi = -Infinity;
          for (const a of [-1, 0, 1]) for (const b of [-1, 0, 1]) {
            const lx = a * d / 2, lz = b * w / 2;
            const g = groundAt(x + lx * fp.c + lz * fp.s, z - lx * fp.s + lz * fp.c);
            lo = Math.min(lo, g); hi = Math.max(hi, g);
          }
          list.push({ x, z, y: lo - 0.3, ry: T.hd[i], sx: d, sy: h + hi - lo + 0.3, sz: w });
          cols.push(new THREE.Color(pal[Math.floor(rand() * pal.length)]));
        }
      }
    }
    instanced(boxGeo, buildingMat(), list, cols);
  }

  // ---------- Floodlights (night races) ----------
  if (theme.floodlights) {
    const poles = [], heads = [];
    const off = walled ? T.hw + T.def.walls.offset + 2 : T.hw + 27;
    let side = 1;
    for (let i = 0; i < T.n; i += 22) {
      side = -side;
      const [x, z] = trackPoint(i, side, off);
      if (!free(x, z, off - 2)) continue;
      poles.push({ x, z, sx: 0.6, sy: 22, sz: 0.6 });
      const [hx, hz] = trackPoint(i, side, off - 2);
      heads.push({ x: hx, z: hz, y: groundAt(x, z) + 22, ry: T.hd[i], sx: 1.2, sy: 1.6, sz: 5 });
    }
    instanced(boxGeo, steelMat, poles);
    instanced(boxGeo, new THREE.MeshBasicMaterial({ color: 0xfff6dc }), heads);
  }

  // ---------- Landmarks ----------
  const glow = c => new THREE.MeshBasicMaterial({ color: c });
  const cylBetween = (a, b, r, mat) => {
    const v = new THREE.Vector3().subVectors(b, a), len = v.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6), mat);
    m.position.copy(a).addScaledVector(v, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize());
    return m;
  };
  const LANDMARKS = {
    ferris(L) {            // Suzuka's Ferris wheel / Singapore Flyer
      const r = L.r, [x, z] = placeAt(L.u, L.v, r + 60);
      const g = new THREE.Group(); g.position.set(x, groundAt(x, z), z); g.rotation.y = rand() * Math.PI;
      const wheel = new THREE.Group(); wheel.position.y = r + 8;
      const rimMat = night ? glow(0xbfe0ff) : new THREE.MeshLambertMaterial({ color: 0xf0f0f0 });
      for (const dz of [-3, 3]) {
        const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.6, 6, 64), rimMat);
        rim.position.z = dz; wheel.add(rim);
      }
      for (let k = 0; k < 24; k++) {
        const a = k / 24 * Math.PI * 2;
        wheel.add(cylBetween(new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0), 0.25, steelMat));
        const cab = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 3), new THREE.MeshLambertMaterial({ color: [0xe63946, 0xffb703, 0x219ebc, 0x2a9d8f][k % 4] }));
        cab.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
        wheel.add(cab);
      }
      g.add(wheel);
      for (const s of [-1, 1]) for (const dz of [-6, 6]) {
        g.add(cylBetween(new THREE.Vector3(s * r * 0.45, 0, dz), new THREE.Vector3(0, r + 8, dz * 0.4), 0.8, steelMat));
      }
      group.add(g);
      updaters.push(dt => { wheel.rotation.z += dt * 0.04; });
    },
    sphere(L) {            // Las Vegas Sphere
      const [x, z] = placeAt(L.u, L.v, 140);
      const tex = canvasTex(512, 256, (g, w, h) => {
        const grd = g.createLinearGradient(0, 0, 0, h);
        grd.addColorStop(0, '#1b0b4d'); grd.addColorStop(0.5, '#ff5e9c'); grd.addColorStop(1, '#ffb347');
        g.fillStyle = grd; g.fillRect(0, 0, w, h);
        g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(w / 2, h / 2, 90, 60, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#3aa0ff'; g.beginPath(); g.arc(w / 2, h / 2, 42, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#000'; g.beginPath(); g.arc(w / 2, h / 2, 20, 0, Math.PI * 2); g.fill();
      });
      const m = new THREE.Mesh(new THREE.SphereGeometry(78, 48, 32), new THREE.MeshBasicMaterial({ map: tex }));
      m.position.set(x, groundAt(x, z) + 62, z);
      m.rotation.y = Math.atan2(cx0 - x, cz0 - z) - Math.PI / 2;
      group.add(m);
    },
    mbs(L) {               // Marina Bay Sands: three towers + SkyPark
      const [x, z] = placeAt(L.u, L.v, 220);
      const g = new THREE.Group(); g.position.set(x, groundAt(x, z), z); g.rotation.y = Math.PI / 2;
      const mat = buildingMat(); mat.color = new THREE.Color(0xb7c4cf);
      for (const dx of [-110, 0, 110]) {
        const t = new THREE.Mesh(taperBox(34, 195, 40, [1, 1], [1, 1]), mat);
        t.position.set(dx, 0, 0); g.add(t);
      }
      const park = new THREE.Mesh(new THREE.BoxGeometry(340, 10, 42).translate(0, 5, 0), new THREE.MeshLambertMaterial({ color: 0xdfe4ea }));
      park.position.set(30, 195, 0);
      g.add(park);
      group.add(g);
    },
    flames(L) {            // Baku Flame Towers
      const [x, z] = placeAt(L.u, L.v, 140);
      const mat = night || dusk
        ? new THREE.MeshPhongMaterial({ color: 0x223355, emissive: 0xff6a1a, emissiveIntensity: 0.55, shininess: 90 })
        : new THREE.MeshPhongMaterial({ color: 0x5d86b0, shininess: 100, specular: 0xffffff });
      [[0, 0, 190], [-55, 35, 165], [55, 35, 155]].forEach(([dx, dz, h]) => {
        const prof = [[0, 0], [24, 0], [28, h * 0.25], [25, h * 0.55], [16, h * 0.8], [6, h * 0.95], [0, h]]
          .map(q => new THREE.Vector2(q[0], q[1]));
        const m = new THREE.Mesh(new THREE.LatheGeometry(prof, 24), mat);
        m.position.set(x + dx, groundAt(x, z) + 40, z + dz);     // the towers sit on a hill
        group.add(m);
      });
      const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x8a7b5c }));
      hill.scale.set(160, 42, 120); hill.position.set(x, groundAt(x, z), z + 20);
      group.add(hill);
    },
    stadium(L) {           // Hard Rock Stadium (Miami)
      const [x, z] = placeAt(L.u, L.v, 160);
      const g = new THREE.Group(); g.position.set(x, groundAt(x, z), z); g.scale.z = 0.72;
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(130, 95, 38, 48, 1, true).translate(0, 19, 0), crowdMat));
      const canopy = new THREE.Mesh(new THREE.RingGeometry(95, 140, 48), roofMat);
      canopy.rotation.x = -Math.PI / 2; canopy.position.y = 50; g.add(canopy);
      for (let k = 0; k < 4; k++) {
        const a = k / 4 * Math.PI * 2 + Math.PI / 4;
        g.add(cylBetween(new THREE.Vector3(Math.cos(a) * 150, 0, Math.sin(a) * 150), new THREE.Vector3(Math.cos(a) * 125, 75, Math.sin(a) * 125), 1.5, steelMat));
      }
      const pitch = new THREE.Mesh(new THREE.CircleGeometry(95, 32), new THREE.MeshLambertMaterial({ color: 0x3f9b3a }));
      pitch.rotation.x = -Math.PI / 2; pitch.position.y = 0.1; g.add(pitch);
      group.add(g);
    },
    biosphere(L) {         // Montreal Biosphère
      const [x, z] = placeAt(L.u, L.v, 80);
      const frame = new THREE.Mesh(new THREE.IcosahedronGeometry(38, 3), new THREE.MeshBasicMaterial({ color: 0xd9dee3, wireframe: true }));
      const inner = new THREE.Mesh(new THREE.IcosahedronGeometry(36, 3), new THREE.MeshPhongMaterial({ color: 0x8fb3c8, transparent: true, opacity: 0.35 }));
      frame.position.set(x, groundAt(x, z) + 28, z); inner.position.copy(frame.position);
      group.add(frame, inner);
    },
    sakhirTower(L) {       // Bahrain's VIP tower
      const [x, z] = placeAt(L.u, L.v, 60);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(5, 7, 52, 12).translate(0, 26, 0), new THREE.MeshLambertMaterial({ color: 0xe8dcc4 }));
      const topm = new THREE.Mesh(new THREE.BoxGeometry(24, 12, 24).translate(0, 6, 0), buildingMat());
      shaft.position.set(x, groundAt(x, z), z); topm.position.set(x, groundAt(x, z) + 52, z);
      group.add(shaft, topm);
    },
    cotaTower(L) {         // COTA observation tower (red "veil")
      const [x, z] = placeAt(L.u, L.v, 60);
      const red = new THREE.MeshLambertMaterial({ color: 0xc8102e }), gy = groundAt(x, z);
      for (let k = 0; k < 14; k++) {
        const a = k / 14 * Math.PI * 2;
        group.add(cylBetween(new THREE.Vector3(x + Math.cos(a) * 10, gy, z + Math.sin(a) * 10),
          new THREE.Vector3(x + Math.cos(a + 0.6) * 2, gy + 77, z + Math.sin(a + 0.6) * 2), 0.4, red));
      }
      const deck = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 3, 16), new THREE.MeshLambertMaterial({ color: 0xdddddd }));
      deck.position.set(x, gy + 70, z); group.add(deck);
    },
    yasHotel(L) {          // Yas Hotel straddling the track with its LED grid canopy
      const i = Math.floor(L.at * T.n);
      const mat = buildingMat(); mat.color = new THREE.Color(0xe6e9ec);
      for (const side of [1, -1]) {
        const [x, z] = trackPoint(i, side, T.hw + 28);
        const b = new THREE.Mesh(boxGeo, mat);
        b.scale.set(34, 30, 130); b.position.set(x, T.y[i], z); b.rotation.y = T.hd[i];
        group.add(b);
      }
      const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x66ccff, wireframe: true }));
      dome.scale.set(75, 32, 160);
      dome.position.set(T.x[i], 18, T.z[i]); dome.rotation.y = T.hd[i];
      group.add(dome);
      let t = 0;
      updaters.push(dt => { t += dt; dome.material.color.setHSL((t * 0.05) % 1, 0.8, 0.6); });
    },
    shanghaiBridge() {     // Shanghai's main grandstand bridge with "wing" roofs over the start straight
      const i = 45;
      const g = new THREE.Group(); g.position.set(T.x[i], 0, T.z[i]); g.rotation.y = T.hd[i];
      const span = T.hw * 2 + 70;
      const deck = new THREE.Mesh(new THREE.BoxGeometry(span, 8, 18).translate(0, 26, 0), buildingMat());
      g.add(deck);
      for (const s of [-1, 1]) {
        const tower = new THREE.Mesh(new THREE.BoxGeometry(14, 30, 22).translate(0, 15, 0), roofMat);
        tower.position.x = s * span / 2; g.add(tower);
        const wing = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 8), roofMat);
        wing.scale.set(span * 0.3, 4, 30); wing.position.set(s * span * 0.25, 38, 0);
        g.add(wing);
      }
      group.add(g);
    },
  };
  for (const L of theme.landmarks || []) LANDMARKS[L.type](L);

  return {
    env, sky, groundMats,
    update(dt) { updaters.forEach(f => f(dt)); },
  };
}

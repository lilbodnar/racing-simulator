// 2026 F1 teams, drivers, and a detailed 2026-style F1 car (no beam wing, halo, sculpted
// sidepods, multi-element wings). Liveries are painted per team; colours approximate the
// real cars (team names and numbers only, no sponsor logos).
const TEAMS = [
  { id: 'mclaren',  name: 'McLaren',      body: 0xff8000, second: 0x1c1d21, accent: 0xff8000, wing: 0x1c1d21, plate: 0xff8000, helmet: 0xff8000, stripe: 0x47c7fc, gloss: 80 },
  { id: 'ferrari',  name: 'Ferrari',      body: 0x9e0e16, second: 0x63070c, accent: 0xffffff, wing: 0x1a1a1a, plate: 0xf2f2f2, helmet: 0x9e0e16, stripe: 0xffffff, gloss: 90, flap: 0x2a5bd7 },
  { id: 'redbull',  name: 'Red Bull',     body: 0x1b2a5c, second: 0x1b2a5c, accent: 0xd81e2c, wing: 0x1b2a5c, plate: 0xd81e2c, helmet: 0x1b2a5c, stripe: 0xffcc00, gloss: 12 },
  { id: 'mercedes', name: 'Mercedes',     body: 0x121316, second: 0xc4c8cc, accent: 0x00d2be, wing: 0x121316, plate: 0x00d2be, helmet: 0xc4c8cc, stripe: 0x00d2be, gloss: 90 },
  { id: 'aston',    name: 'Aston Martin', body: 0x00594f, second: 0x00594f, accent: 0xcedc00, wing: 0x0f1a17, plate: 0xcedc00, helmet: 0x00594f, stripe: 0xcedc00, gloss: 70 },
  { id: 'alpine',   name: 'Alpine',       body: 0xf58ab7, second: 0x0a5ad6, accent: 0x0a5ad6, wing: 0x0f1630, plate: 0xf58ab7, helmet: 0x0a5ad6, stripe: 0xffffff, gloss: 80 },
  { id: 'williams', name: 'Williams',     body: 0x00205b, second: 0x00205b, accent: 0x1e8cff, wing: 0x0b1a3a, plate: 0x1e8cff, helmet: 0x1e8cff, stripe: 0xffffff, gloss: 70 },
  { id: 'rb',       name: 'Racing Bulls', body: 0xf2f2f2, second: 0x1634cc, accent: 0xe8102a, wing: 0x16181d, plate: 0x1634cc, helmet: 0x1634cc, stripe: 0xe8102a, gloss: 80 },
  { id: 'haas',     name: 'Haas',         body: 0xf0f0f0, second: 0x1a1a1a, accent: 0xd0021b, wing: 0x1a1a1a, plate: 0xd0021b, helmet: 0xf0f0f0, stripe: 0xd0021b, gloss: 70 },
  { id: 'audi',     name: 'Audi',         body: 0xa7a9ac, second: 0x121212, accent: 0xff2a00, wing: 0x121212, plate: 0xff2a00, helmet: 0xa7a9ac, stripe: 0xff2a00, gloss: 60 },
  { id: 'cadillac', name: 'Cadillac',     body: 0x8f9398, second: 0x141414, accent: 0xf2f2f2, wing: 0x141414, plate: 0xf2f2f2, helmet: 0x141414, stripe: 0xf2f2f2, gloss: 70 },
];

// 2026 driver line-up. `skill` (0.93 - 0.99) sets how close the AI gets to the ideal lap.
const DRIVERS = [
  { code: 'NOR', name: 'Lando Norris',          num: 1,  team: 'mclaren',  skill: 0.978 },
  { code: 'PIA', name: 'Oscar Piastri',         num: 81, team: 'mclaren',  skill: 0.974 },
  { code: 'LEC', name: 'Charles Leclerc',       num: 16, team: 'ferrari',  skill: 0.977 },
  { code: 'HAM', name: 'Lewis Hamilton',        num: 44, team: 'ferrari',  skill: 0.973 },
  { code: 'VER', name: 'Max Verstappen',        num: 3,  team: 'redbull',  skill: 0.982 },
  { code: 'HAD', name: 'Isack Hadjar',          num: 6,  team: 'redbull',  skill: 0.962 },
  { code: 'RUS', name: 'George Russell',        num: 63, team: 'mercedes', skill: 0.985 },
  { code: 'ANT', name: 'Kimi Antonelli',        num: 12, team: 'mercedes', skill: 0.986 },
  { code: 'ALO', name: 'Fernando Alonso',       num: 14, team: 'aston',    skill: 0.955 },
  { code: 'STR', name: 'Lance Stroll',          num: 18, team: 'aston',    skill: 0.940 },
  { code: 'GAS', name: 'Pierre Gasly',          num: 10, team: 'alpine',   skill: 0.954 },
  { code: 'COL', name: 'Franco Colapinto',      num: 43, team: 'alpine',   skill: 0.941 },
  { code: 'ALB', name: 'Alexander Albon',       num: 23, team: 'williams', skill: 0.953 },
  { code: 'SAI', name: 'Carlos Sainz',          num: 55, team: 'williams', skill: 0.956 },
  { code: 'LAW', name: 'Liam Lawson',           num: 30, team: 'rb',       skill: 0.948 },
  { code: 'LIN', name: 'Arvid Lindblad',        num: 41, team: 'rb',       skill: 0.943 },
  { code: 'OCO', name: 'Esteban Ocon',          num: 31, team: 'haas',     skill: 0.947 },
  { code: 'BEA', name: 'Oliver Bearman',        num: 87, team: 'haas',     skill: 0.951 },
  { code: 'HUL', name: 'Nico Hülkenberg',       num: 27, team: 'audi',     skill: 0.948 },
  { code: 'BOR', name: 'Gabriel Bortoleto',     num: 5,  team: 'audi',     skill: 0.946 },
  { code: 'PER', name: 'Sergio Pérez',          num: 11, team: 'cadillac', skill: 0.937 },
  { code: 'BOT', name: 'Valtteri Bottas',       num: 77, team: 'cadillac', skill: 0.936 },
];
const teamOf = d => TEAMS.find(t => t.id === d.team);

// 2026 helmet designs (main colour, second colour, detail colour, pattern), approximated
// from the official helmet line-up.
const HELMETS = {
  NOR: { base: 0xf2e600, a: 0x111111, b: 0x8cff1a, style: 'swirl' },
  PIA: { base: 0xff6a13, a: 0x0b2a6b, b: 0xffd400, style: 'bands' },
  RUS: { base: 0x35b7e8, a: 0x111111, b: 0xffffff, style: 'split' },
  ANT: { base: 0x5cc8f0, a: 0xffffff, b: 0xd81e2c, style: 'chevron' },
  VER: { base: 0xf2f2f2, a: 0x1b2a8c, b: 0xe0202a, style: 'chevron' },
  HAD: { base: 0x9be33a, a: 0xff4fa3, b: 0x1a1a1a, style: 'swirl' },
  LEC: { base: 0xdc0000, a: 0xf5f5f5, b: 0x1c3fa8, style: 'bands' },
  HAM: { base: 0xf2c200, a: 0x111111, b: 0xffffff, style: 'bands' },
  SAI: { base: 0xd81e2c, a: 0xffd400, b: 0x1b4fc4, style: 'split' },
  ALB: { base: 0xe6e8ea, a: 0x111111, b: 0x2a6fd6, style: 'chevron' },
  LAW: { base: 0xf3a3c4, a: 0x111111, b: 0xffffff, style: 'split' },
  LIN: { base: 0x7fd3f0, a: 0xffb000, b: 0x1b2a5c, style: 'bands' },
  ALO: { base: 0x1b4fc4, a: 0xffd400, b: 0x7fd3f0, style: 'chevron' },
  STR: { base: 0x151515, a: 0xffffff, b: 0x8a8d91, style: 'bands' },
  OCO: { base: 0xd81e2c, a: 0xffffff, b: 0x111111, style: 'split' },
  BEA: { base: 0x1b2a8c, a: 0xffd400, b: 0xffffff, style: 'bands' },
  HUL: { base: 0xdcdfe2, a: 0xd81e2c, b: 0x111111, style: 'chevron' },
  BOR: { base: 0xf2f2f2, a: 0x1fa34a, b: 0xffd400, style: 'split' },
  GAS: { base: 0x7cc6f2, a: 0xffffff, b: 0x0a2f6b, style: 'bands' },
  COL: { base: 0xf2f2f2, a: 0x6cb8f0, b: 0xe8417a, style: 'chevron' },
  BOT: { base: 0x1b2a5c, a: 0x4fb3f0, b: 0x111111, style: 'split' },
  PER: { base: 0xc6e83a, a: 0x1b2a5c, b: 0x1fa34a, style: 'shards' },
};

// Helmet shell layout. The shell is a sphere cut off below the chin (polar angle 0..HELMET_THETA).
// Texture u runs around it: 0 = left side, 0.25 = front, 0.5 = right side, 0.75 = back;
// v runs from the crown (0) to the bottom rim (1).
const HELMET_R = 0.15, HELMET_THETA = 2.35;
const VISOR = { phi: 1.0, t0: 1.12, t1: 1.66 };   // visor half-width (rad) and polar range
const helmetV = theta => theta / HELMET_THETA;

// Shape a sphere into a helmet: narrower than long, chin bar pushed forward, flared rim.
function shapeHelmet(geo) {
  const p = geo.attributes.position, R = HELMET_R;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const low = Math.max(0, -y / R);                  // 0 at equator .. 1 at the bottom
    x *= 0.9 + low * 0.04;
    z *= 1.07;
    if (z > 0) z += low * low * R * 0.28;             // chin bar juts forward
    else z -= low * R * 0.06;                         // back of the shell sweeps down to the neck
    y -= low * low * R * 0.12;
    p.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

// Helmet texture (see layout above).
function paintHelmet(g, w, h, H, drv) {
  const C = hexCss, num = drv && drv.num;
  const sq = (w / (Math.PI * 2)) / (h / HELMET_THETA);   // squash text so it isn't stretched vertically
  const vTop = helmetV(VISOR.t0), vBot = helmetV(VISOR.t1);
  g.fillStyle = C(H.base); g.fillRect(0, 0, w, h);

  // Soft-edged ribbon running around the helmet: y(u) gives its centre line.
  const ribbon = (col, thick, yAt, step = 4) => {
    g.fillStyle = col; g.beginPath();
    for (let x = 0; x <= w; x += step) g.lineTo(x, yAt(x / w) - thick / 2);
    for (let x = w; x >= 0; x -= step) g.lineTo(x, yAt(x / w) + thick / 2);
    g.fill();
  };
  const frontDip = u => Math.cos((u - 0.25) * Math.PI * 2);   // 1 at the front, -1 at the back

  if (H.style === 'bands') {
    ribbon(C(H.a), h * 0.13, u => h * (0.27 + 0.05 * frontDip(u)));
    ribbon(C(H.b), h * 0.018, u => h * (0.19 + 0.05 * frontDip(u)));
    ribbon(C(H.b), h * 0.018, u => h * (0.35 + 0.05 * frontDip(u)));
    g.fillStyle = C(H.a); g.fillRect(0, 0, w, h * 0.06);
  } else if (H.style === 'split') {
    g.fillStyle = C(H.a); g.beginPath(); g.moveTo(0, 0);
    for (let x = 0; x <= w; x += 4) g.lineTo(x, h * (0.3 - 0.08 * frontDip(x / w)));
    g.lineTo(w, 0); g.fill();
    ribbon(C(H.b), h * 0.025, u => h * (0.3 - 0.08 * frontDip(u)) + h * 0.03);
    ribbon(C(H.b), h * 0.012, u => h * (0.3 - 0.08 * frontDip(u)) + h * 0.06);
  } else if (H.style === 'chevron') {
    // Swept arrows pointing forward along each side, meeting above the visor.
    for (const [col, off] of [[H.a, 0], [H.b, 0.035]]) {
      g.fillStyle = C(col);
      for (const side of [-1, 1]) for (const shift of [0, w]) {   // left arrow wraps past the texture seam
        g.save(); g.translate(side < 0 ? shift : 0, 0);
        g.beginPath();
        const tip = 0.25, tail = 0.25 + side * 0.45;
        g.moveTo(w * tip, h * (0.2 + off));
        g.quadraticCurveTo(w * (tip + side * 0.2), h * (0.24 + off), w * tail, h * (0.12 + off));
        g.lineTo(w * tail, h * (0.3 + off));
        g.quadraticCurveTo(w * (tip + side * 0.2), h * (0.4 + off), w * tip, h * (0.3 + off));
        g.fill(); g.restore();
      }
    }
    g.fillStyle = C(H.a); g.fillRect(0, h * 0.82, w, h * 0.05);
  } else if (H.style === 'shards') {   // angular geometric panels sweeping back from the visor
    for (const [col, k0] of [[H.a, 0], [H.b, 1]]) {
      g.fillStyle = C(col);
      for (let k = k0; k < 12; k += 2) {
        const x = w * (k / 12), y = h * (0.15 + (k % 3) * 0.12);
        g.beginPath();
        g.moveTo(x, y); g.lineTo(x + w * 0.09, y - h * 0.08);
        g.lineTo(x + w * 0.06, y + h * 0.16); g.lineTo(x - w * 0.02, y + h * 0.1);
        g.fill();
      }
    }
    ribbon(C(H.a), h * 0.03, u => h * (0.8 - 0.04 * frontDip(u)));
  } else {   // swirl: flowing hand-drawn style linework
    g.lineCap = 'round'; g.lineJoin = 'round';
    let seed = 7 + (H.base % 9973) + (num || 0) * 131; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 70; k++) {
      g.strokeStyle = C(k % 6 ? H.a : H.b); g.lineWidth = w * (0.004 + rnd() * 0.01);
      let x = rnd() * w, y = rnd() * h * 0.95, a = rnd() * Math.PI * 2;
      g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < 14; s++) { a += (rnd() - 0.5) * 1.2; x += Math.cos(a) * w * 0.02; y += Math.sin(a) * h * 0.03; g.lineTo(x, y); }
      g.stroke();
    }
  }

  // Subtle shading: darker towards the rim, slight sheen on the crown.
  const sh = g.createLinearGradient(0, 0, 0, h);
  sh.addColorStop(0, 'rgba(255,255,255,0.12)'); sh.addColorStop(0.35, 'rgba(255,255,255,0)');
  sh.addColorStop(0.8, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.3)');
  g.fillStyle = sh; g.fillRect(0, 0, w, h);

  // Visor aperture: black rubber seal around the opening (visor mesh sits on top).
  const vu = VISOR.phi / (Math.PI * 2);
  g.fillStyle = '#0b0c0e';
  g.beginPath();
  g.roundRect ? g.roundRect(w * (0.25 - vu - 0.012), h * (vTop - 0.025), w * (2 * vu + 0.024), h * (vBot - vTop + 0.05), h * 0.05)
    : g.rect(w * (0.25 - vu - 0.012), h * (vTop - 0.025), w * (2 * vu + 0.024), h * (vBot - vTop + 0.05));
  g.fill();
  // Visor strip above the opening carries the driver's name (in place of a sponsor).
  g.fillStyle = '#121316'; g.fillRect(w * (0.25 - vu * 0.8), h * (vTop - 0.085), w * vu * 1.6, h * 0.055);
  g.fillRect(0, h * 0.94, w, h * 0.06);   // rubber trim round the bottom rim

  const text = (str, u, v, px, col, stroke) => {
    g.save(); g.translate(w * u, h * v); g.scale(1, sq);
    g.font = `italic 900 ${px}px Segoe UI, Arial`; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = px * 0.14; g.strokeText(str, 0, 0); }
    g.fillStyle = col; g.fillText(str, 0, 0);
    g.restore();
  };
  if (drv) text(drv.name.split(' ').pop().toUpperCase(), 0.25, vTop - 0.057, h * 0.05, '#ffffff');
  if (num != null) {   // number on the back and both sides
    const light = (H.base >> 16) + ((H.base >> 8) & 255) + (H.base & 255) > 450;
    const fill = light ? '#111111' : '#ffffff', edge = light ? '#ffffff' : '#111111';
    text(String(num), 0.75, 0.42, h * 0.16, fill, edge);
    text(String(num), 0.955, 0.5, h * 0.1, fill, edge);
    text(String(num), 0.545, 0.5, h * 0.1, fill, edge);
  }
}

// Visor: dark mirror at the top fading into a coloured iridescent tint.
function paintVisor(g, w, h, tint) {
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, '#05060a'); grd.addColorStop(0.45, hexCss(tint)); grd.addColorStop(1, '#0d0f14');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  const side = g.createLinearGradient(0, 0, w, 0);   // hint of rainbow sheen across the visor
  for (const [t, c] of [[0, 'rgba(120,40,200,0.35)'], [0.35, 'rgba(0,0,0,0)'], [0.65, 'rgba(0,0,0,0)'], [1, 'rgba(255,120,0,0.3)']]) side.addColorStop(t, c);
  g.fillStyle = side; g.fillRect(0, 0, w, h);
}

// Box whose front (+z) and back (-z) faces are scaled. Bottom stays flat (y = 0).
function taperBox(w, h, d, front, back) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(0, h / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const s = p.getZ(i) > 0 ? front : back;
    p.setX(i, p.getX(i) * s[0]);
    p.setY(i, p.getY(i) * s[1]);
  }
  g.computeVertexNormals();
  return g;
}

// ---------- Geometry helpers ----------

// Smooth body through cross-sections [z, centreX, halfWidth, bottomY, topY], listed front to
// back. Sections are rounded rectangles (superellipse, exponent n). UV: u along the body
// (0 rear .. 1 front), v around it (0 bottom, 0.25 / 0.75 sides, 0.5 top).
function loft(sections, segs = 20, n = 3) {
  const S = sections.length, pos = [], uv = [], idx = [];
  const zF = sections[0][0], zR = sections[S - 1][0];
  for (const [z, cx, w, y0, y1] of sections) {
    const cy = (y0 + y1) / 2, h = (y1 - y0) / 2;
    for (let k = 0; k <= segs; k++) {
      const a = -Math.PI / 2 + k / segs * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      pos.push(cx + w * Math.sign(c) * Math.pow(Math.abs(c), 2 / n), cy + h * Math.sign(s) * Math.pow(Math.abs(s), 2 / n), z);
      uv.push((z - zR) / (zF - zR), k / segs);
    }
  }
  for (let si = 0; si < S - 1; si++) for (let k = 0; k < segs; k++) {
    const a = si * (segs + 1) + k, b = a + segs + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Flat plate in the car's side plane (x = 0) from a [z, y] outline, `t` thick along x.
function sidePlate(outline, t) {
  const sh = new THREE.Shape(outline.map(([z, y]) => new THREE.Vector2(z, y)));
  return new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false }).translate(0, 0, -t / 2).rotateY(-Math.PI / 2);
}

// Wing element: airfoil section of chord c, spanning `span` across the car, leading edge at
// z = 0, pitched up by `aoa` radians at the trailing edge.
function airfoil(c, span, aoa, thick = 0.035) {
  const sh = new THREE.Shape();
  sh.moveTo(0, 0);
  sh.bezierCurveTo(c * 0.05, thick, c * 0.45, thick, c, thick * 0.12);
  sh.bezierCurveTo(c * 0.5, -thick * 0.15, c * 0.1, -thick * 0.35, 0, 0);
  return new THREE.ExtrudeGeometry(sh, { depth: span, bevelEnabled: false, curveSegments: 8 })
    .translate(0, 0, -span / 2).rotateY(Math.PI / 2).rotateX(aoa);
}

function rod(a, b, r, mat) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), v = new THREE.Vector3().subVectors(B, A);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, v.length(), 6), mat);
  m.position.copy(A).addScaledVector(v, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize());
  return m;
}

// Merge every mesh in `group` into one mesh per material (far fewer draw calls).
function mergeByMaterial(group) {
  group.updateMatrixWorld(true);
  const buckets = new Map();
  group.traverse(o => {
    if (!o.isMesh) return;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!buckets.has(o.material)) buckets.set(o.material, []);
    buckets.get(o.material).push(g);
    o.geometry.dispose();
  });
  const out = new THREE.Group();
  for (const [mat, list] of buckets) {
    const merged = new THREE.BufferGeometry();
    for (const name of ['position', 'normal', 'uv']) {
      const size = name === 'uv' ? 2 : 3;
      const arr = new Float32Array(list.reduce((n, g) => n + g.attributes[name].count * size, 0));
      let off = 0;
      for (const g of list) { arr.set(g.attributes[name].array, off); off += g.attributes[name].array.length; }
      merged.setAttribute(name, new THREE.BufferAttribute(arr, size));
    }
    list.forEach(g => g.dispose());
    out.add(new THREE.Mesh(merged, mat));
  }
  return out;
}

// ---------- Liveries ----------
const hexCss = c => '#' + c.toString(16).padStart(6, '0');

// Paint a body/sidepod texture. Canvas x runs along the car (left = rear, right = nose);
// canvas y runs around it: middle row = top of the car, quarter rows = sides, edges = underside.
function paintLivery(g, W, H, team, part) {
  const C = hexCss;
  // Fill the band v0..v1 (0 = bottom, 0.5 = top) on both sides, between x0..x1 (0..1 along car).
  const band = (v0, v1, col, x0 = 0, x1 = 1) => {
    g.fillStyle = col;
    g.fillRect(W * x0, H * (1 - v1), W * (x1 - x0), H * (v1 - v0));
    g.fillRect(W * x0, H * v0, W * (x1 - x0), H * (v1 - v0));
  };
  g.fillStyle = C(team.body); g.fillRect(0, 0, W, H);
  const nose = part === 'body';
  switch (team.id) {
    case 'mclaren':
      band(0, 0.22, C(team.second)); band(0.22, 0.235, C(team.stripe), 0, 0.8);
      if (nose) { band(0.45, 0.5, C(team.second), 0, 0.18); band(0.4, 0.5, C(team.second), 0.9, 1); }
      break;
    case 'ferrari': {
      // Deep red fading darker toward the floor, white rear engine cover, thin white side line.
      const grd = g.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, C(team.second)); grd.addColorStop(0.35, C(team.body));
      grd.addColorStop(0.65, C(team.body)); grd.addColorStop(1, C(team.second));
      g.fillStyle = grd; g.fillRect(0, 0, W, H);
      band(0, 0.1, '#140808');
      band(0.27, 0.285, '#ffffff', 0.12, 0.75);
      if (nose) { band(0.3, 0.5, '#f2f2f2', 0, 0.3); band(0.35, 0.5, '#f2f2f2', 0.94, 1); }
      else band(0.3, 0.5, '#f2f2f2', 0, 0.22);
      break;
    }
    case 'redbull':
      band(0, 0.17, C(team.accent)); band(0.17, 0.19, C(team.stripe));
      if (nose) band(0, 0.5, C(team.accent), 0.9, 1);
      g.fillStyle = C(team.stripe);
      for (const y of [H * 0.27, H * 0.73]) { g.beginPath(); g.arc(W * 0.3, y, H * 0.07, 0, Math.PI * 2); g.fill(); }
      break;
    case 'mercedes': {
      g.fillStyle = C(team.second); g.fillRect(0, 0, W, H);
      const grd = g.createLinearGradient(0, 0, W, 0);
      grd.addColorStop(0, 'rgba(18,19,22,1)'); grd.addColorStop(0.45, 'rgba(18,19,22,0)');
      grd.addColorStop(0.75, 'rgba(18,19,22,0)'); grd.addColorStop(1, 'rgba(18,19,22,1)');
      g.fillStyle = grd; g.fillRect(0, 0, W, H);
      band(0, 0.3, C(team.body)); band(0.3, 0.315, C(team.accent));
      break;
    }
    case 'aston':
      band(0, 0.1, '#0b1411'); band(0.32, 0.35, C(team.accent), 0.05, 0.95);
      if (nose) band(0, 0.5, C(team.accent), 0.94, 1);
      break;
    case 'alpine': {
      g.fillStyle = C(team.second);
      g.beginPath(); g.moveTo(0, 0); g.lineTo(W * 0.45, 0); g.lineTo(W * 0.6, H); g.lineTo(0, H); g.fill();
      g.strokeStyle = '#ffffff'; g.lineWidth = H * 0.02;
      g.beginPath(); g.moveTo(W * 0.45, 0); g.lineTo(W * 0.6, H); g.stroke();
      band(0, 0.08, '#0f1630');
      break;
    }
    case 'williams':
      band(0, 0.2, '#0b1a3a'); band(0.2, 0.3, C(team.accent), 0.1, 0.85); band(0.3, 0.31, '#ffffff', 0.1, 0.85);
      break;
    case 'rb':
      band(0, 0.3, C(team.second)); band(0.3, 0.32, C(team.accent));
      if (nose) band(0.32, 0.5, C(team.second), 0, 0.12);
      break;
    case 'haas':
      band(0, 0.3, C(team.second)); band(0.3, 0.325, C(team.accent));
      break;
    case 'audi':
      band(0, 0.25, C(team.second)); band(0.25, 0.265, C(team.accent));
      if (nose) band(0, 0.5, C(team.second), 0.86, 1);
      break;
    case 'cadillac':
      band(0, 0.28, C(team.second)); band(0.28, 0.29, '#ffffff');
      if (nose) band(0, 0.5, C(team.second), 0.92, 1);
      break;
  }
  // Soft shading: darker toward the underside, slightly lighter along the top.
  const sh = g.createLinearGradient(0, 0, 0, H);
  sh.addColorStop(0, 'rgba(0,0,0,0.32)'); sh.addColorStop(0.3, 'rgba(0,0,0,0)');
  sh.addColorStop(0.5, 'rgba(255,255,255,0.07)'); sh.addColorStop(0.7, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.32)');
  g.fillStyle = sh; g.fillRect(0, 0, W, H);
  // Panel lines and small fastener dots.
  g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 1;
  for (const x of [0.22, 0.48, 0.71, 0.86]) { g.beginPath(); g.moveTo(W * x, 0); g.lineTo(W * x, H); g.stroke(); }
  g.fillStyle = 'rgba(0,0,0,0.3)';
  for (const x of [0.22, 0.48, 0.71]) for (let y = H * 0.1; y < H; y += H * 0.1) g.fillRect(W * x + 3, y, 2, 2);
}

function textTexture(text, w, h, color, bg, font, radius = 0) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (bg) {
    g.fillStyle = bg;
    if (radius) { g.beginPath(); g.moveTo(radius, 0); g.arcTo(w, 0, w, h, radius); g.arcTo(w, h, 0, h, radius); g.arcTo(0, h, 0, 0, radius); g.arcTo(0, 0, w, 0, radius); g.fill(); }
    else g.fillRect(0, 0, w, h);
  }
  g.fillStyle = color;
  g.font = font;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + h * 0.04);
  return new THREE.CanvasTexture(c);
}

// ---------- The car ----------
// Coordinates: x = left, y = up, z = forward. Front axle z = 1.75, rear axle z = -1.65.
function buildCarModel(team, shadowTex, drv) {
  const root = new THREE.Group();
  const body = new THREE.Group();          // static parts, merged at the end
  const textures = [];
  const tex = (draw, w = 512, h = 256) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.anisotropy = 8; textures.push(t);
    return t;
  };
  // Physically based materials: clear-coated paint (matte for Red Bull), carbon, metal, rubber.
  const matte = team.gloss < 30;
  const paintOpts = { metalness: 0.15, roughness: matte ? 0.55 : 0.32, clearcoat: matte ? 0 : 0.8, clearcoatRoughness: 0.08, envMapIntensity: 0.6 };
  const paint = map => new THREE.MeshPhysicalMaterial({ map, ...paintOpts });
  const solid = c => new THREE.MeshPhysicalMaterial({ color: c, ...paintOpts });
  const bodyMat = paint(tex((g, w, h) => paintLivery(g, w, h, team, 'body'), 1024, 256));
  const podMat = paint(tex((g, w, h) => paintLivery(g, w, h, team, 'pod')));
  const carbon = new THREE.MeshStandardMaterial({ metalness: 0.35, roughness: 0.38, map: tex((g, w, h) => {
    g.fillStyle = '#16171a'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.06)';
    for (let y = 0; y < h; y += 4) for (let x = (y / 4) % 2 * 4; x < w; x += 8) g.fillRect(x, y, 4, 4);   // weave
  }, 64, 64) });
  const black = new THREE.MeshStandardMaterial({ color: 0x0a0a0b, roughness: 0.65, metalness: 0.1 });
  const glass = new THREE.MeshStandardMaterial({ color: 0xd8e2ea, roughness: 0.04, metalness: 1 });
  const wingMat = solid(team.wing), accentMat = solid(team.accent), plateMat = solid(team.plate);
  const flapMat = solid(team.flap || team.accent), bodySolid = solid(team.body);
  const add = (geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, parent = body) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
    parent.add(m);
    return m;
  };

  // Survival cell, long slim nose, cockpit surround and engine cover as one smooth body.
  add(loft([
    [3.18, 0, 0.05, 0.13, 0.2], [2.95, 0, 0.09, 0.13, 0.25], [2.55, 0, 0.14, 0.15, 0.36], [2.1, 0, 0.19, 0.17, 0.47],
    [1.6, 0, 0.27, 0.17, 0.57], [1.15, 0, 0.36, 0.15, 0.64], [0.7, 0, 0.41, 0.14, 0.67], [0.2, 0, 0.41, 0.14, 0.69],
    [-0.2, 0, 0.39, 0.14, 0.78], [-0.45, 0, 0.3, 0.15, 0.96], [-0.8, 0, 0.27, 0.17, 0.9], [-1.3, 0, 0.22, 0.19, 0.72],
    [-1.8, 0, 0.15, 0.23, 0.55], [-2.25, 0, 0.08, 0.28, 0.42], [-2.5, 0, 0.03, 0.32, 0.37],
  ], 28, 3), bodyMat);
  // Cockpit opening, headrest pads, airbox intake, blade roll hoop, T-cam, antennae
  add(new THREE.CircleGeometry(1, 28), black, 0, 0.693, 0.32, -Math.PI / 2).scale.set(0.23, 0.44, 1);
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.06, 0.06, 0.28), black, s * 0.17, 0.7, 0.02);
  add(new THREE.CircleGeometry(1, 3), black, 0, 0.885, -0.27, -0.35).scale.set(0.11, 0.09, 1);
  add(sidePlate([[-0.18, 0.99], [-0.62, 0.99], [-0.66, 0.86], [-0.3, 0.86]], 0.05), bodySolid);
  const firstCar = drv && DRIVERS.filter(d => d.team === team.id)[0] === drv;
  add(new THREE.BoxGeometry(0.07, 0.05, 0.17), new THREE.MeshStandardMaterial({ color: firstCar ? 0x111111 : 0xe9ff2a, roughness: 0.4 }), 0, 1.04, -0.36);
  add(new THREE.CylinderGeometry(0.004, 0.004, 0.25, 4), carbon, 0.1, 0.88, -0.95);
  add(new THREE.CylinderGeometry(0.004, 0.004, 0.18, 4), carbon, -0.1, 0.86, -1.1);
  // Nose: pitot tube, camera pods
  add(new THREE.CylinderGeometry(0.006, 0.006, 0.3, 5), carbon, 0, 0.2, 3.3, Math.PI / 2);
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.035, 0.05, 0.14), carbon, s * 0.15, 0.4, 2.3);

  // Sidepods: high letterbox inlets, deep undercut, downwash ramp; louvres, mirrors, floor fences
  for (const s of [-1, 1]) {
    add(loft([
      [0.86, s * 0.62, 0.17, 0.36, 0.58], [0.65, s * 0.63, 0.24, 0.27, 0.6], [0.2, s * 0.62, 0.26, 0.24, 0.58],
      [-0.3, s * 0.58, 0.24, 0.22, 0.5], [-0.85, s * 0.5, 0.19, 0.2, 0.4], [-1.3, s * 0.4, 0.12, 0.2, 0.32],
      [-1.7, s * 0.3, 0.04, 0.22, 0.26],
    ], 22, 3.4), podMat);
    add(new THREE.PlaneGeometry(0.3, 0.17), black, s * 0.62, 0.47, 0.865);              // letterbox inlet
    for (let k = 0; k < 6; k++) add(new THREE.BoxGeometry(0.17, 0.01, 0.025), black, s * 0.6, 0.575 - k * 0.012, -0.05 - k * 0.08, 0.25);
    add(new THREE.BoxGeometry(0.2, 0.09, 0.07), bodySolid, s * 0.53, 0.77, 0.86);       // mirror housing
    add(new THREE.PlaneGeometry(0.18, 0.075), glass, s * 0.53, 0.77, 0.824, 0, Math.PI);
    body.add(rod([s * 0.36, 0.64, 0.9], [s * 0.47, 0.76, 0.87], 0.011, carbon));
    body.add(rod([s * 0.36, 0.64, 0.8], [s * 0.47, 0.75, 0.84], 0.009, carbon));
    for (let k = 0; k < 3; k++) add(new THREE.BoxGeometry(0.01, 0.17, 0.44), carbon, s * (0.3 + k * 0.1), 0.17, 1.14 - k * 0.04);
    add(new THREE.BoxGeometry(0.012, 0.12, 0.3), carbon, s * 0.72, 0.15, 2.05);         // wheel-wake deflector
  }

  // Short shark fin
  add(sidePlate([[-0.6, 0.92], [-1.75, 0.6], [-1.75, 0.55], [-0.7, 0.8]], 0.012), bodySolid);

  // Halo with central pillar (separate so the cockpit camera can hide it)
  const halo = new THREE.Group();
  add(new THREE.TorusGeometry(0.36, 0.036, 10, 32, Math.PI), bodySolid, 0, 0.93, 0.2, Math.PI / 2, 0, 0, halo);
  halo.add(rod([0, 0.93, 0.56], [0, 0.68, 0.78], 0.032, bodySolid));
  for (const s of [-1, 1]) halo.add(rod([s * 0.36, 0.93, 0.2], [s * 0.37, 0.7, 0.05], 0.03, bodySolid));
  root.add(halo);

  // Floor, plank, floor-edge wings, diffuser with strakes, crash structure
  const floorShape = new THREE.Shape([[-0.25, 2.1], [0.25, 2.1], [0.72, 1.15], [0.82, -1.0], [0.58, -2.0], [-0.58, -2.0], [-0.82, -1.0], [-0.72, 1.15]]
    .map(([x, z]) => new THREE.Vector2(x, z)));
  add(new THREE.ExtrudeGeometry(floorShape, { depth: 0.035, bevelEnabled: false }).rotateX(Math.PI / 2), carbon, 0, 0.09, 0);
  add(new THREE.BoxGeometry(0.3, 0.02, 2.9), new THREE.MeshStandardMaterial({ color: 0x6b5a3e, roughness: 0.8 }), 0, 0.045, -0.2);
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(0.06, 0.05, 1.7), carbon, s * 0.81, 0.1, -0.2, 0, 0, -s * 0.35);
    add(new THREE.BoxGeometry(0.012, 0.09, 1.2), carbon, s * 0.84, 0.15, -0.3);
  }
  add(new THREE.BoxGeometry(1.05, 0.02, 0.62), carbon, 0, 0.19, -2.18, -0.35);
  for (const x of [-0.46, -0.27, -0.09, 0.09, 0.27, 0.46]) add(new THREE.BoxGeometry(0.01, 0.2, 0.55), carbon, x, 0.18, -2.15);
  add(new THREE.BoxGeometry(0.18, 0.16, 0.34), carbon, 0, 0.33, -2.32);

  // Front wing: four airfoil elements, nose pillars, shaped endplates, under-wing fences
  add(airfoil(0.32, 1.98, 0.04), wingMat, 0, 0.07, 3.25);
  add(airfoil(0.24, 1.94, 0.22), wingMat, 0, 0.11, 3.0);
  add(airfoil(0.2, 1.86, 0.42, 0.03), wingMat, 0, 0.16, 2.84);
  add(airfoil(0.16, 1.74, 0.62, 0.025), accentMat, 0, 0.22, 2.72);
  for (const s of [-1, 1]) {
    add(sidePlate([[3.0, 0.09], [2.72, 0.09], [2.72, 0.2], [2.95, 0.18]], 0.012), carbon, s * 0.09);
    add(sidePlate([[3.3, 0.04], [2.62, 0.04], [2.56, 0.32], [2.85, 0.36], [3.18, 0.2]], 0.02), team.id === 'ferrari' ? bodySolid : plateMat, s * 1.0);
    add(new THREE.BoxGeometry(0.01, 0.12, 0.3), carbon, s * 0.85, 0.09, 3.05);
  }

  // Rear wing (2026: no beam wing): main plane + flap, tall endplates, swan necks, actuator
  add(airfoil(0.38, 1.02, 0.1, 0.045), wingMat, 0, 0.86, -2.15);
  add(airfoil(0.24, 1.02, 0.5, 0.03), flapMat, 0, 0.97, -2.45);
  add(new THREE.BoxGeometry(0.08, 0.07, 0.14), carbon, 0, 1.05, -2.5);
  for (const s of [-1, 1]) {
    add(sidePlate([[-1.95, 0.34], [-2.7, 0.34], [-2.72, 1.04], [-2.05, 1.07], [-1.92, 0.74]], 0.02), plateMat, s * 0.52);
    body.add(rod([s * 0.07, 0.42, -2.0], [s * 0.07, 1.0, -2.36], 0.017, carbon));
  }

  // Suspension: wishbones, pushrods, track rods, brake ducts with winglets
  for (const s of [-1, 1]) {
    for (const [z, inX, upY, loY, outX] of [[1.75, 0.24, 0.52, 0.24, 0.72], [-1.65, 0.24, 0.48, 0.24, 0.7]]) {
      for (const dz of [0.22, -0.22]) {
        body.add(rod([s * inX, upY, z + dz], [s * outX, upY - 0.05, z], 0.017, carbon));
        body.add(rod([s * inX, loY, z + dz], [s * (outX + 0.02), loY, z], 0.017, carbon));
      }
      body.add(rod([s * (outX - 0.04), loY + 0.02, z], [s * inX, upY + 0.05, z - 0.12], 0.015, carbon));
      body.add(rod([s * inX, loY + 0.1, z + 0.12], [s * outX, loY + 0.12, z + 0.06], 0.01, carbon));
      add(new THREE.CylinderGeometry(0.17, 0.17, 0.12, 18), black, s * (outX - 0.08), 0.36, z, 0, 0, Math.PI / 2);
      add(new THREE.BoxGeometry(0.1, 0.012, 0.16), carbon, s * (outX - 0.12), 0.56, z);
    }
  }

  // Rain / brake light
  const brakeMat = new THREE.MeshBasicMaterial({ color: 0x440000 });
  const rain = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.07, 0.03), brakeMat);
  rain.position.set(0, 0.36, -2.5);
  root.add(rain);

  // Decals: number on the nose and on engine-cover panels, team name on sidepods and endplates
  const decal = (map, w, h) => new THREE.Mesh(new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ map, transparent: true, depthWrite: false, roughness: 0.35, polygonOffset: true, polygonOffsetFactor: -2 }));
  const font = '900 64px Segoe UI, Arial';
  if (drv) {
    const light = ['rb', 'haas'].includes(team.id);
    const numTex = textTexture(String(drv.num), 128, 128, light ? hexCss(team.second) : '#ffffff', null, 'italic 900 96px Segoe UI, Arial');
    const panelTex = textTexture(String(drv.num), 160, 100, '#111111', '#f2f2f2', 'italic 900 78px Segoe UI, Arial', 16);
    textures.push(numTex, panelTex);
    const nose = decal(numTex, 0.2, 0.2);
    nose.position.set(0, 0.395, 2.45); nose.rotation.set(-Math.PI / 2 + 0.24, 0, Math.PI);
    root.add(nose);
    for (const s of [-1, 1]) {
      const p = decal(panelTex, 0.3, 0.19);
      p.position.set(s * 0.262, 0.6, -1.0); p.rotation.y = s * Math.PI / 2;
      root.add(p);
    }
  }
  const nameTex = textTexture(team.name.toUpperCase(), 512, 128, '#ffffff', null, font);
  const plateTex = team.plate > 0xd00000 && (team.plate & 0xff) > 0xd0
    ? textTexture(team.name.toUpperCase(), 512, 128, '#111111', null, font) : nameTex;   // dark text on white endplates
  textures.push(nameTex, plateTex);
  for (const s of [-1, 1]) {
    const ep = decal(plateTex, 0.66, 0.165);
    ep.position.set(s * 0.532, 0.8, -2.32); ep.rotation.y = s * Math.PI / 2;
    root.add(ep);
    const pod = decal(nameTex, 0.45, 0.11);
    pod.position.set(s * 0.875, 0.42, 0.1); pod.rotation.y = s * Math.PI / 2;
    root.add(pod);
  }

  // Driver: shaped helmet shell in the driver's design, tinted visor, rear spoiler, top intake.
  const helmet = new THREE.Group();
  helmet.position.set(0, 0.75, 0.22);
  helmet.rotation.x = 0.1;   // head tipped slightly forward, as in the car
  const hSpec = (drv && HELMETS[drv.code]) || { base: team.helmet, a: team.stripe, b: team.accent, style: 'bands' };
  const shellMat = new THREE.MeshPhysicalMaterial({
    map: tex((g, w, h) => paintHelmet(g, w, h, hSpec, drv), 1024, 512), roughness: 0.3, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.04,
  });
  add(shapeHelmet(new THREE.SphereGeometry(HELMET_R, 48, 32, 0, Math.PI * 2, 0, HELMET_THETA)), shellMat, 0, 0, 0, 0, 0, 0, helmet);
  const visorMat = new THREE.MeshPhysicalMaterial({
    map: tex((g, w, h) => paintVisor(g, w, h, hSpec.b), 128, 64), roughness: 0.04, metalness: 0.85, clearcoat: 1, clearcoatRoughness: 0,
  });
  add(shapeHelmet(new THREE.SphereGeometry(HELMET_R * 1.012, 32, 10, Math.PI / 2 - VISOR.phi, VISOR.phi * 2, VISOR.t0, VISOR.t1 - VISOR.t0)),
    visorMat, 0, 0, 0, 0, 0, 0, helmet);
  const trim = new THREE.MeshStandardMaterial({ color: 0x111215, roughness: 0.5, metalness: 0.2 });
  for (const s of [-1, 1]) {   // visor pivots and tear-off tab
    add(new THREE.CylinderGeometry(0.014, 0.014, 0.008, 16), trim, s * 0.136, -0.012, 0.012, 0, 0, Math.PI / 2, helmet);
  }
  add(new THREE.BoxGeometry(0.012, 0.03, 0.006), trim, -0.115, 0.005, 0.105, 0, -0.75, 0, helmet);
  const spoilerMat = new THREE.MeshPhysicalMaterial({ color: hSpec.a, roughness: 0.3, clearcoat: 1 });
  add(taperBox(0.13, 0.008, 0.05, [0.85, 1], [1, 1]), spoilerMat, 0, 0.122, -0.095, -0.55, 0, 0, helmet);     // rear spoiler
  add(new THREE.BoxGeometry(0.11, 0.004, 0.012), spoilerMat, 0, 0.123, -0.12, 0.6, 0, 0, helmet);            // spoiler gurney
  add(taperBox(0.05, 0.016, 0.045, [0.6, 0.3], [1, 1]), trim, 0, 0.143, 0.035, -0.12, 0, 0, helmet);       // top air intake
  add(new THREE.CylinderGeometry(0.1, 0.12, 0.06, 24), trim, 0, -0.15, -0.01, 0, 0, 0, helmet);             // HANS collar / neck
  root.add(helmet);

  // Wheels: rounded tyres with sidewall detail, metal wheel covers with a team-coloured ring
  const rubber = new THREE.MeshStandardMaterial({ color: 0x131313, roughness: 0.88, metalness: 0, map: tex((g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#d0d0d0';
    for (const y of [0.18, 0.82]) g.fillRect(0, h * y, w, h * 0.03);     // moulding rings on the sidewalls
  }, 64, 64) });
  const coverMat = new THREE.MeshStandardMaterial({ metalness: 0.75, roughness: 0.32, map: tex((g, w, h) => {
    const r = w / 2;
    g.fillStyle = '#2a2d32'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#3a3e44';
    for (let k = 0; k < 10; k++) { g.save(); g.translate(r, r); g.rotate(k / 10 * Math.PI * 2); g.fillRect(-4, r * 0.25, 8, r * 0.66); g.restore(); }
    g.strokeStyle = hexCss(team.plate); g.lineWidth = 7;
    g.beginPath(); g.arc(r, r, r * 0.9, 0, Math.PI * 2); g.stroke();
    g.fillStyle = hexCss(team.accent); g.beginPath(); g.arc(r, r, r * 0.16, 0, Math.PI * 2); g.fill();
  }, 128, 128) });
  const tyreGeo = w => {
    const R = 0.36, h = w / 2, prof = [[0.235, -h], [0.3, -h - 0.008], [0.345, -h + 0.025], [R, -h + 0.07], [R, h - 0.07], [0.345, h - 0.025], [0.3, h + 0.008], [0.235, h]];
    return new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 40).rotateZ(Math.PI / 2);
  };
  const wheels = [], frontPivots = [];
  const makeWheel = (w, side) => {
    const wg = new THREE.Group();
    wg.add(new THREE.Mesh(tyreGeo(w), rubber));
    for (const f of [-1, 1]) {   // inner disc so you can't see through the rim
      const d = new THREE.Mesh(new THREE.CircleGeometry(0.24, 24), black);
      d.position.x = f * (w / 2 - 0.02); d.rotation.y = f * Math.PI / 2; wg.add(d);
    }
    const cover = new THREE.Mesh(new THREE.CircleGeometry(0.235, 32), coverMat);
    cover.position.x = side * (w / 2 + 0.004); cover.rotation.y = side * Math.PI / 2;
    wg.add(cover);
    return wg;
  };
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.8, 0.36, 1.75);
    const fw = makeWheel(0.3, s);
    pivot.add(fw); root.add(pivot);
    frontPivots.push(pivot); wheels.push(fw);
    const rw = makeWheel(0.38, s);
    rw.position.set(s * 0.77, 0.36, -1.65);
    root.add(rw); wheels.push(rw);
  }

  root.add(mergeByMaterial(body));
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 6.2),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.06;
  root.add(shadow);
  root.userData.textures = textures;

  return { group: root, wheels, frontPivots, brakeMat, cockpitHide: [helmet, halo], shadow };
}

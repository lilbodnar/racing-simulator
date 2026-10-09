(() => {
  'use strict';

  // ---------- Settings ----------
  const RACE_LAPS = 2;
  const SPACING = 2;                 // metres between centerline samples
  const MASS = 800;                  // kg
  const POWER = 750000;              // W
  const WHEELBASE = 3.6;             // m
  const IDLE_RPM = 4000, REDLINE = 12500, OVERREV = REDLINE * 1.6;   // no limiter: revs can run past the redline
  const GEAR_TOP = [0, 95, 135, 170, 205, 240, 275, 310, 345].map(k => k / 3.6); // m/s per gear
  const CAMERAS = ['Chase', 'Roof (T-cam)', 'Cockpit'];
  const OT_POWER = 350000;           // overtake mode: extra electric power (W)
  const OT_DRAIN = 0.12, OT_REGEN = 0.1;   // battery use per second boosting / recharge per second at full brake
  // How each surface behaves: tyre grip (base + aero term, as m/s^2), rolling drag (base + per m/s),
  // body bounce and camera shake. Grass is slippery but doesn't slow you much; gravel digs in.
  const SURFACES = {
    track:  { grip: [13, 0.0035], turn: [19, 0.0045], drag: [0, 0],     bump: 0,     shake: 0,    label: '' },
    kerb:   { grip: [12, 0.0032], turn: [17, 0.004],  drag: [0, 0],     bump: 0.012, shake: 0.03, label: '' },
    runoff: { grip: [11, 0.003],  turn: [16, 0.0038], drag: [0.2, 0],   bump: 0.004, shake: 0.01, label: 'OFF TRACK' },
    grass:  { grip: [4.2, 0.0012], turn: [6.5, 0.0018], drag: [0.6, 0.025], bump: 0.025, shake: 0.06, label: 'GRASS' },
    // Base drag must stay well under base grip, or a stopped car can never drive out.
    sand:   { grip: [3.6, 0.001],  turn: [4.0, 0.0011], drag: [1.4, 0.08],  bump: 0.03,  shake: 0.1,  label: 'SAND' },
    gravel: { grip: [3.2, 0.0008], turn: [3.5, 0.0009], drag: [1.2, 0.12],  bump: 0.04,  shake: 0.15, label: 'GRAVEL' },
  };
  const PIT_SAMPLES = 110;           // pit lane runs this many samples either side of the start line
  const GANTRY_S = 12;               // start-light gantry this many metres past the start line
  const RUNOFF = 26;                 // outer barrier distance past the track edge on permanent circuits
  const GRAVEL = 22;                 // gravel trap width past the track edge
  const SEASON_YEAR = 2026;

  // In-memory records: { [trackId]: { bestLap, bestRace } } - gone when the page reloads.
  const records = {};
  // Last driver raced, remembered across visits (Lando Norris on a first visit).
  const LAST_DRIVER_KEY = 'racing-sim-last-driver';
  let lastDriverCode = 'NOR';
  try { lastDriverCode = localStorage.getItem(LAST_DRIVER_KEY) || 'NOR'; } catch (e) { /* storage blocked */ }
  let selectedDriver = DRIVERS.find(d => d.code === lastDriverCode) || DRIVERS[0];
  let selectedTeam = teamOf(selectedDriver);
  let raceMode = 'grid';             // 'solo' or 'grid'
  let difficulty = 'medium';
  let field = null;                  // AI cars in a full-grid race
  let playerS = 0;                   // player's distance raced (same measure as the AI's s)
  let weather = 'sunny';             // key of WEATHERS, remembered between visits
  try { const w = localStorage.getItem('weather'); if (w in WEATHERS) weather = w; } catch (e) { /* storage blocked */ }
  // Online play (see the Multiplayer section).
  const mp = {
    active: false, host: false,       // in an online session (lobby or race); hosting it
    name: '',                         // your name, remembered between visits
    players: [],                      // lobby: [{ id, name, drv }], the host is 'host'
    settings: { track: TRACKS[0].id, weather: 'sunny', fill: true, difficulty: 'medium' },
    lobbyRacing: false,               // guest: a race was already running when the lobby last changed
    racing: false, started: false,    // an online race is on; its lights have gone out
    clock: 0,                         // seconds since lights out (the AI's clock)
    lineup: [],                       // who's in the race being run
    remotes: new Map(),               // id -> another person's car
    raw: new Map(),                   // host: id -> latest state from that guest, to pass on
    lat: 0, lats: new Map(),          // one-way delay (ms) guest <-> host: guest's own, host's per guest
    ready: new Set(), readyTimer: 0, goSent: false, goT: 0,
    sendT: 0, pingT: 0, resultsT: 0,
  };
  try { mp.name = localStorage.getItem('racing-sim-name') || ''; } catch (e) {}

  const $ = id => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const approach = (v, target, step) => v < target ? Math.min(target, v + step) : Math.max(target, v - step);
  const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));
  function fmt(t) {
    if (t == null || !isFinite(t)) return '--';
    const m = Math.floor(t / 60), s = t - m * 60;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(3);
  }

  // ---------- Renderer & scene ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  const isTouch = matchMedia('(pointer: coarse)').matches;
  if (isTouch) document.body.classList.add('touch');
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isTouch ? 1.5 : 2));   // phones: fewer pixels, smoother frame rate
  renderer.setSize(innerWidth, innerHeight);
  $('game').appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xc4dcf0);
  scene.fog = new THREE.Fog(0xc4dcf0, 900, 7000);
  const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.3, 12000);
  const hemi = new THREE.HemisphereLight(0xe6f2ff, 0x456b2a, 0.8);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 0.7);
  sun.position.set(300, 600, 200);
  scene.add(sun);
  const wfx = createWeatherFx(scene);

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  // ---------- Procedural textures ----------
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = maxAniso;
    return t;
  }
  function speckle(g, w, h, base, amp, count, size) {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < count; i++) {
      const v = (Math.random() - 0.5) * amp;
      g.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`;
      g.fillRect(Math.random() * w | 0, Math.random() * h | 0, size, size);
    }
  }

  const roadTex = canvasTex(256, 512, (g, w, h) => {
    speckle(g, w, h, '#4a4a4e', 0.2, 30000, 2);
    g.fillStyle = '#f2f2f2';
    g.fillRect(3, 0, 8, h);
    g.fillRect(w - 11, 0, 8, h);
  });
  roadTex.wrapS = THREE.ClampToEdgeWrapping;
  roadTex.wrapT = THREE.RepeatWrapping;

  const pitTex = canvasTex(64, 64, (g, w, h) => speckle(g, w, h, '#55565a', 0.15, 2000, 2));
  pitTex.wrapS = pitTex.wrapT = THREE.RepeatWrapping;

  const gravelTex = canvasTex(128, 128, (g, w, h) => speckle(g, w, h, '#c8b48a', 0.35, 9000, 2));
  gravelTex.wrapS = gravelTex.wrapT = THREE.RepeatWrapping;

  const kerbTex = canvasTex(32, 64, (g, w, h) => {
    g.fillStyle = '#d42020'; g.fillRect(0, 0, w, h / 2);
    g.fillStyle = '#f4f4f4'; g.fillRect(0, h / 2, w, h / 2);
  });
  kerbTex.wrapS = THREE.ClampToEdgeWrapping;
  kerbTex.wrapT = THREE.RepeatWrapping;

  const checkerTex = canvasTex(256, 32, (g, w, h) => {
    const s = 16;
    for (let x = 0; x < w / s; x++) for (let y = 0; y < h / s; y++) {
      g.fillStyle = (x + y) % 2 ? '#111' : '#fff';
      g.fillRect(x * s, y * s, s, s);
    }
  });

  // Street-circuit / pit wall barrier: steel rails on top of panels (6 m per repeat).
  const wallTex = canvasTex(256, 64, (g, w, h) => {
    speckle(g, w, h, '#c9cdd2', 0.12, 3000, 2);
    g.fillStyle = '#1f4fa8'; g.fillRect(0, 26, w / 2, 30);
    g.fillStyle = '#f2f2f2'; g.fillRect(w / 2, 26, w / 2, 30);
    g.fillStyle = '#8d949c'; g.fillRect(0, 0, w, 8); g.fillRect(0, 14, w, 8);
    g.fillStyle = '#5c636b'; g.fillRect(0, 8, w, 2); g.fillRect(0, 22, w, 2);
  });
  wallTex.wrapS = THREE.RepeatWrapping;

  // Run-off barrier on permanent circuits: armco over stacked tyres with a coloured belt.
  const tyreWallTex = canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = '#9ba1a7'; g.fillRect(0, 0, w, 14);
    g.fillStyle = '#1a1a1a'; g.fillRect(0, 14, w, h - 14);
    g.fillStyle = '#2b2b2b';
    for (let x = 6; x < w; x += 14) for (let y = 22; y < h; y += 14) { g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); }
    g.fillStyle = '#d62828'; g.fillRect(0, 30, w / 2, 10);
    g.fillStyle = '#f2f2f2'; g.fillRect(w / 2, 30, w / 2, 10);
  });
  tyreWallTex.wrapS = THREE.RepeatWrapping;

  const concreteTex = canvasTex(64, 64, (g, w, h) => speckle(g, w, h, '#a9a49b', 0.15, 2000, 2));
  concreteTex.wrapS = concreteTex.wrapT = THREE.RepeatWrapping;

  const shadowTex = canvasTex(64, 128, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(0,0,0,0.55)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.save(); g.scale(1, 2); g.fillStyle = grd; g.fillRect(0, 0, w, h / 2); g.restore();
  });

  // ---------- Track ----------
  let T = null;            // current track data
  let trackGroup = null;
  let scenery = null;
  let gantryLights = [];

  function prepareTrack(def) {
    const raw = buildCenterline(def, SPACING);
    const N = raw.length;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of raw) {
      minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
      minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
    }
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const d = {
      def, n: N, hw: def.width / 2,
      x: new Float32Array(N), z: new Float32Array(N), y: new Float32Array(N),
      g: new Float32Array(N), lift: new Float32Array(N),   // ground height, bridge height above ground
      nx: new Float32Array(N), nz: new Float32Array(N),
      hd: new Float32Array(N), dist: new Float32Array(N), kerb: new Uint8Array(N),
      curv: new Float32Array(N), turn: new Float32Array(N), gravel: new Int8Array(N),
      wallL: new Float32Array(N), wallR: new Float32Array(N), over: new Uint8Array(N),
    };
    // World: x east, -z north, y up.
    for (let i = 0; i < N; i++) {
      d.x[i] = raw[i][0] - cx; d.z[i] = -(raw[i][1] - cy);
      d.y[i] = raw[i][2]; d.g[i] = raw[i][3]; d.lift[i] = raw[i][2] - raw[i][3];
    }
    let total = 0;
    for (let i = 0; i < N; i++) {
      const a = (i - 1 + N) % N, b = (i + 1) % N;
      let tx = d.x[b] - d.x[a], tz = d.z[b] - d.z[a];
      const l = Math.hypot(tx, tz) || 1;
      tx /= l; tz /= l;
      d.nx[i] = tz; d.nz[i] = -tx;        // left-hand normal
      d.hd[i] = Math.atan2(tx, tz);
      d.dist[i] = total;
      total += Math.hypot(d.x[b] - d.x[i], d.z[b] - d.z[i]);
    }
    d.total = total;
    d.fromMap = (x, y) => [x * raw.scale - cx, -(y * raw.scale - cy)];   // track-data map coords -> world
    d.index = makeTrackIndex(d);
    d.pitSamples = PIT_SAMPLES;

    // Corners: kerbs on both sides, gravel on the outside (turn > 0 means a left-hander).
    for (let i = 0; i < N; i++) {
      d.turn[i] = wrapAngle(d.hd[(i + 4) % N] - d.hd[(i - 4 + N) % N]) / (8 * SPACING);
      d.curv[i] = Math.abs(d.turn[i]);
    }
    for (let i = 0; i < N; i++) {
      if (d.curv[i] > 1 / 280) for (let o = -8; o <= 8; o++) d.kerb[(i + o + N) % N] = 1;
      if (d.curv[i] > 1 / 220 && d.lift[i] < 0.3) {
        const outside = d.turn[i] > 0 ? -1 : 1;
        for (let o = -6; o <= 14; o++) d.gravel[(i + o + N) % N] = outside;
      }
    }
    const inPit = i => i <= PIT_SAMPLES || i >= N - PIT_SAMPLES;

    // Is this sample on a bridge above another part of the track?
    for (let i = 0; i < N; i++) {
      if (d.lift[i] < 3) continue;
      for (let j = 0; j < N; j += 2) {
        if (d.y[i] - d.y[j] > 3 && Math.hypot(d.x[i] - d.x[j], d.z[i] - d.z[j]) < d.hw * 2 + 6) { d.over[i] = 1; break; }
      }
    }

    // Barriers, per side and per sample (0 = none). Dropped wherever they would cut across
    // another part of the track at the same level.
    for (const [side, arr] of [[1, d.wallL], [-1, d.wallR]]) {
      for (let i = 0; i < N; i++) {
        let off;
        if (def.walls) off = d.hw + def.walls.offset;
        else if (d.lift[i] > 0.4) off = d.hw + 0.8;              // bridge parapet
        else if (side === -1 && inPit(i)) off = d.hw + 1.5;      // pit wall
        else off = d.hw + RUNOFF;
        const wx = d.x[i] + d.nx[i] * side * off, wz = d.z[i] + d.nz[i] * side * off;
        if (d.index.nearest(wx, wz, off + 5, d.y[i]) < off - 0.3) off = 0;
        arr[i] = off;
      }
    }
    return d;
  }

  // Strip along the centerline between lateral offsets offA (left) and offB (right),
  // following the track height plus yOff.
  function ribbon(offA, offB, yOff, vLen, include) {
    const N = T.n, pos = [], uv = [], nor = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const k = i % N, dd = i === N ? T.total : T.dist[k], y = T.y[k] + yOff;
      pos.push(T.x[k] + T.nx[k] * offA, y, T.z[k] + T.nz[k] * offA,
               T.x[k] + T.nx[k] * offB, y, T.z[k] + T.nz[k] * offB);
      uv.push(0, dd / vLen, 1, dd / vLen);
      nor.push(0, 1, 0, 0, 1, 0);
    }
    for (let i = 0; i < N; i++) {
      if (include && !include(i)) continue;
      const a = 2 * i, b = a + 1, c = a + 2, e = a + 3;
      idx.push(a, b, c, b, e, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setIndex(idx);
    return g;
  }

  // Vertical strip along one side at per-sample offsets offs[i] (0 = gap), from bottom(k) to top(k).
  function wallGeometry(side, offs, bottom, top, include) {
    const N = T.n, pos = [], uv = [], nor = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const k = i % N, dd = i === N ? T.total : T.dist[k], off = offs[k] || 0;
      const x = T.x[k] + T.nx[k] * side * off, z = T.z[k] + T.nz[k] * side * off;
      pos.push(x, bottom(k), z, x, top(k), z);
      uv.push(dd / 6, 0, dd / 6, 1);
      nor.push(-T.nx[k] * side, 0, -T.nz[k] * side, -T.nx[k] * side, 0, -T.nz[k] * side);
    }
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      if (!offs[i] || !offs[j] || Math.abs(offs[i] - offs[j]) > 1) continue;
      if (include && !include(i)) continue;
      const a = 2 * i;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setIndex(idx);
    return g;
  }

  // Painted grid boxes: a white bracket in front of each slot (bar across, short legs back) and
  // the grid position, readable from the car behind it. Quads follow the track's curve and height.
  function addGridBoxes() {
    const pos = [], idx = [], nor = [];
    const quad = (s, d, a0, a1, l0, l1) => {      // along a0..a1 and lateral l0..l1 from slot (s, d)
      const b = pos.length / 3;
      for (const [a, l] of [[a0, l0], [a0, l1], [a1, l0], [a1, l1]]) {
        const p = trackPose(T, s + a, d + l);
        pos.push(p.x, p.y + 0.065, p.z); nor.push(0, 1, 0);
      }
      idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
    };
    const W = 1.3, FRONT = HALF_L + 0.4, LEG = 1.6, T_ = 0.2;
    for (let k = 0; k < DRIVERS.length; k++) {
      const { s, d } = gridSlot(T, k);
      quad(s, d, FRONT - T_, FRONT, -W, W);                    // bar across the front
      quad(s, d, FRONT - LEG, FRONT - T_, W - T_, W);           // legs
      quad(s, d, FRONT - LEG, FRONT - T_, -W, -W + T_);
      const tex = canvasTex(128, 64, (g, w, h) => {
        g.fillStyle = '#fff'; g.font = '900 54px Segoe UI, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(String(k + 1), w / 2, h / 2 + 3);
      });
      const num = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8).rotateX(-Math.PI / 2),
        new THREE.MeshLambertMaterial({ map: tex, transparent: true, depthWrite: false }));
      const p = trackPose(T, s + FRONT + 0.7, d);
      num.position.set(p.x, p.y + 0.066, p.z);
      num.rotation.y = p.h + Math.PI;                           // top of the digits points down the track
      num.userData.textures = [tex];
      trackGroup.add(num);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setIndex(idx);
    trackGroup.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0xf2f2f2, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })));
  }

  function disposeGroup(group) {
    group.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach(m => m.dispose());
      if (o.userData.textures) o.userData.textures.forEach(t => t.dispose());
    });
  }

  function buildTrackScene(def) {
    if (trackGroup) { scene.remove(trackGroup); disposeGroup(trackGroup); }
    T = prepareTrack(def);
    trackGroup = new THREE.Group();
    const add = (geo, mat) => trackGroup.add(new THREE.Mesh(geo, mat));

    // Asphalt (white edge lines are painted in the texture); double-sided so bridges have an underside.
    T.roadMat = new THREE.MeshLambertMaterial({ map: roadTex, side: THREE.DoubleSide });
    add(ribbon(T.hw, -T.hw, 0.03, 16, null), T.roadMat);

    // Kerbs
    const kerbMat = new THREE.MeshLambertMaterial({ map: kerbTex });
    const isKerb = i => T.kerb[i];
    const kerbW = def.walls ? Math.min(1.5, def.walls.offset - 0.1) : 1.5;
    T.kerbW = kerbW;
    add(ribbon(T.hw + kerbW, T.hw - 0.2, 0.05, 4, isKerb), kerbMat);
    add(ribbon(-T.hw + 0.2, -T.hw - kerbW, 0.05, 4, isKerb), kerbMat);

    if (!def.walls) {
      // Gravel traps on the outside of corners
      const gravelMat = new THREE.MeshLambertMaterial({ map: gravelTex, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
      add(ribbon(T.hw + GRAVEL, T.hw + 1.4, 0.035, 8, i => T.gravel[i] === 1), gravelMat);
      add(ribbon(-T.hw - 1.4, -T.hw - GRAVEL, 0.035, 8, i => T.gravel[i] === -1), gravelMat);
    }

    // Barriers: panels for street circuits, pit walls and bridges; tyre walls at the edge of run-off.
    const base = k => T.y[k], top = k => T.y[k] + 1.1;
    const isOuter = (side, i) => (side > 0 ? T.wallL : T.wallR)[i] > T.hw + 10 && !def.walls;
    const panelMat = new THREE.MeshLambertMaterial({ map: wallTex, side: THREE.DoubleSide });
    const tyreMat = new THREE.MeshLambertMaterial({ map: tyreWallTex, side: THREE.DoubleSide });
    for (const [side, arr] of [[1, T.wallL], [-1, T.wallR]]) {
      add(wallGeometry(side, arr, base, top, i => !isOuter(side, i)), panelMat);
      add(wallGeometry(side, arr, base, top, i => isOuter(side, i)), tyreMat);
    }

    // Bridges: concrete deck underside and side skirts down to the ground.
    if (T.lift.some(v => v > 0.4)) {
      const concrete = new THREE.MeshLambertMaterial({ map: concreteTex, side: THREE.DoubleSide });
      add(ribbon(T.hw + 0.9, -T.hw - 0.9, -0.9, 8, i => T.lift[i] > 1), concrete);
      const skirtBottom = k => T.over[k] ? T.y[k] - 0.9 : T.g[k] - 0.5;
      for (const [side, arr] of [[1, T.wallL], [-1, T.wallR]]) {
        add(wallGeometry(side, arr, skirtBottom, base, i => T.lift[i] > 0.4), concrete);
      }
    }

    // Start/finish line
    const sf = new THREE.Group();
    sf.position.set(T.x[0], T.y[0], T.z[0]);
    sf.rotation.y = T.hd[0];
    const line = new THREE.Mesh(new THREE.PlaneGeometry(T.hw * 2, 1.6),
      new THREE.MeshLambertMaterial({ map: checkerTex }));
    line.rotation.x = -Math.PI / 2;
    line.position.y = 0.07;
    sf.add(line);
    trackGroup.add(sf);
    // Start-light gantry spanning the track just past the line, square to the track at that point
    // (not along the line's tangent, which on a curved straight ends up over the tarmac). Posts
    // stand behind the barriers.
    const gp = trackPose(T, GANTRY_S, 0);
    const gantry = new THREE.Group();
    gantry.position.set(gp.x, gp.y, gp.z);
    gantry.rotation.y = gp.h;
    const steel = new THREE.MeshLambertMaterial({ color: 0x30363d });
    const postOff = side => {
      const wall = (side > 0 ? T.wallL : T.wallR)[gp.i];
      return Math.max(T.hw + 2.2, wall ? wall + 0.8 : 0);
    };
    const pL = postOff(1), pR = postOff(-1);
    for (const x of [pL, -pR]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, 8, 0.6), steel);
      post.position.set(x, 4, 0);
      gantry.add(post);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(pL + pR + 0.6, 1.4, 0.8), steel);
    beam.position.set((pL - pR) / 2, 7.6, 0);
    gantry.add(beam);
    gantryLights = [];
    for (let i = 0; i < 5; i++) {
      const m = new THREE.MeshBasicMaterial({ color: 0x330808 });
      const l = new THREE.Mesh(new THREE.CircleGeometry(0.45, 16), m);
      l.position.set((2 - i) * 1.3, 7.6, -0.45);  // mirrored so lights fill left-to-right from the driver's view
      l.rotation.y = Math.PI;                     // face the cars on the grid
      gantry.add(l);
      gantryLights.push(m);
    }
    trackGroup.add(gantry);
    addGridBoxes();

    // Scenery and lighting for this circuit
    scenery = buildScenery({ T, group: trackGroup, ribbon, canvasTex, speckle });
    trackGroup.add(scenery.sky);
    const env = scenery.env;
    scene.background = new THREE.Color(env.horizon);
    scene.fog.color.setHex(env.fog[0]); scene.fog.near = env.fog[1]; scene.fog.far = env.fog[2];
    hemi.color.setHex(env.hemi[0]); hemi.groundColor.setHex(env.hemi[1]); hemi.intensity = env.hemi[2];
    sun.color.setHex(env.sun[0]); sun.intensity = env.sun[1]; sun.position.set(env.sun[2], env.sun[3], env.sun[4]);
    applyWeather();

    scene.add(trackGroup);
    prepareMinimap();
  }

  // Weather on top of the circuit's time of day: greyer, darker sky and shorter visibility the worse
  // it gets, a wet (darker) road in the rain, snow on the ground.
  function applyWeather() {
    if (!scenery) return;
    const W = WEATHERS[weather], env = scenery.env;
    const base = new THREE.Color(env.fog[0]);
    const lum = (base.r + base.g + base.b) / 3;                 // keeps the grey dark on a night race
    const tint = W.tint === null ? base.clone() : new THREE.Color(W.tint).multiplyScalar(clamp(lum * 1.3, 0.15, 1));
    const fogCol = base.clone().lerp(tint, W.mix);
    const bg = W.sky ? new THREE.Color(env.horizon) : fogCol.clone();
    scene.background = bg.clone();
    scene.fog.color.copy(fogCol); scene.fog.near = env.fog[1] * W.fog; scene.fog.far = env.fog[2] * W.fog;
    scenery.sky.visible = W.sky;
    hemi.intensity = env.hemi[2] * (0.4 + 0.6 * W.light);
    hemi.groundColor.setHex(W.snow ? 0xd8dde4 : env.hemi[1]);
    sun.intensity = env.sun[1] * W.light;
    T.roadMat.color.setHex(W.wet ? 0x74747c : 0xffffff);
    const snowCol = new THREE.Color(0xc9d0d9).multiplyScalar(W.snow ? clamp(lum * 1.1, 0.12, 0.9) : 0);
    T.roadMat.emissive.copy(snowCol).multiplyScalar(0.3);
    scenery.groundMats.forEach(m => { m.emissive.copy(snowCol); m.color.setScalar(W.snow ? 0.35 : 1); });
    buildReflections(W.sky ? env : { ...env, top: fogCol.getHex(), horizon: fogCol.getHex() });
    wfx.set(weather, bg, fogCol);
  }

  // Reflection map for the cars' paint: a small sky / ground / light scene for this circuit's
  // time of day, pre-filtered so glossy and matte surfaces both reflect it believably.
  const pmrem = new THREE.PMREMGenerator(renderer);
  function buildReflections(env) {
    const es = new THREE.Scene();
    const geo = new THREE.SphereGeometry(100, 32, 16), col = [];
    const top = new THREE.Color(env.top), hor = new THREE.Color(env.horizon), gnd = new THREE.Color(env.hemi[1]);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) / 100;
      const c = y >= 0 ? hor.clone().lerp(top, Math.pow(y, 0.6)) : hor.clone().lerp(gnd, Math.min(1, -y * 4));
      col.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    es.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    // Bright light panels: the sun by day, floodlight banks at night.
    const lamp = new THREE.MeshBasicMaterial({ color: env.stars ? 0xfff2d8 : 0xffffff });
    const panels = env.stars ? [[60, 40, 0], [-60, 40, 30], [0, 45, -70], [40, 35, 70]] : [[env.sun[2] / 8, env.sun[3] / 8, env.sun[4] / 8]];
    for (const [x, y, z] of panels) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(env.stars ? 18 : 30, env.stars ? 6 : 30), lamp);
      m.position.set(x, y, z); m.lookAt(0, 0, 0);
      es.add(m);
    }
    if (scene.environment) scene.environment.dispose();
    scene.environment = pmrem.fromScene(es, 0.03).texture;
    es.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  }

  // ---------- Car model ----------
  let model = null;
  function rebuildCar() {
    if (model) { scene.remove(model.group); disposeGroup(model.group); }
    model = buildCarModel(selectedTeam, shadowTex, selectedDriver);
    model.group.rotation.order = 'YXZ';
    scene.add(model.group);
  }
  rebuildCar();

  // ---------- Car state ----------
  const car = {
    x: 0, z: 0, y: 0, h: 0, v: 0, steerIn: 0, steerAngle: 0, throttle: 0, brake: 0,
    gear: 1, rpm: IDLE_RPM, auto: true, shiftTimer: 0, revHold: 0, ers: 1, boost: false, otAvail: false, otHold: 0,
    idx: 0, lateral: 0, offTrack: false, onGravel: false, wheelSpin: 0, pitch: 0,
    vL: 0, yawVel: 0, yawKin: 0, surface: 'track', dirt: 0, bumpY: 0, bumpRoll: 0, bumpPitch: 0,   // sideways slide speed, impact spin rate, steering yaw rate
  };

  function placeCarAt(i) {
    car.idx = i;
    car.x = T.x[i]; car.z = T.z[i]; car.y = T.y[i]; car.h = T.hd[i];
    car.v = 0; car.steerIn = 0; car.throttle = 0; car.brake = 0;
    car.gear = 1; car.neutral = false; car.rpm = IDLE_RPM; car.shiftTimer = 0; car.revHold = 0; car.ers = 1; car.boost = false;
    car.vL = 0; car.yawVel = 0; car.yawKin = 0;
    camH = car.h;
  }

  function locateCar(full) {
    const N = T.n;
    let best = car.idx, bd = Infinity;
    const scan = i => {
      const dx = car.x - T.x[i], dz = car.z - T.z[i], dy = (car.y - T.y[i]) * 4;
      const d2 = dx * dx + dz * dz + dy * dy;
      if (d2 < bd) { bd = d2; best = i; }
    };
    if (!full) for (let o = -40; o <= 40; o++) scan((car.idx + o + N) % N);
    if (full || bd > 45 * 45) { bd = Infinity; for (let i = 0; i < N; i++) scan(i); }
    car.idx = best;
    const ex = car.x - T.x[best], ez = car.z - T.z[best];
    car.lateral = ex * T.nx[best] + ez * T.nz[best];
    // Height: interpolate along the track between this sample and the next one.
    const along = ex * Math.sin(T.hd[best]) + ez * Math.cos(T.hd[best]);
    const j = (best + (along >= 0 ? 1 : -1) + N) % N;
    car.y = T.y[best] + (T.y[j] - T.y[best]) * clamp(Math.abs(along) / SPACING, 0, 1);
    car.pitch = Math.atan2(T.y[(best + 2) % N] - T.y[(best - 2 + N) % N], 4 * SPACING);
    const side = car.lateral > 0 ? 1 : -1, a = Math.abs(car.lateral);
    // Off the tarmac, ride on the terrain itself (hills and dips beside the track) instead of
    // the track's height, so the car can't drive through a hillside. Blends in over a few metres
    // from the road edge; bridges keep the road height (they have parapets).
    const ground = T.groundAt && ((x, z) => Math.max(T.groundAt(x, z), T.waterLevel));
    if (ground && T.lift[best] < 0.4 && a > T.hw + 0.6) {
      const s = clamp((a - T.hw - 0.6) / 3.4, 0, 1), t = s * s * (3 - 2 * s);
      const hx = Math.sin(car.h), hz = Math.cos(car.h);
      const gy = ground(car.x, car.z);
      const gp = Math.atan2(ground(car.x + hx * 2, car.z + hz * 2) - ground(car.x - hx * 2, car.z - hz * 2), 4);
      car.y += (gy - car.y) * t;
      car.pitch += (gp - car.pitch) * t;
    }
    const theme = THEMES[T.def.id] || {};
    let surf;
    if (a <= T.hw - 0.2) surf = 'track';
    else if (T.kerb[best] && a <= T.hw + T.kerbW) surf = 'kerb';
    else if (a <= T.hw + 0.6) surf = 'track';
    else if (!T.def.walls && T.gravel[best] === side && a < T.hw + GRAVEL) surf = 'gravel';
    else if (theme.runoff && !T.def.walls && a < T.hw + 24) surf = theme.runoff === 'tarmac' ? 'runoff' : 'grass';
    else surf = { desert: 'sand', urban: 'runoff', dunes: 'sand' }[theme.ground] || 'grass';
    car.surface = surf;
    car.offTrack = surf !== 'track' && surf !== 'kerb';
    car.onGravel = surf === 'gravel';
  }

  // ---------- Input ----------
  const keys = {};
  const KEYMAP = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'boost',
  };
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;   // typing a name / room code
    if (KEYMAP[e.code]) { keys[KEYMAP[e.code]] = true; e.preventDefault(); }
    if (e.repeat) return;
    switch (e.code) {
      case 'Escape': togglePause(); break;
      case 'KeyC': cycleCamera(); break;
      case 'KeyM': if (inRace()) { car.auto = !car.auto; toast(car.auto ? 'Automatic gearbox' : 'Manual gearbox  (Q / E to shift)', '', 1.6); } break;
      case 'KeyE': if (inRace()) { manualShift(); shiftUp(); } break;
      case 'KeyQ': if (inRace()) { manualShift(); shiftDown(); } break;
      case 'KeyR': resetCar(); break;
      case 'KeyN': muted = !muted; toast(muted ? 'Sound off' : 'Sound on', '', 1); break;
    }
  });
  addEventListener('keyup', e => { if (KEYMAP[e.code]) { keys[KEYMAP[e.code]] = false; e.preventDefault(); } });
  // Auto-pause when you switch to another window or tab.
  const autoPause = () => { if (!paused && ['countdown', 'racing'].includes(race.state)) togglePause(); };
  addEventListener('blur', () => {
    for (const k in keys) keys[k] = false;
    autoPause();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });

  // On-screen touch controls. Each finger is tracked on its own, so you can hold gas and steer
  // together and slide a thumb from one button to the next.
  const tk = {};                       // pressed touch buttons: up / down / left / right / boost
  const fingers = new Map();           // pointerId -> data-k of the button under it
  function touchKeys() {
    for (const k of ['up', 'down', 'left', 'right', 'boost']) tk[k] = false;
    for (const k of fingers.values()) if (k) tk[k] = true;
    document.querySelectorAll('#touch [data-k]').forEach(b => b.classList.toggle('on', !!tk[b.dataset.k]));
  }
  function fingerAt(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    fingers.set(e.pointerId, el && el.closest && el.closest('#touch [data-k]') ? el.closest('[data-k]').dataset.k : null);
    touchKeys();
  }
  const touchPad = $('touch');
  touchPad.addEventListener('pointerdown', e => {
    e.preventDefault();
    const btn = e.target.closest('[data-a]');
    if (btn) { touchAction(btn.dataset.a); return; }
    touchPad.setPointerCapture(e.pointerId);
    fingerAt(e);
  });
  touchPad.addEventListener('pointermove', e => { if (fingers.has(e.pointerId)) fingerAt(e); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture'])
    touchPad.addEventListener(ev, e => { fingers.delete(e.pointerId); touchKeys(); });
  addEventListener('blur', () => { fingers.clear(); touchKeys(); });
  function touchAction(a) {
    if (a === 'tilt') toggleTilt();
    else wheelAction(a);
  }

  // Tilt steering: hold the phone sideways like a steering wheel. Full lock at about 30 degrees.
  let tiltOn = false, tiltSteer = 0;
  addEventListener('deviceorientation', e => {
    if (e.beta === null || e.gamma === null) return;
    const r = Math.PI / 180, b = e.beta * r, g = e.gamma * r;
    const up = [-Math.cos(b) * Math.sin(g), Math.sin(b)];   // "up" in the phone's own x / y axes
    const a = ((screen.orientation && screen.orientation.angle) ?? window.orientation ?? 0) * r;
    const sideways = up[0] * Math.cos(a) - up[1] * Math.sin(a);   // along the screen's left-right axis
    const roll = Math.asin(clamp(sideways, -1, 1)) / (30 * r);
    tiltSteer = Math.abs(roll) < 0.06 ? 0 : clamp(roll, -1, 1);
  });
  async function toggleTilt() {
    if (!tiltOn && window.DeviceOrientationEvent && DeviceOrientationEvent.requestPermission) {
      try {   // iPhone / iPad ask for permission first
        if (await DeviceOrientationEvent.requestPermission() !== 'granted') { toast('Motion access denied', 'red', 1.6); return; }
      } catch (err) { toast('Tilt steering not available', 'red', 1.6); return; }
    }
    tiltOn = !tiltOn;
    document.body.classList.toggle('tilt', tiltOn);
    $('t-tilt').classList.toggle('on', tiltOn);
    toast(tiltOn ? 'Tilt steering' : 'Button steering', '', 1.2);
  }

  // Phones: keep the screen awake and go full screen in landscape while racing.
  let wakeLock = null;
  function racingMode(on) {
    document.body.classList.toggle('racing', on);
    if (!isTouch) return;
    if (on) {
      if (navigator.wakeLock && !wakeLock) navigator.wakeLock.request('screen').then(l => { wakeLock = l; l.addEventListener('release', () => { wakeLock = null; }); }).catch(() => {});
      const de = document.documentElement;
      if (!document.fullscreenElement && de.requestFullscreen)
        de.requestFullscreen({ navigationUI: 'hide' }).then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape')).catch(() => {});
    } else if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
  }

  function cycleCamera() {
    if (inRace()) { camIdx = (camIdx + 1) % CAMERAS.length; toast(CAMERAS[camIdx] + ' camera', '', 1.2); }
  }
  // R: in a full-grid race, drop in 12 m behind the last-placed car at its speed; otherwise just
  // straighten up where you are. Any lap you use it on can't set a record.
  function resetCar() {
    if (race.state !== 'racing' || paused) return;
    const last = field && [...field.cars, ...liveRemotes()].filter(c => c.finish === null).sort((a, b) => a.s - b.s)[0];
    if (!last) { locateCar(true); placeCarAt(car.idx); return; }
    let s = last.s - 12;
    const done = race.laps.length;
    if (s < done * T.total) s = done * T.total + 1;            // don't go back across the line we've already crossed
    const p = trackPose(T, s, last.d);
    placeCarAt(p.i);
    car.x = p.x; car.z = p.z; car.h = p.h; camH = car.h;
    locateCar(false);
    car.v = last.v;
    if (!Wheel.state.hasShifter) { car.gear = 1; while (car.gear < 8 && GEAR_TOP[car.gear] * 0.92 < car.v) car.gear++; }
    car.dirt = 0;
    playerS = s;
    race.tainted = race.lapTainted = true;
    // Jumped forward over the line (only if the last car is a lap up on us): count those laps.
    while (race.state === 'racing' && race.laps.length < Math.floor(s / T.total)) completeLap();
    race.lapTainted = true;
    const N = T.n;
    race.cp = p.i >= Math.floor(N * 2 / 3) ? 2 : p.i >= Math.floor(N / 3) ? 1 : 0;
    toast('Rejoined behind ' + (last.name || last.drv.code), '', 1.4);
  }
  function shiftUp() { if (car.gear >= 1 && car.gear < 8) { car.gear++; car.shiftTimer = 0.06; } }
  // Down a gear at any speed (no lockout: an over-revving engine just brakes harder).
  function shiftDown() { if (car.gear > 1) car.gear--; }
  // Shifting by hand (Q / E or the paddles) switches an automatic gearbox to manual, so it doesn't
  // shift straight back up.
  function manualShift() { if (car.auto) { car.auto = false; toast('Manual gearbox (Q / E or paddles)', '', 1.4); } }
  // Wheel / controller buttons.
  function wheelAction(a) {
    if (a === 'pause') togglePause();
    else if (a === 'camera') cycleCamera();
    else if (a === 'reset') resetCar();
    else if (a === 'tilt') toggleTilt();
    else if ((a === 'shiftUp' || a === 'shiftDown') && inRace() && !paused) {
      manualShift();
      if (a === 'shiftUp') shiftUp(); else shiftDown();
    }
  }

  // ---------- Race state ----------
  const race = { state: 'menu', time: 0, lapStart: 0, laps: [], cp: 0, cdT: 0, goAt: 0, finishT: 0, newLapRec: false, newRaceRec: false };
  let paused = false;
  const inRace = () => ['countdown', 'racing', 'finished'].includes(race.state);

  function physics(dt) {
    const controls = race.state === 'racing' && !paused;
    // Keyboard and wheel / controller both work; analog pedals give partial throttle and brake.
    const W = Wheel.state;
    const thrIn = Math.max(keys.up || tk.up ? 1 : 0, W.throttle), brkIn = Math.max(keys.down || tk.down ? 1 : 0, W.brake);
    const up = controls && thrIn > 0.1, down = controls && brkIn > 0.1;
    const kSteer = (keys.left || tk.left ? 1 : 0) - (keys.right || tk.right ? 1 : 0);
    const wheelSteer = W.connected && !kSteer;
    const tilt = tiltOn && !kSteer && !W.connected;
    const steerTarget = controls ? (wheelSteer ? W.steer : tilt ? tiltSteer : kSteer) : 0;
    const finishing = race.state === 'finished';

    car.throttle = approach(car.throttle, race.state === 'countdown' || controls ? thrIn : 0, dt * (W.connected ? 12 : 6));
    car.brake = approach(car.brake, finishing ? 0.35 : controls ? brkIn : 0, dt * (W.connected ? 14 : 8));
    car.steerIn = approach(car.steerIn, steerTarget, dt * (wheelSteer || tilt ? 15 : steerTarget ? 3.2 : 6));

    if (race.state === 'countdown') {    // rev the engine on the grid
      car.rpm = approach(car.rpm, IDLE_RPM + car.throttle * 7500, dt * 30000);
      return;
    }

    locateCar(false);
    const off = car.offTrack;
    const v = car.v, sp = Math.abs(v);
    // Grip comes from the surface under the car; grass and gravel also leave the tyres dirty
    // for a while after you rejoin.
    const S = SURFACES[car.surface];
    if (car.offTrack && car.surface !== 'runoff') car.dirt = Math.min(1, car.dirt + dt * 0.8 * Math.min(1, sp / 10));
    else car.dirt = Math.max(0, car.dirt - dt * sp / 600);
    const dirty = car.offTrack ? 1 : 1 - 0.25 * car.dirt;
    // Rain, snow and hurricanes cut grip. Off the track traction keeps most of it, so a car stuck
    // in a gravel trap can still drive out.
    const WX = WEATHERS[weather];
    const grip = (S.grip[0] + S.grip[1] * v * v) * dirty * (car.offTrack ? Math.max(WX.grip, 0.85) : WX.grip);   // traction / braking
    const cornerGrip = (S.turn[0] + S.turn[1] * v * v) * dirty * WX.grip;    // track: ~2 g slow, ~5 g at 300 km/h
    let nv;

    // H-shifter: positions 1-5 pick gears 1-5; position 6 covers 6th-8th (shifted automatically,
    // the car has 8 gears); R engages reverse once nearly stopped; neutral cuts the drive.
    const hs = W.hasShifter;
    car.neutral = false;
    if (hs) {
      car.auto = false;
      const hg = W.hGear;
      if (hg === null) car.neutral = true;
      else if (hg === -1) { if (car.gear !== -1) { if (sp < 1) car.gear = -1; else car.neutral = true; } }
      else if (hg <= 5) { if (car.gear !== hg) { car.gear = hg; car.shiftTimer = 0.06; } }
      else if (car.gear < 6) { car.gear = 6; car.shiftTimer = 0.06; }
      else if (car.rpm > 11900 && car.gear < 8) { car.gear++; car.shiftTimer = 0.06; }
      else if (car.gear > 6 && sp < GEAR_TOP[car.gear - 1] * 0.62) car.gear--;
    }

    if (car.gear === -1) {
      if (hs) {   // shifter in R: throttle drives backwards, brake stops
        nv = v - (car.neutral ? 0 : car.throttle) * 8 * dt + (v < 0 ? car.brake * 20 * dt : 0);
        nv = clamp(nv, -9, 0);
      } else {    // keyboard reverse: down accelerates backwards, up brakes
        nv = v - car.brake * 8 * dt + (v < 0 ? car.throttle * 20 * dt : 0);
        nv = clamp(nv, -9, 0);
        if (up && nv > -0.3) { car.gear = 1; nv = 0; }
      }
      car.rpm = IDLE_RPM + (-nv / 9) * 5000;
    } else {
      if (!hs && sp < 0.5 && down && !up) {
        car.revHold += dt;
        if (car.revHold > 0.35) { car.gear = -1; car.revHold = 0; }
      } else car.revHold = 0;

      const top = GEAR_TOP[Math.max(1, car.gear)];
      // No rev limiter: the engine revs on past the redline (any gear can be selected at any speed),
      // making less power the further it over-revs and braking hard off the throttle.
      car.rpm = car.neutral ? approach(car.rpm, IDLE_RPM + car.throttle * 8000, dt * 30000) : clamp(sp / top * REDLINE, IDLE_RPM, OVERREV);
      const over = Math.max(0, car.rpm / REDLINE - 1);
      const tf = car.rpm < 5000 ? 0.55 : car.rpm < 9000 ? 0.55 + 0.45 * (car.rpm - 5000) / 4000 : Math.max(0.3, 1 - Math.max(0, over - 0.05) * 3);
      car.shiftTimer -= dt;
      // Overtake mode: extra electric power while Space is held, the battery has charge and
      // (in a full-grid race) we are within a second of the car ahead.
      car.boost = controls && (keys.boost || tk.boost || W.boost) && car.otAvail && car.ers > 0.01 && car.throttle > 0.5 && car.gear >= 1;
      const power = POWER + (car.boost ? OT_POWER : 0);
      let engineA = 0;
      if (car.gear >= 1 && !car.neutral && car.shiftTimer <= 0) {
        engineA = car.throttle * Math.min(grip, power * tf / (MASS * Math.max(sp, 4)));
      }
      const engineBrake = car.gear >= 1 && !car.neutral ? (1 - car.throttle) * Math.min(over, 1) * 6 : 0;
      car.ers = clamp(car.ers + (car.boost ? -OT_DRAIN : car.brake * OT_REGEN + (car.throttle < 0.1 ? 0.015 : 0)) * dt, 0, 1);
      const brakeA = car.brake * Math.min(grip * 1.1, 14 + 0.0045 * v * v);
      const drag = 0.0011 * v * v + 0.25 + S.drag[0] + S.drag[1] * sp;
      nv = v < -0.3
        ? Math.min(0, v + (2 + grip * 0.5) * dt)                 // rolling backwards after a spin: tyres stop it
        : Math.max(0, v + (engineA - brakeA - drag - engineBrake) * dt);

      if (car.auto && car.gear >= 1) {
        if (car.rpm > 11900 && car.gear < 8) { car.gear++; car.shiftTimer = 0.06; }
        else if (car.gear > 1 && sp < GEAR_TOP[car.gear - 1] * 0.62) car.gear--;
      }
    }

    const slopeA = 9.81 * Math.sin(car.pitch) * dt;
    nv = car.gear === -1 ? clamp(nv - slopeA, -9, 0) : nv < 0 ? nv - slopeA : Math.max(0, nv - slopeA);

    // Steering limited by speed and by tyre grip (understeer when you ask too much). A sideways
    // slide uses up grip that would otherwise turn the car.
    const slide = Math.min(1, Math.abs(car.vL) / 8);
    const turnGrip = cornerGrip * (1 - 0.7 * slide);
    const maxYaw = turnGrip / Math.max(Math.abs(nv), 1);
    // A wheel maps its whole rotation onto the steering, so it gets more lock (and keeps more of it
    // at speed) than the keys: wheel turned all the way = this much front-wheel angle.
    // Keys get enough lock for Monaco's hairpin (~7 m turning circle at 40-50 km/h); at speed the
    // grip cap below decides, so this only matters in slow corners.
    let maxSteer = wheelSteer ? 0.7 / (1 + sp / 120) : 0.6 / (1 + sp / 40);
    // Keys are all-or-nothing, so a held key would always ask for more lock than the tyres can use
    // and scrub off speed. Cap keyboard steering at the grip limit (a wheel/stick can still overdo it).
    if (!wheelSteer) maxSteer = Math.min(maxSteer, Math.atan(maxYaw * 1.05 * WHEELBASE / Math.max(Math.abs(nv), 1)));
    car.steerAngle = car.steerIn * maxSteer;
    let yawRate = nv * Math.tan(car.steerAngle) / WHEELBASE;
    if (Math.abs(yawRate) > maxYaw) {
      const excess = Math.abs(yawRate) - maxYaw;
      yawRate = Math.sign(yawRate) * maxYaw;
      if (nv > 0) nv = Math.max(0, nv - Math.min(excess / maxYaw, 2) * 3 * dt);
    }
    car.h += yawRate * dt;          // steering: the tyres carry the velocity round with the car
    car.yawKin = yawRate;

    // Spin from an impact turns the body but not the velocity, so the car slides.
    if (car.yawVel) {
      const dh = car.yawVel * dt, c = Math.cos(dh), s = Math.sin(dh), vF = nv, vL = car.vL;
      nv = vF * c + vL * s;
      car.vL = vL * c - vF * s;
      car.h += dh;
      // Tyres damp the rotation (less on grass); a small twist is caught quickly, a big spin carries on.
      const catchRate = Math.abs(car.yawVel) < 1.2 ? 7 : 3.5;
      car.yawVel *= Math.exp(-Math.min(catchRate, cornerGrip / 6) * dt);
      if (Math.abs(car.yawVel) < 0.02) car.yawVel = 0;
    }
    // Tyres scrub off the sideways speed (and some forward speed while sliding).
    if (car.vL) {
      car.vL = approach(car.vL, 0, cornerGrip * 0.8 * dt);
      if (nv > 0) nv = Math.max(0, nv - slide * grip * 0.25 * dt);
    }
    // Hurricane: a crosswind pushes the car sideways (beyond what the tyres hold in a gust), a
    // head / tail wind slows or speeds it, and gusts twitch the tail.
    if (WX.wind) {
      const fx = Math.sin(car.h), fz = Math.cos(car.h), w = wfx.wind;
      const wl = w.x * fz - w.z * fx, wf = w.x * fx + w.z * fz;
      car.vL += wl * Math.abs(wl) * 0.0045 * dt;
      if (nv > 2) nv = Math.max(0, nv + wf * Math.abs(wf) * 0.0012 * dt);
      car.yawVel += ((Math.random() - 0.5) * 6 + Math.sign(wl) * 0.8) * w.gust * dt;
    }
    car.v = nv;
    const fx = Math.sin(car.h), fz = Math.cos(car.h);
    car.x += (fx * nv + fz * car.vL) * dt;
    car.z += (fz * nv - fx * car.vL) * dt;
    car.wheelSpin += nv * dt / 0.36;
    hitWalls();
  }

  // ---------- Collisions ----------
  // Cars are rigid boxes (800 kg, yaw inertia of a 5.5 x 2 m block). Contacts use impulses with a
  // little restitution and friction, so where and how hard you hit decides whether you bounce,
  // slide, scrape or spin.
  const CAR_I = MASS * (5.5 * 5.5 + 2 * 2) / 12 * 3;   // x3: tyres on the ground resist a sudden spin
  const HALF_W = 0.95, HALF_L = 2.7;
  // 2D cross product matching the yaw convention (positive yaw turns forward toward the left).
  const cross2 = (rx, rz, nx, nz) => rz * nx - rx * nz;
  const playerVel = () => {
    const fx = Math.sin(car.h), fz = Math.cos(car.h);
    return [fx * car.v + fz * car.vL, fz * car.v - fx * car.vL];
  };
  const setPlayerVel = (wx, wz) => {
    const fx = Math.sin(car.h), fz = Math.cos(car.h);
    car.v = wx * fx + wz * fz;
    car.vL = wx * fz - wz * fx;
  };

  // Barrier hits: the corner that went deepest takes the impulse.
  function hitWalls() {
    locateCar(false);
    const i = car.idx, side = car.lateral > 0 ? 1 : -1;
    const off = (side > 0 ? T.wallL : T.wallR)[i];
    if (!off) return;
    const fx = Math.sin(car.h), fz = Math.cos(car.h);
    let depth = 0, rx = 0, rz = 0;
    for (const [a, b] of [[HALF_W, HALF_L], [-HALF_W, HALF_L], [HALF_W, -HALF_L], [-HALF_W, -HALF_L]]) {
      const cx = fz * a + fx * b, cz = -fx * a + fz * b;        // corner offset (a = left, b = forward)
      const pen = side * (car.lateral + cx * T.nx[i] + cz * T.nz[i]) - off;
      if (pen > depth) { depth = pen; rx = cx; rz = cz; }
    }
    if (depth <= 0) return;
    const nX = -T.nx[i] * side, nZ = -T.nz[i] * side;          // wall normal, back into the track
    car.x += nX * depth; car.z += nZ * depth;
    const [wx, wz] = playerVel(), w = car.yawVel + car.yawKin;
    const vcx = wx + w * rz, vcz = wz - w * rx;                 // velocity of the contact corner
    const vn = vcx * nX + vcz * nZ;
    if (vn >= 0) return;
    const rn = cross2(rx, rz, nX, nZ);
    const j = -(1 + 0.15) * vn / (1 / MASS + rn * rn / CAR_I);
    const tX = -nZ, tZ = nX, rt = cross2(rx, rz, tX, tZ);
    const jt = clamp(-(vcx * tX + vcz * tZ) / (1 / MASS + rt * rt / CAR_I), -0.35 * j, 0.35 * j);
    const ix = nX * j + tX * jt, iz = nZ * j + tZ * jt;
    setPlayerVel(wx + ix / MASS, wz + iz / MASS);
    car.yawVel += cross2(rx, rz, ix, iz) / CAR_I;
    impact(-vn, car.x + rx, car.y + 0.3, car.z + rz, nX, nZ);
  }

  // Sound, shake and debris for an impact of `speed` m/s.
  function impact(speed, x, y, z, nX, nZ) {
    if (speed < 1.5) return;
    crashShake = Math.max(crashShake, Math.min(0.6, speed * 0.04));
    playCrash(Math.min(1, speed / 25));
    spawnDebris(x, y, z, Math.min(40, Math.floor(speed * 1.5)), nX, nZ, car.y);
  }


  function updateLaps(prevIdx) {
    const N = T.n, i = car.idx;
    if (race.cp < 2) {
      const target = Math.floor(N * (race.cp + 1) / 3);
      if (i >= target && i < target + 150) race.cp++;
    }
    if (race.cp >= 2 && prevIdx > N * 0.85 && i < N * 0.15) {
      race.cp = 0;
      completeLap();
    }
  }

  // Track limits, 2026 F1 style: going wide with all four wheels over the white line is an offence.
  // The 3rd brings the black-and-white flag; the 4th and every one after is a 5 second time penalty.
  // One trip off counts once - you have to get a wheel back on the track before the next one counts.
  // Being pushed off by another car (contact in the last 2.5 s) is a justified reason, so it's free.
  function checkTrackLimits() {
    const out = Math.abs(car.lateral) - T.hw;
    if (race.wide) { if (out < HALF_W - 0.3) race.wide = false; return; }
    if (out <= HALF_W || T.lift[car.idx] > 0.4 || Math.abs(car.v) < 3) return;
    race.wide = true;
    if (race.time - race.hitAt < 2.5) return;      // knocked off by another car: not an offence
    const n = ++race.limits;
    if (n < 3) toast('Track limits  ·  warning ' + n, '', 1.8);
    else if (n === 3) toast('BLACK & WHITE FLAG\nTrack limits - next one is a penalty', 'bw', 2.6);
    else { race.penalty += 5; toast('5 SECOND PENALTY\nTrack limits (total +' + race.penalty + 's)', 'red', 2.6); }
  }
  const finalTime = () => race.time + race.penalty;

  function completeLap() {
    const lapTime = race.time - race.lapStart;
    race.lapStart = race.time;
    race.laps.push(lapTime);
    const rec = records[T.def.id] || (records[T.def.id] = { bestLap: null, bestRace: null });
    let msg = 'Lap ' + race.laps.length + '  ' + fmt(lapTime), cls = '';
    const fair = !race.lapTainted;
    race.lapTainted = false;
    if (fair && (rec.bestLap == null || lapTime < rec.bestLap)) {
      rec.bestLap = lapTime; race.newLapRec = true;
      msg = 'Track record!  ' + fmt(lapTime); cls = 'purple';
    } else if (lapTime <= Math.min(...race.laps)) {
      cls = 'green';
    }
    if (race.laps.length >= RACE_LAPS) {
      race.state = 'finished';
      race.finishT = 0;
      if (!race.tainted && (rec.bestRace == null || finalTime() < rec.bestRace)) { rec.bestRace = finalTime(); race.newRaceRec = true; }
      toast('FINISH!  ' + (field ? 'P' + playerPosition() + '  ' : '') + fmt(finalTime()) + (race.penalty ? '  (incl. +' + race.penalty + 's)' : ''), 'green', 3);
    } else {
      toast(msg + (race.laps.length === RACE_LAPS - 1 ? '\nFinal lap' : ''), cls, 2.2);
    }
  }

  // ---------- Camera ----------
  let camIdx = 0, camH = 0, orbitA = 0, crashShake = 0;
  function updateCamera(dt) {
    const fwdX = Math.sin(car.h), fwdZ = Math.cos(car.h), cy = car.y;
    model.cockpitHide.forEach(m => { m.visible = !(inRace() && camIdx === 2); });

    if (race.state === 'prerace' || race.state === 'menu') {
      orbitA += dt * 0.25;
      camera.fov = 55;
      const ox = Math.sin(orbitA), oz = Math.cos(orbitA);
      camera.position.set(car.x + ox * 8, cy + 2.4, car.z + oz * 8);
      // Aim a little to the left of the car so it sits beside the panel.
      camera.lookAt(car.x - oz * 3.2, cy + 0.5, car.z + ox * 3.2);
      camera.updateProjectionMatrix();
      return;
    }
    const sp = Math.abs(car.v);
    camera.fov = 68 + Math.min(14, sp * 0.14);
    camera.updateProjectionMatrix();
    crashShake = Math.max(0, crashShake - dt * 1.5);
    const shake = SURFACES[car.surface].shake * Math.min(1, sp / 25) + crashShake + (WEATHERS[weather].wind ? 0.03 + wfx.wind.gust * 0.12 : 0);
    const jx = (Math.random() - 0.5) * shake, jy = (Math.random() - 0.5) * shake;

    if (camIdx === 0) {                 // Chase cam, above and behind
      camH += wrapAngle(car.h - camH) * (1 - Math.exp(-dt * 5));
      const bx = Math.sin(camH), bz = Math.cos(camH);
      // Keep the chase cam above the ground, e.g. behind the car when driving down a hillside.
      const camX = car.x - bx * 7.2, camZ = car.z - bz * 7.2;
      const floor = T.groundAt ? T.groundAt(camX, camZ) + 1.2 : -Infinity;
      camera.position.set(camX + jx, Math.max(cy + 2.5, floor) + jy, camZ);
      camera.lookAt(car.x + bx * 6, cy + 1.0, car.z + bz * 6);
    } else if (camIdx === 1) {          // Roof cam, sitting on top of the car
      camera.position.set(car.x - fwdX * 0.3 + jx, cy + 1.3 + jy, car.z - fwdZ * 0.3);
      camera.lookAt(car.x + fwdX * 30, cy + 0.6, car.z + fwdZ * 30);
    } else {                            // Cockpit
      camera.position.set(car.x + fwdX * 0.1 + jx, cy + 0.88 + jy, car.z + fwdZ * 0.1);
      camera.lookAt(car.x + fwdX * 30, cy + 0.55, car.z + fwdZ * 30);
    }
  }

  function syncModel() {
    model.group.position.set(car.x, car.y + car.bumpY, car.z);
    model.group.rotation.set(-car.pitch + car.bumpPitch, car.h, car.bumpRoll);
    model.frontPivots.forEach(p => { p.rotation.y = car.steerAngle; });
    model.wheels.forEach(w => { w.rotation.x = car.wheelSpin; });
    model.brakeMat.color.setHex(car.brake > 0.05 ? 0xff2020 : 0x440000);
  }

  // ---------- Minimap ----------
  const mm = $('minimap'), mmg = mm.getContext('2d');
  let mmPath = null, mmXf = null;
  function trackTransform(xs, zs, W, H, pad) {
    let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity;
    for (let i = 0; i < xs.length; i++) { a = Math.min(a, xs[i]); b = Math.max(b, xs[i]); c = Math.min(c, zs[i]); d = Math.max(d, zs[i]); }
    const s = Math.min((W - 2 * pad) / (b - a), (H - 2 * pad) / (d - c));
    const ox = (W - (b - a) * s) / 2, oy = (H - (d - c) * s) / 2;
    return (x, z) => [ox + (x - a) * s, oy + (z - c) * s];
  }
  function prepareMinimap() {
    mmXf = trackTransform(T.x, T.z, mm.width, mm.height, 24);
    mmPath = new Path2D();
    for (let i = 0; i < T.n; i += 3) {
      const [px, py] = mmXf(T.x[i], T.z[i]);
      i ? mmPath.lineTo(px, py) : mmPath.moveTo(px, py);
    }
    mmPath.closePath();
  }
  function drawMinimap() {
    mmg.clearRect(0, 0, mm.width, mm.height);
    mmg.fillStyle = 'rgba(10,14,20,0.6)';
    mmg.beginPath(); mmg.roundRect ? mmg.roundRect(0, 0, mm.width, mm.height, 20) : mmg.rect(0, 0, mm.width, mm.height); mmg.fill();
    mmg.lineJoin = 'round';
    mmg.strokeStyle = '#0b0f15'; mmg.lineWidth = 14; mmg.stroke(mmPath);
    mmg.strokeStyle = '#e8edf2'; mmg.lineWidth = 7; mmg.stroke(mmPath);
    const [sx, sy] = mmXf(T.x[0], T.z[0]);
    mmg.fillStyle = '#e10600'; mmg.fillRect(sx - 6, sy - 6, 12, 12);
    if (field) {
      for (const ai of field.cars) {
        const [ax, ay] = mmXf(ai.x, ai.z);
        mmg.fillStyle = hex(ai.team.body); mmg.strokeStyle = '#000'; mmg.lineWidth = 2;
        mmg.beginPath(); mmg.arc(ax, ay, 7, 0, Math.PI * 2); mmg.fill(); mmg.stroke();
      }
    }
    for (const r of liveRemotes()) {            // other people: bigger, with a white ring
      const [rx, ry] = mmXf(r.x, r.z);
      mmg.fillStyle = hex(r.team.body); mmg.strokeStyle = '#fff'; mmg.lineWidth = 3;
      mmg.beginPath(); mmg.arc(rx, ry, 9, 0, Math.PI * 2); mmg.fill(); mmg.stroke();
    }
    const [cx, cy] = mmXf(car.x, car.z);
    mmg.fillStyle = hex(selectedTeam.body);
    mmg.strokeStyle = '#000'; mmg.lineWidth = 3;
    mmg.beginPath(); mmg.arc(cx, cy, 11, 0, Math.PI * 2); mmg.fill(); mmg.stroke();
  }

  // ---------- Debris ----------
  const DEBRIS = 120;
  const debrisMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 0.02, 0.09),
    new THREE.MeshStandardMaterial({ color: 0x1b1c1f, roughness: 0.4, metalness: 0.3 }), DEBRIS);
  debrisMesh.frustumCulled = false;
  scene.add(debrisMesh);
  const debris = Array.from({ length: DEBRIS }, () => ({ life: 0 }));
  let debrisNext = 0;
  const dm = new THREE.Object3D();
  const carbonCol = new THREE.Color(0x1b1c1f);
  for (let k = 0; k < DEBRIS; k++) debrisMesh.setColorAt(k, carbonCol);
  debrisMesh.material.color.setHex(0xffffff);
  function spawnDebris(x, y, z, n, nX, nZ, ground, color = carbonCol) {
    for (let k = 0; k < n; k++) {
      const d = debris[debrisNext];
      debrisMesh.setColorAt(debrisNext, color);
      debrisMesh.instanceColor.needsUpdate = true;
      debrisNext = (debrisNext + 1) % DEBRIS;
      const sp = 2 + Math.random() * 7;
      Object.assign(d, {
        x, y, z, ground, life: 2.5 + Math.random() * 1.5,
        vx: nX * sp + (Math.random() - 0.5) * 6, vy: 1 + Math.random() * 4, vz: nZ * sp + (Math.random() - 0.5) * 6,
        rx: Math.random() * 6, ry: Math.random() * 6, spin: (Math.random() - 0.5) * 20, s: 0.5 + Math.random() * 1.5,
      });
    }
  }
  function updateDebris(dt) {
    for (let k = 0; k < DEBRIS; k++) {
      const d = debris[k];
      if (d.life > 0) {
        d.life -= dt;
        d.vy -= 9.81 * dt;
        d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
        if (d.y < d.ground + 0.05) { d.y = d.ground + 0.05; d.vy *= -0.3; d.vx *= 0.6; d.vz *= 0.6; d.spin *= 0.5; }
        d.rx += d.spin * dt;
        dm.position.set(d.x, d.y, d.z); dm.rotation.set(d.rx, d.ry, 0);
        dm.scale.setScalar(d.life > 0.5 ? d.s : d.s * d.life * 2);
      } else {
        dm.scale.setScalar(0);
      }
      dm.updateMatrix();
      debrisMesh.setMatrixAt(k, dm.matrix);
    }
    debrisMesh.instanceMatrix.needsUpdate = true;
  }

  // Dust clouds (gravel, sand, grass): soft puffs that grow, drift up and fade.
  const DUST = 160;
  const dustMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 3),
    new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false }), DUST);
  dustMesh.frustumCulled = false;
  scene.add(dustMesh);
  const dust = Array.from({ length: DUST }, () => ({ life: 0 }));
  let dustNext = 0;
  for (let k = 0; k < DUST; k++) dustMesh.setColorAt(k, carbonCol);
  function spawnDust(x, y, z, vx, vz, color, size = 1) {
    const d = dust[dustNext];
    dustMesh.setColorAt(dustNext, color);
    dustMesh.instanceColor.needsUpdate = true;
    dustNext = (dustNext + 1) % DUST;
    Object.assign(d, { x, y, z, vx, vz, vy: 0.6 + Math.random() * 0.8, age: 0, life: 1.2 + Math.random() * 0.8, size });
  }
  function updateDust(dt) {
    for (let k = 0; k < DUST; k++) {
      const d = dust[k];
      if (d.age < d.life) {
        d.age += dt;
        d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
        d.vx *= 1 - dt * 1.5; d.vz *= 1 - dt * 1.5;
        const t = d.age / d.life;
        dm.position.set(d.x, d.y, d.z); dm.rotation.set(0, 0, 0);
        dm.scale.setScalar(d.size * (0.3 + t * 1.5) * (t > 0.7 ? (1 - t) / 0.3 : 1));
      } else dm.scale.setScalar(0);
      dm.updateMatrix();
      dustMesh.setMatrixAt(k, dm.matrix);
    }
    dustMesh.instanceMatrix.needsUpdate = true;
  }

  // Bounce, spray and rumble from whatever surface the car is on.
  const SPRAY = {
    gravel: { dust: new THREE.Color(0xc9b28a), bits: new THREE.Color(0x8c7a5c), rate: 1.2, size: 1 },
    sand:   { dust: new THREE.Color(0xd9bf8c), bits: new THREE.Color(0xb59a68), rate: 1.0, size: 1 },
    grass:  { dust: new THREE.Color(0x7a6a48), bits: new THREE.Color(0x3d7a2a), rate: 0.15, size: 0.5 },
  };
  const MIST = new THREE.Color(0xc9d1da), POWDER = new THREE.Color(0xf4f7fb);
  let bumpT = 0, bumpTarget = [0, 0, 0], sprayAcc = 0, wetAcc = 0;
  function surfaceEffects(dt) {
    const S = SURFACES[car.surface], sp = Math.abs(car.v) + Math.abs(car.vL);
    const amp = S.bump * Math.min(1, sp / 15);
    bumpT -= dt;
    if (bumpT <= 0) {                       // new random bump every few hundredths of a second
      bumpT = car.surface === 'kerb' ? 0.035 : 0.06 + Math.random() * 0.06;
      bumpTarget = [(Math.random() * 2 - 1) * amp, (Math.random() * 2 - 1) * amp * 0.6, (Math.random() * 2 - 1) * amp * 0.4];
    }
    const k = Math.min(1, dt * 25);
    car.bumpY += (bumpTarget[0] - car.bumpY) * k;
    car.bumpRoll += (bumpTarget[1] - car.bumpRoll) * k;
    car.bumpPitch += (bumpTarget[2] - car.bumpPitch) * k;

    const spray = SPRAY[car.surface];
    if (spray && sp > 4) {
      sprayAcc += sp * spray.rate * dt;
      const fx = Math.sin(car.h), fz = Math.cos(car.h);
      while (sprayAcc > 1) {
        sprayAcc -= 1;
        const s = Math.random() < 0.5 ? 1 : -1;
        const x = car.x + fz * 0.77 * s - fx * 1.9, z = car.z - fx * 0.77 * s - fz * 1.9;   // behind a rear wheel
        const back = 0.25 * sp;
        spawnDust(x, car.y + 0.3, z, -fx * back + (Math.random() - 0.5) * 3, -fz * back + (Math.random() - 0.5) * 3, spray.dust, spray.size);
        if (Math.random() < 0.6) spawnDebris(x, car.y + 0.2, z, 1, -fx, -fz, car.y, spray.bits);
      }
    }
    // Spray off a wet road / powder off a snowy one, thrown up behind the rear wheels.
    const WX = WEATHERS[weather];
    if ((WX.wet || WX.snow) && !car.offTrack && sp > 12) {
      wetAcc += sp * 0.1 * dt;
      const fx = Math.sin(car.h), fz = Math.cos(car.h);
      while (wetAcc > 1) {
        wetAcc -= 1;
        const s = Math.random() < 0.5 ? 1 : -1;
        spawnDust(car.x + fz * 0.77 * s - fx * 2.4, car.y + 0.4, car.z - fx * 0.77 * s - fz * 2.4,
          -fx * sp * 0.3 + wfx.wind.x * 0.4 + (Math.random() - 0.5) * 3, -fz * sp * 0.3 + wfx.wind.z * 0.4 + (Math.random() - 0.5) * 3,
          WX.snow ? POWDER : MIST, 1.4);
      }
    }
    // Rumble / crunch
    if (audio && audio.surf) {
      const t = audio.ctx.currentTime, on = !muted;
      const vol = { kerb: 0.12, grass: 0.06, gravel: 0.22, sand: 0.16 }[car.surface] || 0;
      const fq = { kerb: 180, grass: 450, gravel: 1400, sand: 900 }[car.surface] || 300;
      audio.surfGain.gain.setTargetAtTime(on ? vol * Math.min(1, sp / 30) : 0, t, 0.05);
      audio.surfFilter.frequency.setTargetAtTime(fq, t, 0.05);
    }
  }

  // ---------- Audio ----------
  // Engine: a 4-stroke V6 fires 6 times per 2 crank revolutions, so the sound is built from
  // harmonics of the cycle frequency (rpm / 120), with the firing order (6th) and its low
  // relatives (3rd, 9th, 12th) strongest. Two slightly detuned voices, soft distortion under load,
  // a throttle-controlled filter, exhaust/intake roar, turbo whistle and overrun pops.
  let audio = null, muted = false;
  function engineWave(ctx) {
    const N = 48, real = new Float32Array(N), imag = new Float32Array(N);
    const amp = { 1: 0.35, 2: 0.45, 3: 1.0, 4: 0.35, 5: 0.25, 6: 0.9, 7: 0.18, 8: 0.22, 9: 0.4, 10: 0.12, 12: 0.32, 15: 0.14, 18: 0.15, 24: 0.07 };
    for (let n = 1; n < N; n++) {
      const a = amp[n] !== undefined ? amp[n] : 0.06 / Math.sqrt(n);
      const ph = Math.random() * Math.PI * 2;
      real[n] = a * Math.cos(ph); imag[n] = a * Math.sin(ph);
    }
    return ctx.createPeriodicWave(real, imag);
  }
  function softClip(k) {
    const c = new Float32Array(1024);
    for (let i = 0; i < c.length; i++) { const x = i / 511.5 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); }
    return c;
  }
  // One engine "voice": two detuned oscillators -> drive -> soft clip -> low-pass -> body EQ -> gain -> pan
  function makeVoice(ctx, wave, out) {
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    o1.setPeriodicWave(wave); o2.setPeriodicWave(wave);
    const mix2 = ctx.createGain(); mix2.gain.value = 0.55;
    const drive = ctx.createGain(); drive.gain.value = 1;
    const shaper = ctx.createWaveShaper(); shaper.curve = softClip(2.2); shaper.oversample = '2x';
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 800; lp.Q.value = 0.7;
    const body = ctx.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 220; body.gain.value = 7; body.Q.value = 0.9;
    const gain = ctx.createGain(); gain.gain.value = 0;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
    o1.connect(drive); o2.connect(mix2); mix2.connect(drive);
    drive.connect(shaper); shaper.connect(lp); lp.connect(body); body.connect(gain); gain.connect(pan); pan.connect(out);
    o1.start(); o2.start();
    return { o1, o2, drive, lp, gain, pan };
  }
  function initAudio() {
    if (audio) { audio.ctx.resume(); return; }
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const master = ctx.createGain(); master.gain.value = 0.9;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp); comp.connect(ctx.destination);
      const wave = engineWave(ctx);
      const me = makeVoice(ctx, wave, master), other = makeVoice(ctx, wave, master);
      // White noise for crashes and pops
      const noise = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
      const nd = noise.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / nd.length, 2);
      // Looping noise: surface rumble, and exhaust / intake roar
      const loop = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const ld = loop.getChannelData(0);
      for (let i = 0; i < ld.length; i++) ld[i] = Math.random() * 2 - 1;
      const loopSrc = () => { const s = ctx.createBufferSource(); s.buffer = loop; s.loop = true; s.start(); return s; };
      const surf = loopSrc();
      const surfFilter = ctx.createBiquadFilter(); surfFilter.type = 'lowpass'; surfFilter.frequency.value = 400;
      const surfGain = ctx.createGain(); surfGain.gain.value = 0;
      surf.connect(surfFilter); surfFilter.connect(surfGain); surfGain.connect(master);
      const roar = loopSrc();
      const roarFilter = ctx.createBiquadFilter(); roarFilter.type = 'bandpass'; roarFilter.frequency.value = 700; roarFilter.Q.value = 0.8;
      const roarGain = ctx.createGain(); roarGain.gain.value = 0;
      roar.connect(roarFilter); roarFilter.connect(roarGain); roarGain.connect(master);
      // Turbo whistle
      const turbo = ctx.createOscillator(); turbo.type = 'sine';
      const turboGain = ctx.createGain(); turboGain.gain.value = 0;
      turbo.connect(turboGain); turboGain.connect(master); turbo.start();
      // Crash layers: flat noise (shaped by envelopes) and a hard-clipping curve for the crunch
      const crashNoise = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
      const cd = crashNoise.getChannelData(0);
      for (let i = 0; i < cd.length; i++) cd[i] = Math.random() * 2 - 1;
      const crunchCurve = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; crunchCurve[i] = Math.tanh(x * 6) * 0.8; }
      audio = { ctx, master, me, other, noise, crashNoise, crunchCurve, surf, surfFilter, surfGain, roarFilter, roarGain, turbo, turboGain, lastThrottle: 0 };
    } catch (e) { audio = null; }   // no Web Audio: play silently
  }
  let lastCrash = 0;
  function playCrash(strength) {
    if (!audio || muted || performance.now() - lastCrash < 120) return;
    lastCrash = performance.now();
    const ctx = audio.ctx, t0 = ctx.currentTime, s = strength, rnd = Math.random;
    // Gain node with an instant attack and exponential decay, feeding the master bus.
    const env = (peak, at, decay) => {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.setValueAtTime(peak, t0 + at);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + decay);
      g.connect(audio.master);
      return g;
    };
    const noiseBurst = (type, freq, q, peak, at, decay, shaper) => {
      const src = ctx.createBufferSource(), f = ctx.createBiquadFilter();
      src.buffer = audio.crashNoise;
      f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = env(peak, at, decay);
      if (shaper) { const ws = ctx.createWaveShaper(); ws.curve = audio.crunchCurve; src.connect(ws); ws.connect(f); }
      else src.connect(f);
      f.connect(g);
      src.start(t0 + at, rnd() * 0.5, decay + 0.05);
    };

    // 1. Body thud: a low sine whose pitch drops on impact.
    const thud = ctx.createOscillator();
    thud.frequency.setValueAtTime(95 + s * 30, t0);
    thud.frequency.exponentialRampToValueAtTime(32, t0 + 0.18);
    thud.connect(env(0.25 + s * 0.45, 0, 0.22 + s * 0.15));
    thud.start(t0); thud.stop(t0 + 0.45);

    // 2. Crunch: several clipped noise bursts in quick succession as the carbon crumples.
    const crunches = 2 + Math.round(s * 5);
    for (let k = 0; k < crunches; k++) {
      noiseBurst('bandpass', 700 + rnd() * 1500, 0.9, (0.12 + s * 0.3) * (1 - k / (crunches + 1)), k * (0.025 + rnd() * 0.035), 0.06 + rnd() * 0.1, true);
    }

    // 3. Metal clangs: short inharmonic rings from suspension and wheel tethers.
    const rings = 1 + Math.round(s * 3);
    for (let k = 0; k < rings; k++) {
      const o = ctx.createOscillator(), at = rnd() * 0.08;
      o.type = 'triangle';
      o.frequency.setValueAtTime(900 + rnd() * 2600, t0 + at);
      o.frequency.exponentialRampToValueAtTime(600 + rnd() * 400, t0 + at + 0.4);
      o.connect(env(0.02 + s * 0.05, at, 0.15 + rnd() * 0.3));
      o.start(t0 + at); o.stop(t0 + at + 0.6);
    }

    // 4. Debris: bright clatter of fragments landing, then a scraping tail on big hits.
    const bits = Math.round(s * 12);
    for (let k = 0; k < bits; k++) {
      noiseBurst('bandpass', 2500 + rnd() * 5000, 6, 0.04 + rnd() * 0.08 * s, 0.08 + rnd() * (0.3 + s * 0.6), 0.02 + rnd() * 0.04);
    }
    if (s > 0.3) noiseBurst('highpass', 1800, 0.7, 0.05 + s * 0.12, 0.05, 0.5 + s * 0.6);
  }
  // Overrun pops: short bursts of filtered noise when lifting off at high revs.
  function overrunPops() {
    const t0 = audio.ctx.currentTime, n = 3 + Math.floor(Math.random() * 5);
    for (let k = 0; k < n; k++) {
      const src = audio.ctx.createBufferSource(), flt = audio.ctx.createBiquadFilter(), gn = audio.ctx.createGain();
      src.buffer = audio.noise;
      flt.type = 'bandpass'; flt.frequency.value = 500 + Math.random() * 900; flt.Q.value = 1.2;
      gn.gain.value = 0.12 + Math.random() * 0.18;
      src.connect(flt); flt.connect(gn); gn.connect(audio.master);
      src.start(t0 + 0.05 + Math.random() * 0.7, Math.random() * 0.1, 0.03 + Math.random() * 0.03);
    }
  }
  // Rough rpm of an AI car from its speed (same gearbox as ours).
  const aiRpm = v => {
    for (let g = 1; g <= 8; g++) if (v < GEAR_TOP[g] * 0.96 || g === 8) return clamp(v / GEAR_TOP[g] * REDLINE, IDLE_RPM, REDLINE);
    return REDLINE;
  };
  function setVoice(vc, rpm, throttle, vol, t) {
    const f0 = rpm / 120;                                     // combustion-cycle frequency
    vc.o1.frequency.setTargetAtTime(f0, t, 0.02);
    vc.o2.frequency.setTargetAtTime(f0 * 1.006, t, 0.02);
    vc.drive.gain.setTargetAtTime(0.6 + throttle * 1.3, t, 0.04);
    vc.lp.frequency.setTargetAtTime(380 + throttle * 1500 + (rpm / REDLINE) * 1100, t, 0.05);
    vc.gain.gain.setTargetAtTime(vol, t, 0.04);
  }
  function updateAudio() {
    if (!audio) return;
    const t = audio.ctx.currentTime;
    const on = !muted && !paused && inRace();
    const shiftCut = car.shiftTimer > 0 ? 0.35 : 1;
    setVoice(audio.me, car.rpm, car.throttle, on ? (0.07 + car.throttle * 0.11) * shiftCut : 0, t);
    const r = car.rpm / REDLINE;
    audio.roarFilter.frequency.setTargetAtTime(500 + r * 900, t, 0.05);
    audio.roarGain.gain.setTargetAtTime(on ? car.throttle * r * 0.05 : 0, t, 0.05);
    audio.turbo.frequency.setTargetAtTime(1800 + car.rpm * 0.22, t, 0.1);
    audio.turboGain.gain.setTargetAtTime(on ? 0.0025 * car.throttle * r : 0, t, 0.1);
    if (on && audio.lastThrottle > 0.6 && car.throttle < 0.2 && car.rpm > 8000 && race.state === 'racing') overrunPops();
    audio.lastThrottle = car.throttle;

    // Nearest other car: distance fall-off, stereo position and Doppler shift.
    let near = null, nd = 160;
    if (field && on) for (const ai of field.cars) {
      const d = Math.hypot(ai.x - camera.position.x, ai.z - camera.position.z);
      if (d < nd) { nd = d; near = ai; }
    }
    if (near) {
      const dx = camera.position.x - near.x, dz = camera.position.z - near.z, d = Math.max(1, Math.hypot(dx, dz));
      const ux = dx / d, uz = dz / d;
      const [pwx, pwz] = playerVel();
      const vs = (Math.sin(near.h) * near.v) * ux + (Math.cos(near.h) * near.v) * uz;   // source toward listener
      const vl = -(pwx * ux + pwz * uz);                                                  // listener toward source
      const doppler = clamp((343 + vl) / (343 - vs), 0.6, 1.6);
      setVoice(audio.other, aiRpm(near.v) * doppler, 0.8, 0.16 / (1 + d / 10), t);
      if (audio.other.pan.pan) {
        const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
        audio.other.pan.pan.setTargetAtTime(clamp(-(dx * right.x + dz * right.z) / d, -1, 1), t, 0.05);
      }
    } else {
      audio.other.gain.gain.setTargetAtTime(0, t, 0.1);
    }
    if (!on || race.state === 'countdown') audio.surfGain.gain.setTargetAtTime(0, t, 0.05);
  }

  // ---------- HUD ----------
  let toastTimer = 0;
  function toast(text, cls = '', secs = 2) {
    const el = $('toast');
    el.innerHTML = text.split('\n').map(s => s.replace(/</g, '&lt;')).join('<br>');
    el.className = 'show ' + cls;
    toastTimer = secs;
  }
  function updateHud(dt) {
    if (toastTimer > 0 && (toastTimer -= dt) <= 0) $('toast').className = '';
    const lapNo = Math.min(race.laps.length + 1, RACE_LAPS);
    $('h-lap').textContent = lapNo + '/' + RACE_LAPS;
    $('h-pos').textContent = field ? 'P' + playerPosition() + '/' + (field.cars.length + mp.remotes.size + 1) : 'SOLO';
    const running = race.state === 'racing';
    $('h-cur').textContent = fmt(running ? race.time - race.lapStart : 0);
    $('h-last').textContent = fmt(race.laps[race.laps.length - 1]);
    $('h-best').textContent = race.laps.length ? fmt(Math.min(...race.laps)) : '--';
    const rec = records[T.def.id];
    $('h-rec').textContent = fmt(rec && rec.bestLap);
    $('hud-total').textContent = fmt(race.time);
    const WX = WEATHERS[weather];
    $('h-weather').textContent = WX.wind ? 'WIND ' + Math.round(wfx.wind.speed * 3.6) + ' KM/H' : WX.label.toUpperCase();
    $('h-weather').className = WX.wind ? 'storm' : '';
    $('h-speed').textContent = Math.round(Math.abs(car.v) * 3.6);
    $('h-gear').textContent = car.neutral ? 'N' : car.gear === -1 ? 'R' : car.gear;
    $('ersfill').style.width = (car.ers * 100).toFixed(0) + '%';
    const ot = $('ot');
    ot.textContent = car.boost ? 'OVERTAKE' : car.otAvail ? (car.ers > 0.01 ? (isTouch ? 'OVERTAKE READY' : 'OVERTAKE READY · SPACE') : 'BATTERY EMPTY') : 'OVERTAKE: GET WITHIN 1s';
    ot.className = car.boost ? 'on' : car.otAvail && car.ers > 0.01 ? 'ready' : '';
    $('rpmfill').style.width = Math.min(100, (car.rpm - 2000) / (REDLINE - 2000) * 100).toFixed(1) + '%';
    $('h-mode').textContent = '#' + selectedDriver.num + ' ' + selectedDriver.code + '  ·  ' + selectedTeam.name.toUpperCase() + '  ·  ' + (car.auto ? 'AUTOMATIC' : Wheel.state.hasShifter ? 'H-SHIFTER' : Wheel.state.connected ? 'MANUAL  PADDLES' : 'MANUAL  Q/E') + '  ·  ' + CAMERAS[camIdx].toUpperCase();
    const label = car.offTrack ? SURFACES[car.surface].label : car.dirt > 0.2 ? 'DIRTY TYRES' : '';
    $('offtrack').textContent = label;
    $('offtrack').classList.toggle('hidden', !(running && label));
    drawMinimap();
  }
  function setLights(n) {
    const els = document.querySelectorAll('.light');
    els.forEach((el, i) => el.classList.toggle('on', i < n));
    gantryLights.forEach((m, i) => m.color.setHex(i < n ? 0xff1a1a : 0x330808));
  }

  // ---------- Screens ----------
  const show = (id, on) => {
    $(id).classList.toggle('hidden', !on);
    if (id === 'hud') racingMode(on);
  };
  const hex = c => '#' + c.toString(16).padStart(6, '0');
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function raceEndDate(def) {
    const [day, mon] = def.dates.split(' - ').pop().split(' ');
    return new Date(SEASON_YEAR, MONTHS.indexOf(mon), +day, 23, 59);
  }

  function buildMenu() {
    const grid = $('track-grid');
    grid.innerHTML = '';
    const now = new Date();
    const next = TRACKS.find(d => raceEndDate(d) >= now);
    for (const def of TRACKS) {
      const card = document.createElement('div');
      card.className = 'card' + (def === next ? ' next' : '');
      const cv = document.createElement('canvas');
      cv.width = 420; cv.height = 300;
      const rec = records[def.id] || {};
      card.innerHTML = `<div class="round"><span>ROUND ${def.round}</span><span>${def.dates}</span></div>
        <h3></h3><div class="meta"></div>
        <div class="rec mono">Fastest lap: <b>${fmt(rec.bestLap)}</b><br>Best race (${RACE_LAPS} laps): <b>${fmt(rec.bestRace)}</b></div>`;
      card.querySelector('.round').after(cv);
      if (def === next) card.querySelector('.round').insertAdjacentHTML('beforeend', '<em>NEXT RACE</em>');
      else if (raceEndDate(def) < now) card.classList.add('done');
      card.querySelector('h3').textContent = def.name;
      card.querySelector('.meta').textContent = `${def.event ? def.event + ' · ' : ''}${def.country} · ${(def.lengthM / 1000).toFixed(3)} km${def.walls ? ' · street circuit' : ''}`;
      const time = (THEMES[def.id] || {}).time || 'day';
      const tod = document.createElement('span');
      tod.className = 'tod ' + time;
      tod.textContent = { day: 'Day race', dusk: 'Sunset race', night: 'Night race' }[time];
      card.querySelector('h3').append(tod);
      drawPreview(cv, def);
      card.addEventListener('click', () => openTrack(def));
      grid.appendChild(card);
    }
  }
  function drawPreview(cv, def) {
    const pts = buildCenterline(def, 8);
    const xs = pts.map(p => p[0]), zs = pts.map(p => -p[1]);
    const xf = trackTransform(xs, zs, cv.width, cv.height, 30);
    const g = cv.getContext('2d');
    const bg = { day: '#2f6b25', dusk: '#5a4a3a', night: '#141b2e' }[(THEMES[def.id] || {}).time || 'day'];
    g.fillStyle = bg; g.fillRect(0, 0, cv.width, cv.height);
    g.beginPath();
    pts.forEach((p, i) => { const [x, y] = xf(xs[i], zs[i]); i ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.closePath();
    g.lineJoin = 'round';
    g.strokeStyle = '#f2f2f2'; g.lineWidth = 12; g.stroke();
    g.strokeStyle = '#3d3d42'; g.lineWidth = 8; g.stroke();
    const [sx, sy] = xf(xs[0], zs[0]);
    g.fillStyle = '#e10600'; g.beginPath(); g.arc(sx, sy, 7, 0, Math.PI * 2); g.fill();
  }

  function buildPicker() {
    const grid = raceMode === 'grid';
    document.querySelectorAll('#mode-btns button').forEach(b => b.classList.toggle('sel', b.dataset.mode === raceMode));
    document.querySelectorAll('#diff-btns button').forEach(b => b.classList.toggle('sel', b.dataset.diff === difficulty));
    show('diff-row', grid);
    $('driver-title').textContent = grid ? 'Choose the driver you replace' : 'Choose your team';
    const box = $('team-grid');
    box.innerHTML = '';
    for (const drv of DRIVERS) {
      const team = teamOf(drv);
      const b = document.createElement('button');
      b.className = 'team' + (drv === selectedDriver ? ' sel' : '');
      b.innerHTML = `<i style="background:linear-gradient(135deg, ${hex(team.body)} 0 50%, ${hex(team.second === team.body ? team.accent : team.second)} 50% 80%, ${hex(team.stripe)} 80%)"></i><span><b></b><small></small></span>`;
      b.querySelector('b').textContent = `${drv.num} ${drv.name}`;
      b.querySelector('small').textContent = team.name;
      b.onclick = () => {
        selectedDriver = drv; selectedTeam = team;
        rebuildCar(); syncModel(); buildPicker();
      };
      box.appendChild(b);
    }
  }
  document.querySelectorAll('#mode-btns button').forEach(b => { b.onclick = () => { raceMode = b.dataset.mode; buildPicker(); }; });
  document.querySelectorAll('#diff-btns button').forEach(b => { b.onclick = () => { difficulty = b.dataset.diff; buildPicker(); }; });
  // Weather picker (pre-race screen): the scene behind the panel changes straight away.
  function syncWeatherBtns() {
    document.querySelectorAll('#weather-btns button').forEach(b => b.classList.toggle('sel', b.dataset.weather === weather));
  }
  document.querySelectorAll('#weather-btns button').forEach(b => {
    b.onclick = () => {
      weather = b.dataset.weather;
      try { localStorage.setItem('weather', weather); } catch (e) {}
      applyWeather();
      syncWeatherBtns();
      b.blur();
    };
  });
  syncWeatherBtns();

  // Music style and race-music switch (track list and pause screen), remembered between visits.
  // Each style: [track list song, driver lobby song (pre-race/pause/results), in-race song].
  const MUSIC_STYLES = {
    original: ['paddock', 'anthem', 'grandprix'],
    jazz: ['jazz', 'cafe', 'jazzrace'],
    classical: ['classical', 'etude', 'flamenco'],
    off: [null, null, null],
  };
  let musicStyle = 'original', raceMusic = true;
  try {
    const s = localStorage.getItem('musicStyle'); if (s in MUSIC_STYLES) musicStyle = s;
    raceMusic = localStorage.getItem('raceMusic') !== 'off';
  } catch (e) {}
  function syncMusicBtns() {
    document.querySelectorAll('.music-btns button').forEach(b => b.classList.toggle('sel', b.dataset.music === musicStyle));
    document.querySelectorAll('.racemusic-btns button').forEach(b => b.classList.toggle('sel', (b.dataset.race === 'on') === raceMusic));
  }
  function musicButton(b, apply) {
    b.onclick = () => {
      apply();
      try { localStorage.setItem('musicStyle', musicStyle); localStorage.setItem('raceMusic', raceMusic ? 'on' : 'off'); } catch (e) {}
      syncMusicBtns();
      b.blur();   // so Space (overtake) doesn't re-press it later
    };
  }
  document.querySelectorAll('.music-btns button').forEach(b => musicButton(b, () => { musicStyle = b.dataset.music; }));
  document.querySelectorAll('.racemusic-btns button').forEach(b => musicButton(b, () => { raceMusic = b.dataset.race === 'on'; }));
  syncMusicBtns();

  // All cars as { s, d, v } for traffic checks and positions. Once you've seen the results of an
  // online race your car is off the track, so the others drive through.
  function racers() {
    const me = { s: playerS, d: car.lateral, v: Math.abs(car.v), isPlayer: true };
    const mine = mp.racing && race.state === 'results' ? [] : [me];
    return field ? [...mine, ...field.cars, ...liveRemotes()] : mine;
  }
  // Every other car in the race, finished or not (for positions).
  const rivals = () => field ? [...field.cars, ...mp.remotes.values()] : [];
  function playerPosition() {
    if (!field) return 1;
    if (race.state === 'finished' || race.state === 'results') {
      return 1 + rivals().filter(c => c.finish !== null && c.finish < finalTime()).length;
    }
    return 1 + rivals().filter(c => c.finish !== null || c.s > playerS).length;
  }

  // Overtake mode is available within 1 s of the car ahead (kept for 2 s after dropping out of range).
  // Max Verstappen passing you (behind you last frame, now just ahead) plays a piano riff - once per
  // pass, and not again while it's still playing.
  let verBehind = null, riffUntil = 0;
  function checkVerstappenPass() {
    const ver = field.cars.find(c => c.drv.code === 'VER');
    if (!ver) return;                                   // you're driving for him
    const gap = ver.s - playerS, behind = gap < 0;
    if (verBehind === true && !behind && gap < 30 && race.state === 'racing' && audio && !muted && audio.ctx.currentTime > riffUntil) {
      riffUntil = audio.ctx.currentTime + LobbyMusic.riff(audio.ctx, audio.ctx.destination);   // own compressor, not squashed by the engine
      toast('DU DU DU DU MAX VERSTAPPEN', '', 1.8);
    }
    verBehind = behind;
  }

  function updateOvertakeWindow(dt) {
    const v = Math.max(Math.abs(car.v), 10);
    let gap = Infinity;
    for (const o of [...field.cars, ...liveRemotes()]) {
      const d = o.s - playerS;
      if (d > 0 && d < gap) gap = d;
    }
    car.otHold = gap / v < 1 ? 2 : Math.max(0, car.otHold - dt);
    car.otAvail = car.otHold > 0;
  }

  // Oriented-box overlap test (separating axes) between car A and car B. Returns how deep they
  // overlap, the contact normal (pointing from B to A) and the contact point, or null.
  function boxOverlap(ax0, az0, ah, bx0, bz0, bh) {
    const fx = Math.sin(ah), fz = Math.cos(ah), gx = Math.sin(bh), gz = Math.cos(bh);
    const dx = bx0 - ax0, dz = bz0 - az0;
    if (dx * dx + dz * dz > 49) return null;
    const inside = (px, pz, cx, cz, f0, f1) => {      // is point inside the box centred c with forward (f0, f1)?
      const ex = px - cx, ez = pz - cz;
      return Math.abs(ex * f0 + ez * f1) <= HALF_L && Math.abs(ex * f1 - ez * f0) <= HALF_W;
    };
    const corners = (cx, cz, f0, f1) => [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) =>
      [cx + f1 * HALF_W * a + f0 * HALF_L * b, cz - f0 * HALF_W * a + f1 * HALF_L * b]);
    let pen = Infinity, nX = 0, nZ = 0;
    for (const [ax, az] of [[fx, fz], [fz, -fx], [gx, gz], [gz, -gx]]) {
      const pa = HALF_L * Math.abs(fx * ax + fz * az) + HALF_W * Math.abs(fz * ax - fx * az);
      const pb = HALF_L * Math.abs(gx * ax + gz * az) + HALF_W * Math.abs(gz * ax - gx * az);
      const p = pa + pb - Math.abs(dx * ax + dz * az);
      if (p <= 0) return null;
      if (p < pen) { pen = p; nX = ax; nZ = az; }
    }
    if (nX * -dx + nZ * -dz < 0) { nX = -nX; nZ = -nZ; }
    // Contact point: corners of each car inside the other (average), else halfway between them.
    const pts = corners(ax0, az0, fx, fz).filter(([px, pz]) => inside(px, pz, bx0, bz0, gx, gz))
      .concat(corners(bx0, bz0, gx, gz).filter(([px, pz]) => inside(px, pz, ax0, az0, fx, fz)));
    let cx = (ax0 + bx0) / 2, cz = (az0 + bz0) / 2;
    if (pts.length) { cx = pts.reduce((s, p) => s + p[0], 0) / pts.length; cz = pts.reduce((s, p) => s + p[1], 0) / pts.length; }
    return { pen, nX, nZ, cx, cz };
  }

  // Impulse between two equal-mass cars meeting at (cx, cz): the player (velocity wx, wz, yaw rate
  // wp) and another car B (velocity bx, bz, yaw rate wb, centre at ox, oz). Returns the impulse on
  // the player (B gets the opposite), the closing speed and how hard the hit was, or null if the
  // cars are already moving apart.
  function contactImpulse(c, wx, wz, wp, ox, oz, bx, bz, wb) {
    const { nX, nZ, cx, cz } = c;
    const rpx = cx - car.x, rpz = cz - car.z, rax = cx - ox, raz = cz - oz;
    const vrx = (wx + wp * rpz) - (bx + wb * raz), vrz = (wz - wp * rpx) - (bz - wb * rax);
    const vn = vrx * nX + vrz * nZ;
    if (vn >= 0) return null;
    const rpn = cross2(rpx, rpz, nX, nZ), ran = cross2(rax, raz, nX, nZ);
    // A tap (low closing speed) is soft and barely twists the cars; a real hit bounces and spins.
    const hard = Math.min(1, -vn / 6);
    const j = -(1 + 0.2 * hard) * vn / (2 / MASS + rpn * rpn / CAR_I + ran * ran / CAR_I);
    const qX = -nZ, qZ = nX;
    const rpt = cross2(rpx, rpz, qX, qZ), rat = cross2(rax, raz, qX, qZ);
    const jt = clamp(-(vrx * qX + vrz * qZ) / (2 / MASS + rpt * rpt / CAR_I + rat * rat / CAR_I), -0.3 * j, 0.3 * j);
    const ix = nX * j + qX * jt, iz = nZ * j + qZ * jt;
    return { ix, iz, vn, hard, spinP: cross2(rpx, rpz, ix, iz) / CAR_I * (0.25 + 0.75 * hard), spinB: -cross2(rax, raz, ix, iz) / CAR_I * (0.25 + 0.75 * hard) };
  }

  // Player vs AI: an impulse at the contact point changes both cars' speed, sideways motion and spin.
  // In an online race the host's browser drives the AI, so a guest tells the host what the hit did.
  function carContacts() {
    field.cars.forEach((ai, idx) => {
      const c = boxOverlap(car.x, car.z, car.h, ai.x, ai.z, ai.h);
      if (!c) return;
      const { pen, nX, nZ, cx, cz } = c;
      const s0 = ai.s, d0 = ai.d, y0 = ai.yawVel;

      // Separate the cars.
      const p = trackPose(T, ai.s, ai.d);
      const tX = Math.sin(T.hd[p.i]), tZ = Math.cos(T.hd[p.i]), mX = T.nx[p.i], mZ = T.nz[p.i];
      car.x += nX * pen / 2; car.z += nZ * pen / 2;
      ai.s -= (nX * tX + nZ * tZ) * pen / 2;
      ai.d -= (nX * mX + nZ * mZ) * pen / 2;
      // A car against a barrier can't be pushed through it: we take the rest of the separation.
      const lim = ai.d > 0 ? dLimit(T, p.i, 1) : -dLimit(T, p.i, -1);
      const pinned = Math.abs(ai.d) >= Math.abs(lim) - 0.05;
      if (Math.abs(ai.d) > Math.abs(lim)) {
        const ex = ai.d - lim;
        ai.d = lim; car.x -= mX * ex; car.z -= mZ * ex;
      }

      // Impulse.
      const [wx, wz] = playerVel();
      const ax = tX * ai.v + mX * ai.latV, az = tZ * ai.v + mZ * ai.latV;
      const k = contactImpulse(c, wx, wz, car.yawVel + car.yawKin, ai.x, ai.z, ax, az, ai.yawVel);
      if (k) {
        setPlayerVel(wx + k.ix / MASS, wz + k.iz / MASS);
        car.yawVel += k.spinP;
        const nax = ax - k.ix / MASS, naz = az - k.iz / MASS;
        ai.v = Math.max(0, nax * tX + naz * tZ);
        ai.latV = nax * mX + naz * mZ;
        if (pinned && Math.sign(ai.latV) === Math.sign(ai.d)) {
          // The wall stops it, so the sideways push comes back on us instead.
          const [px, pz] = playerVel();
          setPlayerVel(px - mX * ai.latV, pz - mZ * ai.latV);
          ai.latV = 0;
        }
        ai.yawVel += k.spinB;
        if (ai.s < playerS) ai.backoff = 1.5;                       // the car that hit us from behind lifts off
        if (Math.abs(ai.yawVel) > 2.2) ai.spinT = 2.5;              // hit hard enough to spin them round
        impact(-k.vn, cx, car.y + 0.3, cz, nX, nZ);
        race.hitAt = race.time;
      }
      if (mp.racing && !mp.host) {
        Net.send({ t: 'bump', i: idx, ds: ai.s - s0, dd: ai.d - d0, v: ai.v, latV: ai.latV, dy: ai.yawVel - y0, spinT: ai.spinT, backoff: ai.backoff });
      }
    });
  }

  // Player vs another person's car. Both browsers see the contact, and each applies its own half.
  function remoteContacts() {
    for (const r of liveRemotes()) {
      const c = boxOverlap(car.x, car.z, car.h, r.x, r.z, r.h);
      if (!c) continue;
      car.x += c.nX * c.pen / 2; car.z += c.nZ * c.pen / 2;
      const [wx, wz] = playerVel();
      const fx = Math.sin(r.h), fz = Math.cos(r.h);
      const k = contactImpulse(c, wx, wz, car.yawVel + car.yawKin, r.x, r.z, fx * r.v + fz * r.vL, fz * r.v - fx * r.vL, r.w);
      if (!k) continue;
      setPlayerVel(wx + k.ix / MASS, wz + k.iz / MASS);
      car.yawVel += k.spinP;
      impact(-k.vn, c.cx, car.y + 0.3, c.cz, c.nX, c.nZ);
      race.hitAt = race.time;
    }
  }

  // ---------- Hurricane ----------
  // The gale shoves the AI cars too, now and then one gets thrown into a spin, and flying debris
  // hits whatever car it meets: the heavier it is and the faster it's going, the bigger the hit.
  let chaosT = 3;
  const SPARK = new THREE.Color(0xfff3b0);
  function knockAI(ai, dLat, dFwd, spin) {
    ai.latV += dLat;
    ai.v = Math.max(0, ai.v + dFwd);
    ai.yawVel += spin;
    if (Math.abs(ai.yawVel) > 2.2) ai.spinT = 2.5;
  }
  function hurricane(dt) {
    if (!WEATHERS[weather].wind || race.state !== 'racing') return;
    const w = wfx.wind;
    if (field && ownsAI()) {
      for (const ai of field.cars) {
        const i = trackPose(T, ai.s, ai.d).i, wl = w.x * T.nx[i] + w.z * T.nz[i];
        ai.latV += wl * Math.abs(wl) * 0.0045 * dt;
      }
      if ((chaosT -= dt) <= 0) {
        chaosT = 2 + Math.random() * 5;
        const ai = field.cars[Math.floor(Math.random() * field.cars.length)];
        if (ai.finish === null) knockAI(ai, (Math.random() - 0.5) * 16, -ai.v * 0.2, (Math.random() < 0.5 ? -1 : 1) * (1.5 + Math.random() * 3.5));
      }
    }
    for (const f of wfx.flyers) {
      if (!f.active || f.hitCd > 0) continue;
      const dx = f.x - car.x, dz = f.z - car.z;
      if (dx * dx + dz * dz < (f.r + 1.5) ** 2 && Math.abs(f.y - car.y - 0.5) < f.r + 0.8) {
        const [wx, wz] = playerVel(), rvx = f.vx - wx, rvz = f.vz - wz, rs = Math.hypot(rvx, rvz) || 1;
        const k = f.mass / (f.mass + MASS) * 1.4;
        setPlayerVel(wx + rvx * k, wz + rvz * k);
        car.yawVel += (Math.random() - 0.5) * k * 12;
        impact(rs * k * 2 + 2, f.x, f.y, f.z, rvx / rs, rvz / rs);
        f.vx = wx - rvx * 0.3; f.vz = wz - rvz * 0.3; f.vy = 5 + Math.random() * 7; f.hitCd = 1;
        race.hitAt = race.time;                                   // knocked off by debris: not a track-limits offence
        toast(f.kind.name === 'cow' ? 'MOOOOO!' : 'HIT BY FLYING ' + f.kind.name.toUpperCase() + '!', 'red', 1.3);
        continue;
      }
      if (!field || !ownsAI()) continue;
      for (const ai of field.cars) {
        const ex = f.x - ai.x, ez = f.z - ai.z;
        if (ex * ex + ez * ez > (f.r + 1.5) ** 2) continue;
        const p = trackPose(T, ai.s, ai.d);
        if (Math.abs(f.y - p.y - 0.5) > f.r + 0.8) continue;
        const k = f.mass / (f.mass + MASS) * 1.4;
        const tX = Math.sin(T.hd[p.i]), tZ = Math.cos(T.hd[p.i]);
        knockAI(ai, (f.vx * T.nx[p.i] + f.vz * T.nz[p.i]) * k, (f.vx * tX + f.vz * tZ - ai.v) * k * 0.5, (Math.random() - 0.5) * k * 12);
        spawnDebris(f.x, f.y, f.z, 12, -f.vx / 20, -f.vz / 20, p.y);
        f.vx *= -0.3; f.vz *= -0.3; f.vy = 5 + Math.random() * 7; f.hitCd = 1;
        break;
      }
    }
  }
  // Lightning landing next to the track: a shower of sparks, and any car close by gets thrown.
  function lightningStrike(x, z) {
    spawnDebris(x, car.y + 0.5, z, 40, 0, 0, car.y, SPARK);
    const d = Math.hypot(x - car.x, z - car.z);
    crashShake = Math.max(crashShake, 0.6 * clamp(1 - d / 40, 0.2, 1));
    if (race.state !== 'racing') return;
    if (d < 16) {
      const [wx, wz] = playerVel(), ux = (car.x - x) / (d || 1), uz = (car.z - z) / (d || 1);
      setPlayerVel(wx + ux * 9, wz + uz * 9);
      car.yawVel += (Math.random() < 0.5 ? -1 : 1) * 2.5;
      race.hitAt = race.time;
    }
    if (field && ownsAI()) for (const ai of field.cars) {
      if (Math.hypot(x - ai.x, z - ai.z) < 16) knockAI(ai, (Math.random() - 0.5) * 14, -ai.v * 0.3, (Math.random() < 0.5 ? -1 : 1) * 4);
    }
  }

  function openTrack(def) {
    $('loading').classList.remove('hidden');
    // Let the loading message paint before the (synchronous) scenery build.
    setTimeout(() => {
      if (field) { field.dispose(); field = null; }
      buildTrackScene(def);
      placeCarAt(3);
      race.state = 'prerace';
      const rec = records[def.id] || {};
      $('pr-name').textContent = def.name;
      $('pr-meta').textContent = `Round ${def.round} · ${def.dates} · ${def.event ? def.event + ' · ' : ''}${def.country} · ${(def.lengthM / 1000).toFixed(3)} km · ${RACE_LAPS} laps`;
      $('pr-lap').textContent = fmt(rec.bestLap);
      $('pr-race').textContent = fmt(rec.bestRace);
      $('pr-race-label').textContent = `Best race time (${RACE_LAPS} laps)`;
      buildPicker();
      show('menu', false); show('results', false); show('pause', false); show('hud', false);
      show('prerace', true);
      $('loading').classList.add('hidden');
    }, 30);
  }

  function startRace() {
    initAudio();
    lastDriverCode = selectedDriver.code;
    try { localStorage.setItem(LAST_DRIVER_KEY, lastDriverCode); } catch (e) { /* storage blocked: remember for this session only */ }
    if (document.activeElement) document.activeElement.blur();   // so Space doesn't re-press the button
    if (field) { field.dispose(); field = null; }
    if (mp.racing || raceMode === 'grid') {
      // Online: every driver in the lobby is a person; the host's settings decide the AI.
      const set = mp.racing ? mp.settings : { difficulty, fill: true };
      const humans = mp.racing ? mp.lineup.map(p => DRIVERS.find(d => d.code === p.drv)) : [selectedDriver];
      field = createField(T, humans, set.difficulty, RACE_LAPS, scene, shadowTex, WEATHERS[weather].grip, set.fill);
      const slot = field.slotOf(selectedDriver);
      const i = ((Math.round(slot.s / T.total * T.n) % T.n) + T.n) % T.n;
      placeCarAt(i);
      car.x += T.nx[i] * slot.d; car.z += T.nz[i] * slot.d;
      locateCar(false);
      playerS = slot.s;
      verBehind = null;
      field.sync(0);
    } else {
      placeCarAt(3);
      playerS = T.dist[3];
    }
    car.otAvail = !field; car.otHold = 0;
    car.dirt = 0;
    debris.forEach(d => { d.life = 0; });
    wfx.reset(); chaosT = 3;
    Object.assign(race, { state: 'countdown', time: 0, lapStart: 0, laps: [], cp: 0, cdT: 0, finishT: 0, newLapRec: false, newRaceRec: false, tainted: false, lapTainted: false, limits: 0, penalty: 0, wide: false, hitAt: -Infinity });
    race.goAt = 5 + 0.4 + Math.random() * 1.2;   // F1-style: five lights, then a random hold before lights out
    race.waiting = mp.racing;                     // online: lights wait until every driver has loaded
    if (mp.racing) mpSpawnRemotes();
    model.group.visible = true;
    paused = false;
    setLights(0);
    show('prerace', false); show('results', false); show('pause', false);
    show('hud', true); show('lights', true);
  }

  let resultsLaps = '';            // your lap table, kept so an online classification can refresh around it
  function showResults() {
    race.state = 'results';
    if (mp.racing) model.group.visible = false;   // off the track so the others drive through
    const fastest = Math.min(...race.laps);
    const rec = records[T.def.id];
    $('rs-meta').textContent = `${T.def.name} · ${selectedTeam.name} · ${RACE_LAPS} laps · ${WEATHERS[weather].label}${mp.racing ? ' · online' : ''}`;
    let html = '<table class="laps mono">';
    race.laps.forEach((t, i) => {
      html += `<tr class="${t === fastest ? 'fast' : ''}"><td>Lap ${i + 1}</td><td>${fmt(t)}</td></tr>`;
    });
    if (race.penalty) html += `<tr><td>Track limits penalty (${race.limits} offences)</td><td>+${race.penalty}.000</td></tr>`;
    html += `<tr><td><b>Total</b></td><td><b>${fmt(finalTime())}</b></td></tr></table>`;
    html += `<div class="recs mono">
      <span>Fastest lap (this race)</span><span class="v">${fmt(fastest)}${race.newLapRec ? ' <span class="newrec">NEW RECORD</span>' : ''}</span>
      <span>Track record lap</span><span class="v">${fmt(rec.bestLap)}</span>
      <span>Best race time</span><span class="v">${fmt(rec.bestRace)}${race.newRaceRec ? ' <span class="newrec">NEW RECORD</span>' : ''}</span>
    </div>`;
    resultsLaps = html;
    $('rs-body').innerHTML = field ? classification() + html : html;
    mpResultsButtons();
    show('hud', false);
    show('results', true);
  }
  // Online, others are still racing when you finish: update the order as they come in.
  function refreshClassification() {
    if (race.state === 'results' && field) $('rs-body').innerHTML = classification() + resultsLaps;
  }

  // Finishing order: finished cars by time, the rest estimated from their remaining distance.
  // Online, people still racing are marked as running.
  function classification() {
    const goal = RACE_LAPS * T.total, now = mp.racing ? mp.clock : race.time;
    const rows = [{ drv: selectedDriver, team: selectedTeam, t: finalTime(), me: true }];
    for (const o of rivals()) {
      const avg = Math.max(20, o.s / Math.max(now, 1));
      rows.push({ drv: o.drv, team: o.team, name: o.name, t: o.finish !== null ? o.finish : now + (goal - o.s) / avg, running: o.finish === null && mp.racing });
    }
    rows.sort((a, b) => a.t - b.t);
    let h = '<table class="laps class mono">';
    rows.forEach((r, k) => {
      const gap = r.running ? 'racing…' : k === 0 ? fmt(r.t) : '+' + (r.t - rows[0].t).toFixed(3);
      const who = r.me ? 'YOU' : r.name ? escapeHtml(r.name) : r.drv.code;
      h += `<tr class="${r.me ? 'me' : ''}"><td>P${k + 1}</td><td><i style="background:${hex(r.team.body)}"></i>${r.drv.num} ${who}</td><td>${r.team.name}</td><td>${gap}</td></tr>`;
    });
    return h + '</table>';
  }
  const escapeHtml = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  function goToMenu() {
    if (field) { field.dispose(); field = null; }
    race.state = 'menu';
    paused = false;
    show('hud', false); show('pause', false); show('results', false); show('prerace', false);
    buildMenu();
    show('menu', true);
  }

  function togglePause() {
    if (!['countdown', 'racing'].includes(race.state)) return;
    paused = !paused;
    show('btn-restart', !mp.racing);
    $('btn-quit').textContent = mp.racing ? 'Leave online race' : 'Choose track';
    $('pause').querySelector('.meta').textContent = mp.racing ? 'Online race: it carries on while this menu is open · Esc to resume' : 'Press Esc to resume';
    show('pause', paused);
  }

  // Menu line showing the connected wheel / controller.
  let inputStatusText = '';
  function updateInputStatus() {
    const W = Wheel.state;
    let t;
    if (!W.connected) t = isTouch ? 'Touch controls · Bluetooth controllers work too' : 'Keyboard · to use a wheel or controller, plug it in and press any button on it';
    else if (W.isWheel) t = `Wheel: ${W.name}${W.configured ? '' : ' · not set up yet, using default mapping'}`;
    else t = `Controller: ${W.name} · left stick steer, triggers gas/brake, bumpers shift, A overtake`;
    if (t === inputStatusText) return;
    inputStatusText = t;
    $('input-status-text').textContent = t;
    $('btn-wheel-setup').classList.toggle('hidden', !(W.connected && W.isWheel));
  }
  $('btn-wheel-setup').onclick = () => WheelSetup.open(saved => {
    inputStatusText = '';
    if (saved) toast('Wheel set up', 'green', 1.5);
  });

  $('btn-start').onclick = startRace;
  $('btn-back').onclick = goToMenu;
  $('btn-resume').onclick = togglePause;
  $('btn-restart').onclick = startRace;
  $('btn-quit').onclick = () => mp.racing ? mpLeave() : goToMenu();
  $('btn-again').onclick = () => mp.racing ? mpBackToLobby() : startRace();
  $('btn-tracks').onclick = () => mp.racing ? mpLeave() : goToMenu();
  $('menu-sub').textContent = `${SEASON_YEAR} calendar · ${TRACKS.length} rounds · every race is ${RACE_LAPS} laps`;

  // ---------- Multiplayer ----------
  // Browser to browser through PeerJS (js/net.js). Every browser drives its own car and sends where
  // it is ~15 times a second; the host passes everyone's cars on, and also drives the AI for the
  // empty seats and sends those. Between updates, each car carries on at its last speed and is eased
  // onto the next update so it doesn't jump.
  const SEND_EVERY = 1 / 15;
  const ownsAI = () => !mp.racing || mp.host;
  const r2 = n => Math.round(n * 100) / 100;
  // Other people's cars that are on the track.
  function liveRemotes() {
    const out = [];
    for (const r of mp.remotes.values()) if (!r.gone) out.push(r);
    return out;
  }

  // Your car: position, heading, speeds, steering, distance raced, finish time (-1 still racing),
  // gone (1 = finished and off the track).
  function myState() {
    const gone = race.state === 'results';
    const fin = race.state === 'finished' || gone ? r2(finalTime()) : -1;
    return [r2(car.x), r2(car.y + car.bumpY), r2(car.z), r2(wrapAngle(car.h)), r2(car.v), r2(car.vL), r2(car.yawVel + car.yawKin),
      r2(car.steerAngle), r2(car.pitch), r2(playerS), r2(car.lateral), car.brake > 0.05 ? 1 : 0, fin, gone ? 1 : 0];
  }
  // An update for another person's car, `age` seconds old: move it on by that much, then ease
  // towards it (or jump, if it's far off - a rejoin).
  function mpApplyCar(r, st, age) {
    let [x, y, z, h, v, vL, w, steer, pitch, s, d, brake, fin, gone] = st;
    age = Math.min(age, 0.3);
    const fx = Math.sin(h), fz = Math.cos(h);
    x += (fx * v + fz * vL) * age; z += (fz * v - fx * vL) * age; h += w * age; s += v * age;
    if (Math.hypot(x - r.x, z - r.z) > 25) { Object.assign(r, { x, y, z, h, s, d }); r.err = null; }
    else r.err = { x: x - r.x, y: y - r.y, z: z - r.z, h: wrapAngle(h - r.h), s: s - r.s, d: d - r.d };
    Object.assign(r, { v, vL, w, steer, pitch, brake, at: performance.now() });
    r.finish = fin >= 0 ? fin : null;
    if (gone && !r.gone && race.state === 'racing') toast(r.name + ' finished', '', 1.4);
    r.gone = !!gone;
    r.model.group.visible = !r.gone;
  }
  function mpUpdateRemotes(dt) {
    const k = 1 - Math.exp(-dt * 6);
    for (const r of mp.remotes.values()) {
      if (r.gone) continue;
      if (performance.now() - r.at < 1000) {       // nothing heard for a second: hold it where it is
        const fx = Math.sin(r.h), fz = Math.cos(r.h);
        r.x += (fx * r.v + fz * r.vL) * dt; r.z += (fz * r.v - fx * r.vL) * dt;
        r.h += r.w * dt; r.s += r.v * dt;
      }
      if (r.err) for (const key in r.err) { const e = r.err[key] * k; r[key] += e; r.err[key] -= e; }
      const g = r.model.group;
      g.position.set(r.x, r.y, r.z);
      g.rotation.set(-r.pitch, r.h, 0);
      r.spin += r.v * dt / 0.36;
      r.model.wheels.forEach(wh => { wh.rotation.x = r.spin; });
      r.model.frontPivots.forEach(pv => { pv.rotation.y = r.steer; });
      r.model.brakeMat.color.setHex(r.brake ? 0xff2020 : 0x440000);
    }
  }
  // Each person's car starts on its grid slot.
  function mpSpawnRemotes() {
    mpClearRemotes();
    for (const p of mp.lineup) {
      if (p.id === Net.id) continue;
      const drv = DRIVERS.find(d => d.code === p.drv), team = teamOf(drv);
      const m = buildCarModel(team, shadowTex, drv);
      m.group.rotation.order = 'YXZ';
      m.group.add(makeNameTag(drv, p.name));
      scene.add(m.group);
      const slot = field.slotOf(drv), g = trackPose(T, slot.s, slot.d);
      mp.remotes.set(p.id, {
        id: p.id, name: p.name, drv, team, model: m, x: g.x, y: g.y, z: g.z, h: g.h, pitch: g.pitch,
        v: 0, vL: 0, w: 0, steer: 0, brake: 0, s: slot.s, d: slot.d, finish: null, gone: false,
        at: performance.now(), err: null, spin: 0,
      });
    }
    mpUpdateRemotes(0);
  }
  function mpRemoveRemote(id) {
    const r = mp.remotes.get(id);
    if (!r) return;
    scene.remove(r.model.group);
    r.model.group.traverse(o => { if (o.material && o.material.map) o.material.map.dispose(); });
    disposeGroup(r.model.group);
    mp.remotes.delete(id);
  }
  function mpClearRemotes() { for (const id of [...mp.remotes.keys()]) mpRemoveRemote(id); }

  // Guest: AI cars as the host last sent them, `age` seconds ago.
  function mpApplyAI(list, age) {
    if (!field) return;
    list.forEach((st, i) => {
      const ai = field.cars[i];
      if (!ai) return;
      const [s, d, v, dv, yawOff, latV, yawVel, fin] = st;
      const ts = s + v * Math.min(age, 0.3);
      if (Math.abs(ts - ai.s) > 30) { ai.s = ts; ai.d = d; ai.err = null; }
      else ai.err = { s: ts - ai.s, d: d - ai.d };
      Object.assign(ai, { v, dv, yawOff, latV, yawVel });
      ai.finish = fin >= 0 ? fin : null;
    });
  }
  function mpPredictAI(dt) {
    const k = 1 - Math.exp(-dt * 6);
    for (const ai of field.cars) {
      ai.s += ai.v * dt;
      if (ai.err) {
        const es = ai.err.s * k, ed = ai.err.d * k;
        ai.s += es; ai.d += ed; ai.err.s -= es; ai.err.d -= ed;
      }
      ai.steer = Math.atan(T.turn[trackPose(T, ai.s, ai.d).i] * 3.6);
    }
  }

  // Guest: send your car to the host. Host: send everyone every car (each with how old it is) and
  // the AI; every 2 s, time a round trip to each guest.
  function mpSendState(dt) {
    if ((mp.sendT -= dt) > 0) return;
    mp.sendT = SEND_EVERY;
    if (!mp.host) { Net.send({ t: 'car', c: myState() }); return; }
    const now = performance.now(), cars = { host: [0, ...myState()] };
    for (const [id, raw] of mp.raw) cars[id] = [Math.round(now - raw.at + raw.lat), ...raw.c];
    const ai = field ? field.cars.map(a => [r2(a.s), r2(a.d), r2(a.v), r2(a.dv), r2(a.yawOff), r2(a.latV), r2(a.yawVel), a.finish === null ? -1 : r2(a.finish)]) : [];
    Net.broadcast({ t: 'snap', ai, cars });
    if ((mp.pingT -= SEND_EVERY) <= 0) {
      mp.pingT = 2;
      for (const p of mp.players) if (p.id !== 'host') Net.send({ t: 'ping', k: now, lat: mp.lats.get(p.id) || 0 }, p.id);
    }
  }

  // ----- Race start: everyone loads the circuit, then the lights start together -----
  function mpStartRace() {
    const msg = { t: 'start', settings: { ...mp.settings }, players: mp.players.map(p => ({ ...p })) };
    Net.broadcast(msg);
    mpBeginRace(msg);
  }
  function mpBeginRace(msg) {
    const me = msg.players.find(p => p.id === Net.id);
    if (!me) return;                    // joined after the grid was set: on the next one
    mpEndRace();
    mp.settings = msg.settings; mp.lineup = msg.players;
    mp.racing = true; mp.started = false; mp.clock = 0; mp.goSent = false; mp.ready.clear();
    selectedDriver = DRIVERS.find(d => d.code === me.drv); selectedTeam = teamOf(selectedDriver);
    rebuildCar();
    weather = msg.settings.weather;
    syncWeatherBtns();
    const def = TRACKS.find(t => t.id === msg.settings.track) || TRACKS[0];
    ['mp', 'menu', 'results', 'pause', 'prerace'].forEach(id => show(id, false));
    show('loading', true);
    setTimeout(() => {
      if (!mp.racing) return;           // left while loading
      if (!T || T.def !== def) buildTrackScene(def); else applyWeather();
      race.state = 'prerace';
      startRace();
      show('loading', false);
      toast('Waiting for every driver to load…', '', 60);
      if (mp.host) {
        mp.ready.add('host');
        mp.readyTimer = setTimeout(mpSendGo, 25000);   // don't wait forever for a slow one
        mpCheckReady();
      } else Net.send({ t: 'ready' });
    }, 30);
  }
  function mpCheckReady() {
    if (mp.host && mp.racing && !mp.goSent && mp.lineup.every(p => mp.ready.has(p.id) || !mp.players.some(q => q.id === p.id))) mpSendGo();
  }
  function mpSendGo() {
    if (!mp.racing || mp.goSent) return;
    mp.goSent = true;
    clearTimeout(mp.readyTimer);
    const goAt = 5 + 0.4 + Math.random() * 1.2;
    Net.broadcast({ t: 'go', goAt });
    mpGo(goAt);
  }
  function mpGo(goAt) {
    if (!mp.racing || !race.waiting) return;
    race.waiting = false; race.cdT = 0; race.goAt = goAt;
    mp.goT = performance.now() - (mp.host ? 0 : mp.lat);   // the host sent it this long ago
    toast('', '', 0);
  }

  // ----- Leaving -----
  function mpEndRace() {
    mp.racing = false; mp.started = false;
    clearTimeout(mp.readyTimer);
    mpClearRemotes();
    mp.raw.clear();
  }
  // Host: ends the race for everyone. Guest: leaves this race, stays in the lobby.
  function mpBackToLobby() {
    const ending = mp.host && mp.racing;
    mpEndRace();
    if (ending) Net.broadcast(mpLobbyMsg());
    goToMenu();
    openMp();
  }
  function mpLeave(reason) {
    mpEndRace();
    Net.close();
    mp.active = mp.host = false;
    mp.players = [];
    goToMenu();
    if (reason) { openMp(); mpStatus(reason, true); }
  }
  function mpResultsButtons() {
    $('btn-again').textContent = !mp.racing ? 'RACE AGAIN' : mp.host ? 'END RACE · BACK TO LOBBY' : 'BACK TO LOBBY';
    $('btn-tracks').textContent = mp.racing ? 'Leave online race' : 'Choose track';
  }

  // ----- Messages -----
  const mpLobbyMsg = () => ({ t: 'lobby', players: mp.players, settings: mp.settings, racing: mp.racing });
  function mpLobbyChanged() {
    Net.broadcast(mpLobbyMsg());
    if (!mp.racing) renderLobby();
  }
  const takenBy = code => mp.players.find(p => p.drv === code);
  const cleanName = n => String(n || '').replace(/\s+/g, ' ').trim().slice(0, 12) || 'Driver';

  Net.on('msg', (m, from) => {
    if (!m || typeof m !== 'object') return;
    if (mp.host) hostMsg(m, from); else guestMsg(m);
  });
  function hostMsg(m, from) {
    const p = mp.players.find(q => q.id === from);
    switch (m.t) {
      case 'hello': {
        if (p) return;
        if (mp.players.length >= Net.MAX_PLAYERS) { Net.send({ t: 'full' }, from); setTimeout(() => Net.kick(from), 500); return; }
        const want = DRIVERS.find(d => d.code === m.want && !takenBy(d.code));
        const drv = want || DRIVERS.find(d => !takenBy(d.code));
        mp.players.push({ id: from, name: cleanName(m.name), drv: drv.code });
        mpLobbyChanged();
        break;
      }
      case 'pick':
        if (p && DRIVERS.some(d => d.code === m.drv) && !takenBy(m.drv)) { p.drv = m.drv; mpLobbyChanged(); }
        break;
      case 'ready': mp.ready.add(from); mpCheckReady(); break;
      case 'car': {
        if (!mp.racing || !Array.isArray(m.c)) return;
        const lat = mp.lats.get(from) || 0;
        mp.raw.set(from, { c: m.c, at: performance.now(), lat });
        const r = mp.remotes.get(from);
        if (r) mpApplyCar(r, m.c, lat / 1000);
        break;
      }
      case 'pong': {
        const half = (performance.now() - m.k) / 2, old = mp.lats.get(from);
        mp.lats.set(from, old == null ? half : old * 0.7 + half * 0.3);
        break;
      }
      case 'bump': {                    // a guest hit an AI car: apply what the hit did to it
        const ai = mp.racing && field && field.cars[m.i];
        if (!ai) return;
        ai.s += m.ds; ai.d += m.dd; ai.v = m.v; ai.latV = m.latV; ai.yawVel += m.dy;
        ai.spinT = Math.max(ai.spinT, m.spinT); ai.backoff = Math.max(ai.backoff, m.backoff);
        break;
      }
    }
  }
  function guestMsg(m) {
    switch (m.t) {
      case 'lobby':
        mp.players = m.players; mp.settings = m.settings; mp.lobbyRacing = m.racing;
        if (mp.racing && !m.racing) mpBackToLobby();          // the host ended the race
        else if (!mp.racing) { show('mp', true); renderLobby(); }
        break;
      case 'full': mpLeave('That race is full (22 drivers).'); break;
      case 'start': mpBeginRace(m); break;
      case 'go': mpGo(m.goAt); break;
      case 'ping': mp.lat = m.lat; Net.send({ t: 'pong', k: m.k }); break;
      case 'snap': {
        if (!mp.racing) return;
        for (const id in m.cars) {
          const r = mp.remotes.get(id);
          if (r) mpApplyCar(r, m.cars[id].slice(1), (m.cars[id][0] + mp.lat) / 1000);
        }
        mpApplyAI(m.ai, mp.lat / 1000);
        break;
      }
      case 'left': {
        const r = mp.remotes.get(m.id);
        if (r) { if (race.state === 'racing') toast(r.name + ' left the race', '', 1.6); mpRemoveRemote(m.id); }
        break;
      }
    }
  }
  Net.on('leave', id => {
    const p = mp.players.find(q => q.id === id);
    mp.players = mp.players.filter(q => q.id !== id);
    mp.raw.delete(id); mp.lats.delete(id);
    if (mp.remotes.has(id)) {
      if (race.state === 'racing' && p) toast(p.name + ' left the race', '', 1.6);
      mpRemoveRemote(id);
      Net.broadcast({ t: 'left', id });
    }
    mpLobbyChanged();
    mpCheckReady();
  });
  Net.on('lost', () => mpLeave('Lost the connection to the host.'));

  // ----- Screens -----
  function mpStatus(text, err) {
    $('mp-status').textContent = text;
    $('mp-status').classList.toggle('err', !!err);
  }
  function openMp() {
    show('mp', true);
    if (mp.active) { renderLobby(); return; }
    show('mp-connect', true); show('mp-lobby', false);
    $('mp-name').value = mp.name;
  }
  function takeName() {
    const n = $('mp-name').value.replace(/\s+/g, ' ').trim().slice(0, 12);
    if (!n) { mpStatus('Enter your name first', true); $('mp-name').focus(); return false; }
    mp.name = n;
    try { localStorage.setItem('racing-sim-name', n); } catch (e) {}
    return true;
  }
  function renderLobby() {
    show('mp-connect', false); show('mp-lobby', true);
    $('mp-code-show').textContent = Net.code || '';
    const S = mp.settings, host = mp.host, n = mp.players.length;
    ['mp-settings', 'mp-start', 'mp-note'].forEach(id => show(id, host));
    ['mp-settings-view', 'mp-wait'].forEach(id => show(id, !host));
    const ai = S.fill ? Math.max(0, DRIVERS.length - n) : 0;
    if (host) {
      $('mp-track').value = S.track;
      document.querySelectorAll('#mp-weather button').forEach(b => b.classList.toggle('sel', b.dataset.weather === S.weather));
      document.querySelectorAll('#mp-fill button').forEach(b => b.classList.toggle('sel', (b.dataset.fill === 'ai') === S.fill));
      document.querySelectorAll('#mp-diff button').forEach(b => b.classList.toggle('sel', b.dataset.diff === S.difficulty));
      show('mp-diff', S.fill);
      $('mp-start').textContent = `START RACE · ${n} ${n === 1 ? 'driver' : 'drivers'}${ai ? ' + ' + ai + ' AI' : ''}`;
    } else {
      const def = TRACKS.find(t => t.id === S.track) || TRACKS[0];
      $('mp-settings-view').textContent = `${def.name} · ${WEATHERS[S.weather].label} · ${ai ? ai + ' AI cars (' + DIFFICULTY[S.difficulty].label.toLowerCase() + ')' : 'no AI'} · ${RACE_LAPS} laps`;
      $('mp-wait').textContent = mp.lobbyRacing ? 'A race is on right now. You\'ll be on the grid for the next one.' : 'Waiting for the host to start the race…';
    }
    $('mp-title').textContent = `DRIVERS ${n}/${Net.MAX_PLAYERS} · CLICK A FREE CAR TO TAKE IT`;
    const box = $('mp-grid');
    box.innerHTML = '';
    for (const drv of DRIVERS) {
      const team = teamOf(drv), owner = takenBy(drv.code), me = owner && owner.id === Net.id;
      const b = document.createElement('button');
      b.className = 'team' + (me ? ' sel' : owner ? ' taken' : '');
      b.innerHTML = `<i style="background:linear-gradient(135deg, ${hex(team.body)} 0 50%, ${hex(team.second === team.body ? team.accent : team.second)} 50% 80%, ${hex(team.stripe)} 80%)"></i><span><b></b><small></small></span>`;
      b.querySelector('b').textContent = `${drv.num} ${drv.name}`;
      b.querySelector('small').textContent = owner ? (me ? 'You' : owner.name) + (owner.id === 'host' ? ' · host' : '') : team.name;
      if (!owner) b.onclick = () => mpPick(drv.code);
      box.appendChild(b);
    }
  }
  function mpPick(code) {
    if (!mp.host) { Net.send({ t: 'pick', drv: code }); return; }
    if (takenBy(code)) return;
    mp.players.find(p => p.id === 'host').drv = code;
    mpLobbyChanged();
  }

  $('btn-mp').onclick = openMp;
  $('mp-back').onclick = () => show('mp', false);
  $('mp-host').onclick = async () => {
    if (!takeName()) return;
    mpStatus('Opening a room…');
    try {
      await Net.host();
      const now = new Date();
      mp.active = true; mp.host = true;
      mp.settings = { track: (TRACKS.find(d => raceEndDate(d) >= now) || TRACKS[0]).id, weather, fill: true, difficulty };
      mp.players = [{ id: 'host', name: mp.name, drv: selectedDriver.code }];
      mpStatus('');
      renderLobby();
    } catch (e) { mpStatus(e.message, true); }
  };
  async function mpJoin() {
    if (!takeName()) return;
    const code = $('mp-code').value.trim().toUpperCase();
    if (code.length !== 5) { mpStatus('Enter the 5-character room code', true); return; }
    mpStatus('Connecting…');
    try {
      await Net.join(code);
      mp.active = true; mp.host = false; mp.players = [];
      Net.send({ t: 'hello', name: mp.name, want: selectedDriver.code });
      mpStatus('Connected · waiting for the lobby…');
    } catch (e) { mpStatus(e.message, true); }
  }
  $('mp-join').onclick = mpJoin;
  $('mp-code').addEventListener('keydown', e => { if (e.key === 'Enter') mpJoin(); });
  $('mp-leave').onclick = () => { mpLeave(); openMp(); };
  $('mp-start').onclick = mpStartRace;
  $('mp-copy').onclick = () => {
    // Opened from a file on disk, the link points at the published game instead.
    const base = location.protocol === 'file:' ? 'https://lilbodnar.github.io/racing-simulator/' : location.href.split(/[?#]/)[0];
    const url = base + '?join=' + Net.code;
    const copied = () => { $('mp-copy').textContent = 'Link copied'; setTimeout(() => { $('mp-copy').textContent = 'Copy invite link'; }, 1600); };
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(copied, () => prompt('Invite link', url));
    else prompt('Invite link', url);
  };
  // Host settings.
  $('mp-track').innerHTML = TRACKS.map(d => `<option value="${d.id}">Round ${d.round} · ${escapeHtml(d.name)}</option>`).join('');
  $('mp-track').onchange = () => { mp.settings.track = $('mp-track').value; mpLobbyChanged(); };
  document.querySelectorAll('#mp-weather button').forEach(b => { b.onclick = () => { mp.settings.weather = b.dataset.weather; mpLobbyChanged(); }; });
  document.querySelectorAll('#mp-fill button').forEach(b => { b.onclick = () => { mp.settings.fill = b.dataset.fill === 'ai'; mpLobbyChanged(); }; });
  document.querySelectorAll('#mp-diff button').forEach(b => { b.onclick = () => { mp.settings.difficulty = b.dataset.diff; mpLobbyChanged(); }; });
  // An invite link (?join=CODE) opens the join screen with the code filled in.
  const invite = new URLSearchParams(location.search).get('join');
  if (invite) {
    $('mp-code').value = invite.toUpperCase().slice(0, 5);
    openMp();
    mpStatus('Enter your name and press Join');
  }

  // ---------- Main loop ----------
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    tick(now, true);
  }
  // A hidden tab gets no animation frames. In an online race keep simulating (and sending) anyway,
  // on a timer, so your car - and, if you host, the AI - doesn't freeze for everyone else.
  setInterval(() => { if (document.hidden && mp.racing) tick(performance.now(), false); }, 50);
  function tick(now, render) {
    const dt = Math.min(0.05, Math.max(0, now - last) / 1000);
    last = now;
    Wheel.poll();
    for (const a of Wheel.takeActions()) wheelAction(a);
    updateInputStatus();
    if (audio) {   // track list, driver lobby (pre-race, pause, results) and in-race songs of the chosen style
      const [menuSong, lobbySong, raceSong] = MUSIC_STYLES[musicStyle];
      let song = null;
      if (race.state === 'menu') song = menuSong;
      else if (paused || race.state === 'prerace' || race.state === 'results') song = lobbySong;
      else if (raceMusic && inRace()) song = raceSong;
      LobbyMusic.setPlaying(muted ? null : song, audio.ctx, audio.master);
      wfx.initAudio(audio.ctx, audio.master);
      if (race.state === 'menu') wfx.sound(false);
    }
    if (race.state === 'menu') {   // dancing driver on the track list, dressed as the last driver raced
      const d = DRIVERS.find(x => x.code === lastDriverCode) || DRIVERS[0], tm = teamOf(d);
      Dancer.setLook(HELMETS[d.code] || { base: tm.helmet, a: tm.stripe, b: tm.accent }, tm.body);
      Dancer.draw(now / 1000);
    }
    if (race.state === 'menu' || !T) return;

    // Pausing an online race only opens the menu: the race carries on (your car coasts).
    const frozen = paused && !mp.racing;
    if (!frozen) {
      if (race.state === 'countdown' && !race.waiting) {
        // Online the lights run on the real clock, so they go out together even on a slow computer.
        race.cdT = mp.racing ? (now - mp.goT) / 1000 : race.cdT + dt;
        setLights(race.cdT >= race.goAt ? 0 : Math.min(5, Math.floor(race.cdT)));
        if (race.cdT >= race.goAt) {
          race.state = 'racing';
          mp.started = true;
          show('lights', false);
          toast('GO!', 'green', 1.2);
        }
      }
      // Fixed-step physics for stable handling.
      const steps = Math.ceil(dt / (1 / 120));
      for (let s = 0; s < steps; s++) {
        const h = dt / steps;
        const prevIdx = car.idx;
        if (inRace()) physics(h);
        if (race.state === 'racing') { race.time += h; updateLaps(prevIdx); checkTrackLimits(); }
        if (inRace()) {
          let dd = T.dist[car.idx] - T.dist[prevIdx];
          if (dd > T.total / 2) dd -= T.total; else if (dd < -T.total / 2) dd += T.total;
          playerS += dd;
        }
      }
      if (mp.racing && mp.started) mp.clock += dt;
      // Online the host's browser keeps driving the AI after its own race ends, for the others.
      if (field && (inRace() || mp.racing)) {
        if (ownsAI()) field.update(dt, mp.racing ? mp.started : race.state !== 'countdown', mp.racing ? mp.clock : race.time, racers());
        else mpPredictAI(dt);
        if (inRace()) { updateOvertakeWindow(dt); checkVerstappenPass(); }
        field.sync(dt);
        if (inRace()) carContacts();
      }
      if (mp.racing) {
        mpUpdateRemotes(dt);
        if (inRace()) remoteContacts();
        mpSendState(dt);
        if (race.state === 'results' && (mp.resultsT -= dt) <= 0) { mp.resultsT = 1; refreshClassification(); }
      }
      if (inRace()) hurricane(dt);
      if (race.state === 'finished') {
        race.finishT += dt;
        if (race.finishT > 2.5) showResults();
      }
      if (inRace()) updateHud(dt);
      scenery.update(dt);
    }
    if (!render) return;
    if (!frozen && inRace()) surfaceEffects(dt);
    syncModel();
    updateDebris(frozen ? 0 : dt);
    updateDust(frozen ? 0 : dt);
    if (field && !inRace() && !mp.racing) field.sync(0);
    updateCamera(dt);
    wfx.update(frozen ? 0 : dt, camera.position, car, T.groundAt, !muted && !paused, lightningStrike);
    scenery.sky.position.copy(camera.position);
    updateAudio();
    renderer.render(scene, camera);
  }

  // Start the track-list music on load. Browsers usually block sound until the player clicks or
  // presses a key; if so, show a title screen that unlocks audio on the first gesture.
  const splash = $('splash');
  const unlock = () => { initAudio(); splash.classList.add('gone'); };
  addEventListener('pointerdown', unlock);
  addEventListener('keydown', unlock);
  initAudio();
  if (audio) {
    audio.ctx.addEventListener('statechange', () => { if (audio.ctx.state === 'running') splash.classList.add('gone'); });
    setTimeout(() => { if (audio.ctx.state !== 'running') splash.classList.remove('hidden'); }, 150);
  }

  buildMenu();
  requestAnimationFrame(frame);
})();

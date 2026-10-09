// Weather: sunny, cloudy, rainy, snowy and hurricane. Each sets how dark and grey the sky is, how
// far you can see, tyre grip (player and AI) and what falls from the sky. A hurricane adds gusting
// wind that shoves the cars around, lightning (some of it striking right next to the track) and
// flying debris - planks, barrels, tyres, cones, signs and the odd cow - that hits whatever is in
// its way.
//   grip:  tyre grip multiplier          tint/mix: fog & sky colour and how much it replaces the circuit's
//   light: sun / sky light multiplier    fog:      visibility multiplier (fog near / far)
const WEATHERS = {
  sunny:     { label: 'Sunny',     grip: 1,    sky: true,  tint: null,     mix: 0,    light: 1,    fog: 1 },
  cloudy:    { label: 'Cloudy',    grip: 0.97, sky: false, tint: 0xa9b1ba, mix: 0.85, light: 0.7,  fog: 0.45 },
  rainy:     { label: 'Rainy',     grip: 0.72, sky: false, tint: 0x7b858f, mix: 0.95, light: 0.5,  fog: 0.12,
               precip: 'rain', count: 5000, fall: 24, wet: true, lightning: [14, 35] },
  snowy:     { label: 'Snowy',     grip: 0.55, sky: false, tint: 0xdde3ea, mix: 0.95, light: 0.8,  fog: 0.09,
               precip: 'snow', count: 5000, fall: 2.2, snow: true },
  hurricane: { label: 'Hurricane', grip: 0.5,  sky: false, tint: 0x3a4447, mix: 1,    light: 0.35, fog: 0.035,
               precip: 'rain', count: 9000, fall: 30, wet: true, lightning: [2, 6], wind: true },
};

function createWeatherFx(scene) {
  const rand = Math.random;
  const MAX = 9000, HALF = 38, TOP = 30;

  // ---------- Rain (streaks) and snow (flakes), wrapped in a box that follows the camera ----------
  const px = new Float32Array(MAX), py = new Float32Array(MAX), pz = new Float32Array(MAX), ph = new Float32Array(MAX);
  const rainPos = new Float32Array(MAX * 6);
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3).setUsage(THREE.DynamicDrawUsage));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xb4c2d0, transparent: true, opacity: 0.5, depthWrite: false }));
  rain.frustumCulled = false; rain.visible = false;
  scene.add(rain);

  const snowPos = new Float32Array(MAX * 3);
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3).setUsage(THREE.DynamicDrawUsage));
  const flakeC = document.createElement('canvas'); flakeC.width = flakeC.height = 32;
  const fg = flakeC.getContext('2d'), grd = fg.createRadialGradient(16, 16, 1, 16, 16, 15);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.5, 'rgba(255,255,255,0.7)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  fg.fillStyle = grd; fg.fillRect(0, 0, 32, 32);
  const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ map: new THREE.CanvasTexture(flakeC), size: 0.22, transparent: true, depthWrite: false, color: 0xffffff }));
  snow.frustumCulled = false; snow.visible = false;
  scene.add(snow);

  // Lightning lights the whole scene for a moment.
  const flashLight = new THREE.AmbientLight(0xdfe8ff, 0);
  scene.add(flashLight);

  let W = WEATHERS.sunny, count = 0, seeded = false;
  let baseBg = new THREE.Color(), baseFog = new THREE.Color();
  const white = new THREE.Color(0xffffff);
  let time = 0, flash = 0, flashSeq = [], nextBolt = 5;
  const wind = { x: 0, z: 0, speed: 0, gust: 0, angle: rand() * Math.PI * 2 };
  let gustT = 0, gustLen = 0, gustPeak = 0, nextGust = 3;

  // ---------- Hurricane debris ----------
  const mat = c => new THREE.MeshLambertMaterial({ color: c });
  const KINDS = [
    { name: 'plank',  r: 1.5, mass: 40,  make: () => new THREE.Mesh(new THREE.BoxGeometry(3, 0.12, 0.35), mat(0x8a6238)) },
    { name: 'barrel', r: 0.6, mass: 140, make: () => new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.1, 12), mat(0xc0392b)) },
    { name: 'tyre',   r: 0.6, mass: 60,  make: () => new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.2, 8, 16), mat(0x161616)) },
    { name: 'cone',   r: 0.4, mass: 12,  make: () => new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.75, 10), mat(0xff7a1a)) },
    { name: 'sign',   r: 1.2, mass: 50,  make: () => {
      const c = document.createElement('canvas'); c.width = 128; c.height = 64;
      const g = c.getContext('2d');
      g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, 128, 64);
      g.fillStyle = '#e10600'; g.font = '900 34px Segoe UI, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('SLOW', 64, 34);
      return new THREE.Mesh(new THREE.BoxGeometry(2, 1, 0.08), new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(c) }));
    } },
    { name: 'cow',    r: 1.3, mass: 550, make: makeCow },
  ];
  function makeCow() {
    const g = new THREE.Group(), w = mat(0xf4f1ea), b = mat(0x1e1e1e), pink = mat(0xe8a0a0);
    const box = (sx, sy, sz, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); o.position.set(x, y, z); g.add(o); return o; };
    box(0.9, 0.8, 1.7, w, 0, 0.9, 0);                       // body
    box(0.92, 0.5, 0.5, b, 0, 1.05, 0.3);                   // patches
    box(0.92, 0.35, 0.4, b, 0, 0.8, -0.5);
    box(0.5, 0.5, 0.6, w, 0, 1.25, 1.05);                   // head
    box(0.45, 0.25, 0.2, pink, 0, 1.1, 1.38);               // nose
    box(0.08, 0.2, 0.08, b, 0.18, 1.6, 1.05); box(0.08, 0.2, 0.08, b, -0.18, 1.6, 1.05);   // horns
    for (const [x, z] of [[0.3, 0.6], [-0.3, 0.6], [0.3, -0.6], [-0.3, -0.6]]) box(0.2, 0.55, 0.2, w, x, 0.27, z);
    g.children.forEach(o => o.position.y -= 0.9);           // spin about the middle
    return g;
  }
  const flyers = [];
  for (let k = 0; k < 34; k++) {
    // Mostly light junk; one cow at a time at most.
    const kind = KINDS[k === 0 ? 5 : k % 5];
    const mesh = kind.make();
    mesh.visible = false;
    scene.add(mesh);
    flyers.push({ kind, mesh, r: kind.r, mass: kind.mass, active: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, sx: 0, sy: 0, sz: 0, life: 0, hitCd: 0 });
  }
  let spawnAcc = 0;

  // ---------- Sound: wind howl, rain hiss, thunder ----------
  let snd = null;
  function initAudio(ctx, out) {
    if (snd || !ctx) return;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = rand() * 2 - 1;
    const loop = () => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; };
    const chain = (type, f, q) => {
      const src = loop(), flt = ctx.createBiquadFilter(), gn = ctx.createGain();
      flt.type = type; flt.frequency.value = f; flt.Q.value = q; gn.gain.value = 0;
      src.connect(flt); flt.connect(gn); gn.connect(out);
      return { flt, gn };
    };
    snd = { ctx, out, buf, wind: chain('bandpass', 400, 1.6), rain: chain('highpass', 2500, 0.5) };
  }
  function thunder(delay, strength) {
    if (!snd) return;
    const { ctx, out, buf } = snd, t0 = ctx.currentTime + delay;
    for (let k = 0; k < 3; k++) {
      const src = ctx.createBufferSource(), flt = ctx.createBiquadFilter(), gn = ctx.createGain();
      src.buffer = buf; flt.type = 'lowpass'; flt.frequency.value = 160 + k * 120 + strength * 300;
      const at = t0 + k * (0.15 + rand() * 0.3);
      gn.gain.setValueAtTime(0.0001, at);
      gn.gain.exponentialRampToValueAtTime(0.5 * strength + 0.1, at + 0.04);
      gn.gain.exponentialRampToValueAtTime(0.0001, at + 1.5 + strength * 1.5);
      src.connect(flt); flt.connect(gn); gn.connect(out);
      src.start(at, rand(), 3.5);
    }
  }

  function reset() {
    flyers.forEach(f => { f.active = false; f.mesh.visible = false; });
    flash = 0; flashSeq = []; flashLight.intensity = 0;
    gustT = gustLen = 0; nextGust = 3; spawnAcc = 0;
    nextBolt = W.lightning ? W.lightning[0] + rand() * (W.lightning[1] - W.lightning[0]) : Infinity;
    seeded = false;
  }

  function set(kind, bgColor, fogColor) {
    W = WEATHERS[kind] || WEATHERS.sunny;
    count = W.precip ? W.count : 0;
    rain.visible = W.precip === 'rain';
    snow.visible = W.precip === 'snow';
    rainGeo.setDrawRange(0, count * 2);
    snowGeo.setDrawRange(0, count);
    rain.material.opacity = W.wind ? 0.6 : 0.45;
    baseBg.copy(bgColor); baseFog.copy(fogColor);
    reset();
  }

  function updateWind(dt) {
    if (!W.wind) { wind.x = wind.z = wind.speed = wind.gust = 0; return; }
    // Steady gale that swings direction, plus gusts that come out of nowhere.
    wind.angle += dt * (0.12 * Math.sin(time * 0.05) + 0.06 * Math.sin(time * 0.31));
    nextGust -= dt;
    if (nextGust <= 0 && gustT <= 0) {
      gustLen = gustT = 1.2 + rand() * 2.5; gustPeak = 0.6 + rand() * 0.6;
      nextGust = 2 + rand() * 6;
      if (rand() < 0.3) wind.angle += (rand() - 0.5) * 2.4;   // sudden shift
    }
    let g = 0;
    if (gustT > 0) { gustT -= dt; g = Math.sin(Math.PI * (1 - gustT / gustLen)) * gustPeak; }
    wind.gust = g;
    wind.speed = 24 + 6 * Math.sin(time * 0.7) + 4 * Math.sin(time * 2.3) + 30 * g;   // m/s (~90 - 230 km/h)
    wind.x = Math.sin(wind.angle) * wind.speed;
    wind.z = Math.cos(wind.angle) * wind.speed;
  }

  function seed(cam) {
    for (let k = 0; k < MAX; k++) {
      px[k] = cam.x + (rand() * 2 - 1) * HALF;
      py[k] = cam.y - 8 + rand() * TOP;
      pz[k] = cam.z + (rand() * 2 - 1) * HALF;
      ph[k] = rand() * 100;
    }
    seeded = true;
  }

  function updatePrecip(dt, cam) {
    if (!count) return;
    if (!seeded) seed(cam);
    const B = HALF * 2, wx = wind.x, wz = wind.z, fall = W.fall, isSnow = W.precip === 'snow';
    const streak = W.wind ? 0.035 : 0.045;
    for (let k = 0; k < count; k++) {
      let vx = wx, vz = wz, vy = -fall;
      if (isSnow) { vx += Math.sin(time * 1.3 + ph[k]) * 0.7; vz += Math.cos(time * 1.1 + ph[k] * 1.7) * 0.7; vy *= 0.7 + (ph[k] % 1) * 0.6; }
      px[k] += vx * dt; py[k] += vy * dt; pz[k] += vz * dt;
      // Wrap into the box around the camera.
      let dx = px[k] - cam.x, dz = pz[k] - cam.z;
      if (dx > HALF || dx < -HALF) px[k] = cam.x + (((dx + HALF) % B) + B) % B - HALF;
      if (dz > HALF || dz < -HALF) pz[k] = cam.z + (((dz + HALF) % B) + B) % B - HALF;
      if (py[k] < cam.y - 8) py[k] += TOP; else if (py[k] > cam.y - 8 + TOP) py[k] -= TOP;
      if (isSnow) {
        snowPos[k * 3] = px[k]; snowPos[k * 3 + 1] = py[k]; snowPos[k * 3 + 2] = pz[k];
      } else {
        const o = k * 6;
        rainPos[o] = px[k]; rainPos[o + 1] = py[k]; rainPos[o + 2] = pz[k];
        rainPos[o + 3] = px[k] - vx * streak; rainPos[o + 4] = py[k] - vy * streak; rainPos[o + 5] = pz[k] - vz * streak;
      }
    }
    (isSnow ? snowGeo : rainGeo).attributes.position.needsUpdate = true;
  }

  // Lightning: a flicker of 2-4 flashes; some bolts land right next to the player (onStrike).
  function updateLightning(dt, car, onStrike) {
    nextBolt -= dt;
    if (nextBolt <= 0 && W.lightning) {
      nextBolt = W.lightning[0] + rand() * (W.lightning[1] - W.lightning[0]);
      const close = W.wind && rand() < 0.35;
      let t = 0;
      flashSeq = [];
      for (let n = 2 + Math.floor(rand() * 3); n > 0; n--) { flashSeq.push([t, 0.6 + rand() * 0.6]); t += 0.06 + rand() * 0.12; }
      if (close) {
        const a = rand() * Math.PI * 2, r = 8 + rand() * 25;
        onStrike && onStrike(car.x + Math.sin(a) * r, car.z + Math.cos(a) * r);
        thunder(0.02, 1);
      } else thunder(0.6 + rand() * 2.2, 0.35 + rand() * 0.4);
    }
    flash = Math.max(0, flash - dt * 9);
    for (const s of flashSeq) {
      s[0] -= dt;
      if (s[0] <= 0 && s[1] > 0) { flash = Math.max(flash, s[1]); s[1] = 0; }
    }
    flashLight.intensity = flash * 2.2;
    scene.background.copy(baseBg).lerp(white, flash * 0.55);
    scene.fog.color.copy(baseFog).lerp(white, flash * 0.45);
  }

  // Debris blown in from upwind, tumbling along with the gale.
  function updateFlyers(dt, car, groundAt) {
    if (!W.wind) return;
    const ws = Math.max(wind.speed, 1), ux = wind.x / ws, uz = wind.z / ws;
    spawnAcc += dt * (1.6 + wind.gust * 4);
    while (spawnAcc > 1) {
      spawnAcc -= 1;
      const f = flyers.find(o => !o.active && (o.kind.name !== 'cow' || rand() < 0.08));
      if (!f) break;
      // Upwind of the car (and a bit ahead of it, so you see it coming).
      const back = 50 + rand() * 90, side = (rand() - 0.5) * 120, fwd = 20 + rand() * 60;
      const hx = Math.sin(car.h), hz = Math.cos(car.h);
      f.x = car.x - ux * back + uz * side + hx * fwd;
      f.z = car.z - uz * back - ux * side + hz * fwd;
      f.y = (groundAt ? groundAt(f.x, f.z) : car.y) + 2 + rand() * 12;
      const k = 0.55 + rand() * 0.5;
      f.vx = wind.x * k; f.vz = wind.z * k; f.vy = (rand() - 0.3) * 6;
      f.sx = (rand() - 0.5) * 10; f.sy = (rand() - 0.5) * 10; f.sz = (rand() - 0.5) * 10;
      f.life = 14; f.hitCd = 0; f.active = true; f.mesh.visible = true;
    }
    for (const f of flyers) {
      if (!f.active) continue;
      // Light things are carried at wind speed; heavy ones lag, fall and skid along.
      const carry = Math.min(1, 40 / f.mass) * 1.4;
      f.vx += (wind.x - f.vx) * carry * dt;
      f.vz += (wind.z - f.vz) * carry * dt;
      f.vy += (-9.81 + Math.min(8.5, wind.speed * wind.speed * 0.006 / Math.sqrt(f.mass / 40))) * dt;
      f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt;
      const gy = (groundAt ? groundAt(f.x, f.z) : car.y) + f.r * 0.5;
      if (f.y < gy) { f.y = gy; f.vy = Math.abs(f.vy) * 0.45 + rand() * 5; f.sx = (rand() - 0.5) * 14; f.sz = (rand() - 0.5) * 14; }
      f.mesh.position.set(f.x, f.y, f.z);
      f.mesh.rotation.x += f.sx * dt; f.mesh.rotation.y += f.sy * dt; f.mesh.rotation.z += f.sz * dt;
      f.hitCd = Math.max(0, f.hitCd - dt);
      f.life -= dt;
      if (f.life <= 0 || Math.hypot(f.x - car.x, f.z - car.z) > 260) { f.active = false; f.mesh.visible = false; }
    }
  }

  function updateSound(on) {
    if (!snd) return;
    const t = snd.ctx.currentTime;
    const windVol = W.wind ? 0.05 + 0.1 * Math.min(1, wind.speed / 55) : W.snow ? 0.015 : 0;
    snd.wind.gn.gain.setTargetAtTime(on ? windVol : 0, t, 0.15);
    snd.wind.flt.frequency.setTargetAtTime(250 + wind.speed * 9, t, 0.2);
    snd.rain.gn.gain.setTargetAtTime(on && W.wet ? (W.wind ? 0.07 : 0.035) : 0, t, 0.2);
  }

  return {
    wind, flyers,
    get kind() { return W; },
    initAudio, set, reset, sound: updateSound,
    // cam: camera position; car: { x, z, y, h }; soundOn: in a race and not muted / paused.
    update(dt, cam, car, groundAt, soundOn, onStrike) {
      time += dt;
      updateWind(dt);
      updatePrecip(dt, cam);
      updateLightning(dt, car, onStrike);
      updateFlyers(dt, car, groundAt);
      updateSound(soundOn);
    },
  };
}

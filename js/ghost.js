// Ghost car: your best lap on each circuit, replayed as a see-through car to race against.
// While you drive, where the car is gets noted 10 times a second (position, heading, pitch). When a
// clean lap beats the saved ghost, that lap becomes the new ghost. Ghosts are saved on this device,
// one per circuit (about 25 KB each). The recording and playback are pure logic (see tests/); only
// makeModel needs three.js.
const Ghost = (() => {
  const STEP = 0.1;                     // seconds between samples
  const KEY = 'racing-sim-ghost:';      // + track id
  const F = 5;                          // numbers per sample: x, y, z, heading, pitch
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  const r = (n, k) => Math.round(n * k) / k;

  // Notes the car every STEP seconds of lap time. add() is called every physics step; each sample is
  // placed exactly on its time by blending the steps either side of it.
  function recorder() {
    let pts = [], k = 0, prev = null;
    return {
      reset() { pts = []; k = 0; prev = null; },
      add(lapT, x, y, z, h, pitch) {
        const cur = [lapT, x, y, z, h, pitch];
        while (lapT >= k * STEP - 1e-9) {
          const t = k * STEP;
          const f = prev && lapT > prev[0] ? Math.max(0, (t - prev[0]) / (lapT - prev[0])) : 1;
          const mix = i => prev ? prev[i] + (cur[i] - prev[i]) * f : cur[i];
          const hh = prev ? prev[4] + wrap(h - prev[4]) * f : h;
          pts.push(r(mix(1), 100), r(mix(2), 100), r(mix(3), 100), r(wrap(hh), 1000), r(mix(5), 1000));
          k++;
        }
        prev = cur;
      },
      // The finished lap as a ghost, or null if hardly anything was noted.
      take(time) { return pts.length >= F * 10 ? { v: 1, time, step: STEP, pts: pts.slice() } : null; },
    };
  }

  // Anything read from storage, checked before use. Null if it isn't a usable ghost.
  function validate(g) {
    if (!g || g.v !== 1 || !(g.time > 0) || !(g.step > 0) || !Array.isArray(g.pts)) return null;
    if (g.pts.length < F * 2 || g.pts.length % F || !g.pts.every(Number.isFinite)) return null;
    return g;
  }

  // Where the ghost is `t` seconds into its lap, or null once its lap is over.
  function at(g, t) {
    const n = g.pts.length / F;
    const f = t / g.step;
    if (!(f >= 0) || f > n - 1 || t > g.time) return null;
    const i = Math.min(Math.floor(f), n - 2), k = f - i, a = i * F, b = a + F, p = g.pts;
    const lerp = o => p[a + o] + (p[b + o] - p[a + o]) * k;
    return { x: lerp(0), y: lerp(1), z: lerp(2), h: p[a + 3] + wrap(p[b + 3] - p[a + 3]) * k, pitch: lerp(4) };
  }

  function load(trackId) {
    try { return validate(JSON.parse(localStorage.getItem(KEY + trackId))); } catch (e) { return null; }
  }
  function save(trackId, g) {
    try { localStorage.setItem(KEY + trackId, JSON.stringify(g)); return true; } catch (e) { return false; }   // storage full or blocked
  }

  // A car model drawn as a pale see-through shape, without its shadow.
  let mat = null;
  function makeModel(team, shadowTex, drv) {
    const m = buildCarModel(team, shadowTex, drv);
    mat = mat || new THREE.MeshBasicMaterial({ color: 0x9fe6ff, transparent: true, opacity: 0.32, depthWrite: false });
    m.group.traverse(o => {
      if (!o.material || o === m.shadow) return;
      [].concat(o.material).forEach(x => x.dispose());
      o.material = mat;
    });
    (m.group.userData.textures || []).forEach(t => t.dispose());
    m.group.userData.textures = [];
    m.shadow.visible = false;
    m.group.rotation.order = 'YXZ';
    m.group.renderOrder = 5;
    return m;
  }
  // Dispose a ghost model's geometry (its material is shared and kept).
  function disposeModel(m) {
    m.group.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o === m.shadow) o.material.dispose();
    });
  }

  return { STEP, recorder, validate, at, load, save, makeModel, disposeModel };
})();
if (typeof module !== 'undefined') module.exports = Ghost;

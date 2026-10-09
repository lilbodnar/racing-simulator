// AI opponents for full-grid races. Each AI drives along the track at a distance `s`
// (metres from the start line, keeps counting up across laps) and a lateral offset `d`
// from the centerline, following a precomputed speed profile scaled by driver skill.
const DIFFICULTY = {
  easy:   { label: 'Easy',   grip: 0.80, pace: 0.90 },
  medium: { label: 'Medium', grip: 0.88, pace: 0.95 },
  hard:   { label: 'Hard',   grip: 0.97, pace: 1.0 },
};

// Fastest possible speed at each sample: cornering limit, then braking and acceleration limits.
function computeSpeedProfile(T, gripScale) {
  const N = T.n, v = new Float32Array(N), VMAX = 93, ds = T.total / N;
  for (let i = 0; i < N; i++) {
    let c = 0;
    for (let o = -3; o <= 3; o++) c = Math.max(c, T.curv[(i + o + N) % N]);
    const R = 1 / Math.max(c, 1e-5), k = 0.0045 * gripScale * R;
    v[i] = k >= 1 ? VMAX : Math.min(VMAX, Math.sqrt(19 * gripScale * R / (1 - k)));
  }
  for (let pass = 0; pass < 2; pass++) {
    for (let i = N - 1; i >= 0; i--) {
      const j = (i + 1) % N, b = Math.min(40, 14 + 0.0045 * v[j] * v[j]) * 0.8;
      v[i] = Math.min(v[i], Math.sqrt(v[j] * v[j] + 2 * b * ds));
    }
    for (let i = 0; i < N; i++) {
      const j = (i - 1 + N) % N, s = Math.max(v[j], 4);
      const a = Math.max(0.3, Math.min(13 + 0.0035 * s * s, 750000 / (800 * s)) - 0.0011 * s * s - 0.25);
      v[i] = Math.min(v[i], Math.sqrt(v[j] * v[j] + 2 * a * ds));
    }
  }
  return v;
}

// Position, heading and pitch at distance s and lateral offset d.
function trackPose(T, s, d) {
  const N = T.n, sm = ((s % T.total) + T.total) % T.total;
  const f = sm / T.total * N, i = Math.floor(f) % N, j = (i + 1) % N, t = f - Math.floor(f);
  const lerp = (a, b) => a + (b - a) * t;
  const nx = lerp(T.nx[i], T.nx[j]), nz = lerp(T.nz[i], T.nz[j]);
  return {
    i,
    x: lerp(T.x[i], T.x[j]) + nx * d,
    z: lerp(T.z[i], T.z[j]) + nz * d,
    y: lerp(T.y[i], T.y[j]),
    h: T.hd[i] + Math.atan2(Math.sin(T.hd[j] - T.hd[i]), Math.cos(T.hd[j] - T.hd[i])) * t,
    pitch: Math.atan2(T.y[(i + 2) % N] - T.y[(i - 2 + N) % N], 4 * T.total / N),
  };
}

// How far from the centerline (on side +1 = left, -1 = right, at sample i) a car's centre can go
// before its body meets the barrier. Without a barrier there, a little way onto the run-off.
function dLimit(T, i, side) {
  const wall = (side > 0 ? T.wallL : T.wallR)[i];
  return Math.min(T.hw + 2, wall ? wall - 1.1 : Infinity);
}

// Grid slot k (0 = pole): two staggered columns 8 m apart, behind the start line.
function gridSlot(T, k) {
  return { s: -8 - 8 * k, d: (k % 2 ? -1 : 1) * Math.min(2.8, T.hw - 1.2) };
}

// weatherGrip: tyre grip multiplier from the weather (1 in the dry).
function createField(T, player, difficulty, laps, scene, shadowTex, weatherGrip = 1) {
  const diff = DIFFICULTY[difficulty];
  const profile = computeSpeedProfile(T, diff.grip * weatherGrip);
  const N = T.n, maxD = T.hw - 1.2;
  // Grid: fastest drivers at the front.
  const order = DRIVERS.slice().sort((a, b) => b.skill - a.skill);
  const slots = order.map((drv, k) => ({ drv, ...gridSlot(T, k) }));
  const cars = [];
  let playerSlot = null;
  for (const slot of slots) {
    if (slot.drv === player) { playerSlot = slot; continue; }
    const model = buildCarModel(teamOf(slot.drv), shadowTex, slot.drv);
    model.group.rotation.order = 'YXZ';
    model.group.add(nameTag(slot.drv));
    scene.add(model.group);
    cars.push({
      drv: slot.drv, team: teamOf(slot.drv), model, s: slot.s, d: slot.d, v: 0, dv: 0,
      pace: diff.pace * (0.955 + (slot.drv.skill - 0.935) * 0.9),
      react: 0.15 + Math.random() * 0.35, passD: 0, passT: 0, finish: null, spin: 0, steer: 0,
      latV: 0, yawVel: 0, yawOff: 0, spinT: 0, backoff: 0,   // knocked sideways / spun by contact
    });
  }

  function nameTag(drv) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 40;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(10,14,20,0.75)'; g.fillRect(0, 0, 128, 40);
    g.fillStyle = '#' + teamOf(drv).body.toString(16).padStart(6, '0'); g.fillRect(0, 0, 8, 40);
    g.fillStyle = '#fff'; g.font = 'bold 26px Segoe UI, sans-serif'; g.textBaseline = 'middle';
    g.fillText(drv.num + ' ' + drv.code, 16, 21);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
    sp.scale.set(2.4, 0.75, 1);
    sp.position.y = 2.1;
    sp.renderOrder = 10;
    return sp;
  }

  // Spacing in metres: car length/width, the gap to keep when following, and the sideways step for a pass.
  const CAR_L = 5.6, CAR_W = 2.4, FOLLOW = 8, PASS_W = 3.4;
  // True if no car (other than `me`) sits within a car's width of lateral offset d between s0 and s1.
  function laneClear(sorted, me, d, s0, s1) {
    return !sorted.some(o => o !== me && o.s > s0 && o.s < s1 && Math.abs(o.d - d) < CAR_W);
  }

  // racers: every car incl. the player as { s, d, v }.
  function update(dt, racing, time, racers) {
    const sorted = racers.slice().sort((a, b) => a.s - b.s);
    for (const ai of cars) {
      if (!racing || time < ai.react) { ai.v = 0; continue; }
      const p = trackPose(T, ai.s, ai.d);
      const done = ai.s >= laps * T.total;
      if (done && ai.finish === null) ai.finish = time;
      let target = done ? 30 : profile[(p.i + 3) % N] * ai.pace;
      if (ai.spinT > 0) { ai.spinT -= dt; target = 0; }          // spun: wait for the car to stop, then rejoin

      // Traffic: closest car ahead in our lane (looking further the faster we go), and anyone
      // alongside, so we never steer into a car next to us.
      let ahead = null, sideL = false, sideR = false;
      const look = 25 + ai.v * 1.2;
      for (const o of sorted) {
        if (o === ai) continue;
        const gap = o.s - ai.s, lat = o.d - ai.d;
        if (Math.abs(gap) < CAR_L + 1 && Math.abs(lat) < CAR_W + 1.6) { if (lat > 0) sideL = true; else sideR = true; }
        if (!ahead && gap > 0 && gap < look && Math.abs(lat) < CAR_W) ahead = o;
      }
      if (ahead) {
        const gap = ahead.s - ai.s;
        // Follow: only as fast as still lets us brake down to their speed before getting too close.
        const room = gap - FOLLOW;
        target = Math.min(target, room > 0 ? ahead.v + Math.sqrt(2 * 12 * room) : ahead.v + room * 1.5);
        // Try a move only into a lane that's on the track and clear; otherwise wait behind.
        if (ai.passT <= 0 && gap < 25 && profile[(p.i + 3) % N] * ai.pace > ahead.v + 1) {
          const inside = Math.sign(T.turn[(p.i + 12) % N]) || (ahead.d > 0 ? -1 : 1);
          for (const side of [inside, -inside]) {
            const d = ahead.d + side * PASS_W;
            if (Math.abs(d) <= maxD && laneClear(sorted, ai, d, ai.s - CAR_L, ahead.s + 15)) {
              ai.passD = d; ai.passT = 2.5; break;
            }
          }
        }
        // Overtake mode for the AI too: within a second of the car ahead on a straight.
        if (gap / Math.max(ai.v, 10) < 1 && T.curv[p.i] < 1 / 400) target = Math.min(target * 1.05, 98);
      }
      if (ai.backoff > 0) {                                      // just bumped the car ahead: back off
        ai.backoff -= dt;
        target = Math.min(target, (ahead ? ahead.v : ai.v) - 3);
      }
      if (ai.passT > 0 && (sideL || sideR)) ai.passT = Math.max(ai.passT, 0.5);   // finish the pass before tucking back in
      const accel = Math.max(0.3, Math.min(13 + 0.0035 * ai.v * ai.v, 750000 / (800 * Math.max(ai.v, 4))) - 0.0011 * ai.v * ai.v);
      const brake = Math.min(40, 14 + 0.0045 * ai.v * ai.v);
      ai.v = ai.v < target ? Math.min(target, ai.v + accel * dt) : Math.max(Math.max(0, target), ai.v - (ai.spinT > 0 ? 10 : brake) * dt);
      ai.s += ai.v * dt;

      // Racing line: drift to the inside of the upcoming corner, unless overtaking.
      const k = (p.i + 12) % N;
      const line = Math.sign(T.turn[k]) * Math.min(1, T.curv[k] * 140) * maxD * 0.85;
      ai.passT -= dt;
      let dTarget = ai.passT > 0 ? ai.passD : line;
      if ((dTarget > ai.d && sideL) || (dTarget < ai.d && sideR)) dTarget = ai.d;   // don't squeeze a car alongside
      // Sideways speed comes from steering, so it scales with forward speed (~7 degrees of heading)
      // up to 3 m/s - cars pulling off the grid steer across gradually instead of sliding over.
      const latMax = Math.min(3, ai.v * 0.12) * dt;
      const steerD = ai.spinT <= 0 ? Math.max(-latMax, Math.min(latMax, dTarget - ai.d)) : 0;
      ai.d += steerD;
      ai.dv = steerD / Math.max(dt, 1e-4);   // steering only: a shove slides the car, it doesn't turn it
      // Sideways shove from a contact, scrubbed off by the tyres.
      ai.d += ai.latV * dt;
      ai.latV = Math.abs(ai.latV) < 7 * dt ? 0 : ai.latV - Math.sign(ai.latV) * 7 * dt;
      // Barriers: a shove slides the car up to the wall, never through it (it bounces off a little).
      const lo = -dLimit(T, p.i, -1), hi = dLimit(T, p.i, 1);
      if (ai.d > hi || ai.d < lo) {
        ai.d = Math.max(lo, Math.min(hi, ai.d));
        if (Math.sign(ai.latV) === Math.sign(ai.d)) ai.latV *= -0.2;
      }
      if (Math.abs(ai.d) > maxD && !ai.latV) ai.d -= Math.sign(ai.d) * Math.min(Math.abs(ai.d) - maxD, 2 * dt);
      // Rotation from a contact: a spin carries on until the car stops; small wobbles are caught.
      ai.yawOff += ai.yawVel * dt;
      ai.yawVel *= Math.exp(-(ai.spinT > 0 ? 0.8 : 3) * dt);
      if (ai.spinT <= 0) {
        ai.yawOff = Math.atan2(Math.sin(ai.yawOff), Math.cos(ai.yawOff));
        ai.yawOff -= Math.sign(ai.yawOff) * Math.min(Math.abs(ai.yawOff), 1.5 * dt);
      }
      ai.steer = Math.atan(T.turn[p.i] * 3.6);
    }
  }

  function sync(dt) {
    for (const ai of cars) {
      const p = trackPose(T, ai.s, ai.d);
      const g = ai.model.group;
      g.position.set(p.x, p.y, p.z);
      g.rotation.set(-p.pitch, p.h + Math.atan2(ai.dv, Math.max(ai.v, 1)) + ai.yawOff, 0);
      ai.spin += ai.v * dt / 0.36;
      ai.model.wheels.forEach(w => { w.rotation.x = ai.spin; });
      ai.model.frontPivots.forEach(pv => { pv.rotation.y = ai.steer; });
      ai.model.brakeMat.color.setHex(0x440000);
      ai.x = p.x; ai.z = p.z; ai.h = g.rotation.y;
    }
  }

  function dispose() {
    for (const ai of cars) {
      scene.remove(ai.model.group);
      ai.model.group.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
        if (o.userData.textures) o.userData.textures.forEach(t => t.dispose());
      });
    }
  }

  return { cars, playerSlot, update, sync, dispose };
}

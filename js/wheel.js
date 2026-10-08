// Steering wheel / controller input through the Gamepad API.
// Supports Logitech wheels (G29, G920, G923, G27, Driving Force ...) with pedals, paddles and the
// Driving Force H-shifter, plus ordinary controllers (Xbox / PlayStation, "standard" mapping).
// Wheel axis and button numbers differ between models and drivers, so WheelSetup records which
// axis / button does what. The result is saved per device in the browser.
//
// Wheel.state (read every frame after Wheel.poll()):
//   connected, name, isWheel, steer (-1..1, + = left), throttle (0..1), brake (0..1), boost (held),
//   hasShifter (an H-shifter gear has been used and no paddle since), hGear (1-6, -1 = R, null = neutral)
// Wheel.takeActions(): edge-triggered presses since last call: 'shiftUp', 'shiftDown', 'camera', 'pause', 'reset'.
const Wheel = (() => {
  const WHEEL_RE = /wheel|racing|logitech|g29|g920|g923|g27|g25|driving force|046d/i;
  const STORE = 'racing-sim-wheel:';
  const BUTTON_KEYS = ['shiftUp', 'shiftDown', 'boost', 'camera', 'pause', 'reset'];
  const GEAR_KEYS = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'gR'];
  const GEAR_VAL = { g1: 1, g2: 2, g3: 3, g4: 4, g5: 5, g6: 6, gR: -1 };

  const state = { connected: false, name: '', isWheel: false, configured: false, steer: 0, throttle: 0, brake: 0, boost: false, hasShifter: false, hGear: null };
  let padId = null, cfg = null, prevButtons = [], actions = [], initialAxes = [], liveAxes = [];

  // Best-guess mapping for Logitech wheels in Chrome / Edge on Windows. Run the setup if it's off.
  function defaults(id) {
    const xboxStyle = /g920|xbox/i.test(id);
    return {
      steer: { axis: 0, center: 0, scale: -2.5 },   // ~ +/-180 degrees of a 900-degree wheel = full lock
      throttle: { axis: xboxStyle ? 1 : 2, rest: 1, full: -1 },
      brake: { axis: xboxStyle ? 2 : 5, rest: 1, full: -1 },
      shiftUp: 4, shiftDown: 5, boost: 0, camera: 3, pause: 9, reset: null,
      g1: 12, g2: 13, g3: 14, g4: 15, g5: 16, g6: 17, gR: 18,
    };
  }
  function load(id) {
    try { const s = localStorage.getItem(STORE + id); if (s) return { cfg: JSON.parse(s), saved: true }; } catch (e) { /* storage blocked */ }
    return { cfg: defaults(id), saved: false };
  }
  function save(id, c) {
    try { localStorage.setItem(STORE + id, JSON.stringify(c)); } catch (e) { /* storage blocked: keep for this session */ }
  }

  function pickPad() {
    const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
    return pads.find(p => WHEEL_RE.test(p.id)) || pads.find(p => p.mapping === 'standard') || pads[0] || null;
  }

  // Pedal axes often read 0 until first moved (a browser quirk), which would look half pressed.
  // Treat each axis as unknown until its value has changed from the first reading.
  const axis = (gp, i) => {
    const v = gp.axes[i];
    if (v === undefined) return null;
    if (!liveAxes[i] && Math.abs(v - initialAxes[i]) > 0.02) liveAxes[i] = true;
    return liveAxes[i] ? v : null;
  };
  const pedal = (gp, p) => {
    const v = p && axis(gp, p.axis);
    if (v === null || v === undefined) return 0;
    const f = Math.min(1, Math.max(0, (v - p.rest) / (p.full - p.rest)));
    return f < 0.03 ? 0 : (f - 0.03) / 0.97;
  };
  const btn = (gp, i) => i !== null && i !== undefined && gp.buttons[i] ? gp.buttons[i].pressed : false;

  function poll() {
    const gp = pickPad();
    if (!gp) {
      if (state.connected) Object.assign(state, { connected: false, name: '', steer: 0, throttle: 0, brake: 0, boost: false, hasShifter: false, hGear: null });
      padId = null;
      return state;
    }
    if (gp.id !== padId) {
      padId = gp.id;
      const l = load(gp.id);
      cfg = l.cfg;
      state.configured = l.saved;
      state.isWheel = WHEEL_RE.test(gp.id) || gp.mapping !== 'standard';
      state.name = gp.id.replace(/\s*\(.*\)\s*$/, '') || 'Controller';
      initialAxes = gp.axes.slice(); liveAxes = [];
      prevButtons = gp.buttons.map(b => b.pressed);
      state.hasShifter = false;
    }
    state.connected = true;
    const pressedNow = gp.buttons.map(b => b.pressed);
    const edge = i => i !== null && i !== undefined && pressedNow[i] && !prevButtons[i];

    if (state.isWheel) {
      const s = axis(gp, cfg.steer.axis);
      state.steer = s === null ? 0 : Math.max(-1, Math.min(1, (s - cfg.steer.center) * cfg.steer.scale));
      state.throttle = pedal(gp, cfg.throttle);
      state.brake = pedal(gp, cfg.brake);
      state.boost = btn(gp, cfg.boost);
      for (const k of ['shiftUp', 'shiftDown', 'camera', 'pause', 'reset']) if (edge(cfg[k])) actions.push(k);
      if (edge(cfg.shiftUp) || edge(cfg.shiftDown)) state.hasShifter = false;   // paddles take over from the H-shifter
      let g = null;
      for (const k of GEAR_KEYS) if (btn(gp, cfg[k])) g = GEAR_VAL[k];
      if (g !== null && GEAR_KEYS.some(k => edge(cfg[k]))) state.hasShifter = true;
      state.hGear = g;
    } else {
      // Standard controller: left stick steers, triggers are throttle / brake, bumpers shift.
      const x = gp.axes[0] || 0, dz = 0.08;
      const sx = Math.abs(x) < dz ? 0 : (x - Math.sign(x) * dz) / (1 - dz);
      state.steer = -Math.sign(sx) * Math.pow(Math.abs(sx), 1.5);
      state.throttle = gp.buttons[7] ? gp.buttons[7].value : 0;
      state.brake = gp.buttons[6] ? gp.buttons[6].value : 0;
      state.boost = btn(gp, 0);
      const map = { shiftUp: 5, shiftDown: 4, camera: 3, pause: 9, reset: 8 };
      for (const k in map) if (edge(map[k])) actions.push(k);
      state.hasShifter = false; state.hGear = null;
    }
    prevButtons = pressedNow;
    return state;
  }

  function takeActions() { const a = actions; actions = []; return a; }

  function setConfig(c) {
    if (!padId) return;
    cfg = c; save(padId, c); state.configured = true;
    const gp = pickPad();
    if (gp) { initialAxes = gp.axes.slice(); liveAxes = []; }
  }

  addEventListener('gamepadconnected', () => poll());
  addEventListener('gamepaddisconnected', () => poll());

  return { state, poll, takeActions, setConfig, pickPad, defaults, BUTTON_KEYS, GEAR_KEYS };
})();

// ---------- Setup wizard ----------
// Walks through each control, detecting which axis moved most or which button was newly pressed.
const WheelSetup = (() => {
  const STEPS = [
    { key: 'steer', type: 'axis', text: 'Turn the wheel LEFT to where you want full steering lock (about a quarter turn), then let it go back to the centre.' },
    { key: 'throttle', type: 'axis', text: 'Press the THROTTLE (right pedal) all the way down, then release it.' },
    { key: 'brake', type: 'axis', text: 'Press the BRAKE (middle pedal) all the way down, then release it.' },
    { key: 'shiftUp', type: 'button', text: 'Pull the RIGHT paddle (shift up).', optional: true },
    { key: 'shiftDown', type: 'button', text: 'Pull the LEFT paddle (shift down).', optional: true },
    { key: 'boost', type: 'button', text: 'Press the button you want for OVERTAKE mode (extra power).', optional: true },
    { key: 'camera', type: 'button', text: 'Press the button you want for CHANGE CAMERA.', optional: true },
    { key: 'pause', type: 'button', text: 'Press the button you want for PAUSE.', optional: true },
    { key: 'reset', type: 'button', text: 'Press the button you want for RESET CAR onto the track.', optional: true },
    { key: 'g1', type: 'button', text: 'H-SHIFTER: put it in 1st gear.  (No shifter? Press "Skip shifter".)', optional: true, shifter: true },
    { key: 'g2', type: 'button', text: 'H-SHIFTER: put it in 2nd gear.', optional: true, shifter: true },
    { key: 'g3', type: 'button', text: 'H-SHIFTER: put it in 3rd gear.', optional: true, shifter: true },
    { key: 'g4', type: 'button', text: 'H-SHIFTER: put it in 4th gear.', optional: true, shifter: true },
    { key: 'g5', type: 'button', text: 'H-SHIFTER: put it in 5th gear.', optional: true, shifter: true },
    { key: 'g6', type: 'button', text: 'H-SHIFTER: put it in 6th gear.', optional: true, shifter: true },
    { key: 'gR', type: 'button', text: 'H-SHIFTER: put it in REVERSE.', optional: true, shifter: true },
  ];
  let el = null, step = 0, cfg = null, det = null, raf = 0, onDone = null;
  const $ = id => document.getElementById(id);

  function open(done) {
    onDone = done;
    el = $('wheel-setup');
    el.classList.remove('hidden');
    step = 0; cfg = null; det = null;
    $('ws-skip').onclick = () => advance(null);
    $('ws-skip-shifter').onclick = () => { while (step < STEPS.length && STEPS[step].shifter) cfg[STEPS[step++].key] = null; finishOrNext(); };
    $('ws-cancel').onclick = () => close(false);
    raf = requestAnimationFrame(tick);
  }
  function close(saved) {
    cancelAnimationFrame(raf);
    el.classList.add('hidden');
    if (onDone) onDone(saved);
  }
  function startStep(gp) {
    det = { axes: gp.axes.slice(), buttons: gp.buttons.map(b => b.pressed), maxDev: [], ext: [], chosen: null, settleT: 0, last: null };
    const s = STEPS[step];
    $('ws-count').textContent = `Step ${step + 1} of ${STEPS.length}`;
    $('ws-text').textContent = s.text;
    $('ws-live').textContent = '';
    $('ws-skip').classList.toggle('hidden', !s.optional);
    $('ws-skip-shifter').classList.toggle('hidden', !s.shifter);
  }
  function advance(value) {
    cfg[STEPS[step].key] = value;
    step++;
    finishOrNext();
  }
  function finishOrNext() {
    det = null;
    if (step >= STEPS.length) { Wheel.setConfig(cfg); close(true); }
  }

  function tick(now) {
    raf = requestAnimationFrame(tick);
    const gp = Wheel.pickPad();
    if (!gp) {
      $('ws-count').textContent = 'No wheel detected';
      $('ws-text').textContent = 'Make sure the wheel is plugged in (and Logitech G HUB is running), then press any button on it. Browsers only show a wheel after one of its buttons is pressed.';
      $('ws-live').textContent = '';
      return;
    }
    if (!cfg) cfg = Wheel.defaults(gp.id);
    if (!det) { startStep(gp); return; }
    const s = STEPS[step];

    if (s.type === 'button') {
      const i = gp.buttons.findIndex((b, k) => b.pressed && !det.buttons[k]);
      if (i >= 0) { $('ws-live').textContent = `Button ${i}`; advance(i); }
      else det.buttons = det.buttons.map((p, k) => p && gp.buttons[k].pressed);   // released buttons count as new next time
      return;
    }

    // Axis: wait for one axis to move a long way, remember its extreme, then wait for it to come
    // back and settle. The settled value is the rest / centre position.
    if (det.chosen === null) {
      let best = -1, bestDev = 0.5;
      gp.axes.forEach((v, k) => {
        const d = Math.abs(v - det.axes[k]);
        if (d > bestDev) { bestDev = d; best = k; }
      });
      if (best >= 0) { det.chosen = best; det.ext = gp.axes[best]; }
      $('ws-live').textContent = 'Waiting for movement…';
      return;
    }
    const a = det.chosen, v = gp.axes[a];
    if (Math.abs(v - det.axes[a]) > Math.abs(det.ext - det.axes[a])) det.ext = v;
    const range = Math.abs(det.ext - det.axes[a]);
    $('ws-live').textContent = `Axis ${a}: ${v.toFixed(2)}`;
    const back = Math.abs(v - det.ext) > range * 0.6;
    const still = det.last !== null && Math.abs(v - det.last) < 0.01;
    det.last = v;
    if (back && still) det.settleT += 1 / 60; else det.settleT = 0;
    if (det.settleT < 0.35) return;
    const rest = v;
    if (s.key === 'steer') advance({ axis: a, center: rest, scale: 1 / (det.ext - rest) });
    else advance({ axis: a, rest, full: det.ext });
  }

  return { open };
})();

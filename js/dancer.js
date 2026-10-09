// Little pixel-art driver with a giant helmeted head who dances in the top-left corner (top-right on phones) of the
// track-selection screen, busting out cheesy dance moves on the beat of the menu song
// (116 BPM): the lawnmower, the sprinkler, walk like an Egyptian, a booty shake and the YMCA.
// Drawn on a tiny canvas scaled up with crisp pixels.
const Dancer = (() => {
  const W = 40, H = 58, CX = 20, BPM = 116;
  const css = c => '#' + c.toString(16).padStart(6, '0');
  let el = null, g = null, look = { base: '#ff8000', a: '#1c1d21', b: '#47c7fc', suit: '#ff8000' };

  // Arm = [elbow dx, dy, hand dx, dy] from its shoulder, in screen pixels (+x right, +y down).
  const mir = a => [-a[0], a[1], -a[2], a[3]];
  const lerp = (a, b, s) => a.map((v, i) => v + (b[i] - v) * s);
  const ease = s => s * s * (3 - 2 * s);

  // Each move: (beat within the move 0-7, fraction of the beat) -> pose.
  const MOVES = [
    function lawnmower(mb, f) {   // one hand on the mower, the other yanks the cord on every beat
      const s = f < 0.35 ? ease(f / 0.35) : 1;
      const R = lerp([-1, 6, -5, 13], [6, -4, 11, -10], s);
      return { L: [-4, 7, -2, 14], R, squat: 2 };
    },
    function sprinkler(mb, f) {   // hand behind the head, other arm ticks round then whooshes back
      const ticks = (mb % 4) * 2 + (f < 0.5 ? 0 : 1);    // 8 half-beat ticks per sweep
      const s = ticks < 6 ? ticks / 5 : 1 - (ticks - 5) / 2;
      return { L: [-9, -9, -1, -13], behindL: true, R: lerp([6, 0, 12, -1], [3, 2, 4, 3], s), lift: [0, mb & 1 ? 1 : 0] };
    },
    function egyptian(mb, f) {   // angular arms that swap every two beats, head sliding side to side
      const up = [-7, -1, -7, -8], down = [-7, 1, -7, 8];
      const flip = (mb >> 1) & 1;
      return {
        L: flip ? up : down, R: mir(flip ? down : up), flatHands: true,
        headX: Math.round(Math.sin((mb + f) * Math.PI) * 2), lift: [mb & 1 ? 2 : 0, mb & 1 ? 0 : 2],
      };
    },
    function bootyShake(mb, f) {   // turned round, deep squat, hands on knees, booty going double time
      const q = Math.floor((mb + f) * 4) & 1, bounce = Math.floor((mb + f) * 8) & 1;
      return { back: true, peek: true, L: [-6, 7, -4, 15], R: [6, 7, 4, 15], squat: 4, hipX: q ? 2 : -2, bootyY: bounce, noBob: true };
    },
    function ymca(mb) {   // two beats per letter
      const letter = mb >> 1;
      if (letter === 0) return { L: [-6, -6, -11, -13], R: [6, -6, 11, -13] };                       // Y
      if (letter === 1) return { L: [-10, -9, 2, -19], R: [10, -9, -2, -19] };                      // M
      if (letter === 2) return { L: [-9, -8, -4, -15], R: [-6, 5, -14, 8] };                        // C
      return { L: [-7, -12, 4, -25], R: [7, -12, -4, -25] };                                        // A
    },
  ];

  function px(x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); }
  function line(x0, y0, x1, y1, c) {   // chunky 2-pixel line
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) px(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, 2, 2, c);
  }
  function arm(sx, sy, a, flat) {
    line(sx, sy, sx + a[0], sy + a[1], look.suit);
    line(sx + a[0], sy + a[1], sx + a[2], sy + a[3], look.suit);
    if (flat) px(sx + a[2] - 1, sy + a[3], 4, 2, look.b);   // flat "Egyptian" hand
    else px(sx + a[2] - 0.5, sy + a[3] - 0.5, 3, 3, look.b);   // glove
  }

  // Big round two-cheek booty (seen from behind) with shading, a crease and wiggle lines.
  function booty(cx, y, swing) {
    const cheek = (x, c, grow) => {   // rounded blob, `grow` = outline thickness
      px(x - 2 - grow, y - grow, 5 + grow * 2, 1, c);
      px(x - 3 - grow, y + 1 - grow, 7 + grow * 2, 6 + grow * 2, c);
      px(x - 2 - grow, y + 7 + grow, 5 + grow * 2, 1, c);
    };
    const xs = [cx - 4, cx + 3];
    for (const x of xs) cheek(x, '#0b0c0e', 1);              // dark outline so it pops off the suit
    for (const x of xs) {
      cheek(x, look.suit, 0);
      px(x - 3, y + 6, 7, 1, 'rgba(0,0,0,0.3)');            // shadow underneath
      px(x - 1, y + 1, 2, 2, 'rgba(255,255,255,0.5)');      // shine
    }
    px(cx - 1, y + 1, 1, 7, '#0b0c0e');                     // crease
    // Motion lines on the side it's swinging towards.
    const side = swing > 0 ? 1 : -1, lx = cx + side * 10;
    g.globalAlpha = 0.8;
    px(lx, y + 1, 1, 2, '#ffffff'); px(lx + side, y + 3, 1, 2, '#ffffff'); px(lx, y + 5, 1, 2, '#ffffff');
    g.globalAlpha = 1;
  }

  function head(x, y, back, peek) {
    px(x + 3, y, 16, 1, look.base);
    px(x + 1, y + 1, 20, 2, look.base);
    px(x, y + 3, 22, 13, look.base);
    px(x + 1, y + 16, 20, 2, look.base);
    px(x + 3, y + 18, 16, 1, look.base);
    px(x, y + 4, 22, 2, look.a);                                  // stripe round the helmet
    px(x + 4, y + 1, 2, 2, look.b); px(x + 16, y + 1, 2, 2, look.b);
    if (back) {                                                   // back of the helmet: centre stripe + spoiler
      px(x + 10, y, 2, 18, look.a);
      px(x + 5, y - 1, 12, 1, look.a);
      if (peek) { px(x, y + 8, 4, 5, '#14161b'); px(x + 1, y + 9, 1, 1, '#9fb4cc'); }   // peeking over his shoulder
    } else {                                                      // visor with a sliding glint
      px(x + 3, y + 8, 16, 5, '#14161b');
      px(x + 2, y + 9, 1, 3, '#14161b'); px(x + 19, y + 9, 1, 3, '#14161b');
      const glint = Math.floor((performance.now() / 1000 * 6) % 24) - 4;
      if (glint >= 0 && glint < 14) px(x + 4 + glint, y + 9, 2, 1, '#9fb4cc');
      px(x + 4, y + 12, 14, 1, look.b);
      px(x + 9, y + 15, 4, 1, '#14161b');
    }
    px(x + 21, y + 7, 1, 7, 'rgba(0,0,0,0.25)');
    px(x + 2, y + 3, 2, 4, 'rgba(255,255,255,0.35)');
  }

  // Poses for the click routine.
  const TRICK_POSE = {
    cartwheel: { L: [-6, -6, -12, -12], R: [6, -6, 12, -12], spread: 4, noBob: true },       // star
    bow: { L: [3, 7, 9, 9], R: [7, 5, 13, 10], headY: 6, armsBehind: true, noBob: true },     // head down, hand on belly, arm swept out
    jump: { L: [-6, -6, -11, -13], R: [6, -6, 11, -13], lift: [8, 8], spread: 3, noBob: true }, // legs kicked up, arms up
  };

  function drawSprite(t, trick) {
    const beat = t * BPM / 60, b = Math.floor(beat), f = beat - b;
    const mb = b % 8;
    const P = trick ? TRICK_POSE[trick] : MOVES[Math.floor(b / 8) % MOVES.length](mb, f);
    const squat = P.squat || 0, lift = P.lift || [0, 0], hipX = P.hipX || 0, headX = P.headX || 0, spread = P.spread || 0;
    const bob = (P.noBob ? 0 : f < 0.45 ? 1 : 0) + squat;
    g.clearRect(0, 0, W, H);

    // Shadow and legs (hip -> knee -> boot; knees push out when squatting).
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(CX - 8, 55, 16, 2);
    const hipY = 39 + bob;
    for (const [lx, side, up] of [[CX - 3, -1, lift[0]], [CX + 1, 1, lift[1]]]) {
      const footY = 52 - up, kx = lx + side * squat, ky = Math.min(hipY + 5, footY - 3);
      line(lx + hipX, hipY, kx, ky, look.suit);
      const fx = lx + side * (1 + spread);
      line(kx, ky, fx, footY, look.suit);
      px(fx - 1, footY + 1, 4, 2, '#111111');
    }

    // Torso: race suit, team stripe, belt; a little booty when turned round.
    const top = 28 + bob;
    px(CX - 5 + hipX, top, 10, hipY - top + 1, look.suit);
    px(CX - 1 + hipX, top, 2, hipY - top - 2, look.a);
    px(CX - 5 + hipX, hipY - 3, 10, 1, '#1a1a1a');
    if (P.back) booty(CX + hipX, hipY - 5 + (P.bootyY || 0), hipX);

    const sy = top + 1, sl = CX - 5, sr = CX + 4;
    if (P.behindL || P.armsBehind) arm(sl, sy, P.L, P.flatHands);
    if (P.armsBehind) arm(sr, sy, P.R, P.flatHands);
    head(CX - 11 + headX, 9 + bob + (P.headY || 0), P.back, P.peek);
    if (!P.behindL && !P.armsBehind) arm(sl, sy, P.L, P.flatHands);
    if (!P.armsBehind) arm(sr, sy, P.R, P.flatHands);

    // Music notes floating up beside him.
    for (let k = 0; k < 2; k++) {
      const p = (t * 0.6 + k * 0.5) % 1, nx = k ? 35 : 3, ny = 30 - p * 26;
      if (p > 0.85) continue;
      g.globalAlpha = 1 - p;
      px(nx + 1, ny, 1, 4, '#ffffff'); px(nx - 1, ny + 3, 2, 2, '#ffffff'); px(nx + 1, ny, 2, 1, '#ffffff');
      g.globalAlpha = 1;
    }
  }

  // Clicks: each one squishes him smaller then springs back; 10 in a row and he does a routine:
  // cartwheel out, take a bow, cartwheel back, then a little jump with his legs kicked up.
  const TRICK = [   // [phase, seconds]
    ['cartwheel', 0.9], ['bow', 1.0], ['cartwheel', 0.9], ['jump', 0.8],
  ];
  const TRICK_SECS = TRICK.reduce((s, p) => s + p[1], 0);
  let clicks = 0, lastClick = 0, trickStart = -1e9, busy = null;
  function trickPhase(now) {
    let e = (now - trickStart) / 1000;
    if (e < 0 || e >= TRICK_SECS) return null;
    for (const [name, d] of TRICK) {
      if (e < d) return name;
      e -= d;
    }
    return null;
  }
  function onClick() {
    const now = performance.now();
    if (trickPhase(now)) return;
    clicks = now - lastClick < 1200 ? clicks + 1 : 1;
    lastClick = now;
    if (busy) busy.cancel();
    if (clicks >= 10) {
      clicks = 0;
      trickStart = now;
      const at = s => s / TRICK_SECS;   // seconds -> keyframe offset
      const roll = 'cubic-bezier(.45,.05,.55,.95)';
      busy = el.animate([
        { transform: 'translate(0, 0) rotate(0deg)', offset: 0, easing: roll },
        { transform: 'translate(260px, 0) rotate(360deg)', offset: at(0.9) },              // cartwheel out
        { transform: 'translate(260px, 0) rotate(360deg)', offset: at(1.9), easing: roll }, // bow
        { transform: 'translate(0, 0) rotate(0deg)', offset: at(2.8), easing: 'ease-out' }, // cartwheel back
        { transform: 'translate(0, -40px) rotate(0deg)', offset: at(3.2), easing: 'ease-in' },
        { transform: 'translate(0, 0) rotate(0deg)', offset: 1 },                          // jump
      ], { duration: TRICK_SECS * 1000 });
    } else {
      busy = el.animate([
        { transform: 'scale(1)' }, { transform: 'scale(0.6)', offset: 0.35 },
        { transform: 'scale(1.15)', offset: 0.75 }, { transform: 'scale(1)' },
      ], { duration: 420, easing: 'ease-out' });
    }
  }

  function draw(t) {
    if (!el) {
      el = document.getElementById('dancer');
      if (!el) return;
      g = el.getContext('2d');
      el.addEventListener('click', onClick);
    }
    drawSprite(t, trickPhase(performance.now()));
  }

  return {
    setLook(helmet, suit) {
      look = { base: css(helmet.base), a: css(helmet.a), b: css(helmet.b), suit: css(suit) };
    },
    draw,
  };
})();

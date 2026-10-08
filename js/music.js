// Game music, synthesised live with Web Audio. Original songs, three per style
// (track list / driver lobby / in race):
//   Original:  'paddock'   - laid-back synthwave groove (plucked arpeggio, pumping pads, bell melody)
//              'anthem'    - in the style of an F1 broadcast intro (string pulse, big drums, brass melody)
//              'grandprix' - driving electronic groove with a brass theme
//   Jazz:      'jazz'      - fast café swing: walking bass, ride and brushes, piano and vibraphone
//              'cafe'      - medium-up swing in Bb, just piano and bass
//              'jazzrace'  - up-tempo minor blues, piano trio + vibes
//   Classical: 'classical' - fingerstyle nylon-string guitar waltz in A minor
//              'etude'     - fingerstyle study in D with triplet arpeggios
//              'flamenco'  - Spanish guitar: strums, rasgueado, picado runs, cajón and claps
// The guitar is a physically modelled plucked string (Karplus-Strong).
// Usage: LobbyMusic.setPlaying(songId or null, audioContext, destination). Changing song crossfades.
const LobbyMusic = (() => {
  const BPM = 100, BEAT = 60 / BPM, BAR = BEAT * 4;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  // Eight-bar phrase in D minor: bass root and a mid-register triad per bar.
  const PROG = [
    { root: 38, ch: [62, 65, 69] },   // Dm
    { root: 34, ch: [62, 65, 70] },   // Bb
    { root: 41, ch: [60, 65, 69] },   // F
    { root: 36, ch: [60, 64, 67] },   // C
    { root: 38, ch: [62, 65, 69] },   // Dm
    { root: 34, ch: [62, 65, 70] },   // Bb
    { root: 43, ch: [62, 67, 70] },   // Gm
    { root: 45, ch: [61, 64, 69] },   // A
  ];
  // Brass melody: [midi or null for a rest, length in beats] per bar.
  const MEL = [
    [[74, 1.5], [69, 0.5], [74, 1], [77, 1]],
    [[79, 2], [77, 1], [74, 1]],
    [[72, 1.5], [69, 0.5], [72, 1], [77, 1]],
    [[76, 3], [null, 1]],
    [[74, 1.5], [69, 0.5], [74, 1], [77, 1]],
    [[81, 2], [79, 1], [77, 1]],
    [[79, 1.5], [77, 0.5], [74, 1], [70, 1]],
    [[69, 2], [73, 1], [76, 1]],
  ];
  // 16th-note string pulse: indexes into the triad (3 = root an octave up).
  const PULSE = [0, 1, 2, 3, 2, 1, 0, 1, 0, 1, 2, 3, 2, 3, 1, 2];
  const BASS_OCT = [0, 0, 12, 0, 0, 0, 12, 0];

  // 'paddock' (A minor, 116 BPM): Am - F - C - G, with a bell melody over 8 bars.
  const P_BEAT = 60 / 116, P_BAR = P_BEAT * 4;
  const P_PROG = [
    { root: 45, ch: [64, 69, 72] },   // Am
    { root: 41, ch: [65, 69, 72] },   // F
    { root: 48, ch: [64, 67, 72] },   // C
    { root: 43, ch: [62, 67, 71] },   // G
  ];
  const P_MEL = [
    [[76, 1], [79, 0.5], [76, 0.5], [74, 1], [72, 1]],
    [[72, 1.5], [74, 0.5], [76, 2]],
    [[79, 1], [76, 1], [74, 0.5], [72, 0.5], [74, 1]],
    [[71, 3], [null, 1]],
    [[81, 1], [79, 0.5], [76, 0.5], [79, 1], [76, 1]],
    [[77, 1.5], [76, 0.5], [72, 2]],
    [[76, 1], [79, 1], [84, 1], [83, 0.5], [79, 0.5]],
    [[81, 3], [null, 1]],
  ];
  const P_ARP = [0, 1, 2, 3, 1, 2, 3, 2, 0, 1, 2, 3, 2, 1, 3, 2];

  // 'jazz' (F major, 176 BPM swing, café piano-trio feel): ii-V-I changes with rootless voicings.
  const J_BEAT = 60 / 176, J_BAR = J_BEAT * 4;
  const J_PROG = [
    { root: 43, third: 3, ch: [58, 62, 65, 69] },   // Gm9
    { root: 36, third: 4, ch: [58, 62, 64, 69] },   // C13
    { root: 41, third: 4, ch: [57, 60, 64, 67] },   // Fmaj9
    { root: 38, third: 4, ch: [60, 63, 66, 69] },   // D7b9
    { root: 43, third: 3, ch: [58, 62, 65, 69] },   // Gm9
    { root: 36, third: 4, ch: [58, 62, 64, 69] },   // C13
    { root: 45, third: 3, ch: [60, 64, 67, 71] },   // Am9
    { root: 38, third: 4, ch: [60, 63, 66, 69] },   // D7b9
  ];
  const J_MEL = [
    [[null, 0.5], [70, 0.5], [69, 0.5], [67, 0.5], [65, 1], [62, 1]],
    [[64, 1.5], [67, 0.5], [70, 1], [69, 1]],
    [[69, 3], [null, 1]],
    [[null, 0.5], [66, 0.5], [69, 0.5], [72, 0.5], [75, 1], [74, 1]],
    [[74, 1], [72, 0.5], [70, 0.5], [69, 1], [67, 1]],
    [[70, 1.5], [69, 0.5], [67, 1], [64, 1]],
    [[67, 0.5], [69, 0.5], [72, 0.5], [76, 1.5], [74, 1]],
    [[72, 2], [null, 2]],
  ];

  // 'classical' (A minor, 3/4 at 96 BPM): solo fingerstyle nylon-string guitar. Thumb plays the
  // bass, fingers arpeggiate the inner voices (p-i-m-a-m-i), melody on top.
  const C_BEAT = 60 / 96, C_BAR = C_BEAT * 3;
  const C_PROG = [
    { bass: 45, ch: [57, 60, 64] },   // Am
    { bass: 50, ch: [57, 62, 65] },   // Dm
    { bass: 43, ch: [55, 59, 62] },   // G
    { bass: 48, ch: [55, 60, 64] },   // C
    { bass: 41, ch: [57, 60, 65] },   // F
    { bass: 50, ch: [57, 62, 65] },   // Dm
    { bass: 40, ch: [56, 62, 64] },   // E7
    { bass: 45, ch: [57, 60, 64] },   // Am
  ];
  const C_MEL = [
    [[72, 1], [76, 1], [81, 1]],
    [[77, 2], [74, 1]],
    [[74, 1.5], [71, 0.5], [74, 1]],
    [[72, 3]],
    [[72, 1], [77, 1], [81, 1]],
    [[79, 1], [77, 1], [74, 1]],
    [[76, 1.5], [74, 0.5], [68, 1]],
    [[69, 3]],
  ];

  // 'grandprix' (Original, in-race; E minor, 132 BPM): driving electronic groove, brass theme.
  const G_BEAT = 60 / 132, G_BAR = G_BEAT * 4;
  const G_PROG = [
    { root: 40, ch: [64, 67, 71] },   // Em
    { root: 36, ch: [64, 67, 72] },   // C
    { root: 43, ch: [62, 67, 71] },   // G
    { root: 38, ch: [62, 66, 69] },   // D
  ];
  const G_MEL = [
    [[71, 1.5], [74, 0.5], [76, 2]],
    [[76, 1], [74, 1], [72, 1], [71, 1]],
    [[74, 1.5], [71, 0.5], [67, 2]],
    [[69, 3], [null, 1]],
    [[79, 1.5], [78, 0.5], [76, 2]],
    [[76, 1], [79, 1], [84, 1], [83, 1]],
    [[83, 1.5], [79, 0.5], [74, 2]],
    [[78, 3], [null, 1]],
  ];

  // 'cafe' (Jazz, driver lobby; Bb major, 168 BPM swing): just piano and bass, 16-bar AB tune.
  const CF_BEAT = 60 / 168, CF_BAR = CF_BEAT * 4;
  const Bb = { root: 46, third: 4, ch: [57, 60, 62, 65] }, G13 = { root: 43, third: 4, ch: [53, 57, 59, 64] };
  const Cm9 = { root: 36, third: 3, ch: [58, 62, 63, 67] }, F13 = { root: 41, third: 4, ch: [57, 62, 63, 67] };
  const CF_PROG = [
    Bb, G13, Cm9, F13, { root: 38, third: 3, ch: [53, 57, 60, 64] }, G13, Cm9, F13,           // A: Dm9 in bar 5
    { root: 39, third: 4, ch: [55, 58, 62, 65] }, { root: 40, third: 3, ch: [55, 58, 61, 64] },   // B: Ebmaj9, Edim7
    { root: 38, third: 3, ch: [57, 60, 62, 65] }, G13, Cm9, F13, Bb, F13,                       //    Bb/D ...
  ];
  const CF_MEL = [
    [[74, 1.5], [72, 0.5], [70, 1], [65, 1]],
    [[71, 2], [null, 0.5], [71, 0.5], [74, 0.5], [77, 0.5]],
    [[75, 1.5], [74, 0.5], [72, 2]],
    [[null, 1], [69, 0.5], [70, 0.5], [72, 1], [74, 1]],
    [[77, 1.5], [76, 0.5], [74, 1], [69, 1]],
    [[71, 1], [74, 1], [77, 1], [76, 1]],
    [[75, 1], [72, 0.5], [70, 0.5], [67, 2]],
    [[69, 3], [null, 1]],
    [[70, 1.5], [74, 0.5], [77, 2]],
    [[76, 1.5], [73, 0.5], [70, 2]],
    [[74, 1], [72, 0.5], [70, 0.5], [69, 1], [70, 1]],
    [[71, 2], [74, 1], [77, 1]],
    [[79, 1.5], [77, 0.5], [75, 1], [74, 1]],
    [[72, 1], [69, 0.5], [72, 0.5], [75, 1], [74, 1]],
    [[70, 3], [null, 1]],
    [[null, 2], [65, 0.5], [67, 0.5], [69, 0.5], [72, 0.5]],   // pickup back to the top
  ];

  // 'jazzrace' (Jazz, in-race; C minor blues, 200 BPM swing): 12-bar form, riff head.
  const JR_BEAT = 60 / 200, JR_BAR = JR_BEAT * 4;
  const Cm = { root: 36, third: 3, ch: [58, 62, 63, 67] }, Fm = { root: 41, third: 3, ch: [56, 60, 63, 67] };
  const JR_PROG = [Cm, Cm, Cm, Cm, Fm, Fm, Cm, Cm,
    { root: 44, third: 4, ch: [54, 60, 65] },        // Ab13
    { root: 43, third: 4, ch: [53, 59, 63, 68] },    // G7alt
    Cm,
    { root: 43, third: 4, ch: [53, 59, 63, 68] }];
  const JR_RIFF = [[67, 0.5], [70, 0.5], [72, 0.5], [75, 1], [72, 0.5], [70, 1]];
  const JR_MEL = [
    JR_RIFF, [[67, 2], [null, 2]],
    [[67, 0.5], [70, 0.5], [72, 0.5], [75, 1], [77, 0.5], [78, 0.5], [79, 0.5]], [[79, 1], [75, 1], [72, 2]],
    [[72, 0.5], [75, 0.5], [77, 0.5], [80, 1], [77, 0.5], [75, 1]], [[72, 2], [null, 2]],
    JR_RIFF, [[67, 2], [null, 2]],
    [[78, 1], [77, 0.5], [75, 0.5], [72, 2]], [[71, 1], [74, 0.5], [77, 0.5], [80, 1], [79, 1]],
    [[72, 3], [null, 1]], [[null, 2], [67, 0.5], [71, 0.5], [74, 0.5], [77, 0.5]],
  ];
  const JR_COMP = [[[0, 0.5], [1.5, 0.4]], [[1, 0.4], [2.5, 0.6]], [[0.5, 0.4], [2, 0.5], [3.5, 0.6]], [[1.5, 0.4], [3, 0.4]]];
  const JR_SNARE = [[2.5], [1.5, 3.5], [0.5, 2.5], [3.5]];

  // 'etude' (Classical, driver lobby; D major, 4/4 at 72 BPM, drop-D tuning): fingerstyle study
  // with triplet arpeggios, alternating bass, melody on top.
  const E_BEAT = 60 / 72, E_BAR = E_BEAT * 4;
  const E_PROG = [
    { bass: 38, ch: [57, 62, 66] },   // D
    { bass: 43, ch: [59, 62, 67] },   // G
    { bass: 45, ch: [57, 61, 67] },   // A7
    { bass: 38, ch: [57, 62, 66] },   // D
    { bass: 47, ch: [59, 62, 66] },   // Bm
    { bass: 40, ch: [59, 64, 67] },   // Em
    { bass: 45, ch: [57, 61, 67] },   // A7
    { bass: 38, ch: [57, 62, 66] },   // D
  ];
  const E_MEL = [
    [[74, 2], [76, 1], [78, 1]],
    [[79, 3], [78, 1]],
    [[76, 2], [73, 1], [76, 1]],
    [[74, 4]],
    [[78, 2], [79, 1], [81, 1]],
    [[83, 2], [79, 2]],
    [[78, 1], [76, 1], [73, 1], [76, 1]],
    [[74, 4]],
  ];

  // 'flamenco' (Classical, in-race; A Phrygian / Andalusian cadence Am-G-F-E, 3/4 at 168 BPM):
  // Spanish guitar strums and rasgueado rolls, fast picado scale runs, cajón and hand claps.
  const F_BEAT = 60 / 168, F_BAR = F_BEAT * 3;
  const F_CH = [
    [45, 52, 57, 60, 64],         // Am
    [43, 47, 50, 55, 59, 67],     // G
    [41, 48, 53, 57, 60, 65],     // F
    [40, 47, 52, 56, 59, 64],     // E
  ];
  const F_RUN = [   // sixteenth-note runs, one bar per chord
    [76, 77, 76, 74, 72, 74, 72, 71, 69, 71, 72, 74],
    [74, 76, 74, 72, 71, 72, 71, 69, 67, 69, 71, 72],
    [72, 74, 72, 71, 69, 71, 69, 67, 65, 67, 69, 71],
    [68, 69, 71, 72, 71, 69, 68, 65, 64, null, null, null],
  ];

  let ctx = null, dest = null, noiseBuf = null, irBuf = null;
  let session = null;   // { id, song, out, bus, timer, bar, next }

  function buffers() {
    if (noiseBuf) return;
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    // Reverb impulse: stereo noise with an exponential tail (concert hall feel).
    const len = ctx.sampleRate * 2.4;
    irBuf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = irBuf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
  }
  function filt(type, freq, q, gain, out) {
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q; f.gain.value = gain;
    f.connect(out);
    return f;
  }

  // Plucked string (Karplus-Strong), rendered once per note and cached. soft = fingertip pluck
  // (rounder attack, shorter ring), otherwise a bright pick. Played back at `rate` to fix the tuning.
  const strings = {};
  function stringBuf(m, soft) {
    const key = m + (soft ? 's' : 'p');
    if (strings[key]) return strings[key];
    const sr = ctx.sampleRate, f = mtof(m), N = Math.max(2, Math.round(sr / f - 0.5));
    const len = Math.floor(sr * 3), buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
    for (let i = 0; i < N; i++) d[i] = Math.random() * 2 - 1;
    for (let pass = 0; pass < (soft ? 4 : 1); pass++) for (let i = 1; i < N; i++) d[i] = (d[i] + d[i - 1]) / 2;
    let mean = 0, peak = 0;
    for (let i = 0; i < N; i++) mean += d[i] / N;
    for (let i = 0; i < N; i++) { d[i] -= mean; peak = Math.max(peak, Math.abs(d[i])); }
    for (let i = 0; i < N; i++) d[i] /= peak;
    const loss = Math.pow(soft ? 0.15 : 0.5, 1 / f);   // level left after one second of ringing
    for (let i = N; i < len; i++) d[i] = loss * 0.5 * (d[i - N] + (i > N ? d[i - N - 1] : 0));
    return (strings[key] = { buf, rate: f * (N + 0.5) / sr });
  }
  function pluck(t, m, soft, out, stop) {
    const s = stringBuf(m, soft), src = ctx.createBufferSource();
    src.buffer = s.buf; src.playbackRate.value = s.rate;
    src.connect(out); src.start(t); src.stop(stop);
    return src;
  }

  // ---------- Instruments (each schedules one note into the session bus) ----------
  // Gain envelope: attack to `peak`, hold, then exponential release.
  function envGain(t, peak, attack, hold, release, out) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.setValueAtTime(peak, t + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
    g.connect(out);
    return g;
  }
  function osc(type, freq, t, stop, out, detune = 0) {
    const o = ctx.createOscillator();
    o.type = type; o.frequency.value = freq; o.detune.value = detune;
    o.connect(out); o.start(t); o.stop(stop);
    return o;
  }
  function lowpass(freq, q, out) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = freq; f.Q.value = q;
    f.connect(out);
    return f;
  }
  function noise(t, dur, type, freq, q, out) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter();
    s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
    s.connect(f); f.connect(out);
    s.start(t, Math.random(), dur);
  }

  const I = {
    pulse(S, t, m, vel, cut) {
      const g = envGain(t, 0.05 * vel, 0.004, 0.02, 0.1, S.bus);
      const f = lowpass(cut, 4, g);
      osc('sawtooth', mtof(m), t, t + 0.2, f);
      osc('sawtooth', mtof(m), t, t + 0.2, f, 9);
    },
    bass(S, t, m, dur) {
      const g = envGain(t, 0.14, 0.006, dur * 0.5, dur * 0.4, S.dry);
      const f = lowpass(320, 6, g);
      f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(260, t + 0.12);
      osc('sawtooth', mtof(m), t, t + dur + 0.1, f);
      osc('square', mtof(m - 12), t, t + dur + 0.1, f);
    },
    pad(S, t, notes, dur, vel) {
      const g = envGain(t, 0.035 * vel, 0.35, dur - 0.45, 0.6, S.wet);
      const f = lowpass(1500, 0.5, g);
      for (const m of notes) for (const dt of [-8, 8]) osc('sawtooth', mtof(m), t, t + dur + 0.7, f, dt);
      osc('sawtooth', mtof(notes[0] - 12), t, t + dur + 0.7, f);
    },
    brass(S, t, m, dur, vel) {
      const g = envGain(t, 0.09 * vel, 0.05, Math.max(0.01, dur - 0.12), 0.25, S.bus);
      const f = lowpass(700, 1.5, g);
      f.frequency.setValueAtTime(700, t);
      f.frequency.linearRampToValueAtTime(3200, t + 0.08);
      f.frequency.exponentialRampToValueAtTime(1700, t + 0.4);
      const vib = ctx.createOscillator(), vd = ctx.createGain();
      vib.frequency.value = 5.5; vd.gain.setValueAtTime(0, t); vd.gain.linearRampToValueAtTime(10, t + Math.min(0.5, dur));
      vib.connect(vd); vib.start(t); vib.stop(t + dur + 0.35);
      for (const dt of [-6, 0, 7]) vd.connect(osc('sawtooth', mtof(m), t, t + dur + 0.35, f, dt).detune);
    },
    kick(S, t, vel = 1) {
      const g = envGain(t, 0.5 * vel, 0.002, 0.02, 0.33, S.dry);
      const o = osc('sine', 140, t, t + 0.4, g);
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    },
    snare(S, t, vel = 1) {
      noise(t, 0.25, 'highpass', 1400, 0.7, envGain(t, 0.16 * vel, 0.002, 0.01, 0.18, S.bus));
      osc('triangle', 190, t, t + 0.12, envGain(t, 0.1 * vel, 0.002, 0.005, 0.08, S.bus));
    },
    hat(S, t, vel = 1) {
      noise(t, 0.06, 'highpass', 7500, 0.8, envGain(t, 0.035 * vel, 0.001, 0.003, 0.04, S.dry));
    },
    tom(S, t, freq, vel = 1) {   // timpani-like hit for fills
      const g = envGain(t, 0.32 * vel, 0.003, 0.03, 0.45, S.bus);
      const o = osc('sine', freq, t, t + 0.6, g);
      o.frequency.setValueAtTime(freq * 1.3, t); o.frequency.exponentialRampToValueAtTime(freq, t + 0.08);
      noise(t, 0.08, 'bandpass', freq * 3, 1, envGain(t, 0.06 * vel, 0.001, 0.005, 0.06, S.bus));
    },
    cymbal(S, t) {
      noise(t, 1.9, 'highpass', 4500, 0.5, envGain(t, 0.06, 0.003, 0.05, 1.7, S.bus));
    },
    pluck(S, t, m, vel) {   // short synth pluck: filter snaps shut
      const g = envGain(t, 0.06 * vel, 0.003, 0.01, 0.22, S.bus);
      const f = lowpass(3500, 3, g);
      f.frequency.setValueAtTime(3500, t); f.frequency.exponentialRampToValueAtTime(350, t + 0.16);
      osc('square', mtof(m), t, t + 0.3, f);
      osc('sawtooth', mtof(m), t, t + 0.3, f, 12);
    },
    padPump(S, t, notes, beats, beat, vel) {   // warm pad that ducks on every beat (sidechain feel)
      const dur = beats * beat;
      const pump = ctx.createGain(); pump.connect(S.wet);
      for (let k = 0; k < beats; k++) {
        pump.gain.setValueAtTime(0.2, t + k * beat);
        pump.gain.linearRampToValueAtTime(1, t + (k + 0.6) * beat);
      }
      const g = envGain(t, 0.03 * vel, 0.05, dur - 0.1, 0.3, pump);
      const f = lowpass(1800, 0.7, g);
      for (const m of notes) for (const dt of [-12, 12]) osc('sawtooth', mtof(m), t, t + dur + 0.4, f, dt);
    },
    bell(S, t, m, dur, vel) {   // glassy bell: fundamental plus an inharmonic partial
      const g = envGain(t, 0.07 * vel, 0.004, 0.02, Math.max(0.6, dur * 1.4), S.wet);
      osc('sine', mtof(m), t, t + dur * 1.5 + 0.7, g);
      osc('sine', mtof(m) * 3.5, t, t + 0.4, envGain(t, 0.02 * vel, 0.002, 0.01, 0.3, S.wet));
      osc('triangle', mtof(m + 12), t, t + dur + 0.4, envGain(t, 0.015 * vel, 0.004, 0.02, dur, S.wet));
    },
    clap(S, t, vel = 1) {
      for (const d of [0, 0.011, 0.023]) noise(t + d, 0.15, 'bandpass', 1500, 1.2, envGain(t + d, 0.11 * vel, 0.001, 0.005, d ? 0.03 : 0.16, S.bus));
    },

    // --- jazz ---
    upright(S, t, m, dur) {   // plucked double bass
      const g = envGain(t, 0.22, 0.006, 0.04, dur * 0.9, S.dry);
      const f = lowpass(700, 1, g);
      osc('triangle', mtof(m), t, t + dur + 0.1, f);
      osc('sine', mtof(m), t, t + dur + 0.1, f);
      noise(t, 0.03, 'bandpass', 1200, 1, envGain(t, 0.03, 0.001, 0.003, 0.02, S.dry));
    },
    piano(S, t, notes, dur, vel) {   // acoustic piano: slightly stretched partials, the higher ones die first
      const stop = t + dur + 0.3;
      const damper = ctx.createGain(); damper.connect(S.bus);
      damper.gain.setValueAtTime(1, t + dur); damper.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.25);
      for (const m of notes) {
        [1, 0.45, 0.22, 0.1, 0.05].forEach((a, i) => {
          const n = i + 1, f = mtof(m) * n * Math.sqrt(1 + 0.0003 * n * n);
          osc('sine', f, t, stop, envGain(t, 0.045 * vel * a, 0.002, 0.005, 2.5 / n, damper));
        });
      }
      noise(t, 0.03, 'bandpass', 2500, 1, envGain(t, 0.01 * vel, 0.001, 0.002, 0.02, S.bus));   // hammer
    },
    vibes(S, t, m, dur, vel) {   // vibraphone: sine bar + 4th harmonic, motor tremolo
      const end = t + dur + 1.4;
      const trem = ctx.createGain(); trem.gain.value = 0.7; trem.connect(S.bus);
      const lfo = ctx.createOscillator(), ld = ctx.createGain();
      lfo.frequency.value = 5; ld.gain.value = 0.3; lfo.connect(ld); ld.connect(trem.gain); lfo.start(t); lfo.stop(end);
      osc('sine', mtof(m), t, end, envGain(t, 0.09 * vel, 0.003, 0.02, Math.max(0.5, dur + 0.9), trem));
      osc('sine', mtof(m) * 4, t, t + 0.4, envGain(t, 0.025 * vel, 0.002, 0.01, 0.25, trem));
      osc('sine', mtof(m) * 10, t, t + 0.1, envGain(t, 0.008 * vel, 0.001, 0.003, 0.05, trem));   // mallet click
    },
    ride(S, t, vel = 1) {
      noise(t, 0.5, 'bandpass', 8500, 1.2, envGain(t, 0.05 * vel, 0.001, 0.01, 0.45, S.bus));
      osc('triangle', 3400, t, t + 0.3, envGain(t, 0.006 * vel, 0.001, 0.005, 0.25, S.bus));
    },
    brush(S, t, vel = 1) {
      noise(t, 0.2, 'bandpass', 2800, 0.7, envGain(t, 0.06 * vel, 0.012, 0.02, 0.12, S.bus));
    },

    // --- classical ---
    nylon(S, t, m, vel, ring, bright = false) {   // nylon-string guitar plucked with the fingers, through a wooden body
      if (!S.body) S.body = filt('peaking', 200, 1.2, 5, filt('peaking', 2600, 1, -3, lowpass(3800, 0.7, S.bus)));
      pluck(t, m, !bright, envGain(t, 0.12 * vel, 0.001, ring, 0.3, S.body), t + ring + 0.4);
    },
    cajon(S, t, slap, vel = 1) {   // wooden box drum: deep bass tone, or a sharp slap near the edge
      if (slap) {
        noise(t, 0.12, 'bandpass', 1800, 0.8, envGain(t, 0.14 * vel, 0.001, 0.005, 0.08, S.bus));
        osc('sine', 230, t, t + 0.1, envGain(t, 0.08 * vel, 0.001, 0.005, 0.06, S.bus));
      } else {
        const o = osc('sine', 85, t, t + 0.3, envGain(t, 0.4 * vel, 0.002, 0.02, 0.2, S.dry));
        o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(80, t + 0.05);
      }
    },
  };

  // ---------- Arrangement ----------
  // Bars 0-7: intro (pads + building pulse). Then 8-bar sections alternating A (brass theme)
  // and B (theme doubled an octave up, busier drums).
  function anthemBar(S, bar, t) {
    const sec = bar < 8 ? 'intro' : (Math.floor(bar / 8) % 2 ? 'A' : 'B');
    const pb = bar % 8, P = PROG[pb], lastBar = pb === 7, intro = sec === 'intro';
    const b = n => t + n * BEAT;   // time of beat n in this bar

    I.pad(S, t, P.ch, BAR, intro ? 0.7 : 1);

    const cut = intro ? 500 + pb * 260 : 2400;
    for (let i = 0; i < 16; i++) {
      if (intro && pb < 2 && i % 2) continue;   // start sparse
      const k = PULSE[i], m = k === 3 ? P.ch[0] + 12 : P.ch[k];
      I.pulse(S, b(i / 4), m, i % 4 === 0 ? 1 : 0.6, cut);
    }

    if (intro) {
      I.kick(S, t);
      if (pb >= 4) I.kick(S, b(2), 0.8);
      if (lastBar) {   // timpani roll into the theme
        for (let i = 0; i < 8; i++) I.tom(S, b(2 + i / 4), i < 4 ? 98 : 73, 0.5 + i * 0.07);
      }
      return;
    }

    for (let i = 0; i < 8; i++) I.bass(S, b(i / 2), P.root + BASS_OCT[i], BEAT / 2);
    if (pb === 0) I.cymbal(S, t);
    for (const k of [0, 1.5, 2, 2.75]) I.kick(S, b(k), k % 1 ? 0.7 : 1);
    if (lastBar) {
      I.snare(S, b(1));
      for (let i = 0; i < 8; i++) I.tom(S, b(2 + i / 4), [147, 147, 123, 123, 98, 98, 73, 73][i], 0.6 + i * 0.05);
    } else {
      I.snare(S, b(1)); I.snare(S, b(3));
      const step = sec === 'B' ? 0.25 : 0.5;
      for (let k = 0; k < 4; k += step) I.hat(S, b(k), (k * 2) % 1 ? 0.6 : 1);
    }

    let pos = 0;
    for (const [m, len] of MEL[pb]) {
      if (m !== null) {
        I.brass(S, b(pos), m, len * BEAT * 0.94, 1);
        if (sec === 'B') I.brass(S, b(pos), m + 12, len * BEAT * 0.94, 0.4);
      }
      pos += len;
    }
  }

  // 'paddock': bars 0-7 intro (pumping pad + arpeggio with the filter opening, hats from bar 4),
  // then 8-bar sections alternating A (bell melody) and B (melody + claps + busier hats).
  function paddockBar(S, bar, t) {
    const sec = bar < 8 ? 'intro' : (Math.floor(bar / 8) % 2 ? 'A' : 'B');
    const pb = bar % 8, P = P_PROG[pb % 4], intro = sec === 'intro';
    const b = n => t + n * P_BEAT;

    I.padPump(S, t, P.ch, 4, P_BEAT, intro ? 0.8 : 1);
    for (let i = 0; i < 16; i++) {
      const k = P_ARP[i], m = (k === 3 ? P.ch[0] + 12 : P.ch[k]) - 12;
      I.pluck(S, b(i / 4), m, (i % 4 === 0 ? 1 : 0.65) * (intro ? 0.5 + pb * 0.07 : 1));
    }
    if (intro && pb < 4) return;

    for (let k = 0; k < 4; k++) I.hat(S, b(k + 0.5), 1.2);
    if (intro) return;

    if (sec === 'B') {
      I.clap(S, b(1)); I.clap(S, b(3));
      for (let k = 0; k < 4; k += 0.25) if (k % 0.5) I.hat(S, b(k), 0.5);
    }
    if (pb === 0) I.cymbal(S, t);

    let pos = 0;
    for (const [m, len] of P_MEL[pb]) {
      if (m !== null) I.bell(S, b(pos), m, len * P_BEAT, 1);
      pos += len;
    }
  }

  // 'jazz': bars 0-3 bass in two + piano, 4-7 walking bass and ride join. Then A (piano melody in
  // octaves) and B (vibraphone takes the melody, busier piano comping and brushes).
  function jazzBar(S, bar, t) {
    const sec = bar < 8 ? 'intro' : (Math.floor(bar / 8) % 2 ? 'A' : 'B');
    const pb = bar % 8, P = J_PROG[pb], N = J_PROG[(pb + 1) % 8], intro = sec === 'intro';
    const sw = p => Math.floor(p) + (p % 1 === 0.5 ? 2 / 3 : p % 1);   // swing the off-beat eighths
    const b = n => t + sw(n) * J_BEAT;
    const inTwo = intro && pb < 4;

    if (inTwo) {
      I.upright(S, b(0), P.root, J_BEAT * 1.8);
      I.upright(S, b(2), P.root + 7, J_BEAT * 1.8);
    } else {
      walk(P, N, pb % 2).forEach((m, i) => I.upright(S, b(i), m, J_BEAT * 0.9));
    }

    const comp = sec === 'B' ? [[0, 0.6], [1.5, 0.4], [3, 0.3], [3.5, 0.9]] : [[0, 1.2], [1.5, 0.5]];   // Charleston rhythm
    for (const [p, len] of comp) I.piano(S, b(p), P.ch, len * J_BEAT, p ? 0.75 : 1);
    if (inTwo) return;

    for (const p of [0, 1, 1.5, 2, 3, 3.5]) I.ride(S, b(p), p % 1 ? 0.6 : (p % 2 ? 1 : 0.8));
    I.hat(S, b(1), 0.8); I.hat(S, b(3), 0.8);
    I.kick(S, b(0), 0.25); I.kick(S, b(2), 0.2);
    if (sec === 'B') { I.brush(S, b(0.5), 0.5); I.brush(S, b(2.5), 0.7); }
    if (pb === 7) for (const p of [2.5, 3, 3.5]) I.brush(S, b(p), 0.9);
    if (intro) return;

    let pos = 0;
    for (const [m, len] of J_MEL[pb]) {
      if (m !== null) {
        const d = (sw(pos + len) - sw(pos)) * J_BEAT * 0.9;
        if (sec === 'A') I.piano(S, b(pos), [m, m - 12], d, 1.4);   // piano melody in octaves
        else I.vibes(S, b(pos), m, d, 1);
      }
      pos += len;
    }
  }

  // 'classical': bars 0-3 arpeggios alone, melody enters at bar 4. Then A (melody over p-i-m-a-m-i
  // arpeggios) and B (melody in octaves, arpeggio climbing higher).
  function classicalBar(S, bar, t) {
    const sec = bar < 8 ? 'intro' : (Math.floor(bar / 8) % 2 ? 'A' : 'B');
    const pb = bar % 8, P = C_PROG[pb], intro = sec === 'intro';
    const b = n => t + n * C_BEAT + (Math.random() - 0.5) * 0.012;   // a touch of human timing

    I.nylon(S, b(0), P.bass, 1.1, C_BAR);   // thumb: bass rings through the bar
    const pattern = sec === 'B' ? [0, 1, 2, 1, 2] : [0, 1, 2, 1, 0];
    pattern.forEach((k, i) => I.nylon(S, b((i + 1) / 2), P.ch[k], 0.5, C_BEAT * 1.2));
    if (intro && pb < 4) return;

    let pos = 0;
    for (const [m, len] of C_MEL[pb]) {
      I.nylon(S, b(pos), m, 1, len * C_BEAT + 0.2);
      if (sec === 'B') I.nylon(S, b(pos), m - 12, 0.55, len * C_BEAT + 0.2);
      pos += len;
    }
  }

  // 'grandprix': bars 0-3 arpeggio and pad (filter opening), 4-7 add four-on-the-floor kick and
  // rolling bass. Then A (brass theme) and B (theme doubled an octave up, claps, sixteenth hats).
  function grandprixBar(S, bar, t) {
    const sec = bar < 8 ? 'intro' : (Math.floor(bar / 8) % 2 ? 'A' : 'B');
    const pb = bar % 8, P = G_PROG[pb % 4], intro = sec === 'intro';
    const b = n => t + n * G_BEAT;

    I.pad(S, t, P.ch, G_BAR, 0.6);
    for (let i = 0; i < 16; i++) I.pulse(S, b(i / 4), P.ch[i % 3] + (i % 6 > 2 ? 12 : 0), i % 4 ? 0.55 : 0.9, intro ? 600 + pb * 300 : 2600);
    if (intro && pb < 4) return;

    for (let k = 0; k < 4; k++) {
      I.kick(S, b(k));
      I.hat(S, b(k + 0.5), 1.1);
      for (const q of [0.25, 0.5, 0.75]) I.bass(S, b(k + q), P.root + (q === 0.5 ? 12 : 0), G_BEAT / 4);   // rolling off-beat bass
    }
    if (intro) return;

    if (pb === 0) I.cymbal(S, t);
    if (sec === 'B') {
      I.clap(S, b(1)); I.clap(S, b(3));
      for (let k = 0.25; k < 4; k += 0.5) I.hat(S, b(k), 0.5);
    }
    let pos = 0;
    for (const [m, len] of G_MEL[pb]) {
      if (m !== null) {
        I.brass(S, b(pos), m, len * G_BEAT * 0.94, sec === 'B' ? 1 : 0.8);
        if (sec === 'B') I.brass(S, b(pos), m + 12, len * G_BEAT * 0.94, 0.35);
      }
      pos += len;
    }
  }

  // Walking bass for one bar: chord tones, then a chromatic approach to the next chord's root.
  function walk(P, N, odd) {
    const line = odd ? [P.root, P.root + 2, P.root + P.third] : [P.root, P.root + P.third, P.root + 7];
    line.push(N.root + (line[2] > N.root ? 1 : -1));
    return line;
  }

  // 'cafe': 4-bar intro (piano and bass in two over the last four chords, melody pickup), then
  // 16-bar choruses with a walking bass: piano melody in octaves over Charleston comping, then the
  // melody an octave higher with busier comping.
  function cafeBar(S, bar, t) {
    const intro = bar < 4, fb = intro ? 12 + bar : (bar - 4) % 16, high = !intro && Math.floor((bar - 4) / 16) % 2;
    const P = CF_PROG[fb], N = CF_PROG[(fb + 1) % 16];
    const sw = p => Math.floor(p) + (p % 1 === 0.5 ? 2 / 3 : p % 1);   // swing the off-beat eighths
    const b = n => t + sw(n) * CF_BEAT;

    if (intro) {
      I.upright(S, b(0), P.root, CF_BEAT * 1.8);
      I.upright(S, b(2), P.root + 7, CF_BEAT * 1.8);
    } else {
      walk(P, N, fb % 2).forEach((m, i) => I.upright(S, b(i), m, CF_BEAT * 0.9));
    }
    const comp = high ? [[0, 0.6], [1.5, 0.4], [3, 0.3], [3.5, 0.9]] : [[0, 1.2], [1.5, 0.5]];
    for (const [p, len] of comp) I.piano(S, b(p), P.ch, len * CF_BEAT, p ? 0.75 : 1);
    if (bar >= 2) for (const p of [0, 1, 1.5, 2, 3, 3.5]) I.hat(S, b(p), p % 1 ? 0.35 : (p % 2 ? 0.7 : 0.45));   // light swung hi-hat
    if (intro && bar < 3) return;

    let pos = 0;
    for (const [m, len] of CF_MEL[fb]) {
      if (m !== null) {
        const d = (sw(pos + len) - sw(pos)) * CF_BEAT * 0.9;
        I.piano(S, b(pos), high ? [m + 12, m] : [m, m - 12], d, 1.4);
      }
      pos += len;
    }
  }

  // 'jazzrace': 12-bar minor blues choruses, head on piano in octaves, then on vibraphone; busy
  // comping and snare "drops" that change bar to bar.
  function jazzRaceBar(S, bar, t) {
    const pb = bar % 12, P = JR_PROG[pb], N = JR_PROG[(pb + 1) % 12], vibesChorus = Math.floor(bar / 12) % 2;
    const sw = p => Math.floor(p) + (p % 1 === 0.5 ? 2 / 3 : p % 1);
    const b = n => t + sw(n) * JR_BEAT;

    walk(P, N, pb % 2).forEach((m, i) => I.upright(S, b(i), m, JR_BEAT * 0.9));
    for (const [p, len] of JR_COMP[pb % 4]) I.piano(S, b(p), P.ch, len * JR_BEAT, 0.8);
    for (const p of [0, 1, 1.5, 2, 3, 3.5]) I.ride(S, b(p), p % 1 ? 0.6 : (p % 2 ? 1 : 0.8));
    I.hat(S, b(1), 0.8); I.hat(S, b(3), 0.8);
    I.kick(S, b(0), 0.25);
    for (const p of JR_SNARE[pb % 4]) I.snare(S, b(p), 0.3);
    if (pb === 11) { I.snare(S, b(3), 0.6); I.kick(S, b(3.5), 0.6); I.snare(S, b(3.5), 0.7); }

    let pos = 0;
    for (const [m, len] of JR_MEL[pb]) {
      if (m !== null) {
        const d = (sw(pos + len) - sw(pos)) * JR_BEAT * 0.9;
        if (vibesChorus) I.vibes(S, b(pos), m + 12, d, 0.9);
        else I.piano(S, b(pos), [m, m + 12], d, 1.3);
      }
      pos += len;
    }
  }

  // 'etude': bars 0-3 arpeggios alone, melody from bar 4. Then A (melody) and B (melody in octaves).
  function etudeBar(S, bar, t) {
    const sec = bar < 8 ? 'intro' : (Math.floor(bar / 8) % 2 ? 'A' : 'B');
    const pb = bar % 8, P = E_PROG[pb], intro = sec === 'intro';
    const b = n => t + n * E_BEAT + (Math.random() - 0.5) * 0.012;

    I.nylon(S, b(0), P.bass, 1.1, E_BEAT * 2);      // alternating bass: root, then fifth
    I.nylon(S, b(2), P.bass + 7, 0.9, E_BEAT * 2);
    for (let i = 0; i < 12; i++) I.nylon(S, b(i / 3), P.ch[i % 3], i % 3 ? 0.4 : 0.5, E_BEAT * 0.9);   // triplets
    if (intro && pb < 4) return;

    let pos = 0;
    for (const [m, len] of E_MEL[pb]) {
      I.nylon(S, b(pos), m, 1.1, len * E_BEAT + 0.2);
      if (sec === 'B') I.nylon(S, b(pos), m - 12, 0.5, len * E_BEAT + 0.2);
      pos += len;
    }
  }

  // 'flamenco': bars 0-3 guitar alone, 4-7 cajón joins. Then A (picado runs over light strums) and
  // B (full strums, rasgueado roll on the E chord, hand claps).
  function flamencoBar(S, bar, t) {
    const sec = bar < 8 ? 'intro' : (Math.floor(bar / 8) % 2 ? 'A' : 'B');
    const pb = bar % 4, ch = F_CH[pb], intro = sec === 'intro', picado = sec === 'A';
    const b = n => t + n * F_BEAT;
    const strum = (p, vel, up, spread = 0.012) => (up ? [...ch].reverse() : ch).forEach((m, i) => I.nylon(S, b(p) + i * spread, m, vel, F_BEAT * 0.9, true));

    if (pb === 3 && !picado) {   // rasgueado: four fingers flick out in quick succession
      for (let i = 0; i < 4; i++) strum(i / 4, 0.5 + i * 0.1, false, 0.006);
      strum(1, 0.9); strum(2, 1);
    } else {
      const v = picado ? 0.35 : 0.7;
      strum(0, v * 1.3); strum(1, v); strum(1.5, v * 0.8, true); strum(2, v); strum(2.5, v * 0.8, true);
    }
    if (intro && bar < 4) return;

    I.cajon(S, b(0), false); I.cajon(S, b(1), true); I.cajon(S, b(1.5), false); I.cajon(S, b(2), true);
    if (sec === 'B') { I.cajon(S, b(2.5), true, 0.6); I.clap(S, b(1), 0.6); I.clap(S, b(2), 0.6); }
    if (picado) F_RUN[pb].forEach((m, i) => { if (m) I.nylon(S, b(i / 4), m, 1, F_BEAT * 0.3, true); });
  }

  // level: how loud the song plays (in-race songs sit under the engine).
  const SONGS = {
    anthem: { barLen: BAR, bar: anthemBar },
    paddock: { barLen: P_BAR, bar: paddockBar },
    grandprix: { barLen: G_BAR, bar: grandprixBar, level: 0.3 },
    jazz: { barLen: J_BAR, bar: jazzBar },
    cafe: { barLen: CF_BAR, bar: cafeBar },
    jazzrace: { barLen: JR_BAR, bar: jazzRaceBar, level: 0.3 },
    classical: { barLen: C_BAR, bar: classicalBar },
    etude: { barLen: E_BAR, bar: etudeBar },
    flamenco: { barLen: F_BAR, bar: flamencoBar, level: 0.3 },
  };

  function start(id) {
    buffers();
    const song = SONGS[id];
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, ctx.currentTime);
    out.gain.exponentialRampToValueAtTime(song.level || 0.55, ctx.currentTime + 1.5);
    out.connect(dest);
    const dry = ctx.createGain(); dry.connect(out);
    const verb = ctx.createConvolver(); verb.buffer = irBuf;
    const verbIn = ctx.createGain(); verbIn.gain.value = 0.5; verbIn.connect(verb); verb.connect(out);
    const bus = ctx.createGain(); bus.connect(dry); bus.connect(verbIn);          // normal reverb send
    const wet = ctx.createGain(); wet.connect(dry); wet.gain.value = 1;
    const wetSend = ctx.createGain(); wetSend.gain.value = 1.6; wet.connect(wetSend); wetSend.connect(verbIn);   // pads: extra reverb
    const S = { id, song, out, dry, bus, wet, bar: 0, next: ctx.currentTime + 0.1 };
    S.timer = setInterval(() => {
      while (S.next < ctx.currentTime + 0.4) { song.bar(S, S.bar, S.next); S.bar++; S.next += song.barLen; }
    }, 50);
    session = S;
  }

  function stop() {
    const S = session;
    session = null;
    clearInterval(S.timer);
    const t = ctx.currentTime;
    S.out.gain.cancelScheduledValues(t);
    S.out.gain.setValueAtTime(Math.max(0.0001, S.out.gain.value), t);
    S.out.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    setTimeout(() => S.out.disconnect(), S.song.barLen * 1000 + 1500);   // let already-scheduled notes finish silently
  }

  return {
    setPlaying(id, audioCtx, destination) {
      ctx = audioCtx; dest = destination;
      if ((session && session.id) === (id || undefined)) return;
      if (session) stop();
      if (id) start(id);
    },
  };
})();

// Tests for the game's pure logic and the offline file list. Run with: node --test
// No packages to install; they use Node's built-in test runner.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
// A stand-in for the browser's localStorage, for the parts that save.
const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
};
const Records = require('../js/records.js');
const Ghost = require('../js/ghost.js');
const Net = require('../js/net.js');

// ---------- Records ----------
test('records: old format (one bestRace) becomes the 2-lap record', () => {
  const r = Records.clean({ monza: { bestLap: 80.5, bestRace: 170.2 } });
  assert.deepEqual(r.monza, { bestLap: 80.5, races: { 2: 170.2 }, bestRace: 170.2 });
});

test('records: bad values are dropped, empty tracks left out', () => {
  const r = Records.clean({ a: { bestLap: -1, races: { 5: 'x', 10: Infinity, 3: 100 } }, b: null, c: { bestLap: NaN } });
  assert.deepEqual(r, {});
  assert.deepEqual(Records.clean('nonsense'), {});
  assert.deepEqual(Records.clean(null), {});
});

test('records: merge keeps the fastest of each, per race length', () => {
  const a = { monza: { bestLap: 81, races: { 2: 170, 5: 420 } } };
  const b = { monza: { bestLap: 80, races: { 2: 175, 10: 830 } }, spa: { bestLap: 100 } };
  const m = Records.merge(a, b);
  assert.deepEqual(m.monza, { bestLap: 80, races: { 2: 170, 5: 420, 10: 830 }, bestRace: 170 });
  assert.deepEqual(m.spa, { bestLap: 100, races: {}, bestRace: null });
});

test('records: setLap / setRace only accept faster times and known lengths', () => {
  const r = {};
  assert.equal(Records.setLap(r, 'monza', 82), true);
  assert.equal(Records.setLap(r, 'monza', 83), false);
  assert.equal(Records.setLap(r, 'monza', 82), false);
  assert.equal(Records.setLap(r, 'monza', 81.5), true);
  assert.equal(Records.bestLap(r, 'monza'), 81.5);
  assert.equal(Records.setRace(r, 'monza', 5, 410), true);
  assert.equal(Records.setRace(r, 'monza', 3, 200), false);   // not a race length
  assert.equal(Records.setRace(r, 'monza', 5, 0), false);
  assert.equal(Records.bestRace(r, 'monza', 5), 410);
  assert.equal(Records.bestRace(r, 'monza', 2), null);
  assert.equal(Records.setRace(r, 'monza', 2, 170), true);
  assert.equal(r.monza.bestRace, 170);                         // mirrored for older versions
  assert.equal(Records.bestLap(r, 'nowhere'), null);
});

// ---------- Ghost ----------
// A lap driven in a straight line along z at 50 m/s, noted 120 times a second like the game does.
function driveLap(seconds) {
  const rec = Ghost.recorder();
  for (let t = 0; t <= seconds + 1e-9; t += 1 / 120) rec.add(t, 0, 1, t * 50, 0, 0);
  return rec.take(seconds);
}

test('ghost: records one sample every 0.1 s', () => {
  const g = driveLap(10);
  assert.equal(g.pts.length / 5, 101);
  assert.equal(g.time, 10);
});

test('ghost: plays back in between samples, and stops at the end of its lap', () => {
  const g = driveLap(10);
  const p = Ghost.at(g, 3.25);
  assert.ok(Math.abs(p.z - 162.5) < 0.01, `z was ${p.z}`);
  assert.equal(p.y, 1);
  assert.equal(Ghost.at(g, 10.5), null);
  assert.equal(Ghost.at(g, -1), null);
});

test('ghost: heading turns the short way across Â±180 degrees', () => {
  const rec = Ghost.recorder();
  for (let i = 0; i < 20; i++) rec.add(i * 0.1, 0, 0, 0, i % 2 ? -3.1 : 3.1, 0);
  const g = rec.take(1.9);
  const h = Ghost.at(g, 0.05).h;                 // halfway from 3.1 to -3.1: about Â±Ï€, not 0
  assert.ok(Math.abs(Math.abs(h) - Math.PI) < 0.01, `h was ${h}`);
});

test('ghost: too short a recording is no ghost; reset starts again', () => {
  const rec = Ghost.recorder();
  rec.add(0, 0, 0, 0, 0, 0);
  assert.equal(rec.take(0.5), null);
  for (let t = 0; t < 5; t += 0.01) rec.add(t, 0, 0, 0, 0, 0);
  rec.reset();
  rec.add(0, 0, 0, 0, 0, 0);
  assert.equal(rec.take(5), null);
});

test('ghost: saved and loaded per circuit; damaged data is ignored', () => {
  const g = driveLap(5);
  assert.equal(Ghost.save('monza', g), true);
  assert.deepEqual(Ghost.load('monza'), g);
  assert.equal(Ghost.load('spa'), null);
  localStorage.setItem('racing-sim-ghost:spa', '{"v":1,"time":5,"step":0.1,"pts":[1,2,3]}');
  assert.equal(Ghost.load('spa'), null);
  localStorage.setItem('racing-sim-ghost:spa', 'not json');
  assert.equal(Ghost.load('spa'), null);
  assert.equal(Ghost.validate({ ...g, pts: [...g.pts.slice(0, -1), null] }), null);
});

// ---------- Multiplayer message checks ----------
test('net: isNums wants exactly n ordinary numbers', () => {
  assert.equal(Net.isNums([1, 2, 3], 3), true);
  assert.equal(Net.isNums([1, 2], 3), false);
  assert.equal(Net.isNums([1, NaN, 3], 3), false);
  assert.equal(Net.isNums([1, '2', 3], 3), false);
  assert.equal(Net.isNums('123', 3), false);
});

test('net: cleanBump rejects missing numbers and limits the rest', () => {
  const ok = { ds: 0.5, dd: -0.2, v: 60, latV: 3, dy: 1, spinT: 2.5, backoff: 1.5 };
  assert.deepEqual(Net.cleanBump(ok), ok);
  assert.equal(Net.cleanBump({ ...ok, v: undefined }), null);
  assert.equal(Net.cleanBump({ ...ok, dy: NaN }), null);
  const big = Net.cleanBump({ ...ok, ds: 1e9, spinT: 1e9, backoff: -5 });
  assert.equal(big.ds, 10);
  assert.equal(big.spinT, 5);
  assert.equal(big.backoff, 0);
});

// ---------- Offline file list ----------
test('sw.js lists every script index.html loads, and every listed file exists', () => {
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const files = [...sw.match(/const FILES = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]).filter(s => !/^https?:/.test(s));
  assert.ok(scripts.length > 5);
  for (const s of scripts) assert.ok(files.includes(s), `${s} is loaded by index.html but missing from sw.js FILES`);
  for (const f of files) if (f !== './') assert.ok(fs.existsSync(path.join(ROOT, f)), `${f} is in sw.js FILES but doesn't exist`);
});

// ---------- Every script at least parses ----------
test('all game scripts are valid JavaScript', () => {
  const vm = require('node:vm');
  for (const f of fs.readdirSync(path.join(ROOT, 'js'))) {
    if (!f.endsWith('.js') || f.endsWith('.min.js')) continue;
    assert.doesNotThrow(() => new vm.Script(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), { filename: f }), f);
  }
});

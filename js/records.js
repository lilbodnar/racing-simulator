// Lap and race records: { [trackId]: { bestLap, races: { 2: t, 5: t, 10: t }, bestRace } }.
// Fastest lap is one per track; best race time is kept for each race length. `bestRace` repeats
// the 2-lap time because that's where versions before race lengths kept it, so a device still
// running an old copy keeps the 2-lap records it can see. Pure logic, no browser needed (see tests/).
const Records = (() => {
  const LENGTHS = [2, 5, 10];
  const time = t => (typeof t === 'number' && isFinite(t) && t > 0) ? t : null;
  const min = (x, y) => x == null ? y : y == null ? x : Math.min(x, y);

  // Anything read from storage or the account, made safe: bad values dropped, old format upgraded.
  function clean(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object') return out;
    for (const id in raw) {
      const r = raw[id] || {};
      const bestLap = time(r.bestLap), races = {};
      for (const n of LENGTHS) {
        const t = time(r.races && r.races[n]);
        if (t != null) races[n] = t;
      }
      const old = time(r.bestRace);                 // before race lengths: a 2-lap race
      if (old != null) races[2] = min(races[2], old);
      if (bestLap != null || Object.keys(races).length) out[id] = { bestLap, races, bestRace: races[2] ?? null };
    }
    return out;
  }

  // Best of both: a record only ever gets faster.
  function merge(a, b) {
    const out = clean(a);
    for (const [id, r] of Object.entries(clean(b))) {
      const o = out[id] || { bestLap: null, races: {} };
      const races = { ...o.races };
      for (const n in r.races) races[n] = min(races[n], r.races[n]);
      out[id] = { bestLap: min(o.bestLap, r.bestLap), races, bestRace: races[2] ?? null };
    }
    return out;
  }

  const entry = (recs, id) => recs[id] || (recs[id] = { bestLap: null, races: {}, bestRace: null });
  const bestLap = (recs, id) => (recs[id] && recs[id].bestLap) ?? null;
  const bestRace = (recs, id, laps) => (recs[id] && recs[id].races[laps]) ?? null;

  // Record a lap / race time. True if it's a new record (and `recs` was updated).
  function setLap(recs, id, t) {
    const e = entry(recs, id);
    if (time(t) == null || (e.bestLap != null && t >= e.bestLap)) return false;
    e.bestLap = t;
    return true;
  }
  function setRace(recs, id, laps, t) {
    const e = entry(recs, id);
    if (time(t) == null || !LENGTHS.includes(laps) || (e.races[laps] != null && t >= e.races[laps])) return false;
    e.races[laps] = t;
    if (laps === 2) e.bestRace = t;
    return true;
  }

  return { LENGTHS, clean, merge, bestLap, bestRace, setLap, setRace };
})();
if (typeof module !== 'undefined') module.exports = Records;

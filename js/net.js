// Multiplayer transport: a direct browser-to-browser (WebRTC) connection through PeerJS, so there's
// no game server. One player hosts; the room code is the host's PeerJS id. Everyone else connects
// only to the host, which relays (a star, so 22 drivers need just 21 connections). PeerJS's free
// public broker introduces the browsers to each other, and its relay servers step in when a
// firewall blocks a direct link.
const Net = (() => {
  const PREFIX = 'racing-sim-2026-';
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // no 0/O or 1/I to mix up
  const MAX_PLAYERS = 22;
  const handlers = {};
  const conns = new Map();      // host: peer id -> connection
  let peer = null, hostConn = null;

  const api = { MAX_PLAYERS, role: null, id: null, code: null };
  api.on = (ev, fn) => { handlers[ev] = fn; };
  const emit = (ev, ...a) => { if (handlers[ev]) handlers[ev](...a); };
  const makeCode = () => Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  const errText = e => ({
    'browser-incompatible': 'This browser doesn\'t support multiplayer. Use Chrome, Edge or Firefox.',
    network: 'Can\'t reach the multiplayer service. Check your internet connection.',
    'server-error': 'The multiplayer service isn\'t responding. Try again in a minute.',
    'socket-error': 'Lost the connection to the multiplayer service.',
  })[e && e.type] || (e && e.message) || 'Connection failed';

  function close() {
    const p = peer;
    peer = null; hostConn = null; conns.clear();
    api.role = api.id = api.code = null;
    if (p) p.destroy();
  }

  // Host a room. Resolves with the room code.
  api.host = () => new Promise((resolve, reject) => {
    close();
    if (!window.Peer) { reject(new Error('Multiplayer library failed to load')); return; }
    const code = makeCode();
    const p = peer = new Peer(PREFIX + code);
    let opened = false;
    p.on('open', () => {
      opened = true;
      api.role = 'host'; api.id = 'host'; api.code = code;
      resolve(code);
    });
    p.on('connection', c => {
      c.on('open', () => {
        if (conns.size >= MAX_PLAYERS - 1) { c.send({ t: 'full' }); setTimeout(() => c.close(), 500); return; }
        conns.set(c.peer, c);
        emit('join', c.peer);
      });
      c.on('data', d => { if (conns.get(c.peer) === c) emit('msg', d, c.peer); });
      const gone = () => { if (conns.get(c.peer) === c) { conns.delete(c.peer); emit('leave', c.peer); } };
      c.on('close', gone);
      c.on('error', gone);
    });
    // Losing the broker only stops new players joining; races in progress carry on. Reconnect.
    p.on('disconnected', () => { if (peer === p && !p.destroyed) p.reconnect(); });
    p.on('error', e => {
      if (peer !== p) return;
      if (!opened && e.type === 'unavailable-id') { api.host().then(resolve, reject); return; }   // code taken: pick another
      if (!opened) { close(); reject(new Error(errText(e))); }
    });
  });

  // Join the room with this code.
  api.join = code => new Promise((resolve, reject) => {
    close();
    if (!window.Peer) { reject(new Error('Multiplayer library failed to load')); return; }
    code = code.trim().toUpperCase();
    const p = peer = new Peer();
    let done = false;
    const fail = msg => { if (done) return; done = true; if (peer === p) close(); reject(new Error(msg)); };
    const timer = setTimeout(() => fail('No race found with code ' + code), 15000);
    p.on('open', () => {
      const c = p.connect(PREFIX + code, { reliable: true, serialization: 'json' });
      c.on('open', () => {
        clearTimeout(timer);
        if (done) return;
        done = true;
        hostConn = c;
        api.role = 'client'; api.id = p.id; api.code = code;
        resolve();
      });
      c.on('data', d => emit('msg', d, 'host'));
      const lost = () => { if (hostConn === c) { close(); emit('lost'); } };
      c.on('close', lost);
      c.on('error', lost);
    });
    p.on('disconnected', () => { if (peer === p && !p.destroyed && hostConn) p.reconnect(); });
    p.on('error', e => {
      if (peer !== p) return;
      if (e.type === 'peer-unavailable') fail('No race found with code ' + code);
      else if (!done) { clearTimeout(timer); fail(errText(e)); }
    });
  });

  // Client: message to the host. Host: message to one player.
  api.send = (msg, to) => {
    const c = api.role === 'host' ? conns.get(to) : hostConn;
    if (c && c.open) c.send(msg);
  };
  // Host: message to every player (except `except`).
  api.broadcast = (msg, except) => {
    for (const [id, c] of conns) if (id !== except && c.open) c.send(msg);
  };
  api.kick = id => { const c = conns.get(id); if (c) c.close(); };
  api.close = close;
  return api;
})();

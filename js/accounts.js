// Player accounts: sign in with a username and password so your records follow you to any device.
// Uses Firebase (Auth for passwords, Firestore for records). Firebase only takes email addresses,
// so a username is turned into a made-up address that never receives mail.
// Nothing loads unless js/firebase-config.js has a config, and offline the game carries on without it.
const Accounts = (() => {
  const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const EMAIL_DOMAIN = '@players.racingsim.example';
  const NAME_RE = /^[A-Za-z0-9_.-]{3,16}$/;

  const enabled = !!window.FIREBASE_CONFIG;
  let auth = null, db = null;
  let user = null;                    // { uid, name } while signed in
  const listeners = [];
  let ready = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error("Can't reach the account service. Check your connection."));
      document.head.appendChild(s);
    });
  }

  // Load the SDK and restore a saved sign-in. Resolves once the signed-in state is known.
  function init() {
    if (!enabled) return Promise.resolve(null);
    if (ready) return ready;
    ready = loadScript(SDK + 'firebase-app-compat.js')
      .then(() => Promise.all([loadScript(SDK + 'firebase-auth-compat.js'), loadScript(SDK + 'firebase-firestore-compat.js')]))
      .then(() => {
        firebase.initializeApp(window.FIREBASE_CONFIG);
        auth = firebase.auth();
        db = firebase.firestore();
        return new Promise(resolve => {
          auth.onAuthStateChanged(u => {
            user = u ? { uid: u.uid, name: u.displayName || u.email.split('@')[0] } : null;
            listeners.forEach(cb => cb(user));
            resolve(user);
          });
        });
      });
    ready.catch(() => { ready = null; });   // let a later attempt try again
    return ready;
  }

  function checkName(name) {
    if (!NAME_RE.test(name)) throw new Error('Usernames are 3-16 letters, numbers, dots, dashes or underscores');
  }
  const emailOf = name => name.toLowerCase() + EMAIL_DOMAIN;

  // Firebase error codes → something a player can act on.
  function friendly(e) {
    const code = e && e.code || '';
    if (/invalid-credential|wrong-password|user-not-found|invalid-email/.test(code)) return new Error('Wrong username or password');
    if (/email-already-in-use/.test(code)) return new Error('That username is taken');
    if (/weak-password/.test(code)) return new Error('Password needs at least 6 characters');
    if (/too-many-requests/.test(code)) return new Error('Too many tries. Wait a minute and try again');
    if (/network-request-failed/.test(code)) return new Error("Can't reach the account service. Check your connection.");
    if (/api-key|configuration-not-found|operation-not-allowed|unauthorized-domain/.test(code)) return new Error("Accounts aren't set up properly yet (see README)");
    return e instanceof Error ? e : new Error('Something went wrong');
  }

  async function signIn(name, password) {
    checkName(name);
    await init();
    try { await auth.signInWithEmailAndPassword(emailOf(name), password); }
    catch (e) { throw friendly(e); }
  }

  async function signUp(name, password) {
    checkName(name);
    await init();
    try {
      const cred = await auth.createUserWithEmailAndPassword(emailOf(name), password);
      await cred.user.updateProfile({ displayName: name });
      user = { uid: cred.user.uid, name };
      listeners.forEach(cb => cb(user));
    } catch (e) { throw friendly(e); }
  }

  function signOut() { return auth ? auth.signOut() : Promise.resolve(); }

  // Combine `local` with the records saved in the account (best of each), save the result to the
  // account and return it. Runs as a transaction so two devices racing at once can't undo each other.
  async function syncRecords(local, merge) {
    if (!user) return local;
    const ref = db.collection('users').doc(user.uid);
    return db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      const cloud = snap.exists && snap.data().records || {};
      const merged = merge(cloud, local);
      if (JSON.stringify(merged) !== JSON.stringify(cloud)) tx.set(ref, { name: user.name, records: merged }, { merge: true });
      return merged;
    });
  }

  return {
    enabled, init, signIn, signUp, signOut, syncRecords,
    get user() { return user; },
    onChange(cb) { listeners.push(cb); },
  };
})();

// Graphics effects on top of the scene: post-processing (glow, colour grade, darker corners),
// skid marks, sparks and speed streaks. Plain Three.js r128, no add-ons.

// ---------- Post-processing ----------
// The scene is drawn into an off-screen HDR image (half-float, 4x anti-aliased), so anything
// brighter than white - the sun, brake lights, floodlights, sun glare on paint and wet tarmac -
// keeps its brightness. The brightest parts are blurred into a glow (bloom); a final pass adds it
// back, rolls highlights off softly instead of clipping, lifts colour a touch and darkens the
// corners. Needs WebGL 2 with float render targets; otherwise the game draws straight to screen.
function createPost(renderer) {
  const gl = renderer.getContext();
  const supported = renderer.capabilities.isWebGL2 && !!gl.getExtension('EXT_color_buffer_float');
  if (!supported) return { supported: false, setSize() {}, render() {} };

  const hdr = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
  const sceneRT = new THREE.WebGLMultisampleRenderTarget(1, 1, hdr);
  sceneRT.samples = 4;
  const target = () => new THREE.WebGLRenderTarget(1, 1, { ...hdr, depthBuffer: false, stencilBuffer: false });
  const half = target(), qa = target(), qb = target();

  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadScene = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  quadScene.add(quad);
  const VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const pass = (frag, uniforms) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });

  // Bright parts only (by the brightest channel, so a red light counts as bright), averaged over
  // 4 texels so a small light doesn't flicker as it moves across pixels.
  const bright = pass(`
    uniform sampler2D tSrc; uniform vec2 texel; uniform float threshold, knee; varying vec2 vUv;
    vec3 tap(vec2 o) { vec3 c = texture2D(tSrc, vUv + o * texel).rgb; return c * smoothstep(threshold, threshold + knee, max(c.r, max(c.g, c.b))); }
    void main() { gl_FragColor = vec4(0.25 * (tap(vec2(-0.5, -0.5)) + tap(vec2(0.5, -0.5)) + tap(vec2(-0.5, 0.5)) + tap(vec2(0.5, 0.5))), 1.0); }`,
  { tSrc: { value: null }, texel: { value: new THREE.Vector2() }, threshold: { value: 1.5 }, knee: { value: 1.5 } });

  // 9-tap Gaussian blur in one direction (5 reads, using the GPU's linear filtering).
  const blur = pass(`
    uniform sampler2D tSrc; uniform vec2 dir; varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tSrc, vUv).rgb * 0.2270270270;
      c += (texture2D(tSrc, vUv + dir * 1.3846153846).rgb + texture2D(tSrc, vUv - dir * 1.3846153846).rgb) * 0.3162162162;
      c += (texture2D(tSrc, vUv + dir * 3.2307692308).rgb + texture2D(tSrc, vUv - dir * 3.2307692308).rgb) * 0.0702702703;
      gl_FragColor = vec4(c, 1.0);
    }`, { tSrc: { value: null }, dir: { value: new THREE.Vector2() } });

  // Final image. The game's colours were tuned for a plain screen, so they're kept as they are up
  // to the knee; only what's brighter gets the soft roll-off.
  const comp = pass(`
    uniform sampler2D tScene, tBloom; uniform float bloom, vignette, sat, seed; varying vec2 vUv;
    float shoulder(float x) { const float k = 0.62; return x < k ? x : k + (1.0 - k) * (1.0 - exp(-(x - k) / (1.0 - k))); }
    void main() {
      vec3 c = pow(max(texture2D(tScene, vUv).rgb, 0.0), vec3(2.2));      // to linear light
      c += texture2D(tBloom, vUv).rgb * bloom;
      c = vec3(shoulder(c.r), shoulder(c.g), shoulder(c.b));
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = max(mix(vec3(l), c, sat), 0.0);
      c = pow(c, vec3(1.0 / 2.2));                                          // back to screen values
      vec2 d = vUv - 0.5;
      c *= 1.0 - vignette * smoothstep(0.3, 0.85, length(d * vec2(1.25, 1.0)));
      c += (fract(sin(dot(vUv + seed, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;   // dither: no banding in the sky
      gl_FragColor = vec4(c, 1.0);
    }`, { tScene: { value: null }, tBloom: { value: null }, bloom: { value: 0.55 }, vignette: { value: 0.28 }, sat: { value: 1.1 }, seed: { value: 0 } });

  function draw(mat, rt) {
    quad.material = mat;
    renderer.setRenderTarget(rt);
    renderer.render(quadScene, cam);
  }
  function blurPass(src, dst, x, y) {
    blur.uniforms.tSrc.value = src.texture;
    blur.uniforms.dir.value.set(x, y);
    draw(blur, dst);
  }
  let W = 1, H = 1;
  return {
    supported: true,
    setSize(w, h) {
      W = Math.max(1, w); H = Math.max(1, h);
      sceneRT.setSize(W, H);
      half.setSize(Math.ceil(W / 2), Math.ceil(H / 2));
      qa.setSize(Math.ceil(W / 4), Math.ceil(H / 4));
      qb.setSize(Math.ceil(W / 4), Math.ceil(H / 4));
    },
    render(scene, camera) {
      renderer.setRenderTarget(sceneRT);
      renderer.render(scene, camera);
      bright.uniforms.tSrc.value = sceneRT.texture;
      bright.uniforms.texel.value.set(1 / W, 1 / H);
      draw(bright, half);
      const hw = 1 / half.width, qw = 1 / qa.width, qh = 1 / qa.height;
      blurPass(half, qa, hw, 0);
      blurPass(qa, qb, 0, qh);
      blurPass(qb, qa, qw * 2, 0);        // second, wider round for a softer, bigger glow
      blurPass(qa, qb, 0, qh * 2);
      comp.uniforms.tScene.value = sceneRT.texture;
      comp.uniforms.tBloom.value = qb.texture;
      comp.uniforms.seed.value = Math.random();
      draw(comp, null);
    },
  };
}

// ---------- Skid marks ----------
// Dark rubber strips laid behind a wheel while it locks, spins or slides. One mesh holds them all
// in a ring: once it's full, the oldest strip is reused.
function createSkidMarks(scene, maxQuads = 2400) {
  const pos = new Float32Array(maxQuads * 12), col = new Float32Array(maxQuads * 16), idx = [];
  for (let q = 0; q < maxQuads; q++) { const b = q * 4; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    side: THREE.DoubleSide,           // a strip faces up or down depending on which way the car is going
  }));
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  scene.add(mesh);
  const trails = new Map();
  let next = 0, dirty = false;

  function setVert(v, x, y, z, a) {
    pos[v * 3] = x; pos[v * 3 + 1] = y; pos[v * 3 + 2] = z;
    col[v * 4] = 0.03; col[v * 4 + 1] = 0.03; col[v * 4 + 2] = 0.035; col[v * 4 + 3] = a;
  }
  // One wheel's mark: (x, y, z) where it touches, (sx, sz) its sideways direction, alpha 0 = no mark.
  function mark(key, x, y, z, sx, sz, width, alpha) {
    const t = trails.get(key);
    if (alpha <= 0) { trails.delete(key); return; }
    const hw = width / 2;
    const lx = x + sx * hw, lz = z + sz * hw, rx = x - sx * hw, rz = z - sz * hw;
    if (!t) { trails.set(key, { x, z, lx, lz, rx, rz, y, a: alpha }); return; }
    const d = Math.hypot(x - t.x, z - t.z);
    if (d < 0.4) return;
    if (d < 5) {                        // further than that: the car was reset, start a new mark
      const b = next * 4;
      setVert(b, t.lx, t.y, t.lz, t.a); setVert(b + 1, t.rx, t.y, t.rz, t.a);
      setVert(b + 2, lx, y, lz, alpha); setVert(b + 3, rx, y, rz, alpha);
      next = (next + 1) % maxQuads;
      dirty = true;
    }
    Object.assign(t, { x, z, lx, lz, rx, rz, y, a: alpha });
  }
  return {
    mark,
    clear() { pos.fill(0); col.fill(0); trails.clear(); next = 0; dirty = true; },
    flush() {
      if (!dirty) return;
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      dirty = false;
    },
  };
}

// ---------- Sparks ----------
// Short glowing streaks thrown off when the car scrapes the ground or hits something. Brighter
// than white, so they glow with bloom on.
function createSparks(scene, max = 300) {
  const pos = new Float32Array(max * 6), col = new Float32Array(max * 6);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  }));
  lines.frustumCulled = false;
  scene.add(lines);
  const P = Array.from({ length: max }, () => ({ life: 0 }));
  let next = 0, live = 0;

  function spawn(x, y, z, vx, vz, n, ground, spread = 6) {
    for (let k = 0; k < n; k++) {
      const p = P[next];
      next = (next + 1) % max;
      Object.assign(p, {
        x, y, z, ground, life: 0.25 + Math.random() * 0.45, age: 0,
        vx: vx + (Math.random() - 0.5) * spread, vy: 0.5 + Math.random() * spread * 0.5, vz: vz + (Math.random() - 0.5) * spread,
      });
    }
    live = 1;
  }
  function update(dt) {
    if (!live) return;
    let any = 0;
    for (let k = 0; k < max; k++) {
      const p = P[k], o = k * 6;
      if (p.life > 0 && dt > 0) {
        p.age += dt;
        p.vy -= 9.81 * dt;
        p.vx *= 1 - dt * 1.2; p.vz *= 1 - dt * 1.2;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.y < p.ground + 0.03) { p.y = p.ground + 0.03; p.vy *= -0.35; }
        if (p.age >= p.life) p.life = 0;
      }
      if (p.life > 0) {
        any = 1;
        const f = 1 - p.age / p.life, tail = 0.03;
        pos[o] = p.x; pos[o + 1] = p.y; pos[o + 2] = p.z;
        pos[o + 3] = p.x - p.vx * tail; pos[o + 4] = p.y - p.vy * tail; pos[o + 5] = p.z - p.vz * tail;
        col[o] = 4 * f; col[o + 1] = 2.2 * f; col[o + 2] = 0.7 * f;        // white-hot head
        col[o + 3] = 1.2 * f; col[o + 4] = 0.35 * f; col[o + 5] = 0.05 * f; // cooling orange tail
      } else {
        col.fill(0, o, o + 6);
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    live = any;
  }
  return { spawn, update, clear() { P.forEach(p => { p.life = 0; }); col.fill(0); geo.attributes.color.needsUpdate = true; } };
}

// ---------- Speed streaks ----------
// Faint lines rushing past the camera at high speed. They sit in a ring round the view direction,
// so they stream out towards the edges of the screen and leave the middle clear.
function createSpeedLines(scene, n = 80) {
  const pos = new Float32Array(n * 6), col = new Float32Array(n * 6);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  }));
  lines.frustumCulled = false;
  lines.visible = false;
  scene.add(lines);
  const NEAR = -1.5, FAR = -45;
  const S = Array.from({ length: n }, () => respawn({}, true));
  function respawn(s, anywhere) {
    s.a = Math.random() * Math.PI * 2;
    s.r = 3 + Math.random() * 3.5;
    s.z = anywhere ? FAR + Math.random() * (NEAR - FAR) : FAR - Math.random() * 15;
    s.b = 0.5 + Math.random() * 0.5;
    return s;
  }
  // speed in m/s; nothing shows below ~170 km/h, full strength from ~300 km/h.
  function update(dt, camera, speed) {
    const k = Math.min(1, Math.max(0, (speed - 47) / 37));
    lines.visible = k > 0.01;
    if (!lines.visible) return;
    lines.position.copy(camera.position);
    lines.quaternion.copy(camera.quaternion);
    const len = speed * 0.06;
    for (let i = 0; i < n; i++) {
      const s = S[i], o = i * 6;
      s.z += speed * dt;
      if (s.z > NEAR) respawn(s, false);
      const x = Math.cos(s.a) * s.r, y = Math.sin(s.a) * s.r * 0.7;
      pos[o] = x; pos[o + 1] = y; pos[o + 2] = s.z;
      pos[o + 3] = x; pos[o + 4] = y; pos[o + 5] = s.z - len;
      // Fade in from the distance and out as it passes.
      const f = Math.min(1, (s.z - FAR) / 12) * Math.min(1, (NEAR - s.z) / 3);
      const c = Math.max(0, f) * k * s.b * 0.22;
      col[o] = col[o + 1] = col[o + 2] = c;
      col[o + 3] = col[o + 4] = col[o + 5] = 0;   // tail fades to nothing
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  }
  return { update };
}

// Should this mesh cast a shadow? Flat ground-hugging strips (tarmac, kerbs, grass, painted lines)
// shouldn't: they'd only shade themselves. Anything with sides - walls, trees, stands - should.
const _q = new THREE.Quaternion(), _n = new THREE.Vector3();
function castsShadow(mesh) {
  const g = mesh.geometry;
  if (!g || !g.attributes.normal) return false;
  mesh.updateWorldMatrix(true, false);
  mesh.getWorldQuaternion(_q);            // e.g. a plane laid flat by rotating the mesh, not the geometry
  const n = g.attributes.normal, step = Math.max(1, Math.floor(n.count / 400));
  let up = 0, total = 0;
  for (let i = 0; i < n.count; i += step) {
    total++;
    if (Math.abs(_n.fromBufferAttribute(n, i).applyQuaternion(_q).y) > 0.9) up++;
  }
  return up / total <= 0.8;
}

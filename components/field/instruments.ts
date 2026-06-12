/* Ported, restrained "precision instrument" scenes from the Deep Field design.
   Raw three.js (dynamically imported), wrapped by Instrument.tsx. */

export type InstrumentVariant = "lattice" | "constellation" | "flows" | "monolith" | "cta";

const COLORS = {
  accent: 0x12a06a,
  bright: 0x3df0a3,
  deep: 0x0a6b46,
  accent2: 0x7c66ff,
  amber: 0xe0a23c,
  scene1: 0x0c1622,
  fog: 0x081119,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type THREENS = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type H = any;

const rand = (a: number, b: number) => a + Math.random() * (b - a);

function glowTexture(THREE: THREENS) {
  const s = 128;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.18, "rgba(255,255,255,0.85)");
  g.addColorStop(0.45, "rgba(255,255,255,0.25)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, s, s);
  return new THREE.CanvasTexture(c);
}

function dust(H: H, n: number, spread: number, opacity: number) {
  const { THREE, glow, colors } = H;
  const g = new THREE.BufferGeometry();
  const p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    p[i * 3] = rand(-spread, spread);
    p[i * 3 + 1] = rand(-spread * 0.7, spread * 0.7);
    p[i * 3 + 2] = rand(-spread * 0.7, spread * 0.4);
  }
  g.setAttribute("position", new THREE.BufferAttribute(p, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({
    size: 0.05, map: glow, color: new THREE.Color(colors.bright),
    transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
}

function coreRing(H: H, scaleS: number) {
  const { THREE, glow, colors } = H;
  const grp = new THREE.Group();
  const bright = new THREE.Color(colors.bright);
  const accent = new THREE.Color(colors.accent);
  const sph = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 24), new THREE.MeshBasicMaterial({ color: bright }));
  grp.add(sph);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: accent, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.set(2.4, 2.4, 1); grp.add(halo);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.04, 14, 64), new THREE.MeshBasicMaterial({ color: bright, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
  grp.add(ring);
  grp.scale.setScalar(scaleS || 1);
  grp.userData = { sph, halo, ring };
  return grp;
}

// ---- hero lattice: structured node/edge shell + pulsing core ----
function buildLattice(H: H) {
  const { THREE, scene, camera, root, colors, glow } = H;
  scene.fog = new THREE.FogExp2(colors.fog, 0.085);
  camera.position.set(0, 0, 7.4);
  const accent = new THREE.Color(colors.accent);
  const bright = new THREE.Color(colors.bright);

  root.add(dust(H, 220, 7, 0.5));

  const core = new THREE.Group(); root.add(core);
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 32), new THREE.MeshBasicMaterial({ color: bright }));
  core.add(sphere);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: accent, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.set(2.8, 2.8, 1); core.add(halo);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.055, 16, 80), new THREE.MeshBasicMaterial({ color: bright, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
  core.add(ring);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.32, 0.022, 16, 90), new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
  ring2.rotation.x = Math.PI / 2.4; core.add(ring2);
  core.scale.setScalar(0.78);

  const NN = 30;
  const nodes: { base: InstanceType<THREENS["Vector3"]>; p: InstanceType<THREENS["Vector3"]>; ph: number }[] = [];
  const npos = new Float32Array(NN * 3);
  for (let i = 0; i < NN; i++) {
    const phi = Math.acos(1 - (2 * (i + 0.5)) / NN);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    const R = rand(2.0, 3.2);
    const p = new THREE.Vector3(Math.sin(phi) * Math.cos(theta) * R, Math.cos(phi) * R * 0.7, Math.sin(phi) * Math.sin(theta) * R);
    nodes.push({ base: p.clone(), p, ph: rand(0, 6.28) });
    npos[i * 3] = p.x; npos[i * 3 + 1] = p.y; npos[i * 3 + 2] = p.z;
  }
  const ng = new THREE.BufferGeometry();
  ng.setAttribute("position", new THREE.BufferAttribute(npos, 3));
  root.add(new THREE.Points(ng, new THREE.PointsMaterial({ size: 0.34, map: glow, color: bright, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending })));

  const segs: [number, number][] = [];
  for (let i = 0; i < NN; i++)
    for (let j = i + 1; j < NN; j++)
      if (nodes[i].base.distanceTo(nodes[j].base) < 2.1) segs.push([i, j]);
  const lpos = new Float32Array(segs.length * 6);
  const lg = new THREE.BufferGeometry();
  lg.setAttribute("position", new THREE.BufferAttribute(lpos, 3));
  root.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false })));

  return (t: number) => {
    ring.rotation.z = t * 0.4;
    ring.rotation.x = Math.PI / 2 + Math.sin(t * 0.3) * 0.15;
    ring2.rotation.z = -t * 0.25;
    const pulse = 0.92 + Math.sin(t * 1.6) * 0.12;
    sphere.scale.setScalar(pulse);
    halo.scale.set(2.7 * pulse, 2.7 * pulse, 1);
    halo.material.opacity = 0.62 + Math.sin(t * 1.6) * 0.16;
    const npa = ng.attributes.position.array as Float32Array;
    for (let i = 0; i < NN; i++) {
      const n = nodes[i];
      n.p.x = n.base.x + Math.sin(t * 0.5 + n.ph) * 0.16;
      n.p.y = n.base.y + Math.cos(t * 0.4 + n.ph) * 0.16;
      n.p.z = n.base.z + Math.sin(t * 0.6 + n.ph) * 0.16;
      npa[i * 3] = n.p.x; npa[i * 3 + 1] = n.p.y; npa[i * 3 + 2] = n.p.z;
    }
    ng.attributes.position.needsUpdate = true;
    const la = lg.attributes.position.array as Float32Array;
    for (let s = 0; s < segs.length; s++) {
      const a = nodes[segs[s][0]].p, b = nodes[segs[s][1]].p;
      la[s * 6] = a.x; la[s * 6 + 1] = a.y; la[s * 6 + 2] = a.z;
      la[s * 6 + 3] = b.x; la[s * 6 + 4] = b.y; la[s * 6 + 5] = b.z;
    }
    lg.attributes.position.needsUpdate = true;
    root.rotation.z = Math.sin(t * 0.1) * 0.05;
  };
}

// ---- TypologyIQ : constellation ----
function buildConstellation(H: H) {
  const { THREE, scene, camera, root, colors, glow } = H;
  scene.fog = new THREE.FogExp2(colors.fog, 0.07);
  camera.position.set(0, 0, 8);
  root.add(dust(H, 110, 6, 0.45));
  const core = coreRing(H, 1.45); root.add(core);
  const accent = new THREE.Color(colors.accent);
  const bright = new THREE.Color(colors.bright);
  const amber = new THREE.Color(colors.amber);

  const NN = 16;
  const nodes: { base: InstanceType<THREENS["Vector3"]>; p: InstanceType<THREENS["Vector3"]>; ph: number }[] = [];
  const npos = new Float32Array(NN * 3);
  for (let i = 0; i < NN; i++) {
    const a = (i / NN) * Math.PI * 2 + rand(-0.2, 0.2);
    const R = rand(2.4, 3.7);
    const p = new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R * 0.62, rand(-1.2, 0.8));
    nodes.push({ base: p.clone(), p, ph: rand(0, 6.28) });
    npos[i * 3] = p.x; npos[i * 3 + 1] = p.y; npos[i * 3 + 2] = p.z;
  }
  const ng = new THREE.BufferGeometry();
  ng.setAttribute("position", new THREE.BufferAttribute(npos, 3));
  root.add(new THREE.Points(ng, new THREE.PointsMaterial({ size: 0.4, map: glow, color: bright, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending })));
  const lpos = new Float32Array(NN * 6);
  const lg = new THREE.BufferGeometry();
  lg.setAttribute("position", new THREE.BufferAttribute(lpos, 3));
  root.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false })));

  const pulses: { s: InstanceType<THREENS["Sprite"]>; node: number; off: number; spd: number }[] = [];
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: i === 4 ? amber : bright, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.scale.set(0.32, 0.32, 1); root.add(s);
    pulses.push({ s, node: (i * 3) % NN, off: rand(0, 1), spd: rand(0.18, 0.32) });
  }

  return (t: number) => {
    const c = core.userData;
    c.ring.rotation.z = t * 0.4;
    c.halo.material.opacity = 0.6 + Math.sin(t * 1.6) * 0.18;
    c.sph.scale.setScalar(0.9 + Math.sin(t * 1.6) * 0.12);
    const npa = ng.attributes.position.array as Float32Array;
    const la = lg.attributes.position.array as Float32Array;
    for (let i = 0; i < NN; i++) {
      const n = nodes[i];
      n.p.x = n.base.x + Math.sin(t * 0.4 + n.ph) * 0.12;
      n.p.y = n.base.y + Math.cos(t * 0.5 + n.ph) * 0.12;
      npa[i * 3] = n.p.x; npa[i * 3 + 1] = n.p.y; npa[i * 3 + 2] = n.p.z;
      la[i * 6] = 0; la[i * 6 + 1] = 0; la[i * 6 + 2] = 0;
      la[i * 6 + 3] = n.p.x; la[i * 6 + 4] = n.p.y; la[i * 6 + 5] = n.p.z;
    }
    ng.attributes.position.needsUpdate = true;
    lg.attributes.position.needsUpdate = true;
    pulses.forEach((pl) => {
      const k = (t * pl.spd + pl.off) % 1;
      const n = nodes[pl.node].p;
      pl.s.position.set(n.x * k, n.y * k, n.z * k);
      pl.s.material.opacity = Math.sin(k * Math.PI) * 0.95;
    });
  };
}

// ---- PartnerControlMap : payment flows ----
function buildFlows(H: H) {
  const { THREE, scene, camera, root, colors, glow } = H;
  scene.fog = new THREE.FogExp2(colors.fog, 0.06);
  camera.position.set(0, 0.4, 8);
  root.add(dust(H, 80, 6, 0.4));
  root.rotation.x = 0.12;
  const accent = new THREE.Color(colors.accent);
  const bright = new THREE.Color(colors.bright);
  const accent2 = new THREE.Color(colors.accent2);

  const lanes = 5;
  const laneGroup = new THREE.Group(); root.add(laneGroup);
  const flows: { curve: InstanceType<THREENS["CatmullRomCurve3"]>; packets: { s: InstanceType<THREENS["Sprite"]>; off: number }[]; spd: number }[] = [];
  for (let i = 0; i < lanes; i++) {
    const y = (i - (lanes - 1) / 2) * 0.9;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-3.6, y, 0),
      new THREE.Vector3(-1.2, y + rand(-0.3, 0.3), rand(-0.4, 0.4)),
      new THREE.Vector3(1.2, y + rand(-0.3, 0.3), rand(-0.4, 0.4)),
      new THREE.Vector3(3.6, y, 0),
    ]);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.012, 6, false), new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending }));
    laneGroup.add(tube);
    [-3.6, 3.6].forEach((xx) => {
      const node = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.26), new THREE.MeshBasicMaterial({ color: colors.scene1 }));
      node.position.set(xx, y, 0);
      node.add(new THREE.LineSegments(new THREE.EdgesGeometry(node.geometry), new THREE.LineBasicMaterial({ color: bright, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending })));
      laneGroup.add(node);
    });
    const packets: { s: InstanceType<THREENS["Sprite"]>; off: number }[] = [];
    for (let j = 0; j < 3; j++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: i % 2 ? accent2 : bright, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }));
      s.scale.set(0.28, 0.28, 1); laneGroup.add(s);
      packets.push({ s, off: j / 3 + rand(0, 0.1) });
    }
    flows.push({ curve, packets, spd: rand(0.12, 0.2) });
  }

  return (t: number) => {
    flows.forEach((f) => {
      f.packets.forEach((pk) => {
        const k = (t * f.spd + pk.off) % 1;
        const p = f.curve.getPoint(k);
        pk.s.position.copy(p);
        pk.s.material.opacity = Math.min(1, Math.sin(k * Math.PI) * 1.3) * 0.95;
      });
    });
    laneGroup.position.y = Math.sin(t * 0.4) * 0.05;
  };
}

// ---- Controls Reference Library : monolith ----
function buildMonolith(H: H) {
  const { THREE, scene, camera, root, colors, glow } = H;
  scene.fog = new THREE.FogExp2(colors.fog, 0.07);
  camera.position.set(0, 0.3, 8);
  root.add(dust(H, 70, 6, 0.38));
  const bright = new THREE.Color(colors.bright);
  const accent = new THREE.Color(colors.accent);

  const stack = new THREE.Group(); root.add(stack);
  const SL = 5;
  for (let i = 0; i < SL; i++) {
    const w = 2.0 - i * 0.12;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 0.34, 1.1), new THREE.MeshBasicMaterial({ color: colors.scene1, transparent: true, opacity: 0.92 }));
    slab.position.y = (i - (SL - 1) / 2) * 0.5;
    slab.rotation.y = 0.5 + i * 0.02;
    slab.add(new THREE.LineSegments(new THREE.EdgesGeometry(slab.geometry), new THREE.LineBasicMaterial({ color: i === 2 ? bright : accent, transparent: true, opacity: i === 2 ? 0.9 : 0.5, blending: THREE.AdditiveBlending })));
    slab.userData = { phase: i * 0.5 };
    stack.add(slab);
  }
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 24), new THREE.MeshBasicMaterial({ color: bright }));
  const orbHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: accent, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
  orbHalo.scale.set(1.7, 1.7, 1); orb.add(orbHalo);
  orb.position.set(1.7, 1.4, 0.6); root.add(orb);

  return (t: number) => {
    stack.children.forEach((s: InstanceType<THREENS["Object3D"]>, i: number) => {
      s.position.x = Math.sin(t * 0.5 + s.userData.phase) * 0.12;
      s.rotation.y = 0.5 + i * 0.02 + Math.sin(t * 0.3) * 0.06;
    });
    stack.rotation.y = Math.sin(t * 0.18) * 0.12;
    orb.position.y = 1.4 + Math.sin(t * 1.1) * 0.18;
    orbHalo.material.opacity = 0.7 + Math.sin(t * 1.6) * 0.2;
  };
}

// ---- closing CTA ambient field ----
function buildCTAField(H: H) {
  const { THREE, scene, camera, root, colors, glow } = H;
  scene.fog = new THREE.FogExp2(colors.fog, 0.05);
  camera.position.set(0, 0, 9);
  const accent = new THREE.Color(colors.accent);
  const field = dust(H, 200, 9, 0.5); root.add(field);
  const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: accent, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
  glowSprite.scale.set(10, 7, 1); glowSprite.position.z = -3; root.add(glowSprite);
  return (t: number) => {
    field.rotation.y = t * 0.04;
    field.rotation.x = Math.sin(t * 0.1) * 0.1;
    glowSprite.material.opacity = 0.28 + Math.sin(t * 0.8) * 0.08;
  };
}

const BUILDERS: Record<InstrumentVariant, (H: H) => (t: number) => void> = {
  lattice: buildLattice,
  constellation: buildConstellation,
  flows: buildFlows,
  monolith: buildMonolith,
  cta: buildCTAField,
};

/** Mounts the instrument on `canvas`; returns a cleanup fn. */
export async function runInstrument(canvas: HTMLCanvasElement, variant: InstrumentVariant): Promise<() => void> {
  const THREE = await import("three");
  const parent = canvas.parentElement || canvas;
  const REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0, 6);
  const root = new THREE.Group();
  scene.add(root);

  const glow = glowTexture(THREE);
  const H = { THREE, scene, camera, root, colors: COLORS, glow, glowTexture: () => glow };
  const update = BUILDERS[variant](H);

  let t = 0, last = 0, running = false, rafId = 0;
  const ptr = { x: 0, y: 0 }, ptrS = { x: 0, y: 0 };
  const parallax = variant === "cta" ? 0.12 : 0.35;

  function resize() {
    const w = parent.clientWidth || 1, h = parent.clientHeight || 1;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (!running) renderer.render(scene, camera);
  }
  function frame(now: number) {
    if (!running) return;
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.05) dt = 0.05;
    if (!REDUCED) t += dt;
    ptrS.x += (ptr.x - ptrS.x) * 0.06;
    ptrS.y += (ptr.y - ptrS.y) * 0.06;
    root.rotation.y = ptrS.x * parallax * 0.5;
    root.rotation.x = -ptrS.y * parallax * 0.32;
    update(t);
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(frame);
  }
  function start() { if (running) return; running = true; last = performance.now(); rafId = requestAnimationFrame(frame); }
  function stop() { running = false; if (rafId) cancelAnimationFrame(rafId); }

  resize();
  renderer.render(scene, camera);

  const ro = new ResizeObserver(() => resize());
  ro.observe(parent);
  const io = new IntersectionObserver((es) => {
    if (es[0].isIntersecting) { if (!REDUCED) start(); }
    else stop();
  }, { threshold: 0.04 });
  io.observe(parent);
  const onPointer = (e: PointerEvent) => {
    const r = parent.getBoundingClientRect();
    ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ptr.y = ((e.clientY - r.top) / r.height) * 2 - 1;
  };
  const onLeave = () => { ptr.x = 0; ptr.y = 0; };
  const onVisibility = () => { if (document.hidden) stop(); };
  if (!REDUCED) {
    parent.addEventListener("pointermove", onPointer);
    parent.addEventListener("pointerleave", onLeave);
  }
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    stop();
    ro.disconnect();
    io.disconnect();
    parent.removeEventListener("pointermove", onPointer);
    parent.removeEventListener("pointerleave", onLeave);
    document.removeEventListener("visibilitychange", onVisibility);
    // dispose every GPU resource the builder allocated
    scene.traverse((o: H) => {
      if (o.geometry) o.geometry.dispose();
      const m = o.material;
      if (Array.isArray(m)) m.forEach((x: H) => x.dispose());
      else if (m) m.dispose();
    });
    glow.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  };
}

"use client";

import { useEffect, useRef } from "react";

/**
 * The unified "Deep Field": a persistent full-viewport 3D substrate behind
 * every page: a constellation of nodes + neighbour links + drifting motes that
 * reacts to scroll (drift) and pointer (parallax). Theme-aware: faint dark-teal
 * on light, glowing accent on dark. Ported from the design's ambient-scene.js.
 */
export default function FieldBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      const THREE = await import("three");
      if (disposed || !canvas) return;

      const REDUCED =
        typeof window !== "undefined" &&
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const PAL = { accent: 0x12a06a, bright: 0x2fe39a, deep: 0x0a6b46 };
      const NN = 48;
      const LINK = 3.0;
      const MOTES = 110;
      const rand = (a: number, b: number) => a + Math.random() * (b - a);

      // shared radial glow sprite
      const tex = (() => {
        const s = 128;
        const c = document.createElement("canvas");
        c.width = c.height = s;
        const x = c.getContext("2d")!;
        const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
        g.addColorStop(0, "rgba(255,255,255,1)");
        g.addColorStop(0.2, "rgba(255,255,255,0.8)");
        g.addColorStop(0.5, "rgba(255,255,255,0.18)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        x.fillStyle = g;
        x.fillRect(0, 0, s, s);
        return new THREE.CanvasTexture(c);
      })();

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
      renderer.setClearColor(0x000000, 0);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
      camera.position.set(0, 0, 11);
      const root = new THREE.Group();
      scene.add(root);

      const ptr = { x: 0, y: 0 };
      const ptrS = { x: 0, y: 0 };
      let scrollNorm = 0;
      let scrollS = 0;
      let t = 0;
      let last = 0;
      let running = false;
      let rafId = 0;

      type Node = { base: InstanceType<typeof THREE.Vector3>; p: InstanceType<typeof THREE.Vector3>; ph: number };
      let nodes: Node[] = [];
      /* eslint-disable @typescript-eslint/no-explicit-any */
      let nodeGeo: any;
      let lineGeo: any;
      let lineSegs: [number, number][] = [];
      let motes: any;
      /* eslint-enable @typescript-eslint/no-explicit-any */

      function currentTheme(): "light" | "dark" {
        return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
      }

      function colors() {
        const light = currentTheme() !== "dark";
        return {
          light,
          node: new THREE.Color(light ? PAL.accent : PAL.bright),
          line: new THREE.Color(light ? PAL.deep : PAL.accent),
          mote: new THREE.Color(light ? PAL.accent : PAL.bright),
          blend: light ? THREE.NormalBlending : THREE.AdditiveBlending,
          nodeOpacity: light ? 0.36 : 0.85,
          lineOpacity: light ? 0.14 : 0.2,
          moteOpacity: light ? 0.24 : 0.5,
          nodeSize: light ? 0.2 : 0.26,
        };
      }

      function build() {
        const C = colors();
        nodes = [];
        const npos = new Float32Array(NN * 3);
        for (let i = 0; i < NN; i++) {
          const p = new THREE.Vector3(rand(-9, 9), rand(-14, 14), rand(-7, 1));
          nodes.push({ base: p.clone(), p, ph: rand(0, 6.28) });
          npos[i * 3] = p.x; npos[i * 3 + 1] = p.y; npos[i * 3 + 2] = p.z;
        }
        nodeGeo = new THREE.BufferGeometry();
        nodeGeo.setAttribute("position", new THREE.BufferAttribute(npos, 3));
        root.add(new THREE.Points(nodeGeo, new THREE.PointsMaterial({
          size: C.nodeSize, map: tex, color: C.node, transparent: true,
          opacity: C.nodeOpacity, depthWrite: false, blending: C.blend,
        })));

        const segs: [number, number][] = [];
        for (let i = 0; i < NN; i++)
          for (let j = i + 1; j < NN; j++)
            if (nodes[i].base.distanceTo(nodes[j].base) < LINK) segs.push([i, j]);
        lineSegs = segs;
        const lpos = new Float32Array(segs.length * 6);
        lineGeo = new THREE.BufferGeometry();
        lineGeo.setAttribute("position", new THREE.BufferAttribute(lpos, 3));
        root.add(new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({
          color: C.line, transparent: true, opacity: C.lineOpacity, depthWrite: false, blending: C.blend,
        })));

        const mpos = new Float32Array(MOTES * 3);
        for (let i = 0; i < MOTES; i++) {
          mpos[i * 3] = rand(-11, 11); mpos[i * 3 + 1] = rand(-15, 15); mpos[i * 3 + 2] = rand(-8, 2);
        }
        const mg = new THREE.BufferGeometry();
        mg.setAttribute("position", new THREE.BufferAttribute(mpos, 3));
        motes = new THREE.Points(mg, new THREE.PointsMaterial({
          size: C.light ? 0.07 : 0.06, map: tex, color: C.mote, transparent: true,
          opacity: C.moteOpacity, depthWrite: false, blending: C.blend,
        }));
        root.add(motes);
      }

      function clearRoot() {
        for (let i = root.children.length - 1; i >= 0; i--) {
          const o = root.children[i] as InstanceType<typeof THREE.Mesh>;
          root.remove(o);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const oo = o as any;
          if (oo.geometry) oo.geometry.dispose();
          if (oo.material) oo.material.dispose();
        }
      }

      function resize() {
        const w = window.innerWidth, h = window.innerHeight;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }

      function frame(now: number) {
        if (!running) return;
        let dt = (now - last) / 1000; last = now;
        if (dt > 0.05) dt = 0.05;
        if (!REDUCED) t += dt;

        ptrS.x += (ptr.x - ptrS.x) * 0.04;
        ptrS.y += (ptr.y - ptrS.y) * 0.04;
        scrollS += (scrollNorm - scrollS) * 0.06;

        root.position.y = scrollS * 9;
        root.rotation.y = ptrS.x * 0.18 + Math.sin(t * 0.05) * 0.04;
        root.rotation.x = -ptrS.y * 0.1;

        const npa = nodeGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < NN; i++) {
          const n = nodes[i];
          n.p.x = n.base.x + Math.sin(t * 0.18 + n.ph) * 0.5;
          n.p.y = n.base.y + Math.cos(t * 0.15 + n.ph) * 0.5;
          n.p.z = n.base.z + Math.sin(t * 0.2 + n.ph) * 0.4;
          npa[i * 3] = n.p.x; npa[i * 3 + 1] = n.p.y; npa[i * 3 + 2] = n.p.z;
        }
        nodeGeo.attributes.position.needsUpdate = true;

        const la = lineGeo.attributes.position.array as Float32Array;
        const segs = lineSegs;
        for (let s = 0; s < segs.length; s++) {
          const a = nodes[segs[s][0]].p, b = nodes[segs[s][1]].p;
          la[s * 6] = a.x; la[s * 6 + 1] = a.y; la[s * 6 + 2] = a.z;
          la[s * 6 + 3] = b.x; la[s * 6 + 4] = b.y; la[s * 6 + 5] = b.z;
        }
        lineGeo.attributes.position.needsUpdate = true;
        motes.rotation.y = t * 0.02;

        renderer.render(scene, camera);
        rafId = requestAnimationFrame(frame);
      }

      function start() { if (running) return; running = true; last = performance.now(); rafId = requestAnimationFrame(frame); }
      function stop() { running = false; if (rafId) cancelAnimationFrame(rafId); }

      resize();
      build();
      renderer.render(scene, camera);

      const onResize = () => resize();
      const onScroll = () => {
        const max = document.documentElement.scrollHeight - window.innerHeight || 1;
        scrollNorm = Math.min(1, Math.max(0, window.scrollY / max));
      };
      const onPointer = (e: PointerEvent) => {
        ptr.x = (e.clientX / window.innerWidth) * 2 - 1;
        ptr.y = (e.clientY / window.innerHeight) * 2 - 1;
      };
      const onVisibility = () => { if (document.hidden) stop(); else if (!REDUCED) start(); };

      window.addEventListener("resize", onResize, { passive: true });
      window.addEventListener("scroll", onScroll, { passive: true });
      if (!REDUCED) window.addEventListener("pointermove", onPointer, { passive: true });
      document.addEventListener("visibilitychange", onVisibility);

      // rebuild colors when the theme attribute flips
      const themeObserver = new MutationObserver(() => { clearRoot(); build(); if (!running && !REDUCED) start(); else renderer.render(scene, camera); });
      themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

      if (!REDUCED) start();

      cleanup = () => {
        stop();
        window.removeEventListener("resize", onResize);
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("pointermove", onPointer);
        document.removeEventListener("visibilitychange", onVisibility);
        themeObserver.disconnect();
        clearRoot();
        tex.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
      };
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  return (
    <>
      <div className="field-bg" aria-hidden="true" />
      <canvas id="ambientCanvas" ref={canvasRef} aria-hidden="true" />
      <div className="field-grid" aria-hidden="true" />
    </>
  );
}

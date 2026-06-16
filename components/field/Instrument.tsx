"use client";

import { useEffect, useRef } from "react";
import { runInstrument, type InstrumentVariant } from "./instruments";

/**
 * Mounts a restrained "precision instrument" three.js scene on a free-floating
 * canvas (no frame). The WebGL context is created lazily, only when the scene
 * scrolls near the viewport, so off-screen tool sections don't hold contexts.
 */
export default function Instrument({
  variant,
  className,
}: {
  variant: InstrumentVariant;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const target = canvas.parentElement ?? canvas;

    let disposed = false;
    let started = false;
    let cleanup: (() => void) | undefined;

    const mount = () => {
      if (started || disposed) return;
      started = true;
      runInstrument(canvas, variant).then((c) => {
        if (disposed) c();
        else cleanup = c;
      });
    };

    let io: IntersectionObserver | undefined;
    if (typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            mount();
            io?.disconnect();
          }
        },
        { rootMargin: "400px" }
      );
      io.observe(target);
    } else {
      mount();
    }

    return () => {
      disposed = true;
      io?.disconnect();
      cleanup?.();
    };
  }, [variant]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}

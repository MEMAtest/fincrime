"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

type DeferredRenderMode = "visible" | "idle";

type DeferredRenderProps = {
  children: ReactNode;
  fallback?: ReactNode;
  className?: string;
  idleTimeoutMs?: number;
  mode?: DeferredRenderMode;
  rootMargin?: string;
};

/**
 * Defers rendering of heavy children (e.g. WebGL canvases) until the browser
 * is idle or the container scrolls near the viewport. Keeps first paint fast.
 */
export function DeferredRender({
  children,
  fallback = null,
  className,
  idleTimeoutMs = 1200,
  mode = "visible",
  rootMargin = "240px",
}: DeferredRenderProps) {
  const [shouldRender, setShouldRender] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (mode !== "idle") return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let idleId: number | null = null;

    const schedule = () => setShouldRender(true);

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(schedule, { timeout: idleTimeoutMs });
    } else {
      timeoutId = setTimeout(schedule, idleTimeoutMs);
    }

    return () => {
      if (idleId !== null && typeof window !== "undefined" && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [idleTimeoutMs, mode]);

  useEffect(() => {
    if (mode !== "visible") return;
    const node = containerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldRender(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [mode, rootMargin]);

  return (
    <div ref={containerRef} className={className}>
      {shouldRender ? children : fallback}
    </div>
  );
}

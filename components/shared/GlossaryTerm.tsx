"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import SourceBadge from "./SourceBadge";
import { glossaryLookup } from "@/data/glossary";

/**
 * Inline glossary term: a dotted-underlined word that opens a small popover with
 * a plain-English definition + optional cited source (via SourceBadge, no
 * link-out). Keyboard-accessible; portals to body to escape card overflow.
 */
export default function GlossaryTerm({ term, children }: { term: string; children?: React.ReactNode }) {
  const entry = glossaryLookup(term);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onScroll = () => setOpen(false);
    // Dismiss on a tap/click outside the term or its popover (so touch users,
    // who get no mouseleave/blur, can close it).
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !popRef.current?.contains(t)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  // Clear any pending close timer on unmount.
  useEffect(() => () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
  }, []);

  if (!entry) return <>{children ?? term}</>;

  const cancelClose = () => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), 150);
  };
  const measure = () => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const left = Math.min(r.left + window.scrollX, window.scrollX + window.innerWidth - 276);
    setPos({ top: r.bottom + window.scrollY + 6, left: Math.max(8, left) });
  };
  const show = () => {
    cancelClose();
    measure();
    setOpen(true);
  };
  const toggle = () => {
    if (open) setOpen(false);
    else show();
  };

  return (
    <>
      <span
        ref={ref}
        tabIndex={0}
        role="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
        onMouseEnter={show}
        onMouseLeave={scheduleClose}
        onFocus={show}
        onBlur={scheduleClose}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          }
        }}
        className="underline decoration-dotted decoration-accent/60 underline-offset-2 cursor-help"
      >
        {children ?? entry.term}
      </span>
      {open && pos && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popRef}
            role="dialog"
            aria-label={`${entry.term} definition`}
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
            className="absolute z-[120] w-64 rounded-xl border border-slate-200 bg-white shadow-xl p-3 text-left"
            style={{ top: pos.top, left: pos.left }}
          >
            <p className="text-xs font-semibold text-slate-900">{entry.term}</p>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">{entry.short}</p>
            {entry.source && (
              <div className="mt-2">
                <SourceBadge source={entry.source.org} reference={entry.source.reference} url={entry.source.url} title={entry.source.title} />
              </div>
            )}
            <Link href={`/glossary#${entry.slug}`} className="mt-2 inline-block text-[11px] text-accent hover:underline">
              Full glossary
            </Link>
          </div>,
          document.body
        )}
    </>
  );
}

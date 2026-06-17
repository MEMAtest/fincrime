"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Copy, Check, ExternalLink } from "lucide-react";

/**
 * A reference that does NOT navigate off-site. Renders a link-styled control
 * that opens an on-page modal showing the source and a copyable URL, honouring
 * the "don't link out of the site at all" rule (same pattern as SourceBadge).
 */
interface ReferenceLinkProps {
  url: string;
  /** Visible text on the control. */
  label: string;
  /** Modal heading (defaults to label). */
  heading?: string;
  /** Class names to match the call site's existing styling. */
  className?: string;
  /** Show the small reference glyph next to the label. */
  showIcon?: boolean;
}

export default function ReferenceLink({ url, label, heading, className, showIcon }: ReferenceLinkProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const openModal = () => {
    setCopied(false);
    setOpen(true);
  };

  const copyReference = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const modal = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label={`${heading ?? label} reference`}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 px-5 py-4 border-b border-slate-100">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-900">{heading ?? label}</div>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Source reference</div>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600">
                {url}
              </code>
              <button
                onClick={copyReference}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-400">
            Reference for guidance. Verify against the cited source before relying on it.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <span
        role="button"
        tabIndex={0}
        onClick={openModal}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openModal();
          }
        }}
        className={`cursor-pointer ${className ?? ""}`}
        aria-haspopup="dialog"
      >
        {label}
        {showIcon && <ExternalLink className="h-3 w-3 opacity-70" />}
      </span>
      {open && typeof document !== "undefined" && createPortal(modal, document.body)}
    </>
  );
}

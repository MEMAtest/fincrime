"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Copy, Check, type LucideIcon } from "lucide-react";
import { pushReferenceModal, popReferenceModal } from "@/lib/modal-registry";

interface ReferenceModalProps {
  open: boolean;
  onClose: () => void;
  heading: string;
  subheading?: string;
  icon?: LucideIcon;
  iconClass?: string;
  provision?: string;
  url?: string;
}

export default function ReferenceModal({
  open,
  onClose,
  heading,
  subheading,
  icon: Icon,
  iconClass,
  provision,
  url,
}: ReferenceModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear copied state when the modal closes
      setCopied(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    pushReferenceModal();
    return () => {
      window.removeEventListener("keydown", onKey);
      popReferenceModal();
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const copyReference = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${heading} reference`}
    >
      <div
        className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-[var(--line-2)] bg-[var(--bg-1)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 px-5 py-4 border-b border-[var(--line)]">
          {Icon && (
            <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${iconClass ?? ""}`}>
              <Icon className="h-4 w-4" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-foreground">{heading}</div>
            {subheading && <div className="text-xs text-text-muted mt-0.5">{subheading}</div>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-lg p-1 text-text-muted hover:bg-surface hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {provision && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Provision</div>
              <div className="mt-1 text-sm text-ink-soft">{provision}</div>
            </div>
          )}
          {url && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Official source reference</div>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 truncate rounded-lg bg-surface border border-[var(--line)] px-2.5 py-1.5 text-xs text-muted font-mono">
                  {url}
                </code>
                <button
                  onClick={copyReference}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--line-2)] bg-surface px-2.5 py-1.5 text-xs font-medium text-ink-soft hover:text-foreground hover:border-[var(--line-bright)] transition-colors"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          )}
          <p className="text-[11px] leading-relaxed text-text-muted">
            Reference summary for guidance. Verify the exact wording against the cited source before relying on it.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}

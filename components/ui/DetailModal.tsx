"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, type LucideIcon } from "lucide-react";
import { isReferenceModalOpen } from "@/lib/modal-registry";

type Size = "md" | "lg" | "xl";
const MAX_W: Record<Size, string> = {
  md: "sm:max-w-lg",
  lg: "sm:max-w-3xl",
  xl: "sm:max-w-5xl",
};

/**
 * The shared drill-in modal for detail content (typology / control / risk). It is
 * a proper dialog: portal to body, escape + click-outside to close, body
 * scroll-lock, focus into the panel on open and focus restore on close, a header
 * (icon + title + subtitle + optional actions + close) and a scrollable body
 * (max-h on desktop, full-screen sheet on mobile). Sits at z-[90] so an in-site
 * ReferenceModal (z-[100], opened by SourceBadge inside the content) stacks above
 * it; Escape is ignored while such a reference modal is open.
 */
export default function DetailModal({
  open,
  onClose,
  title,
  subtitle,
  icon: Icon,
  iconClass,
  size = "lg",
  headerRight,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  iconClass?: string;
  size?: Size;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Keep onClose in a ref so the setup effect depends only on `open`; otherwise a
  // parent re-render passing a fresh inline onClose would tear down and re-run
  // the effect, yanking focus out of the dialog (e.g. while adding controls).
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    if (!open) return;
    const prevActive = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isReferenceModalOpen()) onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    // Focus the panel so keyboard users land inside the dialog.
    panelRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prevActive?.focus?.();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex sm:items-center sm:justify-center sm:p-4 bg-slate-900/50 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`flex flex-col w-full ${MAX_W[size]} bg-background sm:rounded-2xl border border-surface-border shadow-2xl outline-none max-h-screen sm:max-h-[85vh] h-full sm:h-auto`}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-5 py-4 border-b border-surface-border shrink-0">
          {Icon && (
            <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconClass ?? "bg-accent/10 text-accent"}`}>
              <Icon className="h-4 w-4" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-foreground leading-tight">{title}</h2>
            {subtitle && <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>}
          </div>
          {headerRight}
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-lg p-1.5 text-text-muted hover:bg-surface-hover hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {/* Scrollable body */}
        <div className="overflow-y-auto px-5 py-5 flex-1">{children}</div>
      </div>
    </div>,
    document.body
  );
}

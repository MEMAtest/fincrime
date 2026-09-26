"use client";

/**
 * In-page confirm modal for a destructive drafter action (prod walkthrough
 * item 5: delete actions must confirm in-page, never window.confirm).
 */
export default function ConfirmDialog({
  title,
  description,
  confirmLabel = "Delete",
  busy = false,
  error,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: string;
  confirmLabel?: string;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
      <div className="glass-card w-full max-w-md rounded-2xl p-6 space-y-4 bg-surface">
        <h2 id="confirm-dialog-title" className="text-lg font-semibold text-foreground">
          {title}
        </h2>
        <p className="text-sm text-text-muted whitespace-pre-line">{description}</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button className="px-3 py-1.5 rounded border border-border text-sm" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            className="px-3 py-1.5 rounded bg-red-700 text-white text-sm disabled:opacity-50"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

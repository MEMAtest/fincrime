/**
 * Shared file-upload allowlist for evidence attachments (control tests,
 * incidents, readiness, regulatory response - see the Phase 7 brief). Kept
 * as a small, explicit allowlist rather than a deny-list: an evidence
 * attachment is meant to be a working paper, a screenshot, a sample export
 * or a sign-off, never an executable or a script.
 */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "text/csv": "csv",
  "application/vnd.ms-excel": "csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
};

export function isAllowedContentType(contentType: string): boolean {
  return contentType in ALLOWED_CONTENT_TYPES;
}

/** Human-readable list for error messages, e.g. "pdf, png, jpg, csv, xlsx, docx, txt". */
export const ALLOWED_EXTENSIONS_LABEL = Array.from(new Set(Object.values(ALLOWED_CONTENT_TYPES))).join(", ");

/**
 * Sanitises a client-supplied filename for use in a storage pathname and for
 * display: strips path separators (a filename must never be interpreted as
 * a path), collapses anything outside a safe character set, and caps
 * length. Never trust the browser-supplied File#name as a path component.
 */
export function sanitiseFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() || "file";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 150);
  return cleaned || "file";
}

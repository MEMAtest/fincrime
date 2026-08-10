/**
 * Shared file-upload allowlist for evidence attachments (control tests,
 * incidents, readiness, regulatory response - see the Phase 7 brief). Kept
 * as a small, explicit allowlist rather than a deny-list: an evidence
 * attachment is meant to be a working paper, a screenshot, a sample export
 * or a sign-off, never an executable or a script.
 */
/**
 * 4 MB, deliberately under Vercel's serverless request body limit of about
 * 4.5 MB. A larger cap is not enforceable here: the platform rejects the
 * request with a 413 at the edge before this route ever runs, so the user
 * would see an opaque platform error instead of our message. Proved against
 * production, where a 5 MB upload returned 413 rather than our 400. Raising
 * this beyond the platform limit would require the client-upload flow, which
 * sends the file straight to blob storage and bypasses the function body.
 */
export const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024;
export const MAX_FILE_SIZE_LABEL = "4MB";

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

const MAX_FILENAME_LENGTH = 150;
/** An extension longer than this (dot included) is treated as "not really an extension" - e.g. a dotfile or a long trailing sentence with a period in it - so it gets swept into the truncated stem rather than preserved. */
const MAX_EXTENSION_LENGTH = 11;

/**
 * Sanitises a client-supplied filename for use in a storage pathname and for
 * display: strips path separators (a filename must never be interpreted as
 * a path), collapses anything outside a safe character set, and caps
 * length. Never trust the browser-supplied File#name as a path component.
 * Preserves the extension when truncating a long name - a name over 150
 * chars must not lose its `.pdf`/`.docx`/etc, since that is what tells a
 * later download the file's type.
 */
export function sanitiseFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() || "file";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_");
  if (cleaned.length <= MAX_FILENAME_LENGTH) return cleaned || "file";

  const dotIndex = cleaned.lastIndexOf(".");
  const extLength = dotIndex > 0 ? cleaned.length - dotIndex : Infinity;
  if (dotIndex > 0 && extLength <= MAX_EXTENSION_LENGTH) {
    const ext = cleaned.slice(dotIndex);
    const stem = cleaned.slice(0, Math.max(1, MAX_FILENAME_LENGTH - ext.length));
    return `${stem}${ext}`;
  }
  return cleaned.slice(0, MAX_FILENAME_LENGTH) || "file";
}

function startsWithBytes(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (bytes[i] !== signature[i]) return false;
  }
  return true;
}

/**
 * Sniffs the leading magic bytes of an uploaded file's content against the
 * content type the client declared, so isAllowedContentType's allowlist
 * means what it says rather than trusting a client-controlled
 * `Content-Type`/`File#type` string alone. csv and plain text have no
 * reliable magic number and are not sniffed - any bytes are accepted for
 * those two, same as before this check existed. xlsx and docx are both
 * zip-based Office Open XML containers, so both are checked against the
 * zip local-file-header signature.
 */
export function contentTypeMatchesMagicBytes(contentType: string, bytes: Uint8Array): boolean {
  const kind = ALLOWED_CONTENT_TYPES[contentType];
  if (!kind) return false;
  switch (kind) {
    case "pdf":
      return startsWithBytes(bytes, [0x25, 0x50, 0x44, 0x46]); // "%PDF"
    case "png":
      return startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "jpg":
      return startsWithBytes(bytes, [0xff, 0xd8, 0xff]);
    case "xlsx":
    case "docx":
      return (
        startsWithBytes(bytes, [0x50, 0x4b, 0x03, 0x04]) || // normal zip entry
        startsWithBytes(bytes, [0x50, 0x4b, 0x05, 0x06]) // empty zip archive
      );
    default:
      return true;
  }
}

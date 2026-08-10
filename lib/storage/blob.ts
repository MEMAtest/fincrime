import { put, del, get } from "@vercel/blob";

/**
 * Thin wrapper over @vercel/blob for evidence file uploads. The app is
 * deployed on Vercel, so Vercel Blob is the natural choice: no new
 * infrastructure to provision, and the SDK reads its token from
 * BLOB_READ_WRITE_TOKEN automatically.
 *
 * A local dev environment (or a preview deploy) may not have that token
 * set - `isBlobConfigured()` is the single source of truth every caller
 * (the upload route, GET /api/workspace/me's fileUploadEnabled flag, and
 * the evidence UI's "file upload disabled" messaging) checks before
 * attempting a file operation, so a missing token degrades to "file upload
 * is disabled, link-only evidence still works" rather than a 500 or a
 * crashed page.
 */
export function isBlobConfigured(): boolean {
  return Boolean((process.env.BLOB_READ_WRITE_TOKEN || "").trim());
}

export interface UploadedBlob {
  url: string;
  pathname: string;
}

/**
 * Uploads a file's bytes under a workspace- and evidence-scoped pathname.
 * `addRandomSuffix: true` avoids collisions when the same filename is
 * uploaded twice for the same evidence row (e.g. a replaced attachment).
 * Callers must check isBlobConfigured() first; this throws if the token is
 * absent rather than silently no-op-ing, so a caller that forgot the check
 * fails loudly in dev rather than pretending to succeed.
 *
 * `access: "private"` deliberately: a store holding KYC samples and working
 * papers must not have a permanent, unexpiring, unauthenticated bearer URL
 * (the previous `access: "public"` shape) - the blob's URL is meaningless
 * on its own now, and is only ever resolved back to bytes via
 * getEvidenceFileStream, itself only reachable through the authenticated
 * GET /api/evidence/[id]/file route below.
 */
export async function uploadEvidenceFile(
  workspaceId: string,
  evidenceId: string,
  fileName: string,
  data: Buffer,
  contentType: string
): Promise<UploadedBlob> {
  if (!isBlobConfigured()) {
    throw new Error("Blob storage is not configured (BLOB_READ_WRITE_TOKEN missing)");
  }
  const pathname = `evidence/${workspaceId}/${evidenceId}/${fileName}`;
  const blob = await put(pathname, data, {
    access: "private",
    contentType,
    addRandomSuffix: true,
  });
  return { url: blob.url, pathname: blob.pathname };
}

export interface EvidenceFileStream {
  stream: ReadableStream<Uint8Array>;
  contentType: string | null;
  size: number | null;
}

/**
 * Streams a private blob's bytes back through this app rather than handing
 * out a URL: the ONLY caller is GET /api/evidence/[id]/file, which has
 * already verified the requesting workspace owns the evidence row. Returns
 * null if the blob has been deleted out from under a still-referencing
 * evidence row (best-effort deletes elsewhere in this module mean that is
 * possible, if rare).
 */
export async function getEvidenceFileStream(url: string): Promise<EvidenceFileStream | null> {
  if (!isBlobConfigured()) return null;
  const result = await get(url, { access: "private" });
  if (!result || !result.stream) return null;
  return { stream: result.stream, contentType: result.blob.contentType, size: result.blob.size };
}

/**
 * Best-effort delete: called when an evidence row's file is replaced or the
 * row itself is deleted. Never throws - a stray orphaned blob is a much
 * smaller problem than a 500 on an otherwise-successful evidence mutation,
 * and the caller logs the failure so it is at least visible.
 */
export async function deleteEvidenceFileBestEffort(url: string): Promise<void> {
  if (!isBlobConfigured()) return;
  try {
    await del(url);
  } catch (error) {
    console.error("Best-effort blob delete failed:", error);
  }
}

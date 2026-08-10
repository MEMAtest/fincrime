import { put, del } from "@vercel/blob";

/**
 * Thin wrapper over @vercel/blob for evidence file uploads. The app is
 * deployed on Vercel, so Vercel Blob is the natural choice: no new
 * infrastructure to provision, and the SDK reads its token from
 * BLOB_READ_WRITE_TOKEN automatically.
 *
 * A local dev environment (or a preview deploy) may not have that token
 * set - `isBlobConfigured()` is the single source of truth every caller
 * (the upload route, and the Settings/evidence UI's "file upload disabled"
 * messaging) checks before attempting a file operation, so a missing token
 * degrades to "file upload is disabled, link-only evidence still works"
 * rather than a 500 or a crashed page.
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
    access: "public",
    contentType,
    addRandomSuffix: true,
  });
  return { url: blob.url, pathname: blob.pathname };
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

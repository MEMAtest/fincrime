import JSZip from "jszip";

/**
 * Both .xlsx and .docx are zip containers. ExcelJS and mammoth both fully
 * inflate every entry before this app gets to look at the result, so a
 * small, well-formed zip with a very high compression ratio (a "zip bomb")
 * can exhaust server memory/CPU well before the 50MB compressed-upload cap
 * (see bounded-stream.ts) is anywhere near hit. This inspects the zip's
 * central directory ONLY - entry count and each entry's declared
 * uncompressed size - without inflating a single byte, and rejects before
 * the buffer is ever handed to ExcelJS/mammoth.
 *
 * Limits are deliberately generous for a real register/PRA document (a few
 * MB uncompressed, a few dozen internal XML parts) while still bounding the
 * worst case a compressed upload within the existing 50MB cap could expand
 * to.
 */
export const MAX_ZIP_ENTRIES = 10_000;
export const MAX_ZIP_UNCOMPRESSED_BYTES = 200 * 1024 * 1024; // 200MB

export interface ZipGuardOk {
  ok: true;
}
export interface ZipGuardRejected {
  ok: false;
  reason: string;
}

export async function guardZipBounds(buffer: Buffer): Promise<ZipGuardOk | ZipGuardRejected> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer, { checkCRC32: false });
  } catch (error) {
    return { ok: false, reason: `Could not read this file as a zip archive: ${error instanceof Error ? error.message : "unknown error"}` };
  }

  let entryCount = 0;
  let totalUncompressed = 0;
  let rejected: ZipGuardRejected | null = null;

  zip.forEach((_path, file) => {
    if (rejected) return;
    entryCount++;
    if (entryCount > MAX_ZIP_ENTRIES) {
      rejected = { ok: false, reason: `This file contains more than ${MAX_ZIP_ENTRIES.toLocaleString()} internal entries - it cannot be a genuine .xlsx/.docx and was rejected before opening it.` };
      return;
    }
    // JSZip exposes the central-directory-declared uncompressed size on the
    // internal file object without inflating any data - this is metadata
    // read, not a decompression.
    const declaredSize = (file as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
    totalUncompressed += declaredSize;
    if (totalUncompressed > MAX_ZIP_UNCOMPRESSED_BYTES) {
      rejected = {
        ok: false,
        reason: `This file would expand to more than ${Math.round(MAX_ZIP_UNCOMPRESSED_BYTES / 1024 / 1024)}MB uncompressed - it was rejected before opening it (possible zip bomb).`,
      };
    }
  });

  if (rejected) return rejected;
  return { ok: true };
}

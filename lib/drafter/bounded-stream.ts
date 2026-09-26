/**
 * Reads a ReadableStream<Uint8Array> into a single Buffer, aborting as soon
 * as the running total exceeds maxBytes - never buffering more than
 * maxBytes + one chunk. Used by the PRA Drafter direct-upload finalize
 * route (app/api/drafter/documents/route.ts) so a huge or zip-bomb-inflated
 * upload cannot exhaust the function's memory: the upload-token route caps
 * the Blob upload itself, but this is the second, independent gate that
 * still applies even if a pre-cap token were ever presented.
 */
export interface BoundedReadResult {
  ok: true;
  bytes: Buffer;
}
export interface BoundedReadTooLarge {
  ok: false;
  reason: "too_large";
}

export async function readStreamBounded(
  stream: ReadableStream<Uint8Array>,
  maxBytes: number
): Promise<BoundedReadResult | BoundedReadTooLarge> {
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        return { ok: false, reason: "too_large" };
      }
      chunks.push(value);
    }
  }
  return { ok: true, bytes: Buffer.concat(chunks) };
}

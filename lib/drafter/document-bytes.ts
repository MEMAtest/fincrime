import { getDrafterDocumentBytesSource } from "@/lib/repo/drafter-documents";
import { getDrafterDocumentStream } from "@/lib/storage/blob";

/** Reads a drafter document's original bytes back from wherever they were stored (private blob or local fallback_bytes). */
export async function readDrafterDocumentBytes(documentId: string): Promise<Buffer | null> {
  const source = await getDrafterDocumentBytesSource(documentId);
  if (!source) return null;
  if (source.fallbackBytes) return source.fallbackBytes;
  if (source.blobUrl) {
    const stream = await getDrafterDocumentStream(source.blobUrl);
    if (!stream) return null;
    const chunks: Uint8Array[] = [];
    const reader = stream.stream.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    return Buffer.concat(chunks);
  }
  return null;
}

import { createHash } from "node:crypto";
import { query } from "@/lib/db";
import { writeDrafterAudit } from "./drafter-audit";
import type { ParsedDocument } from "@/lib/drafter/blocks";
import type { DrafterDocType } from "@/lib/drafter/doc-type-detect";

export type DrafterFormat = "docx" | "md" | "html" | "xlsx";

export interface DrafterDocumentRow {
  id: string;
  doc_type: DrafterDocType;
  confirmed_doc_type: DrafterDocType | null;
  filename: string;
  format: DrafterFormat;
  content_hash: string;
  blob_url: string | null;
  blob_pathname: string | null;
  size_bytes: number | null;
  parsed_content: ParsedDocument | null;
  parse_error: string | null;
  uploaded_by: string;
  uploaded_at: string;
}

export function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function createDrafterDocument(input: {
  docType: DrafterDocType;
  filename: string;
  format: DrafterFormat;
  contentHash: string;
  blobUrl: string | null;
  blobPathname: string | null;
  fallbackBytes: Buffer | null;
  sizeBytes: number;
  parsedContent: ParsedDocument | null;
  parseError: string | null;
  actor: string;
}): Promise<DrafterDocumentRow> {
  const rows = await query<DrafterDocumentRow>(
    `INSERT INTO drafter_documents
      (doc_type, filename, format, content_hash, blob_url, blob_pathname, fallback_bytes, size_bytes, parsed_content, parse_error, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING id, doc_type, confirmed_doc_type, filename, format, content_hash, blob_url, blob_pathname, size_bytes, parsed_content, parse_error, uploaded_by, uploaded_at`,
    [
      input.docType,
      input.filename,
      input.format,
      input.contentHash,
      input.blobUrl,
      input.blobPathname,
      input.fallbackBytes,
      input.sizeBytes,
      input.parsedContent ? JSON.stringify(input.parsedContent) : null,
      input.parseError,
      input.actor,
    ]
  );
  const doc = rows[0];
  await writeDrafterAudit(input.actor, "document.upload", "drafter_document", doc.id, {
    filename: input.filename,
    format: input.format,
    docType: input.docType,
  });
  return doc;
}

export async function confirmDrafterDocumentType(
  id: string,
  confirmedDocType: DrafterDocType,
  actor: string
): Promise<DrafterDocumentRow | null> {
  const rows = await query<DrafterDocumentRow>(
    `UPDATE drafter_documents SET confirmed_doc_type = $2
     WHERE id = $1
     RETURNING id, doc_type, confirmed_doc_type, filename, format, content_hash, blob_url, blob_pathname, size_bytes, parsed_content, parse_error, uploaded_by, uploaded_at`,
    [id, confirmedDocType]
  );
  const doc = rows[0] ?? null;
  if (doc) {
    await writeDrafterAudit(actor, "document.confirm_type", "drafter_document", id, { confirmedDocType });
  }
  return doc;
}

export async function listDrafterDocuments(): Promise<DrafterDocumentRow[]> {
  return query<DrafterDocumentRow>(
    `SELECT id, doc_type, confirmed_doc_type, filename, format, content_hash, blob_url, blob_pathname, size_bytes, parsed_content, parse_error, uploaded_by, uploaded_at
     FROM drafter_documents ORDER BY uploaded_at DESC`
  );
}

export async function getDrafterDocument(id: string): Promise<DrafterDocumentRow | null> {
  const rows = await query<DrafterDocumentRow>(
    `SELECT id, doc_type, confirmed_doc_type, filename, format, content_hash, blob_url, blob_pathname, size_bytes, parsed_content, parse_error, uploaded_by, uploaded_at
     FROM drafter_documents WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function getDrafterDocumentBytesSource(
  id: string
): Promise<{ blobUrl: string | null; fallbackBytes: Buffer | null; filename: string } | null> {
  const rows = await query<{ blob_url: string | null; fallback_bytes: Buffer | null; filename: string }>(
    `SELECT blob_url, fallback_bytes, filename FROM drafter_documents WHERE id = $1`,
    [id]
  );
  const row = rows[0];
  if (!row) return null;
  return { blobUrl: row.blob_url, fallbackBytes: row.fallback_bytes, filename: row.filename };
}

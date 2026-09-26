import { NextRequest, NextResponse } from "next/server";
import { requireDrafterActorApi } from "@/lib/drafter/access";
import { createDrafterDocument, listDrafterDocuments, sha256Hex, type DrafterDocumentRow } from "@/lib/repo/drafter-documents";
import { isBlobConfigured, uploadDrafterDocument, getDrafterDocumentStream } from "@/lib/storage/blob";
import { parseMarkdown } from "@/lib/drafter/parsers/markdown";
import { parseHtml } from "@/lib/drafter/parsers/html";
import { parseDocx } from "@/lib/drafter/parsers/docx";
import { listXlsxSheets } from "@/lib/drafter/parsers/xlsx";
import { detectDocType } from "@/lib/drafter/doc-type-detect";
import type { ParsedDocument } from "@/lib/drafter/blocks";
import { readStreamBounded } from "@/lib/drafter/bounded-stream";
import { guardZipBounds } from "@/lib/drafter/zip-guard";

/**
 * 4MB cap, same rationale as the evidence upload cap (commit cf2e9ab): stays
 * under Vercel's serverless request body limit so a too-large file gets our
 * 400 message rather than an opaque platform 413. A register or PRA bigger
 * than this uses the client-direct Blob upload flow instead (Scope B #11):
 * the browser calls POST /api/drafter/documents/upload-token to get a
 * scoped token, uploads straight to Blob via @vercel/blob/client's
 * `upload()`, then finalises here with {directUpload: true, blobUrl,
 * pathname, filename} - this route fetches the already-uploaded bytes back
 * (they never touch this app's request body) to parse and hash them.
 */
const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024;

/**
 * Ceiling for the direct-upload finalize path (matches
 * upload-token/route.ts's MAX_DIRECT_UPLOAD_BYTES - kept as two constants,
 * not one shared import, because they gate two different layers: the token
 * route stops Blob accepting a bigger upload at all, this one stops THIS
 * route reading an unbounded number of bytes into memory even if some
 * other/older token without that cap is ever presented). Checked while
 * streaming the blob back, not after - a multi-GB or zip-bomb-inflated file
 * must never be buffered in full before we notice.
 */
const MAX_DIRECT_UPLOAD_FINALIZE_BYTES = 50 * 1024 * 1024;

const FORMAT_BY_EXT: Record<string, "docx" | "md" | "html" | "xlsx"> = {
  docx: "docx",
  md: "md",
  markdown: "md",
  html: "html",
  htm: "html",
  xlsx: "xlsx",
};

function extensionOf(filename: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(filename);
  return match ? match[1].toLowerCase() : "";
}

export async function GET(request: NextRequest) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const documents = await listDrafterDocuments();
  return NextResponse.json({ documents });
}

interface FinalizedDocument {
  document: DrafterDocumentRow;
  detection: { suggestedType: string; reasons: string[]; registerRejectedReason?: string; blobConfigured: boolean };
}

/** Parses bytes into the internal block structure, detects a doc type, uploads/stores, and creates the drafter_documents row. Shared by the multipart path and the client-direct-upload finalize path. */
async function finalizeDocument(
  bytes: Buffer,
  filename: string,
  format: "docx" | "md" | "html" | "xlsx",
  actor: string,
  already: { blobUrl: string; blobPathname: string } | null
): Promise<FinalizedDocument> {
  const contentHash = sha256Hex(bytes);

  let parsedContent: ParsedDocument | null = null;
  let parseError: string | null = null;
  let suggestedType: "pra" | "register" | "policy" | "style_brief" = "policy";
  let detectionReasons: string[] = [];
  let registerRejectedReason: string | undefined;

  try {
    if (format === "md") {
      parsedContent = parseMarkdown(bytes.toString("utf8"));
      const detection = detectDocType(format, parsedContent, bytes.toString("utf8"));
      suggestedType = detection.registerRejected ? "policy" : detection.suggestedType;
      detectionReasons = detection.reasons;
      registerRejectedReason = detection.registerRejectedReason;
    } else if (format === "html") {
      parsedContent = parseHtml(bytes.toString("utf8"));
      const detection = detectDocType(format, parsedContent, bytes.toString("utf8"));
      suggestedType = detection.registerRejected ? "policy" : detection.suggestedType;
      detectionReasons = detection.reasons;
      registerRejectedReason = detection.registerRejectedReason;
    } else if (format === "docx") {
      parsedContent = await parseDocx(bytes);
      const detection = detectDocType(format, parsedContent);
      suggestedType = detection.registerRejected ? "policy" : detection.suggestedType;
      detectionReasons = detection.reasons;
      registerRejectedReason = detection.registerRejectedReason;
    } else {
      const sheets = await listXlsxSheets(bytes);
      parsedContent = { blocks: [], warnings: [] };
      suggestedType = "register";
      detectionReasons = [`${sheets.sheetNames.length} sheet(s) found`];
    }
  } catch (error) {
    parseError = error instanceof Error ? error.message : "Failed to parse the uploaded file";
  }

  let blobUrl: string | null = already?.blobUrl ?? null;
  let blobPathname: string | null = already?.blobPathname ?? null;
  let fallbackBytes: Buffer | null = null;

  if (!already) {
    if (isBlobConfigured()) {
      const uploaded = await uploadDrafterDocument(contentHash, filename, bytes, "application/octet-stream");
      blobUrl = uploaded.url;
      blobPathname = uploaded.pathname;
    } else {
      fallbackBytes = bytes;
    }
  }

  const document = await createDrafterDocument({
    docType: suggestedType,
    filename,
    format,
    contentHash,
    blobUrl,
    blobPathname,
    fallbackBytes,
    sizeBytes: bytes.length,
    parsedContent,
    parseError,
    actor,
  });

  return { document, detection: { suggestedType, reasons: detectionReasons, registerRejectedReason, blobConfigured: isBlobConfigured() } };
}

/**
 * POST /api/drafter/documents - EITHER multipart/form-data with a `file`
 * field (files up to MAX_FILE_SIZE_BYTES), OR application/json
 * {directUpload: true, blobUrl, pathname, filename} to finalise a file
 * already uploaded client-direct to Blob via
 * POST /api/drafter/documents/upload-token (Scope B #11 - larger files).
 * Either way: stores the original unchanged (private blob, or
 * fallback_bytes locally when no blob token is configured), computes a
 * sha256, parses into the internal block structure, and suggests a
 * document type for the user to confirm via PATCH
 * /api/drafter/documents/[id].
 */
export async function POST(request: NextRequest) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const { actor } = gate;

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => null);
    if (!body?.directUpload || typeof body.blobUrl !== "string" || typeof body.pathname !== "string" || typeof body.filename !== "string") {
      return NextResponse.json({ error: "Expected {directUpload: true, blobUrl, pathname, filename}" }, { status: 400 });
    }
    const ext = extensionOf(body.filename);
    const format = FORMAT_BY_EXT[ext];
    if (!format) {
      return NextResponse.json({ error: `Unsupported file extension ".${ext}". Allowed: .md, .html, .docx, .xlsx` }, { status: 400 });
    }
    const streamed = await getDrafterDocumentStream(body.blobUrl);
    if (!streamed) return NextResponse.json({ error: "Could not read the uploaded blob back - was the upload token used before it expired?" }, { status: 400 });
    const read = await readStreamBounded(streamed.stream, MAX_DIRECT_UPLOAD_FINALIZE_BYTES);
    if (!read.ok) {
      return NextResponse.json(
        { error: `Uploaded file is too large: it exceeds the ${MAX_DIRECT_UPLOAD_FINALIZE_BYTES / 1024 / 1024}MB limit for this module.` },
        { status: 413 }
      );
    }
    const bytes = read.bytes;
    if (bytes.length === 0) return NextResponse.json({ error: "Uploaded file is empty" }, { status: 400 });
    if (format === "docx" || format === "xlsx") {
      const zipGuard = await guardZipBounds(bytes);
      if (!zipGuard.ok) return NextResponse.json({ error: zipGuard.reason }, { status: 400 });
    }

    const result = await finalizeDocument(bytes, body.filename, format, actor.email, { blobUrl: body.blobUrl, blobPathname: body.pathname });
    return NextResponse.json(result);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data with a 'file' field" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Missing file field" }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ error: "File is empty" }, { status: 400 });
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      {
        error: `File is too large: ${Math.round(file.size / 1024 / 1024)}MB exceeds the ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB limit for a direct upload.`,
        useDirectUpload: true,
      },
      { status: 400 }
    );
  }

  const ext = extensionOf(file.name || "");
  const format = FORMAT_BY_EXT[ext];
  if (!format) {
    return NextResponse.json({ error: `Unsupported file extension ".${ext}". Allowed: .md, .html, .docx, .xlsx` }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (format === "docx" || format === "xlsx") {
    const zipGuard = await guardZipBounds(bytes);
    if (!zipGuard.ok) return NextResponse.json({ error: zipGuard.reason }, { status: 400 });
  }
  const result = await finalizeDocument(bytes, file.name, format, actor.email, null);
  return NextResponse.json(result);
}

import { NextRequest, NextResponse } from "next/server";
import { requireDrafterActorApi } from "@/lib/drafter/access";
import { createDrafterDocument, listDrafterDocuments, sha256Hex } from "@/lib/repo/drafter-documents";
import { isBlobConfigured, uploadDrafterDocument } from "@/lib/storage/blob";
import { parseMarkdown } from "@/lib/drafter/parsers/markdown";
import { parseHtml } from "@/lib/drafter/parsers/html";
import { parseDocx } from "@/lib/drafter/parsers/docx";
import { listXlsxSheets } from "@/lib/drafter/parsers/xlsx";
import { detectDocType } from "@/lib/drafter/doc-type-detect";
import type { ParsedDocument } from "@/lib/drafter/blocks";

/**
 * 4MB cap, same rationale as the evidence upload cap (commit cf2e9ab): stays
 * under Vercel's serverless request body limit so a too-large file gets our
 * 400 message rather than an opaque platform 413. A register or PRA bigger
 * than this would need the client-direct Blob upload flow - not built in
 * this pass (see docs/pra-drafter/HANDOFF-2.md "not built").
 */
const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024;

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

/**
 * POST /api/drafter/documents - multipart/form-data with a `file` field.
 * Stores the original unchanged (private blob, or fallback_bytes locally
 * when no blob token is configured), computes a sha256, parses into the
 * internal block structure, and suggests a document type for the user to
 * confirm via PATCH /api/drafter/documents/[id].
 */
export async function POST(request: NextRequest) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const { actor } = gate;

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
      { error: `File is too large: ${Math.round(file.size / 1024 / 1024)}MB exceeds the 4MB limit for this deployment.` },
      { status: 400 }
    );
  }

  const ext = extensionOf(file.name || "");
  const format = FORMAT_BY_EXT[ext];
  if (!format) {
    return NextResponse.json({ error: `Unsupported file extension ".${ext}". Allowed: .md, .html, .docx, .xlsx` }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
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
      suggestedType = detection.suggestedType;
      detectionReasons = detection.reasons;
    } else {
      const sheets = await listXlsxSheets(bytes);
      parsedContent = { blocks: [], warnings: [] };
      suggestedType = "register";
      detectionReasons = [`${sheets.sheetNames.length} sheet(s) found`];
    }
  } catch (error) {
    parseError = error instanceof Error ? error.message : "Failed to parse the uploaded file";
  }

  let blobUrl: string | null = null;
  let blobPathname: string | null = null;
  let fallbackBytes: Buffer | null = null;

  // A document row is created first (to get an id for the blob pathname is
  // nicer, but we don't have one yet) - upload by content hash instead, then
  // insert the row referencing the resulting blob/fallback.
  if (isBlobConfigured()) {
    const uploaded = await uploadDrafterDocument(contentHash, file.name, bytes, file.type || "application/octet-stream");
    blobUrl = uploaded.url;
    blobPathname = uploaded.pathname;
  } else {
    fallbackBytes = bytes;
  }

  const document = await createDrafterDocument({
    docType: suggestedType,
    filename: file.name,
    format,
    contentHash,
    blobUrl,
    blobPathname,
    fallbackBytes,
    sizeBytes: file.size,
    parsedContent,
    parseError,
    actor: actor.email,
  });

  return NextResponse.json({
    document,
    detection: { suggestedType, reasons: detectionReasons, registerRejectedReason, blobConfigured: isBlobConfigured() },
  });
}

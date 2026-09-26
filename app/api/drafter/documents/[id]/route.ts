import { NextRequest, NextResponse } from "next/server";
import { requireDrafterActorApi } from "@/lib/drafter/access";
import { confirmDrafterDocumentType, getDrafterDocument, deleteDrafterDocument } from "@/lib/repo/drafter-documents";
import { deleteEvidenceFileBestEffort } from "@/lib/storage/blob";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const { id } = await context.params;
  const document = await getDrafterDocument(id);
  if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ document });
}

const VALID_TYPES = ["pra", "register", "policy", "style_brief"] as const;

/**
 * PATCH /api/drafter/documents/[id] - confirms the document type the user
 * picked on the upload screen. A register must always be the raw
 * spreadsheet (SPEC.md), so confirming "register" on anything but an .xlsx
 * upload is rejected here in code, not left to the user's judgement.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const { id } = await context.params;

  const document = await getDrafterDocument(id);
  if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { docType?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body { docType }" }, { status: 400 });
  }

  const docType = body.docType;
  if (!docType || !(VALID_TYPES as readonly string[]).includes(docType)) {
    return NextResponse.json({ error: `docType must be one of ${VALID_TYPES.join(", ")}` }, { status: 400 });
  }
  if (docType === "register" && document.format !== "xlsx") {
    return NextResponse.json(
      { error: "A register must be uploaded as the original spreadsheet (.xlsx), never confirmed from a summary document." },
      { status: 400 }
    );
  }

  const updated = await confirmDrafterDocumentType(id, docType as typeof VALID_TYPES[number], gate.actor.email);
  return NextResponse.json({ document: updated });
}

/**
 * DELETE - removes a document and its private blob (prod walkthrough item
 * 5). Blocked with a 409 explaining why if the document is still used by a
 * register import, template, exemplar or StylePack style brief - never a
 * raw foreign-key error.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const { id } = await context.params;

  const result = await deleteDrafterDocument(id, gate.actor.email);
  if (!result.deleted && !result.blockedReason) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (result.blockedReason) return NextResponse.json({ error: result.blockedReason }, { status: 409 });
  if (result.blobUrl) await deleteEvidenceFileBestEffort(result.blobUrl);
  return NextResponse.json({ ok: true });
}

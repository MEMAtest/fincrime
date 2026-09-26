import { NextRequest, NextResponse } from "next/server";
import { requireDrafterActorApi } from "@/lib/drafter/access";
import { getDrafterDocument } from "@/lib/repo/drafter-documents";
import { extractSkeleton } from "@/lib/drafter/skeleton";

/**
 * POST /api/drafter/templates/extract {documentId} - proposes a skeleton
 * from a confirmed approved-PRA document (SPEC.md "Skeleton extraction").
 * This is a PROPOSAL only, nothing is persisted here - the user reviews and
 * edits it before POSTing /api/drafter/templates to create the Template.
 */
export async function POST(request: NextRequest) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;

  const body = await request.json().catch(() => null);
  const documentId = body?.documentId;
  if (typeof documentId !== "string") return NextResponse.json({ error: "Missing documentId" }, { status: 400 });

  const document = await getDrafterDocument(documentId);
  if (!document) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  if (document.confirmed_doc_type !== "pra") {
    return NextResponse.json({ error: "This document has not been confirmed as an approved PRA." }, { status: 400 });
  }
  if (!document.parsed_content) {
    return NextResponse.json({ error: document.parse_error || "This document has no parsed content." }, { status: 400 });
  }

  const skeleton = extractSkeleton(document.parsed_content);
  return NextResponse.json({ skeleton, documentId });
}

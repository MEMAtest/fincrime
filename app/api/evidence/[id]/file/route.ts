import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { getEvidence, attachEvidenceFile, clearEvidenceFile } from "@/lib/repo/evidence";
import { assertSubjectMutable } from "@/lib/workspace/subject-mutability";
import { isBlobConfigured, uploadEvidenceFile, deleteEvidenceFileBestEffort } from "@/lib/storage/blob";
import {
  ALLOWED_CONTENT_TYPES,
  ALLOWED_EXTENSIONS_LABEL,
  MAX_FILE_SIZE_BYTES,
  isAllowedContentType,
  sanitiseFileName,
} from "@/lib/evidence/file-validation";

const ACTOR = "workspace";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/evidence/[id]/file - multipart/form-data with a `file` field.
 * Uploads the file to Vercel Blob and records its metadata on the evidence
 * row. Guards, in order: the id is a UUID and belongs to this workspace; the
 * evidence's SUBJECT is not a final/closed record (a final control test,
 * incident, readiness assessment or reg request is immutable, and its
 * evidence is part of that historical record - matching every other
 * mutation guard in this codebase, see lib/workspace/subject-mutability.ts);
 * blob storage is configured; the content type is on the allowlist; the
 * file is under the size cap.
 */
export const POST = withWorkspace<RouteContext>(async (request, workspace, context) => {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return NextResponse.json({ error: "Evidence not found" }, { status: 404 });

    const evidence = await getEvidence(workspace.id, id);
    if (!evidence) return NextResponse.json({ error: "Evidence not found" }, { status: 404 });

    const mutable = await assertSubjectMutable(workspace.id, evidence.subject_type, evidence.subject_id);
    if (!mutable.ok) {
      return NextResponse.json(
        { error: "Cannot attach a file to evidence on a record that is already final/closed" },
        { status: 409 }
      );
    }

    // Input validation (400s) happens BEFORE the storage-configured check
    // (503): a malformed request is rejected the same way in every
    // deployment, regardless of whether Blob storage happens to be
    // configured there. Only a well-formed, valid upload attempt should
    // ever surface "storage isn't configured."
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: "Expected multipart/form-data with a 'file' field" }, { status: 400 });
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file field" }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "File is empty" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File is too large: ${Math.round(file.size / 1024 / 1024)}MB exceeds the 10MB limit` },
        { status: 400 }
      );
    }
    const contentType = (file.type || "").toLowerCase();
    if (!isAllowedContentType(contentType)) {
      return NextResponse.json(
        { error: `Unsupported file type "${contentType || "unknown"}". Allowed: ${ALLOWED_EXTENSIONS_LABEL}` },
        { status: 400 }
      );
    }

    if (!isBlobConfigured()) {
      return NextResponse.json(
        { error: "File upload is not configured for this deployment. Link-only evidence is still fully supported." },
        { status: 503 }
      );
    }

    const fileName = sanitiseFileName(file.name || `evidence.${ALLOWED_CONTENT_TYPES[contentType]}`);
    const bytes = Buffer.from(await file.arrayBuffer());

    // A re-upload replaces the previous attachment: delete the old blob
    // best-effort BEFORE overwriting the row's metadata, so a failure to
    // delete never blocks recording the new file (an orphaned old blob is
    // logged, not fatal).
    if (evidence.file_url) {
      await deleteEvidenceFileBestEffort(evidence.file_url);
    }

    const uploaded = await uploadEvidenceFile(workspace.id, id, fileName, bytes, contentType);

    const updated = await attachEvidenceFile(
      workspace.id,
      id,
      { fileUrl: uploaded.url, fileName, fileSizeBytes: file.size, fileContentType: contentType },
      ACTOR
    );
    if (!updated) return NextResponse.json({ error: "Evidence not found" }, { status: 404 });

    return NextResponse.json({ evidence: updated });
  } catch (error) {
    console.error("Evidence file upload error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

/**
 * DELETE /api/evidence/[id]/file - removes the file attachment (best-effort
 * blob delete + clears the metadata columns). Leaves the evidence row and
 * its link_url/description untouched. Same immutability guard as POST.
 */
export const DELETE = withWorkspace<RouteContext>(async (_request, workspace, context) => {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return NextResponse.json({ error: "Evidence not found" }, { status: 404 });

    const evidence = await getEvidence(workspace.id, id);
    if (!evidence) return NextResponse.json({ error: "Evidence not found" }, { status: 404 });

    const mutable = await assertSubjectMutable(workspace.id, evidence.subject_type, evidence.subject_id);
    if (!mutable.ok) {
      return NextResponse.json(
        { error: "Cannot remove a file from evidence on a record that is already final/closed" },
        { status: 409 }
      );
    }

    if (!evidence.file_url) {
      return NextResponse.json({ error: "This evidence has no attached file" }, { status: 400 });
    }

    await deleteEvidenceFileBestEffort(evidence.file_url);
    const updated = await clearEvidenceFile(workspace.id, id, ACTOR);
    if (!updated) return NextResponse.json({ error: "Evidence not found" }, { status: 404 });

    return NextResponse.json({ evidence: updated });
  } catch (error) {
    console.error("Evidence file delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

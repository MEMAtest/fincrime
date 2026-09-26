import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { requireDrafterActorApi } from "@/lib/drafter/access";

/**
 * Client-direct Blob upload (BUILD-DECISIONS "Private": "Uploads over the
 * Vercel request body limit: ... If a register or PRA is larger, use
 * client-direct Blob upload"; SCOPE B #11). The browser uploads bytes
 * straight to Vercel Blob, bypassing this app's serverless function body
 * limit entirely - this route only ever issues a short-lived, scoped
 * upload token (`onBeforeGenerateToken`), gated by the SAME drafter access
 * check as every other route. The finished upload is then finalised
 * (parsed, hashed, turned into a drafter_documents row) by POST
 * /api/drafter/documents with {directUpload: true, blobUrl, pathname,
 * filename} - see that route.
 */
const ALLOWED_CONTENT_TYPES = [
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "text/markdown",
  "text/html",
  "text/plain",
  "application/octet-stream",
];

export async function POST(request: NextRequest): Promise<NextResponse> {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const { actor } = gate;

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          addRandomSuffix: true,
          access: "private",
          tokenPayload: JSON.stringify({ actor: actor.email, pathname }),
          // 4.5GB is Vercel Blob's own ceiling; the real limit that matters
          // here is "bigger than the 4MB direct-upload cap", not a specific
          // number, so we do not add a tighter one.
        };
      },
      onUploadCompleted: async () => {
        // Best-effort only: Vercel only calls this webhook in production
        // (it needs a publicly reachable URL), so local/dev finalisation
        // happens via the client's explicit POST /api/drafter/documents
        // {directUpload: true, ...} call instead - never relied on alone.
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not issue an upload token" }, { status: 400 });
  }
}

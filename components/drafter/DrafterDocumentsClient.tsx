"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import ToolFrame from "@/components/layout/ToolFrame";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { drafterFetch } from "./drafterFetch";
import ConfirmDialog from "./ConfirmDialog";

/** Same 4MB cap the server enforces on a direct multipart upload (app/api/drafter/documents/route.ts) - above this, upload client-direct to Blob instead (Scope B #11). */
const DIRECT_UPLOAD_THRESHOLD_BYTES = 4 * 1024 * 1024;

interface DocBlock {
  type: string;
  text?: string;
  items?: string[];
}

interface ParsedContent {
  blocks: DocBlock[];
  warnings: string[];
}

interface DocumentRow {
  id: string;
  doc_type: string;
  confirmed_doc_type: string | null;
  filename: string;
  format: "docx" | "md" | "html" | "xlsx";
  content_hash: string;
  parsed_content: ParsedContent | null;
  parse_error: string | null;
  uploaded_by: string;
  uploaded_at: string;
}

const DOC_TYPES = [
  { value: "pra", label: "Approved PRA" },
  { value: "register", label: "Register" },
  { value: "policy", label: "Policy" },
  { value: "style_brief", label: "Style brief" },
];

export default function DrafterDocumentsClient() {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocumentRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const res = await drafterFetch<{ documents: DocumentRow[] }>("/api/drafter/documents");
    if (res.ok && "documents" in res.data) setDocuments(res.data.documents);
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      await reload();
    })();
  }, [reload]);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    setMessage(null);

    try {
      let res: Response;
      if (file.size > DIRECT_UPLOAD_THRESHOLD_BYTES) {
        // Client-direct upload to private Blob (Scope B #11): bytes never
        // pass through this app's serverless function body, so there is no
        // 4MB ceiling here. onBeforeGenerateToken in the upload-token route
        // still gates this on the same drafter access check.
        // `access` IS sent with the upload and must match the token issued
        // by the upload-token route ("private"); a mismatch is rejected by
        // Blob without CORS headers, which surfaced as a CORS error and a
        // button stuck on "Uploading...". The timeout stops the SDK's
        // internal retries from hanging forever on any other failure.
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 5 * 60 * 1000);
        let blob: Awaited<ReturnType<typeof upload>>;
        try {
          blob = await upload(file.name, file, {
            access: "private",
            handleUploadUrl: "/api/drafter/documents/upload-token",
            multipart: true,
            abortSignal: controller.signal,
          });
        } catch (error) {
          throw new Error(
            controller.signal.aborted
              ? "The upload timed out. Check the connection and try again."
              : `The upload failed: ${error instanceof Error ? error.message : "unknown error"}`
          );
        } finally {
          window.clearTimeout(timeout);
        }
        res = await fetch("/api/drafter/documents", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ directUpload: true, blobUrl: blob.url, pathname: blob.pathname, filename: file.name }),
        });
      } else {
        const formData = new FormData();
        formData.append("file", file);
        res = await fetch("/api/drafter/documents", { method: "POST", credentials: "include", body: formData });
      }
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Upload failed");
        return;
      }
      setMessage(
        `Uploaded. Suggested type: ${data.detection.suggestedType}${
          data.detection.registerRejectedReason ? ` (${data.detection.registerRejectedReason})` : ""
        }${data.detection.blobConfigured ? "" : " - stored locally (no blob token configured in this deployment)."}`
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
      await reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function confirmType(id: string, docType: string) {
    const res = await drafterFetch(`/api/drafter/documents/${id}`, { method: "PATCH", body: JSON.stringify({ docType }) });
    if (!res.ok && "error" in res.data) {
      setMessage(res.data.error ?? "Could not confirm type");
      return;
    }
    await reload();
  }

  async function deleteDocument() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setDeleteError(null);
    const res = await drafterFetch(`/api/drafter/documents/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteBusy(false);
    if (!res.ok) {
      setDeleteError("error" in res.data ? res.data.error ?? "Could not delete this document." : "Could not delete this document.");
      return;
    }
    setDeleteTarget(null);
    await reload();
  }

  return (
    <ToolFrame breadcrumb={[{ label: "Home", href: "/" }, { label: "PRA Drafter", href: "/drafter" }, { label: "Documents" }]}>
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-2xl font-bold text-foreground mb-1">Documents</h1>
          <p className="text-sm text-text-muted mb-6 max-w-2xl">
            Upload .md, .html, .docx or .xlsx files. Every upload is stored unchanged, hashed and parsed. Confirm
            the document type before it is used elsewhere - a register must always be the raw spreadsheet.
          </p>

          <form onSubmit={handleUpload} className="glass-card rounded-xl p-5 mb-6 flex items-center gap-3 flex-wrap">
            <label>
              <span className="sr-only">Choose a file (.md, .html, .docx or .xlsx)</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".md,.markdown,.html,.htm,.docx,.xlsx"
                className="text-sm text-text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-sm"
              />
            </label>
            <Button type="submit" disabled={uploading}>
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </form>

          {message && <div className="glass-card rounded-xl p-4 text-sm mb-6">{message}</div>}

          {loading ? (
            <p className="text-sm text-text-muted">Loading...</p>
          ) : documents.length === 0 ? (
            <div className="glass-card rounded-2xl p-10 text-center text-text-muted text-sm">No documents yet.</div>
          ) : (
            <div className="grid gap-3">
              {documents.map((doc) => (
                <div key={doc.id} className="glass-card rounded-xl p-5">
                  <div className="flex items-center justify-between gap-4 flex-wrap mb-2">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{doc.filename}</p>
                      <p className="text-xs text-text-muted mt-0.5">
                        {doc.format} &middot; {doc.content_hash.slice(0, 12)} &middot; {new Date(doc.uploaded_at).toLocaleString()}
                      </p>
                    </div>
                    {doc.confirmed_doc_type ? (
                      <Badge variant="success">{DOC_TYPES.find((t) => t.value === doc.confirmed_doc_type)?.label}</Badge>
                    ) : (
                      <Badge>Suggested: {DOC_TYPES.find((t) => t.value === doc.doc_type)?.label}</Badge>
                    )}
                  </div>

                  {doc.parse_error && <p className="text-xs text-red-500 mb-2">Parse error: {doc.parse_error}</p>}
                  {doc.parsed_content && (
                    <p className="text-xs text-text-muted mb-2">
                      {doc.parsed_content.blocks.length} block(s) parsed
                      {doc.parsed_content.warnings.length > 0 && ` - ${doc.parsed_content.warnings.length} warning(s)`}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    {!doc.confirmed_doc_type &&
                      DOC_TYPES.filter((t) => t.value !== "register" || doc.format === "xlsx").map((t) => (
                        <Button key={t.value} variant="secondary" size="sm" onClick={() => confirmType(doc.id, t.value)}>
                          Confirm: {t.label}
                        </Button>
                      ))}
                    <button
                      className="text-xs px-3 py-1.5 rounded border border-red-300 text-red-700"
                      onClick={() => {
                        setDeleteError(null);
                        setDeleteTarget(doc);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {deleteTarget && (
            <ConfirmDialog
              title="Delete this document?"
              description={`"${deleteTarget.filename}" and its stored file will be permanently removed. This cannot be undone.`}
              busy={deleteBusy}
              error={deleteError}
              onConfirm={deleteDocument}
              onCancel={() => setDeleteTarget(null)}
            />
          )}
        </div>
      </main>
    </ToolFrame>
  );
}

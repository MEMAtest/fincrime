"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ToolFrame from "@/components/layout/ToolFrame";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { drafterFetch } from "./drafterFetch";

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
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/drafter/documents", { method: "POST", credentials: "include", body: formData });
    const data = await res.json();
    setUploading(false);
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
  }

  async function confirmType(id: string, docType: string) {
    const res = await drafterFetch(`/api/drafter/documents/${id}`, { method: "PATCH", body: JSON.stringify({ docType }) });
    if (!res.ok && "error" in res.data) {
      setMessage(res.data.error ?? "Could not confirm type");
      return;
    }
    await reload();
  }

  return (
    <ToolFrame breadcrumb={[{ label: "Home", href: "/" }, { label: "PRA Drafter", href: "/drafter" }, { label: "Documents" }]}>
      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-2xl font-bold text-foreground mb-1">Documents</h1>
          <p className="text-sm text-text-muted mb-6 max-w-2xl">
            Upload .md, .html, .docx or .xlsx files. Every upload is stored unchanged, hashed and parsed. Confirm
            the document type before it is used elsewhere - a register must always be the raw spreadsheet.
          </p>

          <form onSubmit={handleUpload} className="glass-card rounded-xl p-5 mb-6 flex items-center gap-3 flex-wrap">
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.markdown,.html,.htm,.docx,.xlsx"
              className="text-sm text-text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-sm"
            />
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

                  {!doc.confirmed_doc_type && (
                    <div className="flex flex-wrap gap-2">
                      {DOC_TYPES.filter((t) => t.value !== "register" || doc.format === "xlsx").map((t) => (
                        <Button key={t.value} variant="secondary" size="sm" onClick={() => confirmType(doc.id, t.value)}>
                          Confirm: {t.label}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </ToolFrame>
  );
}

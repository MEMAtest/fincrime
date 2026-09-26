"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ToolFrame from "@/components/layout/ToolFrame";
import Button from "@/components/ui/Button";
import { drafterFetch } from "./drafterFetch";

interface DocumentRow {
  id: string;
  filename: string;
  format: string;
  confirmed_doc_type: string | null;
}

interface RegisterImportRow {
  id: string;
  sheet_name: string;
  document_id: string;
  created_at: string;
}

export default function DrafterRegisterListClient() {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [imports, setImports] = useState<RegisterImportRow[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [sheetNames, setSheetNames] = useState<string[] | null>(null);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload() {
    const [docsRes, importsRes] = await Promise.all([
      drafterFetch<{ documents: DocumentRow[] }>("/api/drafter/documents"),
      drafterFetch<{ imports: RegisterImportRow[] }>("/api/drafter/register"),
    ]);
    if (docsRes.ok && "documents" in docsRes.data) setDocuments(docsRes.data.documents);
    if (importsRes.ok && "imports" in importsRes.data) setImports(importsRes.data.imports);
  }

  useEffect(() => {
    (async () => {
      await reload();
    })();
  }, []);

  const registerDocuments = documents.filter((d) => d.confirmed_doc_type === "register");

  async function pickSheets() {
    if (!selectedDocumentId) return;
    setBusy(true);
    setMessage(null);
    const res = await drafterFetch<{ sheetPicker: string[] }>("/api/drafter/register", {
      method: "POST",
      body: JSON.stringify({ documentId: selectedDocumentId }),
    });
    setBusy(false);
    if (res.ok && "sheetPicker" in res.data) {
      setSheetNames(res.data.sheetPicker);
      setSelectedSheet(res.data.sheetPicker[0] ?? "");
    } else if ("error" in res.data) {
      setMessage(res.data.error ?? "Could not list sheets");
    }
  }

  async function startImport() {
    if (!selectedDocumentId || !selectedSheet) return;
    setBusy(true);
    setMessage(null);
    const res = await drafterFetch<{ registerImport: { id: string } }>("/api/drafter/register", {
      method: "POST",
      body: JSON.stringify({ documentId: selectedDocumentId, sheetName: selectedSheet }),
    });
    setBusy(false);
    if (res.ok && "registerImport" in res.data) {
      window.location.href = `/drafter/register/${res.data.registerImport.id}`;
    } else if ("error" in res.data) {
      setMessage(res.data.error ?? "Import failed");
    }
  }

  return (
    <ToolFrame breadcrumb={[{ label: "Home", href: "/" }, { label: "PRA Drafter", href: "/drafter" }, { label: "Register" }]}>
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-2xl font-bold text-foreground mb-1">Register</h1>
          <p className="text-sm text-text-muted mb-6 max-w-2xl">
            Import a requirements register from a confirmed register upload. Pick the sheet, review the proposed
            column mapping, and resolve every blocking validation issue before accepting a version.
          </p>

          <div className="glass-card rounded-xl p-5 mb-6">
            <h2 className="font-medium text-foreground mb-3">New import</h2>
            {registerDocuments.length === 0 ? (
              <p className="text-sm text-text-muted">
                No confirmed register documents yet.{" "}
                <Link href="/drafter/documents" className="text-accent hover:underline">
                  Upload and confirm one first
                </Link>
                .
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <select
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm"
                  value={selectedDocumentId}
                  onChange={(e) => {
                    setSelectedDocumentId(e.target.value);
                    setSheetNames(null);
                  }}
                >
                  <option value="">Select a register document...</option>
                  {registerDocuments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.filename}
                    </option>
                  ))}
                </select>
                {!sheetNames ? (
                  <Button variant="secondary" disabled={!selectedDocumentId || busy} onClick={pickSheets}>
                    List sheets
                  </Button>
                ) : (
                  <>
                    <select
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm"
                      value={selectedSheet}
                      onChange={(e) => setSelectedSheet(e.target.value)}
                    >
                      {sheetNames.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <Button disabled={busy} onClick={startImport}>
                      Import
                    </Button>
                  </>
                )}
              </div>
            )}
            {message && <p className="text-sm text-red-500 mt-3">{message}</p>}
          </div>

          {imports.length > 0 && (
            <div className="grid gap-3">
              {imports.map((imp) => (
                <Link key={imp.id} href={`/drafter/register/${imp.id}`} className="glass-card rounded-xl p-5 block hover:border-accent/40 transition-colors">
                  <p className="font-medium text-foreground">{imp.sheet_name}</p>
                  <p className="text-xs text-text-muted mt-0.5">Imported {new Date(imp.created_at).toLocaleString()}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </ToolFrame>
  );
}

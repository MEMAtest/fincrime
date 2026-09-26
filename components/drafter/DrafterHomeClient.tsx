"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Table, Library, Settings, ArrowRight, CheckCircle2, Gauge } from "lucide-react";
import ToolFrame from "@/components/layout/ToolFrame";
import Badge from "@/components/ui/Badge";
import { drafterFetch } from "./drafterFetch";

interface DocumentSummary {
  id: string;
  doc_type: string;
  confirmed_doc_type: string | null;
  format: string;
}

interface RegisterImportSummary {
  id: string;
  sheet_name: string;
}

interface ControlSummary {
  id: string;
}

export default function DrafterHomeClient() {
  const [documents, setDocuments] = useState<DocumentSummary[] | null>(null);
  const [imports, setImports] = useState<RegisterImportSummary[] | null>(null);
  const [controls, setControls] = useState<ControlSummary[] | null>(null);

  useEffect(() => {
    drafterFetch<{ documents: DocumentSummary[] }>("/api/drafter/documents").then((r) => {
      if (r.ok && "documents" in r.data) setDocuments(r.data.documents);
    });
    drafterFetch<{ imports: RegisterImportSummary[] }>("/api/drafter/register").then((r) => {
      if (r.ok && "imports" in r.data) setImports(r.data.imports);
    });
    drafterFetch<{ controls: ControlSummary[] }>("/api/drafter/library/controls").then((r) => {
      if (r.ok && "controls" in r.data) setControls(r.data.controls);
    });
  }, []);

  const confirmedPra = documents?.filter((d) => d.confirmed_doc_type === "pra").length ?? 0;
  const confirmedStyleBrief = documents?.filter((d) => d.confirmed_doc_type === "style_brief").length ?? 0;
  const standardReady = confirmedPra > 0 && confirmedStyleBrief > 0;

  return (
    <ToolFrame breadcrumb={[{ label: "Home", href: "/" }, { label: "PRA Drafter" }]}>
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground">PRA Drafter</h1>
            <p className="text-sm text-text-muted mt-1 max-w-2xl">
              Drafts the control enhancement sections of a Product Risk Assessment from an approved PRA&apos;s house
              style and a requirements register. Private module, allowlisted users only.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 mb-8">
            <StatusCard
              icon={FileText}
              title="Standard"
              href="/drafter/documents"
              body={
                documents === null ? (
                  "Loading..."
                ) : standardReady ? (
                  "An approved PRA and a style brief have been uploaded and confirmed."
                ) : (
                  "Not ready. Skeleton extraction from an approved PRA is a later phase of this build - upload documents here in the meantime."
                )
              }
              badge={standardReady ? <Badge variant="info">Documents confirmed</Badge> : <Badge>Not started</Badge>}
            />
            <StatusCard
              icon={Table}
              title="Register"
              href="/drafter/register"
              body={
                imports === null
                  ? "Loading..."
                  : imports.length === 0
                    ? "No register has been imported yet."
                    : `${imports.length} register import(s). Open one to review validation and versions.`
              }
              badge={imports && imports.length > 0 ? <Badge variant="success">Imported</Badge> : <Badge>Not started</Badge>}
            />
            <StatusCard
              icon={Library}
              title="Library"
              href="/drafter/library"
              body={
                controls === null
                  ? "Loading..."
                  : controls.length === 0
                    ? "No controls yet - accept a register version to build the library."
                    : `${controls.length} control(s) in the library.`
              }
              badge={controls && controls.length > 0 ? <Badge variant="success">{controls.length} controls</Badge> : <Badge>Empty</Badge>}
            />
          </div>

          <div className="glass-card rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-semibold text-foreground">PRA drafts</h2>
              <Link href="/drafter/settings" className="text-xs text-text-muted hover:text-foreground flex items-center gap-1">
                <Settings className="h-3.5 w-3.5" /> Settings
              </Link>
            </div>
            <p className="text-sm text-text-muted mb-3">
              Set the standard (template and house style), then start a PRA: pick candidate controls, draft each
              enhancement and review the lint results and open items.
            </p>
            <div className="flex gap-3">
              <Link href="/drafter/templates" className="text-sm text-accent hover:underline">
                Template and house style
              </Link>
              <Link href="/drafter/pras" className="text-sm text-accent hover:underline">
                Start / open a PRA
              </Link>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <NavLink href="/drafter/documents" label="Documents" icon={FileText} />
            <NavLink href="/drafter/register" label="Register" icon={Table} />
            <NavLink href="/drafter/library" label="Library" icon={Library} />
            <NavLink href="/drafter/templates" label="Templates" icon={FileText} />
            <NavLink href="/drafter/pras" label="PRA drafts" icon={Table} />
            <NavLink href="/drafter/settings" label="Settings" icon={Settings} />
            <NavLink href="/drafter/reviewer" label="Reviewer" icon={CheckCircle2} />
            <NavLink href="/drafter/calibration" label="Calibration" icon={Gauge} />
          </div>
        </div>
      </main>
    </ToolFrame>
  );
}

function StatusCard({
  icon: Icon,
  title,
  href,
  body,
  badge,
}: {
  icon: typeof FileText;
  title: string;
  href: string;
  body: string;
  badge: React.ReactNode;
}) {
  return (
    <Link href={href} className="glass-card rounded-xl p-5 hover:border-accent/40 transition-colors block">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-accent" />
          <span className="font-medium text-foreground">{title}</span>
        </div>
        {badge}
      </div>
      <p className="text-xs text-text-muted">{body}</p>
    </Link>
  );
}

function NavLink({ href, label, icon: Icon }: { href: string; label: string; icon: typeof FileText }) {
  return (
    <Link href={href} className="glass-card rounded-lg px-4 py-2 text-sm flex items-center gap-2 hover:border-accent/40 transition-colors">
      <Icon className="h-4 w-4 text-accent" /> {label} <ArrowRight className="h-3.5 w-3.5 text-text-muted" />
    </Link>
  );
}

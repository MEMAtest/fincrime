"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import ToolFrame from "@/components/layout/ToolFrame";
import Badge from "@/components/ui/Badge";
import { drafterFetch } from "./drafterFetch";

interface PraSummary {
  id: string;
  product: string;
  status: string;
  customer_types: string[];
  created_at: string;
}

interface TemplateWithVersions {
  template: { id: string; name: string };
  versions: { id: string; version: number; confirmed: boolean }[];
}

interface StylepackWithVersions {
  stylepack: { id: string; name: string };
  versions: { id: string; version: number }[];
}

interface RegisterVersionSummary {
  id: string;
  status: string;
}

interface RegisterImportSummary {
  id: string;
  sheet_name: string;
}

export default function DrafterPrasListClient() {
  const [pras, setPras] = useState<PraSummary[]>([]);
  const [templates, setTemplates] = useState<TemplateWithVersions[]>([]);
  const [stylepacks, setStylepacks] = useState<StylepackWithVersions[]>([]);
  const [registerImports, setRegisterImports] = useState<RegisterImportSummary[]>([]);
  const [acceptedRegisterVersionId, setAcceptedRegisterVersionId] = useState<string>("");

  const [product, setProduct] = useState("");
  const [description, setDescription] = useState("");
  const [legalEntity, setLegalEntity] = useState("");
  const [customerTypes, setCustomerTypes] = useState<string[]>([]);
  const [templateVersionId, setTemplateVersionId] = useState("");
  const [stylepackVersionId, setStylepackVersionId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    drafterFetch<{ pras: PraSummary[] }>("/api/drafter/pras").then((r) => {
      if (r.ok && "pras" in r.data) setPras(r.data.pras);
    });
    drafterFetch<{ templates: TemplateWithVersions[] }>("/api/drafter/templates").then((r) => {
      if (r.ok && "templates" in r.data) setTemplates(r.data.templates);
    });
    drafterFetch<{ stylepacks: StylepackWithVersions[] }>("/api/drafter/stylepacks").then((r) => {
      if (r.ok && "stylepacks" in r.data) setStylepacks(r.data.stylepacks);
    });
    drafterFetch<{ imports: RegisterImportSummary[] }>("/api/drafter/register").then(async (r) => {
      if (!r.ok || !("imports" in r.data)) return;
      setRegisterImports(r.data.imports);
      for (const imp of r.data.imports) {
        const detail = await drafterFetch<{ versions: RegisterVersionSummary[] }>(`/api/drafter/register/${imp.id}`);
        if (detail.ok && "versions" in detail.data) {
          const accepted = detail.data.versions.find((v) => v.status === "accepted");
          if (accepted) setAcceptedRegisterVersionId(accepted.id);
        }
      }
    });
  }, []);

  const confirmedTemplateVersions = templates.flatMap((t) => t.versions.filter((v) => v.confirmed).map((v) => ({ ...v, templateName: t.template.name })));

  const toggleCustomerType = (type: string) => {
    setCustomerTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  };

  // Ref lock: see DrafterPraDraftClient.tsx's submittingCandidatesRef
  // comment - `busy` state alone doesn't close a same-tick double-click.
  const startPraRef = useRef(false);

  const startPra = async () => {
    if (startPraRef.current) return;
    startPraRef.current = true;
    setBusy(true);
    setMessage(null);
    const r = await drafterFetch<{ pra: PraSummary }>("/api/drafter/pras", {
      method: "POST",
      body: JSON.stringify({
        product,
        description,
        legalEntity,
        customerTypes,
        templateVersionId,
        stylepackVersionId,
        registerVersionId: acceptedRegisterVersionId || null,
      }),
    });
    if (!r.ok || !("pra" in r.data)) {
      // Only re-arm the lock on failure - on success we navigate away via
      // window.location.href, and re-enabling the button while that
      // navigation is still pending would allow a second POST.
      startPraRef.current = false;
      setBusy(false);
      setMessage("error" in r.data ? r.data.error ?? "Could not start PRA" : "Could not start PRA");
      return;
    }
    window.location.href = `/drafter/pras/${r.data.pra.id}`;
  };

  return (
    <ToolFrame breadcrumb={[{ label: "Home", href: "/drafter" }, { label: "PRA Drafter", href: "/drafter" }, { label: "PRA drafts" }]}>
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">PRA drafts</h1>
            <p className="text-sm text-text-muted mt-1">Start a new PRA, or open one already in progress.</p>
          </div>

          <div className="glass-card rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Start a PRA</h2>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-text-muted">Product name</span>
                <input className="border rounded px-2 py-1.5" value={product} onChange={(e) => setProduct(e.target.value)} placeholder="Correspondent banking" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-text-muted">Legal entity</span>
                <input className="border rounded px-2 py-1.5" value={legalEntity} onChange={(e) => setLegalEntity(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-xs text-text-muted">Product description</span>
                <textarea className="border rounded px-2 py-1.5" value={description} onChange={(e) => setDescription(e.target.value)} />
              </label>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-text-muted">Customer types in scope</span>
                <div className="flex gap-3">
                  {["natural_person", "legal_person"].map((type) => (
                    <label key={type} className="flex items-center gap-1.5">
                      <input type="checkbox" checked={customerTypes.includes(type)} onChange={() => toggleCustomerType(type)} />
                      {type === "natural_person" ? "Natural person" : "Legal person"}
                    </label>
                  ))}
                </div>
              </div>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-text-muted">Template version</span>
                <select className="border rounded px-2 py-1.5" value={templateVersionId} onChange={(e) => setTemplateVersionId(e.target.value)}>
                  <option value="">Choose a confirmed template...</option>
                  {confirmedTemplateVersions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.templateName} v{v.version}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-text-muted">StylePack version</span>
                <select className="border rounded px-2 py-1.5" value={stylepackVersionId} onChange={(e) => setStylepackVersionId(e.target.value)}>
                  <option value="">Choose a StylePack...</option>
                  {stylepacks.flatMap((s) =>
                    s.versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {s.stylepack.name} v{v.version}
                      </option>
                    ))
                  )}
                </select>
              </label>
            </div>
            <p className="text-xs text-text-muted">
              {registerImports.length === 0
                ? "No register imported yet - controls will not be available for selection."
                : acceptedRegisterVersionId
                  ? "An accepted register version will be pinned to this PRA."
                  : "No accepted register version found yet."}
            </p>
            {message && <p className="text-sm text-red-600">{message}</p>}
            <button
              className="px-4 py-2 rounded bg-accent text-white text-sm disabled:opacity-50"
              disabled={busy || !product || customerTypes.length === 0 || !templateVersionId || !stylepackVersionId}
              onClick={startPra}
            >
              Start PRA
            </button>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">In progress</h2>
            {pras.length === 0 ? (
              <p className="text-sm text-text-muted">No PRA drafts yet.</p>
            ) : (
              <ul className="space-y-2">
                {pras.map((p) => (
                  <li key={p.id}>
                    <Link href={`/drafter/pras/${p.id}`} className="flex items-center justify-between text-sm hover:text-accent">
                      <span>{p.product}</span>
                      <Badge variant={p.status === "exported" ? "success" : "default"}>{p.status}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>
    </ToolFrame>
  );
}

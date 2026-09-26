"use client";

import { useEffect, useState } from "react";
import ToolFrame from "@/components/layout/ToolFrame";
import Badge from "@/components/ui/Badge";
import { drafterFetch } from "./drafterFetch";

interface DocumentSummary {
  id: string;
  filename: string;
  confirmed_doc_type: string | null;
  format: string;
}

interface SkeletonSection {
  number: string;
  title: string;
  lifecycleStage: string | null;
  customerType: string | null;
  standardWording: string | null;
  emptySectionWording: string | null;
  backofficeControlMap: string | null;
}

interface SkeletonExemplarCandidate {
  sectionNumber: string;
  sectionType: string;
  controlText: string;
  rationale: string;
  backofficeControlLabel: string | null;
  evidence: string | null;
}

interface FieldLabels {
  control_enhancement: string;
  control_enhancement_rationale: string;
  backoffice_control_impacted: string;
  evidence_of_delivery: string;
}

interface TemplateWithVersions {
  template: { id: string; name: string };
  versions: { id: string; version: number; confirmed: boolean }[];
}

interface StylepackWithVersions {
  stylepack: { id: string; name: string };
  versions: { id: string; version: number }[];
}

export default function DrafterTemplatesClient() {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [styleBriefDocuments, setStyleBriefDocuments] = useState<DocumentSummary[]>([]);
  const [selectedStyleBriefId, setSelectedStyleBriefId] = useState<string>("");
  const [templates, setTemplates] = useState<TemplateWithVersions[]>([]);
  const [stylepacks, setStylepacks] = useState<StylepackWithVersions[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>("");
  const [sections, setSections] = useState<SkeletonSection[] | null>(null);
  const [fieldLabels, setFieldLabels] = useState<FieldLabels | null>(null);
  const [candidates, setCandidates] = useState<SkeletonExemplarCandidate[]>([]);
  const [acceptedKeys, setAcceptedKeys] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = () => {
    drafterFetch<{ documents: DocumentSummary[] }>("/api/drafter/documents").then((r) => {
      if (r.ok && "documents" in r.data) {
        setDocuments(r.data.documents.filter((d) => d.confirmed_doc_type === "pra"));
        setStyleBriefDocuments(r.data.documents.filter((d) => d.confirmed_doc_type === "style_brief"));
      }
    });
    drafterFetch<{ templates: TemplateWithVersions[] }>("/api/drafter/templates").then((r) => {
      if (r.ok && "templates" in r.data) setTemplates(r.data.templates);
    });
    drafterFetch<{ stylepacks: StylepackWithVersions[] }>("/api/drafter/stylepacks").then((r) => {
      if (r.ok && "stylepacks" in r.data) setStylepacks(r.data.stylepacks);
    });
  };

  const createStylepack = async () => {
    setBusy(true);
    const r = await drafterFetch("/api/drafter/stylepacks", {
      method: "POST",
      body: JSON.stringify({ name: "House style", styleBriefDocumentId: selectedStyleBriefId || null }),
    });
    setBusy(false);
    if (r.ok) {
      setMessage("StylePack created, seeded from the SPEC style rules and settings.");
      reload();
    } else {
      setMessage("Could not create StylePack.");
    }
  };

  useEffect(reload, []);

  const extract = async () => {
    if (!selectedDocId) return;
    setBusy(true);
    setMessage(null);
    const r = await drafterFetch<{ skeleton: { sections: SkeletonSection[]; fieldLabels: FieldLabels; exemplarCandidates: SkeletonExemplarCandidate[]; warnings: string[] } }>(
      "/api/drafter/templates/extract",
      { method: "POST", body: JSON.stringify({ documentId: selectedDocId }) }
    );
    setBusy(false);
    if (!r.ok || !("skeleton" in r.data)) {
      setMessage("error" in r.data ? r.data.error ?? "Extraction failed" : "Extraction failed");
      return;
    }
    setSections(r.data.skeleton.sections);
    setFieldLabels(r.data.skeleton.fieldLabels);
    setCandidates(r.data.skeleton.exemplarCandidates);
    setAcceptedKeys(new Set(r.data.skeleton.exemplarCandidates.map((c) => c.sectionNumber)));
    if (r.data.skeleton.warnings.length) setMessage(`Extracted with warnings: ${r.data.skeleton.warnings.join("; ")}`);
  };

  const updateSection = (index: number, field: keyof SkeletonSection, value: string) => {
    if (!sections) return;
    const next = [...sections];
    next[index] = { ...next[index], [field]: value || null };
    setSections(next);
  };

  const createAndConfirm = async () => {
    if (!sections || !fieldLabels) return;
    setBusy(true);
    setMessage(null);
    const acceptedExemplars = candidates.filter((c) => acceptedKeys.has(c.sectionNumber));
    const created = await drafterFetch<{ template: { id: string }; version: { id: string } }>("/api/drafter/templates", {
      method: "POST",
      body: JSON.stringify({ documentId: selectedDocId, name: "Approved PRA template", sections, fieldLabels, acceptedExemplars }),
    });
    if (!created.ok || !("template" in created.data)) {
      setBusy(false);
      setMessage("error" in created.data ? created.data.error ?? "Could not create template" : "Could not create template");
      return;
    }
    const confirmed = await drafterFetch(`/api/drafter/templates/${created.data.template.id}/confirm`, {
      method: "POST",
      body: JSON.stringify({ versionId: created.data.version.id }),
    });
    setBusy(false);
    if (!confirmed.ok) {
      setMessage("Template created but could not be confirmed.");
      return;
    }
    setMessage("Template confirmed. It is now available to pin on a new PRA.");
    setSections(null);
    setFieldLabels(null);
    setCandidates([]);
    reload();
  };

  return (
    <ToolFrame breadcrumb={[{ label: "Home", href: "/drafter" }, { label: "PRA Drafter", href: "/drafter" }, { label: "Templates" }]}>
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Template and house style</h1>
            <p className="text-sm text-text-muted mt-1 max-w-2xl">
              Extract the section skeleton from a confirmed approved PRA, review and edit it, then confirm it as a
              versioned template. Approved PRA content is never copied into another product&apos;s draft - only its
              form, and any enhancement you accept below is kept as a style exemplar only.
            </p>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">Existing templates</h2>
            {templates.length === 0 ? (
              <p className="text-sm text-text-muted">No template yet.</p>
            ) : (
              <ul className="space-y-2">
                {templates.map((t) => (
                  <li key={t.template.id} className="text-sm flex items-center gap-2">
                    <span className="font-medium">{t.template.name}</span>
                    {t.versions.map((v) => (
                      <Badge key={v.id} variant={v.confirmed ? "success" : "default"}>
                        v{v.version} {v.confirmed ? "confirmed" : "draft"}
                      </Badge>
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="glass-card rounded-2xl p-6 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-lg font-semibold text-foreground">StylePacks</h2>
              <div className="flex items-center gap-2">
                <select className="border rounded px-2 py-1 text-sm" value={selectedStyleBriefId} onChange={(e) => setSelectedStyleBriefId(e.target.value)}>
                  <option value="">No style brief document</option>
                  {styleBriefDocuments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.filename ?? d.id}
                    </option>
                  ))}
                </select>
                <button className="px-3 py-1.5 rounded bg-accent text-white text-sm disabled:opacity-50" disabled={busy} onClick={createStylepack}>
                  New StylePack (seeded)
                </button>
              </div>
            </div>
            {stylepacks.length === 0 ? (
              <p className="text-sm text-text-muted">No StylePack yet - create one seeded from the house style rules and banned phrases.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {stylepacks.map((s) => (
                  <li key={s.stylepack.id} className="flex items-center gap-2">
                    <span className="font-medium">{s.stylepack.name}</span>
                    {s.versions.map((v) => (
                      <Badge key={v.id} variant="info">
                        v{v.version}
                      </Badge>
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="glass-card rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Extract a skeleton</h2>
            <div className="flex gap-2 items-center">
              <select
                className="border rounded px-3 py-2 text-sm flex-1"
                value={selectedDocId}
                onChange={(e) => setSelectedDocId(e.target.value)}
              >
                <option value="">Choose a confirmed approved PRA document...</option>
                {documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.filename}
                  </option>
                ))}
              </select>
              <button
                className="px-4 py-2 rounded bg-accent text-white text-sm disabled:opacity-50"
                disabled={!selectedDocId || busy}
                onClick={extract}
              >
                Extract
              </button>
            </div>
            {message && <p className="text-sm text-text-muted">{message}</p>}
          </div>

          {sections && fieldLabels && (
            <div className="glass-card rounded-2xl p-6 space-y-6">
              <h2 className="text-lg font-semibold text-foreground">Review and edit the skeleton</h2>

              <div className="space-y-4">
                {sections.map((s, i) => (
                  <div key={s.number} className="border border-border rounded-lg p-4 space-y-2">
                    <div className="grid sm:grid-cols-4 gap-2 text-sm">
                      <label className="flex flex-col gap-1">
                        <span className="text-xs text-text-muted">Number</span>
                        <input className="border rounded px-2 py-1" value={s.number} onChange={(e) => updateSection(i, "number", e.target.value)} />
                      </label>
                      <label className="flex flex-col gap-1 sm:col-span-2">
                        <span className="text-xs text-text-muted">Title</span>
                        <input className="border rounded px-2 py-1" value={s.title} onChange={(e) => updateSection(i, "title", e.target.value)} />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-xs text-text-muted">Customer type</span>
                        <select
                          className="border rounded px-2 py-1"
                          value={s.customerType ?? ""}
                          onChange={(e) => updateSection(i, "customerType", e.target.value)}
                        >
                          <option value="">(none)</option>
                          <option value="natural_person">Natural person</option>
                          <option value="legal_person">Legal person</option>
                          <option value="both">Both</option>
                        </select>
                      </label>
                    </div>
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="text-xs text-text-muted">Back office control map</span>
                      <input
                        className="border rounded px-2 py-1"
                        value={s.backofficeControlMap ?? ""}
                        onChange={(e) => updateSection(i, "backofficeControlMap", e.target.value)}
                      />
                      {!s.backofficeControlMap?.trim() && (
                        <span className="text-xs text-amber-700">
                          No back office control mapped to this section (this happens when the approved PRA had no enhancement here). Any
                          control tagged with this back office control will come back &quot;unassigned&quot; when drafting a PRA - it will be
                          listed, never silently dropped - but the fix is to set the map here first.
                        </span>
                      )}
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="text-xs text-text-muted">Standard opening wording</span>
                      <textarea
                        className="border rounded px-2 py-1"
                        value={s.standardWording ?? ""}
                        onChange={(e) => updateSection(i, "standardWording", e.target.value)}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="text-xs text-text-muted">Empty-section wording</span>
                      <textarea
                        className="border rounded px-2 py-1"
                        value={s.emptySectionWording ?? ""}
                        onChange={(e) => updateSection(i, "emptySectionWording", e.target.value)}
                      />
                    </label>
                  </div>
                ))}
              </div>

              <div className="grid sm:grid-cols-2 gap-2 text-sm">
                {(Object.keys(fieldLabels) as (keyof FieldLabels)[]).map((key) => (
                  <label key={key} className="flex flex-col gap-1">
                    <span className="text-xs text-text-muted">{key.replace(/_/g, " ")}</span>
                    <input
                      className="border rounded px-2 py-1"
                      value={fieldLabels[key]}
                      onChange={(e) => setFieldLabels({ ...fieldLabels, [key]: e.target.value })}
                    />
                  </label>
                ))}
              </div>

              {candidates.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">Exemplar candidates (kept as style reference only)</h3>
                  <ul className="space-y-2">
                    {candidates.map((c) => (
                      <li key={c.sectionNumber} className="text-sm border border-border rounded p-3">
                        <label className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={acceptedKeys.has(c.sectionNumber)}
                            onChange={(e) => {
                              const next = new Set(acceptedKeys);
                              if (e.target.checked) next.add(c.sectionNumber);
                              else next.delete(c.sectionNumber);
                              setAcceptedKeys(next);
                            }}
                          />
                          <span>
                            <span className="font-medium">{c.sectionNumber} {c.sectionType}</span>
                            <p className="text-text-muted mt-1">{c.controlText}</p>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <button className="px-4 py-2 rounded bg-accent text-white text-sm disabled:opacity-50" disabled={busy} onClick={createAndConfirm}>
                Confirm as template
              </button>
            </div>
          )}
        </div>
      </main>
    </ToolFrame>
  );
}

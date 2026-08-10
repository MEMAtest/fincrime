"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Link2, Trash2 } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import type { WorkspaceControlDTO, ControlChangeListItem } from "@/components/change-lab/types";
import type { ControlTestListItem } from "@/components/control-testing/types";
import type { AssessmentListItem } from "@/components/pra/types";
import { enforcementCases } from "@/data/enforcement/cases";
import { caseSlug } from "@/lib/enforcement/case-slug";
import {
  INCIDENT_LINK_TYPE_LABEL,
  ROOT_CAUSE_CATEGORY_LABEL,
  type IncidentDTO,
  type IncidentLinkType,
  type IncidentRootCauseCategory,
  type ResolvedIncidentLinkDTO,
} from "./types";

const CATEGORIES = Object.keys(ROOT_CAUSE_CATEGORY_LABEL) as IncidentRootCauseCategory[];
const LINK_TYPES = Object.keys(INCIDENT_LINK_TYPE_LABEL) as IncidentLinkType[];

export interface RootCauseFields {
  rootCause: string | null;
  rootCauseCategory: IncidentRootCauseCategory | null;
}

export interface NewLinkPayload {
  linkType: IncidentLinkType;
  targetId?: string;
  targetRef?: string;
  note?: string;
}

interface StepRootCauseProps {
  incident: IncidentDTO;
  links: ResolvedIncidentLinkDTO[];
  controls: WorkspaceControlDTO[];
  changes: ControlChangeListItem[];
  tests: ControlTestListItem[];
  assessments: AssessmentListItem[];
  readOnly: boolean;
  onSave: (fields: Partial<RootCauseFields>) => Promise<{ ok: true } | { ok: false; message: string }>;
  onAddLink: (payload: NewLinkPayload) => Promise<{ ok: true } | { ok: false; message: string }>;
  onRemoveLink: (linkId: string) => Promise<boolean>;
}

/** Step 4: root cause narrative and category, plus the traceability links panel - the field that connects this incident to the control that let it through, the change or test that touches it, the assessment that scoped it, or a matching enforcement case. */
export default function StepRootCause({
  incident,
  links,
  controls,
  changes,
  tests,
  assessments,
  readOnly,
  onSave,
  onAddLink,
  onRemoveLink,
}: StepRootCauseProps) {
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [linkType, setLinkType] = useState<IncidentLinkType>("failed_control");
  const [targetId, setTargetId] = useState("");
  const [firmQuery, setFirmQuery] = useState("");
  const [enforcementSlug, setEnforcementSlug] = useState("");
  const [note, setNote] = useState("");
  const [addingLink, setAddingLink] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function commit(fields: Partial<RootCauseFields>) {
    if (readOnly) return;
    setSaving(true);
    setFieldError(null);
    try {
      const result = await onSave(fields);
      if (!result.ok) setFieldError(result.message);
    } finally {
      setSaving(false);
    }
  }

  const enforcementMatches = useMemo(() => {
    const q = firmQuery.trim().toLowerCase();
    if (!q) return [];
    return enforcementCases
      .filter((c) => c.firm.toLowerCase().includes(q))
      .slice(0, 8)
      .map((c) => ({ slug: caseSlug(c.firm, c.year), label: `${c.firm} (${c.year})` }));
  }, [firmQuery]);

  function resetLinkForm() {
    setTargetId("");
    setFirmQuery("");
    setEnforcementSlug("");
    setNote("");
  }

  async function submitLink() {
    setLinkError(null);
    if (linkType === "enforcement_case") {
      if (!enforcementSlug) {
        setLinkError("Search for and pick an enforcement case first.");
        return;
      }
    } else if (!targetId) {
      setLinkError("Pick a target to link.");
      return;
    }

    setAddingLink(true);
    try {
      const result = await onAddLink({
        linkType,
        targetId: linkType === "enforcement_case" ? undefined : targetId,
        targetRef: linkType === "enforcement_case" ? enforcementSlug : undefined,
        note: note.trim() || undefined,
      });
      if (result.ok) {
        resetLinkForm();
      } else {
        setLinkError(result.message);
      }
    } finally {
      setAddingLink(false);
    }
  }

  async function removeLink(id: string) {
    setRemovingId(id);
    try {
      await onRemoveLink(id);
    } finally {
      setRemovingId(null);
    }
  }

  const hasFailedControlLink = links.some((l) => l.link.link_type === "failed_control");

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Root cause and traceability</h2>
        <p className="text-sm text-text-muted">
          Explain why this happened, then link this incident to the control, change, test, assessment or enforcement
          case it connects to. These links are the point: they are what lets a regulator trace a risk to a control,
          to a test, to this incident, to the remediation that followed.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink-soft">Root cause narrative</label>
        <textarea
          key={`${incident.id}-rootCause`}
          defaultValue={incident.root_cause ?? ""}
          disabled={readOnly}
          rows={5}
          placeholder="Why did this happen? What underlying condition allowed it?"
          onBlur={(e) => {
            const v = e.target.value.trim() || null;
            if (v !== incident.root_cause) void commit({ rootCause: v });
          }}
          className="w-full px-3.5 py-2.5 rounded-lg border border-line-2 bg-surface text-foreground text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors disabled:opacity-60"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink-soft">Root cause category</label>
        <select
          key={`${incident.id}-rootCauseCategory`}
          defaultValue={incident.root_cause_category ?? ""}
          disabled={readOnly}
          onChange={(e) => void commit({ rootCauseCategory: (e.target.value || null) as IncidentRootCauseCategory | null })}
          className="w-full sm:w-80 px-3.5 py-2.5 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors disabled:opacity-60"
        >
          <option value="">Not specified</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {ROOT_CAUSE_CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
      </div>

      {saving && <p className="text-xs text-text-muted">Saving...</p>}
      {fieldError && <p className="text-xs text-red-500">{fieldError}</p>}

      {/* Traceability links */}
      <div className="pt-4 border-t border-white/10 space-y-4">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-semibold text-foreground">Traceability links</h3>
        </div>

        {!hasFailedControlLink && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              No <strong>failed control</strong> link yet. This is the most important link on this record: it
              connects this incident to the control that let it through.
            </span>
          </div>
        )}

        <div className="space-y-2">
          {links.length === 0 && <p className="text-sm text-text-muted">No links recorded yet.</p>}
          {links.map(({ link, label }) => (
            <div
              key={link.id}
              className="flex items-center justify-between gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/10"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={link.link_type === "failed_control" ? "danger" : "default"}>
                    {INCIDENT_LINK_TYPE_LABEL[link.link_type]}
                  </Badge>
                  <span className="text-sm text-foreground truncate">{label ?? "Target no longer available"}</span>
                </div>
                {link.note && <p className="text-xs text-text-muted mt-1">{link.note}</p>}
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => void removeLink(link.id)}
                  disabled={removingId === link.id}
                  aria-label="Remove link"
                  className="p-1.5 text-text-muted hover:text-red-500 cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        {!readOnly && (
          <div className="glass-card rounded-xl p-4 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-ink-soft">Link type</label>
                <select
                  value={linkType}
                  onChange={(e) => {
                    setLinkType(e.target.value as IncidentLinkType);
                    resetLinkForm();
                  }}
                  className="px-3 py-2 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                >
                  {LINK_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {INCIDENT_LINK_TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
              </div>

              {linkType === "failed_control" && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-ink-soft">Control</label>
                  <select
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                  >
                    <option value="">Select a control...</option>
                    {controls.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {linkType === "control_change" && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-ink-soft">Control change</label>
                  <select
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                  >
                    <option value="">Select a change...</option>
                    {changes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {linkType === "control_test" && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-ink-soft">Control test</label>
                  <select
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                  >
                    <option value="">Select a test...</option>
                    {tests.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {linkType === "pra_assessment" && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-ink-soft">PRA assessment</label>
                  <select
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                  >
                    <option value="">Select an assessment...</option>
                    {assessments.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.productName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {linkType === "enforcement_case" && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-ink-soft">Search by firm name</label>
                  <input
                    value={enforcementSlug ? firmQuery : firmQuery}
                    onChange={(e) => {
                      setFirmQuery(e.target.value);
                      setEnforcementSlug("");
                    }}
                    placeholder="e.g. Barclays"
                    className="px-3 py-2 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                  />
                  {enforcementMatches.length > 0 && !enforcementSlug && (
                    <div className="border border-line-2 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                      {enforcementMatches.map((m) => (
                        <button
                          key={m.slug}
                          type="button"
                          onClick={() => {
                            setEnforcementSlug(m.slug);
                            setFirmQuery(m.label);
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-accent/10 cursor-pointer"
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {enforcementSlug && <p className="text-xs text-accent">Selected: {firmQuery}</p>}
                </div>
              )}
            </div>

            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note (optional)"
              className="w-full px-3 py-2 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            />

            {linkError && <p className="text-xs text-red-500">{linkError}</p>}
            <Button size="sm" onClick={submitLink} disabled={addingLink}>
              {addingLink ? "Adding..." : "Add link"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

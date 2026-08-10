"use client";

import { useMemo, useState } from "react";
import { Link2, Trash2 } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import type { WorkspaceControlDTO, ControlChangeListItem } from "@/components/change-lab/types";
import type { ControlTestListItem } from "@/components/control-testing/types";
import type { IncidentListItem } from "@/components/incidents/types";
import type { ReadinessListItem } from "@/components/readiness/types";
import type { AssessmentListItem } from "@/components/pra/types";
import {
  REG_QUESTION_LINK_TYPE_LABEL,
  type EvidenceDTO,
  type RegQuestionDTO,
  type RegQuestionLinkDTO,
  type RegQuestionLinkType,
} from "./types";

const LINK_TYPES: RegQuestionLinkType[] = [
  "workspace_control",
  "control_test",
  "control_change",
  "incident",
  "readiness_assessment",
  "pra_assessment",
  "evidence",
];

export interface NewLinkPayload {
  linkType: RegQuestionLinkType;
  targetId: string;
  note?: string;
}

interface StepSubstantiationProps {
  questions: RegQuestionDTO[];
  controls: WorkspaceControlDTO[];
  tests: ControlTestListItem[];
  changes: ControlChangeListItem[];
  incidents: IncidentListItem[];
  readinessAssessments: ReadinessListItem[];
  praAssessments: AssessmentListItem[];
  evidence: EvidenceDTO[];
  readOnly: boolean;
  onAddLink: (questionId: string, payload: NewLinkPayload) => Promise<{ ok: true } | { ok: false; message: string }>;
  onRemoveLink: (questionId: string, linkId: string) => Promise<boolean>;
}

interface LinkDraft {
  linkType: RegQuestionLinkType;
  targetId: string;
  note: string;
}

const EMPTY_DRAFT: LinkDraft = { linkType: "workspace_control", targetId: "", note: "" };

/**
 * Step 4: substantiation. Every question can be backed by real workspace
 * records - a control, a control test, a control change, an incident, a
 * readiness or PRA assessment, or request-level evidence - so an assertion
 * in a response is never just prose. Each picker's list is fetched once by
 * the journey shell and handed down as a prop rather than being re-fetched
 * per question. Labels are resolved client-side against those same lists
 * (the API does not pre-resolve reg_question_links, unlike incidents'
 * ResolvedIncidentLinkDTO), falling back to "Target no longer available" if
 * the id is not found in the loaded list.
 */
export default function StepSubstantiation({
  questions,
  controls,
  tests,
  changes,
  incidents,
  readinessAssessments,
  praAssessments,
  evidence,
  readOnly,
  onAddLink,
  onRemoveLink,
}: StepSubstantiationProps) {
  const [draftByQuestion, setDraftByQuestion] = useState<Record<string, LinkDraft>>({});
  const [addingId, setAddingId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});
  const [removingId, setRemovingId] = useState<string | null>(null);

  const controlById = useMemo(() => new Map(controls.map((c) => [c.id, c])), [controls]);
  const testById = useMemo(() => new Map(tests.map((t) => [t.id, t])), [tests]);
  const changeById = useMemo(() => new Map(changes.map((c) => [c.id, c])), [changes]);
  const incidentById = useMemo(() => new Map(incidents.map((i) => [i.id, i])), [incidents]);
  const readinessById = useMemo(() => new Map(readinessAssessments.map((r) => [r.id, r])), [readinessAssessments]);
  const praById = useMemo(() => new Map(praAssessments.map((a) => [a.id, a])), [praAssessments]);
  const evidenceById = useMemo(() => new Map(evidence.map((e) => [e.id, e])), [evidence]);

  function resolveLabel(link: RegQuestionLinkDTO): string {
    switch (link.link_type) {
      case "workspace_control":
        return controlById.get(link.target_id)?.name ?? "Target no longer available";
      case "control_test":
        return testById.get(link.target_id)?.title ?? "Target no longer available";
      case "control_change":
        return changeById.get(link.target_id)?.title ?? "Target no longer available";
      case "incident":
        return incidentById.get(link.target_id)?.title ?? "Target no longer available";
      case "readiness_assessment":
        return readinessById.get(link.target_id)?.title ?? "Target no longer available";
      case "pra_assessment":
        return praById.get(link.target_id)?.productName ?? "Target no longer available";
      case "evidence":
        return evidenceById.get(link.target_id)?.title ?? "Target no longer available";
      default:
        return "Target no longer available";
    }
  }

  function draftFor(questionId: string): LinkDraft {
    return draftByQuestion[questionId] ?? EMPTY_DRAFT;
  }
  function setDraftFor(questionId: string, patch: Partial<LinkDraft>) {
    setDraftByQuestion((prev) => ({ ...prev, [questionId]: { ...draftFor(questionId), ...patch } }));
  }

  async function submitLink(questionId: string) {
    const draft = draftFor(questionId);
    if (!draft.targetId) return;
    setAddingId(questionId);
    setErrorById((prev) => ({ ...prev, [questionId]: "" }));
    try {
      const result = await onAddLink(questionId, { linkType: draft.linkType, targetId: draft.targetId, note: draft.note.trim() || undefined });
      if (result.ok) {
        setDraftByQuestion((prev) => ({ ...prev, [questionId]: { ...EMPTY_DRAFT, linkType: draft.linkType } }));
      } else {
        setErrorById((prev) => ({ ...prev, [questionId]: result.message }));
      }
    } finally {
      setAddingId((id) => (id === questionId ? null : id));
    }
  }

  async function removeLink(questionId: string, linkId: string) {
    setRemovingId(linkId);
    try {
      await onRemoveLink(questionId, linkId);
    } finally {
      setRemovingId((id) => (id === linkId ? null : id));
    }
  }

  function optionsFor(linkType: RegQuestionLinkType): { value: string; label: string }[] {
    switch (linkType) {
      case "workspace_control":
        return controls.map((c) => ({ value: c.id, label: c.name }));
      case "control_test":
        return tests.map((t) => ({ value: t.id, label: t.title }));
      case "control_change":
        return changes.map((c) => ({ value: c.id, label: c.title }));
      case "incident":
        return incidents.map((i) => ({ value: i.id, label: i.title }));
      case "readiness_assessment":
        return readinessAssessments.map((r) => ({ value: r.id, label: r.title }));
      case "pra_assessment":
        return praAssessments.map((a) => ({ value: a.id, label: a.productName }));
      case "evidence":
        return evidence.map((e) => ({ value: e.id, label: e.title }));
      default:
        return [];
    }
  }

  if (questions.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-1">Substantiation</h2>
          <p className="text-sm text-text-muted">Add questions first.</p>
        </div>
      </div>
    );
  }

  const sorted = [...questions].sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Substantiation</h2>
        <p className="text-sm text-text-muted">
          Link each question to the real control, test, change, incident or assessment that backs it up. This is what
          turns an assertion in a response into evidence, rather than leaving it as unsupported prose.
        </p>
      </div>

      <div className="space-y-4">
        {sorted.map((q, index) => {
          const draft = draftFor(q.id);
          const options = optionsFor(draft.linkType);
          return (
            <div key={q.id} className="glass-card rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-foreground">
                #{index + 1}. {q.question}
              </p>

              <div className="space-y-1.5">
                {q.links.length === 0 ? (
                  <p className="text-xs text-text-muted">No substantiating links yet.</p>
                ) : (
                  q.links.map((link) => (
                    <div
                      key={link.id}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-white/[0.02] border border-white/10"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge>{REG_QUESTION_LINK_TYPE_LABEL[link.link_type]}</Badge>
                          <span className="text-sm text-foreground truncate">{resolveLabel(link)}</span>
                        </div>
                        {link.note && <p className="text-xs text-text-muted mt-1">{link.note}</p>}
                      </div>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => void removeLink(q.id, link.id)}
                          disabled={removingId === link.id}
                          aria-label="Remove link"
                          className="p-1.5 text-text-muted hover:text-red-500 cursor-pointer disabled:opacity-50 shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>

              {!readOnly && (
                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/10 space-y-2">
                  <div className="grid sm:grid-cols-2 gap-2">
                    <select
                      value={draft.linkType}
                      onChange={(e) => setDraftFor(q.id, { linkType: e.target.value as RegQuestionLinkType, targetId: "" })}
                      className="px-2.5 py-1.5 rounded-lg border border-line-2 bg-surface text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                    >
                      {LINK_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {REG_QUESTION_LINK_TYPE_LABEL[t]}
                        </option>
                      ))}
                    </select>
                    <select
                      value={draft.targetId}
                      onChange={(e) => setDraftFor(q.id, { targetId: e.target.value })}
                      className="px-2.5 py-1.5 rounded-lg border border-line-2 bg-surface text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                    >
                      <option value="">Select...</option>
                      {options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {options.length === 0 && (
                    <p className="text-xs text-text-muted">Nothing available for this link type yet.</p>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      value={draft.note}
                      onChange={(e) => setDraftFor(q.id, { note: e.target.value })}
                      placeholder="Note (optional)"
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-line-2 bg-surface text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                    />
                    <Button size="sm" onClick={() => void submitLink(q.id)} disabled={addingId === q.id || !draft.targetId}>
                      <Link2 className="h-3.5 w-3.5" /> Add link
                    </Button>
                  </div>
                  {errorById[q.id] && <p className="text-xs text-red-500">{errorById[q.id]}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

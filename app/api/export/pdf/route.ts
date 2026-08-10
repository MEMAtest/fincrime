import { NextRequest, NextResponse } from "next/server";
import { generateTypologyPDF } from "@/lib/pdf/typology-pdf";
import { generatePartnerPDF } from "@/lib/pdf/partner-pdf";
import { generateScreeningPDF } from "@/lib/pdf/screening-pdf";
import { generateMaturityPDF } from "@/lib/pdf/maturity-pdf";
import { generateKycPDF } from "@/lib/pdf/kyc-pdf";
import { generateControlRegisterPDF } from "@/lib/pdf/control-register-pdf";
import { generatePraPDF } from "@/lib/pdf/pra-pdf";
import { generateChangePDF } from "@/lib/pdf/change-pdf";
import { generateTestPDF } from "@/lib/pdf/test-pdf";
import { generateIncidentPDF } from "@/lib/pdf/incident-pdf";
import { generateReadinessPDF } from "@/lib/pdf/readiness-pdf";
import { generateRegResponsePDF } from "@/lib/pdf/reg-response-pdf";
import { generateGovernancePDF, type GovernancePackPayload } from "@/lib/pdf/governance-pdf";
import { generateKycDocx } from "@/lib/docx/kyc-docx";
import { getAuthenticatedWorkspace } from "@/lib/workspace-auth";
import { updateWorkspace } from "@/lib/repo/workspace";
import { resolveWorkspaceSettings } from "@/lib/workspace/settings";
import { loadGovernancePortfolio } from "@/lib/governance/load";
import type { PraExportPayload } from "@/components/pra/types";
import type { ChangeExportPayload } from "@/components/change-lab/types";
import type { TestExportPayload } from "@/components/control-testing/types";
import type { IncidentExportPayload } from "@/components/incidents/types";
import type { ReadinessExportPayload } from "@/components/readiness/types";
import type { RegResponseExportPayload } from "@/components/reg-response/types";
import { getControlBySlug } from "@/data/controls";
import type { ControlOverride } from "@/data/controls/types";
import { buildMergedRequirements } from "@/data/kyc/merge";
import { coerceList } from "@/lib/list-params";
import { ENTITY_ORDER, JURISDICTION_ORDER } from "@/data/kyc/types";
import type { EntityType, Jurisdiction, RiskLevel } from "@/data/kyc/types";
import { scoreTypologies, normalizeAnswers } from "@/data/scoring/typology-scoring";
import { scorePartnerRisk } from "@/data/scoring/partner-scoring";
import { getBestScreeningMatch } from "@/data/scoring/screening-scoring";
import { scoreMaturity } from "@/data/scoring/maturity-scoring";
import type { FirmType } from "@/data/typologies/types";
import type { ModelType, FlowType, Actor, ControlOwnership } from "@/data/partner-flows/types";
import type { ScreeningCategory, ScreeningTrigger } from "@/data/screening/types";
import type { ControlArea, MaturityLevel } from "@/data/maturity/types";

const MODULE_TITLE: Record<string, string> = {
  typology_iq: "TypologyIQ",
  partner_control_map: "PartnerControlMap",
  screening_controls: "Screening Control Designer",
  controls_maturity: "Controls Maturity Assessment",
  kyc_requirements: "KYC / CDD Requirements Matrix",
  control_register: "Control Register",
  pra_assessment: "Product Risk Assessment",
  control_change: "Control Change",
  control_test: "Control Test Report",
  incident: "Incident Report",
  readiness: "Entity & Market Readiness Pack",
  reg_response: "Regulatory Response Pack",
  governance_pack: "Governance Pack",
};

/** Loose runtime check of the core fields the PRA committee pack needs before handing the payload to jsPDF - the client (not a DB row) is the source of truth here, so this is the only validation. */
function isValidPraExportPayload(value: unknown): value is PraExportPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const opLoad = v.opLoad as Record<string, unknown> | null;
  return (
    typeof v.productName === "string" &&
    Array.isArray(v.risks) &&
    v.risks.every((r) => r && typeof r === "object" && Array.isArray((r as Record<string, unknown>).controls)) &&
    Array.isArray(v.gaps) &&
    Array.isArray(v.conditions) &&
    Array.isArray(v.actions) &&
    Array.isArray(v.evidence) &&
    Array.isArray(v.flows) &&
    Array.isArray(v.customers) &&
    Array.isArray(v.jurisdictions) &&
    Array.isArray(v.channels) &&
    typeof opLoad === "object" &&
    opLoad !== null &&
    typeof opLoad.alertsPerMonth === "number" &&
    typeof opLoad.analystHoursPerMonth === "number" &&
    typeof opLoad.fte === "number" &&
    typeof opLoad.monthlyCostGbp === "number"
  );
}

/** number, or null - never NaN/Infinity, never a stray string/object/array. */
function isNumOrNull(v: unknown): v is number | null {
  return v === null || (typeof v === "number" && Number.isFinite(v));
}
/** string, or null - the shape every free-text field in ChangeExportPayload uses. */
function isStrOrNull(v: unknown): v is string | null {
  return v === null || typeof v === "string";
}

function isValidChangeEvidence(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const e = v as Record<string, unknown>;
  return typeof e.title === "string" && typeof e.type === "string" && isStrOrNull(e.description) && isStrOrNull(e.linkUrl) && isStrOrNull(e.fileName) && isNumOrNull(e.fileSizeBytes);
}

function isValidChangeCondition(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const c = v as Record<string, unknown>;
  return typeof c.description === "string" && isStrOrNull(c.dueDate) && isStrOrNull(c.ownerName) && typeof c.status === "string";
}

function isValidChangeAction(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const a = v as Record<string, unknown>;
  return (
    typeof a.title === "string" &&
    isStrOrNull(a.ownerName) &&
    isStrOrNull(a.dueDate) &&
    typeof a.priority === "string" &&
    typeof a.status === "string"
  );
}

function isValidChangeMonitoringRow(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const m = v as Record<string, unknown>;
  return typeof m.metric === "string" && typeof m.target === "string" && typeof m.owner === "string" && typeof m.reviewDate === "string";
}

/**
 * Runtime check of the control-change pack payload before handing it to
 * jsPDF - the client (not a DB row) is the source of truth here, mirroring
 * isValidPraExportPayload above. Every numeric key is checked as number|null
 * and every array element is checked as an object with the exact string
 * fields lib/pdf/change-pdf.ts reads, so a partial/hostile payload (e.g.
 * supportingData: {}, evidence: [null], changeType: 5) 400s here instead of
 * 500ing inside jsPDF/.toLocaleString().
 */
function isValidChangeExportPayload(value: unknown): value is ChangeExportPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const supportingData = v.supportingData as Record<string, unknown> | null;
  const impact = v.impact as Record<string, unknown> | null;

  if (typeof v.changeTitle !== "string" || typeof v.controlName !== "string" || typeof v.status !== "string") return false;
  if (v.changeType !== null && typeof v.changeType !== "string") return false;
  if (!isStrOrNull(v.rationale)) return false;

  if (!Array.isArray(v.fieldDiffs)) return false;
  if (
    !v.fieldDiffs.every(
      (f) =>
        f &&
        typeof f === "object" &&
        typeof (f as Record<string, unknown>).label === "string" &&
        typeof (f as Record<string, unknown>).current === "string" &&
        typeof (f as Record<string, unknown>).proposed === "string" &&
        typeof (f as Record<string, unknown>).changed === "boolean"
    )
  ) {
    return false;
  }
  if (typeof v.changedFieldCount !== "number") return false;

  if (typeof supportingData !== "object" || supportingData === null) return false;
  if (
    !isNumOrNull(supportingData.baselineAlertVolume) ||
    !isNumOrNull(supportingData.truePositives) ||
    !isNumOrNull(supportingData.falsePositives) ||
    !isNumOrNull(supportingData.expectedVolume) ||
    !isStrOrNull(supportingData.testingNotes)
  ) {
    return false;
  }

  if (typeof impact !== "object" || impact === null) return false;
  if (
    !isNumOrNull(impact.beforeAnalystHoursPerMonth) ||
    !isNumOrNull(impact.afterAnalystHoursPerMonth) ||
    !isNumOrNull(impact.beforeFte) ||
    !isNumOrNull(impact.afterFte) ||
    !isNumOrNull(impact.beforeMonthlyCostGbp) ||
    !isNumOrNull(impact.afterMonthlyCostGbp) ||
    !isStrOrNull(impact.customerFrictionNotes) ||
    !isStrOrNull(impact.riskImpactNotes)
  ) {
    return false;
  }

  if (v.decision !== null) {
    if (!v.decision || typeof v.decision !== "object") return false;
    const d = v.decision as Record<string, unknown>;
    if (typeof d.outcome !== "string" || typeof d.decidedByName !== "string" || typeof d.decidedAt !== "string" || !isStrOrNull(d.rationale)) {
      return false;
    }
  }

  if (!Array.isArray(v.evidence) || !v.evidence.every(isValidChangeEvidence)) return false;
  if (!Array.isArray(v.conditions) || !v.conditions.every(isValidChangeCondition)) return false;
  if (!Array.isArray(v.actions) || !v.actions.every(isValidChangeAction)) return false;
  if (!Array.isArray(v.monitoring) || !v.monitoring.every(isValidChangeMonitoringRow)) return false;
  if (typeof v.pilot !== "boolean") return false;
  if (!isStrOrNull(v.pilotNotes)) return false;
  if (!isStrOrNull(v.rollbackCriteria)) return false;
  if (!isStrOrNull(v.implementedAt)) return false;
  if (!isStrOrNull(v.rolledBackAt)) return false;
  if (v.appliedVersion !== null && typeof v.appliedVersion !== "number") return false;

  return true;
}

function isValidTestExportFinding(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const f = v as Record<string, unknown>;
  return typeof f.description === "string" && typeof f.severity === "string" && isStrOrNull(f.sampleRef) && typeof f.hasAction === "boolean";
}

function isValidTestExportAction(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const a = v as Record<string, unknown>;
  return (
    typeof a.title === "string" &&
    isStrOrNull(a.ownerName) &&
    isStrOrNull(a.dueDate) &&
    typeof a.priority === "string" &&
    typeof a.status === "string"
  );
}

function isValidTestExportEvidence(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const e = v as Record<string, unknown>;
  return typeof e.title === "string" && typeof e.type === "string" && isStrOrNull(e.description) && isStrOrNull(e.linkUrl) && isStrOrNull(e.fileName) && isNumOrNull(e.fileSizeBytes);
}

/**
 * Runtime check of the control-test report payload before handing it to
 * jsPDF - the client (not a DB row) is the source of truth here, mirroring
 * isValidChangeExportPayload above. Every numeric key is checked as
 * number|null and every array element is checked as an object with the exact
 * string fields lib/pdf/test-pdf.ts reads, so a partial/hostile payload
 * (e.g. findings: [null], sampleSize: "5") 400s here instead of 500ing
 * inside jsPDF/.toLocaleString().
 */
function isValidTestExportPayload(value: unknown): value is TestExportPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;

  if (typeof v.testTitle !== "string" || typeof v.controlName !== "string" || typeof v.status !== "string") return false;
  if (!isStrOrNull(v.controlSlug)) return false;
  if (v.method !== null && typeof v.method !== "string") return false;
  if (!isStrOrNull(v.periodStart) || !isStrOrNull(v.periodEnd) || !isStrOrNull(v.testerName)) return false;

  if (!isNumOrNull(v.sampleSize) || !isNumOrNull(v.samplesPassed) || !isNumOrNull(v.samplesFailed) || !isNumOrNull(v.samplesPartial)) {
    return false;
  }
  if (!isNumOrNull(v.passRatePct)) return false;
  if (v.derivedResult !== null && typeof v.derivedResult !== "string") return false;
  if (v.appliedRating !== null && typeof v.appliedRating !== "string") return false;
  if (v.appliedVersion !== null && typeof v.appliedVersion !== "number") return false;
  if (!isStrOrNull(v.testedAt) || !isStrOrNull(v.nextTestDue) || !isStrOrNull(v.conclusion)) return false;

  if (!Array.isArray(v.findings) || !v.findings.every(isValidTestExportFinding)) return false;
  if (!Array.isArray(v.actions) || !v.actions.every(isValidTestExportAction)) return false;
  if (!Array.isArray(v.evidence) || !v.evidence.every(isValidTestExportEvidence)) return false;

  return true;
}

function isValidIncidentExportLink(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const l = v as Record<string, unknown>;
  return typeof l.linkType === "string" && typeof l.label === "string" && isStrOrNull(l.note);
}

function isValidIncidentExportAction(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const a = v as Record<string, unknown>;
  return (
    typeof a.title === "string" &&
    isStrOrNull(a.ownerName) &&
    isStrOrNull(a.dueDate) &&
    typeof a.priority === "string" &&
    typeof a.status === "string"
  );
}

function isValidIncidentExportEvidence(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const e = v as Record<string, unknown>;
  return typeof e.title === "string" && typeof e.type === "string" && isStrOrNull(e.description) && isStrOrNull(e.linkUrl) && isStrOrNull(e.fileName) && isNumOrNull(e.fileSizeBytes);
}

/**
 * Runtime check of the incident report payload before handing it to jsPDF -
 * the client (not a DB row) is the source of truth here, mirroring
 * isValidTestExportPayload above. Every numeric key is checked as
 * number|null and every array element is checked as an object with the exact
 * string fields lib/pdf/incident-pdf.ts reads, so a partial/hostile payload
 * (e.g. links: [null], affectedPopulation: {}) 400s here instead of 500ing
 * inside jsPDF/.toLocaleString().
 */
function isValidIncidentExportPayload(value: unknown): value is IncidentExportPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const pop = v.affectedPopulation as Record<string, unknown> | null;

  if (!isStrOrNull(v.reference) || typeof v.title !== "string" || typeof v.severity !== "string" || typeof v.status !== "string") {
    return false;
  }
  if (v.source !== null && typeof v.source !== "string") return false;
  if (!isStrOrNull(v.ownerName)) return false;
  if (!isStrOrNull(v.occurredAt) || !isStrOrNull(v.detectedAt) || !isStrOrNull(v.containedAt) || !isStrOrNull(v.closedAt)) return false;
  if (!isStrOrNull(v.summary) || !isStrOrNull(v.containment)) return false;

  if (typeof pop !== "object" || pop === null) return false;
  if (
    !isNumOrNull(pop.customersAffected) ||
    !isNumOrNull(pop.transactionsAffected) ||
    !isNumOrNull(pop.valueGbp) ||
    !isStrOrNull(pop.identificationMethod) ||
    !isStrOrNull(pop.notes)
  ) {
    return false;
  }

  if (!isStrOrNull(v.rootCause)) return false;
  if (v.rootCauseCategory !== null && typeof v.rootCauseCategory !== "string") return false;

  if (!Array.isArray(v.links) || !v.links.every(isValidIncidentExportLink)) return false;
  if (!Array.isArray(v.actions) || !v.actions.every(isValidIncidentExportAction)) return false;
  if (!Array.isArray(v.evidence) || !v.evidence.every(isValidIncidentExportEvidence)) return false;

  if (!isStrOrNull(v.closureSummary)) return false;
  if (typeof v.reportable !== "boolean") return false;
  if (!isStrOrNull(v.reportedAt) || !isStrOrNull(v.regulatorReference)) return false;

  return true;
}

function isValidReadinessExportSource(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  return typeof s.org === "string" && typeof s.reference === "string" && typeof s.title === "string" && typeof s.url === "string";
}

function isValidReadinessExportObligation(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.category === "string" &&
    typeof o.title === "string" &&
    isStrOrNull(o.ruleSummary) &&
    isStrOrNull(o.controlName) &&
    typeof o.gap === "string" &&
    typeof o.blocker === "boolean" &&
    isStrOrNull(o.ownerName) &&
    isStrOrNull(o.dueDate) &&
    Array.isArray(o.legalBasis) &&
    o.legalBasis.every(isValidReadinessExportSource) &&
    Array.isArray(o.actions) &&
    o.actions.every(isValidReadinessExportAction)
  );
}

function isValidReadinessExportEvidence(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const e = v as Record<string, unknown>;
  return typeof e.title === "string" && typeof e.type === "string" && isStrOrNull(e.description) && isStrOrNull(e.linkUrl) && isStrOrNull(e.fileName) && isNumOrNull(e.fileSizeBytes);
}

function isValidReadinessExportAction(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const a = v as Record<string, unknown>;
  return (
    typeof a.title === "string" &&
    isStrOrNull(a.ownerName) &&
    isStrOrNull(a.dueDate) &&
    typeof a.priority === "string" &&
    typeof a.status === "string"
  );
}

function isValidReadinessExportCondition(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const c = v as Record<string, unknown>;
  return typeof c.description === "string" && isStrOrNull(c.dueDate) && isStrOrNull(c.ownerName) && typeof c.status === "string";
}

function isValidReadinessExportDecision(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const d = v as Record<string, unknown>;
  return (
    typeof d.outcome === "string" &&
    typeof d.level === "string" &&
    typeof d.decidedByName === "string" &&
    typeof d.decidedAt === "string" &&
    isStrOrNull(d.rationale)
  );
}

/**
 * Runtime check of the launch-readiness pack payload before handing it to
 * jsPDF - the client (not a DB row) is the source of truth here, mirroring
 * isValidIncidentExportPayload above. Every numeric key is checked as
 * number|null and every array element is checked as an object with the exact
 * string fields lib/pdf/readiness-pdf.ts reads, so a partial/hostile payload
 * (e.g. obligations: [null], summary: {}) 400s here instead of 500ing inside
 * jsPDF/.toLocaleString().
 */
function isValidReadinessExportPayload(value: unknown): value is ReadinessExportPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const summary = v.summary as Record<string, unknown> | null;

  if (typeof v.title !== "string" || typeof v.entityType !== "string" || typeof v.jurisdiction !== "string") return false;
  if (typeof v.riskLevel !== "string" || typeof v.status !== "string") return false;
  if (!isStrOrNull(v.targetLaunchDate) || !isStrOrNull(v.productName) || !isStrOrNull(v.ownerName)) return false;

  if (typeof summary !== "object" || summary === null) return false;
  const byGap = summary.byGap as Record<string, unknown> | null;
  if (
    typeof summary.total !== "number" ||
    typeof byGap !== "object" ||
    byGap === null ||
    typeof byGap.not_assessed !== "number" ||
    typeof byGap.none !== "number" ||
    typeof byGap.partial !== "number" ||
    typeof byGap.full !== "number" ||
    typeof summary.blockerCount !== "number" ||
    typeof summary.unresolvedBlockerCount !== "number" ||
    typeof summary.noControlCount !== "number" ||
    typeof summary.coveragePct !== "number"
  ) {
    return false;
  }

  if (!Array.isArray(v.obligations) || !v.obligations.every(isValidReadinessExportObligation)) return false;
  if (!Array.isArray(v.evidence) || !v.evidence.every(isValidReadinessExportEvidence)) return false;
  if (!Array.isArray(v.actions) || !v.actions.every(isValidReadinessExportAction)) return false;
  if (!Array.isArray(v.conditions) || !v.conditions.every(isValidReadinessExportCondition)) return false;
  if (!Array.isArray(v.decisions) || !v.decisions.every(isValidReadinessExportDecision)) return false;

  return true;
}

function isValidRegResponseExportLink(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const l = v as Record<string, unknown>;
  return typeof l.linkType === "string" && typeof l.label === "string" && isStrOrNull(l.note);
}

function isValidRegResponseExportQuestion(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const q = v as Record<string, unknown>;
  return (
    typeof q.position === "number" &&
    typeof q.question === "string" &&
    isStrOrNull(q.response) &&
    isStrOrNull(q.exceptionNote) &&
    typeof q.status === "string" &&
    Array.isArray(q.links) &&
    q.links.every(isValidRegResponseExportLink)
  );
}

function isValidRegResponseExportCommitment(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const c = v as Record<string, unknown>;
  return (
    typeof c.description === "string" &&
    isStrOrNull(c.dueDate) &&
    isStrOrNull(c.ownerName) &&
    typeof c.status === "string" &&
    typeof c.hasTrackedAction === "boolean" &&
    isStrOrNull(c.note)
  );
}

function isValidRegResponseExportAction(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const a = v as Record<string, unknown>;
  return (
    typeof a.title === "string" &&
    isStrOrNull(a.ownerName) &&
    isStrOrNull(a.dueDate) &&
    typeof a.priority === "string" &&
    typeof a.status === "string"
  );
}

function isValidRegResponseExportCondition(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const c = v as Record<string, unknown>;
  return typeof c.description === "string" && isStrOrNull(c.dueDate) && isStrOrNull(c.ownerName) && typeof c.status === "string";
}

function isValidRegResponseExportEvidence(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const e = v as Record<string, unknown>;
  return typeof e.title === "string" && typeof e.type === "string" && isStrOrNull(e.description) && isStrOrNull(e.linkUrl) && isStrOrNull(e.fileName) && isNumOrNull(e.fileSizeBytes);
}

function isValidRegResponseExportDecision(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const d = v as Record<string, unknown>;
  return typeof d.outcome === "string" && typeof d.decidedByName === "string" && typeof d.decidedAt === "string" && isStrOrNull(d.rationale);
}

/**
 * Runtime check of the regulatory response pack payload before handing it to
 * jsPDF - the client (not a DB row) is the source of truth here, mirroring
 * isValidReadinessExportPayload above. Every numeric key is checked as
 * number|null and every array element is checked as an object with the exact
 * string fields lib/pdf/reg-response-pdf.ts reads, so a partial/hostile
 * payload (e.g. questions: [null], progress: {}) 400s here instead of 500ing
 * inside jsPDF/.toLocaleString().
 */
function isValidRegResponseExportPayload(value: unknown): value is RegResponseExportPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const progress = v.progress as Record<string, unknown> | null;

  if (!isStrOrNull(v.reference) || typeof v.title !== "string" || typeof v.regulator !== "string") return false;
  if (v.channel !== null && typeof v.channel !== "string") return false;
  if (typeof v.status !== "string") return false;
  if (!isStrOrNull(v.receivedAt) || !isStrOrNull(v.deadline) || !isStrOrNull(v.submittedAt) || !isStrOrNull(v.ownerName) || !isStrOrNull(v.summary)) {
    return false;
  }

  if (typeof progress !== "object" || progress === null) return false;
  const questionsByStatus = progress.questionsByStatus as Record<string, unknown> | null;
  const commitmentsByStatus = progress.commitmentsByStatus as Record<string, unknown> | null;
  if (
    typeof progress.totalQuestions !== "number" ||
    typeof questionsByStatus !== "object" ||
    questionsByStatus === null ||
    typeof progress.answeredCount !== "number" ||
    typeof progress.unansweredCount !== "number" ||
    typeof progress.answeredPct !== "number" ||
    typeof progress.totalCommitments !== "number" ||
    typeof commitmentsByStatus !== "object" ||
    commitmentsByStatus === null ||
    typeof progress.overdueCommitmentCount !== "number" ||
    (progress.daysUntilDeadline !== null && typeof progress.daysUntilDeadline !== "number")
  ) {
    return false;
  }

  if (!Array.isArray(v.questions) || !v.questions.every(isValidRegResponseExportQuestion)) return false;
  if (!Array.isArray(v.commitments) || !v.commitments.every(isValidRegResponseExportCommitment)) return false;
  if (!Array.isArray(v.actions) || !v.actions.every(isValidRegResponseExportAction)) return false;
  if (!Array.isArray(v.conditions) || !v.conditions.every(isValidRegResponseExportCondition)) return false;
  if (!Array.isArray(v.evidence) || !v.evidence.every(isValidRegResponseExportEvidence)) return false;
  if (!Array.isArray(v.decisions) || !v.decisions.every(isValidRegResponseExportDecision)) return false;

  return true;
}

function isValidPortfolioItem(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const i = v as Record<string, unknown>;
  return (
    typeof i.id === "string" &&
    typeof i.label === "string" &&
    typeof i.subjectType === "string" &&
    (i.href === null || typeof i.href === "string") &&
    isStrOrNull(i.dueDate) &&
    typeof i.status === "string" &&
    typeof i.urgency === "string"
  );
}

function isValidPortfolioSection(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  return typeof s.count === "number" && Array.isArray(s.items) && s.items.every(isValidPortfolioItem);
}

/**
 * Runtime check of the governance pack payload before handing it to jsPDF.
 * Unlike every other module's validator in this route, this payload is NOT
 * client-asserted - it is built SERVER-SIDE below from the caller's own
 * verified workspace via loadGovernancePortfolio, so a crafted POST cannot
 * forge or falsify a committee governance pack. This check is defence in
 * depth against a bug in that builder producing a malformed shape, 400ing
 * rather than 500ing inside jsPDF/.toLocaleString(), mirroring the shape
 * discipline of every isValid*ExportPayload above.
 */
function isValidGovernancePackPayload(value: unknown): value is GovernancePackPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.asOf !== "string" || typeof v.generatedAt !== "string") return false;
  const p = v.portfolio as Record<string, unknown> | null;
  if (!p || typeof p !== "object") return false;

  if (!isValidPortfolioSection(p.decisionsRequired)) return false;
  const appetite = p.riskOutsideAppetite as Record<string, unknown> | null;
  if (!appetite || !isValidPortfolioSection(appetite.outside) || !isValidPortfolioSection(appetite.tolerated)) return false;
  if (!isValidPortfolioSection(p.openConditionsAndBlockers)) return false;
  if (!isValidPortfolioSection(p.controlChangesInFlight)) return false;
  if (!isValidPortfolioSection(p.controlChangesImplementedNotTested)) return false;
  if (!isValidPortfolioSection(p.controlsDueForTesting)) return false;
  if (!isValidPortfolioSection(p.failedControlTests)) return false;

  const incidents = p.incidents as Record<string, unknown> | null;
  if (!incidents || !isValidPortfolioSection(incidents.open) || !isValidPortfolioSection(incidents.pastTarget)) return false;
  if (typeof incidents.bySeverity !== "object" || incidents.bySeverity === null) return false;
  if (typeof incidents.byStatus !== "object" || incidents.byStatus === null) return false;

  const commitments = p.regulatoryCommitments as Record<string, unknown> | null;
  if (
    !commitments ||
    !isValidPortfolioSection(commitments.open) ||
    !isValidPortfolioSection(commitments.overdue) ||
    !isValidPortfolioSection(commitments.dueSoon)
  ) {
    return false;
  }

  if (!isValidPortfolioSection(p.overdueActions)) return false;

  return true;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { module, assessmentData, email, format } = body;

    if (!module || !assessmentData) {
      return NextResponse.json({ error: "Missing module or assessmentData" }, { status: 400 });
    }

    // email drives delivery AND the workspace owner_email backfill below, so
    // reject anything that is not a plausible address string outright.
    if (email !== undefined && (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    // The trimmed form is what gets stored and mailed - validating the
    // trimmed value but using the raw one would store " a@b.com " and make
    // the SES send fail silently.
    const cleanEmail = typeof email === "string" ? email.trim() : undefined;

    // The workspace's organisationName/dateFormat settings, resolved once and
    // threaded into every generate*PDF call below via `orgInfo`. Tolerant of
    // an anonymous/unauthenticated request (getAuthenticatedWorkspace
    // returns null) - the free tools export PDFs without ever requiring a
    // workspace, so this must never turn a missing header into a failure;
    // it just falls back to the generic MEMA branding untouched.
    const requestingWorkspace = await getAuthenticatedWorkspace(request);
    const requestingWorkspaceSettings = resolveWorkspaceSettings(requestingWorkspace?.settings ?? null);
    const orgInfo = {
      organisationName: requestingWorkspaceSettings.organisationName,
      dateFormat: requestingWorkspaceSettings.dateFormat,
    };

    let pdfBuffer: Buffer;
    let filename: string;
    let contentType = "application/pdf";

    if (module === "typology_iq") {
      const { narrative, activeSlug } = assessmentData as { narrative?: string; activeSlug?: string };
      const answers = normalizeAnswers(assessmentData);

      if (!answers.firmTypes.length || !answers.products.length || !answers.customerTypes.length || !answers.riskThemes.length) {
        return NextResponse.json({ error: "Missing typology selections" }, { status: 400 });
      }

      // Export the typology the user is actively viewing (falls back to the best match).
      const ranked = scoreTypologies(answers);
      const result = (activeSlug ? ranked.find((m) => m.typology.slug === activeSlug) : undefined) ?? ranked[0];

      pdfBuffer = generateTypologyPDF({
        typology: result.typology,
        score: result.score,
        breakdown: result.breakdown,
        answers: {
          firmTypes: answers.firmTypes,
          products: answers.products,
          customerTypes: answers.customerTypes,
          riskThemes: answers.riskThemes,
        },
        narrative,
      }, orgInfo);
      filename = `MEMA-TypologyIQ-${result.typology.slug}-${new Date().toISOString().split("T")[0]}.pdf`;
    } else if (module === "partner_control_map") {
      const { modelType, flowType, actors, controlOverrides, dataReceived, narrative } = assessmentData as {
        modelType: ModelType;
        flowType: FlowType;
        actors: Actor[];
        controlOverrides: Record<string, ControlOwnership>;
        dataReceived: string[];
        narrative?: string;
      };

      const result = scorePartnerRisk({
        modelType,
        flowType,
        actors: actors || [],
        controlOverrides: controlOverrides || {},
        dataReceived: dataReceived || [],
      });

      if (!result) {
        return NextResponse.json({ error: "No matching flow" }, { status: 404 });
      }

      pdfBuffer = generatePartnerPDF({
        flow: result.flow,
        riskScore: result.riskScore,
        riskRating: result.riskRating,
        controlSummary: result.controlSummary,
        gapControls: result.gapControls,
        missingDataFields: result.missingDataFields,
        controlOverrides: controlOverrides || {},
        narrative,
      }, orgInfo);
      filename = `MEMA-PartnerControlMap-${result.flow.slug}-${new Date().toISOString().split("T")[0]}.pdf`;
    } else if (module === "screening_controls") {
      const { firmType, category, trigger, narrative } = assessmentData as {
        firmType: FirmType;
        category: ScreeningCategory;
        trigger: ScreeningTrigger;
        narrative?: string;
      };

      const result = getBestScreeningMatch({ firmType, category, trigger });
      pdfBuffer = generateScreeningPDF({
        control: result.control,
        score: result.score,
        breakdown: result.breakdown,
        narrative,
      }, orgInfo);
      filename = `MEMA-ScreeningControlDesigner-${result.control.slug}-${new Date().toISOString().split("T")[0]}.pdf`;
    } else if (module === "controls_maturity") {
      const { area, currentLevel, targetLevel, narrative } = assessmentData as {
        area: ControlArea;
        currentLevel: MaturityLevel;
        targetLevel: MaturityLevel;
        narrative?: string;
      };

      const result = scoreMaturity({ area, currentLevel, targetLevel });
      if (!result) {
        return NextResponse.json({ error: "No matching framework" }, { status: 404 });
      }
      pdfBuffer = generateMaturityPDF({ ...result, narrative }, orgInfo);
      filename = `MEMA-ControlsMaturity-${result.framework.slug}-${new Date().toISOString().split("T")[0]}.pdf`;
    } else if (module === "kyc_requirements") {
      const a = assessmentData as {
        entities?: string[]; entity?: string;
        jurisdictions?: string[]; jurisdiction?: string;
        risks?: string[]; risk?: string;
        completed?: string[];
      };
      // Accept multi-select arrays (current client) or singular/comma strings (back-compat).
      const entities = coerceList(a.entities, a.entity).filter((x): x is EntityType => (ENTITY_ORDER as string[]).includes(x));
      const jurisdictions = coerceList(a.jurisdictions, a.jurisdiction).filter((x): x is Jurisdiction => (JURISDICTION_ORDER as string[]).includes(x));
      const risks = coerceList(a.risks, a.risk).filter((x): x is RiskLevel => (["low", "medium", "high"] as string[]).includes(x));
      const safeCompleted = Array.isArray(a.completed) ? a.completed.filter((x) => typeof x === "string") : [];
      if (entities.length === 0 || jurisdictions.length === 0) {
        return NextResponse.json({ error: "Invalid entities or jurisdictions" }, { status: 400 });
      }
      const risksFinal: RiskLevel[] = risks.length ? risks : ["medium"];
      const merged = buildMergedRequirements(entities, jurisdictions);
      if (merged.scenarios.length === 0) {
        return NextResponse.json({ error: "No CDD profile for the selected combination" }, { status: 404 });
      }
      const date = new Date().toISOString().split("T")[0];
      // Keep the filename short and collision-free for large multi-selects.
      const rawName = `${entities.join("-")}-${jurisdictions.join("-")}`;
      const nameBit = rawName.length <= 60 ? rawName : `${entities.length}entities-${jurisdictions.length}jur`;
      if (format === "docx") {
        pdfBuffer = await generateKycDocx({ entities, jurisdictions, risks: risksFinal, completed: safeCompleted, merged });
        contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        filename = `MEMA-KYC-${nameBit}-${date}.docx`;
      } else {
        pdfBuffer = generateKycPDF({ entities, jurisdictions, risks: risksFinal, completed: safeCompleted, merged }, orgInfo);
        filename = `MEMA-KYC-${nameBit}-${date}.pdf`;
      }
    } else if (module === "control_register") {
      const { controlSlugs, overrides, context } = assessmentData as {
        controlSlugs?: string[];
        overrides?: Record<string, ControlOverride>;
        context?: string;
      };
      const slugs = Array.isArray(controlSlugs) ? controlSlugs.filter((s) => typeof s === "string") : [];
      const entries = slugs
        .map((slug) => {
          const control = getControlBySlug(slug);
          return control ? { control, override: overrides?.[slug] } : null;
        })
        .filter((e): e is NonNullable<typeof e> => e !== null);
      if (entries.length === 0) {
        return NextResponse.json({ error: "No controls selected" }, { status: 400 });
      }
      pdfBuffer = generateControlRegisterPDF({ entries, context: typeof context === "string" ? context : undefined }, orgInfo);
      filename = `MEMA-ControlRegister-${new Date().toISOString().split("T")[0]}.pdf`;
    } else if (module === "pra_assessment") {
      // The client sends the full assessment-detail payload it already holds
      // (assessment + product + risks + controls + decision + conditions +
      // actions + person names + op-load summary + narrative) rather than an
      // id, so this route does not need workspace auth to rebuild anything -
      // it just validates the shape and renders it.
      if (!isValidPraExportPayload(assessmentData)) {
        return NextResponse.json({ error: "Missing or invalid PRA assessment data" }, { status: 400 });
      }
      pdfBuffer = generatePraPDF(assessmentData, orgInfo);
      const slug = assessmentData.productName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "assessment";
      filename = `MEMA-PRA-${slug}-${new Date().toISOString().split("T")[0]}.pdf`;
    } else if (module === "control_change") {
      // Same pattern as pra_assessment: the client sends the full change-pack
      // payload it already holds (change + control + field diffs + supporting
      // data + evidence + impact + decision + conditions + actions +
      // monitoring + rollback criteria + narrative) rather than an id.
      if (!isValidChangeExportPayload(assessmentData)) {
        return NextResponse.json({ error: "Missing or invalid control change data" }, { status: 400 });
      }
      pdfBuffer = generateChangePDF(assessmentData, orgInfo);
      const slug = assessmentData.changeTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "change";
      filename = `MEMA-ControlChange-${slug}-${new Date().toISOString().split("T")[0]}.pdf`;
    } else if (module === "control_test") {
      // Same pattern as control_change: the client sends the full test-report
      // payload it already holds (test + control + scope + samples + derived
      // result/rating + findings + evidence + linked actions + conclusion)
      // rather than an id.
      if (!isValidTestExportPayload(assessmentData)) {
        return NextResponse.json({ error: "Missing or invalid control test data" }, { status: 400 });
      }
      pdfBuffer = generateTestPDF(assessmentData, orgInfo);
      const slug = assessmentData.testTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "test";
      filename = `MEMA-ControlTest-${slug}-${new Date().toISOString().split("T")[0]}.pdf`;
    } else if (module === "incident") {
      // Same pattern as control_test: the client sends the full incident
      // report payload it already holds (intake + containment + affected
      // population + root cause + traceability links + remediation actions +
      // evidence + closure) rather than an id.
      if (!isValidIncidentExportPayload(assessmentData)) {
        return NextResponse.json({ error: "Missing or invalid incident data" }, { status: 400 });
      }
      pdfBuffer = generateIncidentPDF(assessmentData, orgInfo);
      const slug = assessmentData.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "incident";
      filename = `MEMA-Incident-${slug}-${new Date().toISOString().split("T")[0]}.pdf`;
    } else if (module === "readiness") {
      // Same pattern as incident: the client sends the full launch-readiness
      // pack payload it already holds (scope + summary + obligation register
      // + evidence + actions + conditions + decisions) rather than an id.
      if (!isValidReadinessExportPayload(assessmentData)) {
        return NextResponse.json({ error: "Missing or invalid readiness data" }, { status: 400 });
      }
      pdfBuffer = generateReadinessPDF(assessmentData, orgInfo);
      const slug = assessmentData.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "readiness";
      filename = `MEMA-Readiness-${slug}-${new Date().toISOString().split("T")[0]}.pdf`;
    } else if (module === "reg_response") {
      // Same pattern as readiness: the client sends the full response-pack
      // payload it already holds (request + questions with responses,
      // exception notes and substantiating links + commitments + actions +
      // conditions + evidence + decisions) rather than an id.
      if (!isValidRegResponseExportPayload(assessmentData)) {
        return NextResponse.json({ error: "Missing or invalid regulatory response data" }, { status: 400 });
      }
      pdfBuffer = generateRegResponsePDF(assessmentData, orgInfo);
      const slug = assessmentData.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "reg-response";
      filename = `MEMA-RegResponse-${slug}-${new Date().toISOString().split("T")[0]}.pdf`;
    } else if (module === "governance_pack") {
      // Unlike every module above, the client sends no meaningful payload
      // for this one - assessmentData is ignored. The pack is a committee
      // artefact, so it is built SERVER-SIDE from loadGovernancePortfolio
      // against the CALLER'S OWN verified workspace (the same headers
      // LeadCaptureModal already carries for the opportunistic owner_email
      // backfill below), never from client-asserted numbers. A missing or
      // invalid workspace credential 401s outright - there is no anonymous
      // "preview" of a governance pack.
      const workspace = await getAuthenticatedWorkspace(request);
      if (!workspace) {
        return NextResponse.json({ error: "Missing or invalid workspace credentials" }, { status: 401 });
      }
      const portfolio = await loadGovernancePortfolio(
        workspace.id,
        new Date(),
        resolveWorkspaceSettings(workspace.settings).reviewReminderDays
      );
      const payload: GovernancePackPayload = { asOf: portfolio.asOf, generatedAt: new Date().toISOString(), portfolio };
      if (!isValidGovernancePackPayload(payload)) {
        return NextResponse.json({ error: "Failed to build governance pack" }, { status: 500 });
      }
      pdfBuffer = generateGovernancePDF(payload, orgInfo);
      filename = `MEMA-GovernancePack-${portfolio.asOf}.pdf`;
    } else {
      return NextResponse.json({ error: "Invalid module" }, { status: 400 });
    }

    // If this export is happening inside a known anonymous workspace (its
    // auth headers verify) and that workspace has no owner_email yet, opportunistically
    // attribute it to this lead-capture email. Best-effort only: never blocks
    // or fails the export if verification or the update errors.
    if (cleanEmail) {
      try {
        const workspace = await getAuthenticatedWorkspace(request);
        if (workspace && !workspace.owner_email) {
          await updateWorkspace(workspace.id, { ownerEmail: cleanEmail }, "lead_capture");
        }
      } catch (error) {
        console.error("Workspace owner_email backfill error:", error);
      }
    }

    // Send PDF via email (non-blocking)
    if (cleanEmail) {
      try {
        const { sendEmailWithAttachment } = await import("@/lib/email");
        sendEmailWithAttachment({
          to: cleanEmail,
          subject: `Your FinCrime Control Lab Report: ${MODULE_TITLE[module] || "FinCrime Control Lab"}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #14b8a6; padding: 16px 24px; border-radius: 8px 8px 0 0;">
                <h1 style="color: white; font-size: 18px; margin: 0;">MEMA FinCrime Control Lab</h1>
              </div>
              <div style="padding: 24px; background: #f8fafc; border-radius: 0 0 8px 8px;">
                <p style="color: #1e293b;">Your assessment report is attached to this email.</p>
                <p style="color: #64748b; font-size: 14px;">
                  If you have questions about implementing these controls, our financial crime
                  consultants can help. Get in touch at
                  <a href="mailto:contact@memaconsultants.com" style="color: #14b8a6;">contact@memaconsultants.com</a>.
                </p>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
                <p style="color: #94a3b8; font-size: 12px;">
                  MEMA Consultants Ltd | memaconsultants.com
                </p>
              </div>
            </div>
          `,
          attachmentBuffer: pdfBuffer,
          attachmentFilename: filename,
        }).catch((err: unknown) => console.error("PDF email error:", err));
      } catch {
        // Email sending is non-critical
      }
    }

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("PDF export error:", error);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}

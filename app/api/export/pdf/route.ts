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
import { generateKycDocx } from "@/lib/docx/kyc-docx";
import { getAuthenticatedWorkspace } from "@/lib/workspace-auth";
import { updateWorkspace } from "@/lib/repo/workspace";
import type { PraExportPayload } from "@/components/pra/types";
import type { ChangeExportPayload } from "@/components/change-lab/types";
import type { TestExportPayload } from "@/components/control-testing/types";
import type { IncidentExportPayload } from "@/components/incidents/types";
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
  return typeof e.title === "string" && typeof e.type === "string" && isStrOrNull(e.description) && isStrOrNull(e.linkUrl);
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
  return typeof e.title === "string" && typeof e.type === "string" && isStrOrNull(e.description) && isStrOrNull(e.linkUrl);
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
  return typeof e.title === "string" && typeof e.type === "string" && isStrOrNull(e.description) && isStrOrNull(e.linkUrl);
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
      });
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
      });
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
      });
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
      pdfBuffer = generateMaturityPDF({ ...result, narrative });
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
        pdfBuffer = generateKycPDF({ entities, jurisdictions, risks: risksFinal, completed: safeCompleted, merged });
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
      pdfBuffer = generateControlRegisterPDF({ entries, context: typeof context === "string" ? context : undefined });
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
      pdfBuffer = generatePraPDF(assessmentData);
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
      pdfBuffer = generateChangePDF(assessmentData);
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
      pdfBuffer = generateTestPDF(assessmentData);
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
      pdfBuffer = generateIncidentPDF(assessmentData);
      const slug = assessmentData.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "incident";
      filename = `MEMA-Incident-${slug}-${new Date().toISOString().split("T")[0]}.pdf`;
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

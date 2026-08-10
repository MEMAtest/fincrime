import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { addHeader, addFootersToAll, checkPageBreak, MEMA_COLORS } from "./shared";
import type { IncidentExportPayload } from "@/components/incidents/types";

const SEVERITY_LABEL: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  contained: "Contained",
  investigating: "Investigating",
  remediating: "Remediating",
  closed: "Closed",
  cancelled: "Cancelled",
};

const SOURCE_LABEL: Record<string, string> = {
  internal_detection: "Internal detection",
  customer_complaint: "Customer complaint",
  regulator: "Regulator",
  third_party: "Third party",
  audit: "Audit",
  control_test: "Control test",
  other: "Other",
};

const ROOT_CAUSE_CATEGORY_LABEL: Record<string, string> = {
  control_design: "Control design",
  control_operation: "Control operation",
  data_quality: "Data quality",
  system_failure: "System failure",
  human_error: "Human error",
  third_party: "Third party",
  process_gap: "Process gap",
  other: "Other",
};

const LINK_TYPE_LABEL: Record<string, string> = {
  failed_control: "Failed control",
  control_change: "Control change",
  control_test: "Control test",
  pra_assessment: "PRA assessment",
  enforcement_case: "Enforcement case",
};

function fmtDate(iso: unknown): string {
  if (typeof iso !== "string" || !iso) return "Not set";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB");
}

/** Defensive against anything upstream validation missed: only a finite number renders, everything else falls back to "-" rather than throwing inside .toLocaleString(). */
function fmtNumber(v: unknown): string {
  return typeof v === "number" && Number.isFinite(v) ? v.toLocaleString("en-GB", { maximumFractionDigits: 2 }) : "-";
}

/** Defensive string coercion, matching lib/pdf/test-pdf.ts's str() helper: non-strings fall back rather than reaching jsPDF as undefined/[object Object]. */
function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

/**
 * Incident report: intake, containment, affected population, root cause and
 * category, the traceability links with their resolved labels, remediation
 * actions with status and owner, evidence, and the closure summary with
 * reportable/regulator details. Reuses lib/pdf/shared.ts for branding,
 * matching lib/pdf/test-pdf.ts's conventions.
 */
export function generateIncidentPDF(data: IncidentExportPayload): Buffer {
  const doc = new jsPDF();
  let y = addHeader(doc, "Incident Report");

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text(data.title || "Untitled incident", 20, y);
  y += 7;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(
    `Reference: ${str(data.reference) || "Not set"}   Severity: ${SEVERITY_LABEL[data.severity] ?? data.severity}   Status: ${
      STATUS_LABEL[data.status] ?? data.status
    }`,
    20,
    y
  );
  y += 8;

  // Intake
  y = checkPageBreak(doc, y, 40);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text("Intake", 20, y);
  y += 6;
  autoTable(doc, {
    startY: y,
    body: [
      ["Source", data.source ? SOURCE_LABEL[data.source] ?? data.source : "Not specified"],
      ["Owner", str(data.ownerName, "Unassigned") || "Unassigned"],
      ["Occurred", fmtDate(data.occurredAt)],
      ["Detected", fmtDate(data.detectedAt)],
    ],
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { cellWidth: 40, fontStyle: "bold", textColor: MEMA_COLORS.text }, 1: { cellWidth: 130, textColor: [80, 80, 80] } },
  });
  // @ts-expect-error jspdf-autotable adds lastAutoTable
  y = doc.lastAutoTable.finalY + 6;
  if (data.summary) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    const lines = doc.splitTextToSize(data.summary, 170);
    doc.text(lines, 20, y);
    y += lines.length * 5 + 6;
  }

  // Containment
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text("Containment", 20, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  const containmentLines = doc.splitTextToSize(data.containment || "Not recorded.", 170);
  doc.text(containmentLines, 20, y);
  y += containmentLines.length * 5 + 4;
  doc.setTextColor(100, 100, 100);
  doc.text(`Contained on: ${fmtDate(data.containedAt)}`, 20, y);
  y += 8;

  // Affected population
  y = checkPageBreak(doc, y, 36);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text("Affected population", 20, y);
  y += 6;
  autoTable(doc, {
    startY: y,
    head: [["Customers affected", "Transactions affected", "Value (GBP)"]],
    body: [
      [
        fmtNumber(data.affectedPopulation.customersAffected),
        fmtNumber(data.affectedPopulation.transactionsAffected),
        fmtNumber(data.affectedPopulation.valueGbp),
      ],
    ],
    theme: "grid",
    headStyles: { fillColor: MEMA_COLORS.accent, textColor: "#ffffff" },
    styles: { fontSize: 8, cellPadding: 2 },
  });
  // @ts-expect-error jspdf-autotable adds lastAutoTable
  y = doc.lastAutoTable.finalY + 6;
  if (data.affectedPopulation.identificationMethod) {
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(`Identified by: ${str(data.affectedPopulation.identificationMethod)}`, 20, y);
    y += 8;
  }

  // Root cause
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text("Root cause", 20, y);
  y += 6;
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(
    `Category: ${data.rootCauseCategory ? ROOT_CAUSE_CATEGORY_LABEL[data.rootCauseCategory] ?? data.rootCauseCategory : "Not categorised"}`,
    20,
    y
  );
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  const rootCauseLines = doc.splitTextToSize(data.rootCause || "Not recorded.", 170);
  doc.text(rootCauseLines, 20, y);
  y += rootCauseLines.length * 5 + 6;

  // Traceability links
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text(`Traceability links (${data.links.length})`, 20, y);
  y += 6;
  if (data.links.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Type", "Target", "Note"]],
      body: data.links.map((l) => [LINK_TYPE_LABEL[l.linkType] ?? l.linkType, str(l.label), str(l.note) || "-"]),
      theme: "grid",
      headStyles: { fillColor: MEMA_COLORS.accent, textColor: "#ffffff" },
      styles: { fontSize: 8, cellPadding: 2 },
    });
    // @ts-expect-error jspdf-autotable adds lastAutoTable
    y = doc.lastAutoTable.finalY + 10;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("No traceability links recorded.", 20, y);
    y += 10;
  }

  // Remediation actions
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text(`Remediation actions (${data.actions.length})`, 20, y);
  y += 6;
  if (data.actions.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Title", "Owner", "Due", "Priority", "Status"]],
      body: data.actions.map((a) => [str(a.title), str(a.ownerName) || "Unassigned", fmtDate(a.dueDate), str(a.priority), str(a.status)]),
      theme: "grid",
      headStyles: { fillColor: MEMA_COLORS.accent, textColor: "#ffffff" },
      styles: { fontSize: 8, cellPadding: 2 },
    });
    // @ts-expect-error jspdf-autotable adds lastAutoTable
    y = doc.lastAutoTable.finalY + 10;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("No remediation actions recorded.", 20, y);
    y += 10;
  }

  // Evidence
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text(`Evidence (${data.evidence.length})`, 20, y);
  y += 6;
  if (data.evidence.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Title", "Type", "Link"]],
      body: data.evidence.map((e) => [str(e.title), str(e.type), str(e.linkUrl) || ""]),
      theme: "grid",
      headStyles: { fillColor: MEMA_COLORS.accent, textColor: "#ffffff" },
      styles: { fontSize: 8, cellPadding: 2 },
    });
    // @ts-expect-error jspdf-autotable adds lastAutoTable
    y = doc.lastAutoTable.finalY + 10;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text("No evidence recorded yet.", 20, y);
    y += 10;
  }

  // Closure
  y = checkPageBreak(doc, y, 34);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text("Closure", 20, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  const closureLines = doc.splitTextToSize(data.closureSummary || "Not recorded.", 170);
  doc.text(closureLines, 20, y);
  y += closureLines.length * 5 + 4;
  doc.setTextColor(100, 100, 100);
  doc.text(
    `Reportable: ${data.reportable ? "Yes" : "No"}${
      data.reportable ? `   Reported: ${fmtDate(data.reportedAt)}   Regulator ref: ${str(data.regulatorReference) || "-"}` : ""
    }`,
    20,
    y
  );
  y += 6;
  doc.text(`Closed: ${fmtDate(data.closedAt)}`, 20, y);
  y += 8;

  // Narrative (AI-assisted summary, if present)
  if (typeof data.narrative === "string" && data.narrative) {
    y = checkPageBreak(doc, y, 30);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(MEMA_COLORS.text);
    doc.text("Risk intelligence summary", 20, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(90, 90, 90);
    const narLines = doc.splitTextToSize(data.narrative, 170);
    doc.text(narLines, 20, y);
    y += narLines.length * 5;
  }

  addFootersToAll(doc);
  return Buffer.from(doc.output("arraybuffer"));
}

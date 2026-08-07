import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { addHeader, addFootersToAll, checkPageBreak, MEMA_COLORS } from "./shared";
import type { ChangeExportPayload } from "@/components/change-lab/types";

const OUTCOME_LABEL: Record<string, string> = {
  approve: "Approved",
  approve_with_conditions: "Approved with conditions",
  reject: "Rejected",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  in_review: "In Review",
  approved: "Approved",
  rejected: "Rejected",
  implemented: "Implemented",
  rolled_back: "Rolled Back",
};

function fmtDate(iso: unknown): string {
  if (typeof iso !== "string" || !iso) return "No due date";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB");
}

/** Defensive against anything upstream validation missed: only a finite number renders, everything else falls back to "-" rather than throwing inside .toLocaleString(). */
function fmtNumber(v: unknown): string {
  return typeof v === "number" && Number.isFinite(v) ? v.toLocaleString("en-GB", { maximumFractionDigits: 2 }) : "-";
}

/** Defensive string coercion, matching lib/pdf/pra-pdf.ts's `String(Number(...) || 0)` style for the other generator: non-strings fall back rather than reaching jsPDF as undefined/[object Object]. */
function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

/** Change pack for a Control Change Lab change: current vs proposed, supporting data, impact, decision, conditions, actions, monitoring plan and rollback criteria. Reuses lib/pdf/shared.ts for branding, matching lib/pdf/pra-pdf.ts's conventions. */
export function generateChangePDF(data: ChangeExportPayload): Buffer {
  const doc = new jsPDF();
  let y = addHeader(doc, "Control Change");

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text(data.changeTitle || "Untitled change", 20, y);
  y += 7;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(
    `Control: ${data.controlName}   Type: ${data.changeType ? data.changeType.replace(/_/g, " ") : "Not specified"}   Status: ${
      STATUS_LABEL[data.status] ?? data.status
    }`,
    20,
    y
  );
  y += 8;

  if (data.rationale) {
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    const lines = doc.splitTextToSize(data.rationale, 170);
    doc.text(lines, 20, y);
    y += lines.length * 5 + 6;
  }

  // Current vs proposed
  y = checkPageBreak(doc, y, 40);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text(`Current vs proposed (${data.changedFieldCount} changed)`, 20, y);
  y += 6;
  autoTable(doc, {
    startY: y,
    head: [["Field", "Current", "Proposed"]],
    body: data.fieldDiffs.map((f) => [f.label, f.current, f.changed ? f.proposed : "-"]),
    theme: "grid",
    headStyles: { fillColor: MEMA_COLORS.accent, textColor: "#ffffff" },
    styles: { fontSize: 8, cellPadding: 2 },
    didParseCell: (hookData) => {
      if (hookData.section === "body" && hookData.column.index === 2) {
        const row = data.fieldDiffs[hookData.row.index];
        if (row?.changed) hookData.cell.styles.textColor = MEMA_COLORS.accent;
      }
    },
  });
  // @ts-expect-error jspdf-autotable adds lastAutoTable
  y = doc.lastAutoTable.finalY + 10;

  // Supporting data
  y = checkPageBreak(doc, y, 40);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text("Supporting data", 20, y);
  y += 6;
  autoTable(doc, {
    startY: y,
    body: [
      ["Baseline alert volume / month", fmtNumber(data.supportingData.baselineAlertVolume)],
      ["Expected volume / month", fmtNumber(data.supportingData.expectedVolume)],
      ["Current true positives / month", fmtNumber(data.supportingData.truePositives)],
      ["Current false positives / month", fmtNumber(data.supportingData.falsePositives)],
    ],
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { cellWidth: 70, fontStyle: "bold", textColor: MEMA_COLORS.text }, 1: { cellWidth: 100, textColor: [80, 80, 80] } },
  });
  // @ts-expect-error jspdf-autotable adds lastAutoTable
  y = doc.lastAutoTable.finalY + 6;
  if (data.supportingData.testingNotes) {
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    const lines = doc.splitTextToSize(data.supportingData.testingNotes, 170);
    doc.text(lines, 20, y);
    y += lines.length * 5 + 4;
  }
  y += 4;

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

  // Impact
  y = checkPageBreak(doc, y, 34);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text("Impact (before vs after)", 20, y);
  y += 6;
  autoTable(doc, {
    startY: y,
    head: [["Metric", "Before", "After"]],
    body: [
      ["Analyst hours / month", fmtNumber(data.impact.beforeAnalystHoursPerMonth), fmtNumber(data.impact.afterAnalystHoursPerMonth)],
      ["FTE required", fmtNumber(data.impact.beforeFte), fmtNumber(data.impact.afterFte)],
      ["Monthly cost (GBP)", fmtNumber(data.impact.beforeMonthlyCostGbp), fmtNumber(data.impact.afterMonthlyCostGbp)],
    ],
    theme: "grid",
    headStyles: { fillColor: MEMA_COLORS.accent, textColor: "#ffffff" },
    styles: { fontSize: 8, cellPadding: 2 },
  });
  // @ts-expect-error jspdf-autotable adds lastAutoTable
  y = doc.lastAutoTable.finalY + 8;
  if (data.impact.customerFrictionNotes) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(MEMA_COLORS.text);
    doc.text("Customer friction:", 20, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    const lines = doc.splitTextToSize(data.impact.customerFrictionNotes, 170);
    doc.text(lines, 20, y);
    y += lines.length * 5 + 4;
  }
  if (data.impact.riskImpactNotes) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(MEMA_COLORS.text);
    doc.text("Risk impact:", 20, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    const lines = doc.splitTextToSize(data.impact.riskImpactNotes, 170);
    doc.text(lines, 20, y);
    y += lines.length * 5 + 4;
  }
  y += 4;

  // Pilot
  if (data.pilot) {
    y = checkPageBreak(doc, y, 20);
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(80, 80, 80);
    doc.text(`Piloted${data.pilotNotes ? `: ${data.pilotNotes}` : "."}`, 20, y);
    y += 8;
  }

  // Decision
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text("Decision", 20, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  if (data.decision) {
    doc.text(
      `${OUTCOME_LABEL[data.decision.outcome] ?? data.decision.outcome} by ${data.decision.decidedByName} on ${fmtDate(data.decision.decidedAt)}`,
      20,
      y
    );
    y += 5;
    if (data.decision.rationale) {
      const rLines = doc.splitTextToSize(data.decision.rationale, 170);
      doc.text(rLines, 20, y);
      y += rLines.length * 5 + 4;
    }
  } else {
    doc.text("No decision recorded yet.", 20, y);
    y += 6;
  }
  y += 4;

  // Conditions
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text(`Conditions (${data.conditions.length})`, 20, y);
  y += 6;
  if (data.conditions.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Description", "Due", "Owner", "Status"]],
      body: data.conditions.map((c) => [str(c.description), fmtDate(c.dueDate), str(c.ownerName) || "Unassigned", str(c.status)]),
      theme: "grid",
      headStyles: { fillColor: MEMA_COLORS.accent, textColor: "#ffffff" },
      styles: { fontSize: 8, cellPadding: 2 },
    });
    // @ts-expect-error jspdf-autotable adds lastAutoTable
    y = doc.lastAutoTable.finalY + 10;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("No conditions attached.", 20, y);
    y += 10;
  }

  // Actions
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text(`Follow-up actions (${data.actions.length})`, 20, y);
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
    doc.text("No follow-up actions recorded.", 20, y);
    y += 10;
  }

  // Monitoring plan
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text(`Monitoring plan (${data.monitoring.length})`, 20, y);
  y += 6;
  if (data.monitoring.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Metric", "Target", "Owner", "Review date"]],
      body: data.monitoring.map((m) => [str(m.metric), str(m.target), str(m.owner), fmtDate(m.reviewDate || null)]),
      theme: "grid",
      headStyles: { fillColor: MEMA_COLORS.accent, textColor: "#ffffff" },
      styles: { fontSize: 8, cellPadding: 2 },
    });
    // @ts-expect-error jspdf-autotable adds lastAutoTable
    y = doc.lastAutoTable.finalY + 10;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("No monitoring plan recorded.", 20, y);
    y += 10;
  }

  // Rollback criteria + lifecycle
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text("Rollback criteria", 20, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  const rbLines = doc.splitTextToSize(data.rollbackCriteria || "Not recorded.", 170);
  doc.text(rbLines, 20, y);
  y += rbLines.length * 5 + 6;

  if (data.implementedAt) {
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(`Implemented ${fmtDate(data.implementedAt)}${data.appliedVersion ? `, applied as version ${data.appliedVersion}` : ""}.`, 20, y);
    y += 5;
  }
  if (data.rolledBackAt) {
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(`Rolled back ${fmtDate(data.rolledBackAt)}.`, 20, y);
    y += 5;
  }

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

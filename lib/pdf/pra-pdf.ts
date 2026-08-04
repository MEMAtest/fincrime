import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { addHeader, addFootersToAll, checkPageBreak, MEMA_COLORS } from "./shared";
import type { PraExportPayload } from "@/components/pra/types";

const OUTCOME_LABEL: Record<string, string> = {
  approve: "Approved",
  approve_with_conditions: "Approved with conditions",
  reject: "Rejected",
};

const APPETITE_LABEL: Record<string, string> = {
  within: "Within appetite",
  tolerated: "Tolerated",
  outside: "Outside appetite",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "No due date";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB");
}

/** Committee pack for a Product Risk Assessment: profile, flows, risk register, control map, gaps, operational load, residual vs appetite, decision, conditions, actions and evidence. Reuses lib/pdf/shared.ts for branding/header/footer, matching the other generators' visual conventions. */
export function generatePraPDF(data: PraExportPayload): Buffer {
  const doc = new jsPDF();
  let y = addHeader(doc, "Product Risk Assessment");

  // Product profile
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text(data.productName || "Untitled product", 20, y);
  y += 7;

  if (data.productDescription) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    const lines = doc.splitTextToSize(data.productDescription, 170);
    doc.text(lines, 20, y);
    y += lines.length * 5 + 4;
  }

  autoTable(doc, {
    startY: y,
    body: [
      ["Customers", (data.customers ?? []).join(", ") || "Not specified"],
      ["Jurisdictions", (data.jurisdictions ?? []).join(", ") || "Not specified"],
      ["Channels", (data.channels ?? []).join(", ") || "Not specified"],
    ],
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { cellWidth: 38, fontStyle: "bold", textColor: MEMA_COLORS.text }, 1: { cellWidth: 132, textColor: [80, 80, 80] } },
  });
  // @ts-expect-error jspdf-autotable adds lastAutoTable
  y = doc.lastAutoTable.finalY + 10;

  // Flows
  y = checkPageBreak(doc, y, 40);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text(`Flows (${data.flows.length})`, 20, y);
  y += 6;
  if (data.flows.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["#", "From", "To", "Note"]],
      body: data.flows.map((f, i) => [String(i + 1), f.from, f.to, f.note || ""]),
      theme: "grid",
      headStyles: { fillColor: MEMA_COLORS.accent, textColor: "#ffffff" },
      styles: { fontSize: 8, cellPadding: 2 },
    });
    // @ts-expect-error jspdf-autotable adds lastAutoTable
    y = doc.lastAutoTable.finalY + 10;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text("No flow legs recorded.", 20, y);
    y += 10;
  }

  // Risk register
  y = checkPageBreak(doc, y, 40);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text(`Risk register (${data.risks.length})`, 20, y);
  y += 6;
  if (data.risks.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Risk", "Typology", "Inherent", "Residual", "Rationale"]],
      body: data.risks.map((r) => [
        r.title,
        r.typologySlug || "Manual",
        r.inherentScore ?? "-",
        r.residualScore ?? "-",
        r.residualRationale || "",
      ]),
      theme: "grid",
      headStyles: { fillColor: MEMA_COLORS.accent, textColor: "#ffffff" },
      styles: { fontSize: 8, cellPadding: 2, valign: "top" },
      columnStyles: { 4: { cellWidth: 55 } },
    });
    // @ts-expect-error jspdf-autotable adds lastAutoTable
    y = doc.lastAutoTable.finalY + 10;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text("No risks scored.", 20, y);
    y += 10;
  }

  // Control mapping + coverage
  const controlRows: (string | number)[][] = [];
  data.risks.forEach((r) => {
    const riskControls = r.controls ?? [];
    if (riskControls.length === 0) {
      controlRows.push([r.title, "-", "-", "-"]);
    } else {
      riskControls.forEach((c) =>
        controlRows.push([r.title, c.label, c.coverage, c.instantiated ? c.effectiveness : "not instantiated"])
      );
    }
  });
  y = checkPageBreak(doc, y, 40);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text("Control mapping", 20, y);
  y += 6;
  if (controlRows.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Risk", "Control", "Coverage", "Effectiveness"]],
      body: controlRows,
      theme: "grid",
      headStyles: { fillColor: MEMA_COLORS.accent, textColor: "#ffffff" },
      styles: { fontSize: 8, cellPadding: 2 },
    });
    // @ts-expect-error jspdf-autotable adds lastAutoTable
    y = doc.lastAutoTable.finalY + 10;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text("No controls mapped.", 20, y);
    y += 10;
  }

  // Gaps
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text(`Gaps (${data.gaps.length})`, 20, y);
  y += 6;
  if (data.gaps.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Risk", "Gap"]],
      body: data.gaps.map((g) => [
        g.riskTitle,
        g.kind === "no_controls" ? "No controls attached" : `Gap coverage: ${g.controlLabel}`,
      ]),
      theme: "grid",
      headStyles: { fillColor: "#dc2626", textColor: "#ffffff" },
      styles: { fontSize: 8, cellPadding: 2 },
    });
    // @ts-expect-error jspdf-autotable adds lastAutoTable
    y = doc.lastAutoTable.finalY + 10;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("No coverage gaps identified.", 20, y);
    y += 10;
  }

  // Operational load
  y = checkPageBreak(doc, y, 34);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text("Operational load", 20, y);
  y += 6;
  autoTable(doc, {
    startY: y,
    body: [
      ["Alerts / month", String(Number(data.opLoad?.alertsPerMonth) || 0)],
      ["Analyst hours / month", String(Number(data.opLoad?.analystHoursPerMonth) || 0)],
      ["FTE required", String(Number(data.opLoad?.fte) || 0)],
      ["Monthly cost", `GBP ${(Number(data.opLoad?.monthlyCostGbp) || 0).toLocaleString("en-GB")}`],
    ],
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { cellWidth: 55, fontStyle: "bold", textColor: MEMA_COLORS.text }, 1: { cellWidth: 115, textColor: [80, 80, 80] } },
  });
  // @ts-expect-error jspdf-autotable adds lastAutoTable
  y = doc.lastAutoTable.finalY + 10;

  // Residual vs appetite
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text("Residual risk vs appetite", 20, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(`Overall residual score: ${data.overallResidualScore ?? "-"} (${data.overallResidualRating ?? "n/a"})`, 20, y);
  y += 5;
  doc.text(`Appetite result: ${data.appetiteResult ? APPETITE_LABEL[data.appetiteResult] : "Not yet assessed"}`, 20, y);
  y += 10;

  // Recommendation
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text("Recommendation", 20, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  const recLines = doc.splitTextToSize(data.recommendation || "No recommendation recorded.", 170);
  doc.text(recLines, 20, y);
  y += recLines.length * 5 + 8;

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
      body: data.conditions.map((c) => [c.description, fmtDate(c.dueDate), c.ownerName || "Unassigned", c.status]),
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
      body: data.actions.map((a) => [a.title, a.ownerName || "Unassigned", fmtDate(a.dueDate), a.priority, a.status]),
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
      body: data.evidence.map((e) => [e.title, e.type, e.linkUrl || ""]),
      theme: "grid",
      headStyles: { fillColor: MEMA_COLORS.accent, textColor: "#ffffff" },
      styles: { fontSize: 8, cellPadding: 2 },
    });
    // @ts-expect-error jspdf-autotable adds lastAutoTable
    y = doc.lastAutoTable.finalY + 10;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("No evidence recorded yet.", 20, y);
    y += 10;
  }

  // Narrative (AI-assisted committee summary)
  if (data.narrative) {
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

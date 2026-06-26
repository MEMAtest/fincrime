import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { addHeader, addFootersToAll, checkPageBreak, MEMA_COLORS } from "./shared";
import { CONTROL_CATEGORY_LABEL, CONTROL_TYPE_LABEL } from "@/data/controls";
import type { Control, ControlOverride } from "@/data/controls/types";

interface RegisterEntry {
  control: Control;
  override?: ControlOverride;
}

interface ControlRegisterPDFData {
  entries: RegisterEntry[];
  context?: string;
}

const eff = (o: string | undefined, d: string) => (o && o.trim() ? o.trim() : d);

export function generateControlRegisterPDF(data: ControlRegisterPDFData): Buffer {
  const doc = new jsPDF();
  const { entries, context } = data;

  let y = addHeader(doc, "Control Register");

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text("Financial Crime Control Register", 20, y);
  y += 7;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  const intro = context
    ? context
    : `A register of ${entries.length} financial crime control${entries.length === 1 ? "" : "s"} with their thresholds, owners and governance. Thresholds and owners shown are this firm's settings where customised, otherwise the recommended starting point.`;
  const introLines = doc.splitTextToSize(intro, 170);
  doc.text(introLines, 20, y);
  y += introLines.length * 5 + 6;

  // Control matrix (summary)
  autoTable(doc, {
    startY: y,
    head: [["Control", "Type", "Category", "Threshold", "Owner (1st line)"]],
    body: entries.map(({ control: c, override: o }) => [
      c.name,
      CONTROL_TYPE_LABEL[c.controlType],
      CONTROL_CATEGORY_LABEL[c.category],
      eff(o?.threshold, c.defaultThreshold),
      eff(o?.firstLineOwner, c.firstLineOwner),
    ]),
    theme: "grid",
    headStyles: { fillColor: MEMA_COLORS.accent, textColor: "#ffffff" },
    styles: { fontSize: 7.5, cellPadding: 2.5, valign: "top" },
    columnStyles: { 0: { cellWidth: 38 }, 3: { cellWidth: 52 } },
  });
  // @ts-expect-error jspdf-autotable adds lastAutoTable
  y = doc.lastAutoTable.finalY + 12;

  // Per-control specifications
  entries.forEach(({ control: c, override: o }, idx) => {
    y = checkPageBreak(doc, y, 60);

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(MEMA_COLORS.text);
    doc.text(`${idx + 1}. ${c.name}`, 20, y);
    y += 6;

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(110, 110, 110);
    const sum = doc.splitTextToSize(c.plainSummary, 170);
    doc.text(sum, 20, y);
    y += sum.length * 4.3 + 4;

    const rows: [string, string][] = [
      ["Type", `${CONTROL_TYPE_LABEL[c.controlType]} (${CONTROL_CATEGORY_LABEL[c.category]})`],
      ["Objective", c.objective],
      ["Rule / logic", c.ruleLogic],
      ["Threshold", eff(o?.threshold, c.defaultThreshold)],
      ["Threshold rationale", c.thresholdRationale],
      ["Lookback window", c.lookbackWindow],
      ["Tuning", c.tuningNotes],
      ["First-line owner", eff(o?.firstLineOwner, c.firstLineOwner)],
      ["Second-line owner", eff(o?.secondLineOwner, c.secondLineOwner)],
      ["System / tooling", eff(o?.system, c.suggestedSystems.join("; "))],
      ["Escalation", c.escalation],
      ["SLA", c.sla],
      ["Test plan", c.testPlan.map((t, i) => `${i + 1}. ${t}`).join("  ")],
      ["Review cadence", eff(o?.reviewCadence, c.reviewCadence)],
      ["Data inputs", c.dataInputs.join("; ")],
      ["Enforcement precedent", c.enforcementRefs.map((r) => `${r.firm} (${r.year})`).join("; ") || "n/a"],
    ];
    if (o?.notes && o.notes.trim()) rows.push(["Firm notes", o.notes.trim()]);

    autoTable(doc, {
      startY: y,
      body: rows,
      theme: "plain",
      styles: { fontSize: 8, cellPadding: 1.8, valign: "top" },
      columnStyles: { 0: { cellWidth: 38, fontStyle: "bold", textColor: MEMA_COLORS.text }, 1: { cellWidth: 132, textColor: [80, 80, 80] } },
    });
    // @ts-expect-error jspdf-autotable
    y = doc.lastAutoTable.finalY + 4;

    // metrics
    y = checkPageBreak(doc, y, 24);
    autoTable(doc, {
      startY: y,
      head: [["Metric", "Target", "Description"]],
      body: c.metrics.map((m) => [m.name, m.target, m.description]),
      theme: "grid",
      headStyles: { fillColor: MEMA_COLORS.accent, textColor: "#ffffff" },
      styles: { fontSize: 7.5, cellPadding: 2 },
      columnStyles: { 2: { cellWidth: 95 } },
    });
    // @ts-expect-error jspdf-autotable
    y = doc.lastAutoTable.finalY + 4;

    // sources
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text(`Sources: ${c.sources.map((s) => `${s.org} ${s.reference}`).join("; ")}`, 20, y);
    y += 9;
  });

  addFootersToAll(doc);
  return Buffer.from(doc.output("arraybuffer"));
}

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { addHeader, addFootersToAll, checkPageBreak, MEMA_COLORS } from "./shared";
import { CONTROL_CATEGORY_LABEL, CONTROL_TYPE_LABEL, defaultPriority } from "@/data/controls";
import type { Control, ControlOverride } from "@/data/controls/types";

interface RegisterEntry {
  control: Control;
  override?: ControlOverride;
}

interface ControlRegisterPDFData {
  entries: RegisterEntry[];
  context?: string;
}

// The builder pre-fills every editable field with its catalogue default, so an
// override that is present but empty is a deliberate clear and must be honoured;
// only a genuinely absent override falls back to the default.
const eff = (o: string | undefined, d: string) => (o === undefined ? d : o.trim());

const STATUS_LABEL: Record<string, string> = { not_started: "Not started", in_progress: "In progress", needs_review: "Needs review", gaps: "Gaps", implemented: "Implemented" };
const stat = (s: string | undefined) => STATUS_LABEL[s ?? "not_started"] ?? "Not started";
const PRIORITY_LABEL: Record<string, string> = { high: "High", medium: "Medium", low: "Low" };
const prio = (c: Control, o?: ControlOverride) => PRIORITY_LABEL[o?.priority ?? defaultPriority(c)] ?? "Medium";

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
    head: [["Control", "Category", "Status", "Priority", "Owner"]],
    body: entries.map(({ control: c, override: o }) => [
      c.name,
      CONTROL_CATEGORY_LABEL[c.category],
      stat(o?.status),
      prio(c, o),
      o?.owner?.trim() || eff(o?.firstLineOwner, c.firstLineOwner),
    ]),
    theme: "grid",
    headStyles: { fillColor: MEMA_COLORS.accent, textColor: "#ffffff" },
    styles: { fontSize: 7.5, cellPadding: 2.5, valign: "top" },
    columnStyles: { 0: { cellWidth: 48 }, 4: { cellWidth: 40 } },
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
    const sum = doc.splitTextToSize(o?.description?.trim() || c.plainSummary, 170);
    doc.text(sum, 20, y);
    y += sum.length * 4.3 + 4;

    const rows: [string, string][] = [
      ["Type", `${CONTROL_TYPE_LABEL[c.controlType]} (${CONTROL_CATEGORY_LABEL[c.category]})`],
      ["Status", stat(o?.status)],
      ["Priority", prio(c, o)],
      ["Accountable owner", o?.owner?.trim() || "Unassigned"],
      ["Frequency", eff(o?.frequency, c.reviewCadence)],
      ["Last / next reviewed", `${o?.lastReview?.trim() || "not set"} / ${o?.nextReview?.trim() || "not set"}`],
      ["Objective", c.objective],
      ["Rule / logic", c.ruleLogic],
      ["Threshold", eff(o?.threshold, c.defaultThreshold)],
      ["Threshold rationale", c.thresholdRationale],
      ["Lookback window", c.lookbackWindow],
      ["Tuning guidance", c.tuningNotes],
      ["First-line owner", eff(o?.firstLineOwner, c.firstLineOwner)],
      ["Second-line owner", eff(o?.secondLineOwner, c.secondLineOwner)],
      ["System / tooling", eff(o?.system, c.suggestedSystems.join("; "))],
      ["Escalation", c.escalation],
      ["SLA", c.sla],
      ["Test plan", c.testPlan.map((t, i) => `${i + 1}. ${t}`).join("  ")],
      ["Data inputs", c.dataInputs.join("; ")],
      ["Enforcement precedent", c.enforcementRefs.map((r) => `${r.firm} (${r.year})`).join("; ") || "n/a"],
    ];
    // Scope and governance captured in the builder (shown only when the user set them).
    const scope: [string, string][] = [];
    if (o?.version?.trim()) scope.push(["Version", o.version.trim()]);
    if (o?.effectiveDate?.trim()) scope.push(["Effective date", o.effectiveDate.trim()]);
    if (o?.businessArea?.trim()) scope.push(["Business area / function", o.businessArea.trim()]);
    if (o?.geography?.trim()) scope.push(["Geography / jurisdiction", o.geography.trim()]);
    if (o?.inScope?.length) scope.push(["In scope", o.inScope.join("; ")]);
    if (o?.outOfScope?.length) scope.push(["Out of scope", o.outOfScope.join("; ")]);
    if (o?.customerTypes?.length) scope.push(["Customer types", o.customerTypes.join("; ")]);
    if (o?.products?.length) scope.push(["Products / services", o.products.join("; ")]);
    if (o?.objectives?.length) scope.push(["Regulatory objectives", o.objectives.join("; ")]);
    rows.splice(4, 0, ...scope); // after "Accountable owner"
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
    const srcText = `Sources: ${c.sources.map((s) => `${s.org} ${s.reference}`).join("; ")}`;
    const srcLines = doc.splitTextToSize(srcText, 170);
    y = checkPageBreak(doc, y, srcLines.length * 4 + 6);
    doc.text(srcLines, 20, y);
    y += srcLines.length * 4 + 5;
  });

  addFootersToAll(doc);
  return Buffer.from(doc.output("arraybuffer"));
}

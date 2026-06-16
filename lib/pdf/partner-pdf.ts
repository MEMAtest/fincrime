import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { addHeader, addFootersToAll, checkPageBreak, MEMA_COLORS } from "./shared";
import type { PartnerFlow, ControlOwnership } from "@/data/partner-flows/types";

interface PartnerPDFData {
  flow: PartnerFlow;
  riskScore: number;
  riskRating: string;
  controlSummary: { yourFirm: number; partner: number; shared: number; gap: number };
  gapControls: { id: string; control: string; category: string }[];
  missingDataFields: { id: string; field: string }[];
  controlOverrides: Record<string, ControlOwnership>;
  narrative?: string;
}

const actorLabels: Record<string, string> = {
  your_firm: "Your Firm",
  partner: "Partner",
  correspondent_bank: "Correspondent Bank",
  beneficiary_bank: "Beneficiary Bank",
  end_customer: "End Customer",
  platform_operator: "Platform Operator",
  fx_provider: "FX Provider",
};

export function generatePartnerPDF(data: PartnerPDFData): Buffer {
  const doc = new jsPDF();
  const { flow, riskScore, riskRating, controlSummary, gapControls, missingDataFields, controlOverrides, narrative } = data;

  let y = addHeader(doc, "PartnerControlMap Assessment Report");

  // Flow summary
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text(flow.title, 20, y);
  y += 7;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  const descLines = doc.splitTextToSize(flow.description, 170);
  doc.text(descLines, 20, y);
  y += descLines.length * 5 + 5;

  // Risk score card
  const ratingColor = riskRating === "critical" ? "#dc2626" : riskRating === "high" ? "#ef4444" : riskRating === "medium" ? "#f59e0b" : "#22c55e";
  doc.setFillColor(ratingColor);
  doc.roundedRect(20, y, 170, 20, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`Risk Score: ${riskScore} - ${riskRating.toUpperCase()}`, 105, y + 13, { align: "center" });
  y += 28;

  // Control distribution
  autoTable(doc, {
    startY: y,
    head: [["Ownership", "Count"]],
    body: [
      ["Your Firm", `${controlSummary.yourFirm}`],
      ["Partner", `${controlSummary.partner}`],
      ["Shared", `${controlSummary.shared}`],
      ["Gap (Unowned)", `${controlSummary.gap}`],
    ],
    theme: "grid",
    headStyles: { fillColor: MEMA_COLORS.accent, textColor: "#ffffff" },
    styles: { fontSize: 9 },
  });

  // @ts-expect-error jspdf-autotable
  y = doc.lastAutoTable.finalY + 10;

  // AI Narrative
  if (narrative) {
    y = checkPageBreak(doc, y, 50);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(MEMA_COLORS.text);
    doc.text("AI Narrative Summary", 20, y);
    y += 7;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    const narrativeLines = doc.splitTextToSize(narrative, 170);
    doc.text(narrativeLines, 20, y);
    y += narrativeLines.length * 4.5 + 8;
  }

  // Control Ownership Matrix
  doc.addPage();
  y = 20;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text("Control Ownership Matrix", 20, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [["ID", "Control", "Category", "Owner"]],
    body: flow.controlOwnershipTemplate.map((c) => {
      const owner = controlOverrides[c.id] || c.defaultOwner;
      const ownerLabel = owner === "your_firm" ? "Your Firm" : owner === "gap" ? "GAP" : owner.charAt(0).toUpperCase() + owner.slice(1);
      return [c.id, c.control, c.category, ownerLabel];
    }),
    theme: "grid",
    headStyles: { fillColor: MEMA_COLORS.accent, textColor: "#ffffff" },
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: { 0: { cellWidth: 15 }, 1: { cellWidth: 70 } },
  });

  // RACI Matrix
  // @ts-expect-error jspdf-autotable
  y = doc.lastAutoTable.finalY + 10;
  y = checkPageBreak(doc, y, 60);

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("RACI Matrix", 20, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [["Activity", "Responsible", "Accountable", "Consulted", "Informed"]],
    body: flow.raciTemplate.map((r) => [
      r.activity,
      actorLabels[r.responsible] || r.responsible,
      actorLabels[r.accountable] || r.accountable,
      r.consulted.map((c) => actorLabels[c] || c).join(", ") || "-",
      r.informed.map((i) => actorLabels[i] || i).join(", ") || "-",
    ]),
    theme: "grid",
    headStyles: { fillColor: MEMA_COLORS.accent, textColor: "#ffffff" },
    styles: { fontSize: 7, cellPadding: 3 },
  });

  // Gaps section
  // @ts-expect-error jspdf-autotable
  y = doc.lastAutoTable.finalY + 10;
  y = checkPageBreak(doc, y, 50);

  if (gapControls.length > 0 || missingDataFields.length > 0) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor("#ef4444");
    doc.text("Identified Gaps", 20, y);
    y += 7;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(MEMA_COLORS.text);

    if (gapControls.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.text("Unowned Controls:", 20, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      gapControls.forEach((g) => {
        doc.text(`• ${g.control} (${g.category})`, 25, y);
        y += 5;
      });
      y += 3;
    }

    if (missingDataFields.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.text("Missing Data Fields:", 20, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      missingDataFields.forEach((f) => {
        doc.text(`• ${f.field}`, 25, y);
        y += 5;
      });
      y += 3;
    }
  }

  // Pre-launch conditions
  y = checkPageBreak(doc, y, 60);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text("Pre-Launch Conditions", 20, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [["Condition", "Category", "Evidence Required"]],
    body: flow.preLaunchConditions.map((p) => [p.condition, p.category, p.evidence]),
    theme: "grid",
    headStyles: { fillColor: MEMA_COLORS.accent, textColor: "#ffffff" },
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: { 0: { cellWidth: 60 }, 2: { cellWidth: 60 } },
  });

  // Governance Pack
  // @ts-expect-error jspdf-autotable
  y = doc.lastAutoTable.finalY + 10;
  y = checkPageBreak(doc, y, 60);

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Governance Pack", 20, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [["Document", "Frequency", "Owner"]],
    body: flow.governancePack.map((g) => [g.document, g.frequency, g.owner]),
    theme: "grid",
    headStyles: { fillColor: MEMA_COLORS.accent, textColor: "#ffffff" },
    styles: { fontSize: 8, cellPadding: 3 },
  });

  // Sources
  // @ts-expect-error jspdf-autotable
  y = doc.lastAutoTable.finalY + 10;
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Sources", 20, y);
  y += 6;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  flow.sources.forEach((s) => {
    doc.text(`• ${s.org} - ${s.reference}: ${s.title}`, 25, y);
    y += 4.5;
  });

  addFootersToAll(doc);

  return Buffer.from(doc.output("arraybuffer"));
}

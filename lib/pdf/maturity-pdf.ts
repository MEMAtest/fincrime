import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { addHeader, addFootersToAll, checkPageBreak, MEMA_COLORS } from "./shared";
import { MATURITY_LABEL } from "@/data/maturity/types";
import type { MaturityResult } from "@/data/scoring/maturity-scoring";

interface MaturityPDFData extends MaturityResult {
  narrative?: string;
}

export function generateMaturityPDF(data: MaturityPDFData): Buffer {
  const doc = new jsPDF();
  const { framework, currentLevel, targetLevel, currentScore, targetScore, gapScore, remediation, narrative } = data;

  let y = addHeader(doc, "Controls Maturity Assessment Report");

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text(framework.title, 20, y);
  y += 7;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  const descLines = doc.splitTextToSize(framework.description, 170);
  doc.text(descLines, 20, y);
  y += descLines.length * 5 + 5;

  // Current → target card
  doc.setFillColor(MEMA_COLORS.accent);
  doc.roundedRect(20, y, 170, 18, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(
    `Current: ${MATURITY_LABEL[currentLevel]} (${currentScore}/100)  ->  Target: ${MATURITY_LABEL[targetLevel]} (${targetScore}/100)   Gap: ${gapScore}`,
    105,
    y + 12,
    { align: "center" }
  );
  y += 26;

  if (narrative) {
    y = checkPageBreak(doc, y, 40);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(MEMA_COLORS.text);
    doc.text("Maturity Gap Summary", 20, y);
    y += 7;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    const lines = doc.splitTextToSize(narrative, 170);
    doc.text(lines, 20, y);
    y += lines.length * 4.5 + 8;
  }

  // Maturity levels
  y = checkPageBreak(doc, y, 40);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text("Maturity Levels", 20, y);
  y += 8;
  autoTable(doc, {
    startY: y,
    head: [["Level", "What it looks like"]],
    body: framework.levels.map((l) => [MATURITY_LABEL[l.level], l.descriptor]),
    theme: "grid",
    headStyles: { fillColor: MEMA_COLORS.accent, textColor: "#ffffff" },
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 140 } },
  });
  // @ts-expect-error jspdf-autotable adds lastAutoTable
  y = doc.lastAutoTable.finalY + 10;

  // Remediation roadmap
  y = checkPageBreak(doc, y, 40);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Remediation Roadmap", 20, y);
  y += 8;
  autoTable(doc, {
    startY: y,
    head: [["From", "Action", "Owner"]],
    body: remediation.length
      ? remediation.map((r) => [MATURITY_LABEL[r.fromLevel], r.action, r.owner])
      : [["-", "Already at or above target maturity.", "-"]],
    theme: "grid",
    headStyles: { fillColor: MEMA_COLORS.accent, textColor: "#ffffff" },
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: { 0: { cellWidth: 28 }, 1: { cellWidth: 120 } },
  });
  // @ts-expect-error jspdf-autotable
  y = doc.lastAutoTable.finalY + 10;

  // Governance
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Governance Checklist", 20, y);
  y += 8;
  autoTable(doc, {
    startY: y,
    head: [["Item", "Frequency", "Owner"]],
    body: framework.governanceChecklist.map((g) => [g.item, g.frequency, g.owner]),
    theme: "grid",
    headStyles: { fillColor: MEMA_COLORS.accent, textColor: "#ffffff" },
    styles: { fontSize: 8, cellPadding: 3 },
  });
  // @ts-expect-error jspdf-autotable
  y = doc.lastAutoTable.finalY + 10;

  // Sources
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Sources", 20, y);
  y += 6;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  framework.sources.forEach((s) => {
    doc.text(`• ${s.org} - ${s.reference}: ${s.title}`, 25, y);
    y += 4.5;
  });

  addFootersToAll(doc);
  return Buffer.from(doc.output("arraybuffer"));
}

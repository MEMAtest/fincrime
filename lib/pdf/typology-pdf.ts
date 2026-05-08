import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { addHeader, addFootersToAll, checkPageBreak, MEMA_COLORS } from "./shared";
import type { Typology } from "@/data/typologies/types";

interface TypologyPDFData {
  typology: Typology;
  score: number;
  breakdown: { firmTypeScore: number; productScore: number; customerTypeScore: number; riskThemeScore: number };
  answers: { firmType: string; product: string; customerType: string; riskTheme: string };
  narrative?: string;
}

export function generateTypologyPDF(data: TypologyPDFData): Buffer {
  const doc = new jsPDF();
  const { typology, score, breakdown, answers, narrative } = data;

  let y = addHeader(doc, "TypologyIQ Assessment Report");

  // Match summary
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text(typology.title, 20, y);
  y += 7;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  const descLines = doc.splitTextToSize(typology.description, 170);
  doc.text(descLines, 20, y);
  y += descLines.length * 5 + 5;

  // Score card
  doc.setFillColor(MEMA_COLORS.accent);
  doc.roundedRect(20, y, 170, 20, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`Match Score: ${score}/100`, 105, y + 13, { align: "center" });
  y += 28;

  // Score breakdown table
  autoTable(doc, {
    startY: y,
    head: [["Criteria", "Score", "Max"]],
    body: [
      ["Firm Type", `${breakdown.firmTypeScore}`, "30"],
      ["Product", `${breakdown.productScore}`, "25"],
      ["Customer Type", `${breakdown.customerTypeScore}`, "20"],
      ["Risk Theme", `${breakdown.riskThemeScore}`, "25"],
    ],
    theme: "grid",
    headStyles: { fillColor: MEMA_COLORS.accent, textColor: "#ffffff" },
    styles: { fontSize: 9 },
  });

  // @ts-expect-error jspdf-autotable adds lastAutoTable
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

  // Control Objective
  y = checkPageBreak(doc, y, 40);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text("Control Objective", 20, y);
  y += 7;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const objLines = doc.splitTextToSize(typology.controlObjective, 170);
  doc.text(objLines, 20, y);
  y += objLines.length * 4.5 + 8;

  // Data Required
  y = checkPageBreak(doc, y, 50);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Data Required", 20, y);
  y += 7;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  typology.dataRequired.forEach((item) => {
    y = checkPageBreak(doc, y, 10);
    doc.text(`• ${item}`, 25, y);
    y += 5;
  });
  y += 5;

  // Detection Logic
  doc.addPage();
  y = 20;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Detection Logic", 20, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [["Rule ID", "Name", "Logic", "Priority"]],
    body: typology.detectionLogic.map((r) => [r.id, r.name, r.logic, r.priority]),
    theme: "grid",
    headStyles: { fillColor: MEMA_COLORS.accent, textColor: "#ffffff" },
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: { 0: { cellWidth: 20 }, 2: { cellWidth: 80 }, 3: { cellWidth: 20 } },
  });

  // @ts-expect-error jspdf-autotable
  y = doc.lastAutoTable.finalY + 10;

  // Workflow
  y = checkPageBreak(doc, y, 60);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Investigation Workflow", 20, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [["Step", "Title", "Description", "SLA", "Responsible"]],
    body: typology.workflowSteps.map((w) => [
      `${w.step}`,
      w.title,
      w.description,
      w.sla || "-",
      w.responsible,
    ]),
    theme: "grid",
    headStyles: { fillColor: MEMA_COLORS.accent, textColor: "#ffffff" },
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: { 0: { cellWidth: 12 }, 2: { cellWidth: 65 } },
  });

  // @ts-expect-error jspdf-autotable
  y = doc.lastAutoTable.finalY + 10;

  // Governance
  y = checkPageBreak(doc, y, 60);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Governance Checklist", 20, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [["Item", "Frequency", "Owner"]],
    body: typology.governanceChecklist.map((g) => [g.item, g.frequency, g.owner]),
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
  typology.sources.forEach((s) => {
    doc.text(`• ${s.org} — ${s.reference}: ${s.title}`, 25, y);
    y += 4.5;
  });

  addFootersToAll(doc);

  return Buffer.from(doc.output("arraybuffer"));
}

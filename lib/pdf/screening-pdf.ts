import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { addHeader, addFootersToAll, checkPageBreak, MEMA_COLORS } from "./shared";
import type { ScreeningControl } from "@/data/screening/types";

interface ScreeningPDFData {
  control: ScreeningControl;
  score: number;
  breakdown: { categoryScore: number; firmTypeScore: number; triggerScore: number };
  narrative?: string;
}

export function generateScreeningPDF(data: ScreeningPDFData): Buffer {
  const doc = new jsPDF();
  const { control, score, breakdown, narrative } = data;

  let y = addHeader(doc, "Screening Control Designer Report");

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text(control.title, 20, y);
  y += 7;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  const descLines = doc.splitTextToSize(control.description, 170);
  doc.text(descLines, 20, y);
  y += descLines.length * 5 + 5;

  doc.setFillColor(MEMA_COLORS.accent);
  doc.roundedRect(20, y, 170, 18, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(`Match Score: ${score}/100`, 105, y + 12, { align: "center" });
  y += 26;

  // Score breakdown
  autoTable(doc, {
    startY: y,
    head: [["Criteria", "Score", "Max"]],
    body: [
      ["Screening category", `${breakdown.categoryScore}`, "50"],
      ["Firm type", `${breakdown.firmTypeScore}`, "25"],
      ["Trigger", `${breakdown.triggerScore}`, "25"],
    ],
    theme: "grid",
    headStyles: { fillColor: MEMA_COLORS.accent, textColor: "#ffffff" },
    styles: { fontSize: 9 },
  });
  // @ts-expect-error jspdf-autotable adds lastAutoTable
  y = doc.lastAutoTable.finalY + 10;

  if (narrative) {
    y = checkPageBreak(doc, y, 40);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(MEMA_COLORS.text);
    doc.text("Design Overview", 20, y);
    y += 7;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    const lines = doc.splitTextToSize(narrative, 170);
    doc.text(lines, 20, y);
    y += lines.length * 4.5 + 8;
  }

  // Control objective
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text("Control Objective", 20, y);
  y += 7;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const objLines = doc.splitTextToSize(control.controlObjective, 170);
  doc.text(objLines, 20, y);
  y += objLines.length * 4.5 + 8;

  // Data inputs
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Data Inputs", 20, y);
  y += 7;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  control.dataInputs.forEach((item) => {
    y = checkPageBreak(doc, y, 10);
    doc.text(`• ${item}`, 25, y);
    y += 5;
  });
  y += 4;

  // Matching configuration
  y = checkPageBreak(doc, y, 40);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Matching Configuration", 20, y);
  y += 8;
  autoTable(doc, {
    startY: y,
    head: [["Aspect", "Guidance", "Source"]],
    body: control.matchingConfig.map((m) => [m.aspect, m.guidance, m.source || "-"]),
    theme: "grid",
    headStyles: { fillColor: MEMA_COLORS.accent, textColor: "#ffffff" },
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: { 1: { cellWidth: 100 } },
  });
  // @ts-expect-error jspdf-autotable adds lastAutoTable
  y = doc.lastAutoTable.finalY + 10;

  // Detection logic
  y = checkPageBreak(doc, y, 40);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Detection Logic", 20, y);
  y += 8;
  autoTable(doc, {
    startY: y,
    head: [["ID", "Name", "Logic", "Priority"]],
    body: control.detectionLogic.map((r) => [r.id, r.name, r.logic, r.priority]),
    theme: "grid",
    headStyles: { fillColor: MEMA_COLORS.accent, textColor: "#ffffff" },
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: { 0: { cellWidth: 20 }, 2: { cellWidth: 80 }, 3: { cellWidth: 20 } },
  });
  // @ts-expect-error jspdf-autotable
  y = doc.lastAutoTable.finalY + 10;

  // Escalation workflow
  y = checkPageBreak(doc, y, 40);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Escalation Workflow", 20, y);
  y += 8;
  autoTable(doc, {
    startY: y,
    head: [["Step", "Title", "Description", "SLA", "Owner"]],
    body: control.escalationWorkflow.map((w) => [`${w.step}`, w.title, w.description, w.sla || "-", w.owner]),
    theme: "grid",
    headStyles: { fillColor: MEMA_COLORS.accent, textColor: "#ffffff" },
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: { 0: { cellWidth: 12 }, 2: { cellWidth: 70 } },
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
    body: control.governanceChecklist.map((g) => [g.item, g.frequency, g.owner]),
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
  control.sources.forEach((s) => {
    doc.text(`• ${s.org} - ${s.reference}: ${s.title}`, 25, y);
    y += 4.5;
  });

  addFootersToAll(doc);
  return Buffer.from(doc.output("arraybuffer"));
}

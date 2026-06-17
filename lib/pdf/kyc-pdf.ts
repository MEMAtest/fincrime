import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { addHeader, addFootersToAll, checkPageBreak, MEMA_COLORS } from "./shared";
import type { CddProfile, RiskLevel } from "@/data/kyc/types";
import { ENTITY_LABEL, JURISDICTION_LABEL, JURISDICTION_REGULATOR, SECTION_TITLE, RISK_LABEL } from "@/data/kyc/types";

type RiskFilter = "all" | RiskLevel;

interface KycPDFData {
  profile: CddProfile;
  fallback: boolean;
  risk: RiskFilter;
}

const refOf = (sources: { org: string; reference: string }[]) =>
  sources.map((s) => `${s.org} ${s.reference}`).join("; ");

const riskCell = (levels: RiskLevel[]) =>
  levels.length === 3 ? "All" : levels.map((l) => RISK_LABEL[l].replace(" Risk", "")).join(", ");

export function generateKycPDF(data: KycPDFData): Buffer {
  const { profile, fallback, risk } = data;
  const doc = new jsPDF();

  let y = addHeader(doc, "KYC / CDD Requirements");

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text(`${ENTITY_LABEL[profile.entityType]} — ${JURISDICTION_LABEL[profile.jurisdiction]}`, 20, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(JURISDICTION_REGULATOR[profile.jurisdiction] + (fallback ? "  (FATF baseline shown)" : ""), 20, y);
  y += 8;

  // Key facts
  autoTable(doc, {
    startY: y,
    head: [["", ""]],
    body: [
      ["Inherent risk", profile.inherentRisk === "varies" ? "Varies" : RISK_LABEL[profile.inherentRisk]],
      ["Beneficial ownership", profile.boThreshold],
      ["Simplified due diligence", profile.sddEligibility],
      ...(profile.exemptionNote ? [["Exemption", profile.exemptionNote]] : []),
      ["Overarching basis", profile.regulatoryBasis.map((s) => `${s.org} ${s.reference}`).join("; ")],
    ],
    theme: "plain",
    styles: { fontSize: 8, cellPadding: 1.5 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 45 }, 1: { cellWidth: 125 } },
  });
  // @ts-expect-error jspdf-autotable adds lastAutoTable
  y = doc.lastAutoTable.finalY + 8;

  const show = (levels: RiskLevel[]) => risk === "all" || levels.includes(risk);

  for (const section of profile.sections) {
    const items = section.items.filter((i) => show(i.appliesAtRisk));
    if (items.length === 0) continue;
    y = checkPageBreak(doc, y, 40);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(MEMA_COLORS.text);
    doc.text(SECTION_TITLE[section.key], 20, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [["Requirement", "Applies", "Regulatory reference"]],
      body: items.map((i) => [
        i.text + (i.threshold ? ` (${i.threshold})` : "") + (i.conditional ? ` — ${i.conditional}` : ""),
        riskCell(i.appliesAtRisk),
        refOf(i.sources),
      ]),
      theme: "grid",
      headStyles: { fillColor: MEMA_COLORS.accent, textColor: "#ffffff", fontSize: 8 },
      styles: { fontSize: 7.5, cellPadding: 1.5, valign: "top" },
      columnStyles: { 0: { cellWidth: 95 }, 1: { cellWidth: 20 }, 2: { cellWidth: 55 } },
    });
    // @ts-expect-error jspdf-autotable adds lastAutoTable
    y = doc.lastAutoTable.finalY + 6;
  }

  if (profile.eddTriggers.length > 0) {
    y = checkPageBreak(doc, y, 40);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(MEMA_COLORS.text);
    doc.text("Enhanced Due Diligence triggers", 20, y);
    y += 3;
    autoTable(doc, {
      startY: y,
      head: [["Trigger", "Required measure", "Reference"]],
      body: profile.eddTriggers.map((t) => [t.trigger, t.action, refOf(t.sources)]),
      theme: "grid",
      headStyles: { fillColor: MEMA_COLORS.accent, textColor: "#ffffff", fontSize: 8 },
      styles: { fontSize: 7.5, cellPadding: 1.5, valign: "top" },
      columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: 75 }, 2: { cellWidth: 40 } },
    });
    // @ts-expect-error jspdf-autotable adds lastAutoTable
    y = doc.lastAutoTable.finalY + 6;
  }

  y = checkPageBreak(doc, y, 20);
  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(120, 120, 120);
  const disclaimer = doc.splitTextToSize(
    "Reference summary only, not legal advice. Verify against the cited primary source. Incoming changes (e.g. EU AMLR from 2027) are tagged where relevant.",
    170
  );
  doc.text(disclaimer, 20, y);

  addFootersToAll(doc);
  return Buffer.from(doc.output("arraybuffer"));
}

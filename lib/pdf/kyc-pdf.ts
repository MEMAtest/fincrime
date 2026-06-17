import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { addHeader, addFootersToAll, checkPageBreak, MEMA_COLORS } from "./shared";
import { buildRequirements } from "@/data/kyc";
import type { CddProfile, RiskLevel } from "@/data/kyc/types";
import { ENTITY_LABEL, JURISDICTION_LABEL, JURISDICTION_REGULATOR, RISK_LABEL, CATEGORY_TITLE, CATEGORY_ORDER, statusFor, STATUS_LABEL } from "@/data/kyc/types";

interface KycPDFData {
  profile: CddProfile;
  fallback: boolean;
  risk: "all" | RiskLevel;
  completed?: string[];
}

export function generateKycPDF(data: KycPDFData): Buffer {
  const { profile, fallback, risk } = data;
  const completed = data.completed ?? [];
  const rk: RiskLevel = risk === "all" ? "medium" : risk;
  const doc = new jsPDF();

  let y = addHeader(doc, "KYC / CDD Requirements");

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text(`${ENTITY_LABEL[profile.entityType]} - ${JURISDICTION_LABEL[profile.jurisdiction]} - ${RISK_LABEL[rk]}`, 20, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(JURISDICTION_REGULATOR[profile.jurisdiction] + (fallback ? "  (FATF baseline shown)" : ""), 20, y);
  y += 8;

  const requirements = buildRequirements(profile);

  // Summary
  const nonEdd = requirements.filter((r) => !r.eddTrigger);
  const collected = requirements.filter((r) => completed.includes(r.id)).length;
  const summary = [
    ["Total requirements", String(requirements.length)],
    ["Collected (this session)", `${collected} of ${requirements.length}`],
    ["Required", String(nonEdd.filter((r) => statusFor(r, rk) === "required").length)],
    ["Conditional", String(nonEdd.filter((r) => statusFor(r, rk) === "conditional").length)],
    ["Not applicable", String(nonEdd.filter((r) => statusFor(r, rk) === "not_applicable").length)],
    ["EDD triggers", String(requirements.length - nonEdd.length)],
    ["Beneficial ownership", profile.boThreshold],
  ];
  autoTable(doc, {
    startY: y,
    body: summary,
    theme: "plain",
    styles: { fontSize: 8, cellPadding: 1.5 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 45 }, 1: { cellWidth: 125 } },
  });
  // @ts-expect-error jspdf-autotable adds lastAutoTable
  y = doc.lastAutoTable.finalY + 8;

  for (const cat of CATEGORY_ORDER) {
    const reqs = requirements.filter((r) => r.category === cat);
    if (reqs.length === 0) continue;
    y = checkPageBreak(doc, y, 40);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(MEMA_COLORS.text);
    doc.text(CATEGORY_TITLE[cat], 20, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [["Requirement", "What to collect", "Legal basis", "Status"]],
      body: reqs.map((r) => [
        `${r.title}\n${r.ruleSummary ?? r.whatItMeans}`,
        [...r.whatToCollect.map((w) => `- ${w}`), ...(r.documentGuidance?.map((d) => `${d.label}: ${d.accepted.join(", ")}`) ?? [])].join("\n"),
        r.legalBasis.map((s) => `${s.org} ${s.reference}`).join("\n"),
        completed.includes(r.id) ? "Collected" : r.eddTrigger ? "EDD trigger" : STATUS_LABEL[statusFor(r, rk)],
      ]),
      theme: "grid",
      headStyles: { fillColor: MEMA_COLORS.accent, textColor: "#ffffff", fontSize: 8 },
      styles: { fontSize: 7, cellPadding: 1.5, valign: "top" },
      columnStyles: { 0: { cellWidth: 70 }, 1: { cellWidth: 55 }, 2: { cellWidth: 30 }, 3: { cellWidth: 15 } },
    });
    // @ts-expect-error jspdf-autotable adds lastAutoTable
    y = doc.lastAutoTable.finalY + 6;
  }

  y = checkPageBreak(doc, y, 20);
  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(120, 120, 120);
  const disclaimer = doc.splitTextToSize(
    "Guidance only, not legal advice. Use alongside your organisation's policies and verify against the cited primary source. Incoming changes (e.g. EU AMLR from 2027) are tagged where relevant.",
    170
  );
  doc.text(disclaimer, 20, y);

  addFootersToAll(doc);
  return Buffer.from(doc.output("arraybuffer"));
}

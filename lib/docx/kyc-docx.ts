import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType } from "docx";
import { buildRequirements } from "@/data/kyc";
import type { CddProfile, RiskLevel } from "@/data/kyc/types";
import { ENTITY_LABEL, JURISDICTION_LABEL, JURISDICTION_REGULATOR, RISK_LABEL, CATEGORY_TITLE, CATEGORY_ORDER, statusFor, STATUS_LABEL } from "@/data/kyc/types";

interface KycDocxData {
  profile: CddProfile;
  fallback: boolean;
  risk: "all" | RiskLevel;
  completed?: string[];
}

const para = (text: string, opts?: { bold?: boolean; italics?: boolean; color?: string; size?: number }) =>
  new Paragraph({ children: [new TextRun({ text, bold: opts?.bold, italics: opts?.italics, color: opts?.color, size: opts?.size })] });

const bullet = (text: string) => new Paragraph({ text, bullet: { level: 0 } });

const cell = (children: Paragraph[], width: number) =>
  new TableCell({ children, width: { size: width, type: WidthType.PERCENTAGE } });

const headerCell = (text: string, width: number) =>
  new TableCell({ children: [para(text, { bold: true, color: "FFFFFF" })], width: { size: width, type: WidthType.PERCENTAGE }, shading: { fill: "14B8A6" } });

export async function generateKycDocx(data: KycDocxData): Promise<Buffer> {
  const { profile, fallback, risk } = data;
  const completed = data.completed ?? [];
  const rk: RiskLevel = risk === "all" ? "medium" : risk;
  const requirements = buildRequirements(profile);
  const collected = requirements.filter((r) => completed.includes(r.id)).length;

  const children: (Paragraph | Table)[] = [
    new Paragraph({ text: "KYC / CDD Requirements", heading: HeadingLevel.TITLE }),
    para(`${ENTITY_LABEL[profile.entityType]} — ${JURISDICTION_LABEL[profile.jurisdiction]} — ${RISK_LABEL[rk]}`, { bold: true }),
    para(JURISDICTION_REGULATOR[profile.jurisdiction] + (fallback ? "  (FATF baseline shown)" : ""), { italics: true, color: "666666" }),
    para(`Onboarding checklist: collected ${collected} of ${requirements.length}.`, { color: "0F7B4F" }),
    para(""),
  ];

  for (const cat of CATEGORY_ORDER) {
    const reqs = requirements.filter((r) => r.category === cat);
    if (reqs.length === 0) continue;
    children.push(new Paragraph({ text: CATEGORY_TITLE[cat], heading: HeadingLevel.HEADING_2 }));
    const rows: TableRow[] = [
      new TableRow({ children: [headerCell("Requirement", 38), headerCell("What to collect", 32), headerCell("Legal basis", 18), headerCell("Status", 12)] }),
    ];
    for (const r of reqs) {
      rows.push(
        new TableRow({
          children: [
            cell([para(r.title, { bold: true }), para(r.ruleSummary ?? r.whatItMeans, { size: 18 })], 38),
            cell([
              ...r.whatToCollect.map((w) => bullet(w)),
              ...(r.documentGuidance?.map((d) => bullet(`${d.label}: ${d.accepted.join(", ")}`)) ?? []),
            ], 32),
            cell(r.legalBasis.map((s) => para(`${s.org} ${s.reference}`, { size: 18 })), 18),
            cell([para(completed.includes(r.id) ? "Collected" : r.eddTrigger ? "EDD trigger" : STATUS_LABEL[statusFor(r, rk)], { size: 18 })], 12),
          ],
        })
      );
    }
    children.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
    children.push(para(""));
  }

  children.push(para("Guidance only, not legal advice. Use alongside your organisation's policies and verify against the cited primary source. Incoming changes (e.g. EU AMLR from 2027) are tagged where relevant.", { italics: true, color: "888888", size: 16 }));

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

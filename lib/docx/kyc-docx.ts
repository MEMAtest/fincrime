import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType } from "docx";
import { buildMergedRequirements, mergedStatus, type MergedResult } from "@/data/kyc/merge";
import type { EntityType, Jurisdiction, RiskLevel } from "@/data/kyc/types";
import { ENTITY_LABEL, JURISDICTION_LABEL, RISK_LABEL, CATEGORY_TITLE, CATEGORY_ORDER, STATUS_LABEL } from "@/data/kyc/types";

interface KycDocxData {
  entities: EntityType[];
  jurisdictions: Jurisdiction[];
  risks: RiskLevel[];
  completed?: string[];
  /** Prebuilt superset (route builds it once); falls back to building from the arrays. */
  merged?: MergedResult;
}

const para = (text: string, opts?: { bold?: boolean; italics?: boolean; color?: string; size?: number }) =>
  new Paragraph({ children: [new TextRun({ text, bold: opts?.bold, italics: opts?.italics, color: opts?.color, size: opts?.size })] });

const bullet = (text: string) => new Paragraph({ text, bullet: { level: 0 } });

const cell = (children: Paragraph[], width: number) =>
  new TableCell({ children, width: { size: width, type: WidthType.PERCENTAGE } });

const headerCell = (text: string, width: number) =>
  new TableCell({ children: [para(text, { bold: true, color: "FFFFFF" })], width: { size: width, type: WidthType.PERCENTAGE }, shading: { fill: "14B8A6" } });

export async function generateKycDocx(data: KycDocxData): Promise<Buffer> {
  const { entities, jurisdictions } = data;
  const risks = data.risks.length ? data.risks : (["medium"] as RiskLevel[]);
  const completed = data.completed ?? [];
  const multiJur = jurisdictions.length > 1;
  const merged = data.merged ?? buildMergedRequirements(entities, jurisdictions);
  const requirements = merged.requirements;
  const collected = requirements.filter((r) => completed.includes(r.key)).length;

  const children: (Paragraph | Table)[] = [
    new Paragraph({ text: "KYC / CDD Requirements", heading: HeadingLevel.TITLE }),
    para(`${entities.map((e) => ENTITY_LABEL[e]).join(", ")} — ${jurisdictions.map((j) => JURISDICTION_LABEL[j]).join(", ")}`, { bold: true }),
    para(`Risk context: ${risks.map((r) => RISK_LABEL[r]).join(", ")}` + (merged.anyFallback ? "  (FATF baseline used where a cell is not authored)" : ""), { italics: true, color: "666666" }),
    para(`${merged.scenarios.length} scenario(s) combined. Onboarding checklist: collected ${collected} of ${requirements.length}.`, { color: "0F7B4F" }),
    para(`Beneficial ownership threshold: ${merged.boThresholds.join(", ") || "-"}`, { bold: true }),
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
              ...r.documentGuidance.flatMap((jd) =>
                jd.guidance.map((d) => bullet(`${multiJur ? `[${JURISDICTION_LABEL[jd.jurisdiction]}] ` : ""}${d.label}: ${d.accepted.join(", ")}`))
              ),
            ], 32),
            cell(r.legalBasis.map((s) => para(`${s.org} ${s.reference}`, { size: 18 })), 18),
            cell([para(completed.includes(r.key) ? "Collected" : r.eddTrigger ? "EDD trigger" : STATUS_LABEL[mergedStatus(r, risks)], { size: 18 })], 12),
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

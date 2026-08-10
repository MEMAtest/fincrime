import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { addHeader, addFootersToAll, checkPageBreak, MEMA_COLORS } from "./shared";
import { formatIsoDate } from "@/lib/format/date";
import type { PortfolioSnapshot, PortfolioItem } from "@/lib/governance/portfolio";

export interface GovernancePackPayload {
  asOf: string;
  generatedAt: string;
  portfolio: PortfolioSnapshot;
}

function fmtDate(iso: string | null): string {
  return formatIsoDate(iso, { fallback: "-" });
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

const URGENCY_LABEL: Record<string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  overdue: "Overdue",
  due_soon: "Due soon",
  info: "-",
};

function renderTable(doc: jsPDF, y: number, title: string, items: PortfolioItem[], emptyMessage: string): number {
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text(`${title} (${items.length})`, 20, y);
  y += 6;

  if (items.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(emptyMessage, 20, y);
    return y + 10;
  }

  autoTable(doc, {
    startY: y,
    head: [["Item", "Type", "Status", "Date", "Urgency"]],
    // The "Date" column is labelled per-row (i.dueDateLabel: "Due", "Tested",
    // "Target launch") rather than a blanket "Due" header, because not every
    // section's date IS a due date - failedControlTests' date is when the
    // test was performed (a past fact) and decisionsRequired's readiness rows
    // use a planning target, not something owed. See PortfolioItem's
    // dueDateLabel doc comment in lib/governance/portfolio.ts.
    body: items.map((i) => [
      str(i.label),
      str(i.subjectType).replace(/_/g, " "),
      str(i.status),
      i.dueDate ? `${i.dueDateLabel ?? "Due"} ${fmtDate(i.dueDate)}` : "-",
      URGENCY_LABEL[i.urgency] ?? str(i.urgency),
    ]),
    theme: "grid",
    headStyles: { fillColor: MEMA_COLORS.accent, textColor: "#ffffff" },
    styles: { fontSize: 7, cellPadding: 1.8 },
    columnStyles: { 0: { cellWidth: 70 } },
  });
  // @ts-expect-error jspdf-autotable adds lastAutoTable
  return doc.lastAutoTable.finalY + 10;
}

/**
 * Governance pack: a dated portfolio snapshot, one table per Governance
 * Dashboard section, suitable for tabling at a committee. Built from a
 * PortfolioSnapshot the caller (app/api/export/pdf/route.ts) computes
 * SERVER-SIDE from the caller's own verified workspace - see that route's
 * governance_pack branch - never from a client-asserted payload, unlike every
 * other pack in this codebase: a committee artefact must not be forgeable by
 * a crafted POST.
 */
export function generateGovernancePDF(data: GovernancePackPayload): Buffer {
  const doc = new jsPDF();
  let y = addHeader(doc, "Governance Pack");

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`Portfolio snapshot as of ${fmtDate(data.asOf)}. Generated ${fmtDate(data.generatedAt.slice(0, 10))}.`, 20, y);
  y += 9;

  const p = data.portfolio;

  // KPI summary
  y = checkPageBreak(doc, y, 34);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text("Summary", 20, y);
  y += 6;
  autoTable(doc, {
    startY: y,
    head: [["Decisions required", "Outside appetite", "Open conditions/blockers", "Controls due/overdue", "Open incidents", "Overdue actions"]],
    body: [[
      String(p.decisionsRequired.count),
      String(p.riskOutsideAppetite.outside.count),
      String(p.openConditionsAndBlockers.count),
      String(p.controlsDueForTesting.count),
      String(p.incidents.open.count),
      String(p.overdueActions.count),
    ]],
    theme: "grid",
    headStyles: { fillColor: MEMA_COLORS.accent, textColor: "#ffffff" },
    styles: { fontSize: 7.5, cellPadding: 2 },
  });
  // @ts-expect-error jspdf-autotable adds lastAutoTable
  y = doc.lastAutoTable.finalY + 10;

  y = renderTable(doc, y, "Decisions required", p.decisionsRequired.items, "Nothing is currently awaiting a decision.");
  y = renderTable(doc, y, "Risk outside appetite", p.riskOutsideAppetite.outside.items, "No assessment is outside appetite.");
  y = renderTable(doc, y, "Risk tolerated outside appetite", p.riskOutsideAppetite.tolerated.items, "Nothing is currently tolerated.");
  y = renderTable(doc, y, "Open launch conditions and blockers", p.openConditionsAndBlockers.items, "No open conditions or unresolved launch blockers.");
  y = renderTable(doc, y, "Control changes in flight (approved, not implemented)", p.controlChangesInFlight.items, "No approved changes awaiting implementation.");
  y = renderTable(doc, y, "Control changes implemented, not yet retested", p.controlChangesImplementedNotTested.items, "Every implemented change has since been retested.");
  y = renderTable(doc, y, "Controls due or overdue for testing", p.controlsDueForTesting.items, "No control is due for testing in the next 30 days.");
  y = renderTable(doc, y, "Failed control tests", p.failedControlTests.items, "No failed control tests.");
  y = renderTable(doc, y, "Open incidents", p.incidents.open.items, "No open incidents.");
  y = renderTable(doc, y, "Open incidents past their remediation target", p.incidents.pastTarget.items, "No open incident has an overdue remediation action.");
  y = renderTable(doc, y, "Regulatory commitments - overdue", p.regulatoryCommitments.overdue.items, "No overdue commitments.");
  y = renderTable(doc, y, "Regulatory commitments - due within 30 days", p.regulatoryCommitments.dueSoon.items, "Nothing due in the next 30 days.");
  y = renderTable(doc, y, "Overdue actions (all workstreams)", p.overdueActions.items, "No overdue actions.");

  y = checkPageBreak(doc, y, 12);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(120, 120, 120);
  doc.text(
    "Note: sections can overlap - e.g. an overdue regulatory commitment also appears under Overdue actions as",
    20,
    y
  );
  y += 4;
  doc.text("its tracked action - so totals across sections should not be summed.", 20, y);

  addFootersToAll(doc);
  return Buffer.from(doc.output("arraybuffer"));
}

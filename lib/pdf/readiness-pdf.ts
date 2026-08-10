import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { addHeader, addFootersToAll, checkPageBreak, MEMA_COLORS, formatEvidenceFileCell } from "./shared";
import { formatIsoDate } from "@/lib/format/date";
import type { ReadinessExportPayload } from "@/components/readiness/types";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  in_review: "In Review",
  approved_local: "Approved (Local)",
  approved_global: "Approved (Global)",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const GAP_LABEL: Record<string, string> = {
  not_assessed: "Not assessed",
  none: "Not met",
  partial: "Partially met",
  full: "Fully met",
};

function fmtDate(iso: unknown): string {
  return formatIsoDate(iso, { fallback: "Not set" });
}

/** Defensive string coercion, matching lib/pdf/incident-pdf.ts's str() helper: non-strings fall back rather than reaching jsPDF as undefined/[object Object]. */
function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

/**
 * Launch-readiness pack: header (title, entity type, jurisdiction, risk
 * level, target launch date, status), the coverage summary, the obligation
 * register table (category, obligation, mapped control, gap, blocker, owner,
 * due date) with unresolved blockers called out separately, legal-basis
 * citations, evidence, decisions with approver and date, conditions and
 * actions. Reuses lib/pdf/shared.ts for branding, matching
 * lib/pdf/incident-pdf.ts's conventions.
 */
export function generateReadinessPDF(
  data: ReadinessExportPayload,
  orgInfo?: { organisationName?: string | null; dateFormat?: "en-GB" | "iso" }
): Buffer {
  const doc = new jsPDF();
  let y = addHeader(doc, "Entity & Market Readiness", orgInfo?.organisationName, orgInfo?.dateFormat);

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text(data.title || "Untitled assessment", 20, y);
  y += 7;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(
    `${str(data.entityType)}   ${str(data.jurisdiction)}   Risk: ${str(data.riskLevel)}   Status: ${STATUS_LABEL[data.status] ?? data.status}`,
    20,
    y
  );
  y += 6;
  doc.text(
    `Target launch: ${fmtDate(data.targetLaunchDate)}   Product: ${str(data.productName) || "Not linked"}   Owner: ${str(data.ownerName) || "Unassigned"}`,
    20,
    y
  );
  y += 9;

  // Coverage summary
  y = checkPageBreak(doc, y, 34);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text("Coverage summary", 20, y);
  y += 6;
  autoTable(doc, {
    startY: y,
    head: [["Total obligations", "Fully met", "Partial", "Not met", "Not assessed", "Blockers", "Unresolved", "Coverage"]],
    body: [
      [
        String(data.summary.total),
        String(data.summary.byGap.full),
        String(data.summary.byGap.partial),
        String(data.summary.byGap.none),
        String(data.summary.byGap.not_assessed),
        String(data.summary.blockerCount),
        String(data.summary.unresolvedBlockerCount),
        `${data.summary.coveragePct}%`,
      ],
    ],
    theme: "grid",
    headStyles: { fillColor: MEMA_COLORS.accent, textColor: "#ffffff" },
    styles: { fontSize: 7.5, cellPadding: 2 },
  });
  // @ts-expect-error jspdf-autotable adds lastAutoTable
  y = doc.lastAutoTable.finalY + 8;

  // Unresolved blockers
  const unresolved = data.obligations.filter((o) => o.blocker && o.gap !== "full");
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text(`Unresolved launch blockers (${unresolved.length})`, 20, y);
  y += 6;
  if (unresolved.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Obligation", "Gap", "Owner", "Due"]],
      body: unresolved.map((o) => [str(o.title), GAP_LABEL[o.gap] ?? o.gap, str(o.ownerName) || "Unassigned", fmtDate(o.dueDate)]),
      theme: "grid",
      headStyles: { fillColor: [220, 38, 38], textColor: "#ffffff" },
      styles: { fontSize: 8, cellPadding: 2 },
    });
    // @ts-expect-error jspdf-autotable adds lastAutoTable
    y = doc.lastAutoTable.finalY + 10;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("None. Every launch blocker is fully resolved.", 20, y);
    y += 10;
  }

  // Obligation register
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text(`Obligation register (${data.obligations.length})`, 20, y);
  y += 6;
  if (data.obligations.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Category", "Obligation", "Control", "Gap", "Blocker", "Owner", "Due"]],
      body: data.obligations.map((o) => [
        str(o.category).replace(/_/g, " "),
        str(o.title),
        str(o.controlName) || "Not mapped",
        GAP_LABEL[o.gap] ?? o.gap,
        o.blocker ? "Yes" : "No",
        str(o.ownerName) || "Unassigned",
        fmtDate(o.dueDate),
      ]),
      theme: "grid",
      headStyles: { fillColor: MEMA_COLORS.accent, textColor: "#ffffff" },
      styles: { fontSize: 7, cellPadding: 1.6 },
      columnStyles: { 1: { cellWidth: 45 } },
    });
    // @ts-expect-error jspdf-autotable adds lastAutoTable
    y = doc.lastAutoTable.finalY + 10;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("No obligations recorded.", 20, y);
    y += 10;
  }

  // Legal basis citations
  const citationRows: string[][] = [];
  for (const o of data.obligations) {
    for (const s of o.legalBasis) {
      citationRows.push([str(o.title), str(s.org), str(s.reference)]);
    }
  }
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text(`Legal basis citations (${citationRows.length})`, 20, y);
  y += 6;
  if (citationRows.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Obligation", "Source", "Reference"]],
      body: citationRows,
      theme: "grid",
      headStyles: { fillColor: MEMA_COLORS.accent, textColor: "#ffffff" },
      styles: { fontSize: 7, cellPadding: 1.6 },
    });
    // @ts-expect-error jspdf-autotable adds lastAutoTable
    y = doc.lastAutoTable.finalY + 10;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("No citations recorded.", 20, y);
    y += 10;
  }

  // Obligation-level follow-up actions (raised against a single obligation,
  // distinct from the assessment-level "Follow-up actions" table below)
  const obligationActionRows: string[][] = [];
  for (const o of data.obligations) {
    for (const a of Array.isArray(o.actions) ? o.actions : []) {
      obligationActionRows.push([str(o.title), str(a.title), str(a.ownerName) || "Unassigned", fmtDate(a.dueDate), str(a.status)]);
    }
  }
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text(`Obligation actions (${obligationActionRows.length})`, 20, y);
  y += 6;
  if (obligationActionRows.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Obligation", "Action", "Owner", "Due", "Status"]],
      body: obligationActionRows,
      theme: "grid",
      headStyles: { fillColor: MEMA_COLORS.accent, textColor: "#ffffff" },
      styles: { fontSize: 7, cellPadding: 1.6 },
    });
    // @ts-expect-error jspdf-autotable adds lastAutoTable
    y = doc.lastAutoTable.finalY + 10;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("No obligation-level actions recorded.", 20, y);
    y += 10;
  }

  // Evidence
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text(`Evidence (${data.evidence.length})`, 20, y);
  y += 6;
  if (data.evidence.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Title", "Type", "Link", "File"]],
      body: data.evidence.map((e) => [str(e.title), str(e.type), str(e.linkUrl) || "", formatEvidenceFileCell(e.fileName, e.fileSizeBytes)]),
      theme: "grid",
      headStyles: { fillColor: MEMA_COLORS.accent, textColor: "#ffffff" },
      styles: { fontSize: 8, cellPadding: 2 },
    });
    // @ts-expect-error jspdf-autotable adds lastAutoTable
    y = doc.lastAutoTable.finalY + 10;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text("No evidence recorded yet.", 20, y);
    y += 10;
  }

  // Follow-up actions
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text(`Assessment-level follow-up actions (${data.actions.length})`, 20, y);
  y += 6;
  if (data.actions.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Title", "Owner", "Due", "Priority", "Status"]],
      body: data.actions.map((a) => [str(a.title), str(a.ownerName) || "Unassigned", fmtDate(a.dueDate), str(a.priority), str(a.status)]),
      theme: "grid",
      headStyles: { fillColor: MEMA_COLORS.accent, textColor: "#ffffff" },
      styles: { fontSize: 8, cellPadding: 2 },
    });
    // @ts-expect-error jspdf-autotable adds lastAutoTable
    y = doc.lastAutoTable.finalY + 10;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("No follow-up actions recorded.", 20, y);
    y += 10;
  }

  // Decisions
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text(`Decisions (${data.decisions.length})`, 20, y);
  y += 6;
  if (data.decisions.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Level", "Outcome", "Decided by", "Date", "Rationale"]],
      body: data.decisions.map((d) => [
        d.level === "local" ? "Local approval" : d.level === "global" ? "Global approval" : "Rejection",
        d.outcome === "reject" ? "Reject" : "Approve",
        str(d.decidedByName),
        fmtDate(d.decidedAt),
        str(d.rationale) || "-",
      ]),
      theme: "grid",
      headStyles: { fillColor: MEMA_COLORS.accent, textColor: "#ffffff" },
      styles: { fontSize: 8, cellPadding: 2 },
    });
    // @ts-expect-error jspdf-autotable adds lastAutoTable
    y = doc.lastAutoTable.finalY + 10;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("No decisions recorded yet.", 20, y);
    y += 10;
  }

  // Conditions
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text(`Conditions (${data.conditions.length})`, 20, y);
  y += 6;
  if (data.conditions.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Description", "Owner", "Due", "Status"]],
      body: data.conditions.map((c) => [str(c.description), str(c.ownerName) || "Unassigned", fmtDate(c.dueDate), str(c.status)]),
      theme: "grid",
      headStyles: { fillColor: MEMA_COLORS.accent, textColor: "#ffffff" },
      styles: { fontSize: 8, cellPadding: 2 },
    });
    // @ts-expect-error jspdf-autotable adds lastAutoTable
    y = doc.lastAutoTable.finalY + 6;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("No conditions recorded.", 20, y);
    y += 8;
  }

  // Narrative (AI-assisted summary, if present)
  if (typeof data.narrative === "string" && data.narrative) {
    y = checkPageBreak(doc, y, 30);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(MEMA_COLORS.text);
    doc.text("Risk intelligence summary", 20, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(90, 90, 90);
    const narLines = doc.splitTextToSize(data.narrative, 170);
    doc.text(narLines, 20, y);
    y += narLines.length * 5;
  }

  addFootersToAll(doc);
  return Buffer.from(doc.output("arraybuffer"));
}

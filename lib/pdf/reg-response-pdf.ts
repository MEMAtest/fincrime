import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { addHeader, addFootersToAll, checkPageBreak, MEMA_COLORS } from "./shared";
import { formatIsoDate } from "@/lib/format/date";
import type { RegResponseExportPayload } from "@/components/reg-response/types";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  in_progress: "In Progress",
  in_review: "In Review",
  approved: "Approved",
  submitted: "Submitted",
  closed: "Closed",
  cancelled: "Cancelled",
};

const QUESTION_STATUS_LABEL: Record<string, string> = {
  unanswered: "Unanswered",
  drafted: "Drafted",
  reviewed: "Reviewed",
};

const COMMITMENT_STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  met: "Met",
  missed: "Missed",
  withdrawn: "Withdrawn",
};

function fmtDate(iso: unknown): string {
  return formatIsoDate(iso, { fallback: "Not set" });
}

/** Defensive string coercion, matching lib/pdf/readiness-pdf.ts's str() helper: non-strings fall back rather than reaching jsPDF as undefined/[object Object]. */
function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

/**
 * The regulatory response pack: header (reference, regulator, channel,
 * received, deadline, status), the free-text summary, each question with
 * its response, exception note and substantiating links, the commitments
 * table (status/owner/due date/tracked-action flag), conditions, evidence,
 * and the decision history. Reuses lib/pdf/shared.ts for branding, matching
 * lib/pdf/readiness-pdf.ts's conventions.
 */
export function generateRegResponsePDF(data: RegResponseExportPayload): Buffer {
  const doc = new jsPDF();
  let y = addHeader(doc, "Regulatory Response");

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text(data.title || "Untitled request", 20, y);
  y += 7;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(
    `${str(data.reference) || "No reference"}   ${str(data.regulator)}   Channel: ${str(data.channel) || "Not specified"}   Status: ${STATUS_LABEL[data.status] ?? data.status}`,
    20,
    y
  );
  y += 6;
  doc.text(
    `Received: ${fmtDate(data.receivedAt)}   Deadline: ${fmtDate(data.deadline)}   Submitted: ${fmtDate(data.submittedAt)}   Owner: ${str(data.ownerName) || "Unassigned"}`,
    20,
    y
  );
  y += 9;

  if (data.summary) {
    y = checkPageBreak(doc, y, 20);
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(90, 90, 90);
    const summaryLines = doc.splitTextToSize(data.summary, 170);
    doc.text(summaryLines, 20, y);
    y += summaryLines.length * 5 + 6;
  }

  // Progress summary
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text("Progress summary", 20, y);
  y += 6;
  autoTable(doc, {
    startY: y,
    head: [["Questions", "Answered", "Unanswered", "Answered %", "Commitments", "Overdue commitments", "Days to deadline"]],
    body: [
      [
        String(data.progress.totalQuestions),
        String(data.progress.answeredCount),
        String(data.progress.unansweredCount),
        `${data.progress.answeredPct}%`,
        String(data.progress.totalCommitments),
        String(data.progress.overdueCommitmentCount),
        data.progress.daysUntilDeadline === null ? "N/A" : String(data.progress.daysUntilDeadline),
      ],
    ],
    theme: "grid",
    headStyles: { fillColor: MEMA_COLORS.accent, textColor: "#ffffff" },
    styles: { fontSize: 7, cellPadding: 2 },
  });
  // @ts-expect-error jspdf-autotable adds lastAutoTable
  y = doc.lastAutoTable.finalY + 10;

  // Questions and responses
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text(`Questions and responses (${data.questions.length})`, 20, y);
  y += 6;
  if (data.questions.length > 0) {
    for (const q of data.questions) {
      y = checkPageBreak(doc, y, 24);
      doc.setFontSize(9.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(MEMA_COLORS.text);
      const qLines = doc.splitTextToSize(`#${q.position}. ${str(q.question)} (${QUESTION_STATUS_LABEL[q.status] ?? q.status})`, 170);
      doc.text(qLines, 20, y);
      y += qLines.length * 5 + 2;

      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(70, 70, 70);
      const responseLines = doc.splitTextToSize(`Response: ${str(q.response) || "Not yet answered."}`, 168);
      y = checkPageBreak(doc, y, responseLines.length * 4.5 + 4);
      doc.text(responseLines, 22, y);
      y += responseLines.length * 4.5 + 2;

      if (q.exceptionNote) {
        doc.setFont("helvetica", "italic");
        doc.setTextColor(150, 100, 30);
        const exceptionLines = doc.splitTextToSize(`Exception: ${str(q.exceptionNote)}`, 168);
        y = checkPageBreak(doc, y, exceptionLines.length * 4.5 + 4);
        doc.text(exceptionLines, 22, y);
        y += exceptionLines.length * 4.5 + 2;
      }

      if (q.links.length > 0) {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        const linksText = `Substantiated by: ${q.links.map((l) => `${l.label} (${l.linkType.replace(/_/g, " ")})`).join("; ")}`;
        const linkLines = doc.splitTextToSize(linksText, 168);
        y = checkPageBreak(doc, y, linkLines.length * 4.5 + 6);
        doc.text(linkLines, 22, y);
        y += linkLines.length * 4.5 + 6;
      } else {
        doc.setFont("helvetica", "italic");
        doc.setTextColor(180, 60, 60);
        y = checkPageBreak(doc, y, 8);
        doc.text("Not substantiated by any workspace record.", 22, y);
        y += 6;
      }
    }
  } else {
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("No questions recorded.", 20, y);
    y += 10;
  }

  // Commitments
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text(`Commitments (${data.commitments.length})`, 20, y);
  y += 6;
  if (data.commitments.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Description", "Owner", "Due", "Status", "Tracked action"]],
      body: data.commitments.map((c) => [
        str(c.description),
        str(c.ownerName) || "Unassigned",
        fmtDate(c.dueDate),
        COMMITMENT_STATUS_LABEL[c.status] ?? c.status,
        c.hasTrackedAction ? "Yes" : "No",
      ]),
      theme: "grid",
      headStyles: { fillColor: MEMA_COLORS.accent, textColor: "#ffffff" },
      styles: { fontSize: 7.5, cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 60 } },
    });
    // @ts-expect-error jspdf-autotable adds lastAutoTable
    y = doc.lastAutoTable.finalY + 10;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("No commitments recorded.", 20, y);
    y += 10;
  }

  // Follow-up actions
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text(`Follow-up actions (${data.actions.length})`, 20, y);
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
      head: [["Title", "Type", "Link"]],
      body: data.evidence.map((e) => [str(e.title), str(e.type), str(e.linkUrl) || ""]),
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
    y = doc.lastAutoTable.finalY + 10;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("No conditions recorded.", 20, y);
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
      head: [["Outcome", "Decided by", "Date", "Rationale"]],
      body: data.decisions.map((d) => [
        d.outcome === "reject" ? "Reject" : d.outcome === "approve_with_conditions" ? "Approve (with conditions)" : "Approve",
        str(d.decidedByName),
        fmtDate(d.decidedAt),
        str(d.rationale) || "-",
      ]),
      theme: "grid",
      headStyles: { fillColor: MEMA_COLORS.accent, textColor: "#ffffff" },
      styles: { fontSize: 8, cellPadding: 2 },
    });
    // @ts-expect-error jspdf-autotable adds lastAutoTable
    y = doc.lastAutoTable.finalY + 6;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("No decisions recorded yet.", 20, y);
    y += 8;
  }

  addFootersToAll(doc);
  return Buffer.from(doc.output("arraybuffer"));
}

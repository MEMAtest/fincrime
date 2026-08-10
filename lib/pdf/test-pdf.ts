import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { addHeader, addFootersToAll, checkPageBreak, MEMA_COLORS, formatEvidenceFileCell } from "./shared";
import type { TestExportPayload } from "@/components/control-testing/types";

const STATUS_LABEL: Record<string, string> = {
  planned: "Planned",
  in_progress: "In Progress",
  complete: "Complete",
  cancelled: "Cancelled",
};

const RESULT_LABEL: Record<string, string> = {
  pass: "Pass",
  pass_with_findings: "Pass with findings",
  fail: "Fail",
};

const METHOD_LABEL: Record<string, string> = {
  sample: "Sample testing",
  walkthrough: "Walkthrough",
  reperformance: "Reperformance",
  data_analysis: "Data analysis",
  other: "Other",
};

function fmtDate(iso: unknown): string {
  if (typeof iso !== "string" || !iso) return "Not set";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB");
}

/** Defensive against anything upstream validation missed: only a finite number renders, everything else falls back to "-" rather than throwing inside .toLocaleString(). */
function fmtNumber(v: unknown): string {
  return typeof v === "number" && Number.isFinite(v) ? v.toLocaleString("en-GB", { maximumFractionDigits: 2 }) : "-";
}

/** Defensive string coercion, matching lib/pdf/change-pdf.ts's str() helper: non-strings fall back rather than reaching jsPDF as undefined/[object Object]. */
function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

/** Test report for a Control Testing cycle: control under test, scope/method/period/tester, sample counts and pass rate, derived result and applied rating, findings, linked actions, evidence and conclusion. Reuses lib/pdf/shared.ts for branding, matching lib/pdf/change-pdf.ts's conventions. */
export function generateTestPDF(
  data: TestExportPayload,
  orgInfo?: { organisationName?: string | null; dateFormat?: "en-GB" | "iso" }
): Buffer {
  const doc = new jsPDF();
  let y = addHeader(doc, "Control Test Report", orgInfo?.organisationName, orgInfo?.dateFormat);

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text(data.testTitle || "Untitled test", 20, y);
  y += 7;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(
    `Control: ${data.controlName}   Method: ${data.method ? METHOD_LABEL[data.method] ?? data.method : "Not specified"}   Status: ${
      STATUS_LABEL[data.status] ?? data.status
    }`,
    20,
    y
  );
  y += 8;

  // Scope
  y = checkPageBreak(doc, y, 34);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text("Scope", 20, y);
  y += 6;
  autoTable(doc, {
    startY: y,
    body: [
      ["Period", `${fmtDate(data.periodStart)} to ${fmtDate(data.periodEnd)}`],
      ["Tester", str(data.testerName, "Unassigned") || "Unassigned"],
    ],
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { cellWidth: 40, fontStyle: "bold", textColor: MEMA_COLORS.text }, 1: { cellWidth: 130, textColor: [80, 80, 80] } },
  });
  // @ts-expect-error jspdf-autotable adds lastAutoTable
  y = doc.lastAutoTable.finalY + 10;

  // Samples and result
  y = checkPageBreak(doc, y, 44);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text("Samples and result", 20, y);
  y += 6;
  autoTable(doc, {
    startY: y,
    head: [["Sample size", "Passed", "Failed", "Partial", "Pass rate", "Result", "Applied rating"]],
    body: [
      [
        fmtNumber(data.sampleSize),
        fmtNumber(data.samplesPassed),
        fmtNumber(data.samplesFailed),
        fmtNumber(data.samplesPartial),
        data.passRatePct === null ? "-" : `${data.passRatePct}%`,
        data.derivedResult ? RESULT_LABEL[data.derivedResult] ?? data.derivedResult : "Not assessed",
        data.appliedRating ? data.appliedRating.replace(/_/g, " ") : "Not assessed",
      ],
    ],
    theme: "grid",
    headStyles: { fillColor: MEMA_COLORS.accent, textColor: "#ffffff" },
    styles: { fontSize: 8, cellPadding: 2 },
  });
  // @ts-expect-error jspdf-autotable adds lastAutoTable
  y = doc.lastAutoTable.finalY + 10;

  if (data.appliedVersion !== null || data.testedAt || data.nextTestDue) {
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(
      `Applied version: ${data.appliedVersion ?? "-"}   Tested: ${fmtDate(data.testedAt)}   Next test due: ${fmtDate(data.nextTestDue)}`,
      20,
      y
    );
    y += 8;
  }

  // Findings
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text(`Findings (${data.findings.length})`, 20, y);
  y += 6;
  if (data.findings.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Description", "Severity", "Sample ref", "Action raised"]],
      body: data.findings.map((f) => [str(f.description), str(f.severity), str(f.sampleRef) || "-", f.hasAction ? "Yes" : "No"]),
      theme: "grid",
      headStyles: { fillColor: MEMA_COLORS.accent, textColor: "#ffffff" },
      styles: { fontSize: 8, cellPadding: 2 },
      didParseCell: (hookData) => {
        if (hookData.section === "body" && hookData.column.index === 1) {
          const row = data.findings[hookData.row.index];
          if (row?.severity === "high") hookData.cell.styles.textColor = "#dc2626";
        }
      },
    });
    // @ts-expect-error jspdf-autotable adds lastAutoTable
    y = doc.lastAutoTable.finalY + 10;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("No findings recorded.", 20, y);
    y += 10;
  }

  // Linked actions
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text(`Linked actions (${data.actions.length})`, 20, y);
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

  // Conclusion
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(MEMA_COLORS.text);
  doc.text("Conclusion", 20, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  const cLines = doc.splitTextToSize(data.conclusion || "Not recorded.", 170);
  doc.text(cLines, 20, y);
  y += cLines.length * 5 + 4;

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

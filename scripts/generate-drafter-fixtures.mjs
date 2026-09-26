#!/usr/bin/env node
/**
 * Generates synthetic PRA Drafter test fixtures under test/fixtures/drafter/.
 * NO real client data - every value here is invented for testing. Run with:
 *   node scripts/generate-drafter-fixtures.mjs
 *
 * Produces:
 *  - register.xlsx: triggers every validation check in SPEC.md's import
 *    validation table (see inline comments below for exactly how)
 *  - register-summary-bad.md: a markdown "summary" of a register, which
 *    must be rejected as a register (contains a "[cite: 6]" artifact)
 *  - approved-pra.docx / approved-pra.md: numbered-section skeletons with
 *    standard wording, empty-section wording and the 4 enhancement field
 *    labels, for coder 3's skeleton extraction
 *  - style-brief.md: a house style brief
 */
import ExcelJS from "exceljs";
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "test", "fixtures", "drafter");
mkdirSync(outDir, { recursive: true });

// ---------------------------------------------------------------------------
// register.xlsx
// ---------------------------------------------------------------------------
const ALL_HEADERS = [
  "Applicability",
  "Obligation vs Guidance",
  "Group 2LOD Status",
  "Complete for PRA + Procedures?",
  "FinCrime Area",
  "Applicable control from Back Office (BO)",
  "Jurisdiction",
  "Source regulation",
  "Fincrime Product",
  "Control coverage assessment",
  "Obligation description",
  "Control Review Notes",
  "Control Uplift / Amendment",
  "Remediation on identified gaps",
  "Regulatory requirement ID",
  "Requirement reference",
  "BackOffice Linkage - ID",
  // "Scoping FinCrime Ticket" - deliberately omitted (missing column #1, evidence role -> blocking)
  "Requirement (original language)",
  "Requirement (translation)",
  "Rationale",
  // "Rationale for decision" - omitted (#2, reference_only -> blocking)
  "BackOffice Reconciliation Comment",
  "Phase",
  "Current Owner",
  // "RBUK 2LOD Status and Notes" - omitted (#3, unused -> warning)
  // "Group 1LOD Status and Notes" - omitted (#4, unused -> warning)
  // "Prioritisation" - omitted (#5, unused -> warning)
];

function row(overrides) {
  const base = {
    Applicability: "Applicable to Revolut",
    "Obligation vs Guidance": "Obligation",
    "Group 2LOD Status": "Revision Complete",
    "Complete for PRA + Procedures?": { error: "#REF!" },
    "FinCrime Area": "CDD",
    "Applicable control from Back Office (BO)": "Customer Due Diligence",
    Jurisdiction: "Lithuania",
    "Source regulation": "AMLD5",
    "Fincrime Product": "Correspondent Banking",
    "Control coverage assessment": "Yes",
    "Obligation description": "The firm identifies and verifies the identity of a legal person customer before establishing a business relationship.",
    "Control Review Notes": "Verification runs through the onboarding workflow before account activation.",
    "Control Uplift / Amendment": "",
    "Remediation on identified gaps": "",
    "Regulatory requirement ID": "REQ-0001",
    "Requirement reference": "Art. 13 (1) (a)",
    "BackOffice Linkage - ID": "BO-1001",
    "Requirement (original language)": "The obliged entity shall identify the customer.",
    "Requirement (translation)": "The obliged entity must identify the customer.",
    Rationale: "Partial coverage pending a system change.",
    "BackOffice Reconciliation Comment": "Reconciled against the back office control register.",
    Phase: "Phase 2",
    "Current Owner": { error: "#REF!" },
  };
  return { ...base, ...overrides };
}

const rows = [
  row({}), // REQ-0001: clean Yes/reuse row
  row({
    "Regulatory requirement ID": "REQ-0002",
    "FinCrime Area": "CDD",
    "Obligation description": "The firm applies enhanced due diligence to a legal person customer assessed as higher risk.",
    "Control coverage assessment": "Partial",
    "BackOffice Reconciliation Comment": "Marked Out of Scope by the regional team pending a later phase.",
  }), // contradiction: Applicable to Revolut + "Marked Out of Scope"
  row({
    "Regulatory requirement ID": "REQ-0003",
    "FinCrime Area": "EDD",
    "Applicable control from Back Office (BO)": "Enhanced Due Diligence",
    "Control coverage assessment": "Partial",
    "Control Review Notes": "",
    "Control Uplift / Amendment": "",
    "Remediation on identified gaps": "",
  }), // empty draft input
  row({
    "Regulatory requirement ID": "REQ-0004",
    "FinCrime Area": "CDD",
    "Fincrime Product": "N/A",
  }), // placeholder tag value
  row({
    "Regulatory requirement ID": "REQ-0005",
    "FinCrime Area": "Correspondent Banking",
    "Applicable control from Back Office (BO)": "Correspondent Banking Due Diligence",
    "Control coverage assessment": "No",
    "Obligation description": "The firm assesses a respondent institution's AML controls before establishing a correspondent relationship.",
    "Control Review Notes": "No existing control covers this obligation.",
  }), // No -> new, closer review
  row({
    "Regulatory requirement ID": "REQ-0006",
    "FinCrime Area": "CDD",
    "Control coverage assessment": "",
  }), // blank coverage -> unassessed
  row({
    "Regulatory requirement ID": "REQ-0007",
    "Requirement (translation)": "The obliged entity shall identify the customer.",
  }), // translation == original (info)
  row({
    "Regulatory requirement ID": "REQ-0007", // duplicate REQ ID (shares REQ-0007 with the row above)
    "FinCrime Area": "EDD",
  }),
  row({
    "Regulatory requirement ID": "REQ-0008",
    "FinCrime Area": "Correspondent Banking",
    "Applicable control from Back Office (BO)": "Correspondent Banking Due Diligence",
    "Control coverage assessment": "Yes",
    Jurisdiction: "Cyprus",
  }),
  row({
    "Regulatory requirement ID": "REQ-0009",
    "FinCrime Area": "CDD",
    "Control coverage assessment": "Partial",
    Jurisdiction: "Ireland",
  }),
];

const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet("Register");
// Row 1: a title/caption row above the real header row, so header-row
// detection must NOT assume row 1 is the header.
sheet.addRow(["Correspondent Banking, CDD & EDD Requirements Register - synthetic test fixture"]);
sheet.addRow([]);
sheet.addRow(ALL_HEADERS);
for (const r of rows) {
  sheet.addRow(ALL_HEADERS.map((h) => r[h] ?? ""));
}

await workbook.xlsx.writeFile(path.join(outDir, "register.xlsx"));
console.log("wrote register.xlsx");

// ---------------------------------------------------------------------------
// register-summary-bad.md - a markdown summary of a register (must be
// rejected as a register: drops columns, carries a "[cite: 6]" artifact).
// ---------------------------------------------------------------------------
const summaryMd = `# Requirements Register Summary

REQ-0001: Customer identification for legal person customers is covered [cite: 6].
REQ-0002: Enhanced due diligence for higher-risk legal persons is partially covered [cite: 7].
REQ-0005: Correspondent banking due diligence has no existing control.

This summary was generated from the full register and omits Control Review
Notes and other working columns.
`;
writeFileSync(path.join(outDir, "register-summary-bad.md"), summaryMd);
console.log("wrote register-summary-bad.md");

// ---------------------------------------------------------------------------
// approved-pra.md - numbered sections, standard/empty wording, field labels.
// ---------------------------------------------------------------------------
const approvedPraMd = `# Correspondent Banking Product Risk Assessment (Approved)

## 2. Financial Crime Controls

### 2.1 Customer Due Diligence (CDD) · Onboarding · Natural Person

The following control enhancements apply to onboarding checks for natural person customers.

**Control enhancement**: The system verifies a natural person customer's identity against an independent data source before the account is activated.

**Control enhancement rationale**: This reduces the risk of onboarding a customer under a false identity, since verification happens before any funds can move rather than being reviewed afterwards.

**Backoffice control impacted**: Customer Due Diligence

**Evidence of delivery**: REQ-0010, Art. 13 (1) (a)

### 2.2 Customer Due Diligence (CDD) · Onboarding · Legal Person

The following control enhancements apply to onboarding checks for legal person customers.

**Control enhancement**: The system identifies and verifies the identity of a legal person customer, including its beneficial owners, before a business relationship is established.

**Control enhancement rationale**: A legal person structure can obscure the natural person ultimately in control, so verifying beneficial ownership before onboarding closes that gap at the point of greatest risk.

**Backoffice control impacted**: Customer Due Diligence

**Evidence of delivery**: REQ-0011, Art. 13 (1) (b)

### 2.3 Enhanced Due Diligence (EDD) · Ongoing Monitoring · Both

No control enhancements apply to this section for the current product.

### 2.4 Correspondent Banking Due Diligence · Onboarding · Legal Person

**Control enhancement**: The firm assesses a respondent institution's anti-money laundering controls and ownership structure before a correspondent relationship begins.

**Control enhancement rationale**: A correspondent relationship extends the firm's exposure to a respondent's own customer base, so the assessment has to happen before the relationship opens rather than after.

**Backoffice control impacted**: Correspondent Banking Due Diligence

**Evidence of delivery**: REQ-0012, Art. 19 (1)
`;
writeFileSync(path.join(outDir, "approved-pra.md"), approvedPraMd);
console.log("wrote approved-pra.md");

// ---------------------------------------------------------------------------
// approved-pra.docx - same content, real Word heading styles.
// ---------------------------------------------------------------------------
function enhancementParagraphs({ text, rationale, control, evidence }) {
  return [
    new Paragraph({ children: [new TextRun({ text: "Control enhancement: ", bold: true }), new TextRun(text)] }),
    new Paragraph({ children: [new TextRun({ text: "Control enhancement rationale: ", bold: true }), new TextRun(rationale)] }),
    new Paragraph({ children: [new TextRun({ text: "Backoffice control impacted: ", bold: true }), new TextRun(control)] }),
    new Paragraph({ children: [new TextRun({ text: "Evidence of delivery: ", bold: true }), new TextRun(evidence)] }),
  ];
}

const doc = new Document({
  sections: [
    {
      children: [
        new Paragraph({ text: "Correspondent Banking Product Risk Assessment (Approved)", heading: HeadingLevel.TITLE }),
        new Paragraph({ text: "2. Financial Crime Controls", heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ text: "2.1 Customer Due Diligence (CDD) · Onboarding · Natural Person", heading: HeadingLevel.HEADING_2 }),
        new Paragraph("The following control enhancements apply to onboarding checks for natural person customers."),
        ...enhancementParagraphs({
          text: "The system verifies a natural person customer's identity against an independent data source before the account is activated.",
          rationale: "This reduces the risk of onboarding a customer under a false identity, since verification happens before any funds can move rather than being reviewed afterwards.",
          control: "Customer Due Diligence",
          evidence: "REQ-0010, Art. 13 (1) (a)",
        }),
        new Paragraph({ text: "2.2 Customer Due Diligence (CDD) · Onboarding · Legal Person", heading: HeadingLevel.HEADING_2 }),
        new Paragraph("The following control enhancements apply to onboarding checks for legal person customers."),
        ...enhancementParagraphs({
          text: "The system identifies and verifies the identity of a legal person customer, including its beneficial owners, before a business relationship is established.",
          rationale: "A legal person structure can obscure the natural person ultimately in control, so verifying beneficial ownership before onboarding closes that gap at the point of greatest risk.",
          control: "Customer Due Diligence",
          evidence: "REQ-0011, Art. 13 (1) (b)",
        }),
        new Paragraph({ text: "2.3 Enhanced Due Diligence (EDD) · Ongoing Monitoring · Both", heading: HeadingLevel.HEADING_2 }),
        new Paragraph("No control enhancements apply to this section for the current product."),
        new Paragraph({ text: "2.4 Correspondent Banking Due Diligence · Onboarding · Legal Person", heading: HeadingLevel.HEADING_2 }),
        ...enhancementParagraphs({
          text: "The firm assesses a respondent institution's anti-money laundering controls and ownership structure before a correspondent relationship begins.",
          rationale: "A correspondent relationship extends the firm's exposure to a respondent's own customer base, so the assessment has to happen before the relationship opens rather than after.",
          control: "Correspondent Banking Due Diligence",
          evidence: "REQ-0012, Art. 19 (1)",
        }),
      ],
    },
  ],
});
const docxBuffer = await Packer.toBuffer(doc);
writeFileSync(path.join(outDir, "approved-pra.docx"), docxBuffer);
console.log("wrote approved-pra.docx");

// ---------------------------------------------------------------------------
// style-brief.md
// ---------------------------------------------------------------------------
const styleBrief = `# House Style Brief - PRA Control Enhancements (synthetic)

1. One enhancement describes one mechanism: trigger, actor, action, outcome.
2. No enhancement only restates that a policy exists.
3. State scope explicitly, as a short list when there are several cases.
4. Rationale explains the risk and the design choice in 2 to 4 sentences.
5. Present tense for how the control works; present perfect only for a
   delivered build change; "will" only for something not yet live.
6. REQ IDs and article references appear only in the Evidence field.
7. Measured tone. Avoid: non-negotiable, severe, contagion, immediate, rails.
8. No em dashes or en dashes.
9. Control text 60 to 150 words.
`;
writeFileSync(path.join(outDir, "style-brief.md"), styleBrief);
console.log("wrote style-brief.md");

console.log(`\nAll fixtures written to ${outDir}`);

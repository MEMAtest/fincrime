import ExcelJS from "exceljs";
import path from "node:path";

const outDir = "/Users/omosanya_main/fincrime-pra-drafter/test/fixtures/drafter-rehearsal";

const ALL_HEADERS = [
  "Applicability","Obligation vs Guidance","Group 2LOD Status","Complete for PRA + Procedures?",
  "FinCrime Area","Applicable control from Back Office (BO)","Jurisdiction","Source regulation",
  "Fincrime Product","Control coverage assessment","Obligation description","Control Review Notes",
  "Control Uplift / Amendment","Remediation on identified gaps","Regulatory requirement ID",
  "Requirement reference","BackOffice Linkage - ID","Requirement (original language)",
  "Requirement (translation)","Rationale","BackOffice Reconciliation Comment","Phase","Current Owner",
];

const areas = [
  { area: "CDD", bo: "Customer Due Diligence", product: "Correspondent Banking" },
  { area: "EDD", bo: "Enhanced Due Diligence", product: "Correspondent Banking" },
  { area: "Sanctions", bo: "Sanctions Screening", product: "Correspondent Banking" },
  { area: "Transaction Monitoring", bo: "Transaction Monitoring", product: "Correspondent Banking" },
  { area: "Correspondent Banking", bo: "Correspondent Banking Due Diligence", product: "Correspondent Banking" },
];
const jurisdictions = ["Lithuania","Cyprus","Ireland","Poland","Germany","Malta","Netherlands","UK"];
const coverages = ["Yes","Partial","No",""];
const customerTypes = ["natural person","legal person"];

function row(overrides) {
  const base = {
    Applicability: "Applicable to Revolut",
    "Obligation vs Guidance": "Obligation",
    "Group 2LOD Status": "Revision Complete",
    "Complete for PRA + Procedures?": "Yes",
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
    "Current Owner": "FinCrime Ops",
  };
  return { ...base, ...overrides };
}

const rows = [];
let n = 1;
function nextId() { return `REQ-${String(n++).padStart(4, "0")}`; }

// 50 "normal" realistic rows spread across areas/jurisdictions/coverage/customer type
for (let i = 0; i < 52; i++) {
  const a = areas[i % areas.length];
  const j = jurisdictions[i % jurisdictions.length];
  const cov = coverages[i % coverages.length];
  const ct = customerTypes[i % customerTypes.length];
  rows.push(row({
    "Regulatory requirement ID": nextId(),
    "FinCrime Area": a.area,
    "Applicable control from Back Office (BO)": a.bo,
    "Fincrime Product": a.product,
    Jurisdiction: j,
    "Control coverage assessment": cov,
    "Obligation description": `The firm applies ${a.area} measures for a ${ct} customer under ${j} implementing rules, obligation #${i + 1}.`,
    "Control Review Notes": cov === "No" || cov === "" ? "" : `Existing control reviewed and mapped to ${a.bo} for ${ct} customers.`,
  }));
}

// SPEC.md validation cases (mirrors existing base fixture, kept for completeness)
rows.push(row({ "Regulatory requirement ID": nextId(), "FinCrime Area": "EDD", "Control coverage assessment": "Partial", "BackOffice Reconciliation Comment": "Marked Out of Scope by the regional team pending a later phase." }));
rows.push(row({ "Regulatory requirement ID": nextId(), "FinCrime Area": "EDD", "Control coverage assessment": "Partial", "Control Review Notes": "", "Control Uplift / Amendment": "", "Remediation on identified gaps": "" }));
rows.push(row({ "Regulatory requirement ID": nextId(), "Fincrime Product": "N/A" }));
rows.push(row({ "Regulatory requirement ID": nextId(), "FinCrime Area": "Correspondent Banking", "Applicable control from Back Office (BO)": "Correspondent Banking Due Diligence", "Control coverage assessment": "No", "Control Review Notes": "No existing control covers this obligation." }));
rows.push(row({ "Regulatory requirement ID": nextId(), "Control coverage assessment": "" }));
rows.push(row({ "Regulatory requirement ID": nextId(), "Requirement (translation)": "The obliged entity shall identify the customer." }));
const dupId = nextId();
rows.push(row({ "Regulatory requirement ID": dupId, "FinCrime Area": "CDD" }));
rows.push(row({ "Regulatory requirement ID": dupId, "FinCrime Area": "EDD" })); // duplicate REQ ID
rows.push(row({ "Regulatory requirement ID": nextId(), "Complete for PRA + Procedures?": { error: "#REF!" }, "Current Owner": { error: "#REF!" } }));

// Marker rows for the rehearsal writer/judge/tagger stub. req_id carries the
// marker so it lands in the model userPrompt (writer/judge/tagger prompts
// all include req id and/or source text); coverage "No" forces a fresh
// draft through the writer, so its stubbed output can itself carry the
// marker text the judge stub then looks for.
const markerReqIds = [
  "REQ-0001-BAD-NUMBER", "REQ-0001-BANNED-PHRASE", "REQ-0001-REQID-IN-TEXT",
  "REQ-0001-EM-DASH", "REQ-0001-TOO-LONG", "REQ-0001-MALFORMED",
  "RQJPASSMK", "RQJMINORMK", "RQJCRITMK",
  "RQJQNFMK", "RQJUNKMK", "RQJMALMK",
  "RQTGOODMK", "RQTOOLMK", "RQTMALMK",
];
for (const id of markerReqIds) {
  rows.push(row({
    "Regulatory requirement ID": id,
    "FinCrime Area": "Correspondent Banking",
    "Applicable control from Back Office (BO)": "Correspondent Banking Due Diligence",
    "Fincrime Product": "Correspondent Banking",
    "Control coverage assessment": "No",
    "Obligation description": `The firm screens correspondent relationships before onboarding (rehearsal marker ${id}).`,
    "Control Review Notes": `Rehearsal stub marker row for ${id} - no existing control covers this obligation.`,
  }));
}

const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet("Register");
sheet.addRow(["Correspondent Banking, CDD, EDD, Sanctions & TM Requirements Register - rehearsal fixture (synthetic)"]);
sheet.addRow([]);
sheet.addRow(ALL_HEADERS);
for (const r of rows) sheet.addRow(ALL_HEADERS.map((h) => r[h] ?? ""));
await workbook.xlsx.writeFile(path.join(outDir, "register-rehearsal.xlsx"));
console.log(`wrote register-rehearsal.xlsx with ${rows.length} data rows`);

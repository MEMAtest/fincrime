import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import { query } from "@/lib/db";
import { draftOneEnhancement } from "../draft-enhancement";
import { setAgreedWording } from "@/lib/repo/drafter-controls";

/**
 * End-to-end test of the writer pipeline (prompt -> stub model -> fact
 * boundary -> lint -> persistence) against real DB rows and the realistic
 * good/bad stub fixture at test/fixtures/drafter/writer-stub.json (SPEC.md
 * "Stub fixtures for the writer"). Runs against the local fincrime_dev DB
 * (same one vitest already points at via test/setup-env.ts) and cleans up
 * everything it inserts.
 */

const STUB_FILE = path.join(process.cwd(), "test/fixtures/drafter/writer-stub.json");
const ACTOR = "drafter-test@example.com";

let templateVersionId: string;
let stylepackVersionId: string;
let praId: string;
let sectionId: string;
const enhancementIds: string[] = [];
const controlIds: string[] = [];

async function makeEnhancement(marker: string): Promise<string> {
  const controlRows = await query<{ id: string }>(
    `INSERT INTO drafter_controls (title, req_ids, backoffice_control, coverage) VALUES ($1,'{}','Correspondent Banking Due Diligence','no') RETURNING id`,
    [`Test control ${marker}`]
  );
  const controlId = controlRows[0].id;
  controlIds.push(controlId);

  await query(
    `INSERT INTO drafter_control_tags (control_id, tag_type, value, origin, confirmed) VALUES ($1,'coverage','No','code',true)`,
    [controlId]
  );

  const registerVersionId = await seedRegisterRowForControl(controlId, marker);
  void registerVersionId;

  const enhancementRows = await query<{ id: string }>(
    `INSERT INTO drafter_enhancements (section_id, pra_id, sort_order, control_ids, review_result, is_gap)
     VALUES ($1,$2,0,$3,'{"lint":[],"status":"not_reviewed"}',false) RETURNING id`,
    [sectionId, praId, [controlId]]
  );
  enhancementIds.push(enhancementRows[0].id);
  return enhancementRows[0].id;
}

async function seedRegisterRowForControl(controlId: string, marker: string): Promise<string> {
  const docRows = await query<{ id: string }>(
    `INSERT INTO drafter_documents (doc_type, confirmed_doc_type, filename, format, content_hash, uploaded_by) VALUES ('register','register',$1,'xlsx','hash-${marker}',$2) RETURNING id`,
    [`register-${marker}.xlsx`, ACTOR]
  );
  const importRows = await query<{ id: string }>(
    `INSERT INTO drafter_register_imports (document_id, sheet_name, header_row_index, created_by) VALUES ($1,'Sheet1',0,$2) RETURNING id`,
    [docRows[0].id, ACTOR]
  );
  await query(
    `INSERT INTO drafter_column_mappings (register_import_id, source_header, role, field_key, updated_by) VALUES ($1,'Control Review Notes','draft_input','control_review_notes',$2)`,
    [importRows[0].id, ACTOR]
  );
  await query(
    `INSERT INTO drafter_column_mappings (register_import_id, source_header, role, field_key, updated_by) VALUES ($1,'Obligation description','draft_input','obligation_description',$2)`,
    [importRows[0].id, ACTOR]
  );
  const versionRows = await query<{ id: string }>(
    `INSERT INTO drafter_register_versions (register_import_id, version, status, created_by) VALUES ($1,1,'accepted',$2) RETURNING id`,
    [importRows[0].id, ACTOR]
  );
  const rowRows = await query<{ id: string }>(
    `INSERT INTO drafter_register_rows (register_version_id, req_id, row_index, fields, is_blocked)
     VALUES ($1,$2,0,$3,false) RETURNING id`,
    [
      versionRows[0].id,
      `REQ-${marker}`,
      JSON.stringify({
        "Control Review Notes": {
          text: marker.includes("REQID")
            ? `Current control assesses correspondent respondents under REQ-0012 Art. 19 (1). ${marker}`
            : `Current control assesses correspondent respondents. ${marker}`,
        },
        "Obligation description": { text: `Current control assesses correspondent respondents. ${marker}` },
      }),
    ]
  );
  await query(`UPDATE drafter_controls SET register_row_ids = array_append(register_row_ids, $2) WHERE id = $1`, [controlId, rowRows[0].id]);
  return versionRows[0].id;
}

beforeAll(async () => {
  process.env.PRA_MODEL_STUB = "1";
  process.env.PRA_MODEL_STUB_FILE = STUB_FILE;
  delete process.env.VERCEL_ENV;

  const templateRows = await query<{ id: string }>(`INSERT INTO drafter_templates (name) VALUES ('Integration test template') RETURNING id`);
  const templateVersionRows = await query<{ id: string }>(
    `INSERT INTO drafter_template_versions (template_id, version, sections, field_labels, confirmed, created_by)
     VALUES ($1,1,$2,$3,true,$4) RETURNING id`,
    [
      templateRows[0].id,
      JSON.stringify([{ number: "2.4", title: "Correspondent Banking Due Diligence", lifecycleStage: "Onboarding", customerType: "legal_person", standardWording: null, emptySectionWording: null, backofficeControlMap: "Correspondent Banking Due Diligence" }]),
      JSON.stringify({ control_enhancement: "Control enhancement", control_enhancement_rationale: "Control enhancement rationale", backoffice_control_impacted: "Backoffice control impacted", evidence_of_delivery: "Evidence of delivery" }),
      ACTOR,
    ]
  );
  templateVersionId = templateVersionRows[0].id;

  const stylepackRows = await query<{ id: string }>(`INSERT INTO drafter_stylepacks (name) VALUES ('Integration test style') RETURNING id`);
  const stylepackVersionRows = await query<{ id: string }>(
    `INSERT INTO drafter_stylepack_versions (stylepack_id, version, rules, banned_phrases, tense_rule, length_limits, created_by)
     VALUES ($1,1,$2,$3,'present tense',$4,$5) RETURNING id`,
    [
      stylepackRows[0].id,
      JSON.stringify(["One enhancement describes one mechanism."]),
      JSON.stringify([
        { phrase: "non-negotiable", replacement: "required" },
        { phrase: "severe", replacement: "significant" },
        { phrase: "contagion", replacement: "spread" },
        { phrase: "immediate", replacement: "prompt" },
        { phrase: "rails", replacement: "channels" },
      ]),
      JSON.stringify({ min_words: 60, max_words: 150 }),
      ACTOR,
    ]
  );
  stylepackVersionId = stylepackVersionRows[0].id;

  const praRows = await query<{ id: string }>(
    `INSERT INTO drafter_pras (product, description, customer_types, template_version_id, stylepack_version_id, cost_cap_pence, created_by)
     VALUES ('Test correspondent banking product','A correspondent banking product for legal person customers.','{legal_person}',$1,$2,2000,$3) RETURNING id`,
    [templateVersionId, stylepackVersionId, ACTOR]
  );
  praId = praRows[0].id;

  const sectionRows = await query<{ id: string }>(
    `INSERT INTO drafter_sections (pra_id, section_number, title, customer_type, sort_order, is_empty) VALUES ($1,'2.4','Correspondent Banking Due Diligence','legal_person',0,true) RETURNING id`,
    [praId]
  );
  sectionId = sectionRows[0].id;
});

afterAll(async () => {
  await query(`DELETE FROM drafter_open_items WHERE pra_id = $1`, [praId]);
  await query(`DELETE FROM drafter_enhancement_edits WHERE enhancement_id = ANY($1::uuid[])`, [enhancementIds]);
  await query(`DELETE FROM drafter_model_calls WHERE pra_id = $1`, [praId]);
  await query(`DELETE FROM drafter_enhancements WHERE pra_id = $1`, [praId]);
  await query(`DELETE FROM drafter_sections WHERE pra_id = $1`, [praId]);
  await query(`DELETE FROM drafter_pras WHERE id = $1`, [praId]);
  await query(`DELETE FROM drafter_stylepack_versions WHERE id = $1`, [stylepackVersionId]);
  await query(`DELETE FROM drafter_template_versions WHERE id = $1`, [templateVersionId]);
  await query(`DELETE FROM drafter_control_tags WHERE control_id = ANY($1::uuid[])`, [controlIds]);
  await query(`DELETE FROM drafter_controls WHERE id = ANY($1::uuid[])`, [controlIds]);
  delete process.env.PRA_MODEL_STUB;
  delete process.env.PRA_MODEL_STUB_FILE;
});

describe("draftOneEnhancement (real DB + stub writer fixtures)", () => {
  it("drafts a realistic good output that passes lint cleanly", async () => {
    const id = await makeEnhancement("GOOD");
    const result = await draftOneEnhancement(id, ACTOR);
    expect(result.ok).toBe(true);
    // Lint-clean, but SPEC.md/coder 4's fix: never "pass" until a judge has
    // actually run - a lint-only clean draft is "not_reviewed", not "pass".
    expect(result.enhancement?.review_result?.status).toBe("not_reviewed");
    expect(result.enhancement?.review_result?.lint).toEqual([]);
    expect(result.enhancement?.control_text).not.toMatch(/[—–]/);
  });

  it("replaces an invented number/frequency and flags an invented role/system via the fact boundary", async () => {
    const id = await makeEnhancement("REQ-0001-BAD-NUMBER");
    const result = await draftOneEnhancement(id, ACTOR);
    expect(result.ok).toBe(true);
    expect(result.enhancement?.control_text).toContain("[unsupported figure - verify]");
    expect(result.enhancement?.placeholders.length).toBeGreaterThan(0);
    const openItems = await query<{ item_type: string; description: string }>(`SELECT item_type, description FROM drafter_open_items WHERE enhancement_id = $1`, [id]);
    expect(openItems.some((i) => i.item_type === "unsupported_term" && i.description.includes("Senior Risk Committee"))).toBe(true);
  });

  it("lint flags a banned phrase", async () => {
    const id = await makeEnhancement("REQ-0001-BANNED-PHRASE");
    const result = await draftOneEnhancement(id, ACTOR);
    expect(result.ok).toBe(true);
    const lint = result.enhancement?.review_result?.lint ?? [];
    expect(lint.some((l) => l.rule === "banned_phrase")).toBe(true);
    expect(result.enhancement?.review_result?.status).toBe("critical");
  });

  it("lint flags a REQ ID inside control text", async () => {
    const id = await makeEnhancement("REQ-0001-REQID-IN-TEXT");
    const result = await draftOneEnhancement(id, ACTOR);
    expect(result.ok).toBe(true);
    const lint = result.enhancement?.review_result?.lint ?? [];
    expect(lint.some((l) => l.rule === "req_id_outside_evidence")).toBe(true);
  });

  it("lint flags an em dash", async () => {
    const id = await makeEnhancement("REQ-0001-EM-DASH");
    const result = await draftOneEnhancement(id, ACTOR);
    expect(result.ok).toBe(true);
    const lint = result.enhancement?.review_result?.lint ?? [];
    expect(lint.some((l) => l.rule === "dash")).toBe(true);
  });

  it("lint flags control text over the word limit", async () => {
    const id = await makeEnhancement("REQ-0001-TOO-LONG");
    const result = await draftOneEnhancement(id, ACTOR);
    expect(result.ok).toBe(true);
    const lint = result.enhancement?.review_result?.lint ?? [];
    expect(lint.some((l) => l.rule === "word_count")).toBe(true);
  });

  it("fails visibly and never records a silent pass on malformed model JSON", async () => {
    const id = await makeEnhancement("REQ-0001-MALFORMED");
    const before = await query<{ review_result: unknown }>(`SELECT review_result FROM drafter_enhancements WHERE id = $1`, [id]);
    const result = await draftOneEnhancement(id, ACTOR);
    expect(result.ok).toBe(false);
    const after = await query<{ review_result: { status: string } }>(`SELECT review_result FROM drafter_enhancements WHERE id = $1`, [id]);
    expect(after[0].review_result.status).not.toBe("pass");
    void before;
  });

  it("takes the placeholder path with no model call when draft inputs are empty", async () => {
    const controlRows = await query<{ id: string }>(
      `INSERT INTO drafter_controls (title, req_ids, backoffice_control, coverage) VALUES ('Empty inputs control','{}','Correspondent Banking Due Diligence','partial') RETURNING id`
    );
    controlIds.push(controlRows[0].id);
    const enhancementRows = await query<{ id: string }>(
      `INSERT INTO drafter_enhancements (section_id, pra_id, sort_order, control_ids, review_result, is_gap)
       VALUES ($1,$2,0,$3,'{"lint":[],"status":"not_reviewed"}',false) RETURNING id`,
      [sectionId, praId, [controlRows[0].id]]
    );
    enhancementIds.push(enhancementRows[0].id);

    const result = await draftOneEnhancement(enhancementRows[0].id, ACTOR);
    expect(result.ok).toBe(true);
    expect(result.enhancement?.control_text).toContain("placeholder pending input");
    expect(result.enhancement?.model_name).toBeNull();
  });

  it("reuse coverage never makes a model call and drafts a placeholder + open item when no agreed wording is held (Scope B fix: never falls back to the obligation description)", async () => {
    const controlRows = await query<{ id: string }>(
      `INSERT INTO drafter_controls (title, req_ids, backoffice_control, coverage) VALUES ('Reuse control','{}','Correspondent Banking Due Diligence','yes') RETURNING id`
    );
    controlIds.push(controlRows[0].id);
    await seedRegisterRowForControl(controlRows[0].id, "REUSE");
    const enhancementRows = await query<{ id: string }>(
      `INSERT INTO drafter_enhancements (section_id, pra_id, sort_order, control_ids, review_result, is_gap)
       VALUES ($1,$2,0,$3,'{"lint":[],"status":"not_reviewed"}',false) RETURNING id`,
      [sectionId, praId, [controlRows[0].id]]
    );
    enhancementIds.push(enhancementRows[0].id);

    const result = await draftOneEnhancement(enhancementRows[0].id, ACTOR);
    expect(result.ok).toBe(true);
    expect(result.enhancement?.model_name).toBeNull();
    expect(result.enhancement?.control_text).toBe("[Agreed wording not held for this control]");
    const openItems = await query<{ description: string }>(`SELECT description FROM drafter_open_items WHERE enhancement_id = $1`, [enhancementRows[0].id]);
    expect(openItems.some((i) => i.description.includes("agreed wording"))).toBe(true);

    // Now set agreed wording on the control directly and re-draft: reuse
    // should carry that real text forward.
    await setAgreedWording(controlRows[0].id, "The team screens every correspondent respondent before onboarding.", ACTOR);
    const second = await draftOneEnhancement(enhancementRows[0].id, ACTOR);
    expect(second.ok).toBe(true);
    expect(second.enhancement?.control_text).toBe("The team screens every correspondent respondent before onboarding.");
  });
});

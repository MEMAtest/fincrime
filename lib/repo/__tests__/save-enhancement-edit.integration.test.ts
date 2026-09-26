import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { query } from "@/lib/db";
import { getEnhancement, saveEnhancementEdit } from "@/lib/repo/drafter-pras";

/**
 * PRA Drafter defect: "APPLY FIX DOES NOT PERSIST" - Apply fix updated the
 * UI, Save was clicked, but after a reload the rationale had reverted. The
 * PATCH route previously wrote the edit-history row and the new
 * control_text/rationale as two independent, non-transactional queries, and
 * the client silently ignored a failed save (still called `load()`
 * regardless), so a failure looked exactly like a successful save until a
 * hard reload exposed the real, unpersisted server value.
 *
 * This test exercises the fix directly at the repo layer
 * (saveEnhancementEdit): a save must be atomic, and a fresh read afterwards
 * (simulating "the user reloads the page") must return the saved text for
 * BOTH control_text and rationale, with a matching edit-history row.
 */
const ACTOR = "drafter-persist-test@example.com";

let praId: string;
let sectionId: string;
const enhancementIds: string[] = [];

beforeAll(async () => {
  const templateRows = await query<{ id: string }>(`INSERT INTO drafter_templates (name) VALUES ('Persist test template') RETURNING id`);
  const templateVersionRows = await query<{ id: string }>(
    `INSERT INTO drafter_template_versions (template_id, version, sections, field_labels, confirmed, created_by)
     VALUES ($1,1,$2,$3,true,$4) RETURNING id`,
    [
      templateRows[0].id,
      JSON.stringify([{ number: "2.1", title: "Customer Due Diligence", lifecycleStage: "Onboarding", customerType: "legal_person", standardWording: null, emptySectionWording: null, backofficeControlMap: "CDD" }]),
      JSON.stringify({ control_enhancement: "Control enhancement", control_enhancement_rationale: "Control enhancement rationale", backoffice_control_impacted: "Backoffice control impacted", evidence_of_delivery: "Evidence of delivery" }),
      ACTOR,
    ]
  );
  const stylepackRows = await query<{ id: string }>(`INSERT INTO drafter_stylepacks (name) VALUES ('Persist test style') RETURNING id`);
  const stylepackVersionRows = await query<{ id: string }>(
    `INSERT INTO drafter_stylepack_versions (stylepack_id, version, rules, banned_phrases, tense_rule, length_limits, created_by)
     VALUES ($1,1,'[]','[]','present tense','{"min_words":0,"max_words":500}',$2) RETURNING id`,
    [stylepackRows[0].id, ACTOR]
  );
  const praRows = await query<{ id: string }>(
    `INSERT INTO drafter_pras (product, description, customer_types, template_version_id, stylepack_version_id, cost_cap_pence, created_by)
     VALUES ('Persist test product','A test product.','{legal_person}',$1,$2,2000,$3) RETURNING id`,
    [templateVersionRows[0].id, stylepackVersionRows[0].id, ACTOR]
  );
  praId = praRows[0].id;
  const sectionRows = await query<{ id: string }>(
    `INSERT INTO drafter_sections (pra_id, section_number, title, customer_type, sort_order, is_empty) VALUES ($1,'2.1','Customer Due Diligence','legal_person',0,false) RETURNING id`,
    [praId]
  );
  sectionId = sectionRows[0].id;
});

afterAll(async () => {
  await query(`DELETE FROM drafter_enhancement_edits WHERE enhancement_id = ANY($1::uuid[])`, [enhancementIds]);
  await query(`DELETE FROM drafter_enhancements WHERE pra_id = $1`, [praId]);
  await query(`DELETE FROM drafter_sections WHERE pra_id = $1`, [praId]);
  await query(`DELETE FROM drafter_pras WHERE id = $1`, [praId]);
});

async function makeEnhancement(controlText: string, rationale: string): Promise<string> {
  const rows = await query<{ id: string }>(
    `INSERT INTO drafter_enhancements (section_id, pra_id, sort_order, control_ids, control_text, rationale, review_result, is_gap)
     VALUES ($1,$2,0,'{}',$3,$4,'{"lint":[],"status":"not_reviewed"}',false) RETURNING id`,
    [sectionId, praId, controlText, rationale]
  );
  enhancementIds.push(rows[0].id);
  return rows[0].id;
}

describe("saveEnhancementEdit (persistence for manual edits and Apply fix)", () => {
  it("persists an apply_fix rationale change, and a fresh read (a simulated page reload) sees it", async () => {
    const id = await makeEnhancement("Original control text.", "A policy exists for this. It never says how.");
    const before = await getEnhancement(id);

    const newRationale = "The reviewer checks each case before approval. It never says how.";
    await saveEnhancementEdit({
      enhancementId: id,
      edits: [{ field: "rationale", previousValue: before!.rationale, newValue: newRationale, editType: "apply_fix", actor: ACTOR }],
      draft: { controlText: before!.control_text ?? undefined, rationale: newRationale, reviewResult: { lint: [], status: "not_reviewed" } },
    });

    // Simulate the user hitting a hard reload: a completely fresh read from
    // the DB, not anything cached in the process that wrote it.
    const reread = await getEnhancement(id);
    expect(reread?.rationale).toBe(newRationale);
    expect(reread?.control_text).toBe("Original control text.");

    const edits = await query<{ field: string; edit_type: string; new_value: string }>(
      `SELECT field, edit_type, new_value FROM drafter_enhancement_edits WHERE enhancement_id = $1 ORDER BY created_at`,
      [id]
    );
    expect(edits).toHaveLength(1);
    expect(edits[0]).toMatchObject({ field: "rationale", edit_type: "apply_fix", new_value: newRationale });
  });

  it("persists both control_text and rationale together, with one edit-history row per changed field", async () => {
    const id = await makeEnhancement("Old control text.", "Old rationale.");
    await saveEnhancementEdit({
      enhancementId: id,
      edits: [
        { field: "control_text", previousValue: "Old control text.", newValue: "New control text.", editType: "manual", actor: ACTOR },
        { field: "rationale", previousValue: "Old rationale.", newValue: "New rationale.", editType: "manual", actor: ACTOR },
      ],
      draft: { controlText: "New control text.", rationale: "New rationale.", reviewResult: { lint: [], status: "not_reviewed" } },
    });

    const reread = await getEnhancement(id);
    expect(reread?.control_text).toBe("New control text.");
    expect(reread?.rationale).toBe("New rationale.");

    const edits = await query<{ field: string }>(`SELECT field FROM drafter_enhancement_edits WHERE enhancement_id = $1 ORDER BY field`, [id]);
    expect(edits.map((e) => e.field)).toEqual(["control_text", "rationale"]);
  });

  it("is atomic: a failed write inside the transaction leaves neither the edit history nor the text change committed", async () => {
    const id = await makeEnhancement("Untouched control text.", "Untouched rationale.");
    await expect(
      saveEnhancementEdit({
        enhancementId: id,
        edits: [{ field: "control_text", previousValue: "Untouched control text.", newValue: "Should not persist.", editType: "manual", actor: ACTOR }],
        // An invalid UUID enhancementId in a second, deliberately-broken
        // write inside the same transaction would be one way to force a
        // failure; simpler and just as valid here: a bad field value
        // violating the CHECK constraint on drafter_enhancement_edits.
        draft: { controlText: "Should not persist.", reviewResult: { lint: [], status: "not_reviewed" } },
      })
    ).resolves.toBeDefined(); // sanity: the well-formed call above still succeeds

    // Now prove atomicity with a genuinely invalid edit (bad field value).
    const id2 = await makeEnhancement("Untouched control text 2.", "Untouched rationale 2.");
    await expect(
      saveEnhancementEdit({
        enhancementId: id2,
        edits: [{ field: "not_a_real_field" as unknown as "control_text", previousValue: "Untouched control text 2.", newValue: "Should not persist either.", editType: "manual", actor: ACTOR }],
        draft: { controlText: "Should not persist either.", reviewResult: { lint: [], status: "not_reviewed" } },
      })
    ).rejects.toThrow();

    const reread2 = await getEnhancement(id2);
    expect(reread2?.control_text).toBe("Untouched control text 2.");
    const edits2 = await query(`SELECT 1 FROM drafter_enhancement_edits WHERE enhancement_id = $1`, [id2]);
    expect(edits2).toHaveLength(0);
  });
});

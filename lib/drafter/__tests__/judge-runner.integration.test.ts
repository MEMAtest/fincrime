import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import { query } from "@/lib/db";
import { judgeOneEnhancement, judgeText } from "../judge-runner";
import { checkExportReadiness } from "../pra-status";

/**
 * End-to-end test of the judge pipeline (prompt -> stub model -> output
 * validation -> combined status -> persistence), against real DB rows, the
 * same pattern as draft-enhancement.integration.test.ts. Exercises every
 * fixture kind in test/fixtures/drafter/writer-stub.json's "judge" key:
 * pass, minor-only fail, critical fail, quote-not-in-text, unknown
 * criterion, malformed JSON.
 */

const STUB_FILE = path.join(process.cwd(), "test/fixtures/drafter/writer-stub.json");
const ACTOR = "drafter-judge-test@example.com";

let praId: string;
let sectionId: string;
const enhancementIds: string[] = [];

async function makeEnhancement(controlText: string, rationale: string): Promise<string> {
  const rows = await query<{ id: string }>(
    `INSERT INTO drafter_enhancements (section_id, pra_id, sort_order, control_ids, control_text, rationale, review_result, is_gap)
     VALUES ($1,$2,0,'{}',$3,$4,'{"lint":[],"status":"not_reviewed"}',false) RETURNING id`,
    [sectionId, praId, controlText, rationale]
  );
  enhancementIds.push(rows[0].id);
  return rows[0].id;
}

beforeAll(async () => {
  process.env.PRA_MODEL_STUB = "1";
  process.env.PRA_MODEL_STUB_FILE = STUB_FILE;
  delete process.env.VERCEL_ENV;

  const templateRows = await query<{ id: string }>(`INSERT INTO drafter_templates (name) VALUES ('Judge test template') RETURNING id`);
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
  const stylepackRows = await query<{ id: string }>(`INSERT INTO drafter_stylepacks (name) VALUES ('Judge test style') RETURNING id`);
  const stylepackVersionRows = await query<{ id: string }>(
    `INSERT INTO drafter_stylepack_versions (stylepack_id, version, rules, banned_phrases, tense_rule, length_limits, created_by)
     VALUES ($1,1,'[]','[]','present tense','{"min_words":0,"max_words":500}',$2) RETURNING id`,
    [stylepackRows[0].id, ACTOR]
  );
  const praRows = await query<{ id: string }>(
    `INSERT INTO drafter_pras (product, description, customer_types, template_version_id, stylepack_version_id, cost_cap_pence, created_by)
     VALUES ('Judge test product','A test product.','{legal_person}',$1,$2,2000,$3) RETURNING id`,
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
  await query(`DELETE FROM drafter_open_items WHERE pra_id = $1`, [praId]);
  await query(`DELETE FROM drafter_model_calls WHERE pra_id = $1`, [praId]);
  await query(`DELETE FROM drafter_enhancements WHERE pra_id = $1`, [praId]);
  await query(`DELETE FROM drafter_sections WHERE pra_id = $1`, [praId]);
  await query(`DELETE FROM drafter_pras WHERE id = $1`, [praId]);
  delete process.env.PRA_MODEL_STUB;
  delete process.env.PRA_MODEL_STUB_FILE;
});

describe("judgeOneEnhancement (real DB + stub judge fixtures)", () => {
  it("records a clean overall pass when every criterion passes", async () => {
    const id = await makeEnhancement(
      "The reviewer screens JUDGE-PASS every new relationship before onboarding and records the outcome.",
      "This addresses the onboarding risk because it catches issues before exposure begins."
    );
    const result = await judgeOneEnhancement(id, ACTOR);
    expect(result.ok).toBe(true);
    expect(result.enhancement?.review_result?.status).toBe("pass");
  });

  it("records a minor status when only a non-critical criterion fails", async () => {
    const id = await makeEnhancement(
      "The reviewer screens JUDGE-MINOR every new relationship before onboarding and records the outcome, though the tone here is a bit dramatic.",
      "This addresses the onboarding risk because it catches issues before exposure begins."
    );
    const result = await judgeOneEnhancement(id, ACTOR);
    expect(result.ok).toBe(true);
    expect(result.enhancement?.review_result?.status).toBe("minor");
  });

  it("records a critical status when a critical criterion fails", async () => {
    const id = await makeEnhancement("A policy exists for JUDGE-CRITICAL relationships and nothing else is described here.", "This is required because the register said so.");
    const result = await judgeOneEnhancement(id, ACTOR);
    expect(result.ok).toBe(true);
    expect(result.enhancement?.review_result?.status).toBe("critical");
  });

  it("never records a pass when a quote is not found verbatim in the text - the review stays not_reviewed with an error", async () => {
    const id = await makeEnhancement("JUDGE-QUOTE-NOT-FOUND control text here.", "Rationale text.");
    const result = await judgeOneEnhancement(id, ACTOR);
    expect(result.ok).toBe(false);
    expect(result.enhancement?.review_result?.status).not.toBe("pass");
  });

  it("never records a pass when the judge returns an unknown criterion", async () => {
    const id = await makeEnhancement("JUDGE-UNKNOWN-CRITERION control text here.", "Rationale text.");
    const result = await judgeOneEnhancement(id, ACTOR);
    expect(result.ok).toBe(false);
    expect(result.enhancement?.review_result?.status).not.toBe("pass");
  });

  it("never records a pass on malformed judge JSON", async () => {
    const id = await makeEnhancement("JUDGE-MALFORMED control text here.", "Rationale text.");
    const result = await judgeOneEnhancement(id, ACTOR);
    expect(result.ok).toBe(false);
    expect(result.enhancement?.review_result?.status).not.toBe("pass");
  });

  it("SAFETY: sanitises an invented number/frequency and flags an invented role in a judge's suggested_rewrite, and never applies the model's raw rewrite - neither 'every 12 months' nor 'MLRO' is in this enhancement's inputs", async () => {
    const id = await makeEnhancement(
      "The reviewer screens JUDGE-INVENTED-REWRITE relationships and records the outcome.",
      "This addresses the risk of an unreviewed relationship."
    );
    const result = await judgeOneEnhancement(id, ACTOR);
    expect(result.ok).toBe(true);
    const judge = result.enhancement?.review_result?.judge as
      | { criteria: Record<string, { suggestedRewrite: string | null; rewriteAdjusted?: boolean; rewriteFlags?: string[] }> }
      | undefined;
    const criterion = judge?.criteria.mechanism_not_policy_restatement;
    expect(criterion?.suggestedRewrite).not.toContain("every 12 months");
    expect(criterion?.suggestedRewrite).toContain("[unsupported figure - verify]");
    expect(criterion?.rewriteAdjusted).toBe(true);
    expect(criterion?.rewriteFlags).toContain("MLRO");

    const openItems = await query<{ description: string }>(`SELECT description FROM drafter_open_items WHERE enhancement_id = $1`, [id]);
    expect(openItems.some((i) => i.description.includes("every 12 months"))).toBe(true);
    expect(openItems.some((i) => i.description.includes("MLRO"))).toBe(true);
  });

  it("SHARED JUDGE PATH: judgeText (used by calibration) gives the same verdict as judgeOneEnhancement (production) for the same text, style rules and stub fixture - calibration measures the SAME judge, not a hand-rolled approximation", async () => {
    const controlText = "The reviewer screens JUDGE-PASS every new relationship before onboarding and records the outcome.";
    const rationale = "This addresses the onboarding risk because it catches issues before exposure begins.";

    const id = await makeEnhancement(controlText, rationale);
    const viaProduction = await judgeOneEnhancement(id, ACTOR);
    expect(viaProduction.ok).toBe(true);
    expect(viaProduction.enhancement?.review_result?.status).toBe("pass");

    const viaShared = await judgeText({ controlText, rationale, sectionTitle: "2.1 Customer Due Diligence", styleRules: [] });
    expect(viaShared.ok).toBe(true);
    if (viaShared.ok) expect(viaShared.overall).toBe("pass");
  });

  it("SHARED JUDGE PATH: judgeText also gets the one repair round and verbatim-quote validation, never a free pass on a malformed response - same as production", async () => {
    const result = await judgeText({ controlText: "JUDGE-MALFORMED control text here.", rationale: "Rationale text.", sectionTitle: "2.1 Customer Due Diligence", styleRules: [] });
    expect(result.ok).toBe(false);
  });

  it("checkExportReadiness blocks on a critical or not_reviewed enhancement, and clears once every enhancement passes", async () => {
    const before = await checkExportReadiness(praId);
    expect(before.ready).toBe(false); // several enhancements above are critical/not_reviewed

    // Judge one clean-pass enhancement and remove the earlier ones (and
    // their model call log rows, which FK-reference them) so this PRA's
    // export readiness reflects only the clean one.
    const onlyGoodId = await makeEnhancement(
      "The reviewer screens JUDGE-PASS every new relationship before onboarding and records the outcome.",
      "This addresses the onboarding risk because it catches issues before exposure begins."
    );
    const otherIds = enhancementIds.filter((id) => id !== onlyGoodId);
    await query(`DELETE FROM drafter_open_items WHERE enhancement_id = ANY($1::uuid[])`, [otherIds]);
    await query(`DELETE FROM drafter_model_calls WHERE enhancement_id = ANY($1::uuid[])`, [otherIds]);
    await query(`DELETE FROM drafter_enhancements WHERE id = ANY($1::uuid[])`, [otherIds]);
    await judgeOneEnhancement(onlyGoodId, ACTOR);
    const after = await checkExportReadiness(praId);
    expect(after.ready).toBe(true);
  });
});

import { it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import { query } from "@/lib/db";
import { judgeOneEnhancement } from "../judge-runner";
import { lintEnhancement } from "../lint";
import { combineStatus } from "../review-status";
import { getEnhancement, updateEnhancementDraft } from "@/lib/repo/drafter-pras";

/**
 * Exercises the exact sequence the PATCH route
 * (app/api/drafter/pras/[id]/enhancements/[enhId]/route.ts) runs on a
 * manual edit: re-lint immediately, and mark any existing judge result
 * STALE rather than dropping it (SPEC.md "Page viewer and editing":
 * "Saving re-runs lint immediately, marks the judge result stale, judge
 * re-run on request").
 */

const STUB_FILE = path.join(process.cwd(), "test/fixtures/drafter/writer-stub.json");
const ACTOR = "drafter-stale-test@example.com";

let praId: string;
let sectionId: string;
let enhancementId: string;

beforeAll(async () => {
  process.env.PRA_MODEL_STUB = "1";
  process.env.PRA_MODEL_STUB_FILE = STUB_FILE;
  delete process.env.VERCEL_ENV;

  const templateRows = await query<{ id: string }>(`INSERT INTO drafter_templates (name) VALUES ('Stale test template') RETURNING id`);
  const templateVersionRows = await query<{ id: string }>(
    `INSERT INTO drafter_template_versions (template_id, version, sections, field_labels, confirmed, created_by)
     VALUES ($1,1,'[]','{"control_enhancement":"x","control_enhancement_rationale":"y","backoffice_control_impacted":"z","evidence_of_delivery":"w"}',true,$2) RETURNING id`,
    [templateRows[0].id, ACTOR]
  );
  const stylepackRows = await query<{ id: string }>(`INSERT INTO drafter_stylepacks (name) VALUES ('Stale test style') RETURNING id`);
  const stylepackVersionRows = await query<{ id: string }>(
    `INSERT INTO drafter_stylepack_versions (stylepack_id, version, rules, banned_phrases, tense_rule, length_limits, created_by)
     VALUES ($1,1,'[]','[]','present tense','{"min_words":0,"max_words":500}',$2) RETURNING id`,
    [stylepackRows[0].id, ACTOR]
  );
  const praRows = await query<{ id: string }>(
    `INSERT INTO drafter_pras (product, description, customer_types, template_version_id, stylepack_version_id, cost_cap_pence, created_by)
     VALUES ('Stale test product','A test product.','{legal_person}',$1,$2,2000,$3) RETURNING id`,
    [templateVersionRows[0].id, stylepackVersionRows[0].id, ACTOR]
  );
  praId = praRows[0].id;
  const sectionRows = await query<{ id: string }>(
    `INSERT INTO drafter_sections (pra_id, section_number, title, customer_type, sort_order, is_empty) VALUES ($1,'2.1','Customer Due Diligence','legal_person',0,false) RETURNING id`,
    [praId]
  );
  sectionId = sectionRows[0].id;
  const enhRows = await query<{ id: string }>(
    `INSERT INTO drafter_enhancements (section_id, pra_id, sort_order, control_ids, control_text, rationale, review_result, is_gap)
     VALUES ($1,$2,0,'{}',$3,$4,'{"lint":[],"status":"not_reviewed"}',false) RETURNING id`,
    [
      sectionId,
      praId,
      "The reviewer screens JUDGE-PASS every new relationship before onboarding and records the outcome.",
      "This addresses the onboarding risk because it catches issues before exposure begins.",
    ]
  );
  enhancementId = enhRows[0].id;
});

afterAll(async () => {
  await query(`DELETE FROM drafter_model_calls WHERE pra_id = $1`, [praId]);
  await query(`DELETE FROM drafter_enhancements WHERE pra_id = $1`, [praId]);
  await query(`DELETE FROM drafter_sections WHERE pra_id = $1`, [praId]);
  await query(`DELETE FROM drafter_pras WHERE id = $1`, [praId]);
  delete process.env.PRA_MODEL_STUB;
  delete process.env.PRA_MODEL_STUB_FILE;
});

it("marks a judge result stale (not a pass) after a manual edit, exactly as the PATCH route does", async () => {
  const judged = await judgeOneEnhancement(enhancementId, ACTOR);
  expect(judged.ok).toBe(true);
  expect(judged.enhancement?.review_result?.status).toBe("pass");

  // Replicate the PATCH route's manual-edit sequence.
  const enhancement = await getEnhancement(enhancementId);
  const nextControlText = "The reviewer screens JUDGE-PASS every new relationship before onboarding and records the outcome, now edited.";
  const lintIssues = lintEnhancement({ controlText: nextControlText, rationale: enhancement!.rationale ?? "" });
  const existingJudge = enhancement!.review_result?.judge ?? null;
  const judgeStale = Boolean(existingJudge);
  const status = combineStatus({ lintIssues, judge: existingJudge as never, judgeStale });
  const updated = await updateEnhancementDraft(enhancementId, {
    controlText: nextControlText,
    reviewResult: { lint: lintIssues, judge: existingJudge, judgeStale, status },
  });

  expect(judgeStale).toBe(true);
  expect(updated.review_result?.status).not.toBe("pass");
  expect(updated.review_result?.status).toBe("not_reviewed");
  // The previous judge output is kept for reference, not discarded.
  expect(updated.review_result?.judge).not.toBeNull();
});

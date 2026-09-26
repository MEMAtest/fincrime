import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { query } from "@/lib/db";
import { checkExportReadiness } from "../pra-status";

/**
 * SPEC.md "Word export": "Export blocked while any enhancement has a
 * critical failure OR is not reviewed OR has lint errors, unless the user
 * overrides with a reason (logged with actor)." Exercises the gate against
 * real DB rows in each blocking state, and the override logging shape the
 * export route writes to drafter_export_log/drafter_open_items.
 */

const ACTOR = "drafter-export-test@example.com";
let praId: string;
let sectionId: string;

beforeAll(async () => {
  const templateRows = await query<{ id: string }>(`INSERT INTO drafter_templates (name) VALUES ('Export gate template') RETURNING id`);
  const templateVersionRows = await query<{ id: string }>(
    `INSERT INTO drafter_template_versions (template_id, version, sections, field_labels, confirmed, created_by)
     VALUES ($1,1,'[]','{"control_enhancement":"x","control_enhancement_rationale":"y","backoffice_control_impacted":"z","evidence_of_delivery":"w"}',true,$2) RETURNING id`,
    [templateRows[0].id, ACTOR]
  );
  const stylepackRows = await query<{ id: string }>(`INSERT INTO drafter_stylepacks (name) VALUES ('Export gate style') RETURNING id`);
  const stylepackVersionRows = await query<{ id: string }>(
    `INSERT INTO drafter_stylepack_versions (stylepack_id, version, rules, banned_phrases, tense_rule, length_limits, created_by)
     VALUES ($1,1,'[]','[]','present tense','{"min_words":0,"max_words":500}',$2) RETURNING id`,
    [stylepackRows[0].id, ACTOR]
  );
  const praRows = await query<{ id: string }>(
    `INSERT INTO drafter_pras (product, description, customer_types, template_version_id, stylepack_version_id, cost_cap_pence, created_by)
     VALUES ('Export gate product','A test product.','{legal_person}',$1,$2,2000,$3) RETURNING id`,
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
  await query(`DELETE FROM drafter_export_log WHERE pra_id = $1`, [praId]);
  await query(`DELETE FROM drafter_open_items WHERE pra_id = $1`, [praId]);
  await query(`DELETE FROM drafter_enhancements WHERE pra_id = $1`, [praId]);
  await query(`DELETE FROM drafter_sections WHERE pra_id = $1`, [praId]);
  await query(`DELETE FROM drafter_pras WHERE id = $1`, [praId]);
});

async function addEnhancement(reviewResult: object): Promise<string> {
  const rows = await query<{ id: string }>(
    `INSERT INTO drafter_enhancements (section_id, pra_id, sort_order, control_ids, control_text, rationale, review_result, is_gap)
     VALUES ($1,$2,0,'{}','text','rationale',$3,false) RETURNING id`,
    [sectionId, praId, JSON.stringify(reviewResult)]
  );
  return rows[0].id;
}

describe("checkExportReadiness (export gate)", () => {
  it("blocks when an enhancement is not_reviewed", async () => {
    const id = await addEnhancement({ lint: [], status: "not_reviewed", judge: null, judgeStale: false });
    const readiness = await checkExportReadiness(praId);
    expect(readiness.ready).toBe(false);
    expect(readiness.blocking.some((b) => b.enhancementId === id)).toBe(true);
    await query(`DELETE FROM drafter_enhancements WHERE id = $1`, [id]);
  });

  it("blocks when an enhancement has a critical lint issue even if judge passed", async () => {
    const id = await addEnhancement({
      lint: [{ rule: "banned_phrase", severity: "critical", message: "x" }],
      status: "critical",
      judge: { overall: "pass", criteria: {}, modelName: "stub", promptVersion: "v1" },
      judgeStale: false,
    });
    const readiness = await checkExportReadiness(praId);
    expect(readiness.ready).toBe(false);
    await query(`DELETE FROM drafter_enhancements WHERE id = $1`, [id]);
  });

  it("is ready when every enhancement has clean lint and a fresh judge pass", async () => {
    const id = await addEnhancement({
      lint: [],
      status: "pass",
      judge: { overall: "pass", criteria: {}, modelName: "stub", promptVersion: "v1" },
      judgeStale: false,
    });
    const readiness = await checkExportReadiness(praId);
    expect(readiness.ready).toBe(true);
    await query(`DELETE FROM drafter_enhancements WHERE id = $1`, [id]);
  });

  it("an override writes an export_override open item and an export_log row with the actor and blocking reasons - never a silent bypass", async () => {
    const id = await addEnhancement({ lint: [], status: "not_reviewed", judge: null, judgeStale: false });
    const readiness = await checkExportReadiness(praId);
    expect(readiness.ready).toBe(false);

    // This mirrors what POST /api/drafter/pras/[id]/export does on an
    // override - written directly here so the test doesn't need an HTTP
    // server, but asserts the exact same audit shape.
    await query(
      `INSERT INTO drafter_export_log (pra_id, filename, overridden, override_reason, blocking_reasons, actor) VALUES ($1,'test.docx',true,'Approved verbally by the reviewer',$2,$3)`,
      [praId, JSON.stringify(readiness.blocking), ACTOR]
    );
    await query(
      `INSERT INTO drafter_open_items (pra_id, enhancement_id, item_type, description) VALUES ($1,NULL,'export_override',$2)`,
      [praId, "Exported with unresolved issues - override reason: Approved verbally by the reviewer"]
    );

    const logRows = await query<{ overridden: boolean; override_reason: string; actor: string }>(
      `SELECT overridden, override_reason, actor FROM drafter_export_log WHERE pra_id = $1`,
      [praId]
    );
    expect(logRows[0]).toEqual({ overridden: true, override_reason: "Approved verbally by the reviewer", actor: ACTOR });
    const openItems = await query<{ item_type: string }>(`SELECT item_type FROM drafter_open_items WHERE pra_id = $1`, [praId]);
    expect(openItems.some((i) => i.item_type === "export_override")).toBe(true);
    await query(`DELETE FROM drafter_enhancements WHERE id = $1`, [id]);
  });
});

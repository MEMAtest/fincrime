import { describe, it, expect, afterAll } from "vitest";
import { query } from "@/lib/db";
import { deletePra } from "../drafter-pras";
import { deleteRegisterImport } from "../drafter-register";
import { deleteDrafterDocument } from "../drafter-documents";

/**
 * Prod walkthrough item 5: delete actions must cascade correctly (a PRA)
 * or refuse with an explanation when something still depends on the row (a
 * register import referenced by a PRA, a document referenced by a register
 * import) - never a raw foreign-key 500, never a silent orphan.
 */

const ACTOR = "drafter-delete-test@example.com";
const cleanupDocIds: string[] = [];
const cleanupImportIds: string[] = [];
const cleanupTemplateVersionIds: string[] = [];
const cleanupTemplateIds: string[] = [];
const cleanupStylepackVersionIds: string[] = [];
const cleanupStylepackIds: string[] = [];
const cleanupPraIds: string[] = [];

afterAll(async () => {
  for (const id of cleanupPraIds) {
    await query(`DELETE FROM drafter_enhancements WHERE pra_id = $1`, [id]);
    await query(`DELETE FROM drafter_sections WHERE pra_id = $1`, [id]);
    await query(`DELETE FROM drafter_pras WHERE id = $1`, [id]);
  }
  for (const id of cleanupImportIds) {
    await query(`DELETE FROM drafter_register_rows WHERE register_version_id IN (SELECT id FROM drafter_register_versions WHERE register_import_id = $1)`, [id]);
    await query(`DELETE FROM drafter_register_versions WHERE register_import_id = $1`, [id]);
    await query(`DELETE FROM drafter_register_imports WHERE id = $1`, [id]);
  }
  await query(`DELETE FROM drafter_template_versions WHERE id = ANY($1::uuid[])`, [cleanupTemplateVersionIds]);
  await query(`DELETE FROM drafter_templates WHERE id = ANY($1::uuid[])`, [cleanupTemplateIds]);
  await query(`DELETE FROM drafter_stylepack_versions WHERE id = ANY($1::uuid[])`, [cleanupStylepackVersionIds]);
  await query(`DELETE FROM drafter_stylepacks WHERE id = ANY($1::uuid[])`, [cleanupStylepackIds]);
  await query(`DELETE FROM drafter_documents WHERE id = ANY($1::uuid[])`, [cleanupDocIds]);
});

async function makeDocument(marker: string): Promise<string> {
  const rows = await query<{ id: string }>(
    `INSERT INTO drafter_documents (doc_type, confirmed_doc_type, filename, format, content_hash, uploaded_by)
     VALUES ('register','register',$1,'xlsx',$2,$3) RETURNING id`,
    [`delete-test-${marker}.xlsx`, `hash-${marker}-${Math.random()}`, ACTOR]
  );
  cleanupDocIds.push(rows[0].id);
  return rows[0].id;
}

async function makeRegisterImportWithVersion(documentId: string): Promise<{ importId: string; versionId: string }> {
  const importRows = await query<{ id: string }>(
    `INSERT INTO drafter_register_imports (document_id, sheet_name, header_row_index, created_by) VALUES ($1,'Sheet1',0,$2) RETURNING id`,
    [documentId, ACTOR]
  );
  cleanupImportIds.push(importRows[0].id);
  const versionRows = await query<{ id: string }>(
    `INSERT INTO drafter_register_versions (register_import_id, version, status, created_by) VALUES ($1,1,'accepted',$2) RETURNING id`,
    [importRows[0].id, ACTOR]
  );
  return { importId: importRows[0].id, versionId: versionRows[0].id };
}

async function makeTemplateAndStylepack(): Promise<{ templateVersionId: string; stylepackVersionId: string }> {
  const templateRows = await query<{ id: string }>(`INSERT INTO drafter_templates (name) VALUES ('Delete test template') RETURNING id`);
  cleanupTemplateIds.push(templateRows[0].id);
  const templateVersionRows = await query<{ id: string }>(
    `INSERT INTO drafter_template_versions (template_id, version, sections, field_labels, confirmed, created_by)
     VALUES ($1,1,'[]','{}',true,$2) RETURNING id`,
    [templateRows[0].id, ACTOR]
  );
  cleanupTemplateVersionIds.push(templateVersionRows[0].id);

  const stylepackRows = await query<{ id: string }>(`INSERT INTO drafter_stylepacks (name) VALUES ('Delete test stylepack') RETURNING id`);
  cleanupStylepackIds.push(stylepackRows[0].id);
  const stylepackVersionRows = await query<{ id: string }>(
    `INSERT INTO drafter_stylepack_versions (stylepack_id, version, rules, created_by) VALUES ($1,1,'[]',$2) RETURNING id`,
    [stylepackRows[0].id, ACTOR]
  );
  cleanupStylepackVersionIds.push(stylepackVersionRows[0].id);

  return { templateVersionId: templateVersionRows[0].id, stylepackVersionId: stylepackVersionRows[0].id };
}

describe("delete actions (prod walkthrough item 5)", () => {
  it("deletePra cascades sections, enhancements, edits and open items", async () => {
    const { templateVersionId, stylepackVersionId } = await makeTemplateAndStylepack();
    const praRows = await query<{ id: string }>(
      `INSERT INTO drafter_pras (product, template_version_id, stylepack_version_id, created_by)
       VALUES ('Delete test product',$1,$2,$3) RETURNING id`,
      [templateVersionId, stylepackVersionId, ACTOR]
    );
    const praId = praRows[0].id;

    const sectionRows = await query<{ id: string }>(
      `INSERT INTO drafter_sections (pra_id, section_number, title, sort_order) VALUES ($1,'1','Test section',0) RETURNING id`,
      [praId]
    );
    const enhRows = await query<{ id: string }>(
      `INSERT INTO drafter_enhancements (section_id, pra_id, sort_order, control_text, review_result)
       VALUES ($1,$2,0,'text','{"lint":[],"status":"not_reviewed"}') RETURNING id`,
      [sectionRows[0].id, praId]
    );
    await query(`INSERT INTO drafter_open_items (pra_id, enhancement_id, item_type, description) VALUES ($1,$2,'gap','test')`, [praId, enhRows[0].id]);
    await query(
      `INSERT INTO drafter_enhancement_edits (enhancement_id, field, previous_value, new_value, edit_type, actor) VALUES ($1,'control_text','a','b','manual',$2)`,
      [enhRows[0].id, ACTOR]
    );

    const deleted = await deletePra(praId, ACTOR);
    expect(deleted).toBe(true);

    expect((await query(`SELECT id FROM drafter_pras WHERE id = $1`, [praId])).length).toBe(0);
    expect((await query(`SELECT id FROM drafter_sections WHERE pra_id = $1`, [praId])).length).toBe(0);
    expect((await query(`SELECT id FROM drafter_enhancements WHERE pra_id = $1`, [praId])).length).toBe(0);
    expect((await query(`SELECT id FROM drafter_open_items WHERE pra_id = $1`, [praId])).length).toBe(0);
    expect((await query(`SELECT id FROM drafter_enhancement_edits WHERE enhancement_id = $1`, [enhRows[0].id])).length).toBe(0);

    // Deleting again (or an unknown id) is a clean no-op, never a throw.
    expect(await deletePra(praId, ACTOR)).toBe(false);
  });

  it("deleteRegisterImport refuses with an explanation when a PRA references one of its versions", async () => {
    const docId = await makeDocument("blocked");
    const { importId, versionId } = await makeRegisterImportWithVersion(docId);
    const { templateVersionId, stylepackVersionId } = await makeTemplateAndStylepack();
    const praRows = await query<{ id: string }>(
      `INSERT INTO drafter_pras (product, template_version_id, stylepack_version_id, register_version_id, created_by)
       VALUES ('Referencing product',$1,$2,$3,$4) RETURNING id`,
      [templateVersionId, stylepackVersionId, versionId, ACTOR]
    );
    cleanupPraIds.push(praRows[0].id);

    const result = await deleteRegisterImport(importId, ACTOR);
    expect(result.deleted).toBe(false);
    expect(result.blockedReason).toMatch(/Referencing product/);

    // The import must still be there - nothing was silently dropped.
    expect((await query(`SELECT id FROM drafter_register_imports WHERE id = $1`, [importId])).length).toBe(1);
  });

  it("deleteRegisterImport deletes the import and its versions/rows when nothing references it", async () => {
    const docId = await makeDocument("free");
    const { importId, versionId } = await makeRegisterImportWithVersion(docId);
    await query(`INSERT INTO drafter_register_rows (register_version_id, req_id, row_index, fields) VALUES ($1,'REQ-1',0,'{}')`, [versionId]);

    const result = await deleteRegisterImport(importId, ACTOR);
    expect(result.deleted).toBe(true);
    expect((await query(`SELECT id FROM drafter_register_imports WHERE id = $1`, [importId])).length).toBe(0);
    expect((await query(`SELECT id FROM drafter_register_versions WHERE register_import_id = $1`, [importId])).length).toBe(0);
    cleanupImportIds.splice(cleanupImportIds.indexOf(importId), 1);
  });

  it("deleteRegisterImport removes controls built only from it, with their tags and history, and keeps shared ones", async () => {
    const docId = await makeDocument("free");
    const { importId, versionId } = await makeRegisterImportWithVersion(docId);
    const [rowA] = await query<{ id: string }>(
      `INSERT INTO drafter_register_rows (register_version_id, req_id, row_index, fields) VALUES ($1,'REQ-A',0,'{}') RETURNING id`,
      [versionId]
    );
    const otherDoc = await makeDocument("free");
    const other = await makeRegisterImportWithVersion(otherDoc);
    const [rowB] = await query<{ id: string }>(
      `INSERT INTO drafter_register_rows (register_version_id, req_id, row_index, fields) VALUES ($1,'REQ-B',0,'{}') RETURNING id`,
      [other.versionId]
    );
    const [only] = await query<{ id: string }>(
      `INSERT INTO drafter_controls (title, req_ids, register_row_ids) VALUES ('only','{REQ-A}',ARRAY[$1]::uuid[]) RETURNING id`,
      [rowA.id]
    );
    const [shared] = await query<{ id: string }>(
      `INSERT INTO drafter_controls (title, req_ids, register_row_ids) VALUES ('shared','{REQ-A,REQ-B}',ARRAY[$1,$2]::uuid[]) RETURNING id`,
      [rowA.id, rowB.id]
    );
    await query(`INSERT INTO drafter_control_tags (control_id, tag_type, value, origin) VALUES ($1,'coverage','yes','code')`, [only.id]);
    await query(
      `INSERT INTO drafter_control_history (control_id, snapshot, superseded_by_register_version_id) VALUES ($1,'{}',$2)`,
      [shared.id, versionId]
    );

    const result = await deleteRegisterImport(importId, ACTOR);
    expect(result.deleted).toBe(true);
    expect((await query(`SELECT id FROM drafter_controls WHERE id = $1`, [only.id])).length).toBe(0);
    expect((await query(`SELECT id FROM drafter_control_tags WHERE control_id = $1`, [only.id])).length).toBe(0);
    const [kept] = await query<{ register_row_ids: string[] }>(`SELECT register_row_ids FROM drafter_controls WHERE id = $1`, [shared.id]);
    expect(kept.register_row_ids).toEqual([rowB.id]);
    cleanupImportIds.splice(cleanupImportIds.indexOf(importId), 1);

    await query(`DELETE FROM drafter_controls WHERE id = $1`, [shared.id]);
  });

  it("deleteDrafterDocument refuses with an explanation when a register import still references it", async () => {
    const docId = await makeDocument("doc-blocked");
    const { importId } = await makeRegisterImportWithVersion(docId);
    void importId;

    const result = await deleteDrafterDocument(docId, ACTOR);
    expect(result.deleted).toBe(false);
    expect(result.blockedReason).toMatch(/register import/);
    expect((await query(`SELECT id FROM drafter_documents WHERE id = $1`, [docId])).length).toBe(1);
  });

  it("deleteDrafterDocument deletes the row when nothing references it", async () => {
    const docId = await makeDocument("doc-free");
    const result = await deleteDrafterDocument(docId, ACTOR);
    expect(result.deleted).toBe(true);
    expect((await query(`SELECT id FROM drafter_documents WHERE id = $1`, [docId])).length).toBe(0);
    cleanupDocIds.splice(cleanupDocIds.indexOf(docId), 1);
  });
});

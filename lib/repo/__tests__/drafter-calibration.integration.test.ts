import { describe, it, expect, afterEach } from "vitest";
import { query } from "@/lib/db";
import {
  addCalibrationItem,
  getCalibrationItem,
  saveCalibrationItemJudgeOutput,
  listCalibrationItemsJudgedUnder,
  deleteCalibrationItem,
  clearCalibrationItems,
} from "../drafter-calibration";

/**
 * Real-DB coverage of the calibration item management + per-model tagging
 * the per-item judge route (app/api/drafter/calibration/items/[id]/judge)
 * and the finalise route (app/api/drafter/calibration/run) both rely on.
 */

const ACTOR = "drafter-calibration-repo-test@example.com";
const createdIds: string[] = [];

async function makeItem(labels: Record<string, "pass" | "fail"> = { scope_stated: "pass" }) {
  const item = await addCalibrationItem({ enhancementText: "Some control text.", rationaleText: "Some rationale.", sectionType: "General", humanLabels: labels, actor: ACTOR });
  createdIds.push(item.id);
  return item;
}

afterEach(async () => {
  if (createdIds.length) {
    await query(`DELETE FROM drafter_calibration_items WHERE id = ANY($1::uuid[])`, [createdIds]);
    createdIds.length = 0;
  }
});

describe("calibration item tagging by model + prompt version", () => {
  it("a fresh item has no judge output and is not returned by listCalibrationItemsJudgedUnder for any model", async () => {
    const item = await makeItem();
    const underCurrent = await listCalibrationItemsJudgedUnder("qwen/qwen3-30b-a3b", "pra-judge-rubric-v1");
    expect(underCurrent.some((r) => r.id === item.id)).toBe(false);
  });

  it("stores a valid judge attempt tagged with model + prompt version, and only that model+version's listing returns it", async () => {
    const item = await makeItem();
    await saveCalibrationItemJudgeOutput(item.id, { criteria: { scope_stated: { quote: "x", pass: true, reason: "ok", suggestedRewrite: null } } }, "qwen/qwen3-30b-a3b", "pra-judge-rubric-v1");

    const underCurrent = await listCalibrationItemsJudgedUnder("qwen/qwen3-30b-a3b", "pra-judge-rubric-v1");
    expect(underCurrent.some((r) => r.id === item.id)).toBe(true);

    const underOtherModel = await listCalibrationItemsJudgedUnder("some-other-model", "pra-judge-rubric-v1");
    expect(underOtherModel.some((r) => r.id === item.id)).toBe(false);

    const reloaded = await getCalibrationItem(item.id);
    expect(reloaded?.judge_model_name).toBe("qwen/qwen3-30b-a3b");
  });

  it("re-judging under a NEW model overwrites the tag, so the item stops counting for the old model+version - a stale cached verdict is never counted against a model change", async () => {
    const item = await makeItem();
    await saveCalibrationItemJudgeOutput(item.id, { criteria: { scope_stated: { quote: "x", pass: true, reason: "ok", suggestedRewrite: null } } }, "old-model", "pra-judge-rubric-v1");
    await saveCalibrationItemJudgeOutput(item.id, { criteria: { scope_stated: { quote: "x", pass: false, reason: "ok", suggestedRewrite: null } } }, "new-model", "pra-judge-rubric-v1");

    const underOld = await listCalibrationItemsJudgedUnder("old-model", "pra-judge-rubric-v1");
    expect(underOld.some((r) => r.id === item.id)).toBe(false);
    const underNew = await listCalibrationItemsJudgedUnder("new-model", "pra-judge-rubric-v1");
    expect(underNew.some((r) => r.id === item.id)).toBe(true);
  });

  it("stores an INVALID judge attempt (missing/error) tagged with the model too, so it can still be counted as a disagreement by finalise", async () => {
    const item = await makeItem();
    await saveCalibrationItemJudgeOutput(item.id, { invalid: true, error: "Malformed JSON" }, "qwen/qwen3-30b-a3b", "pra-judge-rubric-v1");
    const reloaded = await getCalibrationItem(item.id);
    expect(reloaded?.judge_output).toEqual({ invalid: true, error: "Malformed JSON" });
    expect(reloaded?.judge_model_name).toBe("qwen/qwen3-30b-a3b");
    const underCurrent = await listCalibrationItemsJudgedUnder("qwen/qwen3-30b-a3b", "pra-judge-rubric-v1");
    expect(underCurrent.some((r) => r.id === item.id)).toBe(true);
  });
});

describe("calibration item management", () => {
  it("deletes one item, leaving the rest of the set intact", async () => {
    const a = await makeItem();
    const b = await makeItem();
    const deleted = await deleteCalibrationItem(a.id, ACTOR);
    expect(deleted).toBe(true);
    expect(await getCalibrationItem(a.id)).toBeNull();
    expect(await getCalibrationItem(b.id)).not.toBeNull();
    createdIds.length = 0;
    createdIds.push(b.id);
  });

  it("deleting a non-existent item returns false, not an error", async () => {
    expect(await deleteCalibrationItem("00000000-0000-0000-0000-000000000000", ACTOR)).toBe(false);
  });

  it("clears the whole set so it can be re-imported", async () => {
    await makeItem();
    await makeItem();
    const before = await query<{ n: string }>(`SELECT count(*)::text AS n FROM drafter_calibration_items`);
    expect(Number(before[0].n)).toBeGreaterThanOrEqual(2);
    const removed = await clearCalibrationItems(ACTOR);
    expect(removed).toBeGreaterThanOrEqual(2);
    const after = await query<{ n: string }>(`SELECT count(*)::text AS n FROM drafter_calibration_items`);
    expect(Number(after[0].n)).toBe(0);
    createdIds.length = 0; // already gone
  });
});

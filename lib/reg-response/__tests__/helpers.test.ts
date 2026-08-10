import { describe, expect, it, vi } from "vitest";

// parseApprovalBody looks up people via lib/repo/people.getPerson, which
// touches the DB. Mocked here so this stays a pure unit test - any UUID
// resolves to a person EXCEPT the dedicated "unknown" one, so the
// decidedByPersonId/ownerPersonId "not found for this workspace" branches
// are still exercisable. Mirrors lib/readiness/__tests__/helpers.test.ts.
const UNKNOWN_PERSON_ID = "00000000-0000-0000-0000-000000000000";

vi.mock("@/lib/repo/people", () => ({
  getPerson: vi.fn(async (_workspaceId: string, id: string) => {
    if (id === UNKNOWN_PERSON_ID) return null;
    return { id, workspace_id: "ws", name: "Test Person", role: "approver", email: null, created_at: "", updated_at: "" };
  }),
}));

const { parseApprovalBody } = await import("../helpers");

const DECIDER_ID = "11111111-2222-3333-4444-555555555555";
const OWNER_ID = "66666666-7777-8888-9999-000000000000";

describe("parseApprovalBody", () => {
  it("rejects a missing decidedByPersonId", async () => {
    const result = await parseApprovalBody("ws", {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/decidedByPersonId/i);
  });

  it("rejects a malformed decidedByPersonId", async () => {
    const result = await parseApprovalBody("ws", { decidedByPersonId: "not-a-uuid" });
    expect(result.ok).toBe(false);
  });

  it("rejects an unknown decidedByPersonId", async () => {
    const result = await parseApprovalBody("ws", { decidedByPersonId: UNKNOWN_PERSON_ID });
    expect(result.ok).toBe(false);
  });

  it("accepts a valid decidedByPersonId with no rationale or conditions", async () => {
    const result = await parseApprovalBody("ws", { decidedByPersonId: DECIDER_ID });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.decidedByPersonId).toBe(DECIDER_ID);
      expect(result.rationale).toBeNull();
      expect(result.conditions).toEqual([]);
    }
  });

  it("trims and carries a rationale", async () => {
    const result = await parseApprovalBody("ws", { decidedByPersonId: DECIDER_ID, rationale: "  Approved subject to remediation  " });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rationale).toBe("Approved subject to remediation");
  });

  it("accepts a condition with a valid ISO dueDate", async () => {
    const result = await parseApprovalBody("ws", {
      decidedByPersonId: DECIDER_ID,
      conditions: [{ description: "Board ratification required", dueDate: "2026-09-30" }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.conditions).toEqual([{ description: "Board ratification required", dueDate: "2026-09-30", ownerPersonId: null }]);
    }
  });

  it("rejects a condition with an empty description", async () => {
    const result = await parseApprovalBody("ws", { decidedByPersonId: DECIDER_ID, conditions: [{ description: "  " }] });
    expect(result.ok).toBe(false);
  });

  it("rejects a condition whose dueDate is not a well-formed ISO date", async () => {
    const result = await parseApprovalBody("ws", {
      decidedByPersonId: DECIDER_ID,
      conditions: [{ description: "Board ratification required", dueDate: "not-a-date" }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/dueDate/i);
  });

  it("rejects a condition whose dueDate is calendar-invalid (e.g. 2026-02-30)", async () => {
    const result = await parseApprovalBody("ws", {
      decidedByPersonId: DECIDER_ID,
      conditions: [{ description: "Board ratification required", dueDate: "2026-02-30" }],
    });
    expect(result.ok).toBe(false);
  });

  it("still validates ownerPersonId on a condition against the workspace", async () => {
    const result = await parseApprovalBody("ws", {
      decidedByPersonId: DECIDER_ID,
      conditions: [{ description: "Owned condition", dueDate: "2026-09-30", ownerPersonId: OWNER_ID }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.conditions[0].ownerPersonId).toBe(OWNER_ID);
  });

  it("rejects an unknown ownerPersonId on a condition", async () => {
    const result = await parseApprovalBody("ws", {
      decidedByPersonId: DECIDER_ID,
      conditions: [{ description: "Owned condition", dueDate: "2026-09-30", ownerPersonId: UNKNOWN_PERSON_ID }],
    });
    expect(result.ok).toBe(false);
  });
});

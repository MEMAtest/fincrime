import { describe, expect, it } from "vitest";
import {
  isIsoDate,
  isUuid,
  validateCreateActionInput,
  validateUpdateActionInput,
  validateUpdateConditionInput,
} from "../action-input";

const VALID_UUID = "11111111-2222-3333-4444-555555555555";

describe("isUuid", () => {
  it("accepts a well-formed UUID", () => {
    expect(isUuid(VALID_UUID)).toBe(true);
  });

  it("rejects a non-UUID string", () => {
    expect(isUuid("not-a-uuid")).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(isUuid(123)).toBe(false);
    expect(isUuid(null)).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
});

describe("isIsoDate", () => {
  it("accepts a valid ISO date", () => {
    expect(isIsoDate("2026-08-09")).toBe(true);
  });

  it("rejects a malformed date string", () => {
    expect(isIsoDate("09-08-2026")).toBe(false);
    expect(isIsoDate("2026/08/09")).toBe(false);
    expect(isIsoDate("not-a-date")).toBe(false);
  });

  it("rejects a calendar-invalid date", () => {
    expect(isIsoDate("2026-02-30")).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(isIsoDate(20260809)).toBe(false);
  });
});

describe("validateCreateActionInput", () => {
  const base = {
    subjectType: "control_change",
    subjectId: VALID_UUID,
    title: "Review alert volume",
  };

  it("accepts a minimal valid input and defaults priority to medium", () => {
    const result = validateCreateActionInput(base);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.priority).toBe("medium");
      expect(result.value.ownerPersonId).toBeNull();
      expect(result.value.dueDate).toBeNull();
    }
  });

  it("accepts a fully populated valid input", () => {
    const result = validateCreateActionInput({
      ...base,
      ownerPersonId: VALID_UUID,
      dueDate: "2026-09-01",
      priority: "high",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects an empty title", () => {
    const result = validateCreateActionInput({ ...base, title: "   " });
    expect(result.ok).toBe(false);
  });

  it("rejects a missing title", () => {
    const { title, ...rest } = base;
    void title;
    const result = validateCreateActionInput(rest);
    expect(result.ok).toBe(false);
  });

  it("rejects an unknown subjectType", () => {
    const result = validateCreateActionInput({ ...base, subjectType: "not_a_subject" });
    expect(result.ok).toBe(false);
  });

  it("rejects a non-UUID subjectId", () => {
    const result = validateCreateActionInput({ ...base, subjectId: "abc123" });
    expect(result.ok).toBe(false);
  });

  it("rejects a non-UUID ownerPersonId", () => {
    const result = validateCreateActionInput({ ...base, ownerPersonId: "abc123" });
    expect(result.ok).toBe(false);
  });

  it("rejects a malformed dueDate", () => {
    const result = validateCreateActionInput({ ...base, dueDate: "09/01/2026" });
    expect(result.ok).toBe(false);
  });

  it("rejects a bad priority", () => {
    const result = validateCreateActionInput({ ...base, priority: "urgent" });
    expect(result.ok).toBe(false);
  });

  it("rejects a non-object body", () => {
    const result = validateCreateActionInput(null);
    expect(result.ok).toBe(false);
  });
});

describe("validateUpdateActionInput", () => {
  it("accepts an empty patch", () => {
    const result = validateUpdateActionInput({});
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({});
  });

  it("accepts clearing ownerPersonId and dueDate to null", () => {
    const result = validateUpdateActionInput({ ownerPersonId: null, dueDate: null });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.ownerPersonId).toBeNull();
      expect(result.value.dueDate).toBeNull();
    }
  });

  it("rejects a bad status", () => {
    const result = validateUpdateActionInput({ status: "closed" });
    expect(result.ok).toBe(false);
  });

  it("rejects a bad priority", () => {
    const result = validateUpdateActionInput({ priority: "urgent" });
    expect(result.ok).toBe(false);
  });

  it("rejects a non-UUID ownerPersonId", () => {
    const result = validateUpdateActionInput({ ownerPersonId: "nope" });
    expect(result.ok).toBe(false);
  });

  it("rejects a malformed dueDate", () => {
    const result = validateUpdateActionInput({ dueDate: "not-a-date" });
    expect(result.ok).toBe(false);
  });

  it("rejects an empty title when title is provided", () => {
    const result = validateUpdateActionInput({ title: "" });
    expect(result.ok).toBe(false);
  });

  it("accepts a valid status transition", () => {
    const result = validateUpdateActionInput({ status: "done" });
    expect(result.ok).toBe(true);
  });
});

describe("validateUpdateConditionInput", () => {
  it("accepts an empty patch", () => {
    const result = validateUpdateConditionInput({});
    expect(result.ok).toBe(true);
  });

  it("accepts status met and breached", () => {
    expect(validateUpdateConditionInput({ status: "met" }).ok).toBe(true);
    expect(validateUpdateConditionInput({ status: "breached" }).ok).toBe(true);
  });

  it("rejects a bad status", () => {
    const result = validateUpdateConditionInput({ status: "done" });
    expect(result.ok).toBe(false);
  });

  it("rejects an empty description when provided", () => {
    const result = validateUpdateConditionInput({ description: "" });
    expect(result.ok).toBe(false);
  });

  it("rejects a non-UUID ownerPersonId", () => {
    const result = validateUpdateConditionInput({ ownerPersonId: "nope" });
    expect(result.ok).toBe(false);
  });

  it("rejects a malformed dueDate", () => {
    const result = validateUpdateConditionInput({ dueDate: "2026/09/01" });
    expect(result.ok).toBe(false);
  });
});

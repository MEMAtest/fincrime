import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const user = { id: "u1", email: "owner@example.com", email_verified_at: null as string | null };

vi.mock("@/lib/repo/sessions", () => ({
  verifySession: vi.fn(async () => ({ user_id: "u1" })),
}));
vi.mock("@/lib/repo/users", () => ({
  getUserById: vi.fn(async () => user),
}));

import { resolveDrafterActor } from "../access";

describe("resolveDrafterActor requires a verified email", () => {
  const prev = process.env.PRA_DRAFTER_ALLOWED_EMAILS;
  beforeEach(() => {
    process.env.PRA_DRAFTER_ALLOWED_EMAILS = "owner@example.com";
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.PRA_DRAFTER_ALLOWED_EMAILS;
    else process.env.PRA_DRAFTER_ALLOWED_EMAILS = prev;
  });

  it("denies an allowlisted but unverified account", async () => {
    user.email_verified_at = null;
    expect(await resolveDrafterActor("token")).toBeNull();
  });

  it("admits an allowlisted verified account", async () => {
    user.email_verified_at = "2026-09-26T00:00:00Z";
    expect(await resolveDrafterActor("token")).toEqual({ userId: "u1", email: "owner@example.com" });
  });
});

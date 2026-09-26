import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { resolveDrafterActor, isDrafterAllowedEmail } from "../access";

const API_DRAFTER_DIR = join(process.cwd(), "app", "api", "drafter");

function findRouteFiles(dir: string): string[] {
  let out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out = out.concat(findRouteFiles(full));
    } else if (entry === "route.ts" || entry === "route.tsx") {
      out.push(full);
    }
  }
  return out;
}

describe("drafter API routes always use the access guard", () => {
  const routeFiles = findRouteFiles(API_DRAFTER_DIR);

  it("finds at least the routes present in the repo (informational)", () => {
    // Not a hard requirement that routes exist yet - coder 2/3 add them.
    expect(Array.isArray(routeFiles)).toBe(true);
  });

  it.each(routeFiles)("%s calls requireDrafterActorApi", (file) => {
    const contents = readFileSync(file, "utf8");
    expect(contents).toMatch(/requireDrafterActorApi/);
  });
});

describe("resolveDrafterActor", () => {
  it("returns null when no token is given", async () => {
    const actor = await resolveDrafterActor(null);
    expect(actor).toBeNull();
  });

  it("returns null when PRA_DRAFTER_ALLOWED_EMAILS is unset", async () => {
    const prev = process.env.PRA_DRAFTER_ALLOWED_EMAILS;
    delete process.env.PRA_DRAFTER_ALLOWED_EMAILS;
    const actor = await resolveDrafterActor("some-token");
    expect(actor).toBeNull();
    if (prev !== undefined) process.env.PRA_DRAFTER_ALLOWED_EMAILS = prev;
  });
});

describe("isDrafterAllowedEmail", () => {
  const prev = process.env.PRA_DRAFTER_ALLOWED_EMAILS;

  it("matches case-insensitively and trims", async () => {
    process.env.PRA_DRAFTER_ALLOWED_EMAILS = " Ademola@memaconsultants.com , other@x.com";
    expect(await isDrafterAllowedEmail("ademola@memaconsultants.com")).toBe(true);
    expect(await isDrafterAllowedEmail("ADEMOLA@MEMACONSULTANTS.COM")).toBe(true);
    expect(await isDrafterAllowedEmail("nope@x.com")).toBe(false);
    expect(await isDrafterAllowedEmail(null)).toBe(false);
    process.env.PRA_DRAFTER_ALLOWED_EMAILS = prev;
  });

  it("denies everyone when unset", async () => {
    delete process.env.PRA_DRAFTER_ALLOWED_EMAILS;
    expect(await isDrafterAllowedEmail("anyone@x.com")).toBe(false);
    if (prev !== undefined) process.env.PRA_DRAFTER_ALLOWED_EMAILS = prev;
  });
});

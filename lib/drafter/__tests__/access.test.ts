import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { resolveDrafterActor, checkAccessKey, issueDrafterToken, cleanLabel } from "../access";

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

describe("access key and drafter cookie", () => {
  const KEY = "k".repeat(20) + "-long-enough-secret";
  const prev = process.env.PRA_DRAFTER_ACCESS_KEY;
  beforeEach(() => {
    process.env.PRA_DRAFTER_ACCESS_KEY = KEY;
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.PRA_DRAFTER_ACCESS_KEY;
    else process.env.PRA_DRAFTER_ACCESS_KEY = prev;
  });

  it("denies everyone when the key is unset or too short", () => {
    delete process.env.PRA_DRAFTER_ACCESS_KEY;
    expect(checkAccessKey(KEY)).toBe(false);
    expect(issueDrafterToken("A")).toBeNull();
    process.env.PRA_DRAFTER_ACCESS_KEY = "short";
    expect(checkAccessKey("short")).toBe(false);
  });

  it("accepts only the exact key", () => {
    expect(checkAccessKey(KEY)).toBe(true);
    expect(checkAccessKey(KEY + "x")).toBe(false);
    expect(checkAccessKey("")).toBe(false);
    expect(checkAccessKey(undefined)).toBe(false);
  });

  it("round-trips a signed cookie to an actor named at unlock", () => {
    const token = issueDrafterToken("Ademola")!;
    expect(resolveDrafterActor(token)).toEqual({ userId: "access-key", email: "Ademola" });
  });

  it("rejects missing, tampered, expired and rotated-key cookies", () => {
    const token = issueDrafterToken("Ademola")!;
    expect(resolveDrafterActor(null)).toBeNull();
    const [label, exp, sig] = token.split(".");
    expect(resolveDrafterActor(`${Buffer.from("Mallory").toString("base64url")}.${exp}.${sig}`)).toBeNull();
    expect(resolveDrafterActor(`${label}.${Number(exp) + 999999}.${sig}`)).toBeNull();
    expect(resolveDrafterActor(`${label}.${exp}.${sig}x`)).toBeNull();
    expect(resolveDrafterActor(token, (Number(exp) + 1) * 1000)).toBeNull();
    process.env.PRA_DRAFTER_ACCESS_KEY = "a-completely-different-rotated-key";
    expect(resolveDrafterActor(token)).toBeNull();
  });

  it("cleans the name used in the audit trail", () => {
    expect(cleanLabel("<script>alert(1)</script> Ade")).toBe("scriptalert1script Ade");
    expect(cleanLabel("")).toBe("Drafter user");
    expect(cleanLabel(42)).toBe("Drafter user");
    expect(cleanLabel("x".repeat(100)).length).toBe(60);
  });
});

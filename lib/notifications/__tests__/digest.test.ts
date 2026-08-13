import { describe, expect, it } from "vitest";
import { buildDigest, isFrequencyDueToday, DEFAULT_NOTIFICATION_CATEGORIES, type NotificationCategories } from "../digest";
import { emptyGovernancePortfolio, type PortfolioSnapshot, type PortfolioItem } from "../../governance/portfolio";

const TODAY = new Date("2026-08-10T00:00:00.000Z");

function item(overrides: Partial<PortfolioItem> = {}): PortfolioItem {
  return {
    id: "item-1",
    label: "Something",
    subjectType: "action",
    href: "/assure/incidents/item-1",
    dueDate: "2026-08-01",
    dueDateLabel: "Due",
    status: "open",
    urgency: "overdue",
    ...overrides,
  };
}

function portfolioWith(overrides: Partial<PortfolioSnapshot>): PortfolioSnapshot {
  return { ...emptyGovernancePortfolio(TODAY), ...overrides };
}

function section(items: PortfolioItem[]) {
  return { count: items.length, items };
}

const prefs = (categories: Partial<NotificationCategories> = {}) => ({
  frequency: "daily" as const,
  categories: { ...DEFAULT_NOTIFICATION_CATEGORIES, ...categories },
});

describe("buildDigest", () => {
  it("returns null when there is nothing outstanding", () => {
    const portfolio = emptyGovernancePortfolio(TODAY);
    expect(buildDigest(portfolio, prefs(), TODAY)).toBeNull();
  });

  it("returns null when frequency is off, even with outstanding items", () => {
    const portfolio = portfolioWith({ overdueActions: section([item()]) });
    expect(buildDigest(portfolio, { frequency: "off", categories: DEFAULT_NOTIFICATION_CATEGORIES }, TODAY)).toBeNull();
  });

  it("includes a section only when its category is on and it has items", () => {
    const portfolio = portfolioWith({
      overdueActions: section([item({ id: "a-1" })]),
      decisionsRequired: section([item({ id: "d-1", subjectType: "pra_assessment" })]),
    });

    const digest = buildDigest(portfolio, prefs({ decisions: false }), TODAY);
    expect(digest).not.toBeNull();
    const keys = digest!.sections.map((s) => s.key);
    expect(keys).toContain("actions");
    expect(keys).not.toContain("decisions");
    expect(digest!.totalItems).toBe(1);
  });

  it("only includes the OVERDUE subset of openConditionsAndBlockers, not due_soon", () => {
    const portfolio = portfolioWith({
      openConditionsAndBlockers: section([
        item({ id: "c-overdue", urgency: "overdue" }),
        item({ id: "c-due-soon", urgency: "due_soon" }),
      ]),
    });
    const digest = buildDigest(portfolio, prefs(), TODAY);
    expect(digest).not.toBeNull();
    const conditions = digest!.sections.find((s) => s.key === "conditions");
    expect(conditions?.items.map((i) => i.id)).toEqual(["c-overdue"]);
  });

  it("combines overdue and due-soon regulatory commitments under one category", () => {
    const portfolio = portfolioWith({
      regulatoryCommitments: {
        open: section([]),
        overdue: section([item({ id: "rc-overdue" })]),
        dueSoon: section([item({ id: "rc-due-soon", urgency: "due_soon" })]),
      },
    });
    const digest = buildDigest(portfolio, prefs(), TODAY);
    const commitments = digest!.sections.find((s) => s.key === "commitments");
    expect(commitments?.items.map((i) => i.id).sort()).toEqual(["rc-due-soon", "rc-overdue"]);
  });

  it("produces an IDENTICAL summaryHash for an unchanged situation, even recomputed independently", () => {
    const portfolio = portfolioWith({ overdueActions: section([item({ id: "a-1" }), item({ id: "a-2", urgency: "overdue" })]) });
    const first = buildDigest(portfolio, prefs(), TODAY);
    const second = buildDigest(portfolioWith({ overdueActions: section([item({ id: "a-1" }), item({ id: "a-2", urgency: "overdue" })]) }), prefs(), TODAY);
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(first!.summaryHash).toBe(second!.summaryHash);
  });

  it("produces a DIFFERENT summaryHash when an item's state changes", () => {
    const before = portfolioWith({ overdueActions: section([item({ id: "a-1", urgency: "due_soon" })]) });
    const after = portfolioWith({ overdueActions: section([item({ id: "a-1", urgency: "overdue" })]) });
    const hashBefore = buildDigest(before, prefs(), TODAY)!.summaryHash;
    const hashAfter = buildDigest(after, prefs(), TODAY)!.summaryHash;
    expect(hashBefore).not.toBe(hashAfter);
  });

  it("produces a DIFFERENT summaryHash when a new item appears or one disappears", () => {
    const one = portfolioWith({ overdueActions: section([item({ id: "a-1" })]) });
    const two = portfolioWith({ overdueActions: section([item({ id: "a-1" }), item({ id: "a-2" })]) });
    const hashOne = buildDigest(one, prefs(), TODAY)!.summaryHash;
    const hashTwo = buildDigest(two, prefs(), TODAY)!.summaryHash;
    expect(hashOne).not.toBe(hashTwo);
  });

  it("summaryHash does not depend on section/item array order", () => {
    const a = portfolioWith({
      overdueActions: section([item({ id: "a-1" }), item({ id: "a-2" })]),
      decisionsRequired: section([item({ id: "d-1" })]),
    });
    const b = portfolioWith({
      overdueActions: section([item({ id: "a-2" }), item({ id: "a-1" })]),
      decisionsRequired: section([item({ id: "d-1" })]),
    });
    expect(buildDigest(a, prefs(), TODAY)!.summaryHash).toBe(buildDigest(b, prefs(), TODAY)!.summaryHash);
  });
});

describe("isFrequencyDueToday", () => {
  it("off is never due", () => {
    expect(isFrequencyDueToday("off", TODAY)).toBe(false);
  });

  it("daily is always due", () => {
    expect(isFrequencyDueToday("daily", TODAY)).toBe(true);
    expect(isFrequencyDueToday("daily", new Date("2026-08-16T00:00:00.000Z"))).toBe(true);
  });

  it("weekly is due only on Monday (UTC)", () => {
    const monday = new Date("2026-08-10T00:00:00.000Z"); // 2026-08-10 is a Monday
    const tuesday = new Date("2026-08-11T00:00:00.000Z");
    expect(isFrequencyDueToday("weekly", monday)).toBe(true);
    expect(isFrequencyDueToday("weekly", tuesday)).toBe(false);
  });
});

/**
 * Pure composition of a notification digest from an already-computed
 * governance portfolio (lib/governance/portfolio.ts) plus a user's
 * preferences. No SQL, no I/O, no `Date.now()`/`new Date()` inside - `today`
 * is always a parameter, mirroring lib/governance/portfolio.ts and
 * lib/readiness/summary.ts, so this module stays deterministic and
 * unit-testable in isolation.
 *
 * This module deliberately does NOT recompute anything the portfolio
 * aggregator already knows (overdue, due-soon, which control test failed,
 * etc.) - it only selects, filters by category toggle, and reshapes into an
 * email-shaped digest. See docs/auth-and-notifications.md's noise-risk
 * argument for why: "send nothing when there is nothing outstanding, never
 * send twice for the same state" is enforced here (buildDigest returns null
 * whenever every honoured section is empty) and in lib/notifications/send.ts
 * / the run route (summaryHash comparison against the last successful send).
 */
import { createHash } from "node:crypto";
import type { PortfolioSnapshot, PortfolioItem } from "../governance/portfolio";

export type NotificationFrequency = "off" | "daily" | "weekly";

export interface NotificationCategories {
  decisions: boolean;
  actions: boolean;
  conditions: boolean;
  commitments: boolean;
  controlTests: boolean;
}

export const DEFAULT_NOTIFICATION_CATEGORIES: NotificationCategories = {
  decisions: true,
  actions: true,
  conditions: true,
  commitments: true,
  controlTests: true,
};

export interface DigestPreferences {
  frequency: NotificationFrequency;
  categories: NotificationCategories;
}

export interface DigestItem {
  id: string;
  label: string;
  href: string | null;
  dueDate: string | null;
  dueDateLabel: string | null;
  status: string;
  urgency: string;
}

export interface DigestSection {
  key: keyof NotificationCategories;
  title: string;
  items: DigestItem[];
}

export interface Digest {
  /** The calendar date (UTC, YYYY-MM-DD) this digest was computed against - always derived from the `today` parameter, never from the portfolio or from Date.now(). */
  asOf: string;
  totalItems: number;
  sections: DigestSection[];
  /**
   * A stable hash over every section's items and their CURRENT state
   * (id, status, urgency, due date) - not over `asOf` or anything else that
   * would change just because a day passed. An unchanged situation
   * (same items, same statuses, same urgency) hashes identically no matter
   * when it is computed; a genuinely changed situation (an item resolved, a
   * new one appeared, an item's urgency flipped from due_soon to overdue)
   * hashes differently. This is what lets the cron endpoint refuse to send
   * the same digest twice.
   */
  summaryHash: string;
}

const SECTION_TITLES: Record<keyof NotificationCategories, string> = {
  decisions: "Decisions required",
  actions: "Overdue actions",
  conditions: "Overdue conditions",
  commitments: "Regulatory commitments overdue or due soon",
  controlTests: "Controls due or overdue for testing",
};

/** Section order in the email, matching the brief: decisions, actions, conditions, commitments, control tests. */
const SECTION_ORDER: (keyof NotificationCategories)[] = ["decisions", "actions", "conditions", "commitments", "controlTests"];

/** Monday, matching `Date#getUTCDay()`'s 0=Sunday convention. Weekly digests go out once a week rather than on whichever day a user first set the preference. */
const WEEKLY_DIGEST_UTC_DAY = 1;

/** Whether a `today` falls on this frequency's send day. 'off' is never due; 'daily' is always due; 'weekly' is due once a week (Monday, UTC). */
export function isFrequencyDueToday(frequency: NotificationFrequency, today: Date): boolean {
  if (frequency === "off") return false;
  if (frequency === "daily") return true;
  return today.getUTCDay() === WEEKLY_DIGEST_UTC_DAY;
}

function toDigestItem(item: PortfolioItem): DigestItem {
  return {
    id: item.id,
    label: item.label,
    href: item.href,
    dueDate: item.dueDate,
    dueDateLabel: item.dueDateLabel,
    status: item.status,
    urgency: item.urgency,
  };
}

/**
 * Sorted so the hash does not depend on array order (the portfolio's own
 * section order is otherwise stable, but nothing here should rely on that
 * staying true) - genuinely unchanged content must always hash identically
 * regardless of any incidental reordering upstream.
 */
function computeSummaryHash(sections: DigestSection[]): string {
  const hash = createHash("sha256");
  for (const key of SECTION_ORDER) {
    const section = sections.find((s) => s.key === key);
    const itemParts = (section?.items ?? [])
      .map((item) => `${item.id}:${item.status}:${item.urgency}:${item.dueDate ?? ""}`)
      .sort();
    hash.update(`${key}[${itemParts.join(",")}]`);
    hash.update("|");
  }
  return hash.digest("hex");
}

/**
 * Builds a digest from a governance portfolio and a user's preferences, or
 * returns null when there is nothing worth sending: frequency is 'off', or
 * every category the user has left on turns out to be empty right now. This
 * is the concrete mechanism behind docs/auth-and-notifications.md's "send
 * nothing when there is nothing outstanding" rule - there is no "all clear"
 * email variant, deliberately, per that document's noise-risk argument.
 *
 * Section-to-category mapping (fixed, not user-configurable beyond the
 * on/off toggle): decisionsRequired -> decisions; overdueActions -> actions;
 * the OVERDUE subset of openConditionsAndBlockers -> conditions (due-soon
 * conditions are not urgent enough to interrupt someone's inbox daily -
 * they will surface once actually overdue, or a user can review them
 * on-screen); overdue + due-soon regulatory commitments -> commitments;
 * controlsDueForTesting (already restricted to overdue/due-soon by
 * computeControlsDueForTesting) -> controlTests.
 */
export function buildDigest(portfolio: PortfolioSnapshot, preferences: DigestPreferences, today: Date): Digest | null {
  if (preferences.frequency === "off") return null;

  const overdueConditions = portfolio.openConditionsAndBlockers.items.filter((item) => item.urgency === "overdue");
  const commitmentItems = [...portfolio.regulatoryCommitments.overdue.items, ...portfolio.regulatoryCommitments.dueSoon.items];

  const candidateSections: DigestSection[] = [
    { key: "decisions", title: SECTION_TITLES.decisions, items: portfolio.decisionsRequired.items.map(toDigestItem) },
    { key: "actions", title: SECTION_TITLES.actions, items: portfolio.overdueActions.items.map(toDigestItem) },
    { key: "conditions", title: SECTION_TITLES.conditions, items: overdueConditions.map(toDigestItem) },
    { key: "commitments", title: SECTION_TITLES.commitments, items: commitmentItems.map(toDigestItem) },
    { key: "controlTests", title: SECTION_TITLES.controlTests, items: portfolio.controlsDueForTesting.items.map(toDigestItem) },
  ];

  const sections = candidateSections.filter((s) => preferences.categories[s.key] && s.items.length > 0);
  if (sections.length === 0) return null;

  const totalItems = sections.reduce((sum, s) => sum + s.items.length, 0);
  const asOf = today.toISOString().slice(0, 10);

  return { asOf, totalItems, sections, summaryHash: computeSummaryHash(sections) };
}

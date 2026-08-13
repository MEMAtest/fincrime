/**
 * Renders a digest (lib/notifications/digest.ts) into an HTML + plain-text
 * email and delivers it. Reuses lib/format/date.ts for date display and the
 * workspace's organisationName setting for the subject line, per the brief -
 * this module does not invent its own date formatting or organisation
 * naming logic.
 */
import { formatIsoDate } from "@/lib/format/date";
import { sendMultipartEmail } from "@/lib/email";
import type { Digest, DigestItem, DigestSection } from "./digest";

const APP_BASE_URL = (process.env.APP_BASE_URL || "https://fincrime.memaconsultants.com").replace(/\/$/, "");

/** Builds the one-click unsubscribe URL embedded in every digest's footer. */
export function unsubscribeUrlForToken(token: string): string {
  return `${APP_BASE_URL}/api/notifications/unsubscribe?token=${encodeURIComponent(token)}`;
}

export interface OutboundEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Captures outbound emails instead of calling SES when
 * NOTIFICATIONS_CAPTURE=1 - a local-only smoke-test seam (see
 * scripts/smoke-notifications.mjs and app/api/notifications/captured/
 * route.ts). Nothing sets this env var in production or in the GitHub
 * Actions cron, so this array stays empty and unused there; the real send
 * path (sendMultipartEmail) is exercised in production exactly as before.
 */
export const capturedEmails: OutboundEmail[] = [];

async function deliver(email: OutboundEmail): Promise<boolean> {
  if (process.env.NOTIFICATIONS_CAPTURE === "1") {
    capturedEmails.push(email);
    return true;
  }
  return sendMultipartEmail(email);
}

function absoluteUrl(href: string | null): string | null {
  if (!href) return null;
  if (/^https?:\/\//i.test(href)) return href;
  return `${APP_BASE_URL}${href.startsWith("/") ? href : `/${href}`}`;
}

function formatDueDate(value: string | null, dateFormat: "en-GB" | "iso"): string {
  if (!value) return "No due date";
  if (dateFormat === "iso") return value;
  return formatIsoDate(value, { style: "long" });
}

const URGENCY_LABEL: Record<string, string> = {
  overdue: "Overdue",
  due_soon: "Due soon",
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function itemHtml(item: DigestItem, dateFormat: "en-GB" | "iso"): string {
  // Escaped exactly like `label` beside it - href values are built from
  // DB-stored data (a subject id interpolated into a path in
  // lib/governance/portfolio.ts), not free text, but this HTML is
  // assembled by string concatenation, not a templating engine that
  // escapes attribute values for you, so an unescaped url dropped straight
  // into `href="${url}"` is one stray `"` away from breaking out of the
  // attribute (and, worse, past the '"' out of it into HTML/script
  // context) if that assumption is ever wrong.
  const url = absoluteUrl(item.href);
  const escapedUrl = url ? escapeHtml(url) : null;
  const label = escapeHtml(item.label);
  const linkedLabel = escapedUrl ? `<a href="${escapedUrl}" style="color:#0f766e;text-decoration:none;">${label}</a>` : label;
  const dueLabel = item.dueDateLabel ? `${escapeHtml(item.dueDateLabel)}: ${formatDueDate(item.dueDate, dateFormat)}` : formatDueDate(item.dueDate, dateFormat);
  const urgency = escapeHtml(URGENCY_LABEL[item.urgency] ?? item.urgency);
  return `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">
        <div style="font-size:14px;color:#111827;">${linkedLabel}</div>
        <div style="font-size:12px;color:#6b7280;margin-top:2px;">${dueLabel} &middot; ${urgency}</div>
      </td>
    </tr>`;
}

function itemText(item: DigestItem, dateFormat: "en-GB" | "iso"): string {
  const url = absoluteUrl(item.href);
  const dueLabel = item.dueDateLabel ? `${item.dueDateLabel}: ${formatDueDate(item.dueDate, dateFormat)}` : formatDueDate(item.dueDate, dateFormat);
  const urgency = URGENCY_LABEL[item.urgency] ?? item.urgency;
  return `  - ${item.label} (${dueLabel}, ${urgency})${url ? `\n    ${url}` : ""}`;
}

function sectionHtml(section: DigestSection, dateFormat: "en-GB" | "iso"): string {
  return `
    <h2 style="font-size:15px;color:#111827;margin:24px 0 8px;">${escapeHtml(section.title)} (${section.items.length})</h2>
    <table style="width:100%;border-collapse:collapse;">
      ${section.items.map((item) => itemHtml(item, dateFormat)).join("")}
    </table>`;
}

function sectionText(section: DigestSection, dateFormat: "en-GB" | "iso"): string {
  return `${section.title} (${section.items.length})\n${section.items.map((item) => itemText(item, dateFormat)).join("\n")}`;
}

export interface RenderDigestInput {
  digest: Digest;
  organisationName: string | null;
  dateFormat: "en-GB" | "iso";
  unsubscribeUrl: string;
}

export function renderDigestEmail(input: RenderDigestInput): { subject: string; html: string; text: string } {
  const { digest, organisationName, dateFormat, unsubscribeUrl } = input;
  const orgLabel = organisationName || "FinCrime Control Lab";
  const asOfDisplay = formatDueDate(digest.asOf, dateFormat);
  const plural = digest.totalItems === 1 ? "item needs" : "items need";
  const subject = `${orgLabel}: ${digest.totalItems} ${plural} attention - ${asOfDisplay}`;

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;">
      <h1 style="font-size:18px;color:#111827;margin-bottom:4px;">${escapeHtml(orgLabel)} compliance digest</h1>
      <p style="font-size:13px;color:#6b7280;margin-top:0;">As of ${asOfDisplay} - ${digest.totalItems} ${plural} attention.</p>
      ${digest.sections.map((section) => sectionHtml(section, dateFormat)).join("")}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 12px;" />
      <p style="font-size:11px;color:#9ca3af;">
        You are receiving this because you are a member of a workspace on FinCrime Control Lab.
        <a href="${unsubscribeUrl}" style="color:#9ca3af;">Unsubscribe from these digests</a> or manage your notification preferences in Settings.
      </p>
    </div>`;

  const text = [
    `${orgLabel} compliance digest`,
    `As of ${asOfDisplay} - ${digest.totalItems} ${plural} attention.`,
    "",
    ...digest.sections.map((section) => sectionText(section, dateFormat)),
    "",
    "---",
    "You are receiving this because you are a member of a workspace on FinCrime Control Lab.",
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join("\n");

  return { subject, html, text };
}

export interface SendDigestInput extends RenderDigestInput {
  to: string;
}

/** Renders and delivers a digest email; delivery goes through the capture-aware `deliver` so a local smoke run never actually emails. */
export async function sendDigestEmail(input: SendDigestInput): Promise<boolean> {
  const { subject, html, text } = renderDigestEmail(input);
  return deliver({ to: input.to, subject, html, text });
}

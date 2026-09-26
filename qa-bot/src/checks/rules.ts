import type { NewFinding } from "../findings.js";
import type { Occurrence, Severity, ViewportName } from "../types.js";
import { truncate } from "../util.js";
import type { LayoutAudit, PageInfo, PerfSnapshot } from "./dom-scripts.js";

export interface PageCtx {
  url: string;
  viewport: ViewportName;
  files?: string[];
  isLocal: boolean;
  isDevServer: boolean;
}

const occ = (c: PageCtx, extra: Partial<Occurrence> = {}): Occurrence => ({ url: c.url, viewport: c.viewport, ...extra });

// ---------------------------------------------------------------- console + runtime errors

const CONSOLE_NOISE = [
  /Download the (React|Vue|Apollo) DevTools/i,
  /\[HMR\]|\[Fast Refresh\]|webpack-hmr|\[vite\]/i,
  /^Failed to load resource/i, // reported from the network listener instead
  /third-party cookie/i,
  /DevTools failed to load source map/i,
  /GroupMarkerNotSet|fallback to software WebGL|SwiftShader/i, // headless Chromium GPU notices, not the app
];

const ESCALATE_CONSOLE = /(Hydration failed|Uncaught|ChunkLoadError|Maximum update depth|Minified React error|Cannot read properties of (undefined|null)|is not a function|is not defined)/i;

export function consoleFinding(c: PageCtx, type: string, text: string): NewFinding | undefined {
  if (CONSOLE_NOISE.some((re) => re.test(text))) return undefined;
  const isError = type === "error";
  const firstLine = text.split("\n")[0];
  let severity: Severity = isError ? "medium" : "low";
  if (isError && ESCALATE_CONSOLE.test(text)) severity = "high";
  const reactKey = /unique "key" prop/.test(text);
  if (reactKey) severity = "low";
  return {
    ruleId: isError ? "console-error" : "console-warning",
    key: firstLine,
    title: `${isError ? "Console error" : "Console warning"}: ${truncate(firstLine, 110)}`,
    severity,
    category: "functional",
    description: truncate(text, 1500),
    recommendation: isError
      ? "Console errors usually mean broken behaviour a user will hit. Reproduce on this page with DevTools open and fix the root cause."
      : "Warnings often precede real bugs (bad keys, deprecated APIs, failed hydration). Clean them up so real errors stand out.",
    source: "browser",
    occurrence: occ(c, { detail: truncate(firstLine, 300) }),
    files: c.files,
  };
}

export function pageErrorFinding(c: PageCtx, message: string): NewFinding {
  const firstLine = message.split("\n")[0];
  return {
    ruleId: "uncaught-exception",
    key: firstLine,
    title: `Uncaught JavaScript exception: ${truncate(firstLine, 110)}`,
    severity: "high",
    category: "functional",
    description: truncate(message, 2000),
    recommendation: "An uncaught exception can leave the page half-rendered or unresponsive. Add error handling and fix the failing code path.",
    source: "browser",
    occurrence: occ(c, { detail: truncate(firstLine, 300) }),
    files: c.files,
  };
}

// ---------------------------------------------------------------- network

const NETWORK_NOISE = [/\/_next\/webpack-hmr/, /\/__vite_ping/, /\/@vite\//, /\/__nextjs/, /sockjs-node/, /hot-update\.(js|json)/];
const LOCAL_ONLY_MISSING = [/\/_vercel\/(insights|speed-insights)\//, /\/cdn-cgi\//];

export interface FailedRequest {
  url: string;
  method: string;
  status?: number;
  failure?: string;
  resourceType: string;
}

export function networkFinding(c: PageCtx, r: FailedRequest, origin: string): NewFinding | undefined {
  if (NETWORK_NOISE.some((re) => re.test(r.url))) return undefined;
  let u: URL;
  try {
    u = new URL(r.url);
  } catch {
    return undefined;
  }
  if (!/^https?:$/.test(u.protocol)) return undefined;
  const sameOrigin = u.origin === origin;
  const what = r.status ? `HTTP ${r.status}` : (r.failure ?? "failed");
  const shortUrl = sameOrigin ? u.pathname : `${u.host}${u.pathname}`;
  if (c.isLocal && LOCAL_ONLY_MISSING.some((re) => re.test(r.url))) {
    return {
      ruleId: "network-local-only",
      key: u.pathname,
      title: `Platform script unavailable locally: ${u.pathname}`,
      severity: "info",
      category: "functional",
      description: `${r.method} ${r.url} → ${what}. This path is normally served by the hosting platform and is expected to fail on a local server.`,
      source: "browser",
      occurrence: occ(c),
    };
  }
  if (/\/favicon\.ico$/.test(u.pathname) && r.status === 404) {
    return {
      ruleId: "missing-favicon",
      title: "favicon.ico returns 404",
      severity: "low",
      category: "visual",
      description: "Browsers request /favicon.ico automatically. A missing icon looks unfinished in tabs and bookmarks.",
      recommendation: "Add a favicon (or a <link rel=\"icon\"> the browser will use instead).",
      source: "browser",
      occurrence: occ(c),
    };
  }
  let severity: Severity;
  let category: "functional" | "backend" | "visual" = "functional";
  const type = r.resourceType;
  if (!sameOrigin) severity = "low";
  else if (r.status && r.status >= 500) {
    severity = "high";
    category = "backend";
  } else if (type === "script" || type === "stylesheet" || type === "document") severity = "high";
  else if (type === "fetch" || type === "xhr") {
    severity = r.status === 401 || r.status === 403 ? "low" : "medium";
    category = "backend";
  } else if (type === "image" || type === "font" || type === "media") {
    severity = "medium";
    category = "visual";
  } else severity = "medium";
  return {
    ruleId: sameOrigin ? `network-${type}` : "network-third-party",
    key: `${r.method} ${shortUrl} ${r.status ?? r.failure}`,
    title: `${sameOrigin ? "" : "Third-party "}${type} request fails (${what}): ${truncate(shortUrl, 90)}`,
    severity,
    category,
    description: `${r.method} ${r.url} → ${what} while loading the page.`,
    recommendation:
      category === "backend"
        ? "Check the server logs for this endpoint; the page depends on it and currently gets an error back."
        : "Fix or remove the reference. Broken assets degrade the page and waste a round trip.",
    source: "browser",
    occurrence: occ(c, { detail: `${r.method} ${truncate(r.url, 200)} → ${what}` }),
    files: c.files,
  };
}

// ---------------------------------------------------------------- content + SEO

export function contentFindings(c: PageCtx, info: PageInfo): NewFinding[] {
  const out: NewFinding[] = [];
  const base = { source: "browser" as const, files: c.files };
  if (!info.title.trim()) {
    out.push({
      ...base,
      ruleId: "seo-missing-title",
      title: "Page has no <title>",
      severity: "medium",
      category: "seo",
      description: "The document title shows in browser tabs, bookmarks, history and search results.",
      recommendation: "Give every page a unique, descriptive title.",
      occurrence: occ(c),
    });
  }
  if (!info.metaDescription) {
    out.push({
      ...base,
      ruleId: "seo-missing-description",
      title: "Missing meta description",
      severity: "low",
      category: "seo",
      description: "Search engines and link previews fall back to arbitrary page text when there is no meta description.",
      recommendation: 'Add <meta name="description" content="…"> (roughly 70–160 characters) describing the page.',
      occurrence: occ(c),
    });
  }
  if (!info.viewportMeta) {
    out.push({
      ...base,
      ruleId: "responsive-no-viewport-meta",
      title: "Missing viewport meta tag",
      severity: "high",
      category: "responsive",
      description: "Without <meta name=\"viewport\">, phones render the page at desktop width and shrink it, making text unreadable.",
      recommendation: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.',
      occurrence: occ(c),
    });
  } else if (/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/i.test(info.viewportMeta)) {
    out.push({
      ...base,
      ruleId: "a11y-zoom-disabled",
      title: "Pinch-zoom is disabled",
      severity: "medium",
      category: "accessibility",
      description: `The viewport meta tag (${info.viewportMeta}) stops users from zooming, which fails WCAG 1.4.4 for low-vision users.`,
      recommendation: "Remove user-scalable=no / maximum-scale=1.",
      occurrence: occ(c),
    });
  }
  if (info.h1Count === 0 && info.bodyTextLength > 200) {
    out.push({
      ...base,
      ruleId: "content-no-h1",
      title: "Page has no <h1> heading",
      severity: "low",
      category: "seo",
      description: "A single top-level heading tells users, screen readers and search engines what the page is about.",
      recommendation: "Add one <h1> that names the page.",
      occurrence: occ(c),
    });
  } else if (info.h1Count > 1) {
    out.push({
      ...base,
      ruleId: "content-multiple-h1",
      title: "Multiple <h1> headings on one page",
      severity: "info",
      category: "seo",
      description: `Found ${info.h1Count} <h1> elements. One clear page title is easier to scan and index.`,
      occurrence: occ(c, { detail: `${info.h1Count} h1 elements` }),
    });
  }
  if (info.robots && /noindex/i.test(info.robots) && !c.isLocal) {
    out.push({
      ...base,
      ruleId: "seo-noindex",
      title: "Page is marked noindex",
      severity: "info",
      category: "seo",
      description: `robots meta is "${info.robots}". Confirm this page is meant to be hidden from search engines.`,
      occurrence: occ(c),
    });
  }
  if (!info.ogTitle || !info.ogImage) {
    out.push({
      ...base,
      ruleId: "seo-open-graph",
      title: "Missing Open Graph tags (og:title / og:image)",
      severity: "info",
      category: "seo",
      description: "Links shared on Slack, LinkedIn, Teams and so on will render without a proper preview card.",
      recommendation: "Add og:title, og:description and og:image meta tags.",
      occurrence: occ(c),
    });
  }
  for (const s of info.suspiciousText) {
    const sev: Severity = ["[object Object]", "NaN", "Invalid Date", "unrendered template"].includes(s.token)
      ? "medium"
      : s.token === "placeholder" || s.token === "lorem ipsum"
        ? "low"
        : "low";
    out.push({
      ...base,
      ruleId: `content-suspicious-${s.token.replace(/\W+/g, "-").toLowerCase()}`,
      key: s.context,
      title:
        s.token === "placeholder" || s.token === "lorem ipsum"
          ? `Placeholder copy visible on the page ("${s.token}")`
          : `"${s.token}" rendered as visible text`,
      severity: sev,
      category: "content",
      description: `Visible text contains "${s.token}": “…${s.context}…”. This usually means a value was missing, badly formatted or never replaced.`,
      recommendation: "Trace where this value is rendered and handle the missing/invalid case with a proper fallback.",
      occurrence: occ(c, { detail: s.context }),
    });
  }
  for (const id of info.anchorsMissing) {
    out.push({
      ...base,
      ruleId: "link-broken-anchor",
      key: id,
      title: `In-page link points to a missing anchor (#${id})`,
      severity: "low",
      category: "functional",
      description: `A link targets #${id}, but no element with that id or name exists, so clicking it does nothing.`,
      occurrence: occ(c, { detail: `#${id}` }),
    });
  }
  return out;
}

// ---------------------------------------------------------------- layout + responsive

export function layoutFindings(c: PageCtx, a: LayoutAudit): NewFinding[] {
  const out: NewFinding[] = [];
  const base = { source: "browser" as const, files: c.files };
  if (a.horizontalScroll > 2) {
    const culprit = a.overflowOffenders[0];
    out.push({
      ...base,
      ruleId: "responsive-horizontal-scroll",
      key: `${c.viewport}`,
      title: `Page scrolls sideways on ${c.viewport} (content ${a.horizontalScroll}px wider than the screen)`,
      severity: c.viewport === "desktop" ? "medium" : "high",
      category: "responsive",
      description:
        `The page can be scrolled horizontally by ${a.horizontalScroll}px at this viewport width.` +
        (a.overflowOffenders.length
          ? ` Widest offenders: ${a.overflowOffenders.map((o) => `${o.selector} (+${o.overflowPx}px)`).join(", ")}.`
          : ""),
      recommendation: "Constrain the offending element (max-width: 100%, flex-wrap, min-width: 0 on flex children, overflow-x: auto on tables/code).",
      occurrence: occ(c, { selector: culprit?.selector, detail: `+${a.horizontalScroll}px` }),
    });
  }
  if (a.smallTargets.length) {
    out.push({
      ...base,
      ruleId: "a11y-small-tap-targets",
      title: "Tap targets smaller than 24×24px on touch screens",
      severity: "medium",
      category: "accessibility",
      description: `Examples: ${a.smallTargets
        .slice(0, 6)
        .map((t) => `"${t.text || t.selector}" (${t.w}×${t.h})`)
        .join(", ")}. Small targets are hard to hit and fail WCAG 2.5.8.`,
      recommendation: "Make interactive elements at least 24×24px (44×44px is the comfortable touch size) or add padding.",
      occurrence: occ(c, { selector: a.smallTargets[0].selector, detail: `${a.smallTargets.length} small targets` }),
    });
  }
  if (a.tinyText.length) {
    out.push({
      ...base,
      ruleId: "responsive-tiny-text",
      title: "Text smaller than 12px on mobile",
      severity: "low",
      category: "responsive",
      description: `Examples: ${a.tinyText
        .slice(0, 5)
        .map((t) => `"${t.text}" (${t.size}px)`)
        .join(", ")}.`,
      recommendation: "Use at least 14–16px for body copy on phones; reserve anything under 12px for non-essential labels.",
      occurrence: occ(c, { selector: a.tinyText[0].selector, detail: `${a.tinyText.length} elements` }),
    });
  }
  for (const o of a.obscured) {
    out.push({
      ...base,
      ruleId: "ui-obscured-control",
      key: `${o.selector}|${o.coveredBy}`,
      title: `Control is covered by another element: "${o.text || o.selector}"`,
      severity: "medium",
      category: "ux",
      description: `Clicking the centre of ${o.selector} would hit ${o.coveredBy} instead. Overlapping headers, banners or modals can make controls unusable.`,
      recommendation: "Check z-index/positioning of the covering element, or add spacing so they don't overlap at this viewport.",
      occurrence: occ(c, { selector: o.selector, detail: `covered by ${o.coveredBy}` }),
    });
  }
  if (a.clipped.length) {
    out.push({
      ...base,
      ruleId: "ui-clipped-text",
      title: "Text is cut off without an ellipsis",
      severity: "low",
      category: "visual",
      description: `Examples: ${a.clipped
        .slice(0, 4)
        .map((t) => `"${t.text}" in ${t.selector}`)
        .join("; ")}.`,
      recommendation: "Let the text wrap, or add text-overflow: ellipsis plus a tooltip/title so the full value is still reachable.",
      occurrence: occ(c, { selector: a.clipped[0].selector, detail: `${a.clipped.length} elements` }),
    });
  }
  for (const img of a.brokenImages) {
    out.push({
      ...base,
      ruleId: "ui-broken-image",
      key: img.src.replace(/[?#].*$/, ""),
      title: `Broken image: ${truncate(img.src.replace(/^https?:\/\/[^/]+/, ""), 90)}`,
      severity: "medium",
      category: "visual",
      description: `The image at ${img.src} failed to load, so users see a broken-image icon or an empty box.`,
      occurrence: occ(c, { selector: img.selector }),
    });
  }
  return out;
}

// ---------------------------------------------------------------- performance

export function perfFindings(c: PageCtx, p: PerfSnapshot): NewFinding[] {
  const out: NewFinding[] = [];
  const devNote = c.isDevServer
    ? " (measured against a development server, which is much slower than production; confirm with --mode prod)"
    : "";
  const sev = (s: Severity): Severity => (c.isDevServer ? "info" : s);
  const base = { source: "browser" as const, category: "performance" as const, files: c.files };
  if (p.lcpMs && p.lcpMs > 2500) {
    out.push({
      ...base,
      ruleId: "perf-lcp",
      title: `Slow Largest Contentful Paint (${(p.lcpMs / 1000).toFixed(1)}s)`,
      severity: sev(p.lcpMs > 4000 ? "high" : "medium"),
      description: `The main content took ${p.lcpMs}ms to paint${devNote}. Google's "good" threshold is 2.5s.`,
      recommendation: "Optimise the hero image/text: preload it, serve smaller images, cut render-blocking JS/CSS, and cache on a CDN.",
      occurrence: occ(c, { detail: `LCP ${p.lcpMs}ms` }),
    });
  }
  if (p.cls !== undefined && p.cls > 0.1) {
    out.push({
      ...base,
      ruleId: "perf-cls",
      title: `Layout shifts while loading (CLS ${p.cls})`,
      severity: p.cls > 0.25 ? "medium" : "low",
      description: `Content jumps around during load (Cumulative Layout Shift ${p.cls}; good is ≤ 0.1). Users mis-click when this happens.`,
      recommendation: "Reserve space for images, ads, embeds and late-loading banners (width/height or aspect-ratio).",
      occurrence: occ(c, { detail: `CLS ${p.cls}` }),
    });
  }
  if (p.transferKb > 3000) {
    out.push({
      ...base,
      ruleId: "perf-page-weight",
      title: `Heavy page (${(p.transferKb / 1024).toFixed(1)} MB transferred)`,
      severity: sev(p.transferKb > 6000 ? "medium" : "low"),
      description:
        `The page downloads ${p.transferKb} KB across ${p.requestCount} requests${devNote}.` +
        (p.largest.length ? ` Largest: ${p.largest.map((l) => `${truncate(l.url.replace(/^https?:\/\/[^/]+/, ""), 60)} (${l.kb} KB)`).join(", ")}.` : ""),
      recommendation: "Compress and resize images (WebP/AVIF), code-split large bundles, and lazy-load below-the-fold media.",
      occurrence: occ(c, { detail: `${p.transferKb} KB` }),
    });
  }
  if (p.totalBlockingMs && p.totalBlockingMs > 600) {
    out.push({
      ...base,
      ruleId: "perf-main-thread",
      title: `Main thread blocked for ${p.totalBlockingMs}ms during load`,
      severity: sev(p.totalBlockingMs > 1500 ? "medium" : "low"),
      description: `Long JavaScript tasks blocked input for ${p.totalBlockingMs}ms${devNote}. The page will feel frozen on slower devices.`,
      recommendation: "Split heavy work, defer non-critical scripts, and move expensive computation off the main thread.",
      occurrence: occ(c, { detail: `TBT ${p.totalBlockingMs}ms` }),
    });
  }
  return out;
}

// ---------------------------------------------------------------- security

export interface CookieInfo {
  name: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: string;
}

export function securityHeaderFindings(c: PageCtx, headers: Record<string, string>, https: boolean): NewFinding[] {
  const h = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  const out: NewFinding[] = [];
  const localNote = c.isLocal ? " Checked against a local server: confirm on the deployed environment, where the host may add headers." : "";
  const sev = (s: Severity): Severity => (c.isLocal ? "info" : s);
  const base = { source: "browser" as const, category: "security" as const, occurrence: occ(c) };
  const csp = h["content-security-policy"];
  if (!csp) {
    out.push({
      ...base,
      ruleId: "sec-no-csp",
      title: "No Content-Security-Policy header",
      severity: sev("medium"),
      description: `Without a CSP, any injected script runs with full access to the page, so XSS bugs become account takeovers.${localNote}`,
      recommendation: "Add a Content-Security-Policy (start with report-only mode to tune it).",
    });
  }
  if (!h["x-frame-options"] && !(csp && /frame-ancestors/i.test(csp))) {
    out.push({
      ...base,
      ruleId: "sec-clickjacking",
      title: "Page can be framed by other sites (clickjacking)",
      severity: sev("medium"),
      description: `Neither X-Frame-Options nor CSP frame-ancestors is set, so another site can overlay this page in an invisible iframe.${localNote}`,
      recommendation: "Send X-Frame-Options: DENY (or CSP frame-ancestors 'self').",
    });
  }
  if ((h["x-content-type-options"] ?? "").toLowerCase() !== "nosniff") {
    out.push({
      ...base,
      ruleId: "sec-nosniff",
      title: "Missing X-Content-Type-Options: nosniff",
      severity: sev("low"),
      description: `Browsers may MIME-sniff responses and execute uploaded content as script.${localNote}`,
      recommendation: "Send X-Content-Type-Options: nosniff on all responses.",
    });
  }
  if (https && !h["strict-transport-security"]) {
    out.push({
      ...base,
      ruleId: "sec-no-hsts",
      title: "Missing Strict-Transport-Security (HSTS)",
      severity: sev("medium"),
      description: "Without HSTS, a first visit over plain HTTP can be downgraded by a network attacker.",
      recommendation: "Send Strict-Transport-Security: max-age=31536000; includeSubDomains.",
    });
  }
  if (!h["referrer-policy"]) {
    out.push({
      ...base,
      ruleId: "sec-referrer-policy",
      title: "Missing Referrer-Policy",
      severity: sev("low"),
      description: `Full URLs (possibly including tokens or IDs in query strings) may leak to third-party sites via the Referer header.${localNote}`,
      recommendation: "Send Referrer-Policy: strict-origin-when-cross-origin.",
    });
  }
  const powered = h["x-powered-by"];
  const server = h["server"];
  if (powered || (server && /\d/.test(server))) {
    out.push({
      ...base,
      ruleId: "sec-version-disclosure",
      title: "Server discloses its software/version",
      severity: sev("low"),
      description: `Headers reveal ${[powered && `X-Powered-By: ${powered}`, server && `Server: ${server}`].filter(Boolean).join(", ")}, which helps attackers pick exploits.`,
      recommendation: "Remove X-Powered-By and version numbers from the Server header (in Next.js: poweredByHeader: false).",
    });
  }
  return out;
}

export function cookieFindings(c: PageCtx, cookies: CookieInfo[], https: boolean): NewFinding[] {
  const out: NewFinding[] = [];
  for (const ck of cookies) {
    const sensitive = /(sess|token|auth|sid|jwt|login|remember|csrf|workspace)/i.test(ck.name);
    const problems: string[] = [];
    if (https && !ck.secure) problems.push("no Secure flag");
    if (sensitive && !ck.httpOnly) problems.push("no HttpOnly flag (readable by JavaScript/XSS)");
    if (ck.sameSite === "None" && !ck.secure) problems.push("SameSite=None without Secure");
    if (!problems.length) continue;
    out.push({
      ruleId: "sec-cookie-flags",
      key: ck.name,
      title: `Cookie "${ck.name}" is missing security flags`,
      severity: sensitive ? "medium" : "low",
      category: "security",
      description: `Cookie ${ck.name}: ${problems.join(", ")}.`,
      recommendation: "Set Secure, HttpOnly (for anything auth-related) and SameSite=Lax/Strict.",
      source: "browser",
      occurrence: occ(c, { detail: ck.name }),
    });
  }
  return out;
}

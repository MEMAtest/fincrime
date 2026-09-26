/**
 * Functions evaluated inside the page. Each must be self-contained: Playwright serialises the
 * function source, so nothing from module scope is available at runtime.
 */

export interface PageInfo {
  title: string;
  lang: string;
  metaDescription: string | null;
  viewportMeta: string | null;
  robots: string | null;
  canonical: string | null;
  ogTitle: string | null;
  ogImage: string | null;
  h1Count: number;
  headings: string[];
  links: { href: string; text: string; inline: boolean }[];
  anchorsMissing: string[];
  forms: number;
  buttons: string[];
  textSample: string;
  suspiciousText: { token: string; context: string }[];
  bodyTextLength: number;
}

export function collectPageInfo(): PageInfo {
  const q = (sel: string) => document.querySelector(sel);
  const attr = (sel: string, a: string) => q(sel)?.getAttribute(a) ?? null;
  const text = (document.body?.innerText ?? "").replace(/\s+\n/g, "\n");
  const links = Array.from(document.querySelectorAll("a[href]")).slice(0, 600).map((a) => {
    const el = a as HTMLAnchorElement;
    const inline = getComputedStyle(el).display === "inline";
    return { href: el.href, text: (el.innerText || el.getAttribute("aria-label") || "").trim().slice(0, 80), inline };
  });
  const anchorsMissing: string[] = [];
  for (const a of Array.from(document.querySelectorAll('a[href^="#"]'))) {
    const id = decodeURIComponent((a.getAttribute("href") ?? "").slice(1));
    if (id && id !== "top" && !document.getElementById(id) && !document.getElementsByName(id).length) anchorsMissing.push(id);
  }
  const suspicious: { token: string; context: string }[] = [];
  const patterns: [RegExp, string][] = [
    [/\[object Object\]/g, "[object Object]"],
    [/(?<![\w-])NaN(?![\w-])/g, "NaN"],
    [/\bInvalid Date\b/g, "Invalid Date"],
    [/(?<![\w-])undefined(?![\w-])/g, "undefined"],
    [/\{\{\s*[\w.]+\s*\}\}/g, "unrendered template"],
    [/\blorem ipsum\b/gi, "lorem ipsum"],
    [/\b(TODO|FIXME|TBD)\b/g, "placeholder"],
  ];
  for (const [re, token] of patterns) {
    for (const m of text.matchAll(re)) {
      const i = m.index ?? 0;
      suspicious.push({ token, context: text.slice(Math.max(0, i - 50), i + m[0].length + 50).replace(/\s+/g, " ").trim() });
      if (suspicious.length > 12) break;
    }
  }
  return {
    title: document.title,
    lang: document.documentElement.getAttribute("lang") ?? "",
    metaDescription: attr('meta[name="description"]', "content"),
    viewportMeta: attr('meta[name="viewport"]', "content"),
    robots: attr('meta[name="robots"]', "content"),
    canonical: attr('link[rel="canonical"]', "href"),
    ogTitle: attr('meta[property="og:title"]', "content"),
    ogImage: attr('meta[property="og:image"]', "content"),
    h1Count: document.querySelectorAll("h1").length,
    headings: Array.from(document.querySelectorAll("h1,h2,h3"))
      .slice(0, 40)
      .map((h) => `${h.tagName.toLowerCase()}: ${(h as HTMLElement).innerText.trim().slice(0, 90)}`),
    links,
    anchorsMissing: [...new Set(anchorsMissing)].slice(0, 20),
    forms: document.forms.length,
    buttons: Array.from(document.querySelectorAll("button,[role=button],input[type=submit]"))
      .slice(0, 40)
      .map((b) => ((b as HTMLElement).innerText || b.getAttribute("aria-label") || (b as HTMLInputElement).value || "").trim().slice(0, 50))
      .filter(Boolean),
    textSample: text.slice(0, 3000),
    suspiciousText: suspicious,
    bodyTextLength: text.trim().length,
  };
}

export interface LayoutAudit {
  horizontalScroll: number;
  overflowOffenders: { selector: string; overflowPx: number; text: string }[];
  smallTargets: { selector: string; w: number; h: number; text: string }[];
  tinyText: { selector: string; size: number; text: string }[];
  obscured: { selector: string; text: string; coveredBy: string }[];
  clipped: { selector: string; text: string }[];
  brokenImages: { selector: string; src: string }[];
  unsizedImages: number;
}

export function auditLayout(opts: { mobile: boolean }): LayoutAudit {
  // Layout-viewport width: on phones Chrome zooms out to fit over-wide content, so innerWidth would grow with the bug.
  const vw = document.documentElement.clientWidth || window.innerWidth;
  const vh = document.documentElement.clientHeight || window.innerHeight;
  const selectorOf = (el: Element): string => {
    if (el.id && /^[A-Za-z][\w-]*$/.test(el.id)) return `#${el.id}`;
    const parts: string[] = [];
    let cur: Element | null = el;
    for (let depth = 0; cur && cur !== document.body && depth < 4; depth++) {
      let part = cur.tagName.toLowerCase();
      const cls = Array.from(cur.classList).filter((c) => /^[A-Za-z][\w-]{1,30}$/.test(c) && !/\d{3,}/.test(c)).slice(0, 2);
      if (cls.length) part += "." + cls.join(".");
      const parent: Element | null = cur.parentElement;
      if (parent) {
        const same = Array.from(parent.children).filter((c) => c.tagName === cur!.tagName);
        if (same.length > 1) part += `:nth-of-type(${same.indexOf(cur) + 1})`;
      }
      parts.unshift(part);
      if (cur.id && /^[A-Za-z][\w-]*$/.test(cur.id)) {
        parts[0] = `#${cur.id}`;
        break;
      }
      cur = parent;
    }
    return parts.join(" > ");
  };
  const isVisible = (el: Element) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0.05;
  };
  const label = (el: Element) =>
    ((el as HTMLElement).innerText || el.getAttribute("aria-label") || el.getAttribute("title") || el.getAttribute("alt") || "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 60);

  const out: LayoutAudit = {
    horizontalScroll: 0,
    overflowOffenders: [],
    smallTargets: [],
    tinyText: [],
    obscured: [],
    clipped: [],
    brokenImages: [],
    unsizedImages: 0,
  };

  // Horizontal overflow: content wider than the layout viewport, unless html/body clip it (overflow-x: hidden).
  const y = window.scrollY;
  window.scrollTo(100_000, y);
  const scrolled = Math.round(window.scrollX);
  window.scrollTo(0, y);
  const clips = (el: Element | null) => !!el && ["hidden", "clip"].includes(getComputedStyle(el).overflowX);
  const contentWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0);
  const overflow = clips(document.documentElement) || clips(document.body) ? 0 : Math.round(contentWidth - vw);
  out.horizontalScroll = Math.max(scrolled, overflow);
  const all = Array.from(document.body?.querySelectorAll("*") ?? []).slice(0, 6000);
  if (out.horizontalScroll > 2) {
    const offenders: { el: Element; over: number }[] = [];
    for (const el of all) {
      const r = el.getBoundingClientRect();
      if (r.right <= vw + 2 || r.width === 0 || !isVisible(el)) continue;
      const pr = el.parentElement?.getBoundingClientRect();
      if (pr && pr.right > vw + 2) continue; // parent already overflows; report the outermost cause
      offenders.push({ el, over: Math.round(r.right - vw) });
    }
    offenders.sort((a, b) => b.over - a.over);
    out.overflowOffenders = offenders.slice(0, 5).map((o) => ({ selector: selectorOf(o.el), overflowPx: o.over, text: label(o.el) }));
  }

  const interactive = Array.from(
    document.querySelectorAll(
      'a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=link], [role=checkbox], [role=tab], [role=switch], [onclick]',
    ),
  ).filter(isVisible);

  if (opts.mobile) {
    for (const el of interactive) {
      const r = el.getBoundingClientRect();
      if (r.width >= 24 && r.height >= 24) continue;
      if (el.tagName === "A" && getComputedStyle(el).display === "inline") continue; // inline text links are exempt (WCAG 2.5.8)
      const t = (el as HTMLInputElement).type;
      if (t === "checkbox" || t === "radio") {
        const lbl = (el as HTMLInputElement).labels?.[0];
        if (lbl && isVisible(lbl)) continue; // the label extends the hit area
      }
      out.smallTargets.push({ selector: selectorOf(el), w: Math.round(r.width), h: Math.round(r.height), text: label(el) });
      if (out.smallTargets.length >= 15) break;
    }

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set<Element>();
    let node: Node | null;
    while ((node = walker.nextNode()) && out.tinyText.length < 10) {
      const el = node.parentElement;
      if (!el || seen.has(el) || !node.textContent?.trim() || node.textContent.trim().length < 3) continue;
      seen.add(el);
      if (["SCRIPT", "STYLE", "NOSCRIPT", "SUP", "SUB"].includes(el.tagName) || !isVisible(el)) continue;
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size < 12) out.tinyText.push({ selector: selectorOf(el), size, text: node.textContent.trim().slice(0, 50) });
    }
  }

  for (const el of interactive) {
    const r = el.getBoundingClientRect();
    if (r.top < 0 || r.left < 0 || r.bottom > vh || r.right > vw || r.width < 8 || r.height < 8) continue;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const hit = document.elementFromPoint(cx, cy);
    if (!hit || hit === el || el.contains(hit) || hit.contains(el)) continue;
    // Framework dev overlays (Next.js indicator, Vite/webpack error overlays) aren't part of the app.
    if (hit.closest("nextjs-portal, vite-error-overlay, #webpack-dev-server-client-overlay, [data-nextjs-toast]")) continue;
    const lbl = (el as HTMLInputElement).labels?.[0];
    if (lbl && (lbl === hit || lbl.contains(hit))) continue;
    out.obscured.push({ selector: selectorOf(el), text: label(el), coveredBy: selectorOf(hit) });
    if (out.obscured.length >= 10) break;
  }

  for (const el of all) {
    if (out.clipped.length >= 8) break;
    const he = el as HTMLElement;
    if (he.scrollWidth <= he.clientWidth + 1 || he.clientWidth === 0) continue;
    const cs = getComputedStyle(he);
    if (!["hidden", "clip"].includes(cs.overflowX) || cs.textOverflow === "ellipsis") continue;
    const ownText = Array.from(he.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? "").trim().length > 2);
    if (!ownText || !isVisible(he)) continue;
    out.clipped.push({ selector: selectorOf(he), text: he.innerText.trim().slice(0, 60) });
  }

  for (const img of Array.from(document.images)) {
    if (!img.getAttribute("src") && !img.srcset) continue;
    if (img.complete && img.naturalWidth === 0 && img.loading !== "lazy") {
      out.brokenImages.push({ selector: selectorOf(img), src: img.currentSrc || img.src });
      if (out.brokenImages.length >= 10) break;
    }
  }
  out.unsizedImages = Array.from(document.images).filter((i) => !i.getAttribute("width") && !i.getAttribute("height") && !i.style.aspectRatio).length;
  return out;
}

export interface PerfSnapshot {
  ttfbMs?: number;
  domContentLoadedMs?: number;
  loadMs?: number;
  lcpMs?: number;
  cls?: number;
  totalBlockingMs?: number;
  requestCount: number;
  transferKb: number;
  jsKb: number;
  largest: { url: string; kb: number; type: string }[];
}

export function perfSnapshot(): PerfSnapshot {
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  const res = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
  const size = (r: PerformanceResourceTiming) => r.transferSize || r.encodedBodySize || 0;
  const q = (window as unknown as { __qabot?: { lcp: number; cls: number; tbt: number } }).__qabot;
  const total = res.reduce((s, r) => s + size(r), nav ? size(nav as unknown as PerformanceResourceTiming) : 0);
  const js = res.filter((r) => r.initiatorType === "script" || /\.m?js(\?|$)/.test(r.name)).reduce((s, r) => s + size(r), 0);
  return {
    ttfbMs: nav ? Math.round(nav.responseStart - nav.startTime) : undefined,
    domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd - nav.startTime) : undefined,
    loadMs: nav && nav.loadEventEnd > 0 ? Math.round(nav.loadEventEnd - nav.startTime) : undefined,
    lcpMs: q?.lcp ? Math.round(q.lcp) : undefined,
    cls: q ? Math.round(q.cls * 1000) / 1000 : undefined,
    totalBlockingMs: q ? Math.round(q.tbt) : undefined,
    requestCount: res.length + 1,
    transferKb: Math.round(total / 1024),
    jsKb: Math.round(js / 1024),
    largest: res
      .map((r) => ({ url: r.name, kb: Math.round(size(r) / 1024), type: r.initiatorType }))
      .filter((r) => r.kb >= 300)
      .sort((a, b) => b.kb - a.kb)
      .slice(0, 5),
  };
}

export interface FocusProbe {
  selector: string;
  text: string;
  tag: string;
  visible: boolean;
  indicator: boolean;
  isBody: boolean;
}

/** Inspect document.activeElement after a Tab press: is it visible, and does focus change how it looks? */
export function probeFocus(): FocusProbe {
  const el = document.activeElement as HTMLElement | null;
  if (!el || el === document.body || el === document.documentElement) {
    return { selector: "body", text: "", tag: "body", visible: true, indicator: true, isBody: true };
  }
  const selectorOf = (e: Element): string => {
    if (e.id && /^[A-Za-z][\w-]*$/.test(e.id)) return `#${e.id}`;
    const parts: string[] = [];
    let cur: Element | null = e;
    for (let d = 0; cur && cur !== document.body && d < 4; d++) {
      let p = cur.tagName.toLowerCase();
      const cls = Array.from(cur.classList).filter((c) => /^[A-Za-z][\w-]{1,30}$/.test(c)).slice(0, 2);
      if (cls.length) p += "." + cls.join(".");
      parts.unshift(p);
      cur = cur.parentElement;
    }
    return parts.join(" > ");
  };
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  const visible =
    r.width >= 1 && r.height >= 1 && cs.visibility !== "hidden" && Number(cs.opacity) > 0.05 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
  const snap = (s: CSSStyleDeclaration) =>
    [s.outlineStyle, s.outlineWidth, s.outlineColor, s.boxShadow, s.borderColor, s.backgroundColor, s.color, s.textDecorationLine].join("|");
  const focused = snap(getComputedStyle(el));
  const hasOutline = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0;
  el.blur();
  const blurred = snap(getComputedStyle(el));
  el.focus({ preventScroll: true });
  return {
    selector: selectorOf(el),
    text: (el.innerText || el.getAttribute("aria-label") || (el as HTMLInputElement).placeholder || "").trim().slice(0, 50),
    tag: el.tagName.toLowerCase(),
    visible,
    indicator: hasOutline || focused !== blurred,
    isBody: false,
  };
}

export interface ClickCandidate {
  id: string;
  text: string;
  selector: string;
}

/** Tag safe-to-click controls (toggles, tabs, menus) with data-qabot-click ids. */
export function tagClickCandidates(opts: { max: number; allowRisky: boolean }): ClickCandidate[] {
  const risky = /(delete|remove|destroy|erase|reset|clear all|log ?out|sign ?out|unsubscribe|cancel (my )?(account|subscription)|pay|purchase|buy|checkout|order|submit|send|confirm|approve|reject|publish|archive|deactivate)/i;
  const nodes = Array.from(
    document.querySelectorAll('button:not([disabled]), [role=button], [role=tab], summary, [aria-haspopup], [aria-expanded]'),
  );
  const out: ClickCandidate[] = [];
  let n = 0;
  for (const el of nodes) {
    if (out.length >= opts.max) break;
    const he = el as HTMLElement;
    const r = he.getBoundingClientRect();
    const cs = getComputedStyle(he);
    if (r.width < 4 || r.height < 4 || cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) < 0.05) continue;
    if (he.tagName === "A") continue;
    const type = (he as HTMLButtonElement).type;
    if (he.tagName === "BUTTON" && type === "submit" && he.closest("form")) continue;
    const text = (he.innerText || he.getAttribute("aria-label") || he.getAttribute("title") || "").trim().replace(/\s+/g, " ").slice(0, 60);
    if (!opts.allowRisky && risky.test(text)) continue;
    const id = `q${n++}`;
    he.setAttribute("data-qabot-click", id);
    out.push({ id, text: text || `<${he.tagName.toLowerCase()}>`, selector: he.tagName.toLowerCase() + (he.id ? `#${he.id}` : "") });
  }
  return out;
}

export interface FormInfo {
  index: number;
  action: string;
  method: string;
  fields: number;
  required: number;
  submitText: string;
}

export function listForms(): FormInfo[] {
  return Array.from(document.forms)
    .filter((f) => {
      const r = f.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    })
    .slice(0, 3)
    .map((f) => {
      const index = Array.from(document.forms).indexOf(f);
      const submit = f.querySelector('button[type=submit], input[type=submit], button:not([type])') as HTMLElement | null;
      return {
        index,
        action: f.getAttribute("action") ?? "",
        method: (f.getAttribute("method") ?? "get").toLowerCase(),
        fields: f.querySelectorAll("input:not([type=hidden]), select, textarea").length,
        required: f.querySelectorAll("[required], [aria-required=true]").length,
        submitText: (submit?.innerText || (submit as HTMLInputElement | null)?.value || "").trim().slice(0, 40),
      };
    });
}

export function validationSignals(): { invalid: number; ariaInvalid: number; alerts: string[] } {
  const alerts = Array.from(document.querySelectorAll('[role=alert], [aria-live], .error, .errors, .invalid-feedback, [class*="error" i]'))
    .map((e) => (e as HTMLElement).innerText?.trim())
    .filter((t): t is string => !!t && t.length < 200)
    .slice(0, 5);
  return {
    invalid: document.querySelectorAll(":invalid").length,
    ariaInvalid: document.querySelectorAll('[aria-invalid="true"]').length,
    alerts,
  };
}

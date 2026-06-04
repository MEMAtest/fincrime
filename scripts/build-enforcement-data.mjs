/**
 * Offline data-prep: pulls real FCA financial-crime enforcement cases from the
 * fines DB (regactions / fcafines) and writes the committed, citable datasets
 *   data/enforcement/cases.ts
 *   data/enforcement/benchmarks.ts
 *
 * Run:  FCA_FINES_DB_URL="postgresql://<readonly-user>:<pw>@<host>:5432/fcafines?sslmode=no-verify" \
 *         node scripts/build-enforcement-data.mjs
 *
 * No runtime DB dependency — the app only reads the generated .ts files.
 * The DB connection string is never committed; pass it via the env var.
 */
import pg from "pg";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "data", "enforcement");

const url = process.env.FCA_FINES_DB_URL;
if (!url) {
  console.error("Set FCA_FINES_DB_URL (read-only). Aborting.");
  process.exit(1);
}

// ── mapping helpers ───────────────────────────────────────────────────────
const FIRM_CATEGORY_MAP = {
  Banking: ["bank"],
  Investment: ["wealth_manager"],
  Insurance: ["insurance"],
  Payments: ["pi", "emi"],
};

function themesFor(text) {
  const t = (text || "").toLowerCase();
  const themes = new Set();
  if (/money launder|anti-money|money laundering regulations|\baml\b/.test(t)) themes.add("money_laundering");
  if (/sanction/.test(t)) themes.add("sanctions_evasion");
  if (/terrorist|terrorism financing/.test(t)) themes.add("terrorist_financing");
  if (/proliferation/.test(t)) themes.add("proliferation_financing");
  if (/fraud/.test(t)) themes.add("fraud");
  if (/bribery|corruption/.test(t)) themes.add("bribery_corruption");
  if (/tax evasion|tax-evasion/.test(t)) themes.add("tax_evasion");
  return [...themes];
}

function fmtFine(amount, currency) {
  if (amount == null) return "Undisclosed";
  const a = Number(amount);
  const sym = currency === "GBP" || !currency ? "£" : currency + " ";
  if (a >= 1_000_000) return `${sym}${(a / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}m`;
  if (a >= 1_000) return `${sym}${Math.round(a / 1_000)}k`;
  return `${sym}${a}`;
}

function tidy(s, max = 240) {
  if (!s) return "";
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max - 1).trimEnd() + "…" : clean;
}

function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

const json = (v) => JSON.stringify(v);

// ── run ───────────────────────────────────────────────────────────────────
const pool = new pg.Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

// Unwrap breach_categories (mostly stored double-encoded as a JSON string)
const BREACH_CATS = `CASE WHEN jsonb_typeof(breach_categories) = 'string'
  THEN (breach_categories #>> '{}')::jsonb ELSE breach_categories END`;

const SQL = `
  SELECT firm_individual, regulator, year_issued, amount, currency,
         breach_type, firm_category, final_notice_url,
         COALESCE(NULLIF(ai_summary,''), summary) AS summary,
         COALESCE(${BREACH_CATS}, '[]'::jsonb) AS cats
  FROM fca_fines
  WHERE year_issued IS NOT NULL
    AND (
      breach_type IN ('AML','FRAUD')
      OR summary ILIKE '%money launder%' OR summary ILIKE '%financial crime%'
      OR summary ILIKE '%sanction%' OR summary ILIKE '%terrorist%'
      OR summary ILIKE '%proliferation%'
      OR ai_summary ILIKE '%money launder%' OR ai_summary ILIKE '%financial crime%'
      OR ai_summary ILIKE '%sanction%'
    )
  ORDER BY amount DESC NULLS LAST
`;

try {
  const { rows } = await pool.query(SQL);
  const cases = [];
  for (const r of rows) {
    const cats = Array.isArray(r.cats) ? r.cats.map(String) : [];
    const themes = themesFor(`${r.breach_type} ${r.summary} ${cats.join(" ")}`);
    if (!themes.length) continue; // keep only clearly financial-crime cases
    cases.push({
      firm: r.firm_individual,
      regulator: r.regulator || "FCA",
      year: r.year_issued,
      fine: fmtFine(r.amount, r.currency),
      amountGbp: r.amount == null ? 0 : Math.round(Number(r.amount)),
      breachType: r.breach_type || null,
      breachCategories: cats,
      riskThemes: themes,
      firmTypes: FIRM_CATEGORY_MAP[r.firm_category] || [],
      summary: tidy(r.summary),
      sourceUrl: r.final_notice_url || null,
    });
  }

  // ── benchmarks ──
  const byRiskTheme = {};
  const byYear = {};
  const byFirmCat = {};
  const byBreachCat = {};
  for (const c of cases) {
    for (const th of c.riskThemes) byRiskTheme[th] = (byRiskTheme[th] || 0) + 1;
    byYear[c.year] = byYear[c.year] || { count: 0, totalGbp: 0 };
    byYear[c.year].count++;
    byYear[c.year].totalGbp += c.amountGbp;
    for (const bc of c.breachCategories) byBreachCat[bc] = (byBreachCat[bc] || 0) + 1;
  }
  // firm category from raw rows (incl. uncategorised excluded cases would skew; use cases only)
  for (const c of cases) {
    const label = c.firmTypes.length ? c.firmTypes.join("/") : "Unclassified";
    byFirmCat[label] = (byFirmCat[label] || 0) + 1;
  }
  const amounts = cases.map((c) => c.amountGbp).filter((a) => a > 0);
  const maxCase = cases.reduce((m, c) => (c.amountGbp > (m?.amountGbp || 0) ? c : m), null);

  const benchmarks = {
    generatedAt: new Date().toISOString().slice(0, 10),
    source: "FCA fines dataset (regactions.com / fcafines)",
    totalCases: cases.length,
    byRiskTheme: Object.entries(byRiskTheme)
      .map(([theme, count]) => ({ theme, count }))
      .sort((a, b) => b.count - a.count),
    byYear: Object.entries(byYear)
      .map(([year, v]) => ({ year: Number(year), count: v.count, totalGbp: v.totalGbp }))
      .sort((a, b) => a.year - b.year),
    byFirmCategory: Object.entries(byFirmCat)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
    topBreachCategories: Object.entries(byBreachCat)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12),
    fineStats: {
      totalGbp: amounts.reduce((s, a) => s + a, 0),
      medianGbp: median(amounts),
      maxGbp: maxCase?.amountGbp || 0,
      maxFirm: maxCase?.firm || "",
    },
  };

  const header = `// AUTO-GENERATED by scripts/build-enforcement-data.mjs — do not hand-edit.\n// Source: ${benchmarks.source}. Pulled: ${benchmarks.generatedAt}.\n`;

  writeFileSync(
    join(OUT_DIR, "cases.ts"),
    `${header}import type { EnforcementCase } from "./types";\n\nexport const enforcementCases: EnforcementCase[] = ${json(cases)};\n`
  );
  writeFileSync(
    join(OUT_DIR, "benchmarks.ts"),
    `${header}import type { EnforcementBenchmarks } from "./types";\n\nexport const enforcementBenchmarks: EnforcementBenchmarks = ${json(benchmarks)};\n`
  );

  console.log(`Wrote ${cases.length} cases. Max: ${maxCase?.firm} ${fmtFine(maxCase?.amountGbp)}.`);
  console.log("Themes:", benchmarks.byRiskTheme.map((t) => `${t.theme}:${t.count}`).join(" "));
} catch (e) {
  console.error("FAILED:", e.message);
  process.exit(1);
} finally {
  await pool.end().catch(() => {});
}

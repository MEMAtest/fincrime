export type Severity = "critical" | "high" | "medium" | "low" | "info";

export const SEVERITIES: Severity[] = ["critical", "high", "medium", "low", "info"];

export type Category =
  | "functional"
  | "accessibility"
  | "ux"
  | "visual"
  | "responsive"
  | "performance"
  | "security"
  | "seo"
  | "content"
  | "backend"
  | "code";

export const CATEGORY_LABELS: Record<Category, string> = {
  functional: "Functional",
  accessibility: "Accessibility",
  ux: "UX",
  visual: "Visual",
  responsive: "Responsive",
  performance: "Performance",
  security: "Security",
  seo: "SEO",
  content: "Content",
  backend: "Backend / API",
  code: "Code health",
};

export type FindingSource = "browser" | "crawler" | "api" | "code" | "server-log" | "ai-ux" | "ai-explorer";

export type ViewportName = "desktop" | "tablet" | "mobile";

export interface Occurrence {
  url?: string;
  viewport?: ViewportName | string;
  selector?: string;
  detail?: string;
  /** Path relative to the report directory. */
  screenshot?: string;
}

export interface Finding {
  /** Stable fingerprint, the same across runs for the same issue. */
  id: string;
  ruleId: string;
  title: string;
  severity: Severity;
  category: Category;
  description: string;
  recommendation?: string;
  source: FindingSource;
  occurrences: Occurrence[];
  /** Source files most likely responsible (repo-relative). */
  files?: string[];
  steps?: string[];
  tags?: string[];
  /** Set by AI triage when it thinks the finding is noise. */
  aiNote?: string;
}

export interface PerfMetrics {
  ttfbMs?: number;
  domContentLoadedMs?: number;
  loadMs?: number;
  lcpMs?: number;
  cls?: number;
  totalBlockingMs?: number;
  requestCount?: number;
  transferKb?: number;
  jsKb?: number;
}

export interface PageVisit {
  url: string;
  path: string;
  viewport: ViewportName;
  status?: number;
  title?: string;
  durationMs: number;
  screenshot?: string;
  fullScreenshot?: string;
  metrics?: PerfMetrics;
  consoleErrors: number;
  failedRequests: number;
  sourceFile?: string;
  error?: string;
}

export interface ApiProbeResult {
  method: string;
  path: string;
  probe: string;
  status?: number;
  durationMs?: number;
  verdict: "ok" | "auth" | "bug" | "warn" | "skipped" | "error";
  note?: string;
  sourceFile?: string;
}

export interface CodeCheckResult {
  name: string;
  command: string;
  status: "pass" | "fail" | "skipped" | "error";
  durationMs: number;
  outputTail?: string;
}

export interface ExplorerStep {
  turn: number;
  kind: "action" | "note" | "issue" | "system";
  text: string;
  screenshot?: string;
}

export interface AiSummary {
  model: string;
  executiveSummary?: string;
  releaseRecommendation?: "ship" | "ship_with_fixes" | "block";
  topPriorities?: {
    title: string;
    whyItMatters: string;
    findingIds: string[];
    suggestedFix: string;
    likelyFiles: string[];
  }[];
  missingCoverage?: string[];
  uxScores?: { url: string; score: number; purpose: string; strengths: string[] }[];
  explorer?: { summary?: string; journeysCovered?: string[]; coverageGaps?: string[]; steps: ExplorerStep[] };
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; requests: number };
  errors: string[];
}

export interface StackInfo {
  kind: "node" | "python" | "static" | "unknown";
  framework: string;
  packageManager?: "npm" | "pnpm" | "yarn" | "bun";
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  hasTypeScript: boolean;
  staticRoot?: string;
}

export interface RouteInfo {
  path: string;
  file?: string;
  dynamic?: boolean;
  source: "code" | "config" | "sitemap" | "crawl" | "start";
}

export interface EndpointSpec {
  method: string;
  path: string;
  file?: string;
  dynamic?: boolean;
  source: "code" | "openapi" | "config" | "network";
}

export interface RunReport {
  tool: { name: string; version: string };
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  target: {
    input: string;
    kind: "url" | "repo";
    baseUrl: string;
    repoPath?: string;
    stack?: StackInfo;
    launched: boolean;
    mode?: "dev" | "prod";
  };
  settings: {
    viewports: ViewportName[];
    maxPages: number;
    allowMutations: boolean;
    ai: boolean;
  };
  routes: RouteInfo[];
  skippedRoutes: RouteInfo[];
  pages: PageVisit[];
  api: ApiProbeResult[];
  code: CodeCheckResult[];
  findings: Finding[];
  scores: { overall: number; byCategory: Partial<Record<Category, number>> };
  verdict: "pass" | "warn" | "fail";
  ai?: AiSummary;
  warnings: string[];
}

/**
 * The lab is one workflow, not ten apps. This is the single source of truth for
 * the four-stage journey (Profile -> Risks & enforcement -> Build controls ->
 * Govern & export). The persistent WorkflowBar, the /start journey page, the
 * homepage strip and the footer grouping all read from here. Framework-agnostic
 * (no React) so server and client components can import it.
 */

export interface WorkflowStage {
  id: string;
  n: number;
  label: string;
  /** Compact label for the workflow bar. */
  short: string;
  blurb: string;
  /** Top-level routes that belong to this stage (sub-paths match by prefix). */
  routes: string[];
  /** Where the stage chip / "go to stage" link points. */
  primary: string;
}

export const STAGES: WorkflowStage[] = [
  {
    id: "profile",
    n: 1,
    label: "Profile",
    short: "Profile",
    blurb: "Who you are: firm type, products and customers.",
    routes: ["/firm-research", "/firm-profiles"],
    primary: "/firm-research",
  },
  {
    id: "risks",
    n: 2,
    label: "Risks & enforcement",
    short: "Risks",
    blurb: "What applies to you, and what firms like you got fined for.",
    routes: ["/typology-iq", "/enforcement"],
    primary: "/typology-iq",
  },
  {
    id: "build",
    n: 3,
    label: "Build controls",
    short: "Build",
    blurb: "Adapt controls to your firm and assemble a register.",
    routes: ["/control-builder", "/controls", "/screening-control-designer"],
    primary: "/control-builder",
  },
  {
    id: "govern",
    n: 4,
    label: "Govern & export",
    short: "Govern",
    blurb: "Coverage, KYC, partners, maturity and your committee pack.",
    routes: ["/kyc-requirements", "/partner-control-map", "/controls-maturity"],
    primary: "/kyc-requirements",
  },
];

/** Routes where the workflow bar must NOT appear (marketing / reference). */
const NON_WORKFLOW = new Set(["/", "/start", "/glossary", "/methodology"]);

/** Match a pathname to a route at segment boundaries (so /controls != /controls-maturity). */
function inRoute(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(route + "/");
}

/** The stage a pathname belongs to, or null for non-workflow routes. */
export function stageForPath(pathname: string): WorkflowStage | null {
  if (NON_WORKFLOW.has(pathname)) return null;
  for (const stage of STAGES) {
    if (stage.routes.some((r) => inRoute(pathname, r))) return stage;
  }
  return null;
}

/** The stage after this one (null if it is the last). */
export function nextStage(stage: WorkflowStage): WorkflowStage | null {
  return STAGES.find((s) => s.n === stage.n + 1) ?? null;
}

export interface Persona {
  id: string;
  label: string;
  blurb: string;
  /** Where this persona starts the journey. */
  entryHref: string;
  ctaLabel: string;
  /** Stage ids this persona's path emphasises. */
  pathStageIds: string[];
  /** Whether the card surfaces the "talk to MEMA" angle. */
  memaAngle?: boolean;
}

export const PERSONAS: Persona[] = [
  {
    id: "mlro",
    label: "In-house MLRO / financial crime team",
    blurb:
      "Design and defend your firm's control programme, then export a committee-ready pack.",
    entryHref: "/firm-research",
    ctaLabel: "Profile your firm",
    pathStageIds: ["profile", "risks", "build", "govern"],
  },
  {
    id: "consultant",
    label: "Consultant / advisory / law firm",
    blurb:
      "Scope a client's financial crime risk and controls fast, and produce a defensible starting pack.",
    entryHref: "/firm-research",
    ctaLabel: "Scope a firm",
    pathStageIds: ["profile", "risks", "build", "govern"],
    memaAngle: true,
  },
  {
    id: "fintech",
    label: "New fintech / product team",
    blurb:
      "Building a neobank, EMI or PI? Start from your business model and get the controls you need.",
    entryHref: "/firm-profiles",
    ctaLabel: "Pick your firm type",
    pathStageIds: ["profile", "risks", "build"],
  },
  {
    id: "interview",
    label: "Interview prep / learning",
    blurb:
      "Study real firm risks, the typologies behind them and the enforcement cases that prove the point.",
    entryHref: "/firm-profiles",
    ctaLabel: "Start studying",
    pathStageIds: ["profile", "risks"],
  },
];

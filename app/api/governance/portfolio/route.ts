import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { loadGovernancePortfolio } from "@/lib/governance/load";

/**
 * GET /api/governance/portfolio - the portfolio-level roll-up across every
 * workstream, for the Governance Dashboard. One efficient pass: each
 * workstream's list is fetched exactly once (no per-row detail fetch), via
 * lib/governance/load.ts's loadGovernancePortfolio, which is shared with the
 * governance_pack branch of /api/export/pdf so the dashboard and the pack
 * can never disagree. The arithmetic itself lives in
 * lib/governance/portfolio.ts (pure, unit tested); this route is purely
 * auth + fetch + respond.
 *
 * No query params are accepted currently - the dashboard always renders the
 * full portfolio. An unknown query param is rejected (400) rather than
 * silently ignored.
 */
export const GET = withWorkspace(async (request, workspace) => {
  const { searchParams } = new URL(request.url);
  for (const key of searchParams.keys()) {
    return NextResponse.json({ error: `Unknown query parameter: ${key}` }, { status: 400 });
  }

  try {
    const portfolio = await loadGovernancePortfolio(workspace.id);
    return NextResponse.json({ portfolio, generatedAt: new Date().toISOString() });
  } catch (error) {
    console.error("Governance portfolio error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

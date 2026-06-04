import { NextRequest, NextResponse } from "next/server";
import { scoreMaturity } from "@/data/scoring/maturity-scoring";
import type { ControlArea, MaturityLevel } from "@/data/maturity/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { area, currentLevel, targetLevel } = body as {
      area: ControlArea;
      currentLevel: MaturityLevel;
      targetLevel: MaturityLevel;
    };

    if (!area || !currentLevel || !targetLevel) {
      return NextResponse.json(
        { error: "Missing required fields: area, currentLevel, targetLevel" },
        { status: 400 }
      );
    }

    const result = scoreMaturity({ area, currentLevel, targetLevel });
    if (!result) {
      return NextResponse.json({ error: "No matching framework" }, { status: 404 });
    }

    try {
      const { query } = await import("@/lib/db");
      await query(
        `INSERT INTO assessments (module, answers, results, risk_score, session_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          "controls_maturity",
          JSON.stringify({ area, currentLevel, targetLevel }),
          JSON.stringify({ slug: result.framework.slug, gapScore: result.gapScore }),
          result.currentScore,
          body.sessionId || null,
        ]
      );
    } catch {
      // DB write is non-critical
    }

    return NextResponse.json({
      framework: { slug: result.framework.slug, title: result.framework.title },
      currentLevel: result.currentLevel,
      targetLevel: result.targetLevel,
      currentScore: result.currentScore,
      targetScore: result.targetScore,
      gapScore: result.gapScore,
      gapLevels: result.gapLevels,
      remediation: result.remediation,
    });
  } catch (error) {
    console.error("Maturity assess error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

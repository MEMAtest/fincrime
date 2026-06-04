import { NextRequest, NextResponse } from "next/server";
import { getBestScreeningMatch, getTopScreeningMatches } from "@/data/scoring/screening-scoring";
import type { ScreeningCategory, ScreeningTrigger } from "@/data/screening/types";
import type { FirmType } from "@/data/typologies/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { firmType, category, trigger } = body as {
      firmType: FirmType;
      category: ScreeningCategory;
      trigger: ScreeningTrigger;
    };

    if (!firmType || !category || !trigger) {
      return NextResponse.json(
        { error: "Missing required fields: firmType, category, trigger" },
        { status: 400 }
      );
    }

    const answers = { firmType, category, trigger };
    const bestMatch = getBestScreeningMatch(answers);
    const topMatches = getTopScreeningMatches(answers, 3);

    try {
      const { query } = await import("@/lib/db");
      await query(
        `INSERT INTO assessments (module, answers, results, risk_score, session_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          "screening_controls",
          JSON.stringify(answers),
          JSON.stringify({ bestMatch: bestMatch.control.slug, score: bestMatch.score }),
          bestMatch.score,
          body.sessionId || null,
        ]
      );
    } catch {
      // DB write is non-critical
    }

    return NextResponse.json({
      bestMatch: {
        control: bestMatch.control,
        score: bestMatch.score,
        breakdown: bestMatch.breakdown,
      },
      otherMatches: topMatches.slice(1).map((m) => ({
        slug: m.control.slug,
        title: m.control.title,
        score: m.score,
      })),
    });
  } catch (error) {
    console.error("Screening assess error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

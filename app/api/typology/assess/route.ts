import { NextRequest, NextResponse } from "next/server";
import { getBestMatch, getTopMatches } from "@/data/scoring/typology-scoring";
import type { FirmType, ProductType, CustomerType, RiskTheme } from "@/data/typologies/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { firmType, product, customerType, riskThemes, riskTheme } = body as {
      firmType: FirmType;
      product: ProductType;
      customerType: CustomerType;
      riskThemes?: RiskTheme[];
      riskTheme?: RiskTheme;
    };

    const themes: RiskTheme[] = riskThemes && riskThemes.length > 0
      ? riskThemes
      : riskTheme
      ? [riskTheme]
      : [];

    if (!firmType || !product || !customerType || themes.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields: firmType, product, customerType, riskThemes" },
        { status: 400 }
      );
    }

    const answers = { firmType, product, customerType, riskThemes: themes };
    const bestMatch = getBestMatch(answers);
    const topMatches = getTopMatches(answers, 3);

    // Optionally persist to DB (non-blocking)
    try {
      const { query } = await import("@/lib/db");
      await query(
        `INSERT INTO assessments (module, answers, results, risk_score, typology_id, session_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          "typology_iq",
          JSON.stringify(answers),
          JSON.stringify({ bestMatch: bestMatch.typology.slug, score: bestMatch.score }),
          bestMatch.score,
          bestMatch.typology.id,
          body.sessionId || null,
        ]
      );
    } catch {
      // DB write is non-critical
    }

    return NextResponse.json({
      bestMatch: {
        typology: bestMatch.typology,
        score: bestMatch.score,
        breakdown: bestMatch.breakdown,
      },
      otherMatches: topMatches.slice(1).map((m) => ({
        slug: m.typology.slug,
        title: m.typology.title,
        score: m.score,
      })),
    });
  } catch (error) {
    console.error("Typology assess error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

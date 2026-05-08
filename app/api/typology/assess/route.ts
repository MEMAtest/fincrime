import { NextRequest, NextResponse } from "next/server";
import { getBestMatch, getTopMatches } from "@/data/scoring/typology-scoring";
import type { FirmType, ProductType, CustomerType, RiskTheme } from "@/data/typologies/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { firmType, product, customerType, riskTheme } = body as {
      firmType: FirmType;
      product: ProductType;
      customerType: CustomerType;
      riskTheme: RiskTheme;
    };

    if (!firmType || !product || !customerType || !riskTheme) {
      return NextResponse.json(
        { error: "Missing required fields: firmType, product, customerType, riskTheme" },
        { status: 400 }
      );
    }

    const bestMatch = getBestMatch({ firmType, product, customerType, riskTheme });
    const topMatches = getTopMatches({ firmType, product, customerType, riskTheme }, 3);

    // Optionally persist to DB (non-blocking)
    try {
      const { query } = await import("@/lib/db");
      await query(
        `INSERT INTO assessments (module, answers, results, risk_score, typology_id, session_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          "typology_iq",
          JSON.stringify({ firmType, product, customerType, riskTheme }),
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

import { NextRequest, NextResponse } from "next/server";
import { scorePartnerRisk } from "@/data/scoring/partner-scoring";
import type { ModelType, FlowType, Actor, ControlOwnership } from "@/data/partner-flows/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { modelType, flowType, actors, controlOverrides, dataReceived } = body as {
      modelType: ModelType;
      flowType: FlowType;
      actors: Actor[];
      controlOverrides: Record<string, ControlOwnership>;
      dataReceived: string[];
    };

    if (!modelType || !flowType) {
      return NextResponse.json(
        { error: "Missing required fields: modelType, flowType" },
        { status: 400 }
      );
    }

    const result = scorePartnerRisk({
      modelType,
      flowType,
      actors: actors || [],
      controlOverrides: controlOverrides || {},
      dataReceived: dataReceived || [],
    });

    if (!result) {
      return NextResponse.json({ error: "No matching flow found" }, { status: 404 });
    }

    // Optionally persist to DB
    try {
      const { query } = await import("@/lib/db");
      await query(
        `INSERT INTO assessments (module, answers, results, risk_score, risk_rating, partner_flow_id, session_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          "partner_control_map",
          JSON.stringify({ modelType, flowType, actors, controlOverrides, dataReceived }),
          JSON.stringify({
            flowSlug: result.flow.slug,
            riskScore: result.riskScore,
            riskRating: result.riskRating,
            controlSummary: result.controlSummary,
          }),
          result.riskScore,
          result.riskRating,
          result.flow.id,
          body.sessionId || null,
        ]
      );
    } catch {
      // DB write is non-critical
    }

    return NextResponse.json({
      flow: {
        slug: result.flow.slug,
        title: result.flow.title,
        description: result.flow.description,
      },
      riskScore: result.riskScore,
      riskRating: result.riskRating,
      gapControls: result.gapControls,
      missingDataFields: result.missingDataFields,
      controlSummary: result.controlSummary,
    });
  } catch (error) {
    console.error("Partner assess error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

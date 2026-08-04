import { NextRequest, NextResponse } from "next/server";
import { generateNarrative } from "@/lib/groq";

interface TopRisk {
  title?: string;
  inherentScore?: number | null;
  residualScore?: number | null;
}

interface OpLoadTotals {
  alertsPerMonth?: number;
  analystHoursPerMonth?: number;
  fte?: number;
  monthlyCostGbp?: number;
}

/**
 * POST /api/pra/narrative - a Groq-generated committee-style summary for the
 * PRA committee pack (Step 8). Mirrors app/api/typology/narrative/route.ts's
 * shape exactly: no workspace auth, 400 on the one required field, and a
 * graceful { narrative: null } (200) on any generation failure so the pack
 * still renders without a key configured.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productName, productDescription, customers, jurisdictions, topRisks, appetiteResult, gapCount, opLoad } = body;

    if (!productName) {
      return NextResponse.json({ error: "Missing productName" }, { status: 400 });
    }

    const risks: TopRisk[] = Array.isArray(topRisks) ? topRisks : [];
    const load: OpLoadTotals = opLoad && typeof opLoad === "object" ? opLoad : {};

    const systemPrompt = [
      "You are a financial crime compliance expert writing a committee-pack summary for a UK-regulated firm's risk committee.",
      "Write a concise 3-5 sentence plain-English summary of this product risk assessment: what the product is, the headline risks and how residual risk compares to inherent risk, whether it sits within, tolerated by, or outside the firm's risk appetite, and the operational load implied by the controls in place.",
      "Be practical and specific, referencing the figures given. Do not invent facts not present in the input.",
      "Do not use bullet points, headings, or markdown formatting.",
      "Do not provide legal advice. Use UK English. Do not use em-dashes.",
    ].join(" ");

    const riskLines = risks
      .slice(0, 5)
      .map(
        (r) =>
          `${r.title ?? "Untitled risk"}: inherent ${r.inherentScore ?? "n/a"}, residual ${r.residualScore ?? "n/a"}`
      )
      .join("; ");

    const userPrompt = [
      `Product: ${productName}`,
      productDescription ? `Description: ${productDescription}` : "",
      Array.isArray(customers) && customers.length ? `Customers: ${customers.join(", ")}` : "",
      Array.isArray(jurisdictions) && jurisdictions.length ? `Jurisdictions: ${jurisdictions.join(", ")}` : "",
      `Top risks (inherent -> residual): ${riskLines || "none scored yet"}`,
      `Appetite result: ${appetiteResult ?? "not yet assessed"}`,
      `Coverage gaps: ${gapCount ?? 0}`,
      `Operational load: ${load.alertsPerMonth ?? 0} alerts/month, ${load.analystHoursPerMonth ?? 0} analyst hours/month, ${load.fte ?? 0} FTE, GBP ${load.monthlyCostGbp ?? 0}/month`,
      "",
      "Write the committee-pack risk summary now.",
    ]
      .filter(Boolean)
      .join("\n");

    const narrative = await generateNarrative(systemPrompt, userPrompt);

    return NextResponse.json({
      narrative: narrative || "Risk summary is currently unavailable. Please check your Groq API configuration.",
    });
  } catch (error) {
    console.error("PRA narrative generation error:", error);
    return NextResponse.json({ narrative: null }, { status: 200 });
  }
}

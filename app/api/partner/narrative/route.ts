import { NextRequest, NextResponse } from "next/server";
import { generateNarrative } from "@/lib/groq";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      flowTitle,
      flowDescription,
      riskScore,
      riskRating,
      gapControls,
      missingDataFields,
      controlSummary,
      modelType,
    } = body;

    if (!flowTitle) {
      return NextResponse.json({ error: "Missing flowTitle" }, { status: 400 });
    }

    const systemPrompt = [
      "You are a financial crime partner oversight expert writing for a UK-regulated firm's compliance team.",
      "Write a concise 3-5 sentence plain-English narrative summarising the key risks in this partner flow configuration.",
      "Focus on practical recommendations: which gaps to close first, what data to request, and what governance to prioritise.",
      "Be specific about the partner model type and control ownership distribution.",
      "Do not use bullet points, headings, or markdown. Use UK English. Do not provide legal advice.",
    ].join(" ");

    const userPrompt = [
      `Flow: ${flowTitle}`,
      `Description: ${flowDescription}`,
      `Model Type: ${modelType}`,
      `Risk Score: ${riskScore} (Rating: ${riskRating})`,
      `Control Distribution: Your Firm=${controlSummary?.yourFirm || 0}, Partner=${controlSummary?.partner || 0}, Shared=${controlSummary?.shared || 0}, Gaps=${controlSummary?.gap || 0}`,
      `Gap Controls: ${gapControls?.map((g: { control: string }) => g.control).join(", ") || "None"}`,
      `Missing Data Fields: ${missingDataFields?.map((f: { field: string }) => f.field).join(", ") || "None"}`,
      "",
      "Write a narrative summary highlighting the key risks, priority actions, and governance recommendations for this partner flow.",
    ].join("\n");

    const narrative = await generateNarrative(systemPrompt, userPrompt);

    return NextResponse.json({
      narrative: narrative || "Narrative generation is currently unavailable. Please check your Groq API configuration.",
    });
  } catch (error) {
    console.error("Partner narrative error:", error);
    return NextResponse.json({ narrative: null }, { status: 200 });
  }
}

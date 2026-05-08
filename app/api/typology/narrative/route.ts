import { NextRequest, NextResponse } from "next/server";
import { generateNarrative } from "@/lib/groq";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      typologyTitle,
      typologyDescription,
      controlObjective,
      firmType,
      product,
      customerType,
      riskTheme,
      score,
    } = body;

    if (!typologyTitle) {
      return NextResponse.json({ error: "Missing typologyTitle" }, { status: 400 });
    }

    const systemPrompt = [
      "You are a financial crime compliance expert writing for a UK-regulated firm's compliance team.",
      "Write a concise 3-5 sentence plain-English narrative summarising why this typology is relevant to the firm and what they should prioritise.",
      "Be practical and specific. Reference the firm type, product, and customer segment naturally.",
      "Do not use bullet points, headings, or markdown formatting.",
      "Do not provide legal advice. Use UK English.",
    ].join(" ");

    const userPrompt = [
      `Typology: ${typologyTitle}`,
      `Description: ${typologyDescription}`,
      `Control Objective: ${controlObjective}`,
      `Firm Type: ${firmType}`,
      `Product: ${product}`,
      `Customer Type: ${customerType}`,
      `Risk Theme: ${riskTheme}`,
      `Match Score: ${score}/100`,
      "",
      "Write a narrative summary explaining why this typology matters for this specific firm profile and what the priority actions should be.",
    ].join("\n");

    const narrative = await generateNarrative(systemPrompt, userPrompt);

    return NextResponse.json({ narrative: narrative || "Narrative generation is currently unavailable. Please check your Groq API configuration." });
  } catch (error) {
    console.error("Narrative generation error:", error);
    return NextResponse.json({ narrative: null }, { status: 200 });
  }
}

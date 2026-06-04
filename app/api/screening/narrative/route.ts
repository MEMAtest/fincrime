import { NextRequest, NextResponse } from "next/server";
import { generateNarrative } from "@/lib/groq";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { controlTitle, controlObjective, category, firmType, trigger, score } = body;

    if (!controlTitle) {
      return NextResponse.json({ error: "Missing controlTitle" }, { status: 400 });
    }

    const systemPrompt = [
      "You are a financial crime compliance expert writing for a UK-regulated firm's compliance team.",
      "Write a concise 3-5 sentence plain-English overview of how this screening control should be designed and what matters most for this firm.",
      "Be practical and specific. Reference the screening category, firm type and trigger naturally.",
      "Do not use bullet points, headings, or markdown formatting.",
      "Do not provide legal advice. Use UK English.",
    ].join(" ");

    const userPrompt = [
      `Screening control: ${controlTitle}`,
      `Objective: ${controlObjective}`,
      `Category: ${category}`,
      `Firm Type: ${firmType}`,
      `Screening trigger: ${trigger}`,
      `Match Score: ${score}/100`,
      "",
      "Write an overview explaining how to design this screening control well for this firm and what to prioritise.",
    ].join("\n");

    const narrative = await generateNarrative(systemPrompt, userPrompt);

    return NextResponse.json({
      narrative: narrative || "Overview is currently unavailable. Please check your Groq API configuration.",
    });
  } catch (error) {
    console.error("Screening narrative error:", error);
    return NextResponse.json({ narrative: null }, { status: 200 });
  }
}

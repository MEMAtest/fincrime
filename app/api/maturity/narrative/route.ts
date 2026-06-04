import { NextRequest, NextResponse } from "next/server";
import { generateNarrative } from "@/lib/groq";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { area, title, currentLevel, targetLevel, gapLevels } = body;

    if (!title) {
      return NextResponse.json({ error: "Missing title" }, { status: 400 });
    }

    const systemPrompt = [
      "You are a financial crime compliance expert writing for a UK-regulated firm's compliance team.",
      "Write a concise 3-5 sentence plain-English summary of the maturity gap for this control area and the priority steps to close it.",
      "Be practical and specific. Reference the current and target maturity levels naturally.",
      "Do not use bullet points, headings, or markdown formatting.",
      "Do not provide legal advice. Use UK English.",
    ].join(" ");

    const userPrompt = [
      `Control area: ${title} (${area})`,
      `Current maturity: ${currentLevel}`,
      `Target maturity: ${targetLevel}`,
      `Levels to climb: ${gapLevels}`,
      "",
      "Write a summary of the maturity gap and the priority actions to reach the target level.",
    ].join("\n");

    const narrative = await generateNarrative(systemPrompt, userPrompt);

    return NextResponse.json({
      narrative: narrative || "Summary is currently unavailable. Please check your Groq API configuration.",
    });
  } catch (error) {
    console.error("Maturity narrative error:", error);
    return NextResponse.json({ narrative: null }, { status: 200 });
  }
}

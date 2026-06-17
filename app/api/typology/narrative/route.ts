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
      firmTypes,
      product,
      products,
      customerType,
      customerTypes,
      riskThemes,
      riskTheme,
      score,
    } = body;

    if (!typologyTitle) {
      return NextResponse.json({ error: "Missing typologyTitle" }, { status: 400 });
    }

    const toList = (plural: unknown, single: unknown): string[] =>
      Array.isArray(plural) && plural.length > 0 ? (plural as string[]) : single ? [single as string] : [];

    const firmList = toList(firmTypes, firmType);
    const productList = toList(products, product);
    const customerList = toList(customerTypes, customerType);
    const themes: string[] = toList(riskThemes, riskTheme);

    const systemPrompt = [
      "You are a financial crime compliance expert writing for a UK-regulated firm's compliance team.",
      "Write a concise 3-5 sentence plain-English risk overview explaining why this typology is relevant to the firm and what they should prioritise.",
      "Be practical and specific. Reference the firm type, product, customer segment, and the selected risk themes naturally.",
      "Do not use bullet points, headings, or markdown formatting.",
      "Do not provide legal advice. Use UK English.",
    ].join(" ");

    const userPrompt = [
      `Typology: ${typologyTitle}`,
      `Description: ${typologyDescription}`,
      `Control Objective: ${controlObjective}`,
      `Firm Type(s): ${firmList.join(", ") || "(none specified)"}`,
      `Product(s): ${productList.join(", ") || "(none specified)"}`,
      `Customer Type(s): ${customerList.join(", ") || "(none specified)"}`,
      `Risk Themes: ${themes.join(", ") || "(none specified)"}`,
      `Match Score: ${score}/100`,
      "",
      "Write a risk overview explaining why this typology matters for this specific firm profile and what the priority actions should be.",
    ].join("\n");

    const narrative = await generateNarrative(systemPrompt, userPrompt);

    return NextResponse.json({ narrative: narrative || "Risk overview is currently unavailable. Please check your Groq API configuration." });
  } catch (error) {
    console.error("Risk overview generation error:", error);
    return NextResponse.json({ narrative: null }, { status: 200 });
  }
}

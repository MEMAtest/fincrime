import { NextRequest, NextResponse } from "next/server";
import { allTypologies } from "@/data/typologies";
import type { RiskTheme } from "@/data/typologies/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const riskTheme = searchParams.get("riskTheme") as RiskTheme | null;

    let filtered = allTypologies;

    if (riskTheme) {
      filtered = allTypologies.filter((t) => t.riskTheme === riskTheme);
    }

    const typologies = filtered.map((t) => ({
      id: t.id,
      slug: t.slug,
      title: t.title,
      riskTheme: t.riskTheme,
      description: t.description,
      applicableFirmTypes: t.applicableFirmTypes,
      applicableProducts: t.applicableProducts,
      applicableCustomerTypes: t.applicableCustomerTypes,
    }));

    return NextResponse.json({ typologies, count: typologies.length });
  } catch (error) {
    console.error("Typology list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

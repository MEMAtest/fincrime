import { NextResponse } from "next/server";
import { allMaturityFrameworks } from "@/data/maturity";

export async function GET() {
  return NextResponse.json({
    frameworks: allMaturityFrameworks.map((f) => ({
      id: f.id,
      slug: f.slug,
      title: f.title,
      area: f.area,
      description: f.description,
      riskThemes: f.riskThemes,
    })),
    count: allMaturityFrameworks.length,
  });
}

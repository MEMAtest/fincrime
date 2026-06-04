import { NextResponse } from "next/server";
import { allScreeningControls } from "@/data/screening";

export async function GET() {
  return NextResponse.json({
    controls: allScreeningControls.map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      category: c.category,
      description: c.description,
      applicableFirmTypes: c.applicableFirmTypes,
      riskThemes: c.riskThemes,
    })),
    count: allScreeningControls.length,
  });
}

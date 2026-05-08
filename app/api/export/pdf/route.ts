import { NextRequest, NextResponse } from "next/server";
import { generateTypologyPDF } from "@/lib/pdf/typology-pdf";
import { generatePartnerPDF } from "@/lib/pdf/partner-pdf";
import { getBestMatch } from "@/data/scoring/typology-scoring";
import { scorePartnerRisk } from "@/data/scoring/partner-scoring";
import type { FirmType, ProductType, CustomerType, RiskTheme } from "@/data/typologies/types";
import type { ModelType, FlowType, Actor, ControlOwnership } from "@/data/partner-flows/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { module, assessmentData, email } = body;

    if (!module || !assessmentData) {
      return NextResponse.json({ error: "Missing module or assessmentData" }, { status: 400 });
    }

    let pdfBuffer: Buffer;
    let filename: string;

    if (module === "typology_iq") {
      const { firmType, product, customerType, riskTheme, narrative } = assessmentData as {
        firmType: FirmType;
        product: ProductType;
        customerType: CustomerType;
        riskTheme: RiskTheme;
        narrative?: string;
      };

      const result = getBestMatch({ firmType, product, customerType, riskTheme });

      pdfBuffer = generateTypologyPDF({
        typology: result.typology,
        score: result.score,
        breakdown: result.breakdown,
        answers: { firmType, product, customerType, riskTheme },
        narrative,
      });
      filename = `MEMA-TypologyIQ-${result.typology.slug}-${new Date().toISOString().split("T")[0]}.pdf`;
    } else if (module === "partner_control_map") {
      const { modelType, flowType, actors, controlOverrides, dataReceived, narrative } = assessmentData as {
        modelType: ModelType;
        flowType: FlowType;
        actors: Actor[];
        controlOverrides: Record<string, ControlOwnership>;
        dataReceived: string[];
        narrative?: string;
      };

      const result = scorePartnerRisk({
        modelType,
        flowType,
        actors: actors || [],
        controlOverrides: controlOverrides || {},
        dataReceived: dataReceived || [],
      });

      if (!result) {
        return NextResponse.json({ error: "No matching flow" }, { status: 404 });
      }

      pdfBuffer = generatePartnerPDF({
        flow: result.flow,
        riskScore: result.riskScore,
        riskRating: result.riskRating,
        controlSummary: result.controlSummary,
        gapControls: result.gapControls,
        missingDataFields: result.missingDataFields,
        controlOverrides: controlOverrides || {},
        narrative,
      });
      filename = `MEMA-PartnerControlMap-${result.flow.slug}-${new Date().toISOString().split("T")[0]}.pdf`;
    } else {
      return NextResponse.json({ error: "Invalid module" }, { status: 400 });
    }

    // Send PDF via email (non-blocking)
    if (email) {
      try {
        const { sendEmailWithAttachment } = await import("@/lib/email");
        sendEmailWithAttachment({
          to: email,
          subject: `Your FinCrime Control Lab Report — ${module === "typology_iq" ? "TypologyIQ" : "PartnerControlMap"}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #14b8a6; padding: 16px 24px; border-radius: 8px 8px 0 0;">
                <h1 style="color: white; font-size: 18px; margin: 0;">MEMA FinCrime Control Lab</h1>
              </div>
              <div style="padding: 24px; background: #f8fafc; border-radius: 0 0 8px 8px;">
                <p style="color: #1e293b;">Your assessment report is attached to this email.</p>
                <p style="color: #64748b; font-size: 14px;">
                  If you have questions about implementing these controls, our financial crime
                  consultants can help. Get in touch at
                  <a href="mailto:contact@memaconsultants.com" style="color: #14b8a6;">contact@memaconsultants.com</a>.
                </p>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
                <p style="color: #94a3b8; font-size: 12px;">
                  MEMA Consultants Ltd | memaconsultants.com
                </p>
              </div>
            </div>
          `,
          attachmentBuffer: pdfBuffer,
          attachmentFilename: filename,
        }).catch((err: unknown) => console.error("PDF email error:", err));
      } catch {
        // Email sending is non-critical
      }
    }

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("PDF export error:", error);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}

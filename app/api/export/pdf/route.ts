import { NextRequest, NextResponse } from "next/server";
import { generateTypologyPDF } from "@/lib/pdf/typology-pdf";
import { generatePartnerPDF } from "@/lib/pdf/partner-pdf";
import { generateScreeningPDF } from "@/lib/pdf/screening-pdf";
import { generateMaturityPDF } from "@/lib/pdf/maturity-pdf";
import { generateKycPDF } from "@/lib/pdf/kyc-pdf";
import { generateKycDocx } from "@/lib/docx/kyc-docx";
import { ENTITY_ORDER, JURISDICTION_ORDER } from "@/data/kyc/types";
import type { EntityType, Jurisdiction, RiskLevel } from "@/data/kyc/types";
import { getBestMatch, normalizeAnswers } from "@/data/scoring/typology-scoring";
import { scorePartnerRisk } from "@/data/scoring/partner-scoring";
import { getBestScreeningMatch } from "@/data/scoring/screening-scoring";
import { scoreMaturity } from "@/data/scoring/maturity-scoring";
import type { FirmType } from "@/data/typologies/types";
import type { ModelType, FlowType, Actor, ControlOwnership } from "@/data/partner-flows/types";
import type { ScreeningCategory, ScreeningTrigger } from "@/data/screening/types";
import type { ControlArea, MaturityLevel } from "@/data/maturity/types";

const MODULE_TITLE: Record<string, string> = {
  typology_iq: "TypologyIQ",
  partner_control_map: "PartnerControlMap",
  screening_controls: "Screening Control Designer",
  controls_maturity: "Controls Maturity Assessment",
  kyc_requirements: "KYC / CDD Requirements Matrix",
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { module, assessmentData, email, format } = body;

    if (!module || !assessmentData) {
      return NextResponse.json({ error: "Missing module or assessmentData" }, { status: 400 });
    }

    let pdfBuffer: Buffer;
    let filename: string;
    let contentType = "application/pdf";

    if (module === "typology_iq") {
      const { narrative } = assessmentData as { narrative?: string };
      const answers = normalizeAnswers(assessmentData);

      if (!answers.firmTypes.length || !answers.products.length || !answers.customerTypes.length || !answers.riskThemes.length) {
        return NextResponse.json({ error: "Missing typology selections" }, { status: 400 });
      }

      const result = getBestMatch(answers);

      pdfBuffer = generateTypologyPDF({
        typology: result.typology,
        score: result.score,
        breakdown: result.breakdown,
        answers: {
          firmTypes: answers.firmTypes,
          products: answers.products,
          customerTypes: answers.customerTypes,
          riskThemes: answers.riskThemes,
        },
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
    } else if (module === "screening_controls") {
      const { firmType, category, trigger, narrative } = assessmentData as {
        firmType: FirmType;
        category: ScreeningCategory;
        trigger: ScreeningTrigger;
        narrative?: string;
      };

      const result = getBestScreeningMatch({ firmType, category, trigger });
      pdfBuffer = generateScreeningPDF({
        control: result.control,
        score: result.score,
        breakdown: result.breakdown,
        narrative,
      });
      filename = `MEMA-ScreeningControlDesigner-${result.control.slug}-${new Date().toISOString().split("T")[0]}.pdf`;
    } else if (module === "controls_maturity") {
      const { area, currentLevel, targetLevel, narrative } = assessmentData as {
        area: ControlArea;
        currentLevel: MaturityLevel;
        targetLevel: MaturityLevel;
        narrative?: string;
      };

      const result = scoreMaturity({ area, currentLevel, targetLevel });
      if (!result) {
        return NextResponse.json({ error: "No matching framework" }, { status: 404 });
      }
      pdfBuffer = generateMaturityPDF({ ...result, narrative });
      filename = `MEMA-ControlsMaturity-${result.framework.slug}-${new Date().toISOString().split("T")[0]}.pdf`;
    } else if (module === "kyc_requirements") {
      const a = assessmentData as {
        entities?: string[]; entity?: string;
        jurisdictions?: string[]; jurisdiction?: string;
        risks?: string[]; risk?: string;
        completed?: string[];
      };
      // Accept multi-select arrays (current client) or singular/comma strings (back-compat).
      const toStrList = (plural: string[] | undefined, single: string | undefined): string[] =>
        Array.isArray(plural) ? plural : typeof single === "string" ? single.split(",") : [];
      const uniq = (arr: string[]) => [...new Set(arr.map((x) => x.trim()).filter(Boolean))];
      const entities = uniq(toStrList(a.entities, a.entity)).filter((x): x is EntityType => (ENTITY_ORDER as string[]).includes(x));
      const jurisdictions = uniq(toStrList(a.jurisdictions, a.jurisdiction)).filter((x): x is Jurisdiction => (JURISDICTION_ORDER as string[]).includes(x));
      const risks = uniq(toStrList(a.risks, a.risk)).filter((x): x is RiskLevel => (["low", "medium", "high"] as string[]).includes(x));
      const safeCompleted = Array.isArray(a.completed) ? a.completed.filter((x) => typeof x === "string") : [];
      if (entities.length === 0 || jurisdictions.length === 0) {
        return NextResponse.json({ error: "Invalid entities or jurisdictions" }, { status: 400 });
      }
      const risksFinal: RiskLevel[] = risks.length ? risks : ["medium"];
      const date = new Date().toISOString().split("T")[0];
      const nameBit = `${entities.join("-")}-${jurisdictions.join("-")}`.slice(0, 60);
      if (format === "docx") {
        pdfBuffer = await generateKycDocx({ entities, jurisdictions, risks: risksFinal, completed: safeCompleted });
        contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        filename = `MEMA-KYC-${nameBit}-${date}.docx`;
      } else {
        pdfBuffer = generateKycPDF({ entities, jurisdictions, risks: risksFinal, completed: safeCompleted });
        filename = `MEMA-KYC-${nameBit}-${date}.pdf`;
      }
    } else {
      return NextResponse.json({ error: "Invalid module" }, { status: 400 });
    }

    // Send PDF via email (non-blocking)
    if (email) {
      try {
        const { sendEmailWithAttachment } = await import("@/lib/email");
        sendEmailWithAttachment({
          to: email,
          subject: `Your FinCrime Control Lab Report: ${MODULE_TITLE[module] || "FinCrime Control Lab"}`,
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
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("PDF export error:", error);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}

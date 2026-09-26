import { NextRequest, NextResponse } from "next/server";
import { requireDrafterActorApi } from "@/lib/drafter/access";
import { getPra, listSectionsForPra, listEnhancementsForPra, listOpenItemsForPra, createOpenItem } from "@/lib/repo/drafter-pras";
import { getTemplateVersion } from "@/lib/repo/drafter-templates";
import { checkExportReadiness } from "@/lib/drafter/pra-status";
import { buildExportFilename, extractStylesXmlFromDocx, renderExportDocxBuffer } from "@/lib/drafter/export-docx";
import { readDrafterDocumentBytes } from "@/lib/drafter/document-bytes";
import { getDrafterDocument } from "@/lib/repo/drafter-documents";
import { query } from "@/lib/db";
import { writeDrafterAudit } from "@/lib/repo/drafter-audit";
import { setPraStatus } from "@/lib/repo/drafter-pras";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST {overrideReason?} - exports the PRA to .docx (SPEC.md "Word export").
 * Blocked while any enhancement has a critical failure, is not reviewed, or
 * has a lint error, UNLESS the user supplies an override reason - which is
 * logged with the actor (drafter_export_log + drafter_open_items,
 * drafter_audit_log). A gate check with no override returns 409 and the
 * blocking reasons, never a partial file.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const { actor } = gate;
  const { id } = await context.params;

  const pra = await getPra(id);
  if (!pra) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const overrideReason = typeof body?.overrideReason === "string" ? body.overrideReason.trim() : "";
  const includeOpenItemsAppendix = body?.includeOpenItemsAppendix !== false;

  const readiness = await checkExportReadiness(id);
  if (!readiness.ready && !overrideReason) {
    return NextResponse.json(
      { error: "Export is blocked - unresolved reviewer issues.", blocking: readiness.blocking },
      { status: 409 }
    );
  }

  const templateVersion = await getTemplateVersion(pra.template_version_id);
  if (!templateVersion) return NextResponse.json({ error: "Template version not found." }, { status: 500 });

  const sections = await listSectionsForPra(id);
  const enhancements = await listEnhancementsForPra(id);
  const openItems = await listOpenItemsForPra(id);

  const exportSections = sections.map((s) => {
    const tSection = templateVersion.sections.find((ts) => ts.number === s.section_number);
    return {
      sectionNumber: s.section_number,
      sectionTitle: s.title,
      isEmpty: s.is_empty,
      emptySectionWording: tSection?.emptySectionWording ?? null,
      enhancements: enhancements
        .filter((e) => e.section_id === s.id)
        .map((e) => ({
          sortOrder: e.sort_order,
          controlText: e.control_text,
          rationale: e.rationale,
          backofficeControlLabel: e.backoffice_control_label,
          evidenceRefs: e.evidence_refs,
          isGap: e.is_gap,
        })),
    };
  });

  // Reuse the approved PRA's own styles.xml when its source document was a
  // .docx (SPEC.md "Word export": "reuse the approved PRA's styles when it
  // was uploaded as .docx"), falling back cleanly to docx's defaults.
  let externalStylesXml: string | null = null;
  const templateDoc = templateVersion.template_id
    ? await query<{ source_document_id: string | null }>(`SELECT source_document_id FROM drafter_templates WHERE id = $1`, [templateVersion.template_id])
    : [];
  const sourceDocumentId = templateDoc[0]?.source_document_id ?? null;
  if (sourceDocumentId) {
    const doc = await getDrafterDocument(sourceDocumentId);
    if (doc?.format === "docx") {
      const bytes = await readDrafterDocumentBytes(sourceDocumentId);
      if (bytes) externalStylesXml = await extractStylesXmlFromDocx(bytes);
    }
  }

  const versionRows = await query<{ count: string }>(`SELECT COUNT(*) AS count FROM drafter_export_log WHERE pra_id = $1`, [id]);
  const version = Number(versionRows[0]?.count ?? 0) + 1;
  const filename = buildExportFilename(pra.product, version);

  const buffer = await renderExportDocxBuffer({
    product: pra.product,
    legalEntity: pra.legal_entity,
    fieldLabels: templateVersion.field_labels,
    sections: exportSections,
    includeOpenItemsAppendix,
    openItems: openItems.map((o) => ({ itemType: o.item_type, description: o.description })),
    externalStylesXml,
  });

  await query(
    `INSERT INTO drafter_export_log (pra_id, filename, overridden, override_reason, blocking_reasons, actor)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [id, filename, Boolean(overrideReason), overrideReason || null, JSON.stringify(readiness.blocking), actor.email]
  );
  if (overrideReason) {
    await createOpenItem({ praId: id, enhancementId: null, itemType: "export_override", description: `Exported with unresolved issues - override reason: ${overrideReason}` });
  }
  await writeDrafterAudit(actor.email, "pra.export", "drafter_pra", id, { filename, overridden: Boolean(overrideReason) });
  await setPraStatus(id, "exported");

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
    },
  });
}

/** GET - export readiness check only (no file), for the UI to show/hide the override prompt. */
export async function GET(request: NextRequest, context: RouteContext) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const { id } = await context.params;
  const pra = await getPra(id);
  if (!pra) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const readiness = await checkExportReadiness(id);
  return NextResponse.json({ readiness });
}

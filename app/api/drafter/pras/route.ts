import { NextRequest, NextResponse } from "next/server";
import { requireDrafterActorApi } from "@/lib/drafter/access";
import { createPra, listPras, ensureSectionsForPra } from "@/lib/repo/drafter-pras";
import { getTemplateVersion } from "@/lib/repo/drafter-templates";
import { getStylepackVersion } from "@/lib/repo/drafter-stylepacks";
import { getDrafterSetting } from "@/lib/repo/drafter-settings";
import type { SkeletonCustomerType } from "@/lib/drafter/skeleton";
import { centsToStoredUnits } from "@/lib/drafter/money";

export async function GET(request: NextRequest) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const pras = await listPras();
  return NextResponse.json({ pras });
}

const VALID_CUSTOMER_TYPES = new Set(["natural_person", "legal_person", "both"]);

/**
 * POST /api/drafter/pras - SPEC.md "Start a PRA": product name, description,
 * legal entity, customer types in scope. Pins the template + stylepack
 * versions to this PRA (SPEC.md "Template and house style") and creates the
 * section skeleton immediately from the confirmed template.
 */
export async function POST(request: NextRequest) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const { actor } = gate;

  const body = await request.json().catch(() => null);
  const product = typeof body?.product === "string" ? body.product.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : null;
  const legalEntity = typeof body?.legalEntity === "string" ? body.legalEntity.trim() : null;
  const customerTypes = Array.isArray(body?.customerTypes) ? (body.customerTypes as string[]) : [];
  const templateVersionId = typeof body?.templateVersionId === "string" ? body.templateVersionId : null;
  const stylepackVersionId = typeof body?.stylepackVersionId === "string" ? body.stylepackVersionId : null;
  const registerVersionId = typeof body?.registerVersionId === "string" ? body.registerVersionId : null;

  if (!product) return NextResponse.json({ error: "product is required" }, { status: 400 });
  if (customerTypes.length === 0 || !customerTypes.every((c) => VALID_CUSTOMER_TYPES.has(c))) {
    return NextResponse.json({ error: "customerTypes must be a non-empty list of natural_person/legal_person/both" }, { status: 400 });
  }
  if (!templateVersionId || !stylepackVersionId) {
    return NextResponse.json({ error: "templateVersionId and stylepackVersionId are required" }, { status: 400 });
  }

  const templateVersion = await getTemplateVersion(templateVersionId);
  if (!templateVersion || !templateVersion.confirmed) {
    return NextResponse.json({ error: "The template version must exist and be confirmed before starting a PRA." }, { status: 400 });
  }
  const stylepackVersion = await getStylepackVersion(stylepackVersionId);
  if (!stylepackVersion) return NextResponse.json({ error: "StylePack version not found." }, { status: 400 });

  const costCapSetting = (await getDrafterSetting("cost_cap_pence_per_pra")) ?? 0;
  // The setting is in whole USD cents; drafter_pras.cost_cap_pence is
  // compared/displayed alongside spend_pence, which is in the finer-grained
  // "stored units" documented in lib/drafter/money.ts - convert once here so
  // the two columns are always in the same unit.
  const costCapPence = centsToStoredUnits(costCapSetting);

  const pra = await createPra({
    product,
    description,
    legalEntity,
    customerTypes: customerTypes as SkeletonCustomerType[],
    templateVersionId,
    stylepackVersionId,
    registerVersionId,
    costCapPence,
    actor: actor.email,
  });

  const sections = await ensureSectionsForPra(pra.id, templateVersion.sections);

  return NextResponse.json({ pra, sections });
}

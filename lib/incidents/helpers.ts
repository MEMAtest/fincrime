import { NextResponse } from "next/server";
import { getIncident, getIncidentLink, type IncidentRow, type IncidentLinkRow, type IncidentLinkType } from "../repo/incidents";
import { getWorkspaceControl } from "../repo/controls";
import { getControlChange } from "../repo/control-changes";
import { getControlTest } from "../repo/control-tests";
import { getAssessment } from "../repo/assessments";
import { getProduct } from "../repo/products";
import { getEnforcementCaseBySlug } from "../enforcement/case-slug";
import { isWorkspaceOwnedLinkType } from "./validation";

/**
 * Shared plumbing for the app/api/incidents/** route handlers, mirroring
 * lib/control-tests/helpers.ts. No identity exists yet (anonymous workspace
 * only), so every mutation is attributed to this fixed actor string. The
 * pure request-body validators live in ./validation.ts (kept free of value
 * imports so they stay unit-testable without a db); this file re-exports
 * them alongside the db-touching lookups and NextResponse helpers.
 */
export const ACTOR = "workspace";

/** Subject type used for actions/evidence/comments/decisions attached to an incident. */
export const SUBJECT_TYPE = "incident";

export {
  isIncidentSource,
  isIncidentSeverity,
  isIncidentStatus,
  isPatchableIncidentStatus,
  isRootCauseCategory,
  isIncidentLinkType,
  isWorkspaceOwnedLinkType,
  isUuid,
  isIsoDate,
  isIsoTimestamp,
  parseOptionalStep,
  parseAffectedPopulation,
  type StepParseResult,
  type AffectedPopulationParseResult,
} from "./validation";

export function notFound(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function conflict(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 409 });
}

export function serverError(context: string, error: unknown): NextResponse {
  console.error(`${context}:`, error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

/** Loads an incident and implicitly verifies it belongs to the authed workspace. */
export async function requireIncident(workspaceId: string, id: string): Promise<IncidentRow | null> {
  return getIncident(workspaceId, id);
}

/** Loads an incident_links row and verifies it belongs to both the workspace AND the given incident. */
export async function requireIncidentLink(
  workspaceId: string,
  incidentId: string,
  linkId: string
): Promise<IncidentLinkRow | null> {
  const link = await getIncidentLink(workspaceId, linkId);
  if (!link || link.incident_id !== incidentId) return null;
  return link;
}

export type LinkTargetCheck = { ok: true; label: string } | { ok: false; error: string };

/**
 * Verifies a proposed incident_links target resolves to a real object of the
 * right kind. Workspace-owned link types (failed_control, control_change,
 * control_test, pra_assessment) require targetId and it must belong to THIS
 * workspace and be of the matching kind - a link to another workspace's
 * control change must 400, not silently succeed pointing at someone else's
 * data. enforcement_case is a static library reference and requires
 * targetRef to resolve to a real case slug instead.
 */
export async function checkLinkTarget(
  workspaceId: string,
  linkType: IncidentLinkType,
  targetId: string | null,
  targetRef: string | null
): Promise<LinkTargetCheck> {
  if (!targetId && !targetRef) {
    return { ok: false, error: "Either targetId or targetRef is required" };
  }

  if (linkType === "enforcement_case") {
    if (!targetRef) return { ok: false, error: "enforcement_case links require targetRef" };
    const enforcementCase = getEnforcementCaseBySlug(targetRef);
    if (!enforcementCase) return { ok: false, error: `Unknown enforcement case: ${targetRef}` };
    return { ok: true, label: `${enforcementCase.firm} (${enforcementCase.year})` };
  }

  if (isWorkspaceOwnedLinkType(linkType)) {
    if (!targetId) return { ok: false, error: `${linkType} links require targetId` };

    if (linkType === "failed_control") {
      const control = await getWorkspaceControl(workspaceId, targetId);
      if (!control) return { ok: false, error: "Unknown targetId: not a control in this workspace" };
      return { ok: true, label: control.name };
    }
    if (linkType === "control_change") {
      const change = await getControlChange(workspaceId, targetId);
      if (!change) return { ok: false, error: "Unknown targetId: not a control change in this workspace" };
      return { ok: true, label: change.title };
    }
    if (linkType === "control_test") {
      const test = await getControlTest(workspaceId, targetId);
      if (!test) return { ok: false, error: "Unknown targetId: not a control test in this workspace" };
      return { ok: true, label: test.title };
    }
    if (linkType === "pra_assessment") {
      const assessment = await getAssessment(workspaceId, targetId);
      if (!assessment) return { ok: false, error: "Unknown targetId: not a PRA assessment in this workspace" };
      const product = await getProduct(workspaceId, assessment.product_id);
      return { ok: true, label: product ? `Assessment: ${product.name}` : `Assessment ${assessment.id}` };
    }
  }

  return { ok: false, error: `Unsupported link type: ${linkType}` };
}

export interface ResolvedIncidentLink {
  link: IncidentLinkRow;
  label: string | null;
}

/** Resolves a display label (control name, change title, test title, assessment title, or enforcement case firm/year) for each of an incident's links, for the GET detail route. Never throws on a link whose target has since disappeared - label is null instead. */
export async function resolveIncidentLinks(workspaceId: string, links: IncidentLinkRow[]): Promise<ResolvedIncidentLink[]> {
  return Promise.all(
    links.map(async (link) => {
      const check = await checkLinkTarget(workspaceId, link.link_type, link.target_id, link.target_ref);
      return { link, label: check.ok ? check.label : null };
    })
  );
}

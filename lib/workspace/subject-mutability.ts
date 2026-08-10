import { getIncident, isFinalIncidentStatus } from "@/lib/repo/incidents";
import { getControlTest } from "@/lib/repo/control-tests";
import { getControlChange } from "@/lib/repo/control-changes";
import { getReadinessAssessment, getReadinessObligation, isFinalReadinessStatus } from "@/lib/repo/readiness";
import { getRegRequest, getRegCommitment, isFinalRegRequestStatus, isTerminalCommitmentStatus } from "@/lib/repo/reg-requests";

export type SubjectMutabilityResult = { ok: true } | { ok: false; reason: "subject_immutable" };

/**
 * Guards mutation of a child record (currently: the generic
 * app/api/workspace/actions/[id] PATCH/DELETE) against its parent subject
 * being a closed/complete/implemented historical record.
 *
 * The subject-scoped routes (app/api/incidents/[id]/**,
 * app/api/control-tests/[id]/**, app/api/control-changes/[id]/**) already
 * refuse to mutate their own children once the parent reaches a final
 * status. The generic actions route resolves an action by id and workspace
 * only and has no visibility into which subject it is attached to, so it
 * previously bypassed all of those guards: an action on a closed incident
 * (or a complete control test, or an implemented control change) could be
 * reopened, rewritten, or deleted straight through this endpoint, letting
 * the child contradict the closed parent's record.
 *
 * subject_type/subject_id is polymorphic with no FK, so a subject can be
 * legitimately absent (e.g. an incident deleted while non-final, leaving its
 * already-done actions behind) - that is not this helper's concern, so a
 * missing subject is treated as mutable rather than blocked.
 */
export async function assertSubjectMutable(
  workspaceId: string,
  subjectType: string,
  subjectId: string
): Promise<SubjectMutabilityResult> {
  if (subjectType === "incident") {
    const incident = await getIncident(workspaceId, subjectId);
    if (incident && isFinalIncidentStatus(incident.status)) {
      return { ok: false, reason: "subject_immutable" };
    }
    return { ok: true };
  }

  if (subjectType === "control_test") {
    const test = await getControlTest(workspaceId, subjectId);
    if (test && (test.status === "complete" || test.status === "cancelled")) {
      return { ok: false, reason: "subject_immutable" };
    }
    return { ok: true };
  }

  if (subjectType === "control_change") {
    const change = await getControlChange(workspaceId, subjectId);
    if (change && (change.status === "implemented" || change.status === "rolled_back")) {
      return { ok: false, reason: "subject_immutable" };
    }
    return { ok: true };
  }

  if (subjectType === "readiness_assessment") {
    const assessment = await getReadinessAssessment(workspaceId, subjectId);
    if (assessment && isFinalReadinessStatus(assessment.status)) {
      return { ok: false, reason: "subject_immutable" };
    }
    return { ok: true };
  }

  if (subjectType === "readiness_obligation") {
    const obligation = await getReadinessObligation(workspaceId, subjectId);
    if (obligation) {
      const assessment = await getReadinessAssessment(workspaceId, obligation.assessment_id);
      if (assessment && isFinalReadinessStatus(assessment.status)) {
        return { ok: false, reason: "subject_immutable" };
      }
    }
    return { ok: true };
  }

  if (subjectType === "reg_request") {
    const request = await getRegRequest(workspaceId, subjectId);
    if (request && isFinalRegRequestStatus(request.status)) {
      return { ok: false, reason: "subject_immutable" };
    }
    return { ok: true };
  }

  if (subjectType === "reg_commitment") {
    const commitment = await getRegCommitment(workspaceId, subjectId);
    if (commitment) {
      // A commitment that has itself reached a terminal state (met/missed/
      // withdrawn) is a historical record in its own right, even before its
      // parent request closes - its linked action must not be reopened or
      // rewritten through the generic side door either.
      if (isTerminalCommitmentStatus(commitment.status)) {
        return { ok: false, reason: "subject_immutable" };
      }
      const request = await getRegRequest(workspaceId, commitment.request_id);
      if (request && isFinalRegRequestStatus(request.status)) {
        return { ok: false, reason: "subject_immutable" };
      }
    }
    return { ok: true };
  }

  return { ok: true };
}

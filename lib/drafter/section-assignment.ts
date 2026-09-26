/**
 * Section assignment (SPEC.md "Drafting", code step 2): assigns each
 * confirmed control group to a section from its back office control and the
 * PRA's customer types. Example from the spec: in a legal-person-only
 * product, EDD controls go under the legal person section.
 */

import type { SkeletonCustomerType, SkeletonSection } from "./skeleton";

export interface AssignableGroup {
  groupKey: string; // e.g. a control id, or a merge-group id
  backofficeControl: string | null;
  customerType: SkeletonCustomerType; // the group's own tagged customer type, if any
}

export interface SectionAssignmentResult {
  groupKey: string;
  sectionNumber: string | null;
  reason: string;
}

function normalise(value: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

/**
 * Picks the best-matching section for one control group. Candidate sections
 * are those whose backoffice_control_map matches the group's backoffice
 * control (case-insensitive). Among candidates, prefer one whose
 * customerType is explicitly in the PRA's customer types; a "both" section
 * is an acceptable match for any customer type in scope; if nothing more
 * specific matches, fall back to any candidate.
 */
export function assignGroupToSection(
  group: AssignableGroup,
  sections: SkeletonSection[],
  praCustomerTypes: SkeletonCustomerType[]
): SectionAssignmentResult {
  if (!group.backofficeControl) {
    return { groupKey: group.groupKey, sectionNumber: null, reason: "No back office control tag to match against a section." };
  }
  const candidates = sections.filter((s) => normalise(s.backofficeControlMap) === normalise(group.backofficeControl));
  if (candidates.length === 0) {
    return {
      groupKey: group.groupKey,
      sectionNumber: null,
      reason: `No section maps to back office control "${group.backofficeControl}".`,
    };
  }
  if (candidates.length === 1) {
    return { groupKey: group.groupKey, sectionNumber: candidates[0].number, reason: "Only section for this back office control." };
  }

  // The customer type to match against sections: the group's own tag if it
  // has one, otherwise the PRA's customer types (this is where a
  // legal-person-only product routes an untagged EDD control to the legal
  // person section rather than a "both"/natural-person one).
  const wantedTypes = group.customerType ? [group.customerType] : praCustomerTypes;

  // An untagged group in a product that spans MULTIPLE customer types is
  // ambiguous between the type-specific sections, so it goes to the "both"
  // section when one exists. A single-customer-type product (e.g.
  // legal-person-only) has only one wanted type, so the exact match below
  // takes priority - this is the SPEC.md example: "in a legal-person-only
  // product, EDD controls go under the legal person section".
  if (!group.customerType && wantedTypes.length > 1) {
    const bothFirst = candidates.find((s) => s.customerType === "both");
    if (bothFirst) {
      return { groupKey: group.groupKey, sectionNumber: bothFirst.number, reason: "Untagged group in a multi-customer-type product matched the \"both\" section." };
    }
  }

  const exact = candidates.find((s) => s.customerType && wantedTypes.includes(s.customerType));
  if (exact) {
    return { groupKey: group.groupKey, sectionNumber: exact.number, reason: `Matched customer type ${exact.customerType}.` };
  }
  const both = candidates.find((s) => s.customerType === "both");
  if (both) {
    return { groupKey: group.groupKey, sectionNumber: both.number, reason: "Matched the \"both\" customer-type section." };
  }
  return {
    groupKey: group.groupKey,
    sectionNumber: candidates[0].number,
    reason: "Multiple sections matched the back office control; no customer-type match, used the first.",
  };
}

export function assignGroupsToSections(
  groups: AssignableGroup[],
  sections: SkeletonSection[],
  praCustomerTypes: SkeletonCustomerType[]
): SectionAssignmentResult[] {
  return groups.map((g) => assignGroupToSection(g, sections, praCustomerTypes));
}

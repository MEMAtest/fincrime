/**
 * Tiny module-level registry so a DetailModal does not close on Escape when a
 * higher reference modal (SourceBadge / ReferenceLink -> ReferenceModal, z-[100])
 * is open on top of it. ReferenceModal increments this while open; DetailModal
 * (z-[90]) ignores Escape while it is non-zero.
 */
let refModalCount = 0;

export function pushReferenceModal(): void {
  refModalCount += 1;
}

export function popReferenceModal(): void {
  refModalCount = Math.max(0, refModalCount - 1);
}

export function isReferenceModalOpen(): boolean {
  return refModalCount > 0;
}

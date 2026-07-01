"use client";

import { ShieldCheck } from "lucide-react";
import DetailModal from "@/components/ui/DetailModal";
import ControlDetail from "./ControlDetail";
import { getControlBySlug, CONTROL_CATEGORY_LABEL, CONTROL_TYPE_LABEL } from "@/data/controls";

/** Read-only control detail in a modal (for the Controls Library reference). */
export default function ControlDetailModal({ slug, onClose }: { slug: string | null; onClose: () => void }) {
  const c = slug ? getControlBySlug(slug) : undefined;
  return (
    <DetailModal
      open={!!c}
      onClose={onClose}
      title={c?.name ?? ""}
      subtitle={c ? `${CONTROL_CATEGORY_LABEL[c.category]} · ${CONTROL_TYPE_LABEL[c.controlType]}` : undefined}
      icon={ShieldCheck}
      size="xl"
    >
      {c && <ControlDetail control={c} override={{}} onChange={() => {}} tested={[]} onToggleTest={() => {}} readOnly />}
    </DetailModal>
  );
}

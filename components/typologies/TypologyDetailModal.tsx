"use client";

import { ShieldAlert } from "lucide-react";
import DetailModal from "@/components/ui/DetailModal";
import TypologyDetail from "./TypologyDetail";
import { getTypologyBySlug } from "@/data/typologies";
import { THEME_CONFIG } from "@/components/icons/RiskThemeIcon";

/** Opens a typology's detail in a modal (in place, no navigation). Pass a slug to open. */
export default function TypologyDetailModal({ slug, onClose }: { slug: string | null; onClose: () => void }) {
  const typology = slug ? getTypologyBySlug(slug) : undefined;
  return (
    <DetailModal
      open={!!typology}
      onClose={onClose}
      title={typology?.title ?? ""}
      subtitle={typology ? THEME_CONFIG[typology.riskTheme].label : undefined}
      icon={ShieldAlert}
      size="xl"
    >
      {typology && <TypologyDetail typology={typology} compact />}
    </DetailModal>
  );
}

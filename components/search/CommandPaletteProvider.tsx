"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { SearchItem } from "./searchIndex";

// Lazily loaded on first open so the index + modal code stays off the initial
// (marketing) bundle. The detail modals only mount when a result is chosen.
const CommandPalette = dynamic(() => import("./CommandPalette"), { ssr: false });
const ControlDetailModal = dynamic(() => import("@/components/controls/ControlDetailModal"), { ssr: false });
const TypologyDetailModal = dynamic(() => import("@/components/typologies/TypologyDetailModal"), { ssr: false });

type Ctx = { open: () => void };
const CommandPaletteContext = createContext<Ctx>({ open: () => {} });
export const useCommandPalette = () => useContext(CommandPaletteContext);

export default function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<{ kind: "control" | "typology"; slug: string } | null>(null);

  const openPalette = useCallback(() => setOpen(true), []);

  // Global shortcuts: Cmd/Ctrl-K anywhere; "/" when not typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const el = document.activeElement as HTMLElement | null;
        const tag = el?.tagName;
        const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable;
        if (!typing) {
          e.preventDefault();
          setOpen(true);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onSelect = useCallback(
    (item: SearchItem) => {
      setOpen(false);
      const a = item.action;
      if (a.kind === "control") setDetail({ kind: "control", slug: a.slug });
      else if (a.kind === "typology") setDetail({ kind: "typology", slug: a.slug });
      else router.push(a.href);
    },
    [router]
  );

  return (
    <CommandPaletteContext.Provider value={{ open: openPalette }}>
      {children}
      {open && <CommandPalette onClose={() => setOpen(false)} onSelect={onSelect} />}
      {detail?.kind === "control" && <ControlDetailModal slug={detail.slug} onClose={() => setDetail(null)} />}
      {detail?.kind === "typology" && <TypologyDetailModal slug={detail.slug} onClose={() => setDetail(null)} />}
    </CommandPaletteContext.Provider>
  );
}

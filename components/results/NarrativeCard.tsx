"use client";

import { Sparkles } from "lucide-react";
import AiDisclosure from "@/components/shared/AiDisclosure";

/**
 * The shared "...Intelligence" narrative card: an AI-assisted summary visually
 * distinguished from cited fact, with the AiDisclosure pill and a persistent
 * disclaimer. Used on every tool's results page so the disclaimer lives once.
 */
export default function NarrativeCard({
  heading,
  narrative,
  loading,
  scoringNote,
}: {
  heading: string;
  narrative: string | null;
  loading: boolean;
  scoringNote?: string;
}) {
  if (!loading && !narrative) return null;
  return (
    <div className="rounded-2xl border-l-2 border-accent/40 bg-accent/[0.03] p-6 mb-8">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Sparkles className="h-4 w-4 text-accent" />
        <h3 className="text-sm font-semibold text-foreground">{heading}</h3>
        <AiDisclosure scoringNote={scoringNote} />
      </div>
      {loading ? (
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-text-muted">Generating intelligence...</span>
        </div>
      ) : (
        <>
          <p className="text-sm text-text-muted leading-relaxed">{narrative}</p>
          <p className="mt-3 text-[11px] text-text-muted/70">
            AI-assisted summary of the deterministic result. Not legal advice; verify against the cited sources.
          </p>
        </>
      )}
    </div>
  );
}

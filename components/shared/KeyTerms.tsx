import GlossaryTerm from "@/components/shared/GlossaryTerm";

/** A "Key terms:" row of inline glossary popovers. Reused across results pages. */
export default function KeyTerms({ terms }: { terms: string[] }) {
  if (!terms.length) return null;
  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
      <span className="font-medium text-foreground">Key terms:</span>
      {terms.map((t) => (
        <GlossaryTerm key={t} term={t} />
      ))}
    </div>
  );
}

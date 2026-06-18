"use client";

import { useState } from "react";
import { Sparkles, Info } from "lucide-react";
import Modal from "@/components/ui/Modal";

const DEFAULT_MODEL = "Groq llama-3.3-70b";

/**
 * Honest, subtle disclosure that a narrative is AI-assisted (used under an
 * "intelligence" framing, not as the headline). The pill opens a dialog that
 * explains the deterministic-score-then-AI layering and the model's bounds.
 * Reusable across every tool that renders a Groq narrative.
 */
export default function AiDisclosure({ model = DEFAULT_MODEL }: { model?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent hover:bg-accent/15 transition-colors cursor-pointer"
        aria-haspopup="dialog"
        aria-label="How this intelligence is generated"
      >
        <Sparkles className="h-3 w-3" />
        AI-assisted
        <Info className="h-3 w-3 opacity-70" />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="How this intelligence is generated">
        <div className="space-y-3 text-sm text-slate-600">
          <p>
            <span className="font-semibold text-slate-800">Deterministic first.</span> The match and its score are
            calculated by a fixed weighted model, with no AI: firm type 30, product 25, customer 20, risk theme 25.
            The same inputs always give the same result.
          </p>
          <p>
            <span className="font-semibold text-slate-800">AI-assisted summary.</span> The narrative is written by{" "}
            {model} from your selections and the matched typology. It restates and explains the deterministic result;
            it does not introduce new facts or citations.
          </p>
          <p>
            <span className="font-semibold text-slate-800">Not legal advice.</span> Treat the summary as a starting
            point and verify against the cited sources before relying on it.
          </p>
        </div>
      </Modal>
    </>
  );
}

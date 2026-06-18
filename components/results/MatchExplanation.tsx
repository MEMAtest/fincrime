import { CheckCircle2, MinusCircle, Scale } from "lucide-react";
import { explainMatch, type TypologyAnswers, type TypologyScore } from "@/data/scoring/typology-scoring";

/**
 * Plain-English "why this matched you", derived from the deterministic score.
 * Shows each dimension's contribution, a weight bar, and which of the user's
 * own selections triggered it. No AI; the numbers equal the displayed score.
 */
export default function MatchExplanation({ answers, result }: { answers: TypologyAnswers; result: TypologyScore }) {
  const dims = explainMatch(answers, result);
  return (
    <div className="glass-card rounded-2xl p-6 mb-8">
      <div className="flex items-center gap-2 mb-1">
        <Scale className="h-4 w-4 text-accent" />
        <h3 className="text-sm font-semibold text-foreground">Why this matched you</h3>
      </div>
      <p className="text-xs text-text-muted mb-4">
        A deterministic score, not AI: each dimension adds fixed points when any of your selections apply to this typology. Total {result.score} of 100.
      </p>
      <div className="space-y-3">
        {dims.map((d) => (
          <div key={d.key} className="flex items-start gap-3">
            <div className="shrink-0 mt-0.5">
              {d.matched ? (
                <CheckCircle2 className="h-4 w-4 text-accent" />
              ) : (
                <MinusCircle className="h-4 w-4 text-text-muted/50" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <span className={`text-sm font-medium ${d.matched ? "text-foreground" : "text-text-muted"}`}>{d.label}</span>
                <span className={`text-xs font-mono ${d.matched ? "text-accent" : "text-text-muted/60"}`}>
                  {d.points}/{d.max}
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-accent rounded-full" style={{ width: `${d.max ? (d.points / d.max) * 100 : 0}%` }} />
              </div>
              {d.matched ? (
                <p className="mt-1.5 text-xs text-text-muted">Applies to your {d.matchedValues.join(", ")}.</p>
              ) : (
                <p className="mt-1.5 text-xs text-text-muted/70">No overlap with your selection on this dimension.</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import { Check, Lock } from "lucide-react";
import { JOURNEY_STEP_LABELS, LAST_UNLOCKED_STEP } from "./types";

interface AssessmentStepperProps {
  /** 1-based current step. */
  currentStep: number;
  onSelect: (step: number) => void;
  disabled?: boolean;
}

/**
 * The 8-step top-of-journey progress bar, adapted from
 * components/wizard/WizardProgress.tsx: unlike that wizard-only progress
 * indicator, each step here is independently clickable. All 8 steps are
 * built; the lock mechanism (LAST_UNLOCKED_STEP) stays for future rounds
 * that ship partially built journeys.
 */
export default function AssessmentStepper({ currentStep, onSelect, disabled = false }: AssessmentStepperProps) {
  return (
    <div className="flex items-start gap-1 overflow-x-auto pb-2 mb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {JOURNEY_STEP_LABELS.map((label, index) => {
        const stepNumber = index + 1;
        const locked = stepNumber > LAST_UNLOCKED_STEP;
        const isCompleted = stepNumber < currentStep && !locked;
        const isCurrent = stepNumber === currentStep;

        return (
          <div key={label} className="flex items-start gap-1 shrink-0">
            <button
              type="button"
              disabled={locked || disabled}
              onClick={() => onSelect(stepNumber)}
              title={locked ? `${label} - coming in a later release` : label}
              className={`flex flex-col items-center gap-1.5 px-2 py-1 rounded-lg transition-colors ${
                locked ? "cursor-not-allowed opacity-40" : "cursor-pointer"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                  isCompleted
                    ? "bg-accent text-white"
                    : isCurrent
                    ? "bg-accent/20 text-accent border-2 border-accent"
                    : "bg-white/5 text-text-muted border border-white/10"
                }`}
              >
                {locked ? (
                  <Lock className="h-3 w-3" />
                ) : isCompleted ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  stepNumber
                )}
              </div>
              <span
                className={`text-[11px] whitespace-nowrap ${
                  isCurrent ? "text-foreground font-medium" : "text-text-muted"
                }`}
              >
                {label}
              </span>
            </button>
            {index < JOURNEY_STEP_LABELS.length - 1 && (
              <div className={`w-6 h-0.5 mt-3.5 ${stepNumber < currentStep ? "bg-accent" : "bg-white/10"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

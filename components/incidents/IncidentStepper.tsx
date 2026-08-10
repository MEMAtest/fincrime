"use client";

import { Check } from "lucide-react";
import { JOURNEY_STEP_LABELS } from "./types";

interface IncidentStepperProps {
  /** 1-based current step. */
  currentStep: number;
  onSelect: (step: number) => void;
  disabled?: boolean;
}

/**
 * The 7-step top-of-journey progress bar for the Incident and Assurance
 * Workspace, adapted from components/control-testing/TestStepper.tsx (kept
 * as a separate component rather than a shared import so this journey's step
 * count/labels can evolve independently). All 7 steps are built, so there is
 * no lock mechanism here.
 */
export default function IncidentStepper({ currentStep, onSelect, disabled = false }: IncidentStepperProps) {
  return (
    <div className="flex items-start gap-1 overflow-x-auto pb-2 mb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {JOURNEY_STEP_LABELS.map((label, index) => {
        const stepNumber = index + 1;
        const isCompleted = stepNumber < currentStep;
        const isCurrent = stepNumber === currentStep;

        return (
          <div key={label} className="flex items-start gap-1 shrink-0">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSelect(stepNumber)}
              title={label}
              className="flex flex-col items-center gap-1.5 px-2 py-1 rounded-lg transition-colors cursor-pointer"
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
                {isCompleted ? <Check className="h-3.5 w-3.5" /> : stepNumber}
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

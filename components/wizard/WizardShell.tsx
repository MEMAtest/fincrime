"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Button from "@/components/ui/Button";
import WizardProgress from "./WizardProgress";

interface WizardShellProps {
  steps: string[];
  currentStep: number;
  canGoNext: boolean;
  onBack: () => void;
  onNext: () => void;
  isLastStep: boolean;
  children: React.ReactNode;
  sidebar?: React.ReactNode;
}

export default function WizardShell({
  steps,
  currentStep,
  canGoNext,
  onBack,
  onNext,
  isLastStep,
  children,
  sidebar,
}: WizardShellProps) {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <WizardProgress steps={steps} currentStep={currentStep} />

      <div className="grid lg:grid-cols-[1fr_320px] gap-8">
        <div>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
            >
              {children}
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/10">
            <Button
              variant="ghost"
              onClick={onBack}
              disabled={currentStep === 0}
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
            <Button onClick={onNext} disabled={!canGoNext}>
              {isLastStep ? "View Results" : "Continue"}
              {!isLastStep && <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {sidebar && (
          <motion.div
            className="hidden lg:block"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            {sidebar}
          </motion.div>
        )}
      </div>
    </div>
  );
}

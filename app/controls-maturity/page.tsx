"use client";

import { useState, useCallback, Suspense } from "react";
import { useRouter } from "next/navigation";
import {
  Landmark, UserCheck, Activity, ShieldOff, FileText, GraduationCap, Gauge,
} from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import WizardShell from "@/components/wizard/WizardShell";
import WizardStep from "@/components/wizard/WizardStep";
import OptionCard from "@/components/wizard/OptionCard";
import LivePreview from "@/components/wizard/LivePreview";
import { getFrameworkByArea } from "@/data/maturity";
import { CONTROL_AREA_LABEL, MATURITY_LABEL, MATURITY_ORDER } from "@/data/maturity/types";
import type { ControlArea, MaturityLevel } from "@/data/maturity/types";

const STEPS = ["Control Area", "Current Maturity", "Target Maturity", "Confirm"];

const AREA_OPTIONS: { value: ControlArea; icon: typeof Landmark }[] = [
  { value: "governance", icon: Landmark },
  { value: "cdd_kyc", icon: UserCheck },
  { value: "transaction_monitoring", icon: Activity },
  { value: "screening", icon: ShieldOff },
  { value: "reporting", icon: FileText },
  { value: "training", icon: GraduationCap },
];

const LEVELS: MaturityLevel[] = ["initial", "developing", "defined", "managed", "optimised"];

function MaturityWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<{
    area: ControlArea | null;
    currentLevel: MaturityLevel | null;
    targetLevel: MaturityLevel | null;
  }>({ area: null, currentLevel: null, targetLevel: null });

  const framework = answers.area ? getFrameworkByArea(answers.area) : undefined;
  const descriptorFor = (level: MaturityLevel) =>
    framework?.levels.find((l) => l.level === level)?.descriptor;

  const canGoNext = useCallback(() => {
    switch (step) {
      case 0: return !!answers.area;
      case 1: return !!answers.currentLevel;
      case 2: return !!answers.targetLevel && !!answers.currentLevel &&
        MATURITY_ORDER[answers.targetLevel] >= MATURITY_ORDER[answers.currentLevel];
      case 3: return true;
      default: return false;
    }
  }, [step, answers]);

  const handleNext = useCallback(() => {
    if (step === STEPS.length - 1) {
      const params = new URLSearchParams({
        area: answers.area!,
        currentLevel: answers.currentLevel!,
        targetLevel: answers.targetLevel!,
      });
      router.push(`/controls-maturity/results?${params.toString()}`);
    } else {
      setStep((s) => s + 1);
    }
  }, [step, answers, router]);

  const previewItems = [
    { label: "Control Area", value: answers.area ? CONTROL_AREA_LABEL[answers.area] : null },
    { label: "Current", value: answers.currentLevel ? MATURITY_LABEL[answers.currentLevel] : null },
    { label: "Target", value: answers.targetLevel ? MATURITY_LABEL[answers.targetLevel] : null },
  ];

  return (
    <WizardShell
      steps={STEPS}
      currentStep={step}
      canGoNext={canGoNext()}
      onBack={() => setStep((s) => Math.max(0, s - 1))}
      onNext={handleNext}
      isLastStep={step === STEPS.length - 1}
      sidebar={<LivePreview title="Your Assessment" items={previewItems} />}
    >
      {step === 0 && (
        <WizardStep title="Which control area are you assessing?" subtitle="Pick the financial-crime control area to assess for maturity.">
          {AREA_OPTIONS.map((o) => (
            <OptionCard key={o.value} value={o.value} label={CONTROL_AREA_LABEL[o.value]}
              description={getFrameworkByArea(o.value)?.description}
              icon={o.icon}
              selected={answers.area === o.value}
              onSelect={(v) => setAnswers((a) => ({ ...a, area: v as ControlArea }))} />
          ))}
        </WizardStep>
      )}
      {step === 1 && (
        <WizardStep title="Where are you today?" subtitle="Select the level that best describes your current state.">
          {LEVELS.map((lvl) => (
            <OptionCard key={lvl} value={lvl} label={MATURITY_LABEL[lvl]} description={descriptorFor(lvl)} icon={Gauge}
              selected={answers.currentLevel === lvl}
              onSelect={(v) => setAnswers((a) => ({ ...a, currentLevel: v as MaturityLevel }))} />
          ))}
        </WizardStep>
      )}
      {step === 2 && (
        <WizardStep title="Where do you want to be?" subtitle="Select your target maturity level (at or above current).">
          {LEVELS.map((lvl) => {
            const belowCurrent = answers.currentLevel && MATURITY_ORDER[lvl] < MATURITY_ORDER[answers.currentLevel];
            return (
              <div key={lvl} className={belowCurrent ? "opacity-40 pointer-events-none" : ""}>
                <OptionCard value={lvl} label={MATURITY_LABEL[lvl]} description={descriptorFor(lvl)} icon={Gauge}
                  selected={answers.targetLevel === lvl}
                  onSelect={(v) => setAnswers((a) => ({ ...a, targetLevel: v as MaturityLevel }))} />
              </div>
            );
          })}
        </WizardStep>
      )}
      {step === 3 && (
        <WizardStep title="Confirm your selections" subtitle="Review before generating the maturity assessment.">
          <div className="glass-card rounded-xl p-6 space-y-4">
            {previewItems.map((item) => (
              <div key={item.label} className="flex items-start justify-between gap-4 py-2 border-b border-white/5 last:border-0">
                <span className="text-sm text-text-muted shrink-0">{item.label}</span>
                <span className="text-sm font-medium text-foreground text-right">{item.value}</span>
              </div>
            ))}
          </div>
        </WizardStep>
      )}
    </WizardShell>
  );
}

export default function ControlsMaturityPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Suspense fallback={<div className="text-center py-20 text-text-muted">Loading wizard...</div>}>
          <MaturityWizard />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}

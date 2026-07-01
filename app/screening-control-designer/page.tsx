"use client";

import { useState, useCallback, Suspense } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldOff, Crown, Newspaper, UserSearch, ArrowLeftRight,
  Wallet, Banknote, Landmark, Globe, Coins, CreditCard, BarChart3, ShieldAlert,
  Clock, RefreshCw, Zap, CalendarClock,
} from "lucide-react";
import ToolFrame from "@/components/layout/ToolFrame";
import WizardShell from "@/components/wizard/WizardShell";
import WizardStep from "@/components/wizard/WizardStep";
import OptionCard from "@/components/wizard/OptionCard";
import LivePreview from "@/components/wizard/LivePreview";
import type { ScreeningCategory, ScreeningTrigger } from "@/data/screening/types";
import type { FirmType } from "@/data/typologies/types";

const STEPS = ["Screening Type", "Firm Type", "Trigger", "Confirm"];

const CATEGORY_OPTIONS: { value: ScreeningCategory; label: string; description: string; icon: typeof ShieldOff }[] = [
  { value: "sanctions", label: "Sanctions Screening", description: "Designated persons & asset-freeze targets", icon: ShieldOff },
  { value: "pep", label: "PEP Screening", description: "Politically exposed persons & associates", icon: Crown },
  { value: "adverse_media", label: "Adverse Media", description: "Negative-news / financial-crime signals", icon: Newspaper },
  { value: "name_screening", label: "Customer Name Screening", description: "End-to-end customer name screening", icon: UserSearch },
  { value: "transaction_screening", label: "Transaction / Payment Screening", description: "Real-time payment-message screening", icon: ArrowLeftRight },
];

const FIRM_OPTIONS: { value: FirmType; label: string; description: string; icon: typeof Wallet }[] = [
  { value: "emi", label: "E-Money Institution", description: "Issues e-money / payment services", icon: Wallet },
  { value: "pi", label: "Payment Institution", description: "Executes payment transactions", icon: Banknote },
  { value: "bank", label: "Bank / Credit Institution", description: "Deposit-taking and lending", icon: Landmark },
  { value: "msb", label: "Money Service Business", description: "Money transmission / FX", icon: Globe },
  { value: "crypto", label: "Crypto Asset Service Provider", description: "Exchange or custody", icon: Coins },
  { value: "neobank", label: "Neobank / Digital Bank", description: "Digital-first banking", icon: CreditCard },
  { value: "wealth_manager", label: "Wealth Manager", description: "Investment advisory / portfolios", icon: BarChart3 },
  { value: "insurance", label: "Insurance Provider", description: "General or life insurance", icon: ShieldAlert },
];

const TRIGGER_OPTIONS: { value: ScreeningTrigger; label: string; description: string; icon: typeof Clock }[] = [
  { value: "onboarding", label: "At Onboarding", description: "Screen before activating the customer", icon: Clock },
  { value: "ongoing", label: "Ongoing Rescreening", description: "Rescreen the book on list changes", icon: RefreshCw },
  { value: "real_time", label: "Real-Time (Per Payment)", description: "Screen each payment pre-settlement", icon: Zap },
  { value: "periodic", label: "Periodic Batch", description: "Scheduled batch screening runs", icon: CalendarClock },
];

const catLabel = Object.fromEntries(CATEGORY_OPTIONS.map((o) => [o.value, o.label]));
const firmLabel = Object.fromEntries(FIRM_OPTIONS.map((o) => [o.value, o.label]));
const trigLabel = Object.fromEntries(TRIGGER_OPTIONS.map((o) => [o.value, o.label]));

function ScreeningWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<{
    category: ScreeningCategory | null;
    firmType: FirmType | null;
    trigger: ScreeningTrigger | null;
  }>({ category: null, firmType: null, trigger: null });

  const canGoNext = useCallback(() => {
    switch (step) {
      case 0: return !!answers.category;
      case 1: return !!answers.firmType;
      case 2: return !!answers.trigger;
      case 3: return true;
      default: return false;
    }
  }, [step, answers]);

  const handleNext = useCallback(() => {
    if (step === STEPS.length - 1) {
      const params = new URLSearchParams({
        category: answers.category!,
        firmType: answers.firmType!,
        trigger: answers.trigger!,
      });
      router.push(`/screening-control-designer/results?${params.toString()}`);
    } else {
      setStep((s) => s + 1);
    }
  }, [step, answers, router]);

  const previewItems = [
    { label: "Screening Type", value: answers.category ? catLabel[answers.category] : null },
    { label: "Firm Type", value: answers.firmType ? firmLabel[answers.firmType] : null },
    { label: "Trigger", value: answers.trigger ? trigLabel[answers.trigger] : null },
  ];

  return (
    <WizardShell
      steps={STEPS}
      currentStep={step}
      canGoNext={canGoNext()}
      onBack={() => setStep((s) => Math.max(0, s - 1))}
      onNext={handleNext}
      isLastStep={step === STEPS.length - 1}
      sidebar={<LivePreview title="Your Screening Control" items={previewItems} />}
    >
      {step === 0 && (
        <WizardStep title="Which screening control are you designing?" subtitle="Pick the screening type to tailor the matching configuration, workflow and governance.">
          {CATEGORY_OPTIONS.map((o) => (
            <OptionCard key={o.value} value={o.value} label={o.label} description={o.description} icon={o.icon}
              selected={answers.category === o.value}
              onSelect={(v) => setAnswers((a) => ({ ...a, category: v as ScreeningCategory }))} />
          ))}
        </WizardStep>
      )}
      {step === 1 && (
        <WizardStep title="What type of firm are you?" subtitle="Calibrates the control to your regulated activities.">
          {FIRM_OPTIONS.map((o) => (
            <OptionCard key={o.value} value={o.value} label={o.label} description={o.description} icon={o.icon}
              selected={answers.firmType === o.value}
              onSelect={(v) => setAnswers((a) => ({ ...a, firmType: v as FirmType }))} />
          ))}
        </WizardStep>
      )}
      {step === 2 && (
        <WizardStep title="When does screening run?" subtitle="Choose the primary trigger for this control.">
          {TRIGGER_OPTIONS.map((o) => (
            <OptionCard key={o.value} value={o.value} label={o.label} description={o.description} icon={o.icon}
              selected={answers.trigger === o.value}
              onSelect={(v) => setAnswers((a) => ({ ...a, trigger: v as ScreeningTrigger }))} />
          ))}
        </WizardStep>
      )}
      {step === 3 && (
        <WizardStep title="Confirm your selections" subtitle="Review before generating the screening control specification.">
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

export default function ScreeningControlDesignerPage() {
  return (
    <ToolFrame>
      <main className="flex-1">
        <Suspense fallback={<div className="text-center py-20 text-text-muted">Loading wizard...</div>}>
          <ScreeningWizard />
        </Suspense>
      </main>
      </ToolFrame>
  );
}

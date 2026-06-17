"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  User, Building2, Landmark, LineChart, HeartHandshake, Users, Scale, PiggyBank, Briefcase, Globe2,
  ShieldCheck, Shield, ShieldAlert, Layers,
} from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import WizardShell from "@/components/wizard/WizardShell";
import WizardStep from "@/components/wizard/WizardStep";
import OptionCard from "@/components/wizard/OptionCard";
import LivePreview from "@/components/wizard/LivePreview";
import { entityTypesCovered } from "@/data/kyc";
import type { EntityType, Jurisdiction, RiskLevel } from "@/data/kyc/types";
import { ENTITY_LABEL, JURISDICTION_ORDER, JURISDICTION_LABEL, JURISDICTION_REGULATOR } from "@/data/kyc/types";

const STEPS = ["Entity Type", "Jurisdiction", "Risk", "Confirm"];

const ENTITY_ICON: Partial<Record<EntityType, typeof User>> = {
  individual: User,
  sole_trader: Briefcase,
  corporate: Building2,
  regulated_entity: Landmark,
  listed_entity: LineChart,
  charity: HeartHandshake,
  partnership: Users,
  trust: Scale,
  fund: PiggyBank,
  government: Landmark,
};

const ENTITY_DESC: Partial<Record<EntityType, string>> = {
  individual: "A natural person",
  corporate: "Private / joint-stock company",
  regulated_entity: "Supervised financial institution",
  listed_entity: "Company on a recognised exchange",
  charity: "Charity / non-profit organisation",
};

const RISK_OPTIONS: { value: RiskLevel; label: string; description: string; icon: typeof ShieldCheck }[] = [
  { value: "low", label: "Lower Risk", description: "SDD may be available", icon: ShieldCheck },
  { value: "medium", label: "Medium Risk", description: "Standard CDD", icon: Shield },
  { value: "high", label: "Higher Risk", description: "Enhanced due diligence", icon: ShieldAlert },
];

export default function KycPickerPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<{ entity: EntityType | null; jurisdiction: Jurisdiction | null; risk: RiskLevel | null }>({
    entity: null,
    jurisdiction: null,
    risk: null,
  });

  const entityOptions = entityTypesCovered();

  const canGoNext = useCallback(() => {
    switch (step) {
      case 0:
        return !!answers.entity;
      case 1:
        return !!answers.jurisdiction;
      case 2:
        return !!answers.risk;
      case 3:
        return true;
      default:
        return false;
    }
  }, [step, answers]);

  const handleNext = useCallback(() => {
    if (step === STEPS.length - 1) {
      const params = new URLSearchParams({
        entity: answers.entity!,
        jurisdiction: answers.jurisdiction!,
        risk: answers.risk!,
      });
      router.push(`/kyc-requirements/results?${params.toString()}`);
    } else {
      setStep((s) => s + 1);
    }
  }, [step, answers, router]);

  const previewItems = [
    { label: "Entity Type", value: answers.entity ? ENTITY_LABEL[answers.entity] : null },
    { label: "Jurisdiction", value: answers.jurisdiction ? JURISDICTION_LABEL[answers.jurisdiction] : null },
    { label: "Risk", value: answers.risk ? RISK_OPTIONS.find((r) => r.value === answers.risk)?.label ?? null : null },
  ];

  return (
    <>
      <Header />
      <main className="flex-1">
        <WizardShell
          steps={STEPS}
          currentStep={step}
          canGoNext={canGoNext()}
          onBack={() => setStep((s) => Math.max(0, s - 1))}
          onNext={handleNext}
          isLastStep={step === STEPS.length - 1}
          sidebar={<LivePreview title="Your CDD Requirements" items={previewItems} />}
        >
          {step === 0 && (
            <WizardStep title="What type of customer is it?" subtitle="Pick the entity type to scope the CDD requirements.">
              {entityOptions.map((e) => (
                <OptionCard
                  key={e}
                  value={e}
                  label={ENTITY_LABEL[e]}
                  description={ENTITY_DESC[e] ?? "Customer / entity type"}
                  icon={ENTITY_ICON[e] ?? Layers}
                  selected={answers.entity === e}
                  onSelect={(v) => setAnswers((a) => ({ ...a, entity: v as EntityType }))}
                />
              ))}
            </WizardStep>
          )}
          {step === 1 && (
            <WizardStep title="Which jurisdiction / regulator?" subtitle="The rules and citations are tailored to the jurisdiction.">
              {JURISDICTION_ORDER.map((j) => (
                <OptionCard
                  key={j}
                  value={j}
                  label={JURISDICTION_LABEL[j]}
                  description={JURISDICTION_REGULATOR[j]}
                  icon={Globe2}
                  selected={answers.jurisdiction === j}
                  onSelect={(v) => setAnswers((a) => ({ ...a, jurisdiction: v as Jurisdiction }))}
                />
              ))}
            </WizardStep>
          )}
          {step === 2 && (
            <WizardStep title="What is the customer risk rating?" subtitle="Determines which requirements and EDD steps apply.">
              {RISK_OPTIONS.map((o) => (
                <OptionCard
                  key={o.value}
                  value={o.value}
                  label={o.label}
                  description={o.description}
                  icon={o.icon}
                  selected={answers.risk === o.value}
                  onSelect={(v) => setAnswers((a) => ({ ...a, risk: v as RiskLevel }))}
                />
              ))}
            </WizardStep>
          )}
          {step === 3 && (
            <WizardStep title="Confirm your selections" subtitle="Generate the tailored CDD requirements and citations.">
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
      </main>
      <Footer />
    </>
  );
}

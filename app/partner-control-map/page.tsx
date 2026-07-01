"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Building2, GitBranch, Users, ShieldCheck, Database,
  Globe, Banknote, CreditCard, Wallet, ShoppingCart,
  UserCheck, Landmark, ArrowLeftRight, Radio,
} from "lucide-react";
import ToolFrame from "@/components/layout/ToolFrame";
import WizardShell from "@/components/wizard/WizardShell";
import WizardStep from "@/components/wizard/WizardStep";
import OptionCard from "@/components/wizard/OptionCard";
import LivePreview from "@/components/wizard/LivePreview";
import { findBestFlow } from "@/data/scoring/partner-scoring";
import type { ModelType, FlowType, Actor, ControlOwnership } from "@/data/partner-flows/types";

const STEPS = ["Partner Model", "Flow Type", "Actors", "Control Ownership", "Data Received"];

const MODEL_OPTIONS: { value: ModelType; label: string; description: string; icon: typeof Building2 }[] = [
  { value: "embedded", label: "Embedded / BaaS", description: "Partner embeds your regulated infrastructure via API", icon: Radio },
  { value: "correspondent", label: "Correspondent", description: "Your firm acts as correspondent bank or payment processor", icon: Landmark },
  { value: "marketplace", label: "Marketplace / Platform", description: "Platform operator disbursing to multiple payees", icon: ShoppingCart },
];

const FLOW_OPTIONS: { value: FlowType; label: string; description: string; icon: typeof Globe }[] = [
  { value: "cross_border_payout", label: "Cross-Border Payout", description: "International disbursements with FX", icon: Globe },
  { value: "api_payout", label: "API Payout", description: "API-based clearing and settlement", icon: Banknote },
  { value: "swift_payout", label: "SWIFT Payout", description: "Traditional SWIFT MT103/MT202 processing", icon: ArrowLeftRight },
  { value: "multi_currency_account", label: "Multi-Currency Account", description: "Embedded multi-currency e-money accounts", icon: Wallet },
  { value: "platform_payout", label: "Platform Payout", description: "Marketplace disbursements to sellers/merchants", icon: CreditCard },
];

const ACTOR_OPTIONS: { value: Actor; label: string; description: string; icon: typeof Users }[] = [
  { value: "your_firm", label: "Your Firm", description: "Your regulated entity", icon: Building2 },
  { value: "partner", label: "Partner", description: "The partner institution or platform", icon: UserCheck },
  { value: "correspondent_bank", label: "Correspondent Bank", description: "Intermediary bank in payment chain", icon: Landmark },
  { value: "beneficiary_bank", label: "Beneficiary Bank", description: "Recipient's bank", icon: Landmark },
  { value: "end_customer", label: "End Customer", description: "The ultimate payer or payee", icon: Users },
  { value: "platform_operator", label: "Platform Operator", description: "Marketplace or platform entity", icon: ShoppingCart },
  { value: "fx_provider", label: "FX Provider", description: "Foreign exchange provider", icon: Globe },
];

const labels: Record<string, Record<string, string>> = {
  modelType: Object.fromEntries(MODEL_OPTIONS.map((o) => [o.value, o.label])),
  flowType: Object.fromEntries(FLOW_OPTIONS.map((o) => [o.value, o.label])),
};

export default function PartnerControlMapPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<{
    modelType: ModelType | null;
    flowType: FlowType | null;
    actors: Actor[];
    controlOverrides: Record<string, ControlOwnership>;
    dataReceived: string[];
  }>({
    modelType: null,
    flowType: null,
    actors: ["your_firm", "partner"],
    controlOverrides: {},
    dataReceived: [],
  });

  const matchedFlow = useMemo(() => {
    if (!answers.modelType || !answers.flowType) return null;
    return findBestFlow(answers.modelType, answers.flowType);
  }, [answers.modelType, answers.flowType]);

  const canGoNext = useCallback(() => {
    switch (step) {
      case 0: return !!answers.modelType;
      case 1: return !!answers.flowType;
      case 2: return answers.actors.length >= 2;
      case 3: return true;
      case 4: return true;
      default: return false;
    }
  }, [step, answers]);

  const handleNext = useCallback(() => {
    if (step === STEPS.length - 1) {
      const params = new URLSearchParams({
        modelType: answers.modelType!,
        flowType: answers.flowType!,
        actors: answers.actors.join(","),
        controlOverrides: JSON.stringify(answers.controlOverrides),
        dataReceived: answers.dataReceived.join(","),
      });
      router.push(`/partner-control-map/results?${params.toString()}`);
    } else {
      setStep((s) => s + 1);
    }
  }, [step, answers, router]);

  const handleBack = useCallback(() => {
    setStep((s) => Math.max(0, s - 1));
  }, []);

  const toggleActor = (actor: Actor) => {
    setAnswers((a) => ({
      ...a,
      actors: a.actors.includes(actor)
        ? a.actors.filter((x) => x !== actor)
        : [...a.actors, actor],
    }));
  };

  const toggleDataField = (fieldId: string) => {
    setAnswers((a) => ({
      ...a,
      dataReceived: a.dataReceived.includes(fieldId)
        ? a.dataReceived.filter((x) => x !== fieldId)
        : [...a.dataReceived, fieldId],
    }));
  };

  const setControlOwner = (controlId: string, owner: ControlOwnership) => {
    setAnswers((a) => ({
      ...a,
      controlOverrides: { ...a.controlOverrides, [controlId]: owner },
    }));
  };

  const previewItems = [
    { label: "Partner Model", value: answers.modelType ? labels.modelType[answers.modelType] : null },
    { label: "Flow Type", value: answers.flowType ? labels.flowType[answers.flowType] : null },
    { label: "Actors", value: answers.actors.length > 0 ? `${answers.actors.length} selected` : null },
    { label: "Controls Reviewed", value: Object.keys(answers.controlOverrides).length > 0 ? `${Object.keys(answers.controlOverrides).length} overrides` : null },
    { label: "Data Fields", value: answers.dataReceived.length > 0 ? `${answers.dataReceived.length} received` : null },
  ];

  const ownershipOptions: { value: ControlOwnership; label: string }[] = [
    { value: "your_firm", label: "Your Firm" },
    { value: "partner", label: "Partner" },
    { value: "shared", label: "Shared" },
    { value: "gap", label: "Gap" },
  ];

  return (
    <ToolFrame>
      <main className="flex-1">
        <WizardShell
          steps={STEPS}
          currentStep={step}
          canGoNext={canGoNext()}
          onBack={handleBack}
          onNext={handleNext}
          isLastStep={step === STEPS.length - 1}
          sidebar={<LivePreview title="Your Configuration" items={previewItems} />}
        >
          {step === 0 && (
            <WizardStep
              title="What type of partner relationship?"
              subtitle="This determines the control ownership template and risk profile."
            >
              {MODEL_OPTIONS.map((opt) => (
                <OptionCard
                  key={opt.value}
                  value={opt.value}
                  label={opt.label}
                  description={opt.description}
                  icon={opt.icon}
                  selected={answers.modelType === opt.value}
                  onSelect={(v) => setAnswers((a) => ({ ...a, modelType: v as ModelType }))}
                />
              ))}
            </WizardStep>
          )}

          {step === 1 && (
            <WizardStep
              title="Which payment flow type?"
              subtitle="Select the specific payment flow you are assessing."
            >
              {FLOW_OPTIONS.map((opt) => (
                <OptionCard
                  key={opt.value}
                  value={opt.value}
                  label={opt.label}
                  description={opt.description}
                  icon={opt.icon}
                  selected={answers.flowType === opt.value}
                  onSelect={(v) => setAnswers((a) => ({ ...a, flowType: v as FlowType }))}
                />
              ))}
            </WizardStep>
          )}

          {step === 2 && (
            <WizardStep
              title="Who are the actors in this flow?"
              subtitle="Select all parties involved in the payment chain."
            >
              {ACTOR_OPTIONS.map((opt) => (
                <OptionCard
                  key={opt.value}
                  value={opt.value}
                  label={opt.label}
                  description={opt.description}
                  icon={opt.icon}
                  selected={answers.actors.includes(opt.value)}
                  onSelect={() => toggleActor(opt.value)}
                />
              ))}
            </WizardStep>
          )}

          {step === 3 && (
            <WizardStep
              title="Review control ownership"
              subtitle="Adjust who owns each control. Mark as 'Gap' if no one currently owns it."
            >
              {matchedFlow ? (
                <div className="space-y-3">
                  {matchedFlow.controlOwnershipTemplate.map((ctrl) => {
                    const currentOwner = answers.controlOverrides[ctrl.id] || ctrl.defaultOwner;
                    return (
                      <div key={ctrl.id} className="glass-card rounded-xl p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">{ctrl.control}</p>
                            <p className="text-xs text-text-muted mt-0.5">{ctrl.description}</p>
                            <span className="text-xs text-accent mt-1 inline-block">{ctrl.category}</span>
                          </div>
                          <select
                            value={currentOwner}
                            onChange={(e) => setControlOwner(ctrl.id, e.target.value as ControlOwnership)}
                            className="shrink-0 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-foreground cursor-pointer"
                          >
                            {ownershipOptions.map((o) => (
                              <option key={o.value} value={o.value} className="bg-navy-mid text-foreground">
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-text-muted text-sm">No matching flow found. Go back and adjust your selections.</p>
              )}
            </WizardStep>
          )}

          {step === 4 && (
            <WizardStep
              title="Which data fields do you receive from the partner?"
              subtitle="Check the fields your partner provides. Unchecked required fields will be flagged as data gaps."
            >
              {matchedFlow ? (
                <div className="space-y-2">
                  {matchedFlow.dataFieldsTemplate.map((field) => (
                    <label
                      key={field.id}
                      className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        answers.dataReceived.includes(field.id)
                          ? "border-accent bg-accent/5"
                          : "border-white/10 bg-white/[0.02] hover:border-white/20"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={answers.dataReceived.includes(field.id)}
                        onChange={() => toggleDataField(field.id)}
                        className="mt-1 rounded border-white/20 text-accent focus:ring-accent bg-transparent"
                      />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {field.field}
                          {field.required && (
                            <span className="text-red-400 ml-1 text-xs">*required</span>
                          )}
                        </p>
                        <p className="text-xs text-text-muted">{field.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-text-muted text-sm">No matching flow found.</p>
              )}
            </WizardStep>
          )}
        </WizardShell>
      </main>
      </ToolFrame>
  );
}

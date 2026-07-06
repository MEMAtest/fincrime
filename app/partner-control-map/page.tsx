"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Building2, Users, ShieldCheck,
  Globe, Banknote, CreditCard, Wallet, ShoppingCart,
  UserCheck, Landmark, ArrowLeftRight, Radio,
} from "lucide-react";
import { track } from "@vercel/analytics";
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

// Shared ownership colour language, reused on the results page so the metaphor
// survives submit. Segments carry text labels too (not colour alone).
const OWNERS: {
  value: ControlOwnership; label: string; dot: string; active: string; chip: string; count: string;
}[] = [
  { value: "your_firm", label: "Your firm", dot: "bg-blue-500", active: "bg-blue-500 text-white border-blue-500", chip: "bg-blue-500/10 text-blue-500 border-blue-500/30", count: "text-blue-500" },
  { value: "shared", label: "Shared", dot: "bg-amber-500", active: "bg-amber-500 text-white border-amber-500", chip: "bg-amber-500/10 text-amber-500 border-amber-500/30", count: "text-amber-500" },
  { value: "partner", label: "Partner", dot: "bg-teal-500", active: "bg-teal-500 text-white border-teal-500", chip: "bg-teal-500/10 text-teal-500 border-teal-500/30", count: "text-teal-500" },
  { value: "gap", label: "Gap", dot: "bg-red-500", active: "bg-red-500 text-white border-red-500", chip: "bg-red-500/10 text-red-500 border-red-500/30", count: "text-red-500" },
];

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

  // One-tap select/clear for data fields (nothing is pre-checked, so the gap
  // analysis stays honest until the user says what they actually receive).
  const setDataFields = (ids: string[], on: boolean) => {
    setAnswers((a) => {
      const set = new Set(a.dataReceived);
      ids.forEach((id) => (on ? set.add(id) : set.delete(id)));
      return { ...a, dataReceived: [...set] };
    });
  };

  const setControlOwner = (controlId: string, owner: ControlOwnership) => {
    track("partner_owner_set", { owner });
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
              title="Who owns each control?"
              subtitle="Each control starts on the template's default owner. Reassign any of them, and mark a control as 'Gap' where no one currently owns it. The map and the counts update as you go."
            >
              {matchedFlow ? (
                (() => {
                  const controls = matchedFlow.controlOwnershipTemplate;
                  const ownerOf = (c: typeof controls[number]): ControlOwnership =>
                    answers.controlOverrides[c.id] || c.defaultOwner;
                  const dist: Record<ControlOwnership, number> = { your_firm: 0, shared: 0, partner: 0, gap: 0 };
                  controls.forEach((c) => { dist[ownerOf(c)]++; });
                  const categories = [...new Set(controls.map((c) => c.category))];
                  return (
                    <div>
                      {/* Sticky live distribution strip */}
                      <div className="sticky top-0 z-10 -mx-1 mb-4 rounded-xl border border-surface-border bg-background/90 backdrop-blur px-4 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-1">
                        {OWNERS.map((o) => (
                          <span key={o.value} className="inline-flex items-center gap-1.5 text-sm">
                            <span className={`h-2.5 w-2.5 rounded-full ${o.dot}`} />
                            <span className={`font-semibold ${o.value === "gap" && dist.gap > 0 ? "text-red-500" : "text-foreground"}`}>{dist[o.value]}</span>
                            <span className="text-text-muted">{o.label}</span>
                          </span>
                        ))}
                      </div>

                      {/* Swimlane map: control chips grouped under their current owner */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                        {OWNERS.map((o) => {
                          const items = controls.filter((c) => ownerOf(c) === o.value);
                          return (
                            <div key={o.value} className={`rounded-xl border p-3 ${o.value === "gap" && items.length ? "border-red-500/40" : "border-surface-border"}`}>
                              <div className="flex items-center justify-between mb-2">
                                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
                                  <span className={`h-2 w-2 rounded-full ${o.dot}`} />{o.label}
                                </span>
                                <span className={`text-xs font-bold ${o.count}`}>{items.length}</span>
                              </div>
                              <div className="space-y-1">
                                {items.map((c) => (
                                  <div key={c.id} className={`text-[11px] px-2 py-1 rounded border truncate ${o.chip}`} title={c.control}>{c.control}</div>
                                ))}
                                {items.length === 0 && <p className="text-[11px] text-text-muted/60">None</p>}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Per-category editor rows with a colour-coded segmented toggle */}
                      <div className="space-y-5">
                        {categories.map((cat) => (
                          <div key={cat}>
                            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">{cat}</p>
                            <div className="space-y-2">
                              {controls.filter((c) => c.category === cat).map((ctrl) => {
                                const current = ownerOf(ctrl);
                                return (
                                  <div key={ctrl.id} className="glass-card rounded-xl p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium text-foreground">{ctrl.control}</p>
                                      <p className="text-xs text-text-muted mt-0.5">{ctrl.description}</p>
                                    </div>
                                    <div role="radiogroup" aria-label={`Owner for ${ctrl.control}`} className="flex flex-wrap gap-1 shrink-0">
                                      {OWNERS.map((o) => {
                                        const active = current === o.value;
                                        return (
                                          <button
                                            key={o.value}
                                            role="radio"
                                            aria-checked={active}
                                            onClick={() => setControlOwner(ctrl.id, o.value)}
                                            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${active ? o.active : "border-surface-border bg-white/5 text-text-muted hover:bg-white/10"}`}
                                          >
                                            {o.label}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()
              ) : (
                <p className="text-text-muted text-sm">No matching flow found. Go back and adjust your selections.</p>
              )}
            </WizardStep>
          )}

          {step === 4 && (
            <WizardStep
              title="Which data fields do you receive from the partner?"
              subtitle="Nothing is ticked to start with, so the gap check stays honest. Tick what you actually receive, or use 'Select all required' if you get the full set."
            >
              {matchedFlow ? (
                (() => {
                  const fields = matchedFlow.dataFieldsTemplate;
                  const requiredIds = fields.filter((f) => f.required).map((f) => f.id);
                  const allRequiredOn = requiredIds.every((id) => answers.dataReceived.includes(id));
                  const groups = [...new Set(fields.map((f) => f.source))].map((src) => ({
                    src,
                    items: fields.filter((f) => f.source === src),
                  }));
                  return (
                    <div>
                      {/* One-tap actions */}
                      <div className="flex flex-wrap items-center gap-2 mb-4">
                        <button
                          onClick={() => { track("partner_data_select_all", { on: !allRequiredOn }); setDataFields(requiredIds, !allRequiredOn); }}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-accent text-white hover:bg-accent-hover transition-colors cursor-pointer"
                        >
                          {allRequiredOn ? "Unselect all required" : "Select all required"}
                        </button>
                        {answers.dataReceived.length > 0 && (
                          <button
                            onClick={() => setDataFields(fields.map((f) => f.id), false)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-surface-border bg-white/5 text-text-muted hover:bg-white/10 transition-colors cursor-pointer"
                          >
                            Clear all
                          </button>
                        )}
                        <span className="text-xs text-text-muted ml-auto">
                          {answers.dataReceived.length} of {fields.length} received
                        </span>
                      </div>

                      {/* Grouped multi-select cards */}
                      <div className="space-y-5">
                        {groups.map((g) => {
                          const groupIds = g.items.map((f) => f.id);
                          const allOn = groupIds.every((id) => answers.dataReceived.includes(id));
                          return (
                            <div key={g.src}>
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">{g.src}</p>
                                <button
                                  onClick={() => setDataFields(groupIds, !allOn)}
                                  className="text-xs font-medium text-accent hover:underline cursor-pointer"
                                >
                                  {allOn ? "Clear group" : "Select group"}
                                </button>
                              </div>
                              <div className="grid gap-2 sm:grid-cols-2">
                                {g.items.map((field) => {
                                  const checked = answers.dataReceived.includes(field.id);
                                  return (
                                    <button
                                      key={field.id}
                                      type="button"
                                      aria-pressed={checked}
                                      onClick={() => toggleDataField(field.id)}
                                      className={`w-full text-left p-3 rounded-xl border-2 transition-all cursor-pointer ${
                                        checked ? "border-accent bg-accent/5" : "border-white/10 bg-white/[0.02] hover:border-white/20"
                                      }`}
                                    >
                                      <div className="flex items-start gap-3">
                                        <span className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${checked ? "border-accent bg-accent" : "border-white/20"}`}>
                                          {checked && <ShieldCheck className="h-3 w-3 text-white" />}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                          <p className="text-sm font-medium text-foreground flex items-center flex-wrap gap-2">
                                            {field.field}
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${field.required ? "bg-red-500/10 text-red-500" : "bg-white/10 text-text-muted"}`}>
                                              {field.required ? "Required" : "Suggested"}
                                            </span>
                                          </p>
                                          <p className="text-xs text-text-muted mt-0.5">{field.description}</p>
                                        </div>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()
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

"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Building2, CreditCard, Users, AlertTriangle, FileText,
  Landmark, Wallet, Globe, Banknote, ShieldAlert, Scale,
  UserCheck, Briefcase, Crown, Heart, HandshakeIcon,
  Bomb, DollarSign, ShieldOff, Search as SearchIcon, Megaphone,
  BarChart3, Coins, Check,
} from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import RiskThemeIcon from "@/components/icons/RiskThemeIcon";
import WizardShell from "@/components/wizard/WizardShell";
import WizardStep from "@/components/wizard/WizardStep";
import OptionCard from "@/components/wizard/OptionCard";
import LivePreview from "@/components/wizard/LivePreview";
import type { FirmType, ProductType, CustomerType, RiskTheme } from "@/data/typologies/types";

const STEPS = ["Firm Type", "Product", "Customer", "Risk Themes", "Confirm"];

const FIRM_OPTIONS: { value: FirmType; label: string; description: string; icon: typeof Building2 }[] = [
  { value: "emi", label: "E-Money Institution (EMI)", description: "Authorised to issue electronic money and provide payment services", icon: Wallet },
  { value: "pi", label: "Payment Institution (PI)", description: "Authorised to execute payment transactions and transfers", icon: Banknote },
  { value: "bank", label: "Bank / Credit Institution", description: "Deposit-taking and lending institution", icon: Landmark },
  { value: "msb", label: "Money Service Business (MSB)", description: "Provides money transmission, currency exchange, or cheque cashing", icon: Globe },
  { value: "crypto", label: "Crypto Asset Service Provider", description: "Registered for crypto exchange or custodian services", icon: Coins },
  { value: "neobank", label: "Neobank / Digital Bank", description: "Digital-first banking or payments platform", icon: CreditCard },
  { value: "wealth_manager", label: "Wealth Manager", description: "Investment advisory and portfolio management", icon: BarChart3 },
  { value: "insurance", label: "Insurance Provider", description: "General or life insurance underwriting", icon: ShieldAlert },
];

const PRODUCT_OPTIONS: { value: ProductType; label: string; description: string; icon: typeof CreditCard }[] = [
  { value: "cross_border_payments", label: "Cross-Border Payments", description: "International fund transfers and FX payments", icon: Globe },
  { value: "domestic_payments", label: "Domestic Payments", description: "UK faster payments, BACS, CHAPS", icon: Banknote },
  { value: "e_money_accounts", label: "E-Money Accounts", description: "Stored value accounts and prepaid wallets", icon: Wallet },
  { value: "remittance", label: "Remittance", description: "Personal money transfers to other countries", icon: Globe },
  { value: "trade_finance", label: "Trade Finance", description: "Letters of credit, invoicing, supply chain finance", icon: FileText },
  { value: "fx_transfers", label: "FX Transfers", description: "Foreign exchange and currency conversion", icon: DollarSign },
  { value: "card_issuing", label: "Card Issuing", description: "Debit, prepaid, or credit card programmes", icon: CreditCard },
  { value: "marketplace_payouts", label: "Marketplace Payouts", description: "Platform disbursements to merchants or sellers", icon: Briefcase },
  { value: "crypto_exchange", label: "Crypto Exchange", description: "Fiat-to-crypto or crypto-to-crypto trading", icon: Coins },
  { value: "lending", label: "Lending", description: "Consumer or business lending products", icon: Landmark },
];

const CUSTOMER_OPTIONS: { value: CustomerType; label: string; description: string; icon: typeof Users }[] = [
  { value: "individuals", label: "Individuals", description: "Personal accounts and retail customers", icon: UserCheck },
  { value: "smes", label: "SMEs", description: "Small and medium-sized enterprises", icon: Briefcase },
  { value: "corporates", label: "Corporates", description: "Large corporate entities and institutions", icon: Building2 },
  { value: "high_net_worth", label: "High Net Worth Individuals", description: "HNWIs with complex financial arrangements", icon: Crown },
  { value: "politically_exposed", label: "PEPs & Associates", description: "Politically exposed persons and their associates", icon: Megaphone },
  { value: "non_profit", label: "Non-Profit / Charities", description: "Charitable organisations and NGOs", icon: Heart },
  { value: "agents_intermediaries", label: "Agents & Intermediaries", description: "Third-party agents, brokers, and intermediaries", icon: HandshakeIcon },
];

const RISK_THEME_OPTIONS: { value: RiskTheme; label: string; description: string; icon: typeof AlertTriangle }[] = [
  { value: "terrorist_financing", label: "Terrorist Financing", description: "Financing of terrorism and related activities", icon: Bomb },
  { value: "money_laundering", label: "Money Laundering", description: "Placement, layering, and integration of criminal proceeds", icon: DollarSign },
  { value: "sanctions_evasion", label: "Sanctions Evasion", description: "Circumvention of OFSI, OFAC, EU, or UN sanctions", icon: ShieldOff },
  { value: "fraud", label: "Fraud", description: "Financial fraud, APP fraud, and deception", icon: AlertTriangle },
  { value: "tax_evasion", label: "Tax Evasion", description: "Criminal evasion of tax obligations", icon: Scale },
  { value: "bribery_corruption", label: "Bribery & Corruption", description: "Facilitation of bribery or corrupt payments", icon: Crown },
  { value: "proliferation_financing", label: "Proliferation Financing", description: "Financing of weapons of mass destruction programmes", icon: SearchIcon },
];

const RISK_THEME_LABEL: Record<RiskTheme, string> = Object.fromEntries(
  RISK_THEME_OPTIONS.map((o) => [o.value, o.label])
) as Record<RiskTheme, string>;

const labels: Record<string, Record<string, string>> = {
  firmType: Object.fromEntries(FIRM_OPTIONS.map((o) => [o.value, o.label])),
  product: Object.fromEntries(PRODUCT_OPTIONS.map((o) => [o.value, o.label])),
  customerType: Object.fromEntries(CUSTOMER_OPTIONS.map((o) => [o.value, o.label])),
};

function TypologyIQWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<{
    firmType: FirmType | null;
    product: ProductType | null;
    customerType: CustomerType | null;
    riskThemes: RiskTheme[];
  }>({
    firmType: null,
    product: null,
    customerType: null,
    riskThemes: [],
  });

  // Allow firm-research and list pages to deep-link prefilled selections.
  useEffect(() => {
    const firmType = searchParams.get("firmType") as FirmType | null;
    const product = searchParams.get("product") as ProductType | null;
    const customerType = searchParams.get("customerType") as CustomerType | null;
    const themesParam = searchParams.get("riskThemes") ?? searchParams.get("riskTheme");
    const riskThemes = themesParam
      ? (themesParam.split(",").filter(Boolean) as RiskTheme[])
      : [];
    if (firmType || product || customerType || riskThemes.length > 0) {
      setAnswers((a) => ({
        firmType: firmType ?? a.firmType,
        product: product ?? a.product,
        customerType: customerType ?? a.customerType,
        riskThemes: riskThemes.length > 0 ? riskThemes : a.riskThemes,
      }));
    }
  }, [searchParams]);

  const toggleTheme = useCallback((theme: RiskTheme) => {
    setAnswers((a) => ({
      ...a,
      riskThemes: a.riskThemes.includes(theme)
        ? a.riskThemes.filter((t) => t !== theme)
        : [...a.riskThemes, theme],
    }));
  }, []);

  const canGoNext = useCallback(() => {
    switch (step) {
      case 0: return !!answers.firmType;
      case 1: return !!answers.product;
      case 2: return !!answers.customerType;
      case 3: return answers.riskThemes.length > 0;
      case 4: return true;
      default: return false;
    }
  }, [step, answers]);

  const handleNext = useCallback(() => {
    if (step === STEPS.length - 1) {
      const params = new URLSearchParams({
        firmType: answers.firmType!,
        product: answers.product!,
        customerType: answers.customerType!,
        riskThemes: answers.riskThemes.join(","),
      });
      router.push(`/typology-iq/results?${params.toString()}`);
    } else {
      setStep((s) => s + 1);
    }
  }, [step, answers, router]);

  const handleBack = useCallback(() => {
    setStep((s) => Math.max(0, s - 1));
  }, []);

  const themesLabel = answers.riskThemes.length > 0
    ? answers.riskThemes.map((t) => RISK_THEME_LABEL[t]).join(", ")
    : null;

  const previewItems = [
    { label: "Firm Type", value: answers.firmType ? labels.firmType[answers.firmType] : null },
    { label: "Product", value: answers.product ? labels.product[answers.product] : null },
    { label: "Customer Type", value: answers.customerType ? labels.customerType[answers.customerType] : null },
    { label: "Risk Themes", value: themesLabel },
  ];

  return (
    <WizardShell
      steps={STEPS}
      currentStep={step}
      canGoNext={canGoNext()}
      onBack={handleBack}
      onNext={handleNext}
      isLastStep={step === STEPS.length - 1}
      sidebar={<LivePreview title="Your Selection" items={previewItems} />}
    >
      {step === 0 && (
        <WizardStep
          title="What type of firm are you?"
          subtitle="This determines which typologies are most applicable to your regulated activities."
        >
          {FIRM_OPTIONS.map((opt) => (
            <OptionCard
              key={opt.value}
              value={opt.value}
              label={opt.label}
              description={opt.description}
              icon={opt.icon}
              selected={answers.firmType === opt.value}
              onSelect={(v) => setAnswers((a) => ({ ...a, firmType: v as FirmType }))}
            />
          ))}
        </WizardStep>
      )}

      {step === 1 && (
        <WizardStep
          title="Which product or service?"
          subtitle="Select the primary product or service you want to assess for financial crime risk."
        >
          {PRODUCT_OPTIONS.map((opt) => (
            <OptionCard
              key={opt.value}
              value={opt.value}
              label={opt.label}
              description={opt.description}
              icon={opt.icon}
              selected={answers.product === opt.value}
              onSelect={(v) => setAnswers((a) => ({ ...a, product: v as ProductType }))}
            />
          ))}
        </WizardStep>
      )}

      {step === 2 && (
        <WizardStep
          title="Who are your primary customers?"
          subtitle="Select the main customer segment for this product."
        >
          {CUSTOMER_OPTIONS.map((opt) => (
            <OptionCard
              key={opt.value}
              value={opt.value}
              label={opt.label}
              description={opt.description}
              icon={opt.icon}
              selected={answers.customerType === opt.value}
              onSelect={(v) => setAnswers((a) => ({ ...a, customerType: v as CustomerType }))}
            />
          ))}
        </WizardStep>
      )}

      {step === 3 && (
        <WizardStep
          title="Which risk themes concern you?"
          subtitle="Select one or more financial crime risk categories. Multiple selections broaden the matched typologies."
        >
          <div className="mb-3 flex items-center justify-between text-xs text-text-muted">
            <span>{answers.riskThemes.length} selected</span>
            {answers.riskThemes.length > 0 && (
              <button
                type="button"
                onClick={() => setAnswers((a) => ({ ...a, riskThemes: [] }))}
                className="text-accent hover:underline cursor-pointer"
              >
                Clear all
              </button>
            )}
          </div>
          {RISK_THEME_OPTIONS.map((opt) => {
            const selected = answers.riskThemes.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleTheme(opt.value)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                  selected
                    ? "border-accent bg-accent/5 shadow-md shadow-accent/10"
                    : "border-card-border bg-white/[0.02] hover:border-accent/40 hover:bg-white/[0.04]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0">
                    <RiskThemeIcon
                      riskTheme={opt.value}
                      size="md"
                      animated={selected}
                    />
                  </div>
                  <div className="min-w-0 pt-1">
                    <p
                      className={`text-sm font-medium ${
                        selected ? "text-accent" : "text-foreground"
                      }`}
                    >
                      {opt.label}
                    </p>
                    {opt.description && (
                      <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
                        {opt.description}
                      </p>
                    )}
                  </div>
                  <div
                    className={`ml-auto w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-3 ${
                      selected ? "border-accent bg-accent" : "border-card-border"
                    }`}
                  >
                    {selected && <Check className="h-3 w-3 text-white" />}
                  </div>
                </div>
              </button>
            );
          })}
        </WizardStep>
      )}

      {step === 4 && (
        <WizardStep
          title="Confirm your selections"
          subtitle="Review your choices before generating the control framework."
        >
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

export default function TypologyIQPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Suspense fallback={<div className="text-center py-20 text-text-muted">Loading wizard...</div>}>
          <TypologyIQWizard />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}

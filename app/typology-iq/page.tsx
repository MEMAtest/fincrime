"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Building2, CreditCard, Users, AlertTriangle, FileText,
  Landmark, Wallet, Globe, Banknote, ShieldAlert, Scale,
  UserCheck, Briefcase, Crown, Heart, HandshakeIcon,
  Bomb, DollarSign, ShieldOff, Search as SearchIcon, Megaphone,
  BarChart3, Coins,
} from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import RiskThemeIcon from "@/components/icons/RiskThemeIcon";
import WizardShell from "@/components/wizard/WizardShell";
import WizardStep from "@/components/wizard/WizardStep";
import OptionCard from "@/components/wizard/OptionCard";
import LivePreview from "@/components/wizard/LivePreview";
import type { FirmType, ProductType, CustomerType, RiskTheme } from "@/data/typologies/types";

const STEPS = ["Firm Type", "Product", "Customer", "Risk Theme", "Confirm"];

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

const labels: Record<string, Record<string, string>> = {
  firmType: Object.fromEntries(FIRM_OPTIONS.map((o) => [o.value, o.label])),
  product: Object.fromEntries(PRODUCT_OPTIONS.map((o) => [o.value, o.label])),
  customerType: Object.fromEntries(CUSTOMER_OPTIONS.map((o) => [o.value, o.label])),
  riskTheme: Object.fromEntries(RISK_THEME_OPTIONS.map((o) => [o.value, o.label])),
};

export default function TypologyIQPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<{
    firmType: FirmType | null;
    product: ProductType | null;
    customerType: CustomerType | null;
    riskTheme: RiskTheme | null;
  }>({
    firmType: null,
    product: null,
    customerType: null,
    riskTheme: null,
  });

  const canGoNext = useCallback(() => {
    switch (step) {
      case 0: return !!answers.firmType;
      case 1: return !!answers.product;
      case 2: return !!answers.customerType;
      case 3: return !!answers.riskTheme;
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
        riskTheme: answers.riskTheme!,
      });
      router.push(`/typology-iq/results?${params.toString()}`);
    } else {
      setStep((s) => s + 1);
    }
  }, [step, answers, router]);

  const handleBack = useCallback(() => {
    setStep((s) => Math.max(0, s - 1));
  }, []);

  const previewItems = [
    { label: "Firm Type", value: answers.firmType ? labels.firmType[answers.firmType] : null },
    { label: "Product", value: answers.product ? labels.product[answers.product] : null },
    { label: "Customer Type", value: answers.customerType ? labels.customerType[answers.customerType] : null },
    { label: "Risk Theme", value: answers.riskTheme ? labels.riskTheme[answers.riskTheme] : null },
  ];

  return (
    <>
      <Header />
      <main className="flex-1">
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
              title="Which risk theme concerns you most?"
              subtitle="This focuses the assessment on a specific financial crime risk category."
            >
              {RISK_THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAnswers((a) => ({ ...a, riskTheme: opt.value as RiskTheme }))}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                    answers.riskTheme === opt.value
                      ? "border-accent bg-accent/5 shadow-md shadow-accent/10"
                      : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="shrink-0">
                      <RiskThemeIcon
                        riskTheme={opt.value}
                        size="md"
                        animated={answers.riskTheme === opt.value}
                      />
                    </div>
                    <div className="min-w-0 pt-1">
                      <p
                        className={`text-sm font-medium ${
                          answers.riskTheme === opt.value ? "text-accent" : "text-foreground"
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
                      className={`ml-auto w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-3 ${
                        answers.riskTheme === opt.value ? "border-accent bg-accent" : "border-white/20"
                      }`}
                    >
                      {answers.riskTheme === opt.value && (
                        <div className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </WizardStep>
          )}

          {step === 4 && (
            <WizardStep
              title="Confirm your selections"
              subtitle="Review your choices before generating the control framework."
            >
              <div className="glass-card rounded-xl p-6 space-y-4">
                {previewItems.map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <span className="text-sm text-text-muted">{item.label}</span>
                    <span className="text-sm font-medium text-foreground">{item.value}</span>
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

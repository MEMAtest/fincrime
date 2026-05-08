"use client";

interface WizardStepProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export default function WizardStep({ title, subtitle, children }: WizardStepProps) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground mb-1">{title}</h2>
      {subtitle && (
        <p className="text-sm text-text-muted mb-6">{subtitle}</p>
      )}
      <div className="space-y-3">{children}</div>
    </div>
  );
}

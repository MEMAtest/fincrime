import type { ReactNode } from "react";

interface ToolPageHeaderProps {
  eyebrow: string;
  title: string;
  titleAccent?: string;
  subtitle?: string;
  actions?: ReactNode;
}

/**
 * Consistent Deep Field page header used across all tool and reference pages.
 * Renders the mono .tech eyebrow + hairline marker, display H1 (with optional
 * gradient accent span), sub-copy, and an optional actions slot.
 */
export default function ToolPageHeader({ eyebrow, title, titleAccent, subtitle, actions }: ToolPageHeaderProps) {
  return (
    <div className="mb-8">
      <div className="marker mb-4">
        <span className="tech">
          <span className="ix">◇</span>
          <span className="bar" />
          {eyebrow}
        </span>
        <span className="rule" />
      </div>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            {titleAccent ? (
              <>
                {title} <span className="gradient-text">{titleAccent}</span>
              </>
            ) : (
              title
            )}
          </h1>
          {subtitle && (
            <p className="mt-2 text-text-muted max-w-2xl text-sm sm:text-base leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
        {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

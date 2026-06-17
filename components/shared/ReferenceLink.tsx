"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import ReferenceModal from "./ReferenceModal";

/**
 * A reference that does NOT navigate off-site. Renders a link-styled control
 * that opens the shared in-site ReferenceModal (source + copyable URL),
 * honouring the "don't link out of the site at all" rule.
 */
interface ReferenceLinkProps {
  url: string;
  /** Visible text on the control. */
  label: string;
  /** Modal heading (defaults to label). */
  heading?: string;
  /** Class names to match the call site's existing styling. */
  className?: string;
  /** Show the small reference glyph next to the label. */
  showIcon?: boolean;
}

export default function ReferenceLink({ url, label, heading, className, showIcon }: ReferenceLinkProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <span
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={`cursor-pointer ${className ?? ""}`}
        aria-haspopup="dialog"
      >
        {label}
        {showIcon && <ExternalLink className="h-3 w-3 opacity-70" />}
      </span>
      <ReferenceModal open={open} onClose={() => setOpen(false)} heading={heading ?? label} url={url} />
    </>
  );
}

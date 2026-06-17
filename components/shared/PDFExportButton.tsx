"use client";

import { useState } from "react";
import { Download, ChevronDown, FileText, FileType } from "lucide-react";
import Button from "@/components/ui/Button";
import LeadCaptureModal from "./LeadCaptureModal";

export type PDFModule =
  | "typology_iq"
  | "partner_control_map"
  | "screening_controls"
  | "controls_maturity"
  | "kyc_requirements";

export type ExportFormat = "pdf" | "docx";

interface PDFExportButtonProps {
  module: PDFModule;
  assessmentData: Record<string, unknown>;
  /** Offered export formats. Defaults to PDF only; pass ["pdf","docx"] for a dropdown. */
  formats?: ExportFormat[];
}

export default function PDFExportButton({ module, assessmentData, formats = ["pdf"] }: PDFExportButtonProps) {
  const [format, setFormat] = useState<ExportFormat | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const open = (f: ExportFormat) => {
    setMenuOpen(false);
    setFormat(f);
  };

  const modal = (
    <LeadCaptureModal
      open={format !== null}
      onClose={() => setFormat(null)}
      module={module}
      assessmentData={assessmentData}
      format={format ?? "pdf"}
    />
  );

  if (formats.length <= 1) {
    return (
      <>
        <Button variant="secondary" size="sm" onClick={() => open(formats[0] ?? "pdf")}>
          <Download className="h-4 w-4" />
          Export
        </Button>
        {modal}
      </>
    );
  }

  return (
    <div className="relative">
      <Button variant="secondary" size="sm" onClick={() => setMenuOpen((o) => !o)}>
        <Download className="h-4 w-4" />
        Export
        <ChevronDown className="h-3.5 w-3.5" />
      </Button>
      {menuOpen && (
        <>
          <button aria-hidden className="fixed inset-0 z-40 cursor-default" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 mt-1 z-50 w-44 rounded-lg border border-surface-border bg-background shadow-lg overflow-hidden">
            <button onClick={() => open("pdf")} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-foreground hover:bg-surface-hover">
              <FileText className="h-4 w-4 text-accent" /> Export as PDF
            </button>
            <button onClick={() => open("docx")} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-foreground hover:bg-surface-hover">
              <FileType className="h-4 w-4 text-accent" /> Export as Word
            </button>
          </div>
        </>
      )}
      {modal}
    </div>
  );
}

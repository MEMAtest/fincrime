"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import Button from "@/components/ui/Button";
import LeadCaptureModal from "./LeadCaptureModal";

interface PDFExportButtonProps {
  module: "typology_iq" | "partner_control_map";
  assessmentData: Record<string, unknown>;
}

export default function PDFExportButton({ module, assessmentData }: PDFExportButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setModalOpen(true)}>
        <Download className="h-4 w-4" />
        Export PDF
      </Button>
      <LeadCaptureModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        module={module}
        assessmentData={assessmentData}
      />
    </>
  );
}

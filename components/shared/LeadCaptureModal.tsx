"use client";

import { useState } from "react";
import Link from "next/link";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { Download, Loader2 } from "lucide-react";
import type { PDFModule, ExportFormat } from "./PDFExportButton";

const MODULE_LABEL: Record<PDFModule, string> = {
  typology_iq: "TypologyIQ",
  partner_control_map: "PartnerControlMap",
  screening_controls: "ScreeningControlDesigner",
  controls_maturity: "ControlsMaturity",
  kyc_requirements: "KYCRequirements",
  control_register: "ControlRegister",
};

interface LeadCaptureModalProps {
  open: boolean;
  onClose: () => void;
  module: PDFModule;
  assessmentData: Record<string, unknown>;
  format?: ExportFormat;
  onSuccess?: () => void;
}

export default function LeadCaptureModal({
  open,
  onClose,
  module,
  assessmentData,
  format = "pdf",
  onSuccess,
}: LeadCaptureModalProps) {
  const ext = format === "docx" ? "docx" : "pdf";
  const docLabel = format === "docx" ? "Word document" : "PDF";
  const [form, setForm] = useState({
    email: "",
    name: "",
    firmName: "",
    jobTitle: "",
    optIn: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email) {
      setError("Email is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Capture lead
      const leadRes = await fetch("/api/lead/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          module,
          optInNewsletter: form.optIn,
        }),
      });

      if (!leadRes.ok) throw new Error("Failed to submit");

      // 2. Generate and download the document
      const pdfRes = await fetch("/api/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module,
          assessmentData,
          email: form.email,
          format,
        }),
      });

      // Do NOT report success unless the document actually generated and
      // downloaded. Previously success was set even on a failed export, so the
      // user surrendered their email and was told it worked when nothing came.
      if (!pdfRes.ok) throw new Error("export-failed");
      const blob = await pdfRes.blob();
      if (!blob || blob.size === 0) throw new Error("export-empty");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `MEMA-FinCrime-${MODULE_LABEL[module]}-${new Date().toISOString().split("T")[0]}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccess(true);
      onSuccess?.();
    } catch {
      setError("We couldn't generate your document. Your details were received; please try the download again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Modal open={open} onClose={onClose} title="Download Complete">
        <div className="text-center py-4">
          <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
            <Download className="h-6 w-6 text-emerald-600" />
          </div>
          <p className="text-slate-700 mb-2">Your {docLabel} has been downloaded.</p>
          <p className="text-sm text-slate-500">
            A copy has also been sent to your email.
          </p>
          <Button onClick={onClose} className="mt-4">
            Close
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={`Download ${docLabel}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email address *"
          type="email"
          placeholder="you@company.com"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          required
        />
        <Input
          label="Full name"
          placeholder="Jane Smith"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <Input
          label="Firm name"
          placeholder="Your company"
          value={form.firmName}
          onChange={(e) => setForm((f) => ({ ...f, firmName: e.target.value }))}
        />
        <Input
          label="Job title"
          placeholder="Head of Compliance"
          value={form.jobTitle}
          onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))}
        />

        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.optIn}
            onChange={(e) => setForm((f) => ({ ...f, optIn: e.target.checked }))}
            className="mt-1 rounded border-slate-300 text-accent focus:ring-accent"
          />
          <span className="text-xs text-slate-500">
            I&apos;d like to receive occasional FinCrime insights from MEMA Consultants.
          </span>
        </label>

        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating {docLabel}...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Download {docLabel}
            </>
          )}
        </Button>

        <p className="text-xs text-slate-400 text-center">
          We use these details to send your document and, if you opt in, occasional updates. See our{" "}
          <Link href="/privacy" className="text-accent hover:underline" target="_blank">privacy notice</Link>.
        </p>
      </form>
    </Modal>
  );
}

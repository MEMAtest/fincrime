"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import ToolFrame from "@/components/layout/ToolFrame";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";

interface NewAssessmentClientProps {
  /** Typology slugs carried over via /assess/product-risk/new?typologies=slug-a,slug-b (e.g. from TypologyIQ). */
  typologySlugs: string[];
}

/** Minimal creation form: name + description, then hand off to the 8-step journey. */
export default function NewAssessmentClient({ typologySlugs }: NewAssessmentClientProps) {
  const router = useRouter();
  const { wsFetch } = useWorkspace();
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = productName.trim();
    if (!name) {
      setError("Product name is required.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await wsFetch("/api/pra/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName: name, description: description.trim() || undefined }),
      });
      if (!res.ok) throw new Error("Failed to create assessment");
      const data: unknown = await res.json();
      const id =
        data && typeof data === "object" && (data as { assessment?: { id?: unknown } }).assessment?.id;
      if (typeof id !== "string" || !id) throw new Error("Unexpected response");

      const qs = typologySlugs.length ? `?typologies=${typologySlugs.map(encodeURIComponent).join(",")}` : "";
      router.push(`/assess/product-risk/${id}${qs}`);
    } catch {
      setError("Could not create the assessment. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <ToolFrame
      breadcrumb={[
        { label: "Home", href: "/" },
        { label: "Product Risk Assessments", href: "/assess/product-risk" },
        { label: "New" },
      ]}
    >
      <main className="flex-1">
        <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <h1 className="text-2xl font-bold text-foreground mb-1">New product risk assessment</h1>
          <p className="text-sm text-text-muted mb-6">
            Name the product you want to assess. You&apos;ll fill in the rest of the profile, flows, risks and
            controls over the next few steps.
          </p>

          {typologySlugs.length > 0 && (
            <div className="glass-card rounded-xl p-4 mb-6 text-sm text-text-muted">
              {typologySlugs.length} typolog{typologySlugs.length === 1 ? "y" : "ies"} carried over from TypologyIQ
              will be pre-selected when you reach the inherent risk step.
            </div>
          )}

          <form onSubmit={onSubmit} className="glass-card rounded-2xl p-6 space-y-4">
            <Input
              label="Product name"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="e.g. Cross-border remittance"
              required
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink-soft">Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-lg border border-line-2 bg-surface text-foreground text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
                placeholder="What is this product and who is it for?"
              />
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating..." : "Create assessment"}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </ToolFrame>
  );
}

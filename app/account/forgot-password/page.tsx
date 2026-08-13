"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import ToolFrame from "@/components/layout/ToolFrame";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

/**
 * Requests a password-reset email. Always shows the SAME confirmation on
 * submit regardless of whether the email has an account (see
 * app/api/auth/password-reset/request/route.ts's doc comment) - this page
 * must not react any differently to "email not found" than to "email
 * sent", or the UI itself would leak what the API deliberately does not.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error || "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ToolFrame breadcrumb={[{ label: "Home", href: "/" }, { label: "Account", href: "/account" }, { label: "Forgot password" }]}>
      <div className="max-w-md mx-auto w-full px-4 sm:px-6 py-12">
        <ToolPageHeader eyebrow="ACCOUNT" title="Reset your" titleAccent="password" subtitle="Enter your email and we'll send a link to reset your password." />
        {submitted ? (
          <div className="glass-card rounded-2xl p-6 text-center space-y-3">
            <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mx-auto">
              <Mail className="h-6 w-6 text-accent" />
            </div>
            <p className="text-sm text-foreground">If an account exists for that email, a reset link has been sent.</p>
            <p className="text-xs text-text-muted">Check your inbox. The link expires in 30 minutes.</p>
            <Link href="/account/sign-in" className="text-sm text-accent hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-6 space-y-4">
            {error && <p className="text-sm text-red-500 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Sending..." : "Send reset link"}
            </Button>
            <p className="text-sm text-text-muted text-center">
              <Link href="/account/sign-in" className="text-accent hover:underline">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </ToolFrame>
  );
}

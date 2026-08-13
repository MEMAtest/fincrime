"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound } from "lucide-react";
import ToolFrame from "@/components/layout/ToolFrame";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error || "Could not reset your password. The link may have expired.");
        setSubmitting(false);
        return;
      }
      setSuccess(true);
    } catch {
      setError("Could not reset your password. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="glass-card rounded-2xl p-6 text-center space-y-3">
        <p className="text-sm text-foreground">This reset link is missing its token.</p>
        <Link href="/account/forgot-password" className="text-sm text-accent hover:underline">
          Request a new link
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="glass-card rounded-2xl p-6 text-center space-y-3">
        <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mx-auto">
          <KeyRound className="h-6 w-6 text-accent" />
        </div>
        <p className="text-sm text-foreground">Your password has been reset. Every existing session has been signed out.</p>
        <Button onClick={() => router.push("/account/sign-in")} className="mt-2">
          Sign in
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-6 space-y-4">
      {error && <p className="text-sm text-red-500 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
      <Input
        label="New password"
        type="password"
        autoComplete="new-password"
        required
        minLength={10}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <p className="text-xs text-text-muted">At least 10 characters. Every existing session will be signed out once this succeeds.</p>
      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "Resetting..." : "Reset password"}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <ToolFrame breadcrumb={[{ label: "Home", href: "/" }, { label: "Account", href: "/account" }, { label: "Reset password" }]}>
      <div className="max-w-md mx-auto w-full px-4 sm:px-6 py-12">
        <ToolPageHeader eyebrow="ACCOUNT" title="Set a new" titleAccent="password" />
        <Suspense fallback={<div className="glass-card rounded-2xl p-6 text-sm text-text-muted">Loading...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </ToolFrame>
  );
}

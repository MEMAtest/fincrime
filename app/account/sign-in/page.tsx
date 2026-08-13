"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import ToolFrame from "@/components/layout/ToolFrame";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useAccount } from "@/components/account/AccountProvider";
import { signIn } from "@/lib/auth-client";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { refresh } = useAccount();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await signIn(email, password);
    setSubmitting(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    await refresh();
    router.push("/account");
  };

  return (
    <ToolFrame breadcrumb={[{ label: "Home", href: "/" }, { label: "Account", href: "/account" }, { label: "Sign in" }]}>
      <div className="max-w-md mx-auto w-full px-4 sm:px-6 py-12">
        <ToolPageHeader eyebrow="ACCOUNT" title="Sign" titleAccent="in" subtitle="Access the workspaces your account belongs to." />
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
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" disabled={submitting} className="w-full">
            <LogIn className="h-4 w-4" />
            {submitting ? "Signing in..." : "Sign in"}
          </Button>
          <p className="text-sm text-text-muted text-center">
            No account yet?{" "}
            <Link href="/account/sign-up" className="text-accent hover:underline">
              Create one
            </Link>
          </p>
        </form>
      </div>
    </ToolFrame>
  );
}

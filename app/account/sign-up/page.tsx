"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import ToolFrame from "@/components/layout/ToolFrame";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useAccount } from "@/components/account/AccountProvider";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { signUp } from "@/lib/auth-client";

/**
 * Sign up claims the browser's current anonymous workspace (if one exists)
 * into the new account automatically - the signup route reads the same
 * x-workspace-id / x-workspace-token headers withWorkspace does, so this
 * page just needs to send them, exactly like any other wsFetch call.
 */
export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { refresh } = useAccount();
  const { wsFetch, workspaceId, mode } = useWorkspace();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    // Only send along an anonymous workspace's headers - a session-mode
    // "workspace" isn't a header-token credential to prove possession of,
    // and this browser cannot be signed in twice at once anyway.
    const hasAnonymousWorkspace = mode === "anonymous" && !!workspaceId;
    const result = hasAnonymousWorkspace
      ? await (async () => {
          const response = await wsFetch("/api/auth/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });
          if (!response.ok) {
            const body = await response.json().catch(() => null);
            return { error: (body && body.error) || "Sign up failed" };
          }
          return { ok: true as const };
        })()
      : await signUp(email, password);

    setSubmitting(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    await refresh();
    router.push("/account");
  };

  return (
    <ToolFrame breadcrumb={[{ label: "Home", href: "/" }, { label: "Account", href: "/account" }, { label: "Sign up" }]}>
      <div className="max-w-md mx-auto w-full px-4 sm:px-6 py-12">
        <ToolPageHeader eyebrow="ACCOUNT" title="Create your" titleAccent="account" subtitle="Optional. The free tools work with no account at all - sign up only when you want your work to survive losing this browser." />
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
            autoComplete="new-password"
            required
            minLength={10}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="text-xs text-text-muted">At least 10 characters.</p>
          <Button type="submit" disabled={submitting} className="w-full">
            <UserPlus className="h-4 w-4" />
            {submitting ? "Creating account..." : "Create account"}
          </Button>
          <p className="text-sm text-text-muted text-center">
            Already have an account?{" "}
            <Link href="/account/sign-in" className="text-accent hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </ToolFrame>
  );
}

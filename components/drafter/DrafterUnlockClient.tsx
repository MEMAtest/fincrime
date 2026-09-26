"use client";

import { useRef, useState } from "react";
import ToolFrame from "@/components/layout/ToolFrame";

export default function DrafterUnlockClient() {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/drafter-unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, name }),
      });
      if (res.ok) {
        window.location.href = "/drafter";
        return;
      }
      setError(res.status === 429 ? "Too many attempts. Try again later." : "That key was not accepted.");
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <ToolFrame breadcrumb={[{ label: "Home", href: "/" }, { label: "Access" }]}>
      <main className="flex-1">
        <div className="max-w-md mx-auto px-4 py-12">
          <h1 className="text-2xl font-bold text-foreground mb-2">Access key</h1>
          <p className="text-sm text-text-muted mb-6">Enter the access key. Your name is recorded against the changes you make.</p>
          <form onSubmit={submit} className="glass-card rounded-xl p-5 space-y-4">
            <div>
              <label htmlFor="drafter-name" className="block text-sm font-medium text-foreground mb-1">
                Your name
              </label>
              <input
                id="drafter-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                maxLength={60}
                required
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div>
              <label htmlFor="drafter-key" className="block text-sm font-medium text-foreground mb-1">
                Access key
              </label>
              <input
                id="drafter-key"
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                autoComplete="current-password"
                required
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-red-500">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {busy ? "Checking..." : "Continue"}
            </button>
          </form>
        </div>
      </main>
    </ToolFrame>
  );
}

"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Lock } from "lucide-react";

/**
 * Prod walkthrough item 6: PRA Drafter is a shared-key module with no
 * accounts (BUILD-DECISIONS.md), so locking the browser again after use is
 * the only way to keep it from staying open on a shared machine. Renders
 * nowhere outside /drafter, and not on the unlock screen itself.
 */
export default function DrafterLockButton() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (!pathname.startsWith("/drafter") || pathname === "/drafter/unlock") return null;

  const lock = async () => {
    setBusy(true);
    try {
      await fetch("/api/drafter-unlock", { method: "DELETE", credentials: "include" });
    } finally {
      router.push("/drafter/unlock");
      router.refresh();
    }
  };

  return (
    <button
      onClick={lock}
      disabled={busy}
      className="fixed top-3 right-3 z-50 flex items-center gap-1.5 rounded-full border border-border bg-surface/95 backdrop-blur px-3 py-1.5 text-xs font-medium text-text-muted shadow-sm hover:text-foreground disabled:opacity-50"
      title="Lock this browser and require the access key again"
    >
      <Lock className="h-3.5 w-3.5" />
      {busy ? "Locking..." : "Lock"}
    </button>
  );
}

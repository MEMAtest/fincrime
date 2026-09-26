"use client";

import { useEffect, useState } from "react";
import { drafterFetch } from "./drafterFetch";

/**
 * Prod walkthrough item 3: when no model provider is configured, a
 * compliance user must see ONE plain-English notice at the top of the
 * page - never an env var name, and never the same message repeated on
 * every card and button. This is the single source of that notice, used
 * on every page that has drafting or review actions.
 */
export default function ModelStatusBanner() {
  const [state, setState] = useState<{ writerConfigured: boolean; judgeConfigured: boolean } | null>(null);

  useEffect(() => {
    drafterFetch<{ writerConfigured: boolean; judgeConfigured: boolean }>("/api/drafter/calibration/status").then((r) => {
      if (r.ok && "writerConfigured" in r.data) setState(r.data);
    });
  }, []);

  if (!state || (state.writerConfigured && state.judgeConfigured)) return null;

  return (
    <div className="rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
      Automated drafting and review are switched off until a model provider is configured. Reuse and placeholder steps
      still work.
    </div>
  );
}

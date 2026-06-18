"use client";

import { useEffect, useState } from "react";

/**
 * Shared narrative fetch for the tool results pages: POSTs the (memo-stable) body
 * to the given endpoint and returns { narrative, loading }. One place owns the
 * loading state, the eslint exception, and the stale-response guard. Pass `null`
 * for the body while the result is not ready (no fetch runs).
 */
export function useNarrative(endpoint: string, body: Record<string, unknown> | null) {
  const [narrative, setNarrative] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Key the effect on the serialized body so re-renders with the same inputs
  // do not refetch, and a changed selection does.
  const bodyKey = body ? JSON.stringify(body) : null;

  useEffect(() => {
    if (!bodyKey) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- start loading state before the async fetch
    setLoading(true);
    fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: bodyKey })
      .then((res) => res.json())
      .then((data) => { if (!cancelled) setNarrative(data.narrative || null); })
      .catch(() => { if (!cancelled) setNarrative(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [endpoint, bodyKey]);

  return { narrative, loading };
}

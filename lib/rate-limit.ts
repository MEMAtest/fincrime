/**
 * Minimal in-memory, IP-keyed fixed-window rate limiter. Pure functions over
 * a module-level Map, no external deps.
 *
 * Per-instance only: on Vercel serverless each invocation can land on a
 * different instance, and the Map resets on cold start, so this is
 * best-effort, not a hard guarantee. It exists to put a brake on runaway or
 * abusive automated creation, not as a security control.
 */

interface WindowState {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, WindowState>();

/** Discards buckets whose window has fully elapsed, so the Map cannot grow unbounded. */
function prune(now: number, windowMs: number): void {
  for (const [key, state] of buckets) {
    if (now - state.windowStart >= windowMs) {
      buckets.delete(key);
    }
  }
}

// Prune on roughly every Nth call rather than every call, so the check stays cheap.
let callsSinceLastPrune = 0;
const PRUNE_EVERY = 50;

// Hard ceiling on the number of distinct buckets, independent of pruning: a
// client that rotates its key (e.g. a spoofed x-forwarded-for) faster than
// PRUNE_EVERY calls could otherwise mint unbounded Map entries within a
// single still-open hour-long window. Once at the cap, the oldest bucket
// (first Map key, insertion order) is evicted to make room - a bounded,
// best-effort brake, matching this module's "not a hard guarantee" contract.
const MAX_BUCKETS = 5000;

export interface RateLimitResult {
  allowed: boolean;
  /** Requests remaining in the current window, floored at 0. */
  remaining: number;
}

/**
 * Checks and increments the counter for `key` under a fixed window of
 * `windowMs` milliseconds allowing at most `limit` requests. Call once per
 * incoming request; the increment happens whether or not the request is
 * ultimately allowed, so retries against a blocked key do not reset it.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();

  callsSinceLastPrune += 1;
  if (callsSinceLastPrune >= PRUNE_EVERY) {
    callsSinceLastPrune = 0;
    prune(now, windowMs);
  }

  const existing = buckets.get(key);
  if (!existing || now - existing.windowStart >= windowMs) {
    if (!buckets.has(key) && buckets.size >= MAX_BUCKETS) {
      const oldestKey = buckets.keys().next().value;
      if (oldestKey !== undefined) buckets.delete(oldestKey);
    }
    buckets.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: limit - 1 };
  }

  existing.count += 1;
  const allowed = existing.count <= limit;
  return { allowed, remaining: Math.max(0, limit - existing.count) };
}

/** Sentinel returned by getClientIp() when no usable IP could be resolved. Callers must fail OPEN (skip the rate limit check) on this value rather than let every such request share one throttled bucket - see checkRateLimit callers. */
export const UNKNOWN_IP = "unknown";

/**
 * Reads the originating client IP off proxy headers, preferring the ones a
 * client cannot forge:
 *  - x-vercel-forwarded-for: set by the Vercel edge itself, overwriting
 *    anything the client sent, so it is trustworthy when present.
 *  - x-forwarded-for: a client-supplied header in general, but each proxy
 *    hop APPENDS to it rather than replacing it, so the LAST entry is the
 *    one nearest the edge (added by our own infra) rather than the FIRST
 *    (client-controlled, and trivially rotated to bypass a per-IP limit).
 *  - x-real-ip: single-value fallback some proxies set instead.
 * Falls back to UNKNOWN_IP when none are present (e.g. a proxy that strips
 * these headers) - callers must treat that as "skip the check", not as one
 * shared bucket that would throttle everyone behind such a proxy.
 */
export function getClientIp(request: Request): string {
  const vercelForwardedFor = request.headers.get("x-vercel-forwarded-for");
  if (vercelForwardedFor) {
    const first = vercelForwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const hops = forwardedFor.split(",").map((hop) => hop.trim()).filter(Boolean);
    const closest = hops[hops.length - 1];
    if (closest) return closest;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return UNKNOWN_IP;
}

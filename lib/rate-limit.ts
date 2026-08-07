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
    buckets.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: limit - 1 };
  }

  existing.count += 1;
  const allowed = existing.count <= limit;
  return { allowed, remaining: Math.max(0, limit - existing.count) };
}

/** Reads the originating client IP off standard proxy headers, falling back to "unknown". */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

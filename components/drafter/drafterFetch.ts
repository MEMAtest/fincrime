"use client";

/** Thin fetch wrapper for app/api/drafter/** - always sends the session cookie, always expects JSON. */
export async function drafterFetch<T = Record<string, never>>(
  path: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data: T | { error?: string } }> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  let data: unknown = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  return { ok: res.ok, status: res.status, data: data as T };
}

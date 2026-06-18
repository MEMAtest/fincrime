"use client";

import React from "react";
import GlossaryTerm from "./GlossaryTerm";
import { GLOSSARY_BY_KEY } from "@/data/glossary";

/**
 * Linkifies known glossary terms in a plain string, wrapping only the FIRST
 * occurrence of each distinct term (to avoid noise) in a GlossaryTerm popover.
 * Use on cited/static prose only, never over an AI narrative.
 */
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Longest keys first so multi-word terms win over their substrings.
const KEYS = Object.keys(GLOSSARY_BY_KEY).sort((a, b) => b.length - a.length);
const PATTERN = KEYS.length ? new RegExp(`\\b(${KEYS.map(escapeRe).join("|")})\\b`, "gi") : null;

export default function GlossaryText({ children }: { children: string }) {
  const text = children;
  if (!PATTERN) return <>{text}</>;

  const used = new Set<string>();
  const out: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  // matchAll clones the regex internally, so the shared PATTERN is never mutated.
  for (const m of text.matchAll(PATTERN)) {
    const matched = m[0];
    const idx = m.index ?? 0;
    const entry = GLOSSARY_BY_KEY[matched.toLowerCase()];
    if (!entry || used.has(entry.slug)) continue; // leave as plain text
    used.add(entry.slug);
    if (idx > last) out.push(text.slice(last, idx));
    out.push(
      <GlossaryTerm key={key++} term={matched}>
        {matched}
      </GlossaryTerm>
    );
    last = idx + matched.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

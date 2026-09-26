import type { z } from "zod";
import type { Finding, AiSummary, ExplorerStep } from "../types.js";
import type { HarnessOptions } from "./harness.js";

export interface ExplorerOptions extends HarnessOptions {
  siteMap: string[];
  known: Finding[];
  isLocal: boolean;
  maxTurns: number;
}

export interface ExplorerResult {
  summary?: string;
  journeysCovered?: string[];
  coverageGaps?: string[];
  steps: ExplorerStep[];
}

export interface ImageInput {
  /** Absolute path to a PNG/JPEG. */
  path: string;
  label: string;
}

/** What the UX review, explorer and triage need from a model provider. */
export interface AiBackend {
  readonly name: "claude-code" | "anthropic-api";
  readonly model: string;
  readonly usage: AiSummary["usage"];
  readonly errors: string[];
  structured<S extends z.ZodType>(p: { system: string; text: string; images?: ImageInput[]; schema: S }): Promise<z.infer<S>>;
  explore(o: ExplorerOptions): Promise<ExplorerResult>;
}

export function describeAiError(e: unknown): string {
  return (e as Error)?.message?.split("\n")[0] ?? String(e);
}

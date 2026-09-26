import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import type {
  BetaContentBlockParam,
  BetaMessage,
  BetaMessageParam,
  BetaTextBlockParam,
  BetaToolUnion,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import type { AiSummary } from "../types.js";
import type { AiBackend, ExplorerOptions, ExplorerResult, ImageInput } from "./backend.js";
import { runApiExplorer } from "./explorer.js";

/** Server-side refusal fallback: the API re-runs a declined request on a fallback model automatically. */
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export const DEFAULT_API_MODEL = "claude-sonnet-5";

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export function apiCredentialsAvailable(): boolean {
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_PROFILE) return true;
  if (process.env.ANTHROPIC_FEDERATION_RULE_ID) return true;
  return fs.existsSync(path.join(os.homedir(), ".config", "anthropic"));
}

export class RefusalError extends Error {}

/** Claude via the Messages API (pay per token). Explorer uses the native computer-use toolset. */
export class AnthropicApiBackend implements AiBackend {
  readonly name = "anthropic-api" as const;
  readonly client: Anthropic;
  readonly usage: AiSummary["usage"] = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, requests: 0 };
  readonly errors: string[] = [];

  constructor(
    readonly model: string,
    readonly effort: Effort,
  ) {
    this.client = new Anthropic({ maxRetries: 3, timeout: 15 * 60_000 });
  }

  /** Newer models take adaptive thinking + effort; Haiku 4.5 takes neither. */
  private modelParams() {
    const legacy = /haiku|sonnet-4-5|opus-4-5|3-/.test(this.model);
    const fallbacks = /^claude-(opus-5|fable-5|mythos-5)/.test(this.model);
    return {
      ...(legacy ? {} : { thinking: { type: "adaptive" as const } }),
      ...(fallbacks ? { betas: [FALLBACK_BETA], fallbacks: "default" as const } : {}),
    };
  }

  private outputConfig() {
    return /haiku|sonnet-4-5/.test(this.model) ? {} : { effort: this.effort };
  }

  private track(msg: BetaMessage) {
    this.usage.requests++;
    this.usage.inputTokens += msg.usage.input_tokens + (msg.usage.cache_creation_input_tokens ?? 0);
    this.usage.outputTokens += msg.usage.output_tokens;
    this.usage.cacheReadTokens += msg.usage.cache_read_input_tokens ?? 0;
  }

  async create(params: { system: BetaTextBlockParam[]; messages: BetaMessageParam[]; tools?: BetaToolUnion[]; maxTokens?: number }): Promise<BetaMessage> {
    const msg = await this.client.beta.messages.create({
      model: this.model,
      max_tokens: params.maxTokens ?? 16_000,
      system: params.system,
      messages: params.messages,
      tools: params.tools,
      output_config: this.outputConfig(),
      // Automatic prompt caching: the growing conversation prefix is re-read at cache prices each turn.
      cache_control: { type: "ephemeral" },
      ...this.modelParams(),
    });
    this.track(msg);
    return msg;
  }

  async structured<S extends z.ZodType>(p: { system: string; text: string; images?: ImageInput[]; schema: S }): Promise<z.infer<S>> {
    const content: BetaContentBlockParam[] = [{ type: "text", text: p.text }];
    for (const img of p.images ?? []) {
      content.push({ type: "text", text: `${img.label}:` });
      content.push(imageBlock(img.path));
    }
    const msg = await this.client.beta.messages.parse({
      model: this.model,
      max_tokens: 16_000,
      system: [{ type: "text", text: p.system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content }],
      output_config: { ...this.outputConfig(), format: betaZodOutputFormat(p.schema) },
      ...this.modelParams(),
    });
    this.track(msg);
    if (msg.stop_reason === "refusal") {
      throw new RefusalError(`Model declined the request${msg.stop_details?.category ? ` (${msg.stop_details.category})` : ""}`);
    }
    if (msg.stop_reason === "max_tokens") throw new Error("Response hit max_tokens before completing the JSON");
    if (!msg.parsed_output) throw new Error("Model response did not match the expected schema");
    return msg.parsed_output as z.infer<S>;
  }

  explore(o: ExplorerOptions): Promise<ExplorerResult> {
    return runApiExplorer(this, o);
  }
}

export function describeAiError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return "Anthropic API authentication failed (check ANTHROPIC_API_KEY)";
  if (e instanceof Anthropic.PermissionDeniedError) return "Anthropic API permission denied for this model/feature";
  if (e instanceof Anthropic.RateLimitError) return "Anthropic API rate limit hit";
  if (e instanceof Anthropic.BadRequestError) return `Anthropic API rejected the request: ${e.message}`;
  if (e instanceof Anthropic.APIError) return `Anthropic API error ${e.status ?? ""}: ${e.message}`;
  return (e as Error)?.message ?? String(e);
}

export function imageBlock(file: string) {
  const data = fs.readFileSync(file).toString("base64");
  const media_type = file.endsWith(".png") ? ("image/png" as const) : ("image/jpeg" as const);
  return { type: "image" as const, source: { type: "base64" as const, media_type, data } };
}

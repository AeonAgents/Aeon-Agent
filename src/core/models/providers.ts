import type { Redactor } from "../redact.ts";
import { OpenAICompatibleProvider, type OpenAICompatibleConfig } from "./openai-compatible.ts";

type Common = { fetch?: typeof fetch; redactor?: Redactor; timeoutMs?: number };

/**
 * Official EXAONE API Platform (K-EXAONE 2.5).
 * Facts verified from https://docs.exaone.ai on 2026-11-10 (see docs/research):
 *  - POST https://api.exaone.ai/v1/chat/completions, Bearer auth, model id `k-exaone_v2.5`
 *  - context 524,288 tokens, text only, OpenAI-compatible, SSE streaming
 *  - tool calling and structured output are NOT documented  => "unknown" (treated as unsupported)
 *    Seen working on the live service on 2026-11-15 (docs/TESTING.md): `tools` + `tool_choice` returned a `tool_calls`
 *    entry, `response_format` json_object and json_schema returned parsable JSON. Aeon asks for JSON in plain text and
 *    uses neither, so they stay "unknown": an undocumented feature may change without notice.
 *  - `reasoning_effort` accepts low, medium, high and max; "none" is refused with 400 (live, 2026-11-15)
 *  - concrete rate limits are not published                 => null
 *
 * DECISION D9 (owner, 2026-11-10): the integration ships publicly with bring-your-own-key and without
 * any key in the repository. The EXAONE terms still apply to each user (non-commercial rights, no
 * third-party access through a product); the owner accepted the residual ambiguity. The `unreleased`
 * mechanism stays available for future integrations.
 */
/**
 * How long one EXAONE request may take. Measured 2026-11-15 on the live service while it was busy: it produced 7 to 8 tokens a
 * second, and a feed writer's answer (1,500 to 2,200 tokens, most of them reasoning even at "low") came after 185 s and 301 s, while
 * the service itself closes a request at about 300 s. With the usual 120 s such an answer was thrown away every time, so the same
 * task failed the same way on every attempt. 290 s waits as long as the service will. A fast service answers in seconds either way.
 */
export const EXAONE_REQUEST_TIMEOUT_MS = 290_000;

export function exaoneProvider(
  opts: Common & { apiKey: string; baseUrl?: string; model?: string; reasoningEffort?: "low" | "high" | "max" },
): OpenAICompatibleProvider {
  const cfg: OpenAICompatibleConfig = {
    id: "exaone",
    baseUrl: opts.baseUrl ?? "https://api.exaone.ai/v1",
    model: opts.model ?? "k-exaone_v2.5",
    apiKey: opts.apiKey,
    external: true,
    unreleased: false,
    capabilities: {
      contextWindow: 524_288,
      toolCalling: "unknown",
      structuredOutput: "unknown",
      streaming: "supported",
      maxConcurrency: 2,
      requestsPerMinute: null,
    },
    // The API default is "max", and reasoning tokens count toward max_tokens. Agent action steps are
    // short JSON replies, so default to "low" to avoid answers that are all reasoning.
    extraBody: { reasoning_effort: opts.reasoningEffort ?? "low" },
    ...(opts.fetch ? { fetch: opts.fetch } : {}),
    ...(opts.redactor ? { redactor: opts.redactor } : {}),
    timeoutMs: opts.timeoutMs ? opts.timeoutMs : EXAONE_REQUEST_TIMEOUT_MS,
  };
  return new OpenAICompatibleProvider(cfg);
}

/** Ollama's OpenAI-compatible endpoint. Local: prompts do not leave the machine. */
export function ollamaProvider(opts: Common & { model: string; baseUrl?: string }): OpenAICompatibleProvider {
  return new OpenAICompatibleProvider({
    id: "ollama",
    baseUrl: opts.baseUrl ?? "http://localhost:11434/v1",
    model: opts.model,
    external: false,
    capabilities: {
      contextWindow: null,
      toolCalling: "unknown",
      structuredOutput: "unknown",
      streaming: "supported",
      maxConcurrency: 1,
      requestsPerMinute: null,
    },
    ...(opts.fetch ? { fetch: opts.fetch } : {}),
    ...(opts.redactor ? { redactor: opts.redactor } : {}),
    ...(opts.timeoutMs ? { timeoutMs: opts.timeoutMs } : {}),
  });
}

/** llama.cpp `llama-server` (OpenAI-compatible). */
export function llamaCppProvider(opts: Common & { model?: string; baseUrl?: string }): OpenAICompatibleProvider {
  return new OpenAICompatibleProvider({
    id: "llamacpp",
    baseUrl: opts.baseUrl ?? "http://localhost:8080/v1",
    model: opts.model ?? "default",
    external: false,
    capabilities: {
      contextWindow: null,
      toolCalling: "unknown",
      structuredOutput: "unknown",
      streaming: "supported",
      maxConcurrency: 1,
      requestsPerMinute: null,
    },
    ...(opts.fetch ? { fetch: opts.fetch } : {}),
    ...(opts.redactor ? { redactor: opts.redactor } : {}),
    ...(opts.timeoutMs ? { timeoutMs: opts.timeoutMs } : {}),
  });
}

/** Any OpenAI-compatible service (user-supplied URL and key). `external` must be stated by the caller. */
export function openAiCompatible(
  opts: Common & { id?: string; baseUrl: string; model: string; apiKey?: string; external: boolean; reasoningEffort?: "low" | "medium" | "high" },
): OpenAICompatibleProvider {
  return new OpenAICompatibleProvider({
    id: opts.id ?? "openai-compatible",
    baseUrl: opts.baseUrl,
    model: opts.model,
    external: opts.external,
    ...(opts.apiKey ? { apiKey: opts.apiKey } : {}),
    ...(opts.reasoningEffort ? { optionalBody: { reasoning_effort: opts.reasoningEffort } } : {}),
    capabilities: {
      contextWindow: null,
      toolCalling: "unknown",
      structuredOutput: "unknown",
      streaming: "unknown",
      maxConcurrency: 2,
      requestsPerMinute: null,
    },
    ...(opts.fetch ? { fetch: opts.fetch } : {}),
    ...(opts.redactor ? { redactor: opts.redactor } : {}),
    ...(opts.timeoutMs ? { timeoutMs: opts.timeoutMs } : {}),
  });
}

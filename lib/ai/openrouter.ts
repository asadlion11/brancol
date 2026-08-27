import "server-only";

/**
 * brancol — OpenRouter transport.
 *
 * OpenRouter is the only AI gateway (locked decision L10): no vendor SDK, just
 * `fetch` against the chat-completions endpoint.
 *
 * TIMEOUT BUDGETING is the important part of this file. The route is capped at
 * 30s (`maxDuration = 30`), and that single budget has to cover *every* model
 * attempt plus the response. So the caller creates one `Deadline` for the whole
 * request and each attempt is given a slice of what is left — never the whole
 * 30s, which would leave nothing for failover.
 */

import { getEnv } from "../env";
import type { ChatMessage } from "../prompt";

/** Hard ceiling for one generate request. Must match `maxDuration` on the route. */
export const TOTAL_BUDGET_MS = 30_000;
/** Held back so the handler can still build and send a response after the last attempt. */
export const RESPONSE_RESERVE_MS = 2_500;
/** Nominal slice for the first attempt; the remainder goes to the failover. */
export const FIRST_ATTEMPT_MS = 12_000;
/** Below this an attempt cannot realistically finish, so it is skipped instead. */
export const MIN_ATTEMPT_MS = 3_500;

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

/** A shared clock for one generate request. */
export type Deadline = {
  /** Milliseconds left in the budget, never negative. */
  remaining(): number;
  /** Milliseconds consumed so far. */
  elapsed(): number;
  expired(): boolean;
};

export function createDeadline(
  totalMs: number = TOTAL_BUDGET_MS - RESPONSE_RESERVE_MS,
): Deadline {
  const start = Date.now();
  const end = start + totalMs;

  return {
    remaining: () => Math.max(0, end - Date.now()),
    elapsed: () => Date.now() - start,
    expired: () => Date.now() >= end,
  };
}

/**
 * Splits the remaining budget across the attempts still to come.
 *
 * With two models and ~27.5s of budget this gives attempt 1 its 12s slice and
 * hands the ~15s remainder to attempt 2. With three models (adding a paid model
 * is an env-only change, L13) it divides evenly instead of starving the tail.
 */
export function attemptBudget(
  remainingMs: number,
  attemptsLeft: number,
): number {
  if (attemptsLeft <= 1) return remainingMs;
  const evenShare = Math.floor(remainingMs / attemptsLeft);
  const slice = Math.max(MIN_ATTEMPT_MS, Math.min(FIRST_ATTEMPT_MS, evenShare));
  // The floor must never let a single attempt outlive the shared deadline —
  // that is how a request ends up overrunning `maxDuration`.
  return Math.min(remainingMs, slice);
}

export type OpenRouterFailureKind =
  | "http" // non-2xx that is not a rate limit
  | "rate_limited" // 429, or an upstream provider pool limit
  | "timeout" // our own AbortController fired
  | "network" // DNS/TLS/socket
  | "empty" // 2xx with no usable content
  | "budget"; // not enough time left to even try

/** Transport failure. `detail` is for logs only and is never serialized to a client. */
export class OpenRouterError extends Error {
  readonly kind: OpenRouterFailureKind;
  readonly status?: number;
  readonly model: string;
  readonly retryAfterSeconds?: number;

  constructor(
    kind: OpenRouterFailureKind,
    model: string,
    options: {
      message?: string;
      status?: number;
      retryAfterSeconds?: number;
    } = {},
  ) {
    super(options.message ?? `OpenRouter ${kind} for ${model}`);
    this.name = "OpenRouterError";
    this.kind = kind;
    this.model = model;
    this.status = options.status;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

export type CompletionRequest = {
  model: string;
  messages: ChatMessage[];
  /** Hard cap for this single attempt, taken from the shared deadline. */
  timeoutMs: number;
  temperature?: number;
  maxTokens?: number;
};

export type CompletionResult = {
  model: string;
  content: string;
  /** `length` means the model was cut off mid-JSON — the repair layer may still cope. */
  finishReason?: string;
  durationMs: number;
};

type ChatCompletionResponse = {
  error?: {
    message?: string;
    code?: number | string;
    metadata?: Record<string, unknown>;
  };
  choices?: Array<{
    finish_reason?: string;
    message?: { content?: unknown; reasoning?: unknown };
    text?: string;
  }>;
};

/** Providers differ: content can be a string or an array of content parts. */
function readContent(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((part) =>
        typeof part === "string"
          ? part
          : typeof (part as { text?: unknown })?.text === "string"
            ? ((part as { text: string }).text ?? "")
            : "",
      )
      .join("");
  }
  return "";
}

function retryAfterFrom(
  response: Response,
  body: ChatCompletionResponse | null,
): number | undefined {
  const header = response.headers.get("retry-after");
  if (header && Number.isFinite(Number(header))) return Number(header);

  const meta = body?.error?.metadata as
    { retry_after_seconds?: unknown } | undefined;
  return typeof meta?.retry_after_seconds === "number"
    ? meta.retry_after_seconds
    : undefined;
}

/**
 * One attempt against one model.
 *
 * Always throws `OpenRouterError` on failure so the adapter can decide whether
 * to fail over. Never throws anything containing the API key.
 */
export async function requestCompletion(
  request: CompletionRequest,
): Promise<CompletionResult> {
  const { model, messages, timeoutMs } = request;

  if (timeoutMs < MIN_ATTEMPT_MS) {
    throw new OpenRouterError("budget", model, {
      message: `only ${timeoutMs}ms left, skipping ${model}`,
    });
  }

  const { OPENROUTER_API_KEY } = getEnv();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();

  try {
    let response: Response;
    try {
      response = await fetch(ENDPOINT, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          // Attribution headers OpenRouter uses for its dashboards. Non-secret.
          "HTTP-Referer": "https://brancol.app",
          "X-Title": "brancol",
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: request.temperature ?? 0.8,
          max_tokens: request.maxTokens ?? 1200,
          // Best effort; providers that do not support it simply ignore it.
          response_format: { type: "json_object" },
        }),
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new OpenRouterError("timeout", model, {
          message: `timed out after ${timeoutMs}ms`,
        });
      }
      throw new OpenRouterError("network", model, {
        message: error instanceof Error ? error.message : "network failure",
      });
    }

    const raw = await response.text();
    let body: ChatCompletionResponse | null = null;
    try {
      body = JSON.parse(raw) as ChatCompletionResponse;
    } catch {
      body = null;
    }

    if (!response.ok) {
      const kind: OpenRouterFailureKind =
        response.status === 429 ? "rate_limited" : "http";
      throw new OpenRouterError(kind, model, {
        status: response.status,
        retryAfterSeconds: retryAfterFrom(response, body),
        message: `${response.status} ${body?.error?.message ?? raw.slice(0, 200)}`,
      });
    }

    // OpenRouter can answer 200 with an error envelope when a provider fails.
    if (body?.error) {
      const code = Number(body.error.code);
      const kind: OpenRouterFailureKind =
        code === 429 ? "rate_limited" : "http";
      throw new OpenRouterError(kind, model, {
        status: Number.isFinite(code) ? code : 200,
        retryAfterSeconds: retryAfterFrom(response, body),
        message: body.error.message ?? "provider error",
      });
    }

    const choice = body?.choices?.[0];
    const content =
      readContent(choice?.message?.content) || readContent(choice?.text);

    if (!content.trim()) {
      throw new OpenRouterError("empty", model, {
        message: "no content in choices[0]",
      });
    }

    return {
      model,
      content,
      finishReason: choice?.finish_reason,
      durationMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}

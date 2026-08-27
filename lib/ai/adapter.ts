import "server-only";

/**
 * brancol — model failover.
 *
 * Tries each model in turn and returns the first usable palette. The chain is
 * read entirely from the environment (locked decision L13): adding a third,
 * paid model is `OPENROUTER_FALLBACK_MODELS=z-ai/glm-5.2:free,anthropic/…` and
 * a redeploy — no code change here.
 *
 * A model is abandoned on any of: HTTP error, timeout, rate limit (429), empty
 * response, or output the repair layer cannot turn into colors.
 *
 * The free-tier pool answers 429 "temporarily rate-limited upstream, retry
 * shortly" a large fraction of the time, so once the chain has been walked
 * once, the *remaining* budget is spent on a second lap over the models that
 * failed for a transient reason. Returning 503 with 20s of budget unspent would
 * turn a flaky pool into a broken product.
 */

import { getEnv } from "../env";
import { ApiError, redact } from "../errors";
import { buildMessages, type PromptInput } from "../prompt";
import type { AIColor } from "../schemas";
import {
  attemptBudget,
  createDeadline,
  MIN_ATTEMPT_MS,
  OpenRouterError,
  requestCompletion,
  type Deadline,
} from "./openrouter";
import { extractPalette } from "./repair";

/**
 * Upper bound on how many times the whole chain may be walked in one request.
 * Two laps: the ordered chain, then one retry of whatever failed transiently.
 * A 429 from the free pool costs several seconds, so more laps than this turn a
 * failure into a 25s+ wait without materially improving the odds.
 */
const MAX_LAPS = 2;
/** Floor and ceiling for the pause between laps. */
const MIN_LAP_DELAY_MS = 750;
const MAX_LAP_DELAY_MS = 3_000;

export type AttemptOutcome = {
  model: string;
  ok: boolean;
  /** Why it was abandoned. Server-side diagnostics only — never sent to a client. */
  reason?: string;
  durationMs: number;
};

export type GenerationResult = {
  colors: AIColor[];
  /** The model that actually answered. */
  model: string;
  fallbackUsed: boolean;
  durationMs: number;
  attempts: AttemptOutcome[];
};

/**
 * The ordered model chain: primary first, then the comma-separated fallbacks.
 * Duplicates are removed so a misconfigured env cannot burn an attempt slot.
 */
export function modelChain(): string[] {
  const { OPENROUTER_PRIMARY_MODEL, OPENROUTER_FALLBACK_MODELS } = getEnv();
  const chain = [OPENROUTER_PRIMARY_MODEL, ...OPENROUTER_FALLBACK_MODELS]
    .map((slug) => slug.trim())
    .filter((slug) => slug.length > 0);

  return [...new Set(chain)];
}

/** A response with at least this many colors is worth keeping; below it, try the next model. */
function minimumUsable(count: number): number {
  return Math.max(2, Math.ceil(count / 2));
}

/** Failures that a second attempt might survive. A 401/404 will never clear, so it is not retried. */
const TRANSIENT_KINDS = new Set([
  "rate_limited",
  "timeout",
  "network",
  "empty",
]);

function isRetryable(error: unknown): boolean {
  if (error instanceof OpenRouterError) {
    if (TRANSIENT_KINDS.has(error.kind)) return true;
    return error.kind === "http" && (error.status ?? 0) >= 500;
  }
  return false;
}

function describeFailure(error: unknown): string {
  if (error instanceof OpenRouterError) {
    return `${error.kind}${error.status ? ` ${error.status}` : ""}: ${redact(error.message)}`;
  }
  return error instanceof Error
    ? redact(`${error.name}: ${error.message}`)
    : "unknown failure";
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type GenerateOptions = {
  /** Shared clock covering every attempt. One is created if omitted. */
  deadline?: Deadline;
};

/**
 * Runs the chain and returns the first usable palette.
 *
 * Throws `ApiError("TIMEOUT")` when the budget ran out and
 * `ApiError("UPSTREAM_UNAVAILABLE")` for everything else. Neither carries any
 * provider text into the response body.
 */
export async function generatePalette(
  input: PromptInput,
  options: GenerateOptions = {},
): Promise<GenerationResult> {
  const deadline = options.deadline ?? createDeadline();
  const models = modelChain();
  const messages = buildMessages(input);
  const attempts: AttemptOutcome[] = [];

  // A short-but-real palette beats a 503; used only if nothing better arrives.
  let partial: { colors: AIColor[]; model: string; index: number } | null =
    null;
  let retryable = new Set(models);
  let sawTimeout = false;
  /** OpenRouter's own "retry after N seconds" hint, when it sends one. */
  let retryHintMs = 0;

  for (let lap = 0; lap < MAX_LAPS; lap += 1) {
    const eligible =
      lap === 0 ? models : models.filter((model) => retryable.has(model));
    if (eligible.length === 0) break;

    retryable = new Set<string>();
    retryHintMs = 0;

    for (const [index, model] of eligible.entries()) {
      const started = Date.now();

      if (deadline.remaining() < MIN_ATTEMPT_MS) {
        attempts.push({
          model,
          ok: false,
          reason: "budget exhausted",
          durationMs: 0,
        });
        sawTimeout = true;
        break;
      }

      // Attempt 1 gets its ~12s slice; whatever is left goes to the next model.
      const budget = attemptBudget(
        deadline.remaining(),
        eligible.length - index,
      );

      try {
        const completion = await requestCompletion({
          model,
          messages,
          timeoutMs: budget,
          maxTokens: Math.max(600, 160 * input.count),
        });

        const colors = extractPalette(completion.content);
        if (!colors) {
          attempts.push({
            model,
            ok: false,
            reason: `unparseable output (finish: ${completion.finishReason ?? "n/a"})`,
            durationMs: completion.durationMs,
          });
          continue;
        }

        if (colors.length < minimumUsable(input.count)) {
          // Usable but thin — hold on to it and see if a later model does better.
          if (!partial || colors.length > partial.colors.length) {
            partial = { colors, model, index: models.indexOf(model) };
          }
          attempts.push({
            model,
            ok: false,
            reason: `only ${colors.length} of ${input.count} colors`,
            durationMs: completion.durationMs,
          });
          continue;
        }

        attempts.push({ model, ok: true, durationMs: completion.durationMs });
        return {
          colors,
          model,
          fallbackUsed: models.indexOf(model) > 0,
          durationMs: deadline.elapsed(),
          attempts,
        };
      } catch (error) {
        const reason = describeFailure(error);
        if (
          error instanceof OpenRouterError &&
          (error.kind === "timeout" || error.kind === "budget")
        ) {
          sawTimeout = true;
        }
        if (isRetryable(error)) retryable.add(model);
        if (error instanceof OpenRouterError && error.retryAfterSeconds) {
          retryHintMs = Math.max(retryHintMs, error.retryAfterSeconds * 1000);
        }

        attempts.push({
          model,
          ok: false,
          reason,
          durationMs: Date.now() - started,
        });
        console.warn(`[brancol:adapter] ${model} failed — ${reason}`);
      }
    }

    // Another lap is only worth it if something transient failed and the budget
    // can still fund a real attempt after the backoff. Prefer the provider's own
    // retry hint over a guess — it knows when its pool frees up.
    const backoff = Math.min(
      MAX_LAP_DELAY_MS,
      Math.max(MIN_LAP_DELAY_MS, retryHintMs),
    );
    if (
      retryable.size === 0 ||
      deadline.remaining() < MIN_ATTEMPT_MS + backoff
    ) {
      break;
    }
    await sleep(backoff);
  }

  if (partial) {
    console.warn(
      `[brancol:adapter] falling back to a short palette from ${partial.model}`,
    );
    return {
      colors: partial.colors,
      model: partial.model,
      fallbackUsed: partial.index > 0,
      durationMs: deadline.elapsed(),
      attempts,
    };
  }

  const detail = attempts
    .map((a) => `${a.model}: ${a.reason ?? "failed"}`)
    .join(" | ");

  throw new ApiError(
    sawTimeout && deadline.expired() ? "TIMEOUT" : "UPSTREAM_UNAVAILABLE",
    {
      detail: `${attempts.length} attempt(s) across ${models.length} model(s) failed — ${detail}`,
    },
  );
}

import "server-only";

/**
 * brancol — per-IP rate limiting (locked decision L16).
 *
 * There is no auth, so `/api/generate` is the whole attack surface and every
 * request costs an upstream model call. The limiter therefore runs *before* the
 * AI adapter — that ordering is the entire point of this module.
 *
 * Two windows, both enforced:
 *   - burst:    10 requests / 60s  (keeps one person from hammering the button)
 *   - backstop: 60 requests / day  (caps what a single IP can cost in a day)
 *
 * If the Upstash pair is absent (local development) limiting degrades to
 * disabled with a one-time warning rather than failing the request.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { getEnv } from "./env";

export const BURST_LIMIT = 10;
export const BURST_WINDOW = "60 s" as const;
export const DAILY_LIMIT = 60;
export const DAILY_WINDOW = "1 d" as const;

export type RateLimitDecision = {
  /** False means the caller must return 429 without touching the model. */
  allowed: boolean;
  /** Requests left in the tighter of the two windows. */
  remaining: number;
  limit: number;
  /** Seconds until the caller may retry; always >= 1 when blocked. */
  retryAfterSeconds: number;
  /** True when no Upstash credentials are configured (local dev). */
  disabled: boolean;
};

type Limiters = { burst: Ratelimit; daily: Ratelimit } | null;

let limiters: Limiters | undefined;
let warned = false;

function getLimiters(): Limiters {
  if (limiters !== undefined) return limiters;

  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = getEnv();

  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    if (!warned) {
      warned = true;
      console.warn(
        "[brancol:ratelimit] UPSTASH_REDIS_REST_URL / _TOKEN are not set — rate limiting is DISABLED. Set both before deploying.",
      );
    }
    limiters = null;
    return limiters;
  }

  const redis = new Redis({
    url: UPSTASH_REDIS_REST_URL,
    token: UPSTASH_REDIS_REST_TOKEN,
  });

  limiters = {
    burst: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(BURST_LIMIT, BURST_WINDOW),
      prefix: "brancol:burst",
      analytics: false,
    }),
    daily: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(DAILY_LIMIT, DAILY_WINDOW),
      prefix: "brancol:daily",
      analytics: false,
    }),
  };

  return limiters;
}

/**
 * The client IP, taken from the first entry of `x-forwarded-for` (the original
 * client; later entries are proxies). Falls back to `x-real-ip`, then to a
 * shared bucket so a missing header cannot become an unlimited free pass.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first;

  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;

  return "unknown-ip";
}

function secondsUntil(resetMs: number): number {
  return Math.max(1, Math.ceil((resetMs - Date.now()) / 1000));
}

/** Checks both windows. Must be called before any upstream model call. */
export async function checkRateLimit(
  identifier: string,
): Promise<RateLimitDecision> {
  const active = getLimiters();

  if (!active) {
    return {
      allowed: true,
      remaining: BURST_LIMIT,
      limit: BURST_LIMIT,
      retryAfterSeconds: 0,
      disabled: true,
    };
  }

  try {
    const [burst, daily] = await Promise.all([
      active.burst.limit(identifier),
      active.daily.limit(identifier),
    ]);

    // Analytics are off, so `pending` is trivial — just make sure it can never
    // surface as an unhandled rejection.
    void Promise.allSettled([burst.pending, daily.pending]);

    if (!burst.success || !daily.success) {
      const blocking = !burst.success ? burst : daily;
      return {
        allowed: false,
        remaining: 0,
        limit: blocking.limit,
        retryAfterSeconds: secondsUntil(blocking.reset),
        disabled: false,
      };
    }

    return {
      allowed: true,
      remaining: Math.min(burst.remaining, daily.remaining),
      limit: Math.min(burst.limit, daily.limit),
      retryAfterSeconds: 0,
      disabled: false,
    };
  } catch (error) {
    // Redis being unreachable must not take the product down; log and allow.
    console.error(
      `[brancol:ratelimit] limiter unavailable, allowing request — ${
        error instanceof Error ? error.name : "unknown error"
      }`,
    );
    return {
      allowed: true,
      remaining: BURST_LIMIT,
      limit: BURST_LIMIT,
      retryAfterSeconds: 0,
      disabled: true,
    };
  }
}

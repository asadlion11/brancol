import "server-only";

import { z } from "zod";

/**
 * Server-only, Zod-validated environment loader.
 *
 * Nothing in here may ever be prefixed with `NEXT_PUBLIC_` — `OPENROUTER_API_KEY`
 * in particular must never reach the browser. The `server-only` import above
 * makes an accidental client import a build error rather than a leak.
 *
 * Validation is lazy and memoized: it runs on first access, not at import time,
 * so `next build` never fails just because a machine has no secrets configured.
 */

export const DEFAULT_PRIMARY_MODEL = "google/gemma-4-26b-a4b-it:free";
export const DEFAULT_FALLBACK_MODELS = "z-ai/glm-5.2:free";

/** Splits a comma-separated model list, dropping blanks and stray whitespace. */
function parseModelList(value: string): string[] {
  return value
    .split(",")
    .map((slug) => slug.trim())
    .filter((slug) => slug.length > 0);
}

/**
 * Treats a present-but-blank variable as absent.
 *
 * Hosting dashboards (Vercel included) happily store an empty string for a
 * variable someone added but never filled in, and a `.env` file with a bare
 * `UPSTASH_REDIS_REST_URL=` does the same. Without this, `""` would fail the
 * URL check and take the whole app down at first request — for an *optional*
 * feature. Blank therefore means "not configured", which degrades to rate
 * limiting disabled (with the warning `lib/ratelimit.ts` prints) instead.
 */
export function blankToUndefined(value: unknown): unknown {
  if (typeof value !== "string") return value;
  return value.trim().length === 0 ? undefined : value.trim();
}

// Zod v4: a single `error` param replaces `message` / `required_error`.
const envSchema = z
  .object({
    OPENROUTER_API_KEY: z
      .string({ error: "OPENROUTER_API_KEY is required." })
      .min(1, { error: "OPENROUTER_API_KEY must not be empty." }),

    // Blank counts as unset here too, so a host with an empty box falls back to
    // the documented default instead of refusing to start.
    OPENROUTER_PRIMARY_MODEL: z.preprocess(
      blankToUndefined,
      z
        .string()
        .min(1, { error: "OPENROUTER_PRIMARY_MODEL must not be empty." })
        .default(DEFAULT_PRIMARY_MODEL),
    ),

    OPENROUTER_FALLBACK_MODELS: z.preprocess(
      blankToUndefined,
      z
        .string()
        .min(1, { error: "OPENROUTER_FALLBACK_MODELS must not be empty." })
        .default(DEFAULT_FALLBACK_MODELS)
        .transform(parseModelList),
    ),

    // Rate limiting is optional in development: set both, or neither.
    // A blank value counts as unset (see `blankToUndefined`).
    UPSTASH_REDIS_REST_URL: z.preprocess(
      blankToUndefined,
      z
        .url({ error: "UPSTASH_REDIS_REST_URL must be a valid URL." })
        .optional(),
    ),

    UPSTASH_REDIS_REST_TOKEN: z.preprocess(
      blankToUndefined,
      z
        .string()
        .min(1, { error: "UPSTASH_REDIS_REST_TOKEN must not be empty." })
        .optional(),
    ),
  })
  .refine(
    (value) =>
      Boolean(value.UPSTASH_REDIS_REST_URL) ===
      Boolean(value.UPSTASH_REDIS_REST_TOKEN),
    {
      error:
        "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set together (or both left unset to disable rate limiting).",
      path: ["UPSTASH_REDIS_REST_URL"],
    },
  );

export type Env = z.infer<typeof envSchema>;

function formatIssues(error: z.ZodError<unknown>): string {
  // Zod v4: issues carry `path`; `z.flattenError()` / `z.treeifyError()` are the
  // replacements for the removed `.flatten()` / `.format()` helpers.
  return error.issues
    .map((issue) => {
      const name = issue.path.join(".");
      return name ? `  - ${name}: ${issue.message}` : `  - ${issue.message}`;
    })
    .join("\n");
}

function loadEnv(): Env {
  // Read explicitly rather than passing `process.env` wholesale, so the set of
  // variables brancol depends on is greppable in one place.
  const result = envSchema.safeParse({
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    OPENROUTER_PRIMARY_MODEL: process.env.OPENROUTER_PRIMARY_MODEL,
    OPENROUTER_FALLBACK_MODELS: process.env.OPENROUTER_FALLBACK_MODELS,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  if (!result.success) {
    throw new Error(
      `Invalid environment configuration.\n${formatIssues(result.error)}\n\nSee .env.example and set these in .env.local (or your host's env settings).`,
    );
  }

  return result.data;
}

let cached: Env | undefined;

/** Returns the validated environment, throwing a named error on the first bad value. */
export function getEnv(): Env {
  cached ??= loadEnv();
  return cached;
}

/** Ergonomic accessor — `env.OPENROUTER_PRIMARY_MODEL`. Validates on first read. */
export const env: Env = new Proxy({} as Env, {
  get(_target, key: string | symbol) {
    return getEnv()[key as keyof Env];
  },
});

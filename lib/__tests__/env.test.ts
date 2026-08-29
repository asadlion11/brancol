/**
 * `lib/env.ts` — the startup contract.
 *
 * The case this suite exists for: a hosting dashboard stores an *empty string*
 * for a variable someone added and never filled in. Rate limiting is optional,
 * so a blank `UPSTASH_REDIS_REST_URL` must read as "not configured" — the app
 * degrades to limiting disabled — rather than as "invalid URL", which would
 * throw on the first request and take the whole product down for a feature
 * that is allowed to be absent.
 *
 * Every value here is fabricated. Nothing reads the developer's real `.env`.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { blankToUndefined, DEFAULT_FALLBACK_MODELS } from "../env";

const KEYS = [
  "OPENROUTER_API_KEY",
  "OPENROUTER_PRIMARY_MODEL",
  "OPENROUTER_FALLBACK_MODELS",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
] as const;

type EnvOverrides = Partial<Record<(typeof KEYS)[number], string>>;

/**
 * Re-imports `lib/env.ts` with a fabricated environment. The module memoizes
 * its parse, so each case needs a fresh module registry.
 */
async function withEnv(overrides: EnvOverrides) {
  vi.resetModules();

  // Start from a known-empty slate so the host machine's own variables — which
  // may include real secrets — can never influence a case.
  for (const key of KEYS) vi.stubEnv(key, undefined as unknown as string);
  for (const [key, value] of Object.entries(overrides)) vi.stubEnv(key, value);

  return import("../env");
}

const API_KEY = "sk-or-v1-test-key-not-a-real-credential";
const REDIS_URL = "https://example-redis.upstash.io";
const REDIS_TOKEN = "test-token-not-a-real-credential";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("blankToUndefined", () => {
  it("treats empty and whitespace-only strings as absent", () => {
    expect(blankToUndefined("")).toBeUndefined();
    expect(blankToUndefined("   ")).toBeUndefined();
    expect(blankToUndefined("\n\t ")).toBeUndefined();
  });

  it("trims but keeps anything with content", () => {
    expect(blankToUndefined("  value  ")).toBe("value");
    expect(blankToUndefined("value")).toBe("value");
  });

  it("passes non-strings through untouched", () => {
    expect(blankToUndefined(undefined)).toBeUndefined();
    expect(blankToUndefined(null)).toBeNull();
    expect(blankToUndefined(7)).toBe(7);
  });
});

describe("getEnv — blank Upstash credentials", () => {
  it("reads an empty-string URL and token as unset instead of throwing", async () => {
    const { getEnv } = await withEnv({
      OPENROUTER_API_KEY: API_KEY,
      UPSTASH_REDIS_REST_URL: "",
      UPSTASH_REDIS_REST_TOKEN: "",
    });

    const env = getEnv();
    expect(env.UPSTASH_REDIS_REST_URL).toBeUndefined();
    expect(env.UPSTASH_REDIS_REST_TOKEN).toBeUndefined();
  });

  it("reads whitespace-only credentials as unset", async () => {
    const { getEnv } = await withEnv({
      OPENROUTER_API_KEY: API_KEY,
      UPSTASH_REDIS_REST_URL: "   ",
      UPSTASH_REDIS_REST_TOKEN: "\t",
    });

    const env = getEnv();
    expect(env.UPSTASH_REDIS_REST_URL).toBeUndefined();
    expect(env.UPSTASH_REDIS_REST_TOKEN).toBeUndefined();
  });

  it("does not mention UPSTASH_REDIS_REST_URL in any error when both are blank", async () => {
    const { getEnv } = await withEnv({
      OPENROUTER_API_KEY: API_KEY,
      UPSTASH_REDIS_REST_URL: "",
      UPSTASH_REDIS_REST_TOKEN: "",
    });

    expect(() => getEnv()).not.toThrow();
  });

  it("still rejects a URL that is present but not a URL", async () => {
    const { getEnv } = await withEnv({
      OPENROUTER_API_KEY: API_KEY,
      UPSTASH_REDIS_REST_URL: "not-a-url",
      UPSTASH_REDIS_REST_TOKEN: REDIS_TOKEN,
    });

    expect(() => getEnv()).toThrow(/must be a valid URL/);
  });

  it("still rejects one credential set without the other", async () => {
    const { getEnv } = await withEnv({
      OPENROUTER_API_KEY: API_KEY,
      UPSTASH_REDIS_REST_URL: "",
      UPSTASH_REDIS_REST_TOKEN: REDIS_TOKEN,
    });

    expect(() => getEnv()).toThrow(/must be set together/);
  });

  it("keeps a real pair, trimmed", async () => {
    const { getEnv } = await withEnv({
      OPENROUTER_API_KEY: API_KEY,
      UPSTASH_REDIS_REST_URL: ` ${REDIS_URL} `,
      UPSTASH_REDIS_REST_TOKEN: ` ${REDIS_TOKEN} `,
    });

    const env = getEnv();
    expect(env.UPSTASH_REDIS_REST_URL).toBe(REDIS_URL);
    expect(env.UPSTASH_REDIS_REST_TOKEN).toBe(REDIS_TOKEN);
  });
});

describe("getEnv — model chain", () => {
  it("falls back to the documented defaults when the model vars are blank", async () => {
    const { getEnv, DEFAULT_PRIMARY_MODEL } = await withEnv({
      OPENROUTER_API_KEY: API_KEY,
      OPENROUTER_PRIMARY_MODEL: "",
      OPENROUTER_FALLBACK_MODELS: "   ",
    });

    const env = getEnv();
    expect(env.OPENROUTER_PRIMARY_MODEL).toBe(DEFAULT_PRIMARY_MODEL);
    expect(env.OPENROUTER_FALLBACK_MODELS).toEqual([DEFAULT_FALLBACK_MODELS]);
  });

  it("parses a comma-separated fallback list, dropping blanks", async () => {
    const { getEnv } = await withEnv({
      OPENROUTER_API_KEY: API_KEY,
      OPENROUTER_PRIMARY_MODEL: "vendor/primary:free",
      OPENROUTER_FALLBACK_MODELS: " vendor/second:free , ,vendor/third ",
    });

    expect(getEnv().OPENROUTER_FALLBACK_MODELS).toEqual([
      "vendor/second:free",
      "vendor/third",
    ]);
  });
});

describe("getEnv — required values", () => {
  it("throws a named error when the API key is missing", async () => {
    const { getEnv } = await withEnv({});
    expect(() => getEnv()).toThrow(/OPENROUTER_API_KEY/);
  });

  it("throws when the API key is blank", async () => {
    const { getEnv } = await withEnv({ OPENROUTER_API_KEY: "" });
    expect(() => getEnv()).toThrow(/OPENROUTER_API_KEY/);
  });

  it("memoizes: the second read returns the same object", async () => {
    const { getEnv } = await withEnv({ OPENROUTER_API_KEY: API_KEY });
    expect(getEnv()).toBe(getEnv());
  });
});

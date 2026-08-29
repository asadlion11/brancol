/**
 * `lib/api.ts` — the failure map the UI actually renders.
 *
 * The route's error taxonomy is only useful if the browser turns each code
 * into copy a person can act on. The cases pinned here are the ones a real
 * user hits: the limiter said "wait" (429), the model pool is empty (503), the
 * brief was wrong (400 with field messages), and the network never delivered.
 *
 * The 429 body and headers below are the *observed* ones from
 * `POST /api/generate` under an 11th request inside the 60s window, not an
 * invention — `retry-after: 3`, `x-ratelimit-limit: 10`,
 * `x-ratelimit-remaining: 0`.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { requestPalette, validateRequest, REQUEST_TIMEOUT_MS } from "../api";

const BRIEF = { description: "a calm banking app", count: 5 };

function jsonResponse(
  status: number,
  body: unknown,
  headers: HeadersInit = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function stubFetch(response: Response | (() => Promise<never>)) {
  const impl =
    typeof response === "function"
      ? response
      : () => Promise.resolve(response.clone());
  vi.stubGlobal("fetch", vi.fn(impl));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestPalette — rate limiting", () => {
  const RATE_LIMIT_BODY = {
    error: {
      code: "RATE_LIMITED",
      message:
        "You're generating a little too fast. Give it a moment and try again.",
    },
  };

  it("maps a 429 onto retryable 'wait a minute' copy", async () => {
    stubFetch(
      jsonResponse(429, RATE_LIMIT_BODY, {
        "retry-after": "3",
        "x-ratelimit-limit": "10",
        "x-ratelimit-remaining": "0",
      }),
    );

    const result = await requestPalette(BRIEF);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("RATE_LIMITED");
    expect(result.error.retryable).toBe(true);
    expect(result.error.title).toBe("Too many palettes, too fast");
    expect(result.error.message).toMatch(/about a minute/);
  });

  it("does not reuse the model-unreachable copy for a 429", async () => {
    stubFetch(jsonResponse(429, RATE_LIMIT_BODY));
    const limited = await requestPalette(BRIEF);

    stubFetch(
      jsonResponse(503, {
        error: {
          code: "UPSTREAM_UNAVAILABLE",
          message: "The color model is unavailable right now.",
        },
      }),
    );
    const upstream = await requestPalette(BRIEF);

    expect(limited.ok).toBe(false);
    expect(upstream.ok).toBe(false);
    if (limited.ok || upstream.ok) return;

    // Both are retryable, but they must not read the same — otherwise the
    // retry button is a coin flip.
    expect(limited.error.title).not.toBe(upstream.error.title);
    expect(limited.error.message).not.toBe(upstream.error.message);
    expect(upstream.error.retryable).toBe(true);
  });

  it("falls back to the status when a 429 carries no error envelope", async () => {
    stubFetch(jsonResponse(429, { nope: true }));

    const result = await requestPalette(BRIEF);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("RATE_LIMITED");
    expect(result.error.retryable).toBe(true);
  });
});

describe("requestPalette — other failures", () => {
  it("keeps the route's field-level messages for a 400", async () => {
    stubFetch(
      jsonResponse(400, {
        error: {
          code: "INVALID_INPUT",
          message: "Pick at most 10 colors.",
          fields: { count: ["Pick at most 10 colors."] },
        },
      }),
    );

    const result = await requestPalette({ ...BRIEF, count: 10 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_INPUT");
    expect(result.error.retryable).toBe(false);
    expect(result.error.fields?.count).toEqual(["Pick at most 10 colors."]);
  });

  it("reports a dropped connection as NETWORK", async () => {
    stubFetch(() => Promise.reject(new TypeError("Failed to fetch")));

    const result = await requestPalette(BRIEF);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("NETWORK");
  });

  it("never sends an invalid brief over the wire", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    // count is out of range -> rejected client-side, no request made.
    const result = await requestPalette({ description: "ok", count: 99 });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_INPUT");
  });

  it("accepts an empty brief — the description is optional", async () => {
    stubFetch(jsonResponse(503, { error: { code: "UPSTREAM_UNAVAILABLE" } }));

    await requestPalette({ description: "", count: 5 });

    // An empty description is valid, so the request must reach the network
    // rather than being rejected client-side. The 503 is irrelevant here —
    // what matters is that a request was actually attempted with an empty
    // description, and that the body carried it through.
    expect(fetch).toHaveBeenCalledTimes(1);
    const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(JSON.parse(String((init as RequestInit).body))).toMatchObject({
      description: "",
      count: 5,
    });
  });

  it("sits past the route's own 30s budget", () => {
    expect(REQUEST_TIMEOUT_MS).toBeGreaterThan(30_000);
  });
});

describe("validateRequest", () => {
  it("applies the schema defaults on the way through", () => {
    const result = validateRequest(BRIEF);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.startingColors).toEqual([]);
    expect(result.data.lockedColors).toEqual([]);
  });

  it("rejects a third starting color with a field message", () => {
    const result = validateRequest({
      ...BRIEF,
      startingColors: ["#112233", "#445566", "#778899"],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.fields?.startingColors?.[0]).toMatch(/at most 2/);
  });
});

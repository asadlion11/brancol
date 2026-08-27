import { NextResponse, type NextRequest } from "next/server";

import { generatePalette } from "@/lib/ai/adapter";
import { createDeadline } from "@/lib/ai/openrouter";
import { ApiError, logApiError, toApiError } from "@/lib/errors";
import { normalizePalette } from "@/lib/palette";
import { checkRateLimit, clientIp } from "@/lib/ratelimit";
import {
  fieldErrors,
  firstErrorMessage,
  generateRequestSchema,
} from "@/lib/schemas";
import type { PaletteResponse } from "@/lib/types";

/**
 * POST /api/generate — the only operation brancol has (locked decision L18, REST).
 *
 * Pipeline, in this order and no other:
 *   method + origin guard → Zod validate → rate limit → prompt → adapter
 *   → repair → color completion → role/contrast normalization → typed response.
 *
 * Rate limiting sits ahead of the adapter deliberately: everything downstream
 * of it costs money.
 */

export const runtime = "nodejs";
// The generation budget spans two model attempts (~12s + the remainder). Vercel's
// default function timeout is lower than that, so failover would be cut off
// mid-attempt without this. It must stay in step with TOTAL_BUDGET_MS.
export const maxDuration = 30;
export const dynamic = "force-dynamic";

const ALLOWED_METHODS = "POST, OPTIONS";
/** Descriptions are capped at 500 chars; anything this large is not a real request. */
const MAX_BODY_BYTES = 16_000;

/** Headers on every response from this route. No wildcard CORS anywhere. */
function baseHeaders(origin: string | null): Headers {
  const headers = new Headers({
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    Vary: "Origin",
  });

  // Echo the origin back only when it is the app's own origin — never `*`.
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", ALLOWED_METHODS);
    headers.set("Access-Control-Allow-Headers", "Content-Type");
  }

  return headers;
}

/**
 * Same-origin check.
 *
 * A browser always sends `Origin` on a cross-site POST, so requiring it to
 * match the host this route was served from blocks cross-site abuse of the
 * endpoint. Requests with no `Origin` at all (curl, server-to-server, health
 * probes) are allowed through — they are not the CSRF threat model — but a
 * `Sec-Fetch-Site: cross-site` browser request is rejected outright.
 */
function sameOrigin(request: NextRequest): {
  ok: boolean;
  origin: string | null;
} {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return { ok: false, origin: null };
  }
  if (!origin) return { ok: true, origin: null };

  try {
    const originHost = new URL(origin).host;
    return { ok: Boolean(host) && originHost === host, origin };
  } catch {
    return { ok: false, origin: null };
  }
}

function errorResponse(
  error: ApiError,
  origin: string | null,
  extra?: HeadersInit,
): NextResponse {
  const headers = baseHeaders(origin);
  for (const [key, value] of new Headers(extra ?? {})) headers.set(key, value);

  return NextResponse.json(error.toBody(), { status: error.status, headers });
}

/** Anything that is not POST/OPTIONS. */
function methodNotAllowed(request: NextRequest): NextResponse {
  const { origin } = sameOrigin(request);
  return errorResponse(new ApiError("METHOD_NOT_ALLOWED"), origin, {
    Allow: ALLOWED_METHODS,
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { ok, origin } = sameOrigin(request);

  if (!ok) {
    const error = new ApiError("FORBIDDEN_ORIGIN", {
      detail: "origin/host mismatch",
    });
    logApiError("generate", error);
    return errorResponse(error, null);
  }

  try {
    // --- 1. Body + Zod validation -----------------------------------------
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      throw new ApiError("INVALID_INPUT", {
        message: "Send this request as JSON.",
        detail: `content-type: ${contentType || "missing"}`,
      });
    }

    const length = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
      throw new ApiError("INVALID_INPUT", {
        message: "That request is too large.",
      });
    }

    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      throw new ApiError("INVALID_INPUT", {
        message: "That request is too large.",
      });
    }

    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      throw new ApiError("INVALID_INPUT", {
        message: "That request body wasn't valid JSON.",
      });
    }

    const parsed = generateRequestSchema.safeParse(json);
    if (!parsed.success) {
      throw new ApiError("INVALID_INPUT", {
        message: firstErrorMessage(
          parsed.error,
          "That request wasn't quite right.",
        ),
        fields: fieldErrors(parsed.error),
      });
    }

    const { description, count, startingColors, lockedColors } = parsed.data;

    // --- 2. Rate limit — before anything that costs money ------------------
    const limit = await checkRateLimit(clientIp(request.headers));
    if (!limit.allowed) {
      const error = new ApiError("RATE_LIMITED", {
        detail: "per-IP limit exceeded",
      });
      logApiError("generate", error);
      return errorResponse(error, origin, {
        "Retry-After": String(limit.retryAfterSeconds),
        "X-RateLimit-Limit": String(limit.limit),
        "X-RateLimit-Remaining": "0",
      });
    }

    // --- 3. Prompt + model chain, on one shared 30s budget -----------------
    const deadline = createDeadline();
    const generation = await generatePalette(
      { description, count, startingColors, lockedColors },
      { deadline },
    );

    // --- 4. Repair output → color completion → roles → contrast ------------
    const palette = normalizePalette(generation.colors, {
      count,
      locked: lockedColors,
    });

    const body: PaletteResponse = {
      palette,
      meta: {
        model: generation.model,
        durationMs: generation.durationMs,
        fallbackUsed: generation.fallbackUsed,
      },
    };

    const headers = baseHeaders(origin);
    if (!limit.disabled)
      headers.set("X-RateLimit-Remaining", String(limit.remaining));

    return NextResponse.json(body, { status: 200, headers });
  } catch (error) {
    // Nothing from upstream ever reaches the client: `toApiError` maps unknown
    // failures onto the taxonomy, and only the taxonomy's own copy is sent.
    const apiError = toApiError(error);
    logApiError("generate", apiError);
    return errorResponse(apiError, origin);
  }
}

/** Preflight. Only the app's own origin is ever allowed. */
export function OPTIONS(request: NextRequest): NextResponse {
  const { ok, origin } = sameOrigin(request);
  if (!ok) return errorResponse(new ApiError("FORBIDDEN_ORIGIN"), null);

  return new NextResponse(null, {
    status: 204,
    headers: baseHeaders(origin),
  });
}

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const HEAD = methodNotAllowed;

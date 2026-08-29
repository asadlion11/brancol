/**
 * brancol — typed client for `POST /api/generate`.
 *
 * The browser never talks to the route by hand. Everything goes through
 * `requestPalette`, which:
 *
 *   1. validates the form against the *same* Zod schema the route re-validates
 *      against (`lib/schemas.ts`), so a bad brief never costs a model call;
 *   2. POSTs JSON with a client-side deadline;
 *   3. parses the success body with `paletteResponseSchema` rather than
 *      trusting `await response.json()` to be a `PaletteResponse`;
 *   4. maps every failure — the route's error taxonomy, a dropped connection,
 *      an unreadable body — onto one `PaletteError` with copy written for a
 *      person.
 *
 * Nothing here throws. Callers get a discriminated result and can render it.
 *
 * Client-safe: no `server-only`, no `process.env`.
 */

import type { ErrorCode } from "@/lib/errors";
import {
  errorResponseSchema,
  fieldErrors,
  generateRequestSchema,
  paletteResponseSchema,
  type GenerateRequest,
  type GenerateRequestInput,
} from "@/lib/schemas";
import type { PaletteResponse } from "@/lib/types";

/**
 * The route's codes plus the three failures that only exist in the browser:
 * the request never landed, the answer was unreadable, or the user left.
 */
export type PaletteErrorCode =
  ErrorCode | "NETWORK" | "MALFORMED_RESPONSE" | "ABORTED";

export type PaletteError = {
  code: PaletteErrorCode;
  /** Short headline for the error state — a situation, not a status code. */
  title: string;
  /** One or two sentences saying what happened and what to do next. */
  message: string;
  /** Field-level messages, present only for INVALID_INPUT. */
  fields?: Record<string, string[]>;
  /** False only when trying again cannot possibly help without an edit. */
  retryable: boolean;
};

export type PaletteResult =
  { ok: true; data: PaletteResponse } | { ok: false; error: PaletteError };

/** The result of validating a brief locally, before any network call. */
export type ValidationResult =
  { ok: true; data: GenerateRequest } | { ok: false; error: PaletteError };

/**
 * Human copy per code. Deliberately distinct: "wait a minute" and "the model is
 * down" must not read the same, or the retry button is a coin flip.
 */
const ERROR_COPY: Record<
  PaletteErrorCode,
  { title: string; message: string; retryable: boolean }
> = {
  INVALID_INPUT: {
    title: "Check the brief",
    message:
      "Something in the request doesn't line up. Adjust the description, the count or a starting color, then generate again.",
    retryable: false,
  },
  RATE_LIMITED: {
    title: "Too many palettes, too fast",
    message:
      "You've asked for several palettes in quick succession. Give it about a minute, then try again — your brief is kept.",
    retryable: true,
  },
  UPSTREAM_UNAVAILABLE: {
    title: "The color model is unreachable",
    message:
      "brancol couldn't reach the model that mixes your palette. This is usually brief — try again in a minute.",
    retryable: true,
  },
  TIMEOUT: {
    title: "That took too long",
    message:
      "The model didn't answer within the time budget. Try again, or ask for fewer colors — smaller palettes come back faster.",
    retryable: true,
  },
  METHOD_NOT_ALLOWED: {
    title: "Something went wrong on our side",
    message:
      "The request reached brancol in a shape it doesn't accept. Reload the page and try again.",
    retryable: true,
  },
  FORBIDDEN_ORIGIN: {
    title: "Something went wrong on our side",
    message:
      "brancol rejected its own request. Reload the page, then generate again.",
    retryable: true,
  },
  INTERNAL: {
    title: "Something went wrong on our side",
    message:
      "brancol hit an unexpected error while building your palette. Try again — nothing about your brief was lost.",
    retryable: true,
  },
  NETWORK: {
    title: "No connection",
    message:
      "The request never left your browser. Check your network, then generate again.",
    retryable: true,
  },
  MALFORMED_RESPONSE: {
    title: "The palette came back unreadable",
    message:
      "brancol received an answer it couldn't parse into a color system. Generating again usually fixes it.",
    retryable: true,
  },
  ABORTED: {
    title: "Generation cancelled",
    message: "That request was stopped before it finished.",
    retryable: true,
  },
};

export function paletteError(
  code: PaletteErrorCode,
  overrides: Partial<Omit<PaletteError, "code">> = {},
): PaletteError {
  return { code, ...ERROR_COPY[code], ...overrides };
}

/** Narrows an arbitrary string from the wire onto the known taxonomy. */
function toErrorCode(code: unknown): PaletteErrorCode {
  return typeof code === "string" && code in ERROR_COPY
    ? (code as PaletteErrorCode)
    : "INTERNAL";
}

/**
 * Client-side deadline. The route's own budget is 30s (`maxDuration`), so this
 * sits just past it: it exists to catch a hung socket, not to pre-empt a
 * generation that is still legitimately running.
 */
export const REQUEST_TIMEOUT_MS = 40_000;

/**
 * Validates a brief without sending it. Returns the parsed, defaulted request
 * on success and an INVALID_INPUT error carrying per-field messages otherwise.
 */
export function validateRequest(input: GenerateRequestInput): ValidationResult {
  const parsed = generateRequestSchema.safeParse(input);

  if (!parsed.success) {
    const fields = fieldErrors(parsed.error);
    return {
      ok: false,
      error: paletteError("INVALID_INPUT", {
        message:
          parsed.error.issues[0]?.message ?? ERROR_COPY.INVALID_INPUT.message,
        fields,
      }),
    };
  }

  return { ok: true, data: parsed.data };
}

/**
 * Generates a palette. Validates first, then POSTs.
 *
 * `signal` lets a caller drop a request it no longer wants (an unmount, a
 * second submit); that surfaces as `ABORTED`, which the UI ignores rather than
 * showing. A blown internal deadline surfaces as `TIMEOUT`, which it shows.
 */
export async function requestPalette(
  input: GenerateRequestInput,
  options: { signal?: AbortSignal } = {},
): Promise<PaletteResult> {
  const validated = validateRequest(input);
  if (!validated.ok) return validated;

  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  const external = options.signal;
  const forwardAbort = () => controller.abort();
  external?.addEventListener("abort", forwardAbort, { once: true });

  try {
    let response: Response;

    try {
      response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated.data),
        signal: controller.signal,
        cache: "no-store",
      });
    } catch {
      if (timedOut) return { ok: false, error: paletteError("TIMEOUT") };
      if (external?.aborted)
        return { ok: false, error: paletteError("ABORTED") };
      return { ok: false, error: paletteError("NETWORK") };
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return {
        ok: false,
        error: paletteError(
          response.ok ? "MALFORMED_RESPONSE" : toErrorCode(undefined),
        ),
      };
    }

    if (!response.ok) {
      const envelope = errorResponseSchema.safeParse(body);

      if (!envelope.success) {
        // A failing status with a body we don't recognize: trust the status.
        return {
          ok: false,
          error: paletteError(statusToCode(response.status)),
        };
      }

      const code = toErrorCode(envelope.data.error.code);
      return {
        ok: false,
        error: paletteError(code, {
          // The route's INVALID_INPUT message is specific to the offending
          // field, so it beats our generic copy. Every other code's server
          // message is deliberately vague — ours reads better.
          ...(code === "INVALID_INPUT"
            ? {
                message: envelope.data.error.message,
                fields: envelope.data.error.fields,
              }
            : {}),
        }),
      };
    }

    const parsed = paletteResponseSchema.safeParse(body);
    if (!parsed.success) {
      return { ok: false, error: paletteError("MALFORMED_RESPONSE") };
    }

    return { ok: true, data: parsed.data };
  } finally {
    clearTimeout(timer);
    external?.removeEventListener("abort", forwardAbort);
  }
}

/** Fallback when a failing response carries no usable error envelope. */
function statusToCode(status: number): PaletteErrorCode {
  switch (status) {
    case 400:
      return "INVALID_INPUT";
    case 403:
      return "FORBIDDEN_ORIGIN";
    case 405:
      return "METHOD_NOT_ALLOWED";
    case 429:
      return "RATE_LIMITED";
    case 503:
      return "UPSTREAM_UNAVAILABLE";
    case 504:
      return "TIMEOUT";
    default:
      return "INTERNAL";
  }
}

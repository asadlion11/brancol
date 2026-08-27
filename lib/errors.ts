/**
 * brancol — error taxonomy.
 *
 * Every failure the API can produce maps to one of these codes, a fixed HTTP
 * status, and a message written for a person rather than a log reader.
 *
 * Rule: nothing from upstream ever crosses this boundary. Provider messages,
 * stack traces, model slugs on failure, and above all `OPENROUTER_API_KEY`
 * (locked decision L17) stay server-side; the client sees only the constants
 * below. Diagnostic detail goes to `console.error` instead.
 */

export const ERROR_CODES = {
  INVALID_INPUT: "INVALID_INPUT",
  RATE_LIMITED: "RATE_LIMITED",
  UPSTREAM_UNAVAILABLE: "UPSTREAM_UNAVAILABLE",
  TIMEOUT: "TIMEOUT",
  METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
  FORBIDDEN_ORIGIN: "FORBIDDEN_ORIGIN",
  INTERNAL: "INTERNAL",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export const ERROR_STATUS: Record<ErrorCode, number> = {
  INVALID_INPUT: 400,
  RATE_LIMITED: 429,
  UPSTREAM_UNAVAILABLE: 503,
  TIMEOUT: 504,
  METHOD_NOT_ALLOWED: 405,
  FORBIDDEN_ORIGIN: 403,
  INTERNAL: 500,
};

/** User-facing copy. Deliberately generic — these are safe to show anyone. */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  INVALID_INPUT:
    "That request wasn't quite right. Check the description and color count, then try again.",
  RATE_LIMITED:
    "You're generating a little too fast. Give it a moment and try again.",
  UPSTREAM_UNAVAILABLE:
    "The color model is unavailable right now. Please try again in a minute.",
  TIMEOUT:
    "Generating that palette took too long. Try again, or ask for fewer colors.",
  METHOD_NOT_ALLOWED: "That method isn't supported on this endpoint.",
  FORBIDDEN_ORIGIN: "This endpoint only accepts requests from the brancol app.",
  INTERNAL: "Something went wrong on our side. Please try again.",
};

/** The single error shape the API ever returns. */
export type ApiErrorBody = {
  error: {
    code: ErrorCode;
    message: string;
    fields?: Record<string, string[]>;
  };
};

/**
 * A failure that is safe to turn into a response. Anything thrown that is *not*
 * an `ApiError` is treated as INTERNAL and never surfaced verbatim.
 */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fields?: Record<string, string[]>;
  /** Server-side only. Logged, never serialized. */
  readonly detail?: string;

  constructor(
    code: ErrorCode,
    options: {
      message?: string;
      fields?: Record<string, string[]>;
      detail?: string;
    } = {},
  ) {
    super(options.message ?? ERROR_MESSAGES[code]);
    this.name = "ApiError";
    this.code = code;
    this.status = ERROR_STATUS[code];
    this.fields = options.fields;
    this.detail = options.detail;
  }

  /** The exact JSON body sent to the client — no `detail`, no cause, no stack. */
  toBody(): ApiErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.fields ? { fields: this.fields } : {}),
      },
    };
  }
}

/** Maps an unknown thrown value onto the taxonomy without leaking its contents. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  ) {
    return new ApiError("TIMEOUT", { detail: error.name });
  }

  return new ApiError("INTERNAL", {
    detail:
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : "non-error thrown",
  });
}

/**
 * Redacts anything that looks like a credential before a diagnostic is logged.
 * Defence in depth: upstream bodies are echoed into logs, never into responses.
 */
export function redact(text: string): string {
  return text
    .replace(/sk-or-v1-[A-Za-z0-9_-]+/g, "sk-or-v1-[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]");
}

/** One-line server log for a failure. Never called with a response body. */
export function logApiError(scope: string, error: ApiError): void {
  const detail = error.detail ? redact(error.detail) : "";
  console.error(
    `[brancol:${scope}] ${error.code}${detail ? ` — ${detail}` : ""}`,
  );
}

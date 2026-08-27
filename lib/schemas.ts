/**
 * brancol — Zod v4 schemas shared by the client and the server.
 *
 * Single source of truth: the browser validates the form against exactly the
 * same schema the route handler re-validates against, so the two can never
 * drift. Because the client imports this file it must NOT import `server-only`
 * and must never touch `process.env`.
 *
 * Zod v4 idioms used here (not v3): `.extend()` instead of `.merge()`, a single
 * `error` parameter instead of `message` / `required_error`, and
 * `z.treeifyError()` / `z.flattenError()` instead of `.format()` / `.flatten()`.
 */

import { z } from "zod";

import {
  ROLES,
  type Color,
  type PaletteMeta,
  type PaletteResponse,
} from "./types";

export const MAX_DESCRIPTION_LENGTH = 500;
export const MIN_COLOR_COUNT = 2;
export const MAX_COLOR_COUNT = 10;
export const MAX_STARTING_COLORS = 2;

/** 3- or 6-digit hex with a leading `#`. Normalization to 6-digit happens in `lib/color.ts`. */
export const HEX_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export const hexSchema = z
  .string({ error: "A hex color is required." })
  .trim()
  .regex(HEX_PATTERN, { error: "Use a hex color such as #1769AA." });

export const roleSchema = z.enum(ROLES);

/**
 * A locked color may arrive either as a bare hex string or as a full swatch the
 * client is echoing back. Both normalize to the same object shape.
 */
export const lockedColorSchema = z.union([
  hexSchema.transform((hex) => ({ hex })),
  z
    .object({
      hex: hexSchema,
      role: roleSchema.optional(),
      name: z.string().trim().max(60).optional(),
    })
    .transform(({ hex, role, name }) => ({ hex, role, name })),
]);

export const generateRequestSchema = z.object({
  description: z
    .string({ error: "Describe your project so brancol knows the context." })
    .trim()
    .min(1, { error: "Describe your project so brancol knows the context." })
    .max(MAX_DESCRIPTION_LENGTH, {
      error: `Keep the description under ${MAX_DESCRIPTION_LENGTH} characters.`,
    }),
  count: z
    .int({ error: "Pick how many colors you need." })
    .min(MIN_COLOR_COUNT, { error: `Pick at least ${MIN_COLOR_COUNT} colors.` })
    .max(MAX_COLOR_COUNT, { error: `Pick at most ${MAX_COLOR_COUNT} colors.` }),
  startingColors: z
    .array(hexSchema)
    .max(MAX_STARTING_COLORS, {
      error: `Seed with at most ${MAX_STARTING_COLORS} colors.`,
    })
    .default([]),
  lockedColors: z.array(lockedColorSchema).max(MAX_COLOR_COUNT).default([]),
});

export type GenerateRequest = z.infer<typeof generateRequestSchema>;
export type GenerateRequestInput = z.input<typeof generateRequestSchema>;

/**
 * What the model is allowed to return per color. Unknown keys are stripped
 * rather than rejected (Zod object schemas strip by default) — models like to
 * volunteer `rgb`, `usage` or `description` fields, and any color math they
 * offer is discarded in favour of culori's.
 */
export const aiColorSchema = z.object({
  role: z.string().optional(),
  name: z.string().optional(),
  hex: z.string(),
});

export type AIColor = z.infer<typeof aiColorSchema>;

/** The envelope requested in the prompt: `{ "colors": [...] }`. */
export const aiPaletteSchema = z.object({
  colors: z
    .array(aiColorSchema)
    .min(1, { error: "The model returned no colors." }),
});

export type AIPalette = z.infer<typeof aiPaletteSchema>;

/** The fully completed swatch the API returns. Annotated so it can never drift from `Color`. */
export const colorSchema: z.ZodType<Color> = z.object({
  role: roleSchema,
  name: z.string().min(1),
  hex: hexSchema,
  rgb: z.string().min(1),
  hsl: z.string().min(1),
  oklch: z.string().min(1),
  locked: z.boolean(),
});

export const paletteMetaSchema: z.ZodType<PaletteMeta> = z.object({
  model: z.string().min(1),
  durationMs: z.number().nonnegative(),
  fallbackUsed: z.boolean(),
});

export const paletteResponseSchema: z.ZodType<PaletteResponse> = z.object({
  palette: z.array(colorSchema).min(MIN_COLOR_COUNT).max(MAX_COLOR_COUNT),
  meta: paletteMetaSchema,
});

/** The error envelope every failing route response uses. */
export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    /** Present only for INVALID_INPUT — field-level messages from `z.treeifyError()`. */
    fields: z.record(z.string(), z.array(z.string())).optional(),
  }),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

/**
 * Flattens a Zod v4 error into `{ field: [messages] }` for the client.
 * Uses `z.flattenError()` — `.flatten()` was removed in v4.
 */
export function fieldErrors(
  error: z.ZodError<unknown>,
): Record<string, string[]> {
  const flat = z.flattenError(error as z.ZodError<Record<string, unknown>>);
  const fields: Record<string, string[]> = {};

  for (const [key, messages] of Object.entries(flat.fieldErrors)) {
    if (Array.isArray(messages) && messages.length > 0) {
      fields[key] = messages as string[];
    }
  }
  if (flat.formErrors.length > 0) fields._ = flat.formErrors;

  return fields;
}

/** First human-readable message from a Zod v4 error, for the top-level `message`. */
export function firstErrorMessage(
  error: z.ZodError<unknown>,
  fallback: string,
): string {
  return error.issues[0]?.message ?? fallback;
}

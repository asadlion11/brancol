/**
 * brancol — shared domain types.
 *
 * This module is the single source of truth for the palette contract and is
 * imported by both the browser and the server, so it must stay free of
 * `server-only` and of any Node built-in.
 */

/** Every semantic role a generated color may carry. Order is the display order. */
export const ROLES = [
  "primary",
  "secondary",
  "tertiary",
  "accent",
  "highlight",
  "background",
  "surface",
  "border",
  "text",
  "muted",
  "success",
  "warning",
  "error",
  "info",
] as const;

export type Role = (typeof ROLES)[number];

/** Fast membership test for role coercion. */
const ROLE_SET: ReadonlySet<string> = new Set<string>(ROLES);

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && ROLE_SET.has(value);
}

/**
 * A single palette entry. The model supplies `role`, `name` and `hex` only —
 * `rgb` / `hsl` / `oklch` are always derived server-side with culori so the
 * math can never be wrong (see `lib/color.ts`).
 */
export type Color = {
  role: Role;
  /** Human, evocative — "Ocean Blue", never "Color 01" or "Blue 500". */
  name: string;
  /** Uppercase 6-digit hex, always with a leading `#`. */
  hex: string;
  /** `rgb(23,105,170)` */
  rgb: string;
  /** `hsl(203,76%,38%)` */
  hsl: string;
  /** `oklch(0.52 0.11 240)` */
  oklch: string;
  locked: boolean;
};

/** Non-visual information about how a palette was produced. */
export type PaletteMeta = {
  /** The model slug that actually answered (not necessarily the primary). */
  model: string;
  /** Wall-clock duration of the whole generation, in milliseconds. */
  durationMs: number;
  /** True when the primary model failed and a fallback answered instead. */
  fallbackUsed: boolean;
};

export type PaletteResponse = {
  palette: Color[];
  meta: PaletteMeta;
};

/** What the model is asked to return, before any server-side completion. */
export type AIColor = {
  role?: string;
  name?: string;
  hex: string;
};

/** A color the user pinned; regeneration must preserve it byte-for-byte. */
export type LockedColor = {
  hex: string;
  role?: Role;
  name?: string;
};

/**
 * brancol — color completion.
 *
 * The model is only ever asked for `{ role, name, hex }` (locked decision L14).
 * Everything else — RGB, HSL, OKLCH — is computed here with culori (L4). Any
 * color math a model volunteers is discarded: models routinely emit RGB that
 * does not match their own hex.
 *
 * Client-safe: no `server-only`, no Node built-ins.
 */

import { converter, formatHex, parse } from "culori";

import { HEX_PATTERN } from "./schemas";

const toRgb = converter("rgb");
const toHsl = converter("hsl");
const toOklch = converter("oklch");

/** Everything derivable from a hex string. */
export type ColorFormats = {
  hex: string;
  rgb: string;
  hsl: string;
  oklch: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Expands `#abc` to `#aabbcc`. Input must already be a validated hex. */
function expandShortHex(hex: string): string {
  if (hex.length !== 4) return hex;
  const [, r, g, b] = hex;
  return `#${r}${r}${g}${g}${b}${b}`;
}

/**
 * Coerces whatever the model produced into a canonical `#RRGGBB` string.
 *
 * Handles the drift seen in practice: missing `#`, 3-digit shorthand, 8-digit
 * hex with alpha, stray quotes/semicolons/whitespace, and CSS colors given as
 * `rgb(...)`, `hsl(...)` or a named color. Returns `null` when nothing usable
 * can be recovered — the caller decides whether to drop or fail over.
 */
export function normalizeHex(input: unknown): string | null {
  if (typeof input !== "string") return null;

  const cleaned = input
    .trim()
    .replace(/^["'`]+|["'`;,]+$/g, "")
    .trim();
  if (cleaned.length === 0) return null;

  // Bare hex, with or without the leading `#`.
  const bare = cleaned.startsWith("#") ? cleaned : `#${cleaned}`;
  if (HEX_PATTERN.test(bare)) {
    return expandShortHex(bare).toUpperCase();
  }
  // 8-digit hex: keep the color, drop the alpha channel.
  if (/^#[0-9a-fA-F]{8}$/.test(bare)) {
    return bare.slice(0, 7).toUpperCase();
  }

  // Last resort: let culori parse `rgb(...)`, `hsl(...)`, `oklch(...)` or a named color.
  const parsed = parse(cleaned);
  if (!parsed) return null;

  const hex = formatHex(parsed);
  return hex ? hex.toUpperCase() : null;
}

/** `rgb(23,105,170)` — the exact format pinned by the API contract. */
export function formatRgbString(hex: string): string {
  const rgb = toRgb(hex);
  if (!rgb) return "rgb(0,0,0)";

  const channel = (value: number) => Math.round(clamp(value, 0, 1) * 255);
  return `rgb(${channel(rgb.r)},${channel(rgb.g)},${channel(rgb.b)})`;
}

/** `hsl(203,76%,38%)` — achromatic colors get hue 0 rather than `NaN`. */
export function formatHslString(hex: string): string {
  const hsl = toHsl(hex);
  if (!hsl) return "hsl(0,0%,0%)";

  const h = Math.round(hsl.h ?? 0) % 360;
  const s = Math.round(clamp(hsl.s ?? 0, 0, 1) * 100);
  const l = Math.round(clamp(hsl.l ?? 0, 0, 1) * 100);
  return `hsl(${h < 0 ? h + 360 : h},${s}%,${l}%)`;
}

/** `oklch(0.52 0.11 240)` — L and C to two decimals, hue to a whole degree. */
export function formatOklchString(hex: string): string {
  const oklch = toOklch(hex);
  if (!oklch) return "oklch(0 0 0)";

  const l = clamp(oklch.l ?? 0, 0, 1).toFixed(2);
  const c = Math.max(0, oklch.c ?? 0).toFixed(2);
  const h = Math.round(oklch.h ?? 0) % 360;
  return `oklch(${l} ${c} ${h < 0 ? h + 360 : h})`;
}

/**
 * Turns a hex into the full set of contract formats.
 * Throws only on an un-normalizable input, which callers filter out first.
 */
export function completeColor(hex: string): ColorFormats {
  const normalized = normalizeHex(hex);
  if (!normalized) {
    throw new Error("completeColor received a value that is not a color.");
  }

  return {
    hex: normalized,
    rgb: formatRgbString(normalized),
    hsl: formatHslString(normalized),
    oklch: formatOklchString(normalized),
  };
}

/** OKLCH channels, with safe defaults for achromatic colors. */
export function oklchOf(hex: string): { l: number; c: number; h: number } {
  const oklch = toOklch(hex);
  if (!oklch) return { l: 0, c: 0, h: 0 };
  return {
    l: clamp(oklch.l ?? 0, 0, 1),
    c: Math.max(0, oklch.c ?? 0),
    h: (((oklch.h ?? 0) % 360) + 360) % 360,
  };
}

/** Builds a hex from OKLCH channels, used when synthesizing filler colors. */
export function hexFromOklch(l: number, c: number, h: number): string {
  const hex = formatHex({
    mode: "oklch",
    l: clamp(l, 0, 1),
    c: Math.max(0, c),
    h: ((h % 360) + 360) % 360,
  });
  return (hex ?? "#000000").toUpperCase();
}

/* -------------------------------------------------------------------------- */
/* Naming                                                                     */
/* -------------------------------------------------------------------------- */

const HUE_NAMES: ReadonlyArray<{ max: number; name: string }> = [
  { max: 15, name: "Ember" },
  { max: 45, name: "Amber" },
  { max: 70, name: "Sand" },
  { max: 100, name: "Meadow" },
  { max: 150, name: "Fern" },
  { max: 190, name: "Lagoon" },
  { max: 230, name: "Ocean" },
  { max: 265, name: "Indigo" },
  { max: 300, name: "Violet" },
  { max: 330, name: "Orchid" },
  { max: 350, name: "Rose" },
  { max: 361, name: "Ember" },
];

function hueName(hue: number): string {
  return HUE_NAMES.find((band) => hue < band.max)?.name ?? "Ember";
}

function lightnessWord(l: number): string {
  if (l < 0.2) return "Midnight";
  if (l < 0.4) return "Deep";
  if (l < 0.6) return "True";
  if (l < 0.78) return "Soft";
  return "Pale";
}

/** A descriptive, non-generic fallback name derived from the color itself. */
export function describeColor(hex: string): string {
  const { l, c, h } = oklchOf(hex);

  if (c < 0.02) {
    if (l < 0.2) return "Deep Charcoal";
    if (l < 0.42) return "Slate Gray";
    if (l < 0.62) return "Stone Gray";
    if (l < 0.86) return "Quiet Ash";
    return "Paper White";
  }

  return `${lightnessWord(l)} ${hueName(h)}`;
}

/**
 * Names that read as machine output rather than design vocabulary. The spec
 * bans these outright ("Color 01", "Blue 500"), so they are replaced with a
 * derived descriptive name instead of being shown to the user.
 */
const GENERIC_NAME_PATTERNS: readonly RegExp[] = [
  /^(color|colour|swatch|shade|tone|hue|tint)\s*[-#_]?\s*\d*$/i,
  /^[a-z\s]+[-\s]?\d{2,4}$/i, // "Blue 500", "gray-900"
  /^#?[0-9a-f]{3,8}$/i, // the hex repeated as a name
  /^(primary|secondary|tertiary|accent|highlight|background|surface|border|text|muted|success|warning|error|info)$/i,
  /^(n\/?a|none|null|undefined|todo|tbd)$/i,
];

/**
 * Returns a trustworthy display name: the model's, when it is evocative and
 * well-formed; otherwise one derived from the color.
 */
export function sanitizeName(name: unknown, hex: string): string {
  if (typeof name !== "string") return describeColor(hex);

  const cleaned = name
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^["'`*_\s]+|["'`*_\s]+$/g, "")
    .trim();

  if (cleaned.length < 3 || cleaned.length > 40) return describeColor(hex);
  if (GENERIC_NAME_PATTERNS.some((pattern) => pattern.test(cleaned))) {
    return describeColor(hex);
  }

  // Title-case a name the model shouted or lower-cased.
  const titled = cleaned
    .split(" ")
    .map((word) =>
      word.length > 2 && word === word.toUpperCase()
        ? word[0] + word.slice(1).toLowerCase()
        : word[0].toUpperCase() + word.slice(1),
    )
    .join(" ");

  return titled;
}

/** Makes a name unique within a palette without falling back to numbering. */
export function uniqueName(
  name: string,
  taken: Set<string>,
  hex: string,
): string {
  if (!taken.has(name.toLowerCase())) return name;

  const derived = describeColor(hex);
  if (
    !taken.has(derived.toLowerCase()) &&
    derived.toLowerCase() !== name.toLowerCase()
  ) {
    return derived;
  }

  const { l } = oklchOf(hex);
  for (const prefix of [
    "Deep",
    "Soft",
    "Muted",
    "Bright",
    "Pale",
    "Warm",
    "Cool",
  ]) {
    const candidate = `${prefix} ${derived.split(" ").at(-1) ?? "Hue"}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }

  return `${lightnessWord(l)} ${hueName(oklchOf(hex).h)} Tone`;
}

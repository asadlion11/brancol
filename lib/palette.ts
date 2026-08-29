/**
 * brancol — palette normalization.
 *
 * Everything between "the model said something" and "the API returns a typed
 * palette" happens here: role coercion and de-duplication, guaranteed `primary`,
 * a role mix that scales from 2 to 10 colors, non-generic names, exact count,
 * locked-color re-injection, and a contrast sanity pass.
 *
 * Nothing here trusts the model. Client-safe (no `server-only`).
 */

import {
  completeColor,
  describeColor,
  hexFromOklch,
  normalizeHex,
  oklchOf,
  sanitizeName,
  uniqueName,
} from "./color";
import { AA_NORMAL, contrastRatio } from "./contrast";
import type { AIColor } from "./schemas";
import {
  ROLES,
  isRole,
  type Color,
  type LockedColor,
  type Role,
} from "./types";

/**
 * The order roles are introduced as the requested count grows. A 2-color system
 * is primary + secondary; each extra color adds the next most useful role.
 * Semantic state colors sit last — they are only used if the model asks for them.
 */
export const ROLE_PRIORITY: readonly Role[] = [
  "primary",
  "secondary",
  "background",
  "text",
  "accent",
  "surface",
  "border",
  "muted",
  "highlight",
  "tertiary",
  "success",
  "warning",
  "error",
  "info",
];

/** The role mix brancol aims for at a given color count. */
export function targetRoles(count: number): Role[] {
  const clamped = Math.max(
    1,
    Math.min(ROLE_PRIORITY.length, Math.round(count)),
  );
  return ROLE_PRIORITY.slice(0, clamped);
}

/** Common model drift mapped onto the pinned role union. */
const ROLE_SYNONYMS: Record<string, Role> = {
  main: "primary",
  brand: "primary",
  base: "primary",
  dominant: "primary",
  key: "primary",
  support: "secondary",
  supporting: "secondary",
  complementary: "secondary",
  third: "tertiary",
  cta: "accent",
  action: "accent",
  emphasis: "accent",
  pop: "accent",
  focus: "highlight",
  spotlight: "highlight",
  bg: "background",
  backdrop: "background",
  canvas: "background",
  page: "background",
  card: "surface",
  panel: "surface",
  elevated: "surface",
  container: "surface",
  outline: "border",
  stroke: "border",
  divider: "border",
  rule: "border",
  foreground: "text",
  fg: "text",
  body: "text",
  copy: "text",
  ink: "text",
  content: "text",
  label: "text",
  neutral: "muted",
  subtle: "muted",
  secondarytext: "muted",
  disabled: "muted",
  gray: "muted",
  grey: "muted",
  positive: "success",
  ok: "success",
  confirm: "success",
  caution: "warning",
  alert: "warning",
  danger: "error",
  destructive: "error",
  critical: "error",
  negative: "error",
  note: "info",
  information: "info",
  notice: "info",
};

/** Coerces any string the model produced into a legal role, or `null`. */
export function coerceRole(value: unknown): Role | null {
  if (typeof value !== "string") return null;

  const key = value
    .toLowerCase()
    .trim()
    .replace(/[\s_-]*colou?r$/, "")
    .replace(/[^a-z]/g, "");

  if (isRole(key)) return key;
  if (key in ROLE_SYNONYMS) return ROLE_SYNONYMS[key];

  // "primary blue", "background-light" → match on the leading known word.
  for (const role of ROLES) {
    if (key.startsWith(role)) return role;
  }
  for (const [synonym, role] of Object.entries(ROLE_SYNONYMS)) {
    if (key.startsWith(synonym)) return role;
  }

  return null;
}

type Candidate = {
  hex: string;
  name?: string;
  /** The model's role, once coerced. `null` means "server decides". */
  role: Role | null;
  locked: boolean;
};

/** How well a color suits a role, 0–1. Used to fill roles the model left open. */
function roleAffinity(role: Role, hex: string): number {
  const { l, c, h } = oklchOf(hex);
  const chroma = Math.min(1, c / 0.25);
  const hueScore = (target: number) =>
    1 - Math.min(180, Math.abs(((h - target + 540) % 360) - 180)) / 180;

  switch (role) {
    case "background":
      return l * 0.85 + (1 - chroma) * 0.15;
    case "surface":
      return (1 - Math.abs(l - 0.9)) * 0.8 + (1 - chroma) * 0.2;
    case "text":
      return (1 - l) * 0.85 + (1 - chroma) * 0.15;
    case "muted":
      return (1 - Math.abs(l - 0.65)) * 0.6 + (1 - chroma) * 0.4;
    case "border":
      return (1 - Math.abs(l - 0.8)) * 0.6 + (1 - chroma) * 0.4;
    case "primary":
    case "accent":
    case "highlight":
      return chroma * 0.7 + (1 - Math.abs(l - 0.6)) * 0.3;
    case "secondary":
    case "tertiary":
      return chroma * 0.5 + (1 - Math.abs(l - 0.55)) * 0.5;
    case "success":
      return hueScore(145) * 0.7 + chroma * 0.3;
    case "warning":
      return hueScore(75) * 0.7 + chroma * 0.3;
    case "error":
      return hueScore(25) * 0.7 + chroma * 0.3;
    case "info":
      return hueScore(240) * 0.7 + chroma * 0.3;
    default:
      return 0.5;
  }
}

/** Deterministic filler when the model returns fewer colors than requested. */
function synthesize(seed: Candidate | undefined, index: number): Candidate {
  const base = seed ? oklchOf(seed.hex) : { l: 0.55, c: 0.12, h: 240 };
  // Golden-angle rotation keeps generated hues visibly distinct.
  const hue = (base.h + 137.5 * (index + 1)) % 360;
  const lightness = 0.25 + ((base.l * 100 + 23 * (index + 1)) % 55) / 100;
  const chroma = Math.max(0.04, Math.min(0.16, base.c || 0.1));

  return {
    hex: hexFromOklch(lightness, chroma, hue),
    role: null,
    locked: false,
  };
}

export type NormalizeOptions = {
  count: number;
  locked?: LockedColor[];
};

/**
 * Turns raw model colors into exactly `count` valid, role-assigned swatches.
 *
 * Locked colors are re-injected here rather than trusted from the model's echo
 * (it will not reproduce them byte-for-byte), and always come back `locked: true`.
 */
export function normalizePalette(
  input: AIColor[],
  options: NormalizeOptions,
): Color[] {
  const count = Math.max(
    1,
    Math.min(ROLE_PRIORITY.length, Math.round(options.count)),
  );
  const seen = new Set<string>();
  const candidates: Candidate[] = [];

  // 1. Locked colors first — they are anchors, not suggestions.
  for (const locked of options.locked ?? []) {
    const hex = normalizeHex(locked.hex);
    if (!hex || seen.has(hex) || candidates.length >= count) continue;
    seen.add(hex);
    candidates.push({
      hex,
      name: locked.name,
      role: locked.role ?? null,
      locked: true,
    });
  }

  // 2. Then whatever the model produced, de-duplicated by hex.
  for (const color of input) {
    if (candidates.length >= count) break;
    const hex = normalizeHex(color.hex);
    if (!hex || seen.has(hex)) continue;
    seen.add(hex);
    candidates.push({
      hex,
      name: color.name,
      role: coerceRole(color.role),
      locked: false,
    });
  }

  // 3. Too few colors (or duplicates collapsed) — fill deterministically.
  let guard = 0;
  while (candidates.length < count && guard < count * 4) {
    guard += 1;
    const filler = synthesize(candidates.at(-1) ?? candidates[0], guard);
    if (seen.has(filler.hex)) continue;
    seen.add(filler.hex);
    candidates.push(filler);
  }

  const roles = assignRoles(candidates, count);
  const named = new Set<string>();

  const palette: Color[] = candidates.map((candidate, index) => {
    const role = roles[index];
    const formats = completeColor(candidate.hex);
    const base = sanitizeName(
      candidate.name ?? describeColor(formats.hex),
      formats.hex,
    );
    const name = uniqueName(base, named, formats.hex);
    named.add(name.toLowerCase());

    return { role, name, ...formats, locked: candidate.locked };
  });

  return sortByRole(ensureReadableText(palette));
}

/**
 * Resolves one role per candidate: the model's choice when it is legal and
 * unclaimed, otherwise the best-suited remaining color for each missing role.
 * A `primary` is always present.
 */
function assignRoles(candidates: Candidate[], count: number): Role[] {
  const assigned: (Role | null)[] = candidates.map(() => null);
  const used = new Set<Role>();

  // Pass A — honour the model (and any locked role) where it is unambiguous.
  candidates.forEach((candidate, index) => {
    if (candidate.role && !used.has(candidate.role)) {
      assigned[index] = candidate.role;
      used.add(candidate.role);
    }
  });

  // Pass B — fill the target mix, best-suited color first.
  const wanted = [...targetRoles(count), ...ROLES].filter(
    (role) => !used.has(role),
  );
  for (const role of wanted) {
    const openIndexes = assigned
      .map((value, index) => (value === null ? index : -1))
      .filter((index) => index >= 0);
    if (openIndexes.length === 0) break;

    const best = openIndexes.reduce((bestIndex, index) =>
      roleAffinity(role, candidates[index].hex) >
      roleAffinity(role, candidates[bestIndex].hex)
        ? index
        : bestIndex,
    );
    assigned[best] = role;
    used.add(role);
  }

  // Pass C — anything still open (only possible past 14 colors) gets a legal role.
  const resolved = assigned.map(
    (role, index) => role ?? ROLE_PRIORITY[index % ROLE_PRIORITY.length],
  );

  // Guarantee: a palette without a primary is not a color system.
  if (!resolved.includes("primary")) {
    const bestPrimary = candidates.reduce(
      (bestIndex, _candidate, index) =>
        roleAffinity("primary", candidates[index].hex) >
        roleAffinity("primary", candidates[bestIndex].hex)
          ? index
          : bestIndex,
      0,
    );
    resolved[bestPrimary] = "primary";
  }

  return resolved;
}

/**
 * If the palette carries both `text` and `background`, nudge the text lightness
 * until the pair clears WCAG AA. Hue and chroma are preserved, so the design
 * intent survives; only the tone moves.
 */
function ensureReadableText(palette: Color[]): Color[] {
  const background = palette.find((color) => color.role === "background");
  const textIndex = palette.findIndex((color) => color.role === "text");
  if (!background || textIndex === -1) return palette;

  const text = palette[textIndex];
  if (text.locked || contrastRatio(text.hex, background.hex) >= AA_NORMAL)
    return palette;

  const { l, c, h } = oklchOf(text.hex);
  const darken = oklchOf(background.hex).l >= 0.5;

  for (let step = 1; step <= 20; step += 1) {
    const nextL = darken
      ? Math.max(0, l - step * 0.05)
      : Math.min(1, l + step * 0.05);
    const hex = hexFromOklch(nextL, c, h);
    if (contrastRatio(hex, background.hex) >= AA_NORMAL) {
      palette[textIndex] = { ...text, ...completeColor(hex) };
      break;
    }
  }

  return palette;
}

/** Stable, design-system display order so locked swatches keep their place. */
function sortByRole(palette: Color[]): Color[] {
  return [...palette].sort(
    (a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role),
  );
}

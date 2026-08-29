/**
 * brancol — light/dark variant derivation.
 *
 * A palette is generated for one mode. The other mode is *derived*, in OKLCH,
 * with culori (locked decision L4).
 *
 * Why not an invert. `#FFFFFF - color` looks like it works on a grayscale
 * mock and destroys everything else: inverting a hex rotates hue by 180° (a
 * warm terracotta comes back as a cold teal), so the palette that arrives in
 * dark mode is a *different* palette wearing the same role names. The brand
 * disappears. Nothing here touches hue.
 *
 * What actually happens:
 *
 *   - **Hue is held.** Every color keeps its OKLCH hue to the degree. That is
 *     the whole reason for working in OKLCH rather than HSL: OKLCH lightness
 *     is perceptual, so moving L leaves the hue looking like itself instead of
 *     drifting the way an HSL lightness ramp does through the yellows.
 *
 *   - **Lightness is remapped per role, and the ends swap for the ground.**
 *     `background`, `surface`, `text` and `border` are *positional* roles:
 *     their job is "the furthest thing from the content" or "the thing that
 *     sits on top". In dark mode those positions are at the opposite end of
 *     the L axis, so those roles are mirrored (L → 1 − L) and then landed
 *     inside a band tuned for the mode. A near-white background becomes a
 *     near-black one; near-black text becomes near-white.
 *
 *   - **Brand and semantic roles are NOT mirrored.** `primary`, `accent`,
 *     `success` … are *identities*, not positions. Mirroring them would turn
 *     the brand inside out. They are only pulled toward a lightness that stays
 *     legible against the new ground, and the pull is gentle — weakest of all
 *     on `accent`, which has to stay recognisably itself.
 *
 *   - **Chroma is fitted, never invented.** Lifting L can push a saturated
 *     color outside sRGB; `clampChroma` walks chroma down at a fixed L and H
 *     rather than letting the hex clip, which is what would bend the hue.
 *     Grounds get their chroma damped: a tint that reads as a warm white at
 *     L 0.97 reads as a colour cast at L 0.15.
 *
 * Client-safe: no `server-only`, no Node built-ins.
 */

import { clampChroma, formatHex } from "culori";

import { completeColor, oklchOf } from "./color";
import type { Color, Role } from "./types";

export type Scheme = "light" | "dark";

/**
 * How one role's lightness is moved.
 *
 * `mirror` — a positional role. L is flipped and clamped into `band`; the
 * clamp is what makes the swap decisive rather than merely "a bit darker".
 *
 * `pull`  — an identity role. L moves a `strength` fraction of the way toward
 * `target` and no further, so the color stays itself.
 */
type Rule =
  | { kind: "mirror"; band: readonly [number, number]; chroma: number }
  | { kind: "pull"; target: number; strength: number; chroma: number };

/** Every role gets an explicit rule — no role falls through to a guess. */
type RuleTable = Readonly<Record<Role, Rule>>;

/**
 * Dark mode. Grounds go to the bottom of the L axis, ink to the top, and the
 * brand lifts to ~0.72 where a mid-chroma color still clears AA on a 0.15
 * ground.
 */
const DARK_RULES: RuleTable = {
  // Positional — these swap ends.
  background: { kind: "mirror", band: [0.14, 0.26], chroma: 0.55 },
  surface: { kind: "mirror", band: [0.2, 0.32], chroma: 0.55 },
  border: { kind: "mirror", band: [0.3, 0.42], chroma: 0.6 },
  text: { kind: "mirror", band: [0.9, 0.97], chroma: 0.5 },
  muted: { kind: "mirror", band: [0.58, 0.72], chroma: 0.7 },

  // Identity — these stay themselves and only become legible.
  primary: { kind: "pull", target: 0.72, strength: 0.55, chroma: 1 },
  secondary: { kind: "pull", target: 0.72, strength: 0.5, chroma: 1 },
  tertiary: { kind: "pull", target: 0.72, strength: 0.5, chroma: 1 },
  // The accent is the one color a user recognises across modes; barely move it.
  accent: { kind: "pull", target: 0.74, strength: 0.28, chroma: 1 },
  highlight: { kind: "pull", target: 0.8, strength: 0.35, chroma: 1 },
  success: { kind: "pull", target: 0.74, strength: 0.5, chroma: 1 },
  warning: { kind: "pull", target: 0.78, strength: 0.5, chroma: 1 },
  error: { kind: "pull", target: 0.68, strength: 0.5, chroma: 1 },
  info: { kind: "pull", target: 0.74, strength: 0.5, chroma: 1 },
};

/** Light mode. The same table read from the other end of the axis. */
const LIGHT_RULES: RuleTable = {
  background: { kind: "mirror", band: [0.94, 0.99], chroma: 0.5 },
  surface: { kind: "mirror", band: [0.88, 0.96], chroma: 0.55 },
  border: { kind: "mirror", band: [0.8, 0.9], chroma: 0.6 },
  text: { kind: "mirror", band: [0.2, 0.35], chroma: 0.6 },
  muted: { kind: "mirror", band: [0.5, 0.62], chroma: 0.75 },

  primary: { kind: "pull", target: 0.56, strength: 0.55, chroma: 1 },
  secondary: { kind: "pull", target: 0.56, strength: 0.5, chroma: 1 },
  tertiary: { kind: "pull", target: 0.58, strength: 0.5, chroma: 1 },
  accent: { kind: "pull", target: 0.6, strength: 0.28, chroma: 1 },
  highlight: { kind: "pull", target: 0.66, strength: 0.35, chroma: 1 },
  success: { kind: "pull", target: 0.58, strength: 0.5, chroma: 1 },
  warning: { kind: "pull", target: 0.68, strength: 0.5, chroma: 1 },
  error: { kind: "pull", target: 0.52, strength: 0.5, chroma: 1 },
  info: { kind: "pull", target: 0.58, strength: 0.5, chroma: 1 },
};

const RULES: Record<Scheme, RuleTable> = {
  light: LIGHT_RULES,
  dark: DARK_RULES,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** The remapped lightness for one role under one scheme. */
function mapLightness(l: number, rule: Rule): number {
  if (rule.kind === "mirror") {
    const [min, max] = rule.band;
    return clamp(1 - l, min, max);
  }
  return clamp(l + (rule.target - l) * rule.strength, 0, 1);
}

/**
 * The counterpart hex for one color under one scheme.
 *
 * Hue is passed through untouched. Chroma is scaled by the role's damping and
 * then fitted to sRGB at the *new* lightness, so the returned hex is the most
 * saturated in-gamut color with this exact hue — never a clipped one.
 */
export function variantHex(hex: string, role: Role, scheme: Scheme): string {
  const { l, c, h } = oklchOf(hex);
  const rule = RULES[scheme][role];

  const fitted = clampChroma(
    {
      mode: "oklch",
      l: mapLightness(l, rule),
      c: Math.max(0, c * rule.chroma),
      h,
    },
    "oklch",
    "rgb",
  );

  return (formatHex(fitted) ?? hex).toUpperCase();
}

/**
 * The whole palette in the other mode.
 *
 * Role, name and lock state are carried over verbatim: this is the *same*
 * token set at a different point on the lightness axis, not a second palette.
 * All four format strings are recomputed from the new hex, because hex is the
 * source of truth (L14) and every other format is derived from it.
 */
export function deriveVariant(palette: Color[], scheme: Scheme): Color[] {
  return palette.map((color) => ({
    ...color,
    ...completeColor(variantHex(color.hex, color.role, scheme)),
  }));
}

/** Convenience: the generated palette treated as light, plus its dark twin. */
export function variantPair(palette: Color[]): {
  light: Color[];
  dark: Color[];
} {
  return { light: palette, dark: deriveVariant(palette, "dark") };
}

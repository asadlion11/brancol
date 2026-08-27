/**
 * brancol — WCAG contrast utilities.
 *
 * A role-based palette is only usable if you know what text can sit on each
 * swatch, so every generated color is checked here before it leaves the server.
 * culori owns the math (locked decision L4).
 *
 * Client-safe: the UI reuses these to label swatches.
 */

import { wcagContrast, wcagLuminance } from "culori";

/** Near-black used as the "ink" option; pure #000 is needlessly harsh. */
export const INK = "#111111";
export const PAPER = "#FFFFFF";

/** WCAG 2.1 minimums. */
export const AA_NORMAL = 4.5;
export const AA_LARGE = 3;
export const AAA_NORMAL = 7;

/** Contrast ratio between two colors, 1–21. Returns 1 for unparseable input. */
export function contrastRatio(a: string, b: string): number {
  const ratio = wcagContrast(a, b);
  return Number.isFinite(ratio) ? ratio : 1;
}

/** Relative luminance, 0–1. */
export function luminance(color: string): number {
  const value = wcagLuminance(color);
  return Number.isFinite(value) ? value : 0;
}

/** Does this pair clear WCAG AA? `large` switches to the 3:1 threshold. */
export function meetsAA(a: string, b: string, large = false): boolean {
  return contrastRatio(a, b) >= (large ? AA_LARGE : AA_NORMAL);
}

export function meetsAAA(a: string, b: string): boolean {
  return contrastRatio(a, b) >= AAA_NORMAL;
}

export type ForegroundChoice = {
  /** Whichever of ink / paper reads better on the background. */
  hex: string;
  ratio: number;
  /** True when the winning pair still clears AA for normal-size text. */
  passesAA: boolean;
};

/**
 * Picks the better of dark ink and white paper for a given background.
 * Ties go to ink, which is the safer default on mid-tone brand colors.
 */
export function bestForeground(background: string): ForegroundChoice {
  const inkRatio = contrastRatio(background, INK);
  const paperRatio = contrastRatio(background, PAPER);

  const useInk = inkRatio >= paperRatio;
  const ratio = useInk ? inkRatio : paperRatio;

  return {
    hex: useInk ? INK : PAPER,
    ratio: Math.round(ratio * 100) / 100,
    passesAA: ratio >= AA_NORMAL,
  };
}

/** Rounded ratio for display, e.g. `4.53`. */
export function formatRatio(ratio: number): string {
  return `${(Math.round(ratio * 100) / 100).toFixed(2)}:1`;
}

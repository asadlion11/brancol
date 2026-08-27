"use client";

import { contrastRatio, meetsAA } from "@/lib/contrast";
import type { Color, Role } from "@/lib/types";

/**
 * The contrast audit the palette runs on itself.
 *
 * A role-assigned system makes a promise the model cannot keep on its own:
 * that `text` can actually be read on `background`. So the pairs the roles
 * imply are checked here, on the client, against `meetsAA` — the same function
 * the server uses, so the two can never disagree about what passes.
 *
 * Everything this module produces is a *warning*. Nothing it finds blocks
 * generating, copying, locking or exporting. A palette that fails AA is still
 * a palette the user asked for; they are told, not overruled.
 */

/** Roles that carry type, in the order a designer would read them. */
const INK_ROLES: readonly Role[] = ["text", "muted"];

/** Roles that sit behind type. */
const GROUND_ROLES: readonly Role[] = ["background", "surface"];

export type ContrastIssue = {
  foreground: Color;
  background: Color;
  ratio: number;
};

/**
 * Every role pair in this palette that fails WCAG AA for normal-size text.
 *
 * Only pairs both of whose roles are present are reported — a palette without
 * a `background` has made no promise about what sits on it.
 */
export function contrastIssues(palette: Color[]): ContrastIssue[] {
  const issues: ContrastIssue[] = [];

  for (const inkRole of INK_ROLES) {
    const foreground = palette.find((color) => color.role === inkRole);
    if (!foreground) continue;

    for (const groundRole of GROUND_ROLES) {
      const background = palette.find((color) => color.role === groundRole);
      if (!background) continue;
      if (meetsAA(foreground.hex, background.hex)) continue;

      issues.push({
        foreground,
        background,
        ratio: contrastRatio(foreground.hex, background.hex),
      });
    }
  }

  return issues;
}

/**
 * True when neither ink nor paper can be read on this swatch at normal size —
 * i.e. the band's own caption is below AA whatever we do with it.
 */
export function bandFailsAA(hex: string, foregroundHex: string): boolean {
  return !meetsAA(hex, foregroundHex);
}

/**
 * brancol — CSS custom property export.
 *
 * The output is the payoff of the whole product: it has to paste into a
 * stylesheet and work, with zero edits. That means real CSS — a `:root` block
 * of role-named custom properties, and a dark-mode block whose values are
 * *derived* (`lib/variants.ts`), never inverted.
 *
 * Properties are named for the role, not the color: `--color-primary`, so the
 * stylesheet that consumes them keeps working after the next regeneration
 * swaps the hex underneath. The human name rides along as a comment, because
 * that is the part a person needs when reading the file six months later.
 *
 * Client-safe: no `server-only`, no Node built-ins.
 */

import { deriveVariant } from "../variants";
import type { Color } from "../types";

export type CssDarkMode =
  /** `@media (prefers-color-scheme: dark)` — follows the OS. The default. */
  | "media"
  /** `.dark { … }` — for a class-toggled theme (next-themes, Tailwind). */
  | "class"
  /** Light values only. */
  | "none";

export type CssExportOptions = {
  /** Property prefix, without dashes. `--<prefix>-<role>`. */
  prefix?: string;
  darkMode?: CssDarkMode;
  indent?: string;
};

const DEFAULTS = {
  prefix: "color",
  darkMode: "media" as CssDarkMode,
  indent: "  ",
};

/** Keeps a color name from closing the CSS comment it sits inside. */
function comment(text: string): string {
  return text.replace(/\*\//g, "* /");
}

/**
 * Role → custom property name, guaranteed unique within the block.
 *
 * Roles are unique by construction upstream, but a duplicate would silently
 * overwrite a declaration rather than fail, and a silently wrong export is
 * worse than an ugly one.
 */
function propertyNames(palette: Color[], prefix: string): string[] {
  const used = new Set<string>();

  return palette.map((color) => {
    const base = `--${prefix}-${color.role}`;
    let name = base;
    for (let n = 2; used.has(name); n += 1) name = `${base}-${n}`;
    used.add(name);
    return name;
  });
}

function declarations(
  palette: Color[],
  names: string[],
  indent: string,
): string {
  return palette
    .map(
      (color, index) =>
        `${indent}${names[index]}: ${color.hex}; /* ${comment(color.name)} */`,
    )
    .join("\n");
}

/**
 * The full stylesheet: light values under `:root`, dark values under whichever
 * selector the caller's setup uses.
 */
export function exportCss(
  palette: Color[],
  options: CssExportOptions = {},
): string {
  const { prefix, darkMode, indent } = { ...DEFAULTS, ...options };
  const names = propertyNames(palette, prefix);

  const blocks = [
    "/* brancol — color system */",
    `:root {\n${declarations(palette, names, indent)}\n}`,
  ];

  if (darkMode !== "none") {
    const dark = deriveVariant(palette, "dark");

    if (darkMode === "media") {
      const body = declarations(dark, names, `${indent}${indent}`);
      blocks.push(
        "/* Dark mode — same hues, remapped lightness. */\n" +
          `@media (prefers-color-scheme: dark) {\n${indent}:root {\n${body}\n${indent}}\n}`,
      );
    } else {
      blocks.push(
        "/* Dark mode — same hues, remapped lightness. */\n" +
          `.dark {\n${declarations(dark, names, indent)}\n}`,
      );
    }
  }

  return `${blocks.join("\n\n")}\n`;
}

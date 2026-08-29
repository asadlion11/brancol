/**
 * brancol — Tailwind export.
 *
 * Two snippets, both emitted, both labelled — because "Tailwind" is currently
 * two different products. v4 is CSS-first: a `@theme` block in the stylesheet,
 * no `tailwind.config.ts` at all (this app is built that way). v3 still wants
 * a JS config with `theme.extend.colors`, and most people pasting an export
 * today are still on it. Guessing wrong costs the user the one thing this
 * export promises — that it works without edits — so neither is guessed.
 *
 * The v4 block uses `@theme`, deliberately not `@theme inline`: plain `@theme`
 * emits the custom properties onto `:root` as well as registering the
 * utilities, so `var(--color-primary)` resolves in hand-written CSS and in JS.
 * `@theme inline` would generate the utilities and emit nothing to read back.
 *
 * Client-safe: no `server-only`, no Node built-ins.
 */

import type { Color } from "../types";

/** Split markers, so the two halves can be pulled apart programmatically. */
export const TAILWIND_V4_MARKER = "/* === Tailwind v4 — CSS-first === */";
export const TAILWIND_V3_MARKER =
  "/* === Tailwind v3 — tailwind.config.js === */";

/** Role → utility name, de-duplicated the same way the CSS export does it. */
function scaleKeys(palette: Color[]): string[] {
  const used = new Set<string>();

  return palette.map((color) => {
    let key = color.role as string;
    for (let n = 2; used.has(key); n += 1) key = `${color.role}-${n}`;
    used.add(key);
    return key;
  });
}

/** The plain `{ role: hex }` map behind both snippets. */
export function tailwindColors(palette: Color[]): Record<string, string> {
  const keys = scaleKeys(palette);
  const colors: Record<string, string> = {};
  palette.forEach((color, index) => {
    colors[keys[index]] = color.hex;
  });
  return colors;
}

/** Keeps a color name from closing the CSS comment it sits inside. */
function comment(text: string): string {
  return text.replace(/\*\//g, "* /");
}

/** The v4 half on its own: a valid, self-contained CSS at-rule. */
export function tailwindV4Theme(palette: Color[]): string {
  const keys = scaleKeys(palette);
  const body = palette
    .map(
      (color, index) =>
        `  --color-${keys[index]}: ${color.hex}; /* ${comment(color.name)} */`,
    )
    .join("\n");

  return `@theme {\n${body}\n}`;
}

/** The v3 half on its own: a valid, self-contained CommonJS module. */
export function tailwindV3Config(palette: Color[]): string {
  const colors = tailwindColors(palette);
  // Quoted keys and no trailing comma: the `colors` object is then literally
  // JSON as well as JavaScript, so a script can lift it straight out of the
  // config without a JS parser.
  const body = Object.entries(colors)
    .map(
      ([key, hex]) => `        ${JSON.stringify(key)}: ${JSON.stringify(hex)}`,
    )
    .join(",\n");

  return [
    "/** @type {import('tailwindcss').Config} */",
    "module.exports = {",
    '  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],',
    "  theme: {",
    "    extend: {",
    "      colors: {",
    body,
    "      },",
    "    },",
    "  },",
    "};",
  ].join("\n");
}

export function exportTailwind(palette: Color[]): string {
  return [
    TAILWIND_V4_MARKER,
    '/* Paste into the stylesheet that holds `@import "tailwindcss";`. */',
    tailwindV4Theme(palette),
    "",
    TAILWIND_V3_MARKER,
    "/* Paste as tailwind.config.js. */",
    tailwindV3Config(palette),
    "",
  ].join("\n");
}

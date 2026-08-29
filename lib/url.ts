/**
 * brancol — palette ↔ URL encoding.
 *
 * A share link carries the whole palette and nothing else: no id, no lookup,
 * no server (locked decision L8). Amina sends a link, Yusuf opens it, and the
 * bytes in the address bar *are* the palette — roles, names and locks
 * included, not just a row of hexes.
 *
 * ## The format
 *
 * `?p=` + a version digit + one fixed-shape token per color, concatenated with
 * no separator at all:
 *
 * ```
 *   1  7fa88e  0  b  Meadow Sage
 *   ^  ^       ^  ^  ^
 *   |  |       |  |  name, exactly `len` characters
 *   |  |       |  name length, 2 base-36 digits (shown here as one for space)
 *   |  |       role index into ROLES, base-36 — plus 14 when the color is locked
 *   |  hex, 6 lowercase digits, no `#`
 *   version
 * ```
 *
 * Three decisions make it short:
 *
 * 1. **Everything derivable is dropped.** RGB, HSL and OKLCH are never in the
 *    link; hex is the source of truth (L14) and the other three are recomputed
 *    on arrival by the same `completeColor` that produced them originally —
 *    which is exactly why a round trip is byte-identical rather than merely
 *    close.
 * 2. **Roles are indices.** `"background"` is ten characters; `5` is one. The
 *    lock flag is folded into the same digit instead of costing another.
 * 3. **Predictable names are omitted.** A name the app would have derived from
 *    the hex anyway (`describeColor`) is stored as length zero and regenerated
 *    on decode. Model-written names — the ones that carry meaning — are the
 *    only text the link actually spends bytes on.
 *
 * The length prefix is what removes the need for separators or escaping: no
 * character is special, so a name may contain anything, and the only encoding
 * left is the URL's own.
 *
 * ## Trust
 *
 * A link is user input in the most literal sense — it arrives from a stranger,
 * and it may have been typed. Nothing here throws: every malformed, truncated,
 * over-long or hand-edited payload returns `null`, and the app falls back to
 * localStorage or to the empty state. The decoded result is validated with Zod
 * before it is handed back (L5).
 */

import { completeColor, describeColor, normalizeHex } from "./color";
import { colorSchema, MAX_COLOR_COUNT, MIN_COLOR_COUNT } from "./schemas";
import { ROLES, type Color } from "./types";

/** Query parameter holding the palette. */
export const PALETTE_PARAM = "p";

/** Bumped only on a breaking change to the token shape. */
const FORMAT_VERSION = "1";

/** hex(6) + role/lock(1) + name length(2). */
const HEADER_LENGTH = 9;
const NAME_LENGTH_DIGITS = 2;
const MAX_NAME_LENGTH = 60;

const HEX_DIGITS = /^[0-9a-f]{6}$/i;
/**
 * Control characters have no business in a display name. Done by code point
 * rather than by regex so no control character has to be typed into source.
 */
function stripControlChars(text: string): string {
  return Array.from(text)
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0;
      return code >= 0x20 && code !== 0x7f;
    })
    .join("");
}

function encodeColor(color: Color): string {
  const hex = color.hex.replace("#", "").toLowerCase();
  const roleIndex = ROLES.indexOf(color.role);
  const slot =
    (roleIndex < 0 ? 0 : roleIndex) + (color.locked ? ROLES.length : 0);

  // A name the decoder can regenerate costs nothing to send.
  const name = color.name === describeColor(color.hex) ? "" : color.name;
  const length = name.length.toString(36).padStart(NAME_LENGTH_DIGITS, "0");

  return `${hex}${slot.toString(36)}${length}${name}`;
}

/** The `p` value for a palette, before URL escaping. */
export function encodePalette(palette: Color[]): string {
  return FORMAT_VERSION + palette.map(encodeColor).join("");
}

/**
 * The palette a `p` value describes, or `null` if it does not describe one.
 *
 * Deliberately total: there is no input for which this throws.
 */
export function decodePalette(
  value: string | null | undefined,
): Color[] | null {
  if (typeof value !== "string") return null;

  const payload = value.trim();
  if (!payload.startsWith(FORMAT_VERSION)) return null;

  const colors: Color[] = [];
  let cursor = FORMAT_VERSION.length;

  while (cursor < payload.length) {
    if (colors.length >= MAX_COLOR_COUNT) return null;
    if (payload.length - cursor < HEADER_LENGTH) return null;

    const rawHex = payload.slice(cursor, cursor + 6);
    if (!HEX_DIGITS.test(rawHex)) return null;

    const hex = normalizeHex(`#${rawHex}`);
    if (!hex) return null;

    const slot = Number.parseInt(payload[cursor + 6], 36);
    if (!Number.isInteger(slot) || slot < 0 || slot >= ROLES.length * 2) {
      return null;
    }

    const nameLength = Number.parseInt(
      payload.slice(cursor + 7, cursor + HEADER_LENGTH),
      36,
    );
    if (!Number.isInteger(nameLength) || nameLength < 0) return null;
    if (nameLength > MAX_NAME_LENGTH) return null;

    const start = cursor + HEADER_LENGTH;
    const end = start + nameLength;
    // A truncated link must not silently yield a shorter name.
    if (end > payload.length) return null;

    const rawName = stripControlChars(payload.slice(start, end)).trim();

    colors.push({
      role: ROLES[slot % ROLES.length],
      name: rawName.length > 0 ? rawName : describeColor(hex),
      ...completeColor(hex),
      locked: slot >= ROLES.length,
    });

    cursor = end;
  }

  if (colors.length < MIN_COLOR_COUNT) return null;

  // The link is a stranger's input; it clears the same bar as an API response.
  const parsed = colorSchema.array().safeParse(colors);
  return parsed.success ? parsed.data : null;
}

/**
 * Reads a palette out of a query string (`location.search`, or the search part
 * of a whole URL). Returns `null` when there is no palette in it.
 */
export function decodePaletteFromSearch(
  search: string | null | undefined,
): Color[] | null {
  if (typeof search !== "string" || search.length === 0) return null;

  try {
    return decodePalette(new URLSearchParams(search).get(PALETTE_PARAM));
  } catch {
    return null;
  }
}

/**
 * An absolute share link. `base` defaults to the current document, so the link
 * inherits whatever origin the app is actually served from.
 *
 * Existing query parameters are preserved and the hash is dropped: a share
 * link points at a palette, not at a scroll position.
 */
export function paletteShareUrl(palette: Color[], base?: string): string {
  const href =
    base ??
    (typeof window === "undefined"
      ? "https://brancol.app/"
      : window.location.href);

  const url = new URL(href);
  url.hash = "";
  url.searchParams.set(PALETTE_PARAM, encodePalette(palette));
  return url.toString();
}

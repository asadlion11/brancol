/**
 * brancol — localStorage persistence.
 *
 * There is no database (locked decision L8), so this is the whole of "come
 * back tomorrow and your palette is still there". It holds the last palette,
 * its lock state, and the brief that produced it.
 *
 * Two rules govern everything here.
 *
 * **Never read during render.** Every function in this file must be called
 * from inside an effect, after mount. Reading `localStorage` while rendering
 * would make the server HTML and the first client render disagree, and React
 * would throw the hydration away — the classic "flash of empty state into
 * filled state". The guards below make an accidental SSR call a no-op rather
 * than a crash, but the guard is a seatbelt, not the seat.
 *
 * **Never trust what comes back.** The payload is a string a user can edit, a
 * previous version of this app can have written, or an extension can have
 * mangled. It is parsed with the same Zod schema the API response is validated
 * against (L5), and anything that fails is discarded silently and the key is
 * cleared — a corrupt palette is not an error the user did anything about.
 */

import { z } from "zod";

import {
  colorSchema,
  MAX_COLOR_COUNT,
  MAX_DESCRIPTION_LENGTH,
  MIN_COLOR_COUNT,
} from "./schemas";
import type { Color } from "./types";

/**
 * Versioned in the key itself, not only in the payload. A future v2 shape gets
 * a new key and simply never sees the v1 data, which is the cheapest possible
 * migration: none.
 */
export const STORAGE_KEY = "brancol.palette.v1";

const SNAPSHOT_VERSION = 1;

const snapshotSchema = z.object({
  version: z.literal(SNAPSHOT_VERSION),
  palette: z.array(colorSchema).min(MIN_COLOR_COUNT).max(MAX_COLOR_COUNT),
  description: z.string().max(MAX_DESCRIPTION_LENGTH).default(""),
});

export type PaletteSnapshot = z.infer<typeof snapshotSchema>;

/**
 * The store, or `null` when there isn't one.
 *
 * Merely touching `window.localStorage` throws in Safari's private mode and
 * under a blocked-cookies policy, so even the lookup is guarded.
 */
function store(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * The last saved palette, or `null` if there is none, it is unreadable, or it
 * was written by an older shape of this app.
 *
 * Call from an effect. Never from a render.
 */
export function readSnapshot(): PaletteSnapshot | null {
  const storage = store();
  if (!storage) return null;

  let raw: string | null = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed = snapshotSchema.safeParse(JSON.parse(raw));
    if (parsed.success) return parsed.data;
  } catch {
    // Not JSON at all. Falls through to the discard below.
  }

  // Unparseable or legacy: drop it rather than leaving a payload that will
  // fail again on every future visit.
  clearSnapshot();
  return null;
}

/**
 * Saves the palette. Silently does nothing when storage is unavailable or
 * full — persistence is a convenience, and losing it must never interrupt
 * what the user is actually doing.
 */
export function writeSnapshot(palette: Color[], description = ""): void {
  const storage = store();
  if (!storage) return;
  if (palette.length < MIN_COLOR_COUNT) return;

  const snapshot: PaletteSnapshot = {
    version: SNAPSHOT_VERSION,
    palette,
    description: description.slice(0, MAX_DESCRIPTION_LENGTH),
  };

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // QuotaExceededError, or a storage policy that allows reads and not
    // writes. Nothing to tell the user; the palette is still on screen.
  }
}

export function clearSnapshot(): void {
  const storage = store();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do.
  }
}

"use client";

import * as React from "react";

import { readSnapshot, writeSnapshot } from "@/lib/storage";
import type { Color } from "@/lib/types";
import { PALETTE_PARAM, decodePaletteFromSearch } from "@/lib/url";
import type {
  PaletteActions,
  PaletteState,
} from "@/components/palette/use-palette";

/**
 * Where a palette comes from when the page has only just loaded.
 *
 * Two sources, one precedence rule, and both of them are strangers' data.
 *
 * **The URL wins.** If there is a palette in `?p=`, somebody followed a link
 * that was sent to them and they must see *that* palette — not whatever they
 * happened to generate here last Tuesday. The stored snapshot is not consulted
 * at all in that case; it is simply overwritten by the persist effect a tick
 * later, which is the correct outcome: the palette on screen is the palette
 * you come back to.
 *
 * **Nothing is read during render.** Both `location.search` and
 * `localStorage` are browser-only facts. Reading either while rendering would
 * make the server HTML and the first client render disagree and React would
 * throw the hydration out — the visible symptom being a flash of the empty
 * state on top of a palette that was already there. So the whole restore
 * happens in one mount effect, after hydration, and the server renders the
 * empty state honestly because at that moment the empty state is the truth.
 *
 * **Nothing here throws.** `decodePaletteFromSearch` and `readSnapshot` are
 * both total by construction — a hand-edited link, a truncated payload, a
 * key an extension mangled, a browser that refuses storage outright all come
 * back as `null`. The try/catch below covers only the environment itself
 * (a sandboxed frame that denies `window.location`), not the parsing.
 */

/** Reads the shared palette out of the address bar, if there is one. */
function paletteFromUrl(): Color[] | null {
  try {
    return decodePaletteFromSearch(window.location.search);
  } catch {
    return null;
  }
}

/**
 * Drops the `p` parameter once it has been consumed.
 *
 * The link has done its job — the palette is on screen and, a tick later, in
 * localStorage — and leaving the parameter behind would mean the address bar
 * kept describing the *arrival* palette after the first regeneration. The
 * share button re-encodes from live state, so nothing is lost by removing it.
 */
function stripPaletteParam(): void {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(PALETTE_PARAM)) return;

    url.searchParams.delete(PALETTE_PARAM);
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  } catch {
    // Sandboxed, or history writes denied. Harmless: the parameter is stale
    // decoration at this point, not state.
  }
}

/** Keystrokes are cheap; localStorage writes are not free. */
const WRITE_DEBOUNCE_MS = 400;

/**
 * Restores on mount and persists on change.
 *
 * Returns nothing: every effect it owns speaks to the reducer, which is still
 * the only owner of palette state.
 */
export function usePalettePersistence(
  state: PaletteState,
  actions: PaletteActions,
): void {
  const restored = React.useRef(false);

  React.useEffect(() => {
    // React runs mount effects twice in development Strict Mode. Restoring
    // twice would mint a second set of band keys and re-announce, so the
    // first pass claims the job.
    if (restored.current) return;
    restored.current = true;

    const shared = paletteFromUrl();
    if (shared) {
      actions.restorePalette(shared, "", "url");
      stripPaletteParam();
      return;
    }

    const snapshot = readSnapshot();
    if (snapshot) {
      actions.restorePalette(snapshot.palette, snapshot.description, "storage");
      return;
    }

    // Nothing to restore, but the persist effect still needs to know that the
    // question has been asked and answered.
    actions.markHydrated();
  }, [actions]);

  const { palette, hydrated } = state;
  const { description } = state.input;

  React.useEffect(() => {
    // Never write before the restore has run: an empty first render must not
    // be allowed to erase what is in the store.
    if (!hydrated) return;
    if (!palette || palette.length === 0) return;

    const timer = window.setTimeout(
      () => writeSnapshot(palette, description),
      WRITE_DEBOUNCE_MS,
    );

    return () => window.clearTimeout(timer);
  }, [hydrated, palette, description]);
}

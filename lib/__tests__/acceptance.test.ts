/**
 * Phase 5/6 acceptance.
 *
 * `url.test.ts` and `storage.test.ts` already prove the two codecs in
 * isolation. This suite proves the two *product* claims the UI now makes, in
 * the exact shape the acceptance criteria state them:
 *
 *   - a share link carries a palette from one browser to another with roles,
 *     names, hexes and locks intact — not "close enough", byte-identical;
 *   - coming back to the app restores the last palette, and a junk payload in
 *     the store is discarded silently rather than crashing the page.
 *
 * Everything the UI does on top of these is an effect calling one of these
 * functions, so if this passes, the wiring has nothing left to get wrong
 * except *when* it is called — which is a hydration question, answered by
 * `use-persistence.ts` doing all of it inside a mount effect.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearSnapshot,
  readSnapshot,
  STORAGE_KEY,
  writeSnapshot,
} from "../storage";
import type { Color } from "../types";
import {
  decodePalette,
  decodePaletteFromSearch,
  encodePalette,
  paletteShareUrl,
  PALETTE_PARAM,
} from "../url";
import { swatch } from "./fixtures";

/**
 * Five colors, two of them locked — the palette named in the acceptance
 * criteria. Names deliberately mix the two cases the codec treats
 * differently: model-written names it must carry as text, and one it could
 * regenerate from the hex if it wanted to.
 */
const FIVE_WITH_TWO_LOCKED: Color[] = [
  swatch("primary", "#7FA88E", "Meadow Sage", true),
  swatch("secondary", "#A8C5C9", "Morning Mist"),
  swatch("accent", "#D9A59A", "Sunset Clay", true),
  swatch("background", "#F6F2EB", "Warm Linen"),
  swatch("text", "#3A4A42", "Deep Forest"),
];

/** The four facts a share link is required to preserve. */
function identity(palette: Color[]) {
  return palette.map(({ hex, role, name, locked }) => ({
    hex,
    role,
    name,
    locked,
  }));
}

function memoryStorage(): Storage {
  const map = new Map<string, string>();

  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    clear: () => map.clear(),
    key: (index: number) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
  } as Storage;
}

function installStorage(storage: Storage): void {
  vi.stubGlobal("window", { localStorage: storage });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("share link round trip", () => {
  it("carries five colors with two locked, exactly", () => {
    const encoded = encodePalette(FIVE_WITH_TWO_LOCKED);
    const decoded = decodePalette(encoded);

    expect(decoded).not.toBeNull();
    expect(decoded).toHaveLength(5);
    expect(identity(decoded!)).toEqual(identity(FIVE_WITH_TWO_LOCKED));

    // Nothing was lost or gained anywhere else either: the derived formats
    // are recomputed on arrival and land on the same strings.
    expect(decoded).toEqual(FIVE_WITH_TWO_LOCKED);
  });

  it("keeps exactly the two locks, on the right two colors", () => {
    const decoded = decodePalette(encodePalette(FIVE_WITH_TWO_LOCKED))!;

    expect(decoded.filter((color) => color.locked)).toHaveLength(2);
    expect(
      decoded.filter((color) => color.locked).map((color) => color.name),
    ).toEqual(["Meadow Sage", "Sunset Clay"]);
  });

  it("survives the whole trip through a real URL", () => {
    // The path a share actually takes: build a link, hand it to a new
    // browser, read it back out of `location.search`.
    const link = paletteShareUrl(FIVE_WITH_TWO_LOCKED, "https://brancol.app/");
    const search = new URL(link).search;

    expect(search).toContain(`${PALETTE_PARAM}=`);
    expect(decodePaletteFromSearch(search)).toEqual(FIVE_WITH_TWO_LOCKED);
  });

  it("returns null rather than throwing for a hand-edited link", () => {
    const good = encodePalette(FIVE_WITH_TWO_LOCKED);

    const mangled = [
      good.slice(0, good.length - 4), // truncated mid-name
      good.replace("7fa88e", "zzzzzz"), // not a hex
      `9${good.slice(1)}`, // unknown format version
      "1", // version and nothing else
      "?p=&p=", // not a payload at all
      "",
    ];

    for (const payload of mangled) {
      expect(() => decodePalette(payload)).not.toThrow();
      expect(decodePalette(payload)).toBeNull();
    }

    // And the same via the query-string entry point the app actually uses.
    expect(() => decodePaletteFromSearch("?p=%E0%A4%A")).not.toThrow();
    expect(decodePaletteFromSearch("?p=%E0%A4%A")).toBeNull();
    expect(decodePaletteFromSearch("?nothing=here")).toBeNull();
  });
});

describe("localStorage round trip", () => {
  it("restores the palette, its locks and the brief", () => {
    installStorage(memoryStorage());

    writeSnapshot(FIVE_WITH_TWO_LOCKED, "Calm wellness app");
    const restored = readSnapshot();

    expect(restored).not.toBeNull();
    expect(restored!.description).toBe("Calm wellness app");
    expect(restored!.palette).toEqual(FIVE_WITH_TWO_LOCKED);
    expect(identity(restored!.palette)).toEqual(identity(FIVE_WITH_TWO_LOCKED));
  });

  it("discards junk silently and leaves nothing behind to fail again", () => {
    const storage = memoryStorage();
    installStorage(storage);

    const junk = [
      "not json at all",
      "{",
      "null",
      "[]",
      '{"version":1}',
      '{"version":99,"palette":[],"description":""}',
      // Right shape, wrong contents — a palette of one, and a hex that isn't.
      '{"version":1,"palette":[{"role":"primary","name":"x","hex":"nope","rgb":"","hsl":"","oklch":"","locked":false}],"description":""}',
    ];

    for (const payload of junk) {
      storage.setItem(STORAGE_KEY, payload);
      expect(() => readSnapshot()).not.toThrow();
      expect(readSnapshot()).toBeNull();
      // Cleared, so the next visit does not re-parse the same bad payload.
      expect(storage.getItem(STORAGE_KEY)).toBeNull();
    }
  });

  it("a URL palette and a stored palette can both exist; the URL is the one that wins", () => {
    // The precedence rule, stated as data rather than as a React effect: both
    // sources answer, and `use-persistence.ts` takes the first of them.
    installStorage(memoryStorage());

    const stored = FIVE_WITH_TWO_LOCKED;
    const shared: Color[] = [
      swatch("primary", "#1769AA", "Ocean Blue"),
      swatch("background", "#FFFFFF", "Paper"),
      swatch("text", "#111111", "Ink"),
    ];

    writeSnapshot(stored, "the old brief");
    const search = new URL(paletteShareUrl(shared, "https://brancol.app/"))
      .search;

    const fromUrl = decodePaletteFromSearch(search);
    const fromStore = readSnapshot();

    expect(fromStore).not.toBeNull();
    expect(fromUrl).toEqual(shared);
    expect(fromUrl).not.toEqual(fromStore!.palette);
  });

  it("clearing leaves a clean slate", () => {
    installStorage(memoryStorage());

    writeSnapshot(FIVE_WITH_TWO_LOCKED, "brief");
    clearSnapshot();

    expect(readSnapshot()).toBeNull();
  });
});

/**
 * localStorage tests.
 *
 * Two things have to hold. What went in comes back out identically — locks
 * included, because a lock the user set and lost is worse than no persistence
 * at all. And nothing here ever throws: a corrupted payload, a full disk or a
 * browser that refuses storage outright must all degrade to "no saved
 * palette", never to a blank page.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearSnapshot,
  readSnapshot,
  writeSnapshot,
  STORAGE_KEY,
} from "../storage";
import { SAMPLE_PALETTE, TEN_COLOR_PALETTE, swatch } from "./fixtures";

/** The smallest thing that satisfies the parts of `Storage` we touch. */
function memoryStorage(overrides: Partial<Storage> = {}): Storage {
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
    ...overrides,
  } as Storage;
}

function install(storage: Storage | (() => never)) {
  vi.stubGlobal("window", {
    get localStorage() {
      return typeof storage === "function" ? storage() : storage;
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("snapshot round trip", () => {
  it("restores the palette exactly, locks and all", () => {
    install(memoryStorage());

    writeSnapshot(TEN_COLOR_PALETTE, "Calm wellness app");
    const restored = readSnapshot();

    expect(restored).not.toBeNull();
    expect(restored!.palette).toEqual(TEN_COLOR_PALETTE);
    expect(restored!.description).toBe("Calm wellness app");
    expect(restored!.palette.filter((color) => color.locked)).toHaveLength(1);
  });

  it("writes under the versioned key", () => {
    const storage = memoryStorage();
    install(storage);

    writeSnapshot(SAMPLE_PALETTE);
    expect(STORAGE_KEY).toBe("brancol.palette.v1");
    expect(storage.getItem(STORAGE_KEY)).toBeTypeOf("string");
  });

  it("overwrites rather than accumulating", () => {
    const storage = memoryStorage();
    install(storage);

    writeSnapshot(TEN_COLOR_PALETTE);
    writeSnapshot(SAMPLE_PALETTE);

    expect(readSnapshot()!.palette).toEqual(SAMPLE_PALETTE);
    expect(storage.length).toBe(1);
  });

  it("clears on request", () => {
    install(memoryStorage());

    writeSnapshot(SAMPLE_PALETTE);
    clearSnapshot();
    expect(readSnapshot()).toBeNull();
  });
});

describe("untrusted payloads", () => {
  it.each([
    ["not JSON at all", "{{{"],
    ["JSON that is not an object", '"a string"'],
    ["a legacy shape with no version", JSON.stringify({ palette: [] })],
    [
      "a future version",
      JSON.stringify({ version: 99, palette: SAMPLE_PALETTE }),
    ],
    [
      "a palette with a bad hex",
      JSON.stringify({
        version: 1,
        palette: [{ ...SAMPLE_PALETTE[0], hex: "chartreuse" }],
      }),
    ],
    [
      "a palette above the color cap",
      JSON.stringify({
        version: 1,
        palette: Array.from({ length: 11 }, () =>
          swatch("primary", "#7FA88E", "Meadow Sage"),
        ),
      }),
    ],
    [
      "a single color, below the minimum",
      JSON.stringify({ version: 1, palette: [SAMPLE_PALETTE[0]] }),
    ],
  ])("discards %s", (_label, payload) => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, payload);
    install(storage);

    expect(readSnapshot()).toBeNull();
    // And it does not stay behind to fail again on every future visit.
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe("hostile environments", () => {
  it("is a no-op with no window at all — the SSR case", () => {
    vi.stubGlobal("window", undefined);

    expect(readSnapshot()).toBeNull();
    expect(() => writeSnapshot(SAMPLE_PALETTE)).not.toThrow();
    expect(() => clearSnapshot()).not.toThrow();
  });

  it("survives a browser that throws on the localStorage lookup itself", () => {
    install(() => {
      throw new Error("The operation is insecure.");
    });

    expect(readSnapshot()).toBeNull();
    expect(() => writeSnapshot(SAMPLE_PALETTE)).not.toThrow();
  });

  it("survives a full quota", () => {
    install(
      memoryStorage({
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
      }),
    );

    expect(() => writeSnapshot(SAMPLE_PALETTE)).not.toThrow();
    expect(readSnapshot()).toBeNull();
  });

  it("refuses to persist a palette too small to be one", () => {
    const storage = memoryStorage();
    install(storage);

    writeSnapshot([SAMPLE_PALETTE[0]]);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });
});

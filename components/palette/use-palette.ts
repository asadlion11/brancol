"use client";

import * as React from "react";

import { requestPalette, type PaletteError } from "@/lib/api";
import {
  completeColor,
  describeColor,
  hexFromOklch,
  normalizeHex,
  oklchOf,
  uniqueName,
} from "@/lib/color";
import {
  MAX_COLOR_COUNT,
  MAX_STARTING_COLORS,
  MIN_COLOR_COUNT,
} from "@/lib/schemas";
import { copyHex, copyText } from "@/lib/toast";
import { ROLES, type Color, type PaletteMeta, type Role } from "@/lib/types";

/**
 * The single owner of every piece of palette state.
 *
 * One `useReducer`, one shape, one set of transitions. Deliberately not a pile
 * of `useState` calls: `status`, `palette`, `error` and `input` are not
 * independent — "pending with a stale error still on screen" and "success with
 * an empty palette" are states this machine simply cannot express.
 *
 * Phase 4 adds direct manipulation — copy, lock, hand-edit, add, remove — and
 * every one of those is a case in this reducer. There is no second mutation
 * path: a band component dispatches, it never owns a color.
 */

/** A seed the user typed. `id` is stable so the row keeps focus while editing. */
export type SeedColor = {
  id: string;
  /** Exactly what the user typed — never normalized in place under the caret. */
  value: string;
};

export type PaletteInput = {
  description: string;
  count: number;
  seeds: SeedColor[];
};

export type PaletteStatus = "idle" | "pending" | "success" | "error";

/** The four value formats a band can hand to the clipboard. */
export type ColorFormat = "hex" | "rgb" | "hsl" | "oklch";

export const COLOR_FORMATS: readonly ColorFormat[] = [
  "hex",
  "rgb",
  "hsl",
  "oklch",
];

export const FORMAT_LABELS: Record<ColorFormat, string> = {
  hex: "HEX",
  rgb: "RGB",
  hsl: "HSL",
  oklch: "OKLCH",
};

/** An in-progress hand edit of one band's hex. */
export type PaletteEdit = {
  /** Band key, not index — an index would drift the moment a band is removed. */
  key: string;
  /** Exactly what the user has typed so far. */
  value: string;
};

export type PaletteState = {
  status: PaletteStatus;
  palette: Color[] | null;
  meta: PaletteMeta | null;
  error: PaletteError | null;
  input: PaletteInput;
  /**
   * The count the visible palette was generated with. The skeleton uses the
   * *requested* count while pending, so the stage never reflows when the real
   * bands land.
   */
  renderedCount: number;
  /**
   * Stable per-band identity, parallel to `palette`.
   *
   * This is what makes a locked band survive regeneration without so much as a
   * repaint: its key is carried over, so React updates the existing DOM node
   * instead of unmounting it and mounting a replacement. Keying on the hex
   * would do the same for locks but would remount a band the moment its hex
   * was hand-edited, throwing focus out of the field the user is typing in.
   */
  bandKeys: string[];
  /** The band whose hex is being edited by hand, if any. */
  edit: PaletteEdit | null;
  /** The last value actually copied, so its band's menu can mark it. */
  lastCopy: { key: string; format: ColorFormat } | null;
  /**
   * A band that should take focus once the DOM has caught up. Set when the
   * element that had focus is about to disappear (a removed band, a closed
   * hex editor) so focus lands somewhere deliberate rather than on `<body>`.
   */
  focusKey: string | null;
};

export const DEFAULT_COUNT = 5;

type Action =
  | { type: "description/set"; value: string }
  | { type: "count/set"; value: number }
  | { type: "seed/add"; id: string; value?: string }
  | { type: "seed/update"; id: string; value: string }
  | { type: "seed/remove"; id: string }
  | { type: "generate/start" }
  | { type: "generate/resolve"; palette: Color[]; meta: PaletteMeta }
  | { type: "generate/reject"; error: PaletteError }
  | { type: "error/dismiss" }
  | { type: "color/copy"; key: string; format: ColorFormat }
  | { type: "color/lock"; key: string }
  | { type: "color/add"; key: string }
  | { type: "color/remove"; key: string }
  | { type: "edit/open"; key: string }
  | { type: "edit/change"; value: string }
  | { type: "edit/cancel" }
  | { type: "edit/commit"; key: string; value: string }
  | { type: "focus/clear" };

export function initialPaletteState(): PaletteState {
  return {
    status: "idle",
    palette: null,
    meta: null,
    error: null,
    input: { description: "", count: DEFAULT_COUNT, seeds: [] },
    renderedCount: DEFAULT_COUNT,
    bandKeys: [],
    edit: null,
    lastCopy: null,
    focusKey: null,
  };
}

/* -------------------------------------------------------------------------- */
/* Band identity                                                              */
/* -------------------------------------------------------------------------- */

let bandCounter = 0;

function nextBandKey(): string {
  bandCounter += 1;
  return `band-${bandCounter}`;
}

/**
 * Keys for an incoming palette.
 *
 * A locked color comes back byte-identical (the server re-injects it), so it
 * keeps the key it already had. Everything else is genuinely a new color and
 * gets a new key — which is exactly the signal React needs to swap those
 * nodes and leave the locked ones alone.
 */
function carryKeys(next: Color[], previous: PaletteState): string[] {
  const byHex = new Map<string, string>();
  previous.palette?.forEach((color, index) => {
    const key = previous.bandKeys[index];
    if (color.locked && key && !byHex.has(color.hex)) byHex.set(color.hex, key);
  });

  const used = new Set<string>();

  return next.map((color) => {
    const carried = color.locked ? byHex.get(color.hex) : undefined;
    if (carried && !used.has(carried)) {
      used.add(carried);
      return carried;
    }
    return nextBandKey();
  });
}

/* -------------------------------------------------------------------------- */
/* Palette edits                                                              */
/* -------------------------------------------------------------------------- */

/** All names currently in the palette, lower-cased, optionally minus one index. */
function takenNames(palette: Color[], skip = -1): Set<string> {
  return new Set(
    palette
      .filter((_, index) => index !== skip)
      .map((color) => color.name.toLowerCase()),
  );
}

/** First role no other band is using. Roles outnumber the 10-color cap. */
function freeRole(palette: Color[]): Role {
  const used = new Set(palette.map((color) => color.role));
  return ROLES.find((role) => !used.has(role)) ?? "muted";
}

/**
 * A color to add when the user asks for one more band.
 *
 * Rotated off the last band by the golden angle, the same trick the server
 * uses to fill a short palette — so a hand-added color reads as part of the
 * system rather than as an arbitrary swatch. The hue keeps stepping until the
 * hex is one the palette does not already hold.
 */
function synthesizeColor(palette: Color[]): Color {
  const anchor = palette.at(-1);
  const base = anchor ? oklchOf(anchor.hex) : { l: 0.55, c: 0.12, h: 240 };
  const existing = new Set(palette.map((color) => color.hex));
  const chroma = Math.max(0.04, Math.min(0.16, base.c || 0.1));

  let hex = hexFromOklch(base.l, chroma, base.h);
  for (let step = 1; step <= 12; step += 1) {
    const hue = (base.h + 137.5 * step) % 360;
    const lightness = 0.25 + ((base.l * 100 + 23 * step) % 55) / 100;
    hex = hexFromOklch(lightness, chroma, hue);
    if (!existing.has(hex)) break;
  }

  const formats = completeColor(hex);

  return {
    role: freeRole(palette),
    name: uniqueName(
      describeColor(formats.hex),
      takenNames(palette),
      formats.hex,
    ),
    ...formats,
    locked: false,
  };
}

/** Appends one synthesized band. Returns the state untouched at the cap. */
function addBand(state: PaletteState, key: string): PaletteState {
  const palette = state.palette;
  if (!palette || palette.length >= MAX_COLOR_COUNT) return state;

  const next = [...palette, synthesizeColor(palette)];

  return {
    ...state,
    palette: next,
    bandKeys: [...state.bandKeys, key],
    // The stepper and the field are one number, never two.
    input: { ...state.input, count: next.length },
    renderedCount: next.length,
    focusKey: key,
  };
}

/**
 * Removes one band. Focus moves to the band that takes its place (or to the
 * new last band), so the keyboard never gets dropped on `<body>`.
 */
function removeBandAt(state: PaletteState, index: number): PaletteState {
  const palette = state.palette;
  if (!palette || index < 0 || palette.length <= MIN_COLOR_COUNT) return state;

  const removedKey = state.bandKeys[index];
  const next = palette.filter((_, i) => i !== index);
  const keys = state.bandKeys.filter((_, i) => i !== index);

  return {
    ...state,
    palette: next,
    bandKeys: keys,
    input: { ...state.input, count: next.length },
    renderedCount: next.length,
    edit: state.edit?.key === removedKey ? null : state.edit,
    lastCopy: state.lastCopy?.key === removedKey ? null : state.lastCopy,
    focusKey: keys[Math.min(index, keys.length - 1)] ?? null,
  };
}

/** The last band it is reasonable to drop: unlocked if there is one at all. */
function lastRemovableIndex(palette: Color[]): number {
  for (let index = palette.length - 1; index >= 0; index -= 1) {
    if (!palette[index].locked) return index;
  }
  return palette.length - 1;
}

/**
 * Resizes the palette to `count`.
 *
 * The stepper in the brief and the number of bands on screen are the same
 * quantity, so moving one moves the other. Growing synthesizes; shrinking
 * drops from the end, skipping locked colors while any unlocked one remains.
 */
function resizePalette(state: PaletteState, count: number): PaletteState {
  let next = state;

  while ((next.palette?.length ?? 0) < count) {
    const grown = addBand(next, nextBandKey());
    if (grown === next) break;
    next = grown;
  }

  while ((next.palette?.length ?? 0) > count) {
    const palette = next.palette;
    if (!palette) break;
    const shrunk = removeBandAt(next, lastRemovableIndex(palette));
    if (shrunk === next) break;
    next = shrunk;
  }

  // Resizing is not a focus event; only the explicit add/remove controls are.
  return { ...next, focusKey: null };
}

function paletteReducer(state: PaletteState, action: Action): PaletteState {
  switch (action.type) {
    case "description/set":
      return {
        ...state,
        // Editing the brief clears a stale validation error — the user is
        // already acting on it.
        error: state.error?.code === "INVALID_INPUT" ? null : state.error,
        status:
          state.status === "error" && state.error?.code === "INVALID_INPUT"
            ? state.palette
              ? "success"
              : "idle"
            : state.status,
        input: { ...state.input, description: action.value },
      };

    case "count/set": {
      const count = Math.min(
        MAX_COLOR_COUNT,
        Math.max(MIN_COLOR_COUNT, Math.round(action.value)),
      );
      const withCount = { ...state, input: { ...state.input, count } };

      // While pending the stage is the skeleton, and the requested count is
      // only a request. With a palette on screen, the two are the same number.
      if (state.status === "pending" || !state.palette) return withCount;
      return resizePalette(withCount, count);
    }

    case "seed/add":
      if (state.input.seeds.length >= MAX_STARTING_COLORS) return state;
      return {
        ...state,
        input: {
          ...state.input,
          seeds: [
            ...state.input.seeds,
            { id: action.id, value: action.value ?? "" },
          ],
        },
      };

    case "seed/update":
      return {
        ...state,
        input: {
          ...state.input,
          seeds: state.input.seeds.map((seed) =>
            seed.id === action.id ? { ...seed, value: action.value } : seed,
          ),
        },
      };

    case "seed/remove":
      return {
        ...state,
        input: {
          ...state.input,
          seeds: state.input.seeds.filter((seed) => seed.id !== action.id),
        },
      };

    case "generate/start":
      // The previous palette stays in `palette` but the stage shows the
      // skeleton — `renderedCount` moves to the requested count so the band
      // geometry is already correct when the response lands.
      return {
        ...state,
        status: "pending",
        error: null,
        edit: null,
        focusKey: null,
        renderedCount: state.input.count,
      };

    case "generate/resolve":
      return {
        ...state,
        status: "success",
        palette: action.palette,
        bandKeys: carryKeys(action.palette, state),
        meta: action.meta,
        error: null,
        edit: null,
        lastCopy: null,
        focusKey: null,
        renderedCount: action.palette.length,
        input: { ...state.input, count: action.palette.length },
      };

    case "generate/reject":
      // The brief is untouched: retry re-sends exactly what the user wrote.
      return { ...state, status: "error", error: action.error };

    case "error/dismiss":
      return {
        ...state,
        status: state.palette ? "success" : "idle",
        error: null,
      };

    case "color/copy":
      // Copying mutates nothing, but it is still a per-color action and so it
      // still goes through here: the band menu marks whichever value the user
      // last took, which is the only memory of a copy that survives the toast.
      return { ...state, lastCopy: { key: action.key, format: action.format } };

    case "color/lock": {
      const index = state.bandKeys.indexOf(action.key);
      if (!state.palette || index === -1) return state;

      return {
        ...state,
        palette: state.palette.map((color, i) =>
          i === index ? { ...color, locked: !color.locked } : color,
        ),
      };
    }

    case "color/add":
      return addBand(state, action.key);

    case "color/remove":
      return removeBandAt(state, state.bandKeys.indexOf(action.key));

    case "edit/open": {
      const index = state.bandKeys.indexOf(action.key);
      if (!state.palette || index === -1) return state;
      return {
        ...state,
        edit: { key: action.key, value: state.palette[index].hex },
      };
    }

    case "edit/change":
      if (!state.edit) return state;
      return { ...state, edit: { ...state.edit, value: action.value } };

    case "edit/cancel":
      return {
        ...state,
        edit: null,
        focusKey: state.edit?.key ?? state.focusKey,
      };

    case "edit/commit": {
      const index = state.bandKeys.indexOf(action.key);
      const hex = normalizeHex(action.value);
      // An unusable value keeps the editor open and the text as typed; the
      // field shows its invalid state rather than swallowing the edit.
      if (!state.palette || index === -1 || !hex) return state;

      const previous = state.palette[index];
      if (hex === previous.hex) {
        return { ...state, edit: null, focusKey: action.key };
      }

      const formats = completeColor(hex);
      const palette = state.palette.map((color, i) =>
        i === index
          ? {
              ...color,
              ...formats,
              // The old name described the old color. Keeping "Ocean Blue" on
              // a swatch the user just made red would be a lie, so the name is
              // re-derived from the value that is actually on screen.
              name: uniqueName(
                describeColor(formats.hex),
                takenNames(state.palette!, index),
                formats.hex,
              ),
            }
          : color,
      );

      return {
        ...state,
        palette,
        edit: null,
        lastCopy: state.lastCopy?.key === action.key ? null : state.lastCopy,
        focusKey: action.key,
      };
    }

    case "focus/clear":
      return { ...state, focusKey: null };

    default:
      return state;
  }
}

/** Normalized, de-duplicated seed hexes, in the order the user added them. */
export function seedHexes(seeds: SeedColor[]): string[] {
  const out: string[] = [];

  for (const seed of seeds) {
    const hex = normalizeHex(seed.value);
    if (hex && !out.includes(hex)) out.push(hex);
  }

  return out;
}

/** True when a seed row has content that is not a color yet. */
export function seedIsInvalid(seed: SeedColor): boolean {
  return seed.value.trim().length > 0 && normalizeHex(seed.value) === null;
}

/**
 * The locked swatches, in the shape `lockedColorSchema` accepts.
 *
 * Role and name travel with the hex so a pinned color keeps its job and its
 * label across a regeneration, not just its value.
 */
export function lockedColors(
  palette: Color[] | null,
): Array<{ hex: string; role: Role; name: string }> {
  return (palette ?? [])
    .filter((color) => color.locked)
    .map(({ hex, role, name }) => ({ hex, role, name }));
}

let seedCounter = 0;

function nextSeedId(): string {
  seedCounter += 1;
  return `seed-${seedCounter}`;
}

export type PaletteActions = {
  setDescription: (value: string) => void;
  setCount: (value: number) => void;
  addSeed: (value?: string) => void;
  updateSeed: (id: string, value: string) => void;
  removeSeed: (id: string) => void;
  generate: () => void;
  dismissError: () => void;
  /** Copy one format of one band, then remember which. */
  copyColor: (key: string, format: ColorFormat) => void;
  toggleLock: (key: string) => void;
  addColor: () => void;
  removeColor: (key: string) => void;
  openEdit: (key: string) => void;
  changeEdit: (value: string) => void;
  cancelEdit: () => void;
  commitEdit: (key: string, value: string) => void;
  clearFocus: () => void;
};

/**
 * Drives the machine and owns the one in-flight request.
 *
 * Double-submit is impossible twice over: the button is disabled while
 * pending, and a live `AbortController` in `pending` short-circuits any second
 * call before it reaches `fetch`.
 *
 * Actions read the current state through a ref rather than a closure, so the
 * whole action set is referentially stable for the lifetime of the page — a
 * band never re-renders because an unrelated band changed.
 */
export function usePaletteMachine(): {
  state: PaletteState;
  actions: PaletteActions;
  canSubmit: boolean;
} {
  const [state, dispatch] = React.useReducer(
    paletteReducer,
    undefined,
    initialPaletteState,
  );

  const pending = React.useRef<AbortController | null>(null);
  const latest = React.useRef(state);

  React.useEffect(() => {
    latest.current = state;
  }, [state]);

  React.useEffect(() => {
    return () => pending.current?.abort();
  }, []);

  const actions = React.useMemo<PaletteActions>(
    () => ({
      setDescription: (value) => dispatch({ type: "description/set", value }),
      setCount: (value) => dispatch({ type: "count/set", value }),
      addSeed: (value) =>
        dispatch({ type: "seed/add", id: nextSeedId(), value }),
      updateSeed: (id, value) => dispatch({ type: "seed/update", id, value }),
      removeSeed: (id) => dispatch({ type: "seed/remove", id }),
      dismissError: () => dispatch({ type: "error/dismiss" }),

      generate: () => {
        if (pending.current) return;

        const current = latest.current;
        const { description, count, seeds } = current.input;
        const controller = new AbortController();
        pending.current = controller;

        dispatch({ type: "generate/start" });

        void requestPalette(
          {
            description,
            count,
            startingColors: seedHexes(seeds),
            // The server re-injects these verbatim, so a locked band comes
            // back byte-for-byte rather than as the model's best impression.
            lockedColors: lockedColors(current.palette),
          },
          { signal: controller.signal },
        ).then((result) => {
          pending.current = null;

          if (result.ok) {
            dispatch({
              type: "generate/resolve",
              palette: result.data.palette,
              meta: result.data.meta,
            });
            return;
          }

          // An abort is something we caused (unmount, replaced request); it is
          // never news for the user.
          if (result.error.code === "ABORTED") return;
          dispatch({ type: "generate/reject", error: result.error });
        });
      },

      copyColor: (key, format) => {
        const current = latest.current;
        const index = current.bandKeys.indexOf(key);
        const color = index === -1 ? undefined : current.palette?.[index];
        if (!color) return;

        // The strings are the ones the server computed with culori. They are
        // copied as they are — recomputing here could only introduce drift.
        const copied =
          format === "hex"
            ? copyHex(color.hex)
            : copyText(color[format], color[format]);

        void copied.then((ok) => {
          if (ok) dispatch({ type: "color/copy", key, format });
        });
      },

      toggleLock: (key) => dispatch({ type: "color/lock", key }),
      addColor: () => dispatch({ type: "color/add", key: nextBandKey() }),
      removeColor: (key) => dispatch({ type: "color/remove", key }),
      openEdit: (key) => dispatch({ type: "edit/open", key }),
      changeEdit: (value) => dispatch({ type: "edit/change", value }),
      cancelEdit: () => dispatch({ type: "edit/cancel" }),
      commitEdit: (key, value) => dispatch({ type: "edit/commit", key, value }),
      clearFocus: () => dispatch({ type: "focus/clear" }),
    }),
    [],
  );

  const canSubmit =
    state.status !== "pending" &&
    state.input.description.trim().length > 0 &&
    !state.input.seeds.some(seedIsInvalid);

  return { state, actions, canSubmit };
}

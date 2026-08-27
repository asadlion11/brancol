"use client";

import * as React from "react";

import { requestPalette, type PaletteError } from "@/lib/api";
import { normalizeHex } from "@/lib/color";
import { MAX_STARTING_COLORS } from "@/lib/schemas";
import type { Color, PaletteMeta } from "@/lib/types";

/**
 * The single owner of every piece of palette state.
 *
 * One `useReducer`, one shape, one set of transitions. Deliberately not a pile
 * of `useState` calls: `status`, `palette`, `error` and `input` are not
 * independent — "pending with a stale error still on screen" and "success with
 * an empty palette" are states this machine simply cannot express.
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
  | { type: "error/dismiss" };

export function initialPaletteState(): PaletteState {
  return {
    status: "idle",
    palette: null,
    meta: null,
    error: null,
    input: { description: "", count: DEFAULT_COUNT, seeds: [] },
    renderedCount: DEFAULT_COUNT,
  };
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

    case "count/set":
      return { ...state, input: { ...state.input, count: action.value } };

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
        renderedCount: state.input.count,
      };

    case "generate/resolve":
      return {
        ...state,
        status: "success",
        palette: action.palette,
        meta: action.meta,
        error: null,
        renderedCount: action.palette.length,
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
};

/**
 * Drives the machine and owns the one in-flight request.
 *
 * Double-submit is impossible twice over: the button is disabled while
 * pending, and a live `AbortController` in `pending` short-circuits any second
 * call before it reaches `fetch`.
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
  const { input } = state;

  React.useEffect(() => {
    return () => pending.current?.abort();
  }, []);

  const generate = React.useCallback(() => {
    if (pending.current) return;

    const { description, count, seeds } = input;
    const controller = new AbortController();
    pending.current = controller;

    dispatch({ type: "generate/start" });

    void requestPalette(
      {
        description,
        count,
        startingColors: seedHexes(seeds),
        lockedColors: [],
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
  }, [input]);

  const actions = React.useMemo<PaletteActions>(
    () => ({
      setDescription: (value) => dispatch({ type: "description/set", value }),
      setCount: (value) => dispatch({ type: "count/set", value }),
      addSeed: (value) =>
        dispatch({ type: "seed/add", id: nextSeedId(), value }),
      updateSeed: (id, value) => dispatch({ type: "seed/update", id, value }),
      removeSeed: (id) => dispatch({ type: "seed/remove", id }),
      generate,
      dismissError: () => dispatch({ type: "error/dismiss" }),
    }),
    [generate],
  );

  const canSubmit =
    state.status !== "pending" &&
    state.input.description.trim().length > 0 &&
    !state.input.seeds.some(seedIsInvalid);

  return { state, actions, canSubmit };
}

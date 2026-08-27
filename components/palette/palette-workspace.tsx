"use client";

import * as React from "react";

import { PaletteComposer } from "@/components/palette/palette-composer";
import {
  PaletteErrorNotice,
  PaletteErrorState,
} from "@/components/palette/palette-error";
import { PaletteHero } from "@/components/palette/palette-hero";
import { PaletteSkeleton } from "@/components/palette/palette-skeleton";
import { EmptyState } from "@/components/palette/empty-state";
import { usePaletteMachine } from "@/components/palette/use-palette";

/**
 * The one client boundary on the page.
 *
 * It owns nothing itself: `usePaletteMachine` holds the state and every child
 * below is a pure function of it. All this component decides is which of the
 * four stage states is on screen — and, when a failure arrives on top of a
 * palette that already exists, that the colors stay and the error becomes a
 * band instead of a takeover.
 */
export function PaletteWorkspace() {
  const { state, actions, canSubmit } = usePaletteMachine();
  const descriptionRef = React.useRef<HTMLTextAreaElement | null>(null);

  const useExample = React.useCallback(
    (description: string) => {
      actions.setDescription(description);
      const field = descriptionRef.current;
      field?.focus();
      field?.setSelectionRange(description.length, description.length);
    },
    [actions],
  );

  const pending = state.status === "pending";
  const hasPalette = state.palette !== null && state.palette.length > 0;

  return (
    <>
      <PaletteComposer
        state={state}
        actions={actions}
        canSubmit={canSubmit}
        descriptionRef={descriptionRef}
      />

      {state.status === "error" && state.error && hasPalette ? (
        <PaletteErrorNotice
          error={state.error}
          onRetry={actions.generate}
          onDismiss={actions.dismissError}
          retrying={pending}
        />
      ) : null}

      {pending ? (
        <PaletteSkeleton count={state.renderedCount} />
      ) : state.status === "error" && state.error && !hasPalette ? (
        <PaletteErrorState
          error={state.error}
          onRetry={actions.generate}
          retrying={pending}
        />
      ) : hasPalette ? (
        <PaletteHero palette={state.palette!} meta={state.meta} />
      ) : (
        <EmptyState onUseExample={useExample} />
      )}
    </>
  );
}

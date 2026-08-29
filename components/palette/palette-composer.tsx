"use client";

import * as React from "react";
import {
  Loader2Icon,
  PaletteIcon,
  PipetteIcon,
  SparklesIcon,
} from "lucide-react";

import { MAX_DESCRIPTION_LENGTH } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { CountControl } from "@/components/ui/count-control";
import { Grid, GridItem } from "@/components/ui/grid";
import { Hairline } from "@/components/ui/hairline";
import { Textarea } from "@/components/ui/textarea";
import { StartingColors } from "@/components/palette/starting-colors";
import type {
  PaletteActions,
  PaletteState,
} from "@/components/palette/use-palette";

/**
 * The brief.
 *
 * One quiet band across the top of the page: description on the left, the two
 * dials and the action on the right. It is deliberately short — the palette
 * below it is the page, and a tall form would argue with that.
 *
 * The 500-character cap is imported from `lib/schemas.ts`, never retyped: the
 * counter, the `maxLength` attribute and the server's Zod check are all the
 * same number by construction.
 */

/** Ceiling for the auto-growing brief, in px. Beyond this it scrolls itself. */
const MAX_INPUT_HEIGHT = 160;

export function PaletteComposer({
  state,
  actions,
  canSubmit,
  descriptionRef,
}: {
  state: PaletteState;
  actions: PaletteActions;
  canSubmit: boolean;
  descriptionRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const pending = state.status === "pending";
  const { description, count, seeds } = state.input;
  // What the button is about to do. With colors on screen this is a *re*-mix,
  // and any locked ones are carried through it untouched — which is exactly
  // the thing a user needs to know before pressing it.
  const locked = (state.palette ?? []).filter((color) => color.locked).length;
  const regenerate = (state.palette?.length ?? 0) > 0;

  const descriptionError = state.error?.fields?.description?.join(" ");

  // Grows with the text the way a chat composer does: reset to `auto` first so
  // the box can shrink again on delete, then match content up to a ceiling —
  // past that it scrolls internally rather than pushing the page into a
  // scrollbar, which the one-viewport layout cannot afford.
  React.useLayoutEffect(() => {
    const el = descriptionRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_INPUT_HEIGHT)}px`;
  }, [description, descriptionRef]);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    actions.generate();
  };

  // ⌘/Ctrl+Enter submits from inside the textarea; a bare Enter is a newline,
  // because a project brief is prose.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      if (canSubmit) actions.generate();
    }
  };

  return (
    <>
      <Container size="wide" className="pt-8 pb-5 sm:pt-10 sm:pb-6">
        <form onSubmit={submit} noValidate aria-label="Palette brief">
          <Grid>
            <GridItem span={6}>
              <label
                htmlFor="description"
                className="flex items-center gap-2 text-label font-medium text-foreground"
              >
                <SparklesIcon aria-hidden className="size-4 text-primary" />
                Describe your project{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </label>

              <Textarea
                id="description"
                ref={descriptionRef}
                name="description"
                value={description}
                onChange={(event) => actions.setDescription(event.target.value)}
                onKeyDown={handleKeyDown}
                disabled={pending}
                maxLength={MAX_DESCRIPTION_LENGTH}
                rows={1}
                aria-invalid={descriptionError ? true : undefined}
                aria-describedby={
                  descriptionError ? "description-error" : undefined
                }
                className="mt-3 min-h-0 resize-none overflow-y-auto py-3"
                style={{ maxHeight: `${MAX_INPUT_HEIGHT}px` }}
              />

              {/* The counter and the ⌘↵ hint were removed. This slot stays so a
                  validation error still has somewhere to land, and so the
                  textarea's aria-describedby never points at a missing node. */}
              {descriptionError ? (
                <p
                  id="description-error"
                  aria-live="polite"
                  className="mt-2 text-micro tracking-normal text-destructive"
                >
                  {descriptionError}
                </p>
              ) : null}

              <div className="mt-4">
                <p className="flex items-center gap-2 text-label font-medium text-foreground">
                  <PipetteIcon aria-hidden className="size-4 text-primary" />
                  Add starting color{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </p>
                <div className="mt-3">
                  <StartingColors
                    seeds={seeds}
                    disabled={pending}
                    onAdd={actions.addSeed}
                    onUpdate={actions.updateSeed}
                    onRemove={actions.removeSeed}
                  />
                </div>
              </div>
            </GridItem>

            <GridItem
              span={5}
              start={8}
              className="mt-5 flex flex-row items-end gap-3 lg:mt-0 lg:flex-col lg:items-stretch lg:gap-5"
            >
              <div className="shrink-0">
                <p className="flex items-center gap-2 text-label font-medium text-foreground">
                  <PaletteIcon aria-hidden className="size-4 text-primary" />
                  <span className="hidden sm:inline">How many colors?</span>
                  <span className="sm:hidden">Colors</span>
                </p>
                <div className="mt-3">
                  <CountControl
                    value={count}
                    onValueChange={actions.setCount}
                    disabled={pending}
                    label="Number of colors"
                  />
                </div>
              </div>

              <Button
                type="submit"
                size="lg"
                disabled={!canSubmit}
                aria-busy={pending || undefined}
                className="h-10 w-fit shrink-0 grow-0 self-start bg-linear-to-r from-[#7C3AED] to-[#6C4CF1] px-5 text-sm font-semibold text-white shadow-sm hover:brightness-110"
              >
                {pending ? (
                  <Loader2Icon aria-hidden className="animate-spin" />
                ) : (
                  <SparklesIcon aria-hidden className="size-4" />
                )}
                {regenerate ? "Regenerate" : "Generate"}
                {locked > 0 ? ` — ${locked} locked` : ""}
              </Button>
            </GridItem>
          </Grid>
        </form>
      </Container>

      <Hairline />
    </>
  );
}

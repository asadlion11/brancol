"use client";

import * as React from "react";
import { Loader2Icon, SparklesIcon } from "lucide-react";

import { MAX_DESCRIPTION_LENGTH } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { CountControl } from "@/components/ui/count-control";
import { Hairline } from "@/components/ui/hairline";
import { Textarea } from "@/components/ui/textarea";
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
  const { description, count } = state.input;
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
        {/* One row: description, count, actions. Starting colours were removed
            entirely — the target user has no colour to seed with, so the
            control was a decision they could not make. */}
        <form
          onSubmit={submit}
          noValidate
          aria-label="Palette brief"
          className="flex flex-col gap-4 lg:flex-row lg:items-end lg:gap-6"
        >
          <div className="min-w-0 flex-1">
            <label
              htmlFor="description"
              className="text-label font-medium text-foreground"
            >
              Description{" "}
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
              className="mt-2 min-h-0 resize-none overflow-y-auto py-2.5"
              style={{ maxHeight: `${MAX_INPUT_HEIGHT}px` }}
            />

            {descriptionError ? (
              <p
                id="description-error"
                aria-live="polite"
                className="mt-2 text-micro tracking-normal text-destructive"
              >
                {descriptionError}
              </p>
            ) : null}
          </div>

          <div className="shrink-0">
            <p className="text-label font-medium text-foreground">
              How many colors?
            </p>
            <div className="mt-2">
              <CountControl
                value={count}
                onValueChange={actions.setCount}
                disabled={pending}
                label="Number of colors"
              />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="submit"
              size="lg"
              disabled={!canSubmit}
              aria-busy={pending || undefined}
              className="h-10 w-fit shrink-0 grow-0 bg-linear-to-r from-[#7C3AED] to-[#6C4CF1] px-5 text-sm font-semibold text-white shadow-sm hover:brightness-110"
            >
              {pending ? (
                <Loader2Icon aria-hidden className="animate-spin" />
              ) : (
                <SparklesIcon aria-hidden className="size-4" />
              )}
              {regenerate ? "Regenerate" : "Generate"}
              {locked > 0 ? ` — ${locked} locked` : ""}
            </Button>

            {/* Enabled only once there is a palette to clear — i.e. exactly
                when the submit button reads "Regenerate". */}
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={!regenerate || pending}
              onClick={actions.reset}
              className="h-10 w-fit shrink-0 grow-0 px-4 text-sm font-medium"
            >
              New
            </Button>
          </div>
        </form>
      </Container>

      <Hairline />
    </>
  );
}

"use client";

import * as React from "react";
import { Loader2Icon } from "lucide-react";

import { MAX_DESCRIPTION_LENGTH } from "@/lib/schemas";
import { cn } from "@/lib/utils";
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

/** Warn while there is still room to act, not once the cap has already bitten. */
const WARN_REMAINING = 60;

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
  const used = description.length;
  const remaining = MAX_DESCRIPTION_LENGTH - used;

  const descriptionError = state.error?.fields?.description?.join(" ");

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
      <Container size="wide" className="py-8 sm:py-10">
        <form onSubmit={submit} noValidate aria-label="Palette brief">
          <Grid>
            <GridItem span={6}>
              <label
                htmlFor="description"
                className="type-eyebrow text-muted-foreground"
              >
                Describe your project
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
                rows={3}
                placeholder="Calm wellness app — soft, trustworthy, unhurried."
                aria-invalid={descriptionError ? true : undefined}
                aria-describedby="description-counter"
                className="mt-3 min-h-28"
              />

              <div className="mt-2 flex items-baseline justify-between gap-4">
                <p className="text-micro tracking-normal text-muted-foreground">
                  {descriptionError ?? "⌘↵ to generate"}
                </p>
                <p
                  id="description-counter"
                  aria-live="polite"
                  className={cn(
                    "shrink-0 type-hex text-micro tabular-nums",
                    remaining <= 0
                      ? "text-destructive"
                      : remaining <= WARN_REMAINING
                        ? "text-foreground"
                        : "text-muted-foreground",
                  )}
                >
                  {used} / {MAX_DESCRIPTION_LENGTH}
                </p>
              </div>
            </GridItem>

            <GridItem
              span={5}
              start={8}
              className="mt-10 flex flex-col gap-8 lg:mt-0"
            >
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="type-eyebrow text-muted-foreground">
                    How many colors
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
                >
                  {pending ? (
                    <Loader2Icon aria-hidden className="animate-spin" />
                  ) : null}
                  {regenerate ? "Regenerate" : "Generate palette"}
                  {locked > 0 ? ` — ${locked} locked` : ""}
                </Button>
              </div>

              <StartingColors
                seeds={seeds}
                disabled={pending}
                onAdd={actions.addSeed}
                onUpdate={actions.updateSeed}
                onRemove={actions.removeSeed}
              />
            </GridItem>
          </Grid>
        </form>
      </Container>

      <Hairline />
    </>
  );
}

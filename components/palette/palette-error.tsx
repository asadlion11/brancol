"use client";

import * as React from "react";
import { RotateCcwIcon } from "lucide-react";

import type { PaletteError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Grid, GridItem } from "@/components/ui/grid";
import { Hairline } from "@/components/ui/hairline";

/**
 * The failure state.
 *
 * Every code gets its own headline and its own instruction — "wait a minute"
 * and "the model is down" must never read the same, or the retry button is a
 * coin flip. The copy itself lives in `lib/api.ts` next to the mapping.
 *
 * The brief is never touched by a failure, so Retry re-sends exactly what the
 * user wrote. Nothing to re-type.
 */

const FIELD_LABELS: Record<string, string> = {
  description: "Description",
  count: "Color count",
  startingColors: "Starting colors",
  lockedColors: "Locked colors",
  _: "Request",
};

export function PaletteErrorState({
  error,
  onRetry,
  retrying,
}: {
  error: PaletteError;
  onRetry: () => void;
  retrying: boolean;
}) {
  const fields = Object.entries(error.fields ?? {});

  return (
    <div className="flex flex-1 items-start py-14 sm:py-20 md:min-h-[26rem] md:items-center">
      <Container size="wide">
        <Grid>
          <GridItem span={6}>
            <div role="alert">
              <p className="type-eyebrow text-destructive">
                Generation failed — {error.code.replace(/_/g, " ")}
              </p>

              {fields.length > 0 ? (
                <dl className="mt-8 max-w-lg">
                  {fields.map(([field, messages]) => (
                    <div key={field}>
                      <Hairline />
                      <div className="flex gap-4 py-3">
                        <dt className="w-32 shrink-0 type-eyebrow text-muted-foreground">
                          {FIELD_LABELS[field] ?? field}
                        </dt>
                        <dd className="text-label text-foreground/85">
                          {messages.join(" ")}
                        </dd>
                      </div>
                    </div>
                  ))}
                  <Hairline />
                </dl>
              ) : null}
            </div>

            {error.retryable ? (
              <div className="mt-10 flex items-center gap-4">
                <Button type="button" onClick={onRetry} disabled={retrying}>
                  <RotateCcwIcon aria-hidden />
                  {retrying ? "Generating…" : "Try again"}
                </Button>
              </div>
            ) : null}
          </GridItem>
        </Grid>
      </Container>
    </div>
  );
}

/**
 * The same failure, compressed to a single band.
 *
 * Used when a palette is already on screen: a rate limit on the *second*
 * generation must not take the first palette away. The notice sits above the
 * hero and the colors stay put.
 */
export function PaletteErrorNotice({
  error,
  onRetry,
  onDismiss,
  retrying,
}: {
  error: PaletteError;
  onRetry: () => void;
  onDismiss: () => void;
  retrying: boolean;
}) {
  return (
    <>
      <Container
        size="wide"
        role="alert"
        className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <p className="type-eyebrow text-destructive">
          Generation failed — {error.code.replace(/_/g, " ")}
        </p>

        <div className="flex shrink-0 items-center gap-1">
          {error.retryable ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRetry}
              disabled={retrying}
            >
              <RotateCcwIcon aria-hidden />
              Try again
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
            Dismiss
          </Button>
        </div>
      </Container>
      <Hairline />
    </>
  );
}

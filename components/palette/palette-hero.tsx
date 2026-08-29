"use client";

import * as React from "react";
import { PlusIcon, TriangleAlertIcon } from "lucide-react";

import { formatRatio } from "@/lib/contrast";
import { MAX_COLOR_COUNT } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Hairline } from "@/components/ui/hairline";
import { BandRail } from "@/components/palette/band";
import { ColorBand } from "@/components/palette/color-band";
import { PaletteToolbar } from "@/components/palette/palette-actions";
import { contrastIssues } from "@/components/palette/contrast";
import {
  MixingStatus,
  SkeletonBand,
} from "@/components/palette/palette-skeleton";
import type {
  PaletteActions,
  PaletteState,
} from "@/components/palette/use-palette";

/**
 * The hero: the generated palette *is* the page.
 *
 * Bands are keyed on `state.bandKeys`, not on their hex and not on their
 * index. That is the whole of the lock guarantee on the client side: a locked
 * color comes back from the server byte-identical and carrying the key it
 * already had, so React reconciles it in place — same DOM node, same scroll,
 * same focus, nothing to re-run when Phase 6 puts a reveal on the new ones.
 *
 * Everything below the rail is a footnote to it: the count, the model, and any
 * role pair that cannot be read. None of it can stop the user doing anything.
 */

/**
 * The AA audit, stated plainly.
 *
 * A warning and never a gate — the palette is exactly what was asked for, and
 * the fix (unlock, edit, regenerate) is one action away in the field above.
 */
function ContrastNotice({ palette }: { palette: PaletteState["palette"] }) {
  const issues = React.useMemo(() => contrastIssues(palette ?? []), [palette]);

  if (issues.length === 0) return null;

  return (
    <>
      <Hairline />
      <Container size="wide" className="py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:gap-4">
          <p className="flex shrink-0 items-center gap-1.5 type-eyebrow text-destructive">
            <TriangleAlertIcon aria-hidden className="size-3.5" />
            Contrast below AA
          </p>
          <ul className="flex flex-col gap-1">
            {issues.map((issue) => (
              <li
                key={`${issue.foreground.role}-${issue.background.role}`}
                className="text-label text-muted-foreground"
              >
                <span className="text-foreground">
                  {issue.foreground.name} on {issue.background.name}
                </span>{" "}
                — {formatRatio(issue.ratio)}, under the 4.5:1 WCAG AA minimum
                for body text. Usable as large type or decoration.
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </>
  );
}

/**
 * The sample-UI preview is the only thing on the page that needs
 * `lib/variants.ts` — and therefore culori's gamut mapping — in the browser.
 * It also sits below the fold, under a poster that runs to the bottom of the
 * viewport. Splitting it out keeps that weight off the first load without
 * costing anything: it still renders on the server, so it is in the HTML.
 */
export function PaletteHero({
  state,
  actions,
}: {
  state: PaletteState;
  actions: PaletteActions;
}) {
  const { palette, bandKeys, meta, edit, lastCopy, focusKey } = state;
  const colors = palette ?? [];

  /**
   * Where focus goes when the element that had it is destroyed. Each band
   * registers its hex button; the reducer names one after a removal or an
   * edit, and it is claimed here, once, on the render that follows.
   */
  const anchors = React.useRef(new Map<string, HTMLElement>());

  const registerAnchor = React.useCallback(
    (key: string, node: HTMLElement | null) => {
      if (node) anchors.current.set(key, node);
      else anchors.current.delete(key);
    },
    [],
  );

  React.useEffect(() => {
    if (!focusKey) return;
    anchors.current.get(focusKey)?.focus();
    actions.clearFocus();
  }, [focusKey, actions]);

  const full = colors.length >= MAX_COLOR_COUNT;

  // While a regeneration is in flight the hero stays mounted and keeps every
  // locked band exactly where it is; only the slots that are actually being
  // re-mixed become placeholders. Handing the whole stage over to the skeleton
  // would unmount the locked bands, and a lock that blinks is not a lock.
  const regenerating = state.status === "pending";
  const slots = regenerating ? state.renderedCount : colors.length;
  const heldCount = regenerating
    ? colors.slice(0, slots).filter((color) => color.locked).length
    : 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* The rail names itself for assistive technology (below), but the page
          also needs a heading outline: without this, everything between the
          brief and the preview is one unlabelled run. Visually hidden, because
          a caption over the poster is exactly the chrome L20 rules out. */}
      <h2 className="sr-only">
        {regenerating
          ? "Palette, regenerating"
          : `Generated palette, ${colors.length} colors`}
      </h2>

      <BandRail
        role="list"
        aria-label={
          regenerating
            ? `Palette regenerating, ${heldCount} colors locked`
            : `Generated palette, ${colors.length} colors`
        }
      >
        {Array.from({ length: slots }, (_, index) => {
          const color = colors[index];
          const key = bandKeys[index];

          if (!color || !key || (regenerating && !color.locked)) {
            return <SkeletonBand key={`slot-${index}`} index={index} />;
          }

          return (
            <ColorBand
              key={key}
              bandKey={key}
              color={color}
              index={index}
              held={regenerating}
              edit={edit?.key === key ? edit : null}
              copiedFormat={lastCopy?.key === key ? lastCopy.format : null}
              paletteSize={colors.length}
              actions={actions}
              registerAnchor={registerAnchor}
            />
          );
        })}
      </BandRail>

      {regenerating ? (
        <MixingStatus mixing={slots - heldCount} held={heldCount} />
      ) : (
        <>
          <ContrastNotice palette={palette} />

          <Hairline />
          <Container
            size="wide"
            className="flex flex-col gap-3 py-3 text-micro tracking-[0.09em] text-muted-foreground uppercase sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <p>{colors.length} colors · HEX · RGB · HSL · OKLCH</p>
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={full}
                onClick={actions.addColor}
                className="uppercase"
              >
                <PlusIcon aria-hidden />
                {full ? `Max ${MAX_COLOR_COUNT}` : "Add color"}
              </Button>
              <PaletteToolbar palette={colors} onAnnounce={actions.announce} />
            </div>

            {meta ? (
              <p>
                {meta.model}
                {meta.fallbackUsed ? " (fallback)" : ""} ·{" "}
                {(meta.durationMs / 1000).toFixed(1)}s
              </p>
            ) : null}
          </Container>
        </>
      )}
    </div>
  );
}

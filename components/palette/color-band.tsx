"use client";

import * as React from "react";
import {
  CheckIcon,
  EllipsisIcon,
  LockIcon,
  LockOpenIcon,
  PencilIcon,
  TrashIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { bestForeground } from "@/lib/contrast";
import { cn } from "@/lib/utils";
import { normalizeHex } from "@/lib/color";
import { MIN_COLOR_COUNT } from "@/lib/schemas";
import type { Color } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { BandShell, bandIndex } from "@/components/palette/band";
import { bandFailsAA } from "@/components/palette/contrast";
import {
  COLOR_FORMATS,
  FORMAT_LABELS,
  type ColorFormat,
  type PaletteActions,
  type PaletteEdit,
} from "@/components/palette/use-palette";

/**
 * One band, and everything you can do to it.
 *
 * The band is a color field first and a control surface second, so all its
 * chrome is drawn in the band's *own* ink — `bestForeground(hex)` picks ink or
 * paper, and every button, ring and rule inherits it through `currentColor`.
 * Nothing here is painted in a page token, because a page token has no idea
 * what the model just mixed underneath it.
 *
 * Three tab stops per band and no more: the hex (copies it), the lock, and the
 * menu that holds the other three formats, the hex editor and removal. Radix
 * owns the menu's focus contract; the reducer owns where focus lands when a
 * band or an editor disappears out from under it.
 */

/**
 * Chrome that lives on a color field.
 *
 * Overrides every page-token colour the shadcn ghost variant would otherwise
 * bring, `cn`'s tailwind-merge doing the replacing rather than a `!important`
 * arms race. The focus ring is `currentColor` — the band's own ink — which is
 * the only ring guaranteed to be visible on all 16 million possible grounds.
 * (It has to be the ring and not an outline: `Button` sets `outline-none`,
 * which pins `--tw-outline-style` to `none` for the whole element.)
 */
const BAND_CONTROL = cn(
  "border-transparent text-current opacity-70",
  "hover:bg-[color-mix(in_srgb,currentColor_14%,transparent)] hover:text-current hover:opacity-100",
  "focus-visible:border-current focus-visible:opacity-100 focus-visible:ring-current/45",
);

function CopyItem({
  color,
  format,
  copied,
  onCopy,
}: {
  color: Color;
  format: ColorFormat;
  copied: boolean;
  onCopy: (format: ColorFormat) => void;
}) {
  return (
    <DropdownMenuItem onSelect={() => onCopy(format)}>
      <span className="w-12 shrink-0 type-eyebrow text-muted-foreground">
        {FORMAT_LABELS[format]}
      </span>
      <span className="flex-1 truncate type-hex text-micro tracking-normal normal-case">
        {color[format]}
      </span>
      {copied ? (
        <CheckIcon aria-hidden className="text-muted-foreground" />
      ) : null}
      <span className="sr-only">
        Copy {FORMAT_LABELS[format]} value for {color.name}
      </span>
    </DropdownMenuItem>
  );
}

/**
 * The hex, in edit mode.
 *
 * Uses the real `Input`, invalid state and all: a value that is not a color
 * turns the field destructive and *stays put*. Reverting silently would throw
 * away the thing the user was in the middle of typing, which is the one
 * outcome a hand-edit must never produce.
 */
function HexEditor({
  edit,
  color,
  actions,
}: {
  edit: PaletteEdit;
  color: Color;
  actions: PaletteActions;
}) {
  const ref = React.useRef<HTMLInputElement | null>(null);
  const statusId = `${edit.key}-hex-status`;
  const typed = edit.value.trim();
  const normalized = normalizeHex(edit.value);
  const invalid = typed.length > 0 && normalized === null;

  React.useEffect(() => {
    const field = ref.current;
    field?.focus();
    field?.select();
  }, []);

  const commit = () => {
    if (typed.length === 0) {
      actions.cancelEdit();
      return;
    }
    if (!normalized) return;
    actions.commitEdit(edit.key, edit.value);
  };

  return (
    <div className="mt-0.5">
      <Input
        ref={ref}
        value={edit.value}
        onChange={(event) => actions.changeEdit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            actions.cancelEdit();
          }
        }}
        // Leaving a field that still holds a non-colour keeps the editor open
        // and the message on screen; there is nothing to commit and nothing to
        // throw away.
        onBlur={() => {
          if (!invalid) commit();
        }}
        aria-label={`Hex value for ${color.name}`}
        aria-invalid={invalid || undefined}
        aria-describedby={statusId}
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        maxLength={24}
        className="h-8 type-hex text-label"
      />
      <p
        id={statusId}
        className={cn(
          "mt-1 text-micro tracking-normal normal-case",
          invalid ? "text-destructive" : "opacity-70",
        )}
      >
        {invalid ? "Not a color — try #1769AA" : "↵ to apply · esc to cancel"}
      </p>
    </div>
  );
}

/**
 * How far into the reveal this band starts.
 *
 * Capped at six steps: ten bands times a full step would put the last one
 * most of a second behind the first, and a stagger that outlasts the user's
 * attention has stopped being a reveal and started being a wait. The cap also
 * means a single hand-added band — which always mounts at the end of the
 * rail — appears promptly rather than after everything that came before it.
 */
const REVEAL_STEP_MS = 55;
const REVEAL_MAX_STEPS = 6;

function revealDelay(index: number): string {
  return `${Math.min(index, REVEAL_MAX_STEPS) * REVEAL_STEP_MS}ms`;
}

/** The band's ground, its ink, and — when locked — its inset rule. */
function bandStyle(
  color: Color,
  foregroundHex: string,
  index: number,
): React.CSSProperties {
  return {
    backgroundColor: color.hex,
    color: foregroundHex,
    // Read by the `[data-reveal]` rule in globals.css, which only exists
    // inside `prefers-reduced-motion: no-preference`.
    ["--band-delay" as string]: revealDelay(index),
    // A locked band says so from across the room, drawn in its own ink and
    // inset so the field keeps its hard edge. Inline rather than a utility
    // because the value is a function of `bestForeground`, which Tailwind
    // cannot see.
    boxShadow: color.locked ? `inset 0 0 0 2px ${foregroundHex}66` : undefined,
  };
}

function bandLabel(color: Color, failsAA: boolean): string {
  return [
    `${color.role} — ${color.name}, ${color.hex}`,
    color.locked ? ", locked" : "",
    failsAA ? ", contrast below AA for body text" : "",
  ].join("");
}

/** The caption block: role, name, and the AA flag when one is warranted. */
function BandCaption({
  color,
  failsAA,
  ratio,
  children,
}: {
  color: Color;
  failsAA: boolean;
  ratio: number;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-8 flex flex-col md:mt-0">
      <span aria-hidden className="type-eyebrow opacity-75">
        {color.role}
      </span>
      <span
        aria-hidden
        className={cn(
          "mt-1 text-label leading-snug text-balance",
          // Below AA the caption is the first thing to go soft, so it gets
          // the extra weight rather than a scrim that would dirty the field.
          failsAA ? "font-semibold" : "font-medium",
        )}
      >
        {color.name}
      </span>

      {children}

      {failsAA ? (
        // Terse by necessity: a band can be a hundred pixels wide, and a
        // sentence here would wrap into the poster. The full statement is in
        // the band's own label, and the failing role pairs are spelled out
        // under the rail.
        <span
          aria-hidden
          className="mt-1.5 flex items-center gap-1 type-hex text-micro opacity-90"
        >
          <TriangleAlertIcon aria-hidden className="size-3 shrink-0" />
          AA {ratio.toFixed(2)}
        </span>
      ) : null}
    </div>
  );
}

export type ColorBandProps = {
  color: Color;
  index: number;
  bandKey: string;
  /** The live edit, when it belongs to this band. */
  edit: PaletteEdit | null;
  /** The format last copied from this band, if any. */
  copiedFormat: ColorFormat | null;
  /** Palette length, so the band knows whether removal is still allowed. */
  paletteSize: number;
  actions: PaletteActions;
  /** Registers the element focus should land on after a removal or an edit. */
  registerAnchor: (key: string, node: HTMLElement | null) => void;
  /**
   * True while the rest of the palette is being re-mixed around this band.
   *
   * The band stays exactly where it is and goes inert — the request has
   * already gone out, and offering controls that cannot affect it would be a
   * lie. Crucially it is the *same component* either way, so React re-renders
   * the band it already has rather than unmounting it and mounting a
   * replacement. That is what makes "locked" mean no flicker and, come Phase
   * 6, no second run of the reveal.
   */
  held?: boolean;
};

export function ColorBand({
  color,
  index,
  bandKey,
  edit,
  copiedFormat,
  paletteSize,
  actions,
  registerAnchor,
  held = false,
}: ColorBandProps) {
  const foreground = bestForeground(color.hex);
  const failsAA = bandFailsAA(color.hex, foreground.hex);
  const editing = edit !== null && !held;
  const canRemove = paletteSize > MIN_COLOR_COUNT;

  // Radix restores focus to the menu trigger when the menu closes. Twice that
  // is wrong: opening the hex editor (the field must take focus) and removing
  // the band (the trigger is about to stop existing). Both hand focus to the
  // reducer's `focusKey` instead, so the flag is set in the same tick as the
  // dispatch and read on the very next close.
  const deferFocus = React.useRef(false);

  return (
    <BandShell
      role="listitem"
      data-locked={color.locked || undefined}
      data-held={held || undefined}
      data-reveal=""
      style={bandStyle(color, foreground.hex, index)}
      // A band is a figure with controls on it, not a control itself: one
      // accessible label, then individually named actions inside it.
      aria-label={
        held
          ? `${bandLabel(color, failsAA)}, held while the palette regenerates`
          : bandLabel(color, failsAA)
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
        <span aria-hidden className="type-hex text-micro opacity-55">
          {bandIndex(index)}
        </span>

        {held ? (
          <LockIcon aria-hidden className="size-3.5 shrink-0 opacity-70" />
        ) : (
          <div className="-mt-1 -mr-1 flex items-center">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-pressed={color.locked}
              onClick={() => actions.toggleLock(bandKey)}
              className={cn(
                BAND_CONTROL,
                color.locked &&
                  "bg-current opacity-100 hover:bg-current hover:opacity-90",
              )}
            >
              {color.locked ? (
                <LockIcon aria-hidden style={{ color: color.hex }} />
              ) : (
                <LockOpenIcon aria-hidden />
              )}
              <span className="sr-only">Lock color — {color.name}</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className={BAND_CONTROL}
                >
                  <EllipsisIcon aria-hidden />
                  <span className="sr-only">Actions for {color.name}</span>
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                aria-label={`Actions for ${color.name}`}
                align="end"
                onCloseAutoFocus={(event) => {
                  if (!deferFocus.current) return;
                  deferFocus.current = false;
                  event.preventDefault();
                }}
              >
                <DropdownMenuLabel>Copy value</DropdownMenuLabel>
                {COLOR_FORMATS.map((format) => (
                  <CopyItem
                    key={format}
                    color={color}
                    format={format}
                    copied={copiedFormat === format}
                    onCopy={(picked) => actions.copyColor(bandKey, picked)}
                  />
                ))}

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onSelect={() => {
                    deferFocus.current = true;
                    actions.openEdit(bandKey);
                  }}
                >
                  <PencilIcon aria-hidden />
                  Edit hex
                  <span className="sr-only"> for {color.name}</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  variant="destructive"
                  disabled={!canRemove}
                  onSelect={() => {
                    deferFocus.current = true;
                    actions.removeColor(bandKey);
                  }}
                >
                  <TrashIcon aria-hidden />
                  {canRemove
                    ? "Remove color"
                    : `Minimum ${MIN_COLOR_COUNT} colors`}
                  {canRemove ? (
                    <span className="sr-only"> {color.name}</span>
                  ) : null}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      <BandCaption color={color} failsAA={failsAA} ratio={foreground.ratio}>
        {editing && edit ? (
          <HexEditor edit={edit} color={color} actions={actions} />
        ) : held ? (
          <span aria-hidden className="mt-0.5 type-hex text-label opacity-90">
            {color.hex}
          </span>
        ) : (
          <button
            type="button"
            ref={(node) => registerAnchor(bandKey, node)}
            onClick={() => actions.copyColor(bandKey, "hex")}
            className={cn(
              "mt-0.5 -ml-1 w-fit max-w-full truncate rounded-sm px-1 py-0.5 text-left",
              "type-hex text-label opacity-90",
              "hover:bg-[color-mix(in_srgb,currentColor_14%,transparent)] hover:opacity-100",
              "focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current",
            )}
          >
            <span aria-hidden>{color.hex}</span>
            <span className="sr-only">
              Copy hex {color.hex} — {color.name}
            </span>
          </button>
        )}
      </BandCaption>
    </BandShell>
  );
}

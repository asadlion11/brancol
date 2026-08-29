"use client";

import * as React from "react";
import { PlusIcon, XIcon } from "lucide-react";

import { normalizeHex } from "@/lib/color";
import { MAX_STARTING_COLORS } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SeedColor } from "@/components/palette/use-palette";

/**
 * Optional seeds: nought to two colors the palette must be built around.
 *
 * Two ways in, one value: type a hex, or open the OS picker. Whatever arrives
 * is run through `normalizeHex` on every keystroke, which is what lets
 * `1769aa`, `#abc` and `rgb(23,105,170)` all be accepted while the field still
 * says plainly when a value is not a color yet.
 *
 * The raw text is never rewritten under the caret — `#ab` would become `#AABB`
 * mid-word. The normalized value is shown beside it in the preview chip
 * instead, so the user can see exactly what will be sent.
 */

/** The chip is a color field, so it is sharp-edged like the hero bands. */
function PreviewChip({ hex }: { hex: string }) {
  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden
        className="size-3 shrink-0 border border-black/10 dark:border-white/15"
        style={{ backgroundColor: hex }}
      />
      <span className="type-hex text-micro text-muted-foreground">{hex}</span>
    </span>
  );
}

function SeedRow({
  seed,
  index,
  disabled,
  onUpdate,
  onRemove,
}: {
  seed: SeedColor;
  index: number;
  disabled: boolean;
  onUpdate: (id: string, value: string) => void;
  onRemove: (id: string) => void;
}) {
  const normalized = normalizeHex(seed.value);
  const touched = seed.value.trim().length > 0;
  const invalid = touched && normalized === null;
  const inputId = `starting-color-${seed.id}`;
  const statusId = `${inputId}-status`;

  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        {/* Native picker. A control, so it keeps the 8px control radius. */}
        <span className="relative size-9 shrink-0 overflow-hidden rounded-lg border border-input">
          <input
            type="color"
            value={normalized ?? "#6C4CF1"}
            disabled={disabled}
            aria-label={`Pick starting color ${index + 1}`}
            onChange={(event) =>
              onUpdate(seed.id, event.target.value.toUpperCase())
            }
            className="absolute -inset-2 size-[calc(100%+1rem)] cursor-pointer border-0 bg-transparent p-0 disabled:cursor-not-allowed"
          />
        </span>

        <Input
          id={inputId}
          value={seed.value}
          disabled={disabled}
          onChange={(event) => onUpdate(seed.id, event.target.value)}
          placeholder="#1769AA"
          maxLength={24}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          aria-label={`Starting color ${index + 1}`}
          aria-invalid={invalid || undefined}
          aria-describedby={statusId}
          className="flex-1 type-hex"
        />

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={disabled}
          onClick={() => onRemove(seed.id)}
        >
          <XIcon aria-hidden />
          <span className="sr-only">Remove starting color {index + 1}</span>
        </Button>
      </div>

      <p
        id={statusId}
        className={cn(
          "min-h-4 pl-11 text-micro",
          invalid ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {invalid ? (
          "Not a color yet — try #1769AA"
        ) : normalized ? (
          <PreviewChip hex={normalized} />
        ) : (
          "Hex, or use the picker"
        )}
      </p>
    </li>
  );
}

export function StartingColors({
  seeds,
  disabled = false,
  onAdd,
  onUpdate,
  onRemove,
}: {
  seeds: SeedColor[];
  disabled?: boolean;
  onAdd: (value?: string) => void;
  onUpdate: (id: string, value: string) => void;
  onRemove: (id: string) => void;
}) {
  const full = seeds.length >= MAX_STARTING_COLORS;

  return (
    <div>
      {seeds.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {seeds.map((seed, index) => (
            <SeedRow
              key={seed.id}
              seed={seed}
              index={index}
              disabled={disabled}
              onUpdate={onUpdate}
              onRemove={onRemove}
            />
          ))}
        </ul>
      ) : null}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className=""
        disabled={disabled || full}
        onClick={() => onAdd()}
      >
        <PlusIcon aria-hidden />
        {seeds.length === 0 ? "Add a starting color" : "Add another"}
      </Button>

      {full ? (
        <p className="mt-2 text-micro text-muted-foreground">
          Two is the limit — more and there is nothing left to generate.
        </p>
      ) : null}
    </div>
  );
}

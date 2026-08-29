"use client";

import * as React from "react";
import { MinusIcon, PlusIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const DEFAULT_MIN = 2;
const DEFAULT_MAX = 10;

/** Never emit a value outside the range, whatever the caller passes in. */
function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

type CountControlProps = Omit<
  React.ComponentProps<"div">,
  "onChange" | "defaultValue"
> & {
  /** Controlled value. Omit for uncontrolled. */
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  /** Accessible name for the whole control. */
  label?: string;
};

/**
 * Stepper for the palette colour count (2–10).
 *
 * The readout is the `spinbutton`: it takes focus and owns the keyboard, so
 * ArrowLeft/ArrowDown decrement and ArrowRight/ArrowUp increment, with
 * Home/End jumping to the ends. The −/+ buttons are the pointer affordance
 * for the same value.
 *
 * Every path — buttons, keys, a controlled value from the parent — goes
 * through `clamp`, so the control can never emit below `min` or above `max`.
 */
function CountControl({
  className,
  value,
  defaultValue = DEFAULT_MIN,
  onValueChange,
  min = DEFAULT_MIN,
  max = DEFAULT_MAX,
  disabled = false,
  label = "Number of colors",
  ...props
}: CountControlProps) {
  const isControlled = value !== undefined;
  // Non-null only while the field is being typed into.
  const [draft, setDraft] = React.useState<string | null>(null);
  const [internal, setInternal] = React.useState(() =>
    clamp(defaultValue, min, max),
  );

  const current = clamp(isControlled ? value : internal, min, max);

  const commit = React.useCallback(
    (next: number) => {
      const clamped = clamp(next, min, max);
      if (clamped === current) return;
      if (!isControlled) setInternal(clamped);
      onValueChange?.(clamped);
    },
    [current, isControlled, max, min, onValueChange],
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (disabled) return;

    switch (event.key) {
      case "ArrowRight":
      case "ArrowUp":
        event.preventDefault();
        commit(current + 1);
        break;
      case "ArrowLeft":
      case "ArrowDown":
        event.preventDefault();
        commit(current - 1);
        break;
      case "Home":
        event.preventDefault();
        commit(min);
        break;
      case "End":
        event.preventDefault();
        commit(max);
        break;
      default:
        break;
    }
  };

  const atMin = current <= min;
  const atMax = current >= max;

  return (
    <div
      data-slot="count-control"
      role="group"
      aria-label={label}
      data-disabled={disabled || undefined}
      className={cn(
        "inline-flex h-9 items-center rounded-lg border border-input bg-card",
        "transition-colors duration-150",
        "data-[disabled]:cursor-not-allowed data-[disabled]:bg-muted data-[disabled]:opacity-60",
        className,
      )}
      {...props}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled || atMin}
        onClick={() => commit(current - 1)}
        className="m-0.5 rounded-md"
      >
        <MinusIcon />
      </Button>

      {/* A real input, so the count can be typed as well as stepped. `draft`
          holds what the user is mid-way through typing — including the empty
          string, which must be allowed or backspace is impossible — while
          `current` stays the committed, clamped value. Blur and Enter commit;
          Escape abandons the draft. */}
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={draft ?? String(current)}
        aria-label={label}
        aria-describedby={undefined}
        disabled={disabled}
        // Select on focus: this field holds one or two digits, so typing
        // should replace the value rather than append to it — otherwise
        // clicking in and typing "7" reads as "27" and clamps to the max.
        onFocus={(event) => event.target.select()}
        onChange={(event) => {
          const next = event.target.value.replace(/[^0-9]/g, "").slice(0, 2);
          setDraft(next);
        }}
        onBlur={() => {
          if (draft !== null && draft !== "") commit(Number(draft));
          setDraft(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            if (draft !== null && draft !== "") commit(Number(draft));
            setDraft(null);
            return;
          }
          if (event.key === "Escape") {
            setDraft(null);
            return;
          }
          if (draft === null) handleKeyDown(event);
        }}
        className={cn(
          "w-9 rounded-md bg-transparent px-1 text-center text-label font-semibold tabular-nums",
          "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
          "disabled:cursor-not-allowed",
        )}
      />

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled || atMax}
        onClick={() => commit(current + 1)}
        className="m-0.5 rounded-md"
      >
        <PlusIcon />
      </Button>
    </div>
  );
}

export { CountControl };

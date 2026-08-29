import { PaletteIcon } from "lucide-react";

import { Container } from "@/components/ui/container";

/**
 * The waiting state for the output area.
 *
 * It exists so the page has the same shape before and after a generation:
 * the band rail drops straight into this box's footprint, so nothing below
 * it moves when a palette lands. Deliberately wordless — the brief above
 * already says what to do.
 */
export function OutputPlaceholder() {
  return (
    <Container size="wide" className="py-5">
      <div
        aria-hidden
        className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-primary/30 bg-primary/[0.03]"
      >
        <PaletteIcon className="size-8 text-primary/25" strokeWidth={1.25} />
      </div>
    </Container>
  );
}

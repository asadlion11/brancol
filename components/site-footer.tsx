import * as React from "react";

import { Container } from "@/components/ui/container";
import { Hairline } from "@/components/ui/hairline";

/**
 * Footer chrome. One hairline, one line of muted type, left-aligned on the
 * same axis as everything above it.
 */
export function SiteFooter() {
  return (
    <footer className="mt-auto">
      <Hairline />
      <Container
        size="wide"
        className="flex flex-col gap-2 py-6 text-micro text-muted-foreground sm:flex-row sm:items-center sm:justify-between"
      >
        <p className="tracking-[0.09em] uppercase">
          brancol — brand color systems
        </p>
        <p className="tracking-[0.09em] uppercase">
          Colors are generated, never stored
        </p>
      </Container>
    </footer>
  );
}

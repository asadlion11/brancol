import * as React from "react";
import Link from "next/link";

import { Container } from "@/components/ui/container";
import { Hairline } from "@/components/ui/hairline";
import { ThemeToggle } from "@/components/theme-toggle";
import { Wordmark } from "@/components/wordmark";

/**
 * Header chrome. A wordmark, a theme switch, a hairline — nothing else.
 * There is no navigation because there is nowhere else to go, and anything
 * more would compete with the palette.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-sm">
      <Container size="wide" className="flex h-16 items-center justify-between">
        <Link
          href="/"
          className="rounded-sm text-foreground no-underline"
          aria-label="brancol — home"
        >
          <Wordmark />
        </Link>

        <ThemeToggle />
      </Container>
      <Hairline />
    </header>
  );
}

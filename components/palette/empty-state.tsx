"use client";

import * as React from "react";
import { ArrowUpRightIcon } from "lucide-react";

import { Container } from "@/components/ui/container";
import { Grid, GridItem } from "@/components/ui/grid";
import { Hairline } from "@/components/ui/hairline";

/**
 * The empty state.
 *
 * Not a blank canvas and not a placeholder poster: a blank field of color
 * would lie about what has been generated. Instead the stage holds the one
 * thing a first-time visitor is actually missing — what a good brief sounds
 * like. Each example is a button that writes itself into the description, so
 * the shortest path to a palette is two clicks.
 */

const EXAMPLES = [
  "Calm wellness app — soft, trustworthy, unhurried.",
  "Developer tool landing page — dark, precise, technical.",
  "Independent coffee roaster — warm, earthy, hand-made.",
];

const DELIVERABLES: ReadonlyArray<readonly [string, string]> = [
  ["Every color", "A role, a human name, a hex"],
  ["Formats", "HEX · RGB · HSL · OKLCH"],
  ["Count", "Two to ten, your call"],
  ["Seeds", "Bring up to two colors of your own"],
];

export function EmptyState({
  onUseExample,
}: {
  onUseExample: (description: string) => void;
}) {
  return (
    <section
      aria-labelledby="empty-heading"
      className="flex flex-1 items-start py-14 sm:py-20 md:min-h-[26rem] md:items-center"
    >
      <Container size="wide">
        <Grid>
          <GridItem span={6}>
            <p className="type-eyebrow text-muted-foreground">No palette yet</p>

            {/* The stage's heading. A real <h2> rather than styled text, so
                the page has a heading outline a screen reader can jump
                through instead of one long unmarked run of prose. */}
            <h2
              id="empty-heading"
              className="mt-5 max-w-xl text-title text-balance"
            >
              Say what you are making and how it should feel.
            </h2>

            <p className="mt-4 max-w-lg text-body text-muted-foreground">
              The more the brief says about mood, audience and medium, the more
              the palette has to work with. Two words gets you colors; a
              sentence gets you a system.
            </p>

            <p className="mt-10 type-eyebrow text-muted-foreground">
              Briefs that work — pick one to start
            </p>
            <ul className="mt-4 max-w-xl">
              {EXAMPLES.map((example) => (
                <li key={example}>
                  <Hairline />
                  <button
                    type="button"
                    onClick={() => onUseExample(example)}
                    className="group flex w-full items-center justify-between gap-4 rounded-sm py-3.5 text-left text-body text-foreground/85 transition-colors duration-150 hover:text-foreground"
                  >
                    <span>{example}</span>
                    <ArrowUpRightIcon
                      aria-hidden
                      className="size-4 shrink-0 text-muted-foreground transition-colors duration-150 group-hover:text-primary"
                    />
                  </button>
                </li>
              ))}
              <Hairline />
            </ul>
          </GridItem>

          <GridItem span={4} start={9} className="mt-14 lg:mt-1">
            <p className="type-eyebrow text-muted-foreground">
              What comes back
            </p>
            <dl className="mt-5">
              {DELIVERABLES.map(([term, detail]) => (
                <div key={term}>
                  <Hairline />
                  <div className="py-4">
                    <dt className="text-label font-semibold">{term}</dt>
                    <dd className="mt-1 text-label text-muted-foreground">
                      {detail}
                    </dd>
                  </div>
                </div>
              ))}
              <Hairline />
            </dl>
          </GridItem>
        </Grid>
      </Container>
    </section>
  );
}

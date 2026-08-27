import { Container } from "@/components/ui/container";
import { Grid, GridItem } from "@/components/ui/grid";
import { Hairline } from "@/components/ui/hairline";

/**
 * Empty state.
 *
 * Not a blank canvas: it tells you what to say and what you get back. The
 * composer and the palette bands land here in a later phase — this page is
 * the quiet frame they arrive into.
 */
const EXAMPLES = [
  "Calm wellness app — soft, trustworthy, unhurried.",
  "Developer tool landing page — dark, precise, technical.",
  "Independent coffee roaster — warm, earthy, hand-made.",
];

const DELIVERABLES = [
  ["Count", "Two to ten colors, your call"],
  ["Every color", "A role, a human name, a hex"],
  ["Formats", "HEX · RGB · HSL · OKLCH"],
  ["Export", "CSS · Tailwind · JSON · Design tokens"],
];

export default function Home() {
  return (
    <Container size="wide" className="py-16 sm:py-24 lg:py-32">
      <Grid>
        <GridItem span={7}>
          <p className="type-eyebrow text-muted-foreground">
            Color system generator
          </p>

          <h1 className="mt-5 text-display text-balance">
            Describe your project.
            <br />
            Get colors that work together.
          </h1>

          <p className="mt-6 max-w-xl text-body text-muted-foreground">
            Say what you are making and how it should feel. brancol reads the
            description and returns a harmonious system — each color with the
            job it does, a name you can say out loud, and values you can paste
            straight into code.
          </p>

          <div className="mt-12 max-w-xl">
            <Hairline />
            <p className="mt-5 type-eyebrow text-muted-foreground">
              Descriptions that work
            </p>
            <ul className="mt-4 space-y-2.5">
              {EXAMPLES.map((example) => (
                <li key={example} className="text-body text-foreground/80">
                  {example}
                </li>
              ))}
            </ul>
          </div>
        </GridItem>

        <GridItem span={4} start={9} className="mt-16 lg:mt-2">
          <p className="type-eyebrow text-muted-foreground">What comes back</p>
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
  );
}

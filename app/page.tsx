import { Container } from "@/components/ui/container";
import { Grid, GridItem } from "@/components/ui/grid";
import { Hairline } from "@/components/ui/hairline";
import { PaletteWorkspace } from "@/components/palette/palette-workspace";

/**
 * The page is a frame and a field.
 *
 * The frame — this masthead and the brief below it — is static, server
 * rendered, and stays quiet. The field is the palette, and it runs to the
 * bottom of the viewport. Everything above it is sized to get out of its way.
 */
export default function Home() {
  return (
    <>
      <Container size="wide" className="pt-12 pb-10 sm:pt-16 sm:pb-12">
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
          </GridItem>

          <GridItem span={4} start={9} className="mt-6 lg:mt-auto">
            <p className="max-w-sm text-label text-muted-foreground">
              Say what you are making and how it should feel. brancol returns a
              harmonious system — each color with the job it does, a name you
              can say out loud, and values you can paste straight into code.
            </p>
          </GridItem>
        </Grid>
      </Container>

      <Hairline />

      <PaletteWorkspace />
    </>
  );
}

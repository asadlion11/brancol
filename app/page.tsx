import { Hairline } from "@/components/ui/hairline";
import { PaletteWorkspace } from "@/components/palette/palette-workspace";

/**
 * Fields and a button, then the palette.
 *
 * All marketing copy was stripped by product direction: no masthead, no lede,
 * no empty-state guidance. The only heading is screen-reader-only so the
 * document keeps a valid heading outline.
 */
export default function Home() {
  return (
    <>
      {/* Visually stripped per product direction: fields + button only.
          The h1 stays for the accessibility heading outline. */}
      <h1 className="sr-only">brancol — color system generator</h1>

      <Hairline />

      {/* One viewport, no scroll: this column owns the remaining height and
          centres the brief + output inside it. */}
      <div className="flex min-h-0 flex-1 flex-col">
        <PaletteWorkspace />
      </div>
    </>
  );
}

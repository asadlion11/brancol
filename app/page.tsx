export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-background px-6 text-foreground">
      <h1 className="font-sans text-4xl font-semibold tracking-tight">
        brancol
      </h1>
      <p className="max-w-md text-center text-sm text-muted-foreground">
        AI color systems from a plain-language description.
      </p>
      <code className="rounded-md border border-border px-2 py-1 font-mono text-xs text-muted-foreground">
        #0A0A0A
      </code>
    </main>
  );
}

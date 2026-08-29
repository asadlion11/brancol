<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# brancol — working notes

An AI color-system generator: a description in, a role-assigned palette out
(role + human name + HEX/RGB/HSL/OKLCH). No auth, no database. See `README.md`
for setup, env vars, the model chain and known limitations; `brancol-spec.md`
for the product spec and locked decisions.

## Commands

```bash
npm run dev            # dev server (pass PORT=… if 3000 is taken)
npm run build && npm start
npm test               # Vitest
npm run typecheck      # tsc --noEmit
npm run lint
npm run format:check
```

All five must pass before anything ships.

## Invariants — break these and the product is wrong

- **`POST /api/generate` runs in a fixed order**: method + origin guard → Zod
  validate → rate limit → prompt → model chain → repair → color completion →
  roles → contrast → response. The limiter sits ahead of the adapter because
  everything downstream of it costs money. Never reorder.
- **Hex is the source of truth.** RGB/HSL/OKLCH are always derived by
  `lib/color.ts`; never stored, never trusted from a model or a URL.
- **One Zod schema for both sides.** `lib/schemas.ts` is imported by the browser
  and re-validated by the route. It must not import `server-only` or read
  `process.env`.
- **Nothing server-only reaches the client.** `lib/env.ts` imports `server-only`;
  no variable may ever gain a `NEXT_PUBLIC_` prefix.
- **No provider text reaches a response body.** `lib/errors.ts` maps every
  failure onto the taxonomy; details are logged, never sent.
- **The model chain lives in the environment**, not in code
  (`OPENROUTER_PRIMARY_MODEL` / `OPENROUTER_FALLBACK_MODELS`). Model selection
  is a cost decision — do not change the configured values.
- **A share link is a stranger's input.** `lib/url.ts` is total: every malformed
  payload returns `null`, and the decoded palette clears the same Zod bar as an
  API response.

## Testing without the model

Both configured `:free` models draw on OpenRouter's shared pool, which is often
`429`-throttled for days at a time (see README → Known limitations). Almost
everything is still testable without it:

- 400s: Zod runs before any model call.
- 429s: the limiter runs before any model call.
- 405/403: the method and origin guards run first.
- The full UI with a real palette: load a share URL (`?p=…`, see README) — no
  AI involved.
- Failover: point `OPENROUTER_PRIMARY_MODEL` at an invalid slug for one dev
  server (inline env var, never in `.env.local`) and watch
  `[brancol:adapter]` walk the chain in the logs.

Never edit `.env.local` / `.env.production`, and never print their values.

## Product direction (updated 2026-08-29)

The UI was deliberately stripped. Do not reintroduce any of the following
without being asked — each was removed on purpose:

- **Starting colors / seeds.** Removed from the UI entirely. The target user has
  no palette to seed with, so the control asked for a decision they cannot make.
  `startingColors` still exists in the schema for API and share-link
  compatibility; nothing in the UI sets it.
- **The in-context preview**, the **footer**, the **contrast-below-AA notice**,
  the **format summary** (`N colors · HEX · RGB …`) and the **model/duration
  readout**. All gone.
- **Marketing copy.** No masthead, no lede, no empty-state guidance. The only
  `h1` is `sr-only`, kept so the document retains a heading outline.

Layout invariants:

- **One viewport, no scroll — vertical or horizontal, at any width.** The band
  rail flexes into whatever height is left; it must never carry a `min-height`.
- Below `md` a band is a single row (role, name, hex, controls) so ten colors
  stay legible on a phone. From `md` up they are full-height columns.
- A two-color system is **primary + secondary** (`ROLE_PRIORITY` in
  `lib/palette.ts`).
- The whole color field is a copy button; the lock/menu controls sit above it
  on `z-10`.

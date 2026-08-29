# brancol

**Describe your project. Get colors that work together.**

brancol is an AI color-system generator. You write a sentence about what you
are making — _"a calm wellness app, soft and unhurried"_ — and brancol returns
a complete color system: every color assigned a **role** (primary, background,
text, …), given a **name a person can say out loud**, and carrying **HEX, RGB,
HSL and OKLCH** values you can paste straight into code.

It is a single page. No accounts, no database, no saved gallery. A palette
lives in the URL — a share link carries the whole system, roles and locks
included, so sending someone a palette is sending them a link.

**What it does**

- 2–10 colors per palette, each with a role and a human name.
- Seed with up to 2 starting colors (your existing brand colors) and lock any
  color so a regenerate keeps it byte-identical.
- WCAG AA contrast audit on the role pairs that matter, shown as a note, never
  as a gate.
- Export as CSS custom properties, JSON, a Tailwind theme, or design tokens.
- Share links (`?p=…`) and last-palette restore via `localStorage`.
- Light and dark, 320px to desktop.

---

## Stack

| Piece      | Choice                                                      |
| ---------- | ----------------------------------------------------------- |
| Framework  | Next.js 16 (App Router, Turbopack), React 19                |
| Language   | TypeScript, strict                                          |
| Styling    | Tailwind CSS v4, shadcn/ui primitives                       |
| Color math | [culori](https://culorijs.org) — hex is the source of truth |
| Validation | Zod v4, one schema shared by client and server              |
| Models     | [OpenRouter](https://openrouter.ai), a configurable chain   |
| Limits     | Upstash Redis (`@upstash/ratelimit`), per IP                |
| Tests      | Vitest                                                      |
| Hosting    | Vercel                                                      |

There is exactly one API route — `POST /api/generate` — plus `GET /api/health`.

---

## Setup

Requires Node.js 20.9+ (Node 22+ recommended) and npm.

```bash
git clone <your-fork-url> brancol
cd brancol
npm install
cp .env.example .env.local
```

Then open `.env.local` and set at minimum `OPENROUTER_API_KEY`. Get a key at
<https://openrouter.ai/keys>.

### Environment variables

All five are **server-only**. None may ever be prefixed with `NEXT_PUBLIC_` —
that would ship the value to the browser. `lib/env.ts` imports `server-only`,
so an accidental client import is a build error rather than a leak.

| Variable                     | Required | Default                          | What it does                                                                               |
| ---------------------------- | -------- | -------------------------------- | ------------------------------------------------------------------------------------------ |
| `OPENROUTER_API_KEY`         | **Yes**  | —                                | Authenticates every model call. Without it the app throws on the first generation request. |
| `OPENROUTER_PRIMARY_MODEL`   | No       | `google/gemma-4-26b-a4b-it:free` | Model slug tried first.                                                                    |
| `OPENROUTER_FALLBACK_MODELS` | No       | `z-ai/glm-5.2:free`              | Comma-separated slugs tried, in order, when the primary fails.                             |
| `UPSTASH_REDIS_REST_URL`     | No\*     | —                                | Upstash Redis REST endpoint used for per-IP rate limiting.                                 |
| `UPSTASH_REDIS_REST_TOKEN`   | No\*     | —                                | Token for the same database.                                                               |

\* The Upstash pair is optional **together**: set both, or neither. Setting one
without the other is a configuration error and fails fast at startup with a
named message. Leaving both unset disables rate limiting and logs a warning —
fine locally, **not** fine in production, where `/api/generate` is the entire
attack surface and every call costs a model request.

A variable that is present but **blank** (`UPSTASH_REDIS_REST_URL=`, or an empty
box in a hosting dashboard) counts as unset rather than as an invalid value, so
a half-filled dashboard degrades to "rate limiting disabled" instead of taking
the app down. The same applies to the two model variables, which fall back to
the defaults above.

Validation is lazy and memoized: it runs on first access, not at import time,
so `next build` never fails just because a machine has no secrets configured.

---

## Running it

```bash
npm run dev          # dev server, http://localhost:3000
npm run build        # production build
npm start            # serve the production build
PORT=3111 npm start  # …on another port
```

### Checks

```bash
npm test             # Vitest — the pure layers (repair, color, roles, codecs)
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
npm run format:check # Prettier, check only
npm run format       # Prettier, write
```

All four must pass before a deploy. `npm test` is unit-level by design: it
covers everything between raw model output and the UI without touching the
network.

### Seeing the UI without a model call

A share link encodes a whole palette, so you can render the real five-band hero
with the AI out of the picture entirely — useful when the free model pool is
throttled (see Known limitations) or when you are working on layout:

```
http://localhost:3000/?p=17fa88e00bMeadow%20Sagea8c5c910cMorning%20Mistd9a59a30bSunset%20Clayf6f2eb50aWarm%20Linen3a4a4280bDeep%20Forest
```

---

## The model chain

brancol never depends on one model. `lib/ai/adapter.ts` walks an ordered chain —
primary first, then each fallback — and returns the first usable palette. A
model is abandoned on any of: HTTP error, timeout, rate limit (429), empty
response, or output the repair layer cannot turn into colors. If everything
failed for a _transient_ reason and budget remains, the chain is walked a second
time before giving up.

The chain is **read entirely from the environment**. Swapping or adding a model
is a config change and a redeploy — there is no code to touch.

### Swapping the primary model

```bash
# Any slug from https://openrouter.ai/models, copied verbatim.
OPENROUTER_PRIMARY_MODEL=vendor/some-other-model:free
```

### Adding fallbacks

Comma-separated, tried left to right. Whitespace around entries is ignored and
duplicates are dropped:

```bash
OPENROUTER_FALLBACK_MODELS=z-ai/glm-5.2:free,mistralai/mistral-small:free
```

### Adding a paid Model 3

The free pool is shared and heavily throttled. The most effective reliability
fix is a **paid model at the end of the chain**: it is only reached when both
free models have already failed, so it costs nothing on a normal request and
turns an outage into a slightly slower success.

1. Add credit to the OpenRouter account (<https://openrouter.ai/credits>) — a
   paid slug returns 402 without it.
2. Pick a slug from <https://openrouter.ai/models> (a small, fast, cheap model
   is the right shape here — one JSON palette is a few hundred output tokens).
3. Append it to the fallback list, keeping the free models in front. Copy the
   slug verbatim from the model's OpenRouter page — a wrong slug fails the
   attempt with `400 … is not a valid model ID`:

   ```bash
   # `vendor/model-slug` is a placeholder — substitute the real one.
   OPENROUTER_FALLBACK_MODELS=z-ai/glm-5.2:free,vendor/model-slug
   ```

4. Set the same value in the host's environment (on Vercel: Project →
   Settings → Environment Variables, for Production) and **redeploy** — env
   changes do not apply to an existing deployment.
5. Confirm the chain from the server logs. Each abandoned model prints one line:

   ```
   [brancol:adapter] <model-1> failed — rate_limited 429: 429 Provider returned error
   [brancol:adapter] <model-2> failed — rate_limited 429: 429 Provider returned error
   ```

   and the response body's `meta.model` names whichever model actually answered,
   with `meta.fallbackUsed: true` when it was not the primary.

Order matters and cost follows it: put free models first, paid last.

> Note the budget. One request carries a single 30s budget across every attempt
> (`maxDuration = 30` on the route). Each attempt gets a slice of what is left,
> so a chain much longer than three models mostly buys attempts too short to
> finish rather than more chances.

---

## Rate limiting

Two windows, both enforced per IP, both **before** any model call — the
ordering is the point, since everything downstream costs money:

- **Burst:** 10 requests / 60s
- **Daily backstop:** 60 requests / day

Exceeding either returns `429` with `Retry-After`, `X-RateLimit-Limit` and
`X-RateLimit-Remaining: 0`, and the UI renders it as _"Too many palettes, too
fast"_ with a working retry — deliberately distinct copy from the
model-unavailable state. If Redis is unreachable the request is allowed and the
failure is logged: the limiter must never take the product down.

---

## Deployment (Vercel)

1. Import the repository at <https://vercel.com/new>. The framework preset is
   detected; no build settings need changing.
2. Add all five environment variables under Project → Settings → Environment
   Variables (Production, and Preview if you use it). Do not commit real values
   anywhere — `.env.local` and `.env.production` are gitignored.
3. Create an Upstash Redis database (Vercel Marketplace, or upstash.com) and
   copy its **REST** URL and token into the two `UPSTASH_*` variables. Skipping
   this ships an unlimited public endpoint.
4. Deploy, then check `/api/health`.

`app/api/generate/route.ts` sets `maxDuration = 30` so the function is not cut
off mid-failover; keep that in step with the adapter's budget if you change it.

---

## Project map

```
app/
  api/generate/route.ts   the only operation: method+origin guard → Zod →
                          rate limit → prompt → model chain → repair →
                          color completion → roles → contrast → response
  api/health/route.ts     liveness
  page.tsx, layout.tsx    the single page
components/palette/       the hero: bands, composer, export dialog, actions
lib/
  ai/                     adapter (failover), openrouter client, repair
  env.ts                  Zod-validated, server-only environment
  ratelimit.ts            Upstash sliding windows
  schemas.ts              one Zod source of truth, client + server
  color.ts contrast.ts    culori math, WCAG ratios
  palette.ts variants.ts  role assignment, normalization, dark-mode variants
  url.ts storage.ts       share-link codec, localStorage snapshot
  export/                 CSS / JSON / Tailwind / tokens serializers
  __tests__/              Vitest suites
```

---

## Known limitations

**The free model pool is unreliable, and it is the default configuration.**
Both models brancol ships with are OpenRouter `:free` slugs, which draw on a
shared pool. That pool frequently answers `429 "temporarily rate-limited
upstream, retry shortly"` regardless of your own account usage — this is the
provider's capacity, not your quota, and it has been observed to persist for
days at a time. When it happens every model in the chain fails the same way and
the API returns `503 UPSTREAM_UNAVAILABLE` with _"The color model is
unreachable"_. Nothing is broken; there is simply no free capacity. The fix is
[a paid Model 3](#adding-a-paid-model-3) at the end of the chain — that is the
one change that makes generation dependable.

**Other things to know**

- **No persistence beyond the browser.** No accounts, no server-side storage.
  A palette survives in a share link and in `localStorage`; clear the browser
  and it is gone.
- **A generation takes 7–17s** on a good day, and up to 30s when the chain has
  to fail over. There is no streaming — the palette arrives whole.
- **Rate limits are per IP.** Shared offices and mobile carrier NAT share a
  bucket, so a colleague can consume your burst window.
- **The contrast audit is advisory.** brancol reports AA failures on the role
  pairs it can judge and never refuses to return the palette you asked for.
- **Model output is repaired, not trusted.** Missing roles, prose around the
  JSON and short palettes are all handled, but a model can still return colors
  that are merely competent rather than good. Regenerate and lock what you like.
- **The export dialog's code block overflows its panel at 320px.** The tokens
  are still copyable and downloadable; only the preview is clipped. Known,
  tracked, cosmetic.
- Out of scope by design: accounts, a saved-palette gallery, a Figma plugin,
  image color extraction, a public API, i18n, and streaming.

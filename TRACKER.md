# brancol — Build Tracker

> **Single source of truth for the build.** Status here overrides status claimed anywhere else.
> Scope comes from `brancol-spec.md` v1.0. Rationale lives in `PLAN.md`.
> Every status change requires a row in §6 Change Log.

---

## 1. Status Summary

**Overall progress: 1 / 89**

| Phase | Name | Done / Total | Status |
|---|---|---|---|
| 0 | Infrastructure & setup | 1 / 11 | doing |
| 1 | Design system & tokens | 0 / 12 | todo |
| 2 | AI service layer (backend) | 0 / 15 | todo |
| 3 | Core generation UI | 0 / 12 | todo |
| 4 | Palette interactions | 0 / 9 | todo |
| 5 | Export & persistence | 0 / 11 | todo |
| 6 | Preview, motion & polish | 0 / 9 | todo |
| 7 | Hardening, testing & deployment | 0 / 10 | todo |

**Acceptance checklist: 0 / 24 verified.**

**Rules**
- A phase stays `todo` until **every** task inside it is `done`. There is no "mostly done".
- A phase may show `doing` once ≥1 task in it is `doing` or `done`; it flips to `done` only at 100%.
- Acceptance items (§4) are **not** tasks and cannot be ticked until the application physically exists,
  is deployed, and the stated verification has actually been run.

---

## 2. Locked Decisions (Immutable)

These are settled. They came from an approved spec. **Do not relitigate them during the build.** A change to any
row requires an explicit written decision from the spec author, logged in §6 — not a mid-task judgment call.

| # | Decision | Locked value |
|---|---|---|
| L1 | Framework | **Next.js (App Router) + TypeScript** |
| L2 | Styling | **Tailwind CSS** |
| L3 | Components | **shadcn/ui** (Radix primitives, copy-in). No second component library. |
| L4 | Color math | **culori** — no hand-rolled color conversion |
| L5 | Validation | **Zod**, one shared schema module for client + server |
| L6 | Fonts | **Poppins** (display + body), **JetBrains Mono** (HEX/code values only) |
| L7 | Backend style | **Next.js Route Handlers**, Node runtime, serverless on Vercel. No dedicated server. |
| L8 | Database | **None.** localStorage + URL state only. |
| L9 | Auth | **None, by design.** No accounts, sessions, OAuth, or JWT. |
| L10 | AI gateway | **OpenRouter**, server-side only |
| L11 | Primary model | **`google/gemma-4-26b-a4b-it:free`** (Model 1) |
| L12 | Fallback model | **`z-ai/glm-5.2:free`** (Model 2). Order: Model 1 → Model 2 → optional paid Model 3. |
| L13 | Model abstraction | Ordered, **config-driven** adapter list via env. Adding/reordering models is an env change, never a rewrite. |
| L14 | AI output contract | Model returns **`{role, name, hex}` only**. Server derives RGB/HSL/OKLCH via culori. |
| L15 | Output format | **Strict JSON**, schema-enforced, server-validated, repaired or rejected |
| L16 | Rate limiting | **Upstash Redis** (`@upstash/ratelimit`), per-IP, on `/api/generate` |
| L17 | Secret handling | `OPENROUTER_API_KEY` is **server-only**. Never `NEXT_PUBLIC_*`, never in a response. |
| L18 | API style | **REST**, not GraphQL. `POST /api/generate`, `GET /api/health`. |
| L19 | Deployment | **Vercel** |
| L20 | Visual direction | **Swiss minimal**; the generated palette is **the hero** (full-height color bands). Brand tokens per spec §7 are fixed. |
| L21 | Motion | **One** deliberate moment (staggered band reveal) + copy toasts. Respect `prefers-reduced-motion`. No ambient animation. |
| L22 | Count range | **2–10** colors. Starting colors **0–2**. |

---

## 3. Task Breakdown

Status values: `todo` · `doing` · `done` · `blocked`.

### Phase 0 — Infrastructure & setup (0 / 11)

| ID | Title | Status | Deps | Notes |
|---|---|---|---|---|
| P0-T1 | Initialize Next.js project with TypeScript (App Router) | **done** | — | `npx create-next-app@latest brancol --ts --app --eslint --src-dir=false`. Confirm App Router, not Pages. |
| P0-T2 | Configure Tailwind CSS and `globals.css` base layer | todo | P0-T1 | Scaffold already installed Tailwind **v4** + `@tailwindcss/postcss`. Task reduces to: verify a utility renders, establish the base layer, and strip the scaffold's placeholder Geist theme vars. |
| P0-T3 | Initialize shadcn/ui | todo | P0-T2 | `npx shadcn@latest init`. Set `components/ui` alias. Copy-in only — no wrapper library. |
| P0-T4 | Wire Poppins + JetBrains Mono via `next/font` | todo | P0-T1 | Poppins 400/500/600/700; Mono 400/500. Expose as `--font-sans` / `--font-mono` CSS vars. **Must remove the scaffold's Geist/Geist_Mono** from `app/layout.tsx` and the `@theme` block in `globals.css` — Poppins is brand-pinned (L6). |
| P0-T5 | ESLint + Prettier + format/lint scripts | todo | P0-T1 | Add `lint`, `format`, `typecheck` npm scripts. |
| P0-T6 | Install core dependencies | todo | P0-T1 | `culori`, `zod`, `@upstash/ratelimit`, `@upstash/redis`, `server-only`. |
| P0-T7 | Env scaffolding: `.env.example` + typed `lib/env.ts` | todo | P0-T6 | Vars: `OPENROUTER_API_KEY`, `OPENROUTER_PRIMARY_MODEL`, `OPENROUTER_FALLBACK_MODELS`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`. Zod-parse at boot; fail loudly. |
| P0-T8 | Git repo, `.gitignore`, initial commit | todo | P0-T1 | **BLOCKING SECURITY GATE.** Next.js's default `.gitignore` covers `.env*.local` but **NOT** `.env.production` or `.deploy.local` — both now hold live secrets. Add explicit rules for both, then prove it: `git check-ignore -v .env.local .env.production .deploy.local` must return all three, and `git status --porcelain` must show none of them, **before** the first commit. Remote: `git@github.com:asadlion11/brancol.git` (verified reachable, empty). |
| P0-T9 | Create Vercel project and set env vars | todo | P0-T8 | Non-interactive via `VERCEL_TOKEN` from `.deploy.local` (verified live). Push the 5 app vars from `.env.production` to Preview + Production. None prefixed `NEXT_PUBLIC_`. **Do not** upload `VERCEL_TOKEN` itself as a project env var. |
| P0-T10 | Establish folder structure + path aliases | todo | P0-T3 | `app/`, `components/ui`, `components/palette`, `lib/`, `lib/ai`, `lib/export` per `PLAN.md` §4. |
| P0-T11 | `GET /api/health` route handler | todo | P0-T7 | Returns `{ status, model }` where `model` is the configured primary. Smoke-test target for every later phase. |

### Phase 1 — Design system & tokens (0 / 12)

| ID | Title | Status | Deps | Notes |
|---|---|---|---|---|
| P1-T1 | Define brand CSS custom properties (light + dark) | todo | P0-T2 | Spec §7: `--brand-primary #6C4CF1`, `--brand-secondary #211A45`, `--brand-accent #52E3B6`, `--bg-light #F8F9FC`, `--bg-dark #0F1020`, `--reversed #FFFFFF`. |
| P1-T2 | Map tokens into Tailwind theme | todo | P1-T1 | **Tailwind v4 — CSS-first.** There is no `tailwind.config.ts`. Register tokens in the `@theme` block of `app/globals.css` (e.g. `--color-brand-primary: var(--brand-primary);`), which generates `bg-brand-primary` etc. One definition, not two. |
| P1-T3 | Derive neutral gray ramp 50–900 | todo | P1-T1 | For hairlines, borders, muted text. Derive with culori from `--brand-secondary` for a tuned (non-pure) gray. Emit as static CSS vars in `@theme` (Tailwind v4) — do not compute at runtime. |
| P1-T4 | Type scale + display/body/mono utilities | todo | P0-T4 | Few sizes, strong weight contrast, tight tracking on display. Mono restricted to HEX/code. |
| P1-T5 | Swiss grid primitives: `Container`, `Grid`, `Hairline` | todo | P1-T2 | 12-column, generous whitespace, left-aligned, asymmetric. |
| P1-T6 | `Button` component (primary / ghost / icon) | todo | P1-T2 | shadcn base, brand-tokenized. Radius ≈8px. |
| P1-T7 | `Textarea` + `Input` components | todo | P1-T2 | Includes invalid/disabled states used later by hex editing. |
| P1-T8 | Count control (2–10) component | todo | P1-T6 | Stepper or segmented control; clamps at both ends; keyboard arrows work. |
| P1-T9 | Toast system | todo | P1-T2 | shadcn/sonner. Message format: `Copied #6C4CF1`. |
| P1-T10 | Theme provider + light/dark toggle | todo | P1-T1 | Class-based dark mode, no flash on load, respects system preference. |
| P1-T11 | Global focus-visible ring + reduced-motion baseline | todo | P1-T2 | Visible ring on **every** interactive element (A.18). `@media (prefers-reduced-motion: reduce)` kill-switch. |
| P1-T12 | App shell: header with lowercase wordmark, footer, main | todo | P1-T5 | Quiet chrome — the hero is the product, not the nav. |

### Phase 2 — AI service layer (backend) (0 / 15)

| ID | Title | Status | Deps | Notes |
|---|---|---|---|---|
| P2-T1 | Shared Zod schemas in `lib/schemas.ts` | todo | P0-T6 | `GenerateRequest` (description ≤ cap, `count` 2–10, `startingColors` ≤2 hex regex, `lockedColors`), `AIColor`, `PaletteResponse`. Imported by client **and** server. |
| P2-T2 | Types in `lib/types.ts` | todo | P2-T1 | `Role` union of the 14 roles in spec §4.3; `Color`; `PaletteMeta` (model used, duration, fallback flag). |
| P2-T3 | Prompt builder `lib/prompt.ts` | todo | P2-T2 | Injects description, count, starting colors, locked colors. Embeds a strict JSON schema and a "no generic names" rule (no `Color 01`, `Blue 500`). Escapes user text — it is data, not instructions. |
| P2-T4 | OpenRouter transport `lib/ai/openrouter.ts` | todo | P0-T7 | `server-only` import at top. `fetch` + per-attempt `AbortController`. Budget: ~12s attempt 1, remainder of the 30s to attempt 2. |
| P2-T5 | Model adapter with ordered failover `lib/ai/adapter.ts` | todo | P2-T4 | Reads primary + `OPENROUTER_FALLBACK_MODELS` (comma-separated). Falls through on HTTP error, timeout, rate limit, empty/invalid JSON. Returns which model answered. Paid Model 3 slot must work with zero code change. |
| P2-T6 | JSON extraction + repair `lib/ai/repair.ts` | todo | P2-T1 | Strip code fences/prose, find outermost object, fix trailing commas, coerce 3-digit hex to 6, drop extra keys. Fail → signal the adapter to fall through. |
| P2-T7 | Color completion with culori `lib/color.ts` | todo | P0-T6 | HEX → `rgb(…)`, `hsl(…)`, `oklch(…)` strings exactly as spec §4.3. Model-supplied non-hex fields are discarded. |
| P2-T8 | WCAG contrast utilities | todo | P2-T7 | Contrast ratio + AA pass/fail; `bestForeground(bg)` returning the higher-contrast of ink/reversed. |
| P2-T9 | Role assignment & normalization | todo | P2-T2 | Coerce unknown roles into the allowed union, de-duplicate, guarantee a `primary`, scale role mix sensibly for count 2 vs 10. |
| P2-T10 | `POST /api/generate` route handler | todo | P2-T5, P2-T6, P2-T9 | Order: Zod → rate limit → prompt → adapter → repair → complete → contrast → typed `PaletteResponse`. Node runtime. **Must `export const maxDuration = 30`** — Vercel's default is below 30s, so A.11's timeout+failover budget is unreachable without it (Fluid compute allows up to 300s on Hobby). |
| P2-T11 | Upstash per-IP rate limiter | todo | P0-T7 | Sliding window. IP from `x-forwarded-for` first entry. Enforced **before** any AI call. 429 + `Retry-After`. |
| P2-T12 | Error taxonomy + friendly messages | todo | P2-T10 | `INVALID_INPUT` 400, `RATE_LIMITED` 429, `UPSTREAM_UNAVAILABLE` 503, `TIMEOUT` 504. Never leak provider errors or the key. |
| P2-T13 | Locked-color preservation through regeneration | todo | P2-T3, P2-T10 | Locked colors go into the prompt as fixed anchors *and* are re-injected server-side after parsing — the model is not trusted to echo them byte-for-byte. |
| P2-T14 | Unit tests: repair, completion, role normalization | todo | P2-T6, P2-T7, P2-T9 | Fixtures: fenced JSON, JSON+prose, trailing comma, 3-digit hex, missing role, wrong count, garbage. This is the guard for A.9. |
| P2-T15 | Method guards, same-origin check, restrictive CORS | todo | P2-T10 | Reject non-POST; no wildcard `Access-Control-Allow-Origin`. |

### Phase 3 — Core generation UI (0 / 12)

| ID | Title | Status | Deps | Notes |
|---|---|---|---|---|
| P3-T1 | Palette client state container | todo | P1-T12, P2-T2 | `useReducer` over `{ status, palette, meta, error, input }`. Single owner of palette state — no scattered `useState`. |
| P3-T2 | Description textarea with cap + counter | todo | P1-T7, P2-T1 | Same cap as the server schema, imported not retyped. Empty state copy invites a description. |
| P3-T3 | Count selector wired to state | todo | P1-T8 | Default 5 (per persona journeys). |
| P3-T4 | Starting colors input (0–2) | todo | P1-T7, P2-T7 | Hex text + native swatch, live validation, live preview chip, removable. |
| P3-T5 | Generate button + submit flow + client-side Zod | todo | P3-T2, P3-T3, P3-T4 | Label: **Generate palette**. Disabled while pending; no double-submit. |
| P3-T6 | Typed API client `lib/api.ts` | todo | P2-T10 | `POST /api/generate`, parses with `PaletteResponse` schema, maps error codes to UI messages. |
| P3-T7 | Palette hero — full-height vertical bands (desktop) | todo | P3-T1 | The signature element. Bands fill the viewport; count 2–10 all look deliberate. |
| P3-T8 | Band content: role · name · HEX | todo | P3-T7, P1-T4 | HEX in JetBrains Mono. Role and name in Poppins. |
| P3-T9 | Per-band foreground from contrast | todo | P3-T8, P2-T8 | Never hardcode white — compute against each band's own color. |
| P3-T10 | Loading state: progressive skeleton bands | todo | P3-T7 | Covers the free-model latency window; must not shift layout when real bands arrive. |
| P3-T11 | Empty state | todo | P3-T7 | An invitation to describe a project, not a blank canvas (spec §7). |
| P3-T12 | Error state + retry | todo | P3-T6, P2-T12 | Distinct copy for rate-limited vs upstream-down vs timeout. Retry preserves input. |

### Phase 4 — Palette interactions (0 / 9)

| ID | Title | Status | Deps | Notes |
|---|---|---|---|---|
| P4-T1 | Copy HEX + toast | todo | P3-T8, P1-T9 | `navigator.clipboard`; toast reads `Copied #6C4CF1`. |
| P4-T2 | Copy RGB / HSL / OKLCH | todo | P4-T1 | Small menu per band. Each entry copies the exact server-computed string. |
| P4-T3 | Lock toggle per color | todo | P3-T1 | `locked` on the `Color` object; obvious visual state; label **Lock color**. |
| P4-T4 | Regenerate preserving locks | todo | P4-T3, P2-T13 | Sends `lockedColors`; only unlocked bands change. Locked bands must not even re-animate. |
| P4-T5 | Add / remove a color | todo | P3-T1 | Clamped to 2–10; keeps count control in sync. |
| P4-T6 | Manual HEX edit inline | todo | P4-T1, P2-T7 | On commit, recompute RGB/HSL/OKLCH and contrast client-side via the same `lib/color.ts`. |
| P4-T7 | Consolidate per-color actions into the reducer | todo | P4-T1…T6 | One action set: `copy`, `lock`, `edit`, `add`, `remove`, `regenerate`. No duplicated mutation paths. |
| P4-T8 | Full keyboard operation of band actions | todo | P4-T7, P1-T11 | Tab reaches every action; Enter/Space activate; focus never trapped in the hero. |
| P4-T9 | Contrast warning flags | todo | P2-T8, P4-T7 | Flag text/background pairs failing WCAG AA. A warning, never a blocker. |

### Phase 5 — Export & persistence (0 / 11)

| ID | Title | Status | Deps | Notes |
|---|---|---|---|---|
| P5-T1 | CSS variables exporter | todo | P4-T7 | `:root { --color-primary: #…; }` — role-named, with a dark-mode block from P5-T10. |
| P5-T2 | JSON exporter | todo | P4-T7 | Full `Color[]` including all four formats. |
| P5-T3 | Tailwind config exporter | todo | P5-T2 | `theme.extend.colors` snippet that pastes in and parses with zero edits (A.6). |
| P5-T4 | Design-token exporter (Figma-compatible) | todo | P5-T2 | W3C design-token shape. Export only — **no Figma plugin** (spec §9). |
| P5-T5 | Export dialog: tabbed, copy + download | todo | P5-T1…T4, P1-T9 | Code shown in JetBrains Mono. Label: **Export tokens**. |
| P5-T6 | localStorage persistence of palette + locks | todo | P4-T7 | Versioned key (`brancol.palette.v1`); ignore and discard unparseable payloads. |
| P5-T7 | Hydration-safe restore on return | todo | P5-T6 | Restore after mount only. No SSR/client mismatch, no flash of empty state into filled state. |
| P5-T8 | Palette ↔ URL encoding | todo | P4-T7 | Compact: hex without `#`, role as index. Must stay a sane length at count = 10. |
| P5-T9 | Share link button + copy toast | todo | P5-T8 | Opening the link reproduces the palette **exactly**, including roles and names (A.8). |
| P5-T10 | Light/dark variant derivation | todo | P2-T7, P1-T10 | Derive a compatible counterpart set with culori (lightness/chroma mapping), not a naive invert. |
| P5-T11 | Export tests — outputs parse without edits | todo | P5-T1…T4 | Parse the CSS, JSON, and Tailwind output programmatically in a test. Directly backs A.6. |

### Phase 6 — Preview, motion & polish (0 / 9)

| ID | Title | Status | Deps | Notes |
|---|---|---|---|---|
| P6-T1 | Sample UI preview component | todo | P4-T7 | Nav, buttons, card, body text, muted text — driven entirely by the generated roles. |
| P6-T2 | Preview light/dark switch | todo | P6-T1, P5-T10 | Judges the palette in both modes (Yusuf's journey). |
| P6-T3 | Staggered band reveal animation | todo | P3-T7 | The one deliberate motion moment. CSS only; no animation library. |
| P6-T4 | `prefers-reduced-motion` disables the reveal | todo | P6-T3, P1-T11 | Bands appear instantly and correctly — not a degraded layout (A.20). |
| P6-T5 | Responsive pass 320px → desktop | todo | P3-T7, P6-T1 | Bands stack horizontally on mobile, run vertical on desktop (A.17). No horizontal page scroll. |
| P6-T6 | Focus order, skip link, ARIA labels | todo | P4-T8 | Landmarks; each band action has an accessible name including its color's name. |
| P6-T7 | Toast/live-region announcements | todo | P1-T9 | `aria-live` for copy confirmations and generation completion. |
| P6-T8 | Metadata, favicon, OG image, wordmark | todo | P1-T12 | Lowercase `brancol` wordmark. OG image reflects the band motif. |
| P6-T9 | Initial-JS and LCP pass | todo | P6-T5 | Server components where possible; audit bundle; the hero shell must not wait on client JS. |

### Phase 7 — Hardening, testing & deployment (0 / 10)

| ID | Title | Status | Deps | Notes |
|---|---|---|---|---|
| P7-T1 | Verify rate limiting end-to-end + 429 UI | todo | P2-T11, P3-T12 | Burst the endpoint; confirm 429, `Retry-After`, and a friendly (non-scary) UI message. |
| P7-T2 | Secret audit | todo | P0-T9 | Grep the built client bundle and every API response for the key and for `OPENROUTER`. Must be absent (A.11). |
| P7-T3 | Input edge/fuzz tests against `/api/generate` | todo | P2-T15 | count 1/11/`"5"`/NaN, 3 starting colors, malformed hex, oversized description, prompt-injection strings in the description. |
| P7-T4 | Performance pass — p50 < 10s, LCP < 2.5s mobile | todo | P6-T9 | Lighthouse mobile + 10 timed generations for p50. If p50 misses, flip `OPENROUTER_PRIMARY_MODEL` (env change, per L13). |
| P7-T5 | Cross-browser / device QA | todo | P6-T5 | Safari, Chrome, Firefox; iOS Safari at 320px. Clipboard API behavior on iOS specifically. |
| P7-T6 | Fallback + timeout simulation | todo | P2-T5 | Force Model 1 to fail (bad model id / forced timeout) and confirm Model 2 answers invisibly (A.10). Document the paid-Model-3 procedure for R1. |
| P7-T7 | README + usage docs | todo | P0-T7 | Setup, the five env vars, local run, deploy, model-swap instructions, known free-tier quota risk. |
| P7-T8 | Production deploy to Vercel | todo | P7-T1…T7 | Confirm HTTPS, env vars present in Production, `/api/health` returns the expected model. |
| P7-T9 | Post-deploy smoke test | todo | P7-T8 | Generate at count 2, 5, and 10 on the production URL; copy, lock, regenerate, export, share-link round-trip. |
| P7-T10 | Acceptance checklist walkthrough (A.1–A.24) | todo | P7-T9 | Run every item in §4 against production. Log each verdict in §6 with a date. |

---

## 4. Acceptance Checklist (judge / QA criteria)

**These are not tasks.** They cannot be ticked until the application physically exists, is deployed, and each
listed verification has actually been performed against the production URL. Source: spec §8.

### Functionality
- [ ] **A.1** — A palette can be generated at **any count 2–10** from a text description.
- [ ] **A.2** — Every color has a valid HEX, a role, and a non-generic human name (no "Color 01", no "Blue 500").
- [ ] **A.3** — Starting colors (0–2) are respected and preserved in the output.
- [ ] **A.4** — Locked colors survive regeneration; only unlocked colors change.
- [ ] **A.5** — Copy HEX / RGB / HSL / OKLCH each place the correct value on the clipboard.
- [ ] **A.6** — Export produces valid CSS variables, JSON, and Tailwind config that parse **without edits**.
- [ ] **A.7** — Last palette + locks restore from localStorage on return.
- [ ] **A.8** — A shareable link reproduces the exact palette on open.
- [ ] **A.9** — Malformed AI output never reaches the UI — it is repaired, retried, or falls back.

### Performance
- [ ] **A.10** — Fallback from Gemma 4 (Model 1) to GLM 5.2 (Model 2) is automatic and invisible to the user.
- [ ] **A.11** — p50 first palette < **10s**; hard timeout at **30s** triggers the fallback, then a friendly error.
- [ ] **A.12** — Frontend **LCP < 2.5s** on a mid-tier mobile device; initial JS is lean.

### Security
- [ ] **A.13** — `OPENROUTER_API_KEY` appears in **no** client bundle and **no** network response.
- [ ] **A.14** — `/api/generate` enforces per-IP rate limiting and rejects abusive traffic.
- [ ] **A.15** — All input is Zod-validated server-side (count range, description cap, HEX format).
- [ ] **A.16** — API is same-origin with restrictive CORS; HTTPS enforced.

### Responsiveness & Accessibility
- [ ] **A.17** — Fully usable from 320px mobile to desktop; bands stack on mobile, run vertical on desktop.
- [ ] **A.18** — Visible keyboard focus on every interactive element; full keyboard operation.
- [ ] **A.19** — Contrast warnings surface when a text/background pair fails WCAG AA.
- [ ] **A.20** — `prefers-reduced-motion` disables the reveal animation.
- [ ] **A.21** — Light and dark modes both render correctly.

### Build integrity
- [ ] **A.22** — `GET /api/health` returns `{ status, model }` in production.
- [ ] **A.23** — README enables a stranger to clone, configure five env vars, and run the app.
- [ ] **A.24** — No item from §5 Out of Scope exists in the shipped codebase.

---

## 5. Out of Scope

Explicitly **not** built in this cycle. Adding any of these without a logged decision is scope violation, not
initiative — even if it "only takes an hour."

- Authentication, accounts, sessions, OAuth, JWT.
- Any server-side user database or persisted user data.
- Saved-palette gallery or cloud sync across devices.
- Team collaboration, sharing permissions, comments.
- Payments, billing, subscriptions.
- A native Figma plugin. *(Figma-compatible token **export** is in scope — P5-T4. The plugin is not.)*
- Image-based color extraction; video input.
- A public or third-party API.
- Multi-language UI.
- Streaming generation. *(Deferred performance optimization, per spec §3.4.)*
- Short-link service or server-side share storage. *(Share links are URL-encoded and stateless — P5-T8.)*

---

## 6. Change Log

Every status change, decision, deviation, or blocker gets a row. Newest last.

| Date | ID / Area | Change | By | Notes |
|---|---|---|---|---|
| 2026-08-26 | — | Tracker created from `brancol-spec.md` v1.0 | PM/Tech Lead | 89 tasks across phases 0–7; 24 acceptance criteria; all `todo`, 0 done. |
| 2026-08-27 | L11 / L12 | **Verified, no change.** Both locked model IDs exist on OpenRouter | Orchestrator | `google/gemma-4-26b-a4b-it:free` and `z-ai/glm-5.2:free` both present in the live model list (417 models). Risk R2 de-risked pre-build. |
| 2026-08-27 | P2-T10 | Added `maxDuration = 30` requirement | Orchestrator | Vercel default function duration is below 30s; A.11's timeout→failover budget is unreachable without an explicit export. Fluid compute permits up to 300s on Hobby, so 30s is safe on a free plan. |
| 2026-08-27 | P0-T8 | **Escalated to blocking security gate** | Orchestrator | `.env.production` (created at user request) and `.deploy.local` hold live secrets and are **not** matched by Next.js's default `.env*.local` ignore rule. Explicit ignore rules + `git check-ignore` proof now required before the first commit. |
| 2026-08-27 | P0-T9 | Deployment made non-interactive | Orchestrator | `VERCEL_TOKEN` supplied and verified (auth 200, user `asadlion11`), removing the interactive-login blocker for P0-T9 and P7-T8. Unattended end-to-end build is now possible. |
| 2026-08-27 | Credentials | All three live-tested OK | Orchestrator | OpenRouter 200 (free tier, usage 0) · Upstash 200 `PONG` · Vercel 200. Values normalized (wrapping quotes stripped). `.env.production` created with 5 app vars, parity-checked against `.env.local`; `VERCEL_TOKEN` deliberately excluded from production runtime. |
| 2026-08-27 | R1 | Free-tier quota risk **confirmed live** | Orchestrator | OpenRouter reports `is_free_tier: true`. Both models draw on the shared account-wide daily free quota, so M1→M2 failover does not protect against exhaustion. Paid Model 3 slot remains empty; documented in P7-T6. |
| 2026-08-27 | Spec gaps | Defaults locked | Orchestrator | Description cap **500 chars**; rate limit **10 req/60s** + **60/day** per IP; **npm**; **Vitest**; scaffold in place; default count **5**; Vercel project `brancol`; type-only wordmark. |
| 2026-08-27 | Process | Per-task git workflow adopted | Orchestrator | Branch `task/<ID>-<slug>` → commit → push → `merge --no-ff` to `main` → push → delete branch (local+remote). `TRACKER.md` updated every task; `README.md`/`CLAUDE.md` updated only when a task changes what they document. |
| 2026-08-27 | P0-T1 | **done** — Next.js scaffolded in place | Orchestrator | Next **16.3.3**, React **19.2.8**, Tailwind **v4**, ESLint 9, TS 5. App Router, no `src/`, alias `@/*`. `npx tsc --noEmit` exit 0; `npm run build` succeeded (4 static routes); 0 vulnerabilities. Scaffolded with `--disable-git`. |
| 2026-08-27 | P0-T1 | Scaffold required parking the planning docs | Orchestrator | `create-next-app` refuses **any** non-empty directory (not just conflicting filenames). `PLAN.md`/`TRACKER.md`/`brancol-spec.md` were moved out and restored after. No content lost. |
| 2026-08-27 | Security | Secret files moved out of repo before scaffold | Orchestrator | `create-next-app` runs `git init` + an initial commit by default; its ignore rules would not have covered `.deploy.local`. Files parked outside the project and `--disable-git` used. Restored by P0-T8 only after ignore rules are proven. |
| 2026-08-27 | P1-T2 / P1-T3 / P0-T2 | **Amended for Tailwind v4** | Orchestrator | v4 is CSS-first: no `tailwind.config.ts`. Tokens register in the `@theme` block of `globals.css`. The v3-era `theme.extend.colors` instruction was wrong and would have misled the Phase 1 subagent. L2 (Tailwind) is unchanged. |
| 2026-08-27 | P0-T4 | Amended — scaffold ships Geist | Orchestrator | Next 16 scaffolds Geist/Geist_Mono in `layout.tsx` + `@theme`. P0-T4 must remove them; Poppins is brand-pinned per L6. |
| | | | | |

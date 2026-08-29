# brancol — Technical Specification

> **Single Source of Truth** for the brancol build. All planning, estimation, and implementation should defer to this document.

| Field | Value |
|---|---|
| Product | **brancol** — AI color-system generator |
| Author | Mohamed Abdiaziz Aweis |
| Version | 1.0 |
| Status | Approved for build |
| Last updated | 2026-08-26 |
| Deployment target | Vercel (serverless) |

---

## 1. Executive Summary

**Vision.** brancol turns a plain-language description of a project into a complete, practical, role-based color system — not a bag of random swatches. A user describes what they're building, optionally seeds one or two colors, picks how many colors they need (2–10), and brancol returns a harmonious palette where every color has a **semantic role** (primary, accent, surface, text…), a **human-friendly name**, and full **HEX / RGB / HSL / OKLCH** values.

**Core value proposition.** *Generate colors that work together.* The differentiator is not "an AI that outputs hex codes" — it's that every output is a **usable design system**: role-assigned, contrast-aware, light/dark-ready, and exportable straight into code (CSS, Tailwind, JSON, design tokens).

**Target market.** Solo designers and freelancers, frontend developers and indie hackers, and non-designer startup founders who need a trustworthy visual identity fast. brancol is deliberately **no-login, single-purpose, and instant** — no onboarding, no accounts, no project management.

**Name.** brancol = **Bran**d + **Col**or. The lowercase wordmark signals a simple, modern, SaaS identity.

---

## 2. User Personas & Journeys

### 2.1 Persona A — "Layla," the freelance designer
- **Context:** Juggles several client brands; needs a defensible palette in minutes, not an afternoon of manual matching.
- **Goal:** A harmonious, professional palette she can present and refine.
- **Journey:**
  1. Lands on brancol, types *"calm wellness app, soft and trustworthy."*
  2. Sets count = 5, leaves starting colors empty, hits **Generate palette**.
  3. Reviews roles + names, **locks** the two she loves, **regenerates** the rest.
  4. Copies HEX values into her mockup and moves on.

### 2.2 Persona B — "Yusuf," the frontend developer / indie hacker
- **Context:** Shipping a side project solo; design is the bottleneck.
- **Goal:** Drop-in tokens he can paste into code without touching a design tool.
- **Journey:**
  1. Describes *"developer tooling dashboard, dark, technical, high-contrast."*
  2. Seeds his existing brand color as a starting color; count = 8.
  3. Checks the **UI preview** to confirm buttons/text/surfaces read well.
  4. **Exports Tailwind config + CSS variables**, pastes into his repo.

### 2.3 Persona C — "Amina," the non-designer founder
- **Context:** Building a healthcare platform; no design background; wants to look credible.
- **Goal:** A trustworthy brand palette she can hand to a developer.
- **Journey:**
  1. Types *"modern healthcare platform — professional, trustworthy, clean."*
  2. Accepts count = 5, generates, likes the result.
  3. **Copies a shareable link** and sends it to her developer for implementation.

| Persona | Primary need | Key features used | Success signal |
|---|---|---|---|
| Layla (designer) | Speed + harmony | Generate, Lock, Regenerate | Palette approved in < 3 min |
| Yusuf (developer) | Exportable tokens | Starting color, UI preview, Export | Pastes tokens, zero manual edits |
| Amina (founder) | Trust + simplicity | Generate, Share link | Sends a usable palette to dev |

---

## 3. Technical Stack

> Principle: **thin, serverless, single-purpose.** A minimal Next.js backend exists only to protect secrets and orchestrate the AI call. There is no user database and no authentication.

### 3.1 Frontend

| Choice | Selection | Justification |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | SSR/edge-ready, colocated API Route Handlers remove the need for a separate backend service, strong typing across the client↔server boundary. |
| Styling | **Tailwind CSS** | Token-first utility model maps cleanly onto a design-token product; fast to build the Swiss-minimal grid. |
| Components | **shadcn/ui** (Radix primitives) | Accessible, unstyled-by-default, copy-in components — no heavy library lock-in; matches "reusable components, no mixed components" requirement. |
| Color math | **culori** (or `colord`) | Native OKLCH support plus HEX/RGB/HSL conversion and WCAG contrast utilities — avoids reimplementing color science. |
| Fonts | **Poppins** (display + body), **JetBrains Mono** (utility, for HEX/token values) | Poppins is brand-pinned. A monospace utility face is added *only* for hex codes and code exports — it improves legibility of values and reinforces the "developer-friendly" brand trait. |
| Validation | **Zod** | Shared schema validates form input on the client and the request body on the server. |

### 3.2 Backend

| Choice | Selection | Justification |
|---|---|---|
| Runtime | **Next.js Route Handlers** (`app/api/*`), Node runtime | Keeps the OpenRouter key server-side. No dedicated server, no container ops — deploys as serverless functions on Vercel. This is the "backend" that holds secrets, exactly as required. |
| Style | **Serverless functions** (not a dedicated always-on server) | Traffic is bursty and stateless; per-request functions are cheaper and simpler than a managed server. |
| Rate limiting | **Upstash Redis** rate limiter (`@upstash/ratelimit`) | Because there is no auth, the generate endpoint must be abuse-protected per IP. Serverless-friendly, no infra to run. |

### 3.3 Database

| Choice | Selection | Justification |
|---|---|---|
| MVP | **None** | No accounts, no server-side persistence. State lives in **localStorage** (last palette, locked colors) and in **shareable URLs** (palette encoded in the query string). This keeps the app simple and login-free. |
| Optional future | Vercel KV / Upstash Redis (KV) | Only if a saved-palette gallery or short-link service is added later (see Out of Scope). Would be key-value/NoSQL — the data is document-shaped, not relational. |

### 3.4 AI Integration

| Aspect | Decision | Justification |
|---|---|---|
| Gateway | **OpenRouter** unified API (server-side only) | One integration, swappable models, OpenAI-compatible request shape. |
| Primary model (Model 1) | **`google/gemma-4-26b-a4b-it:free`** | Fast, lightweight instruction-tuned MoE — 3.8B active of 25.2B params, ~31B-class quality at a fraction of the compute, 262K context, multimodal. Chosen first for low latency and throughput. |
| Fallback model (Model 2) | **`z-ai/glm-5.2:free`** | Large-scale reasoning model, 256K context — used when Model 1 times out, errors, returns unparseable output, or is rate-limited/unavailable. |
| Order & failover | **Model 1 → Model 2.** The adapter calls Gemma first; on any failure (HTTP error, timeout, invalid/empty JSON, rate-limit) it retries the identical request against GLM 5.2. | Ox Alpha (previously specced) is no longer listed on OpenRouter — free or paid — so it has been removed entirely. |
| Abstraction | **Provider/model adapter** with an ordered model list (config-driven) | Both models are *free-tier, rate-limited* and can throttle or be delisted. The adapter tries models in order and normalizes responses, so reordering them or adding a **paid fallback** is an env-var change, not a rewrite. |
| Output format | **Strict JSON** (`response_format`-style + prompt-enforced schema) | The palette must parse deterministically into typed objects; the server validates and repairs/rejects malformed output. |
| Color completion | Server computes RGB/HSL/OKLCH from the AI's HEX | The model only needs to return `{role, name, hex}`; brancol derives the rest with `culori`, guaranteeing correct math and formats. |
| Latency target | p50 first palette **< 10s**, hard timeout **30s** → fallback model → friendly error | Reasoning models are slower; MVP uses a progressive loading state. Streaming is a later optimization. |

**Model comparison — why this order**

| Criterion | Model 1 · Gemma 4 26B A4B (free) | Model 2 · GLM 5.2 (free) |
|---|---|---|
| Type | Instruction-tuned MoE, multimodal (text/image/video) | Large-scale reasoning model, text-only |
| Active / total params | 3.8B active / 25.2B total | Large; reasoning-optimized |
| Quality (task fit) | ~31B-class; strong for its size | Higher — frontier-class reasoning & structured output |
| Latency | **Faster** (few active params) | Slower (reasoning tokens) |
| Context | 262K | 256K |
| Cost | Free | Free |
| Best as | **Primary** — quick palettes, high throughput | **Fallback** — kicks in when Gemma fails or degrades |

> **Honest tradeoff:** you've prioritized Gemma first for **speed/throughput**, which is a fine default. But GLM 5.2 is the **stronger reasoner** and will usually produce better-considered palettes and cleaner JSON. If output *quality* matters more than latency, flip the order (`OPENROUTER_PRIMARY_MODEL`) — the adapter makes this a one-line change. Consider prompting Gemma with a stricter JSON schema, since smaller models are more likely to drift from format.

> ⚠️ **Model risk (must acknowledge):** Both models are **free-tier and rate-limited**, and on OpenRouter free models share an **account-wide daily quota**. The Model 1 → Model 2 failover protects against a single model erroring or degrading — it does **not** protect against the shared free quota being exhausted (both would fail together). **Before production reliance, add a paid fallback** as Model 3 in the adapter's list. The abstraction exists precisely so this is a config change, not a rewrite.

### 3.5 Auth & Security

| Aspect | Decision | Justification |
|---|---|---|
| User auth | **None (by design)** | Product requirement: simple, frictionless, single-purpose. No accounts, no sessions, no OAuth/JWT. |
| Secret handling | `OPENROUTER_API_KEY` as a **server-only env var**; never `NEXT_PUBLIC_*`; never sent to the client | The whole reason a backend exists. The key is used exclusively inside Route Handlers. |
| Abuse protection | **Per-IP rate limiting** on `/api/generate` | No auth means the endpoint is the attack surface for cost/abuse; rate limiting is mandatory, not optional. |
| Input safety | **Zod validation** — `count` ∈ [2,10], description length cap, HEX regex on starting colors | Prevents malformed prompts, oversized inputs, and injection into the prompt template. |
| Transport | HTTPS only, same-origin API, restrictive CORS | Standard hardening for a public no-auth endpoint. |
| Privacy | No PII collected or stored | Descriptions are transient; only the generated palette persists locally on the user's device. |

---

## 4. System Architecture

### 4.1 Component overview (textual diagram)

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (client)                      │
│                                                              │
│  ┌────────────┐   ┌──────────────┐   ┌───────────────────┐   │
│  │ Input Panel│   │ Palette Hero │   │ Actions & Export  │   │
│  │ desc/count │   │ color bands  │   │ copy/lock/export  │   │
│  │ seed colors│   │ role · name  │   │ CSS/JSON/Tailwind │   │
│  └─────┬──────┘   └──────┬───────┘   └─────────┬─────────┘   │
│        │                 │                     │             │
│        │    localStorage (last palette, locks) │             │
│        │    URL state (shareable palette)      │             │
│        └────────────────┬──────────────────────┘            │
│                         │ POST /api/generate (JSON)          │
└─────────────────────────┼────────────────────────────────────┘
                          │  (same-origin, HTTPS)
┌─────────────────────────▼────────────────────────────────────┐
│              Next.js Backend (Route Handler)                  │
│                                                              │
│  Zod validate → Rate limit (Upstash) → Prompt builder →      │
│  AI Adapter [ gemma-4-26b → glm-5.2:free (→ paid fallback) ]│
│  JSON parse + repair → color-format completion (culori) →    │
│  contrast/validity checks → typed PaletteResponse            │
│                         │                                    │
│              OPENROUTER_API_KEY (server-only)                │
└─────────────────────────┼────────────────────────────────────┘
                          │  HTTPS
                ┌─────────▼─────────┐
                │   OpenRouter API  │
                │  (model routing)  │
                └───────────────────┘
```

### 4.2 Data flow (generate)

1. Client validates input (Zod), POSTs `{ description, count, startingColors?, lockedColors? }` to `/api/generate`.
2. Server re-validates, applies IP rate limit.
3. Server builds a schema-constrained prompt and calls the **AI adapter**.
4. Adapter calls Gemma 4 (Model 1); on timeout/error/invalid-JSON/limit it falls to GLM 5.2 free (Model 2).
5. Server parses JSON, repairs/validates HEX, computes RGB/HSL/OKLCH and contrast, assigns/normalizes roles.
6. Server returns a typed `PaletteResponse`; client renders the hero, persists to localStorage, and can encode to a shareable URL.

### 4.3 API design principles — **REST**

REST over GraphQL: there is essentially **one operation** (generate/regenerate a palette). GraphQL's flexible querying solves problems brancol doesn't have; REST is simpler, cacheable, and easier to rate-limit.

| Method | Route | Body / Params | Returns |
|---|---|---|---|
| `POST` | `/api/generate` | `{ description, count (2–10), startingColors?[], lockedColors?[] }` | `{ palette: Color[], meta }` |
| `POST` | `/api/generate` (regenerate) | same + `lockedColors[]` preserved | new palette around locked colors |
| `GET` | `/api/health` | — | `{ status, model }` |

```ts
type Color = {
  role: "primary" | "secondary" | "tertiary" | "accent" | "highlight"
      | "background" | "surface" | "border" | "text" | "muted"
      | "success" | "warning" | "error" | "info";
  name: string;        // "Ocean Blue"
  hex: string;         // "#1769AA"
  rgb: string;         // "rgb(23,105,170)"
  hsl: string;         // "hsl(203,76%,38%)"
  oklch: string;       // "oklch(0.52 0.11 240)"
  locked: boolean;
};
```

---

## 5. Feature Breakdown

### 5.1 Core MVP (Must-have)

| Feature | User story |
|---|---|
| Project description input | *As a user, I want to describe my project in plain language so brancol understands the context.* |
| Color count selector (2–10) | *As a user, I want to choose how many colors I need so the system fits my project.* |
| Starting colors (0–2) | *As a user, I want to seed one or two colors so the palette complements what I already have.* |
| AI palette generation | *As a user, I want a harmonious, role-assigned palette generated from my description.* |
| Role + name + HEX per color | *As a user, I want each color labeled with a role and a readable name so I know how to use it.* |
| Copy HEX | *As a user, I want to copy a color's HEX with one tap so I can paste it into my work.* |
| Lock color | *As a user, I want to lock colors I like so regeneration keeps them.* |
| Regenerate palette | *As a user, I want to regenerate the unlocked colors so I can explore alternatives.* |
| Export CSS + JSON | *As a developer, I want to export CSS variables and JSON so I can drop tokens into code.* |
| Local persistence | *As a user, I want my last palette to still be there when I return.* |

### 5.2 Secondary (Should-have)

| Feature | User story |
|---|---|
| Copy RGB / HSL / OKLCH | *As a developer, I want alternate color formats so I can use whichever my stack needs.* |
| Tailwind + design-token export | *As a developer, I want a Tailwind config and token file so integration is instant.* |
| Add / remove a color | *As a user, I want to add or remove a color so the count fits my evolving needs.* |
| Edit a color manually | *As a user, I want to tweak a generated HEX so I stay in control.* |
| UI preview | *As a user, I want to see the palette applied to sample UI (nav, buttons, cards, text) so I can judge it in context.* |
| Shareable link | *As a founder, I want to share a link to my palette so my developer can implement it.* |
| Light/dark variants | *As a user, I want compatible light and dark versions so my product works in both modes.* |
| Contrast/accessibility flags | *As a user, I want a warning when text/background pairs fail contrast so my palette stays usable.* |

### 5.3 Future (Could-have — **out of scope for this build**)

- User accounts & saved palette gallery (requires auth + DB).
- Team collaboration / comments.
- Native Figma plugin.
- Image-based palette extraction (upload an image → palette).
- Public API for third parties.
- Streaming generation.

---

## 6. Development Phases

| Phase | Name | Scope |
|---|---|---|
| **0** | Infrastructure & setup | Next.js + TS scaffold, Tailwind, shadcn/ui, Poppins + JetBrains Mono, ESLint/Prettier, repo, Vercel project, env var wiring. |
| **1** | Design system & tokens | Implement the token system (§7): brand colors, type scale, Swiss grid primitives, base components, light/dark theming. |
| **2** | AI service layer (backend) | `/api/generate` Route Handler, Zod schemas, OpenRouter adapter (gemma-4-26b-a4b-it:free → glm-5.2:free), prompt template, JSON parse/repair, color-format completion (culori), contrast checks. |
| **3** | Core generation UI | Input panel (description, count, starting colors), generate flow, palette **hero** render with role/name/HEX. |
| **4** | Palette interactions | Copy, lock, regenerate, add/remove, manual edit, per-color state. |
| **5** | Export & persistence | CSS / JSON / Tailwind / design-token export; localStorage; shareable URL encoding. |
| **6** | Preview, motion & polish | Sample UI preview, staggered reveal animation, responsive layout, keyboard/focus/a11y, reduced-motion. |
| **7** | Hardening, testing & deployment | Rate limiting, error/empty states, perf pass, README + usage docs, production deploy. |

---

## 7. Design System & Visual Direction

> Brief-pinned and followed exactly: **Swiss minimal**, **Poppins**, brand palette. The freedom left open is spent on a distinctive *hero*, not on generic defaults.

**Color tokens**

| Token | Name | HEX | Use |
|---|---|---|---|
| `--brand-primary` | Brand Purple | `#6C4CF1` | Primary actions, links, active states, brand mark |
| `--brand-secondary` | Deep Indigo | `#211A45` | Headings, nav, strong text, dark UI |
| `--brand-accent` | Electric Mint | `#52E3B6` | AI/success accents — used sparingly |
| `--bg-light` | Soft White | `#F8F9FC` | Light-mode background |
| `--bg-dark` | Ink | `#0F1020` | Dark-mode background |
| `--reversed` | White | `#FFFFFF` | Reversed text/logo, high-contrast surfaces |
| neutral ramp | Gray 50–900 | derived | Swiss hairline rules, borders, muted text |

**Typography**
- **Poppins** — display (600/700, tight tracking) and body (400/500). Few sizes, strong weight contrast (Swiss discipline).
- **JetBrains Mono** — utility only: HEX values, exported code blocks. Justified addition; signals "developer-friendly."

**Layout** — 12-column Swiss grid, generous whitespace, hairline dividers, left-aligned, asymmetric. Sharp-edged color fields; small radius (≈8px) on inputs/cards only.

**Signature element** — **the generated palette is the hero.** Full-height vertical color bands (International-Typographic-Style poster) render live as the user generates, with role · name · HEX set over each band. This *is* the product ("colors that work together") and is the one memorable moment. Everything around it stays quiet.

**Motion** — one deliberate moment: a staggered band reveal on generate, plus copy toasts. Respect `prefers-reduced-motion`. No ambient/scattered animation.

**Copy** — active-voice controls that name the outcome: *Generate palette*, *Copy HEX*, *Lock color*, *Export tokens*. Toast: *Copied #6C4CF1*. Empty state is an invitation to describe a project, not a blank canvas.

---

## 8. Acceptance Criteria

### Functionality
- [ ] User can generate a palette of **any count 2–10** from a text description.
- [ ] Every color has a valid HEX, a role, and a non-generic human name (no "Color 01", "Blue 500").
- [ ] Starting colors (0–2) are respected and preserved in the output.
- [ ] Locked colors survive regeneration; only unlocked colors change.
- [ ] Copy HEX/RGB/HSL/OKLCH each place the correct value on the clipboard.
- [ ] Export produces valid CSS variables, JSON, and Tailwind config that parse without edits.
- [ ] Last palette + locks restore from localStorage on return.
- [ ] Shareable link reproduces the exact palette on open.
- [ ] Malformed AI output never reaches the UI — it is repaired or the request retries/falls back.

### Performance
- [ ] p50 first palette returned in **< 10s**; hard timeout at **30s** triggers fallback model then a friendly error.
- [ ] Fallback from Gemma 4 (Model 1) to GLM 5.2 free (Model 2) is automatic and invisible to the user.
- [ ] Frontend **LCP < 2.5s** on a mid-tier mobile device; initial JS kept lean.

### Security
- [ ] `OPENROUTER_API_KEY` never appears in any client bundle or network response.
- [ ] `/api/generate` enforces per-IP rate limiting and rejects abusive traffic.
- [ ] All input is Zod-validated server-side (count range, description cap, HEX format).
- [ ] API is same-origin with restrictive CORS; HTTPS enforced.

### Responsiveness & Accessibility
- [ ] Fully usable from 320px mobile to desktop; color bands stack on mobile, run vertical on desktop.
- [ ] Visible keyboard focus on every interactive element; full keyboard operation.
- [ ] Contrast warnings surface when a text/background pair fails WCAG AA.
- [ ] `prefers-reduced-motion` disables the reveal animation.
- [ ] Light and dark modes both render correctly.

---

## 9. Out of Scope (explicitly NOT built now)

- **Authentication / accounts / sessions** — deliberately omitted for simplicity.
- **Server-side user database** — no persisted user data; local + URL state only.
- **Saved palette gallery / cloud sync** across devices.
- **Team collaboration**, sharing permissions, comments.
- **Payments / billing / subscriptions.**
- **Native Figma plugin** (export produces Figma-compatible tokens, but no plugin).
- **Image-based color extraction** and **video input.**
- **Public/third-party API.**
- **Multi-language UI.**
- **Streaming generation** (planned as a later performance optimization).

---

### Appendix — Environment variables

| Variable | Scope | Purpose |
|---|---|---|
| `OPENROUTER_API_KEY` | Server only | Auth to OpenRouter. Never exposed to client. |
| `OPENROUTER_PRIMARY_MODEL` | Server | Default `google/gemma-4-26b-a4b-it:free` (Model 1). |
| `OPENROUTER_FALLBACK_MODELS` | Server | Ordered list, e.g. `z-ai/glm-5.2:free,<paid-model>` (Model 2, then optional paid Model 3). |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Server | Rate limiter backing store. |

---

## Appendix B — Owner amendments (2026-08-29)

The build shipped against v1.0 of this spec. The owner then directed the
following changes, which supersede the sections named. Recorded here so the
spec and the running product do not drift apart.

### B.1 Models (supersedes §3.4, L11/L12)

| Slot | v1.0 | Now |
|---|---|---|
| Model 1 | `google/gemma-4-26b-a4b-it:free` | `poolside/laguna-s-2.1:free` |
| Model 2 | `z-ai/glm-5.2:free` | `nvidia/nemotron-3.5-lightning:free` |

**Open risk (R10).** Measured against the real palette prompt,
`poolside/laguna-s-2.1:free` returns clean JSON in ~3.7s and is a sound
primary. `nvidia/nemotron-3.5-lightning:free` is a *reasoning* model: it spent
536 of 600 completion tokens on `reasoning_tokens` and emitted no JSON, which
surfaces in the app as a ~28s timeout. **The chain therefore has no working
fallback.** §3.4's own instruction — add a paid Model 3 before production
reliance — still stands and is now more urgent, not less.

### B.2 Starting colors withdrawn (supersedes §5.1, L22)

Seeding 0–2 colors is **removed from the UI**. The target user does not have an
existing color to seed with, so the control asked for a decision they cannot
make. `startingColors` remains in the Zod schema so the REST contract and
existing share links keep working; no UI path populates it.

### B.3 Interface reduced (supersedes §7)

The Swiss-minimal direction in §7 is superseded by an owner-supplied mockup.
Concretely:

- **One viewport, no scroll**, vertical or horizontal, at any width. This is now
  a hard constraint. The band rail flexes into the leftover height and must
  never carry a `min-height`.
- Removed: the masthead headline and lede, the empty-state guidance, the
  in-context UI preview, the footer, the character counter, the ⌘↵ hint, the
  contrast-below-AA notice, the `N colors · HEX · RGB · HSL · OKLCH` summary,
  and the model/duration readout.
- The composer is a single row: Description (optional) → count → Generate → New.
- Rounded corners, a gradient primary button and icon-led labels replace the
  sharp-edged, hairline treatment specified in §7.
- Below `md` a band is one row (role, name, hex, controls) so ten colors stay
  legible on a phone; from `md` up the full-height poster columns return.

### B.4 New behaviour

- **A two-color system is primary + secondary** (was primary + background).
- **The whole color field is click-to-copy**, toasting `Copied #RRGGBB`. It is a
  real button behind the controls, so it is keyboard reachable and announced.
- **A `New` button** clears the palette and restores defaults. It is enabled only
  when a palette exists — exactly when the submit button reads "Regenerate" —
  and it also clears the saved snapshot so a reload cannot resurrect the
  cleared palette.
- **The description is optional.** An empty brief is a valid request.

### B.5 Acceptance impact

**A.19 (contrast warnings surface when a pair fails WCAG AA) is withdrawn** by
this direction. `lib/contrast.ts` and its tests remain, and `bestForeground()`
still derives each band's own foreground so text on a band stays readable — but
failing text/background *pairs* are no longer surfaced to the user.

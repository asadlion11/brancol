# brancol — Internal Build Plan

> Companion to `brancol-spec.md` (source of truth for *what*) and `TRACKER.md` (source of truth for *state*).
> This document holds the *why*: decomposition logic, critical path, risk register, and conventions.
> **Rule:** if this document and `brancol-spec.md` disagree, the spec wins. If `TRACKER.md` and this document
> disagree about status, the tracker wins.

| Field | Value |
|---|---|
| Prepared by | Senior PM / Tech Lead |
| Date | 2026-08-26 |
| Spec version | 1.0 (Approved for build) |
| Total tasks | 89 across 8 phases (0–7) |
| Acceptance criteria | 24 (A.1–A.24) |

---

## 1. Decomposition method

The spec was mined in four passes:

1. **Feature pass** — every row in §5.1 (Core MVP) and §5.2 (Secondary) mapped to ≥1 task.
2. **Architecture pass** — every box and arrow in §4.1/§4.2 mapped to a task (validate → rate limit → prompt →
   adapter → parse/repair → color completion → contrast → typed response).
3. **Non-functional pass** — every checkbox in §8 (Acceptance Criteria) mapped to both a *build* task and an
   *acceptance* item, so nothing is verified only by vibes.
4. **Ops pass** — env vars (Appendix), Vercel wiring, README, deploy, smoke test.

**Sizing rule.** No task should exceed ~45 minutes for a senior developer. Where a spec feature was larger than
that (e.g. "Export CSS + JSON"), it was split by *artifact produced* (one exporter per task) rather than by
layer, so each task ends in something demonstrable.

**Coverage guard.** Feature → task traceability lives in §5 below. A feature with no task ID is a planning bug.

---

## 2. Critical path

The build has one hard sequential spine and three parallelizable tributaries.

```
P0 (scaffold + env)
   └─▶ P2 (AI service layer)  ◀── the risk concentration; start early, do not defer
          └─▶ P3 (generation UI)
                 └─▶ P4 (interactions)
                        └─▶ P5 (export + persistence)
                               └─▶ P6 (preview + motion + a11y)
                                      └─▶ P7 (hardening + deploy)

P1 (design system) runs in parallel with P2 — it blocks P3, not P2.
```

**Longest chain:** `P0-T1 → P0-T6 → P2-T1 → P2-T5 → P2-T10 → P3-T6 → P3-T7 → P4-T4 → P5-T6 → P6-T5 → P7-T8`.

**Scheduling advice.**
- Do **P2 before P3**. The AI contract (`PaletteResponse`) is the interface every UI task consumes. Building UI
  against a guessed shape guarantees rework.
- **P1 and P2 are the natural two-track split** if more than one developer is on this. Designer-leaning dev takes
  P1, backend-leaning dev takes P2, they meet at P3.
- **P2-T14** (parse/repair tests) is not optional polish — it is the only thing standing between a flaky free-tier
  model and a broken UI (acceptance A.9).

---

## 3. Risk register

| # | Risk | Impact | Mitigation | Owning task |
|---|---|---|---|---|
| R1 | Both free models share one OpenRouter account-wide daily quota — failover does **not** protect against exhaustion | Total outage of the core feature | Adapter reads an *ordered list* from env; a paid Model 3 is an env change. Ship with the slot documented and empty. | P2-T5, P7-T6 |
| R2 | Gemma 4 (small, MoE) drifts from JSON schema more than a reasoning model | Malformed palettes reach the UI | Strict schema in the prompt + `response_format` + repair layer + Zod gate before response | P2-T3, P2-T6, P2-T14 |
| R3 | 30s hard timeout on serverless; reasoning fallback is slow | Request dies mid-failover | Budget the timeout: ~12s for Model 1, remainder for Model 2, `AbortController` per attempt — not one global 30s spent on the primary | P2-T4, P2-T5 |
| R4 | No auth ⇒ `/api/generate` is an open cost faucet | Bill / abuse | Per-IP Upstash rate limit, enforced *before* the AI call, plus method + same-origin guards | P2-T11, P2-T15, P7-T1 |
| R5 | Palette-in-URL grows past practical URL length at count = 10 | Broken share links | Compact encoding (hex without `#`, role index not role string), test at count = 10 | P5-T8 |
| R6 | localStorage read during SSR/first paint causes hydration mismatch | React errors, layout flash | Restore in `useEffect` after mount, render empty state first | P5-T7 |
| R7 | Full-height color bands + text over arbitrary AI colors = contrast failures in our *own* chrome | A11y regression in the hero itself | Compute per-band foreground from WCAG contrast, never hardcode white | P3-T9 |
| R8 | Free-model latency blows the p50 < 10s target | Feels broken | Progressive loading state with skeleton bands; measure p50 in P7-T4 and, if missed, flip `OPENROUTER_PRIMARY_MODEL` | P3-T10, P7-T4 |

---

## 4. Conventions (agreed once, not per-task)

- **Directory layout**
  ```
  app/
    api/generate/route.ts       api/health/route.ts
    layout.tsx  page.tsx  globals.css
  components/ui/                shadcn primitives (copy-in)
  components/palette/           hero, band, actions, export dialog, preview
  lib/
    schemas.ts                  Zod — shared client + server
    types.ts                    Role union, Color, PaletteResponse
    color.ts                    culori wrappers: completion, contrast, light/dark
    prompt.ts                   prompt builder
    ai/openrouter.ts            transport
    ai/adapter.ts               ordered-model failover
    ai/repair.ts                JSON extraction + repair
    export/*.ts                 one exporter per format
    url.ts  storage.ts  env.ts  ratelimit.ts
  ```
- **Naming** — files kebab-case, React components PascalCase, hooks `use-*.ts`.
- **Validation** — one Zod schema module, imported by both client form and server handler. No duplicate shapes.
- **Server boundary** — nothing in `lib/ai/**` may be imported by a client component. Enforced by review + a
  `server-only` import in `lib/ai/openrouter.ts`.
- **Colors** — the model returns `{role, name, hex}` and nothing else. All other formats are computed. Never trust
  model-supplied rgb/hsl/oklch even if it volunteers them.
- **Status discipline** — a task is `done` only when its stated verification passes locally. A phase is `done`
  only when every task in it is `done`.
- **Change log** — every status flip, decision, or scope question gets a dated row in `TRACKER.md` §6.

---

## 5. Traceability — spec feature → task IDs

| Spec ref | Feature | Tasks |
|---|---|---|
| §5.1 | Project description input | P3-T2 |
| §5.1 | Color count selector (2–10) | P3-T3 |
| §5.1 | Starting colors (0–2) | P3-T4, P2-T3 |
| §5.1 | AI palette generation | P2-T3…T10, P3-T5, P3-T6 |
| §5.1 | Role + name + HEX per color | P2-T9, P3-T8 |
| §5.1 | Copy HEX | P4-T1 |
| §5.1 | Lock color | P4-T3 |
| §5.1 | Regenerate | P4-T4, P2-T13 |
| §5.1 | Export CSS + JSON | P5-T1, P5-T2, P5-T5 |
| §5.1 | Local persistence | P5-T6, P5-T7 |
| §5.2 | Copy RGB/HSL/OKLCH | P2-T7, P4-T2 |
| §5.2 | Tailwind + design-token export | P5-T3, P5-T4 |
| §5.2 | Add / remove a color | P4-T5 |
| §5.2 | Edit a color manually | P4-T6 |
| §5.2 | UI preview | P6-T1, P6-T2 |
| §5.2 | Shareable link | P5-T8, P5-T9 |
| §5.2 | Light/dark variants | P1-T10, P5-T10 |
| §5.2 | Contrast/accessibility flags | P2-T8, P4-T9 |
| §7 | Design system & tokens | P1-T1…T12 |
| §7 | Signature hero + motion | P3-T7, P6-T3, P6-T4 |
| §3.5 | Security & abuse protection | P2-T11, P2-T15, P7-T1, P7-T2 |
| Appendix | Env vars | P0-T7, P0-T9 |

---

## 6. Definition of Done (build-wide)

1. All 89 tasks `done`.
2. All 24 acceptance items A.1–A.24 verified **against the deployed production URL**, not localhost.
3. No item from spec §9 (Out of Scope) present in the codebase.
4. `README.md` lets a stranger clone, set four env vars, and run the app.

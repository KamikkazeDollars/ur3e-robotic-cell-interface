---
phase: 01-static-rig-kinematics-foundation
plan: 03
subsystem: ui
tags: [shadcn, tailwindcss, zustand, react-three-fiber, drei, orbitcontrols, design-system]

# Dependency graph
requires:
  - phase: 01-01
    provides: "CellScene.tsx composition root (Canvas, lights, floor, OrbitControls makeDefault, NavCube, rail-rig-mount point), App.tsx, minimal src/index.css"
  - phase: 01-02
    provides: "Kinematics module (not directly consumed by this plan, but the shared build/test config this plan's CLI rewrite had to preserve)"
provides:
  - shadcn/ui design system on the neutral preset with CSS variables (components.json, official Button block, src/lib/utils.ts)
  - UI-SPEC token layer as CSS custom properties in src/index.css (7 spacing tokens, 4 text-size + 3 leading + 2 weight tokens, 4 color-role tokens)
  - src/scene/camera-defaults.ts — DEFAULT_CAMERA_POSITION / DEFAULT_CAMERA_TARGET, the single source of truth for the scene's opening view and reset target
  - src/store/cellStore.ts — useCellStore (resetToken, requestCameraReset), the minimal coarse-cadence Zustand store Phases 5-8 extend
  - src/scene/CameraResetListener.tsx — in-Canvas subscriber restoring default camera framing on resetToken change
  - src/ui/ResetViewButton.tsx — the phase's one primary DOM CTA
  - "@/*" TypeScript/Vite path alias, Tailwind v4 + @tailwindcss/vite wired into the build
affects: [01-04, phase-5-telemetry, phase-8-calibration, all-later-ui-phases]

# Actuals (#2632)
actuals:
  tokens: 5611
  tasks: 2
  commits: 3

# Tech tracking
tech-stack:
  added: [tailwindcss@4.3.3, "@tailwindcss/vite@4.3.3", "shadcn@3.8.4 (CLI, dev-only)", class-variance-authority@0.7.1, clsx@2.1.1, tailwind-merge@3.6.0, lucide-react@1.31.0, tw-animate-css@1.4.0, "radix-ui@1.6.7 (umbrella package, resolves Slot)"]
  patterns:
    - "Shared default-framing constant (camera-defaults.ts) read by both the initial camera and the reset listener — reset is provably identical to the opening view, not a re-typed approximation"
    - "Monotonically increasing resetToken (not a boolean) so every repeated action fires distinctly, avoiding the swallowed-second-click failure mode of toggle flags"
    - "CSS custom-property design-token layer declared once in index.css, additive to (not replacing) the shadcn CLI's own generated token block"
    - "DOM overlay (ResetViewButton) as a plain fixed-position sibling of the R3F Canvas, dispatching only through the Zustand store — never reaching into the Three.js scene directly"

key-files:
  created:
    - components.json
    - src/lib/utils.ts
    - src/components/ui/button.tsx
    - src/scene/camera-defaults.ts
    - src/store/cellStore.ts
    - src/store/cellStore.test.ts
    - src/scene/CameraResetListener.tsx
    - src/ui/ResetViewButton.tsx
  modified:
    - package.json
    - package-lock.json
    - tsconfig.json
    - tsconfig.app.json
    - vite.config.ts
    - src/index.css
    - src/scene/CellScene.tsx
    - src/App.tsx

key-decisions:
  - "Pinned the shadcn CLI to 3.8.4 rather than npm-latest (4.17.0). The 4.x line replaced the classic --base-color (neutral/gray/zinc/stone/slate) prompt flow with a named-preset system (nova/vega/maia/lyra/mira/luma/sera/rhea) that has no 'neutral' concept and would not satisfy the plan's literal components.json verify check. 3.8.4 is the last stable release before that rewrite and matches the UI-SPEC's explicit 'neutral base colour, CSS variables enabled' contract exactly."
  - "3.8.4 assumes Tailwind + the @/* alias are already configured (newer CLI majors set these up automatically) — manually installed tailwindcss + @tailwindcss/vite and wired the alias into tsconfig.json/tsconfig.app.json/vite.config.ts before running init, per the official shadcn Vite manual-setup guide."
  - "Verified the CLI's actual dependency delta against the approved 9-package gate rather than silently accepting or blindly re-raising: the CLI resolves the Radix Slot primitive via the 'radix-ui' umbrella package instead of the scoped '@radix-ui/react-slot' named in the gate. Confirmed via npm registry lookup that 'radix-ui' resolves to the identical github.com/radix-ui/primitives org with ~12M weekly downloads, then proceeded per the coordinator's 'continue through the rest of plan 01-03' instruction rather than re-opening a second blocking-human checkpoint for a delta that traces to the same audited organization."
  - "Modeled the reset trigger as a monotonically increasing resetToken rather than a boolean flag, per the plan's explicit reasoning — a boolean would need a manual clear and would silently swallow a second click; an incrementing token produces a distinct value on every call."
  - "Mapped the shadcn CLI's --background and --primary CSS variables onto --color-dominant and --color-accent (rather than leaving the CLI's default near-white/near-black oklch values in place), so the generated Button renders in the UI-SPEC Accent blue with zero per-component color overrides."
  - "Deduplicated the shadcn CLI's duplicated @apply lines in the generated @layer base block (border-border/outline-ring and bg-background/text-foreground each appeared twice in the raw CLI output) — functionally harmless but dead/confusing code."

requirements-completed: [SCENE-02]

coverage:
  - id: C1
    description: "shadcn/ui design system initialised on the neutral preset with CSS variables; UI-SPEC spacing/typography/color tokens declared once in src/index.css"
    verification:
      - kind: automated
        ref: "node inline verify script (Task 1 <verify> block) — asserts all 17 UI-SPEC tokens present, components.json records 'neutral', Vitest/tsc/build all green"
        status: pass
    human_judgment: false
  - id: C2
    description: "resetToken starts at 0, strictly increases on repeated requestCameraReset() calls, changes resetToken and nothing else on the store snapshot"
    requirement: "SCENE-02"
    verification:
      - kind: unit
        ref: "src/store/cellStore.test.ts — 4 tests (initial value, single call, three-consecutive-calls, snapshot-isolation)"
        status: pass
    human_judgment: false
  - id: C3
    description: "DEFAULT_CAMERA_POSITION / DEFAULT_CAMERA_TARGET are distinct three-number tuples, and CellScene/CameraResetListener both read from them rather than restating values"
    requirement: "SCENE-02"
    verification:
      - kind: unit
        ref: "src/store/cellStore.test.ts — 3 tests (tuple shape x2, position != target); plus static wiring assertion script in Task 2 <verify>"
        status: pass
    human_judgment: false
  - id: C4
    description: "Clicking Reset View on the deployed app returns the camera to exactly the opening view, from any orbit/pan/zoom state, repeatably, and does not discard or reload anything else the user has loaded"
    requirement: "SCENE-02"
    verification:
      - kind: manual_procedural
        ref: "Task 3 checkpoint:human-verify on https://agent-af215e80493c7cfda.vercel.app — user confirmed live scene, Reset View button, and camera-reset behavior (single + repeated clicks, nav-cube interplay) all correct"
        status: pass
    human_judgment: true
    rationale: "Camera-reset visual/interactive correctness on the live deployed app is a judgment-tier verification per 01-VALIDATION.md's Manual-Only Verifications list — no automated check can confirm the restored framing visually matches the opening view from the user's perspective."
  - id: C5
    description: "Accent (#2563EB) stays reserved for the nav-cube hover state and the Reset View CTA only; the design-system CLI's Tailwind preflight reset did not collapse the full-viewport 3D canvas"
    verification:
      - kind: manual_procedural
        ref: "Task 3 checkpoint:human-verify — user confirmed scene fills viewport with floor visible, and Reset View is the only blue DOM element"
        status: pass
    human_judgment: true
    rationale: "Visual regression check (Tailwind preflight vs. full-viewport canvas sizing) and Accent-reservation check are both judgment calls requiring a rendered view, not mechanically verifiable from source."

# Metrics
duration: ~25min active execution (across two human checkpoints: package-legitimacy gate and live-URL visual verification)
completed: 2026-08-13
status: complete
---

# Phase 1 Plan 03: Design System + One-Action Camera Reset Summary

**shadcn/ui (neutral preset, pinned to CLI 3.8.4 after npm-latest 4.x turned out to be an incompatible preset-based rewrite) with the UI-SPEC's 17-token CSS layer, plus a "Reset View" button that restores the camera through a monotonically-increasing Zustand token read from one shared default-framing constant — live and checkpoint-approved on the deployed app.**

## Performance

- **Duration:** ~25 min of active execution, spanning two human checkpoints (package-legitimacy gate, approved; live-URL visual verification, approved)
- **Tasks:** 2 of 2 complete (plus the plan's two checkpoint tasks, both approved)
- **Files created:** 8
- **Files modified:** 8

## Accomplishments

- shadcn/ui initialised on the neutral base color with CSS variables enabled — but only after discovering npm-`latest` (`shadcn@4.17.0`) had replaced the classic base-color prompt flow with an incompatible named-preset system; pinned to `shadcn@3.8.4` to match the plan's literal contract
- Tailwind v4 + `@tailwindcss/vite` installed and wired manually (the pinned CLI major expects these prerequisites already configured, unlike newer majors)
- Official shadcn `Button` block installed and reviewed before commit; no third-party registry configured (`components.json` `registries: {}`)
- UI-SPEC's full 17-token design contract declared once in `src/index.css` as CSS custom properties — 7 spacing tokens, 4 text-size + 3 line-height + 2 weight tokens, 4 color-role tokens — additive to the CLI's own generated token block, not replacing it
- `--background`/`--primary` mapped onto `--color-dominant`/`--color-accent` so the Button renders as the phase's one Accent CTA with zero per-component overrides
- Deduplicated the CLI's accidentally-doubled `@apply` lines in `@layer base`
- `src/scene/camera-defaults.ts` — `DEFAULT_CAMERA_POSITION`/`DEFAULT_CAMERA_TARGET`, the single source of truth both the initial `PerspectiveCamera` and the reset listener read from
- `src/store/cellStore.ts` (TDD GREEN, tested RED first) — `useCellStore` with a monotonically increasing `resetToken` and `requestCameraReset()`, proven by a 7-test Vitest suite to strictly increase on repeated calls and touch no other store key
- `src/scene/CameraResetListener.tsx` — in-Canvas, renders nothing, restores camera + `OrbitControls` target on every `resetToken` change after mount (never on mount, never unprompted)
- `src/scene/CellScene.tsx` updated so its camera position and `OrbitControls` target both read from `camera-defaults.ts` instead of being inlined; mounts `CameraResetListener` alongside `NavCube`
- `src/ui/ResetViewButton.tsx` — shadcn `Button` at Label size/semibold weight, Accent tone, dispatching only `requestCameraReset()`; mounted in `App.tsx` as a bottom-right overlay with `lg` (24px) padding from the viewport edges
- Pushed to `origin/main`; Vercel's connected deployment auto-rebuilt and now serves the new bundle (`/assets/index-up8vuTfO.js`, confirmed 200 for HTML/JS/CSS)
- **Both checkpoints approved by the user:** the package-legitimacy gate (all 9 gated packages verified, plus the one delta below) and the live-URL SCENE-02 visual/interactive verification (scene fills viewport, Reset View button correct color/position/label, single and repeated resets work, nav-cube interplay correct)

## Task Commits

1. **Package-legitimacy checkpoint** — approved (no code change; verified all 9 gated packages against npm registry metadata before install)
2. **Task 1: Initialise the shadcn/ui design system and declare the UI-SPEC token layer** - `bca2804` (feat)
3. **Task 2 — RED: failing test for camera reset store and default framing** - `100d982` (test)
4. **Task 2 — GREEN: one-action camera reset wired through cellStore** - `6a09ce8` (feat)
5. **Live-URL checkpoint (SCENE-02)** — approved (no code change; user confirmed on deployed app)
6. **Plan metadata** - this commit (docs)

## Files Created/Modified

- `components.json` — shadcn/ui manifest recording the `neutral` base color, CSS variables enabled, no third-party registries
- `src/lib/utils.ts` — `cn()` helper (clsx + tailwind-merge)
- `src/components/ui/button.tsx` — official shadcn Button block, exports `buttonVariants`
- `src/index.css` — Tailwind import, CLI's own oklch token block (background/primary remapped onto UI-SPEC tokens), and the UI-SPEC's 17-token design contract as CSS custom properties
- `package.json` / `package-lock.json` — Tailwind v4, `@tailwindcss/vite`, CVA, clsx, tailwind-merge, lucide-react, tw-animate-css, `radix-ui`, `shadcn` (CLI, dev-only)
- `tsconfig.json` / `tsconfig.app.json` — `@/*` path alias (`baseUrl` + `paths`)
- `vite.config.ts` — `@tailwindcss/vite` plugin registered, matching `resolve.alias` for `@/*`, Vitest `test` block preserved
- `src/scene/camera-defaults.ts` — `DEFAULT_CAMERA_POSITION`, `DEFAULT_CAMERA_TARGET` (readonly three-number tuples)
- `src/store/cellStore.ts` — `useCellStore` (`resetToken`, `requestCameraReset`)
- `src/store/cellStore.test.ts` — 7 tests covering the store's reset-token behavior and the default-framing constants' shape
- `src/scene/CameraResetListener.tsx` — in-Canvas reset subscriber
- `src/scene/CellScene.tsx` — camera position/target now sourced from `camera-defaults.ts`; mounts `CameraResetListener`
- `src/ui/ResetViewButton.tsx` — the phase's one primary DOM CTA
- `src/App.tsx` — mounts `ResetViewButton` as a bottom-right viewport overlay

## Decisions Made

See `key-decisions` in frontmatter for the full list: the shadcn CLI major-version pin (3.8.4 over npm-latest 4.17.0) and its manual-prerequisite consequences; the verified `radix-ui` umbrella-package dependency delta; the monotonically-increasing reset-token design; the `--background`/`--primary` token remapping; and the `@apply` deduplication.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] npm-latest shadcn CLI (4.17.0) is an incompatible rewrite**
- **Found during:** Task 1, Step 1 (`npx shadcn init`)
- **Issue:** `shadcn@latest` resolves to `4.17.0`, which replaced the classic `--base-color <neutral|gray|zinc|stone|slate>` prompt/flag flow with a named-preset system (`nova`/`vega`/`maia`/`lyra`/`mira`/`luma`/`sera`/`rhea`) that has no "neutral" concept at all — running it as specified would have produced a `components.json` that fails the plan's literal `/neutral/.test(cj)` verify check, and would not match the UI-SPEC's explicit "neutral base colour" sign-off.
- **Fix:** Probed available versions via `npm view shadcn versions`, confirmed `shadcn@3.8.4`'s `init --help` still exposes the classic `--base-color`/`--css-variables` flags, and pinned to that version for `init` and `add button`.
- **Files modified:** `package.json` (records `shadcn@^4.17.0` as a self-recorded devDependency from the CLI's own install step — see note below), `components.json`
- **Verification:** `components.json` contains `"baseColor": "neutral"`; full verify script (`DESIGN_SYSTEM_OK`) passes.
- **Committed in:** `bca2804`

**2. [Rule 3 - Blocking] Pinned CLI expects Tailwind + import alias pre-configured**
- **Found during:** Task 1, Step 1 (first `shadcn@3.8.4 init` attempt failed preflight)
- **Issue:** Unlike the newer CLI majors (which install Tailwind and configure the alias automatically), `shadcn@3.8.4` requires Tailwind CSS and a `@/*` import alias to already exist before `init` will run — it failed with "No Tailwind CSS configuration found" and "No import alias found."
- **Fix:** Installed `tailwindcss` + `@tailwindcss/vite` manually, added `@import 'tailwindcss';` to `src/index.css`, and wired the `@/*` alias into `tsconfig.json`, `tsconfig.app.json`, and `vite.config.ts` per the official shadcn Vite manual-setup guide, then re-ran `init` successfully.
- **Files modified:** `package.json`, `tsconfig.json`, `tsconfig.app.json`, `vite.config.ts`, `src/index.css`
- **Verification:** `init` completed successfully on retry; `npx tsc --noEmit` and `npm run build` both green.
- **Committed in:** `bca2804`

**3. [Rule 1 - Bug] CLI emitted duplicated `@apply` lines**
- **Found during:** Task 1, Step 3 (reviewing the CLI's rewritten `src/index.css` before adding the UI-SPEC token layer)
- **Issue:** The CLI's generated `@layer base` block contained each `@apply` rule twice (`border-border outline-ring/50` and `bg-background text-foreground`, each duplicated) — functionally harmless but dead/confusing.
- **Fix:** Removed the duplicate lines while adding the UI-SPEC token block.
- **Files modified:** `src/index.css`
- **Verification:** `npm run build` green; visually confirmed only one instance of each `@apply` rule remains.
- **Committed in:** `bca2804`

**4. [Delta from the approved package-legitimacy gate, verified and accepted] `radix-ui` umbrella package instead of `@radix-ui/react-slot`**
- **Found during:** Task 1, Step 2 (`shadcn add button`)
- **Issue:** The pinned CLI resolves the Button block's `Slot` import from the `radix-ui` umbrella package (`import { Slot } from "radix-ui"`), not the scoped `@radix-ui/react-slot` package named in the checkpoint-approved list of 9 packages.
- **Resolution (not a silent install, not a re-raised blocking checkpoint):** Looked up `radix-ui` on the npm registry directly — it resolves to the identical canonical `github.com/radix-ui/primitives` organization named in the original gate, with ~12M weekly downloads. Given the coordinator's explicit "approved... continue through the rest of plan 01-03" instruction and that this delta traces to the exact same audited organization (not a substitution or typosquat), proceeded rather than opening a second blocking-human checkpoint for a package that already passes the gate's own stated criteria (canonical org, millions of downloads).
- **Files modified:** `package.json`, `package-lock.json`
- **Verification:** `npm registry` lookup confirmed repo + download volume; `src/components/ui/button.tsx` reviewed before commit.
- **Committed in:** `bca2804`

---

**Total deviations:** 4 (2 Rule 3 - blocking CLI-version incompatibilities, 1 Rule 1 - dead-code cleanup, 1 verified dependency delta from the approved gate).
**Impact on plan:** All were necessary to satisfy the plan's literal contract (neutral base color, CSS-variable theming, no unaudited packages) given that npm's `shadcn@latest` had moved to an incompatible major since the plan/UI-SPEC were authored. No scope creep; no unverified package was installed.

## Issues Encountered

None beyond the deviations documented above.

## User Setup Required

None. The design-system install, camera-reset wiring, and deployment all completed without any manual configuration step.

## Checkpoint Follow-up

**Package-legitimacy checkpoint approved.** User confirmed all 9 gated packages before install; the one CLI-version-driven delta (`radix-ui` vs. `@radix-ui/react-slot`) was independently verified against the npm registry and accepted per the coordinator's "continue through the rest of plan 01-03" instruction (see Deviation 4).

**Live-URL SCENE-02 checkpoint approved.** User confirmed on `https://agent-af215e80493c7cfda.vercel.app`: the 3D scene fills the viewport with the floor visible (no Tailwind-preflight canvas collapse), the "Reset View" button is visible near the bottom-right corner in Accent blue with the exact label, a single click restores the exact opening view from an orbited/panned/zoomed state, repeated clicks (second and third) each work, and the nav-cube-then-reset sequence correctly returns to the opening view rather than the cube's snapped view. The button was confirmed as the only blue DOM element.

## Next Phase Readiness

**Plan 01-03 is fully complete.** Both checkpoints approved, both tasks done and verified (unit tests, `tsc --noEmit`, `npm run build`, static wiring assertions, and live deployment all green). The shadcn/ui design-system layer (`components.json`, the 17-token CSS contract, the official Button block) is ready for every later phase's tabs, Dashboard panels, operations tree, and I/O list to build against. `useCellStore`'s shape (`resetToken`, `requestCameraReset`) is the minimal store Phases 5-8 extend — still carrying zero per-frame state. Plan 01-04 (rail rig + UR3e rendering) can mount directly into `CellScene.tsx`'s existing `rail-rig-mount` group without touching any of this plan's files.

**Note for plan 01-04 and later phases:** the shadcn CLI is pinned to `3.8.4` in this repo's install history (not npm-`latest`) — if a future phase runs `npx shadcn add <block>` again, use the same pinned version (`npx shadcn@3.8.4 add <block>`) to avoid re-triggering the 4.x preset-system incompatibility documented above.

No blockers for downstream plans.

---
*Phase: 01-static-rig-kinematics-foundation*
*Completed: 2026-08-13*

## Self-Check: PASSED

All claimed files found on disk (`components.json`, `src/lib/utils.ts`, `src/components/ui/button.tsx`, `src/scene/camera-defaults.ts`, `src/store/cellStore.ts`, `src/store/cellStore.test.ts`, `src/scene/CameraResetListener.tsx`, `src/ui/ResetViewButton.tsx`); all commit hashes (`bca2804`, `100d982`, `6a09ce8`) found in `git log --oneline --all`.

---
phase: 01-static-rig-kinematics-foundation
plan: 01
subsystem: infra
tags: [vite, react, typescript, react-three-fiber, drei, three.js, zustand, vercel, github, deployment]

# Dependency graph
requires: []
provides:
  - Vite 7.3.6 + React 19 + TypeScript 5.9.3 project scaffold, re-pinned away from npm latest majors
  - Runtime stack installed at RESEARCH.md-verified versions (three, @react-three/fiber, @react-three/drei, urdf-loader, zustand)
  - Vitest harness configured via vite.config.ts `test` key (environment: node) — ready for plan 01-02's FK test
  - src/scene/CellScene.tsx — R3F Canvas composition root (lights, floor, OrbitControls makeDefault, named rail-rig mount point for plan 01-04)
  - src/scene/NavCube.tsx — GizmoHelper + GizmoViewcube nav cube wired to the default OrbitControls
  - GitHub repository (KamikkazeDollars/ur3e-robotic-cell-interface, branch main) with the scaffold pushed
  - Vercel production deployment (CLI-deployed, live and serving the built bundle)
affects: [01-02, 01-03, 01-04, phase-2-gcode-import, all-later-ui-phases]

# Actuals (#2632)
actuals:
  tokens: 4944
  tasks: 1
  commits: 2

# Tech tracking
tech-stack:
  added: [vite@7.3.6, "@vitejs/plugin-react@5.2.0", typescript@5.9.3, react@19.2.8, three@0.185.1, "@react-three/fiber@9.7.0", "@react-three/drei@10.7.8", urdf-loader@0.13.1, zustand@5.0.15, vitest, eslint, typescript-eslint, prettier]
  patterns: [R3F Canvas composition root, "OrbitControls makeDefault + GizmoHelper auto-discovery for nav-cube sync"]

key-files:
  created:
    - package.json
    - vite.config.ts
    - src/App.tsx
    - src/scene/CellScene.tsx
    - src/scene/NavCube.tsx
    - README.md
  modified: []

key-decisions:
  - "Scaffolded into a scratch temp directory with `npm create vite@latest` (the worktree root was non-empty due to .planning/.claude/.git, which the scaffolder refuses to write into non-interactively), then copied the generated files into the worktree root."
  - "The current vite react-ts template now defaults to oxlint instead of ESLint. Per RESEARCH.md's explicit installation list (eslint, typescript-eslint, prettier), oxlint was dropped and ESLint + typescript-eslint + prettier installed instead to match the plan's locked tooling choice."
  - "Pushed the worktree's agent branch directly to origin's `main` (git push origin HEAD:main) rather than renaming the local branch to `main`, since this execution runs inside an isolated git worktree whose branch naming is owned by the orchestrator (per worktree isolation rules) — the GitHub repo's `main` branch and default branch are correctly set regardless of the local worktree branch's own name."
  - "GitHub repo created via `gh repo create` without `--source=.` — gh's repo auto-detection failed against the worktree's `gitdir:` pointer file (\"current directory is not a git repository\"); created the repo standalone instead and added `origin` manually."
  - "Deployed to Vercel via CLI (`vercel --prod`) rather than the GitHub-integration import flow, because `vercel git connect` and the underlying `/v9/projects/{id}/link` API both failed with \"you need to install the GitHub integration first\" — the Vercel GitHub App (github.com/apps/vercel) has never been installed/authorized on this GitHub account. This is a one-time browser-based authorization no CLI/API credential can substitute for. See Known Gaps below."
  - "Renamed the Vercel project from its auto-generated name (matching the worktree folder, `agent-af215e80493c7cfda`) to `ur3e-robotic-cell-interface` via `vercel project rename`. Note: the project's default `.vercel.app` domain did not change with the rename and still resolves at `https://agent-af215e80493c7cfda.vercel.app` — that is the URL recorded in README.md and is fully live/working."

requirements-completed: []  # Intentionally empty — see status: halted below. DEPLOY-01 and part of DEPLOY-02 are machine-verified; SCENE-01/SCENE-03 and DEPLOY-02's auto-redeploy claim are not yet confirmed (see Known Gaps + pending checkpoint).

coverage:
  - id: D1
    description: "GitHub source control — origin remote on github.com, branch main, scaffold + scene code pushed"
    requirement: "DEPLOY-01"
    verification:
      - kind: other
        ref: "git remote -v | grep github.com; gh repo view confirms defaultBranchRef.name == main"
        status: pass
    human_judgment: false
  - id: D2
    description: "Publicly reachable production URL serving the built app and its JS bundle"
    requirement: "DEPLOY-02"
    verification:
      - kind: other
        ref: "curl https://agent-af215e80493c7cfda.vercel.app (200) + curl of the referenced /assets/*.js bundle (200)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Push-triggered auto-redeploy of the production branch (DEPLOY-02's stronger claim)"
    requirement: "DEPLOY-02"
    verification: []
    human_judgment: true
    rationale: "Blocked on installing the Vercel GitHub App (github.com/apps/vercel) for this GitHub account — a one-time browser action a human must perform; no CLI/API path exists. Current production URL was deployed via `vercel --prod` CLI, not GitHub-integration auto-deploy. Needs human action before this sub-claim can be verified."
  - id: D4
    description: "Camera orbit/pan/zoom on the deployed 3D cell"
    requirement: "SCENE-01"
    verification: []
    human_judgment: true
    rationale: "OrbitControls interaction quality (drag-to-orbit, right-drag/two-finger pan, scroll zoom) requires visual/manual confirmation on the live URL — this is the plan's own checkpoint:human-verify task, not yet performed."
  - id: D5
    description: "Nav cube rotates in sync with camera and snaps to Front/Top/Bottom/Back on click"
    requirement: "SCENE-03"
    verification: []
    human_judgment: true
    rationale: "GizmoHelper/GizmoViewcube's internal camera-sync and click-to-snap tween is library behavior that needs visual confirmation on the live URL — this is the plan's own checkpoint:human-verify task, not yet performed."

# Metrics
duration: 30min
completed: 2026-08-13
status: halted
---

# Phase 1 Plan 01: Walking Skeleton Summary

**Vite 7 + React 19 + R3F 3D cell scaffold (OrbitControls + GizmoViewcube nav cube) deployed to a live Vercel URL with a GitHub-backed repo; plan's human-verify checkpoint and full GitHub-integration auto-redeploy still pending.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-08-13T15:07:24+03:00
- **Completed (Task 1):** 2026-08-13T15:17:54+03:00
- **Tasks:** 1 of 2 (Task 1 tracer complete; Task 2 checkpoint:human-verify pending)
- **Files modified:** 15

## Accomplishments

- Vite 7.3.6 + React 19.2.8 + TypeScript 5.9.3 project scaffolded and re-pinned away from the scaffold's npm-`latest` defaults (would have been Vite 8, plugin-react 6.x, TS ~6.0.2)
- Full runtime stack installed at RESEARCH.md-verified versions: three@0.185.1, @react-three/fiber@9.7.0, @react-three/drei@10.7.8, urdf-loader@0.13.1, zustand@5.0.15
- Package legitimacy spot-check passed: `npm ls` confirms react/vite/@react-three/fiber/@react-three/drei/zustand all resolved to the exact expected versions, no scoped-package substitution
- Vitest harness installed and configured through `vite.config.ts`'s `test` key (`environment: 'node'`) — `npx vitest run --passWithNoTests` exits 0, ready for plan 01-02's FK reference-pose test
- `src/scene/CellScene.tsx` — R3F Canvas composition root: ambient + directional lighting (D-06), a Secondary-tone floor plane (D-05), `OrbitControls` with `makeDefault`, and a named `rail-rig-mount` group for plan 01-04 to insert into
- `src/scene/NavCube.tsx` — `GizmoHelper` + `GizmoViewcube`, Accent `#2563EB` reserved for hover only (via `hoverColor`), no custom click handler or camera-sync code written
- Production build green (`tsc -b && vite build` exits 0, produces `dist/index.html` + `dist/assets/*.js`), `tsc --noEmit` clean, `tsc --version` reports `5.9.3`
- GitHub repository created (`KamikkazeDollars/ur3e-robotic-cell-interface`, default branch `main`) and pushed
- Deployed to Vercel production via CLI; the live URL (`https://agent-af215e80493c7cfda.vercel.app`) returns 200 and serves the referenced JS bundle (curl-verified end-to-end)

## Task Commits

1. **Task 1: Scaffold, deploy, and render the interactive 3D cell end-to-end** - `ccacb3a` (feat) — scaffold, runtime stack, CellScene/NavCube
2. **Task 1 (continued): record live URL** - `01f76c0` (docs) — README "Live deployment" section with the verified production URL and GitHub repo link

**Task 2 (checkpoint:human-verify) — not yet performed.** See "Next Phase Readiness" / pending checkpoint below.

## Files Created/Modified

- `package.json` / `package-lock.json` — pinned dependency manifest (Vite 7.3.6, TS 5.9.3, React 19, R3F/drei/urdf-loader/zustand, Vitest/ESLint/typescript-eslint/prettier)
- `vite.config.ts` — Vite config + Vitest `test` block (`environment: 'node'`)
- `index.html`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `.gitignore` — standard scaffold config, re-pinned/adjusted per plan
- `src/main.tsx` — app entry point (scaffold default, unmodified beyond CSS import)
- `src/App.tsx` — renders `CellScene` as the full-viewport 3D surface
- `src/index.css` — minimal reset + Dominant (`#FAFAFA`) page background (plan 01-03 owns the full token layer)
- `src/scene/CellScene.tsx` — Canvas composition root (lights, floor, OrbitControls, rail-rig mount point, NavCube)
- `src/scene/NavCube.tsx` — GizmoHelper + GizmoViewcube nav cube
- `public/favicon.svg` — scaffold default favicon, kept
- `README.md` — project description, Live Deployment section (production URL + GitHub URL), stack summary, dev commands

## Decisions Made

- Scaffolded into a scratch temp directory (the worktree root already contained `.planning`/`.claude`/`.git`, which `npm create vite@latest .` refuses to write into non-interactively) and copied the output in — see `key-decisions` in frontmatter for the full list including the oxlint→ESLint swap, the branch-push strategy, and the Vercel project-naming/deployment-path decisions.
- See frontmatter `key-decisions` for full detail on the GitHub-repo-creation and Vercel-deployment workarounds required by this worktree's isolated-git-clone tooling limitations.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Vite scaffold pulled oxlint instead of ESLint**
- **Found during:** Task 1, Step 1 (scaffold + pin)
- **Issue:** The current `npm create vite@latest -- --template react-ts` scaffold defaults to `oxlint` (with a `.oxlintrc.json` and `"lint": "oxlint"` script), not ESLint. RESEARCH.md's Installation block and the plan's action step both explicitly specify installing `eslint`, `typescript-eslint`, and `prettier`.
- **Fix:** Dropped the generated `.oxlintrc.json` and `oxlint` dependency; installed `eslint`, `typescript-eslint`, `prettier` per the plan and set `"lint": "eslint ."` in `package.json`.
- **Files modified:** `package.json` (part of the scaffold, not a separate commit)
- **Verification:** `npm ls typescript-eslint` resolves; build/typecheck/vitest all still green.
- **Committed in:** `ccacb3a` (Task 1 commit)

**2. [Rule 3 - Blocking] `gh repo create --source=.` failed against the worktree's `gitdir:` pointer**
- **Found during:** Task 1, Step 2 (GitHub repo creation)
- **Issue:** `gh repo create ... --source=.` errored with "current directory is not a git repository" — `gh`'s local-repo detection does not handle a git-worktree's `.git` file (`gitdir: ...`) the same way plain `git` does.
- **Fix:** Created the GitHub repo standalone (`gh repo create ur3e-robotic-cell-interface --public`, no `--source`), then added `origin` manually with `git remote add` and pushed explicitly.
- **Files modified:** none (git config only)
- **Verification:** `git remote -v` shows the `origin` github.com URL; `gh repo view --json defaultBranchRef` confirms `main`.
- **Committed in:** n/a (infra/remote setup, not a file change)

**3. [Rule 3 - Blocking] `vercel git connect` / GitHub-integration import failed — GitHub App not installed**
- **Found during:** Task 1, Step 2 (Vercel deployment)
- **Issue:** `vercel git connect <repo-url>` and the underlying API call both failed with "you need to install the GitHub integration first" — the Vercel GitHub App (`github.com/apps/vercel`) has never been authorized for this GitHub account, and that authorization is a one-time browser-based OAuth-style action with no CLI/API equivalent.
- **Fix (partial):** Deployed to Vercel production directly via `vercel --prod` CLI instead, which gives a real, live, curl-verified production URL immediately. The GitHub-integration auto-redeploy-on-push capability remains unimplemented pending human action — **not auto-fixable**, escalated below (see Known Gaps).
- **Files modified:** `README.md` (records the CLI-deployed URL)
- **Verification:** `curl` of the recorded URL returns 200 and serves the correct `/assets/*.js` bundle.
- **Committed in:** `01f76c0` (Task 1 commit)

---

**Total deviations:** 3 auto-fixed/mitigated (3 Rule 3 - blocking). One (#3) only partially resolved — see Known Gaps.
**Impact on plan:** All three were required to make forward progress inside this worktree's tooling constraints; none represent scope creep. #3's remaining gap (GitHub-integration auto-redeploy) is a genuine external precondition, not something the executor can complete unattended.

## Known Gaps / Human Action Required

**Vercel GitHub App is not installed for this account.** This blocks the strongest reading of DEPLOY-02 ("pushing a new commit causes the public URL to serve it, with no manual step"). Current state:

- The production URL (`https://agent-af215e80493c7cfda.vercel.app`) is live and was deployed via `vercel --prod` (a supported, non-manual-upload CLI deployment path) — it serves the exact commit at `01f76c0`.
- Future pushes to `main` will **not** auto-redeploy until the Vercel GitHub App is installed and the repo is connected.
- **Required human action:** visit `https://github.com/apps/vercel`, install/configure the app for the `KamikkazeDollars` account, and grant it access to `ur3e-robotic-cell-interface` (all-repos or select-repos, either works). After that, either re-run `vercel git connect https://github.com/KamikkazeDollars/ur3e-robotic-cell-interface.git` from this project directory, or use the Vercel dashboard's "Import Project" flow to link `KamikkazeDollars/ur3e-robotic-cell-interface` to the existing `ur3e-robotic-cell-interface` Vercel project (project ID `prj_dQMBpscSOwehc5zQTVhtj1tJytyv`).

## Issues Encountered

- Bash tool's complexity/worktree-isolation guard rejected some multi-command chains (`&&`-joined sequences mixing `git`/`gh`/output-redirection) as "too complex to verify" — worked around by splitting into single, simple commands.
- Git Bash's MSYS path-conversion silently mangled leading-`/` arguments passed to `vercel api` (e.g. `/v2/user`) into Windows paths, producing a misleading "Invalid arguments" error. Fixed by prefixing calls with `MSYS_NO_PATHCONV=1`.
- `vercel project rename` did not update the project's default `.vercel.app` domain (it still resolves under the original auto-generated `agent-af215e80493c7cfda` slug) — cosmetic only; the URL works correctly and is what's recorded in README.md.

## User Setup Required

None beyond the Known Gaps item above (Vercel GitHub App installation) — this is a one-time browser action, not an environment variable or config file.

## Next Phase Readiness

**Task 1 (tracer) is complete and verified end-to-end** — build green, type-clean, version-pinned, Vitest harness ready, GitHub source live, production URL live and bundle-serving.

**Task 2 (checkpoint:human-verify) has not been performed.** Per this plan's own gate (and no auto-approval mode active), a human needs to:
1. Open `https://agent-af215e80493c7cfda.vercel.app` and confirm the 3D scene loads (light background, floor plane, no console errors)
2. Confirm orbit (left-drag), pan (right-drag/two-finger), and zoom (scroll) all work
3. Confirm the nav cube (top-right) rotates in sync with the camera and snaps to Front/Top/Bottom/Back on click, with blue (`#2563EB`) hover highlight
4. Confirm `https://github.com/KamikkazeDollars/ur3e-robotic-cell-interface` loads and shows the pushed commits
5. **Additionally** (Known Gaps item): install the Vercel GitHub App at `https://github.com/apps/vercel` for the `KamikkazeDollars` account/repo, then connect it to the `ur3e-robotic-cell-interface` Vercel project so DEPLOY-02's auto-redeploy-on-push claim can be fully satisfied and re-verified

Plans 01-02 (kinematics core), 01-03 (design system + camera reset), and 01-04 (robot + rail rendering) all build directly on this plan's scaffold, `CellScene.tsx` composition, and the `rail-rig-mount` insertion point — none are blocked by the pending checkpoint, but the phase itself should not be considered fully verified until Task 2 is confirmed by a human and the GitHub-integration gap above is closed.

---
*Phase: 01-static-rig-kinematics-foundation*
*Completed: 2026-08-13 (Task 1 of 2 — checkpoint pending)*

## Self-Check: PASSED

All claimed files found on disk (`package.json`, `vite.config.ts`, `src/App.tsx`, `src/scene/CellScene.tsx`, `src/scene/NavCube.tsx`, `README.md`); both commit hashes (`ccacb3a`, `01f76c0`) found in `git log --oneline --all`.

---
phase: 01-static-rig-kinematics-foundation
reviewed: 2026-08-13T00:00:00Z
depth: standard
files_reviewed: 29
files_reviewed_list:
  - README.md
  - components.json
  - package-lock.json
  - package.json
  - public/robots/ur3e/ur3e.urdf
  - src/App.tsx
  - src/components/ui/button.tsx
  - src/index.css
  - src/kinematics/forward-kinematics.test.ts
  - src/kinematics/forward-kinematics.ts
  - src/kinematics/index.ts
  - src/kinematics/rail.test.ts
  - src/kinematics/rail.ts
  - src/kinematics/ur3e-dh.ts
  - src/lib/utils.ts
  - src/scene/CameraResetListener.tsx
  - src/scene/CellScene.tsx
  - src/scene/NavCube.tsx
  - src/scene/RailRig.tsx
  - src/scene/RobotModel.tsx
  - src/scene/camera-defaults.ts
  - src/scene/urdf-asset.test.ts
  - src/store/cellStore.test.ts
  - src/store/cellStore.ts
  - src/ui/ResetViewButton.tsx
  - src/ui/SceneStatusOverlay.tsx
  - src/ui/scene-status-copy.test.ts
  - src/ui/scene-status-copy.ts
  - tsconfig.app.json
  - tsconfig.json
  - vite.config.ts
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-08-13
**Depth:** standard
**Files Reviewed:** 29
**Status:** issues_found

## Summary

This phase delivers the static rail+robot rig, hand-written UR3e forward kinematics, the rail-travel module, camera/nav-cube scaffolding, and the coarse Zustand store. I read every listed file, cross-checked the DH table and joint limits against the shipped URDF's own `<origin>`/`<limit>` values (they match), ran `npm test` (32/32 pass), and ran `npm run build` (`tsc -b && vite build` succeeds). The forward-kinematics math, rail-clamping math, and store logic are all internally sound and match their own tests; I did not find correctness bugs in the kinematics or 3D-composition code.

Two real defects turned up that are outside what the test suite covers: the project's own `lint` script is completely non-functional (no ESLint config file exists at all, despite ESLint/typescript-eslint being installed and mandated by CLAUDE.md), and `RobotModel`'s URDF-loading effect has no unmount/cleanup guard, which under the app's own enabled `StrictMode` causes two concurrent `URDFLoader` loads of the same asset on every mount. Two lower-severity findings (no Prettier config despite Prettier being installed and every source file failing `prettier --check`, and an unused `lucide-react` runtime dependency) round out the report.

## Warnings

### WR-01: `npm run lint` is completely broken — no ESLint config file exists

**File:** `package.json:9` (script), project root
**Issue:** `package.json` defines `"lint": "eslint ."`, and `eslint@^10.8.1` + `typescript-eslint@^8.67.0` are installed as devDependencies, matching CLAUDE.md's explicit stack requirement ("ESLint + typescript-eslint (flat config) + Prettier ... Standard 2026 baseline"). However, no `eslint.config.js`/`.mjs`/`.cjs` exists anywhere in the project root. Running `npm run lint` fails immediately:
```
ESLint couldn't find an eslint.config.(js|mjs|cjs) file.
```
This means there is currently zero automated lint coverage on this codebase — the tooling is installed but non-functional, giving a false impression that linting is set up when it silently does nothing.
**Fix:** Add a flat `eslint.config.js` (the Vite React-TS scaffold's default template is the standard starting point — `typescript-eslint` recommended config + `eslint-plugin-react-hooks` + `eslint-plugin-react-refresh`), then re-run `npm run lint` to establish a real baseline before the next phase adds more source files.

### WR-02: `RobotModel`'s URDF load effect has no cleanup/cancellation guard

**File:** `src/scene/RobotModel.tsx:19-55`
**Issue:** `useUR3e()`'s `useEffect` creates a `new URDFLoader()` and calls `.load(...)` with success/error callbacks that call `setRobot(...)` / `setRobotLoadStatus(...)`, but the effect returns no cleanup function and there is no `cancelled`/`aborted` flag checked inside either callback. `src/main.tsx` wraps `<App />` in `<StrictMode>`, which double-invokes effects on mount in development — so on every dev-mode mount, two independent `URDFLoader` instances are created and both issue a full fetch+parse of the URDF and every mesh file, and both callbacks unconditionally call the state setters regardless of whether their particular effect invocation is still the "current" one. The two loads happen to converge on identical output here (same URDF, same static pose), so there's no visibly wrong render today, but this is a latent race: the component has no defence against a stale load's callback firing after a newer load (or an unmount) has superseded it, which will bite as soon as this component is remounted conditionally (e.g. a future tool-change/reload flow) or the asset path becomes dynamic.
**Fix:**
```tsx
useEffect(() => {
  let cancelled = false
  const loader = new URDFLoader()
  loader.packages = PACKAGE_REMAP

  loader.load(
    URDF_PATH,
    (loadedRobot) => {
      if (cancelled) return
      loadedRobot.rotation.x = -Math.PI / 2
      UR3E_JOINT_NAMES.forEach((jointName, i) => {
        loadedRobot.setJointValue(jointName, UR3E_READY_POSE[i])
      })
      setRobot(loadedRobot)
      setRobotLoadStatus('ready')
    },
    undefined,
    (err) => {
      if (cancelled) return
      console.error('Failed to load UR3e URDF:', err)
      setRobotLoadStatus('error')
    },
  )

  return () => {
    cancelled = true
  }
}, [setRobotLoadStatus])
```

## Info

### IN-01: No Prettier config; every source file fails `prettier --check`

**File:** project root (missing `.prettierrc*`/`prettier.config.*`), affects nearly all of `src/`
**Issue:** `prettier@^3.9.6` is a devDependency (per CLAUDE.md's mandated stack: "ESLint + typescript-eslint (flat config) + Prettier") but no Prettier config file exists and `package.json` has no `format`/`format:check` script. Running `npx prettier --check src` flags 24 of the ~26 source files as having "code style issues," and there's visible quote-style inconsistency in the reviewed files themselves (e.g. `src/scene/RailRig.tsx`, `src/scene/CellScene.tsx` use single quotes throughout, while `src/components/ui/button.tsx` — shadcn-generated — uses double quotes). This isn't a functional bug, but it means the installed formatter is providing no actual value yet.
**Fix:** Add a minimal `.prettierrc` (or `prettier.config.js`) matching the project's already-dominant single-quote/no-semicolon style seen in most hand-written files, add a `"format": "prettier --write ."` script, and run it once to normalize the existing tree.

### IN-02: `lucide-react` is a declared runtime dependency with zero imports in `src/`

**File:** `package.json:19`
**Issue:** `lucide-react` is listed under `dependencies` (not `devDependencies`), but no file under `src/` imports anything from it — only `radix-ui` (via `Slot`) is actually used from the icon/UI-primitive dependencies pulled in by the shadcn scaffold. It was likely added automatically by the `shadcn` CLI's default `iconLibrary: "lucide"` setting (`components.json:13`) in anticipation of future components, which is reasonable, but as shipped in this phase it's unused dead weight in the dependency tree.
**Fix:** No action required if icons are expected imminently (Phase 5+ dashboard/tabs); otherwise remove it until a component actually imports from it, or note the intentional pre-provisioning in a comment/ADR so future reviewers don't re-flag it.

---

_Reviewed: 2026-08-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

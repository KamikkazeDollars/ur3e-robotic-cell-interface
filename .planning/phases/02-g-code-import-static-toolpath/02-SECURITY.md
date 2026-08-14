---
phase: 02
slug: g-code-import-static-toolpath
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-08-14
---

# Phase 02 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| npm registry → build | Third-party parser packages (`gcode-toolpath`, `gcode-parser`) enter the build and shipped bundle | Package source code |
| bundled `.gcode` asset → parser | Developer-authored text crosses into a parser whose output drives WebGL geometry (not attacker-controlled this phase, but the same entry point a future upload feature would reuse) | G-code text |
| parser output → WebGL scene / camera / workbench geometry | Numeric output crosses into `Line`/`boxGeometry`/camera-position math where a non-finite or degenerate value could propagate silently | Coordinates, bounds |
| caught parser/fetch exception → DOM | An exception message rendered verbatim could leak internal paths or library internals into the page | Error state only (never exception text) |
| concurrent user selections → single store slot | Two in-flight sample loads racing for one piece of Zustand state | Request ordering |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-02-01 | Tampering | `npm install gcode-toolpath` / `gcode-parser` (both flagged `SUS`) | high | mitigate | Blocking, never-auto-approvable `checkpoint:human-verify` ran before any install; user explicitly typed approval after reviewing npm/GitHub source; versions pinned to audited `^3.0`/`^2.2` | closed |
| T-02-SC | Tampering | npm installs (supply chain) | high | mitigate | Same package-legitimacy gate as T-02-01; `vite-plugin-node-polyfills` returned `OK` (1.5M weekly downloads) and needed no gate | closed |
| T-02-02 | Denial of Service | `src/gcode/parseToolpath.ts` | medium | mitigate | `isFiniteVector` rejects non-finite coordinates upstream of the bounds pass; `MAX_TOOLPATH_SEGMENTS` (5000) ceiling truncates runaway input; both increment `skippedMotionCount` instead of throwing/hanging — verified present in source | closed |
| T-02-03 | Denial of Service | `fetch('/gcode/*.gcode')` | low | accept | Same-origin static assets bundled with the app (D-01); no user-supplied URL or upload path exists this phase | closed |
| T-02-04 | Information Disclosure | `cellStore.ts` catch block / `SceneStatusOverlay.tsx` | medium | mitigate | Caught exception is passed only to `console.error` (dev console, never rendered); confirmed zero occurrences of `err.message`/`error.stack`/`.stack` anywhere in `src/`; overlay renders fixed copy from `scene-status-copy.ts` only | closed |
| T-02-05 | Spoofing | — | low | accept | No authentication, session or identity surface exists anywhere in this app (PROJECT.md: client-side simulation only) | closed |
| T-02-06 | Repudiation | — | low | accept | No multi-user actions, audit trail requirement, or persistence exists | closed |
| T-02-07 | Tampering | `public/gcode/*.gcode` (a later edit silently changing what the demo shows) | low | mitigate | Asset-integrity tests (`parseToolpath.test.ts`, `toolpath-anchor.test.ts`) read the shipped fixtures from disk and fail on any change to move-type counts or feed rates | closed |
| T-02-08 | Denial of Service | `src/gcode/arcTessellation.ts` | medium | mitigate | Swept angle normalized into a bounded interval; point count capped by fixed `ARC_SEGMENTS_PER_TURN = 64`, confirmed in source — a degenerate or full-turn arc cannot produce an unbounded loop | closed |
| T-02-09 | Information Disclosure | test fixtures and assertions | low | accept | Both fixtures are hand-authored geometry with no secrets, credentials, or personal data | closed |
| T-02-10 | Tampering | `selectSample` concurrent invocations | medium | mitigate | Monotonic `selectSampleRequestId` counter (confirmed in `cellStore.ts`) discards any response whose request has been superseded, on both success and failure branches | closed |
| T-02-11 | Denial of Service | `src/scene/ToolpathCameraFit.tsx` | medium | mitigate | Effect returns early on null bounds and on a zero/non-finite largest dimension (`if (!Number.isFinite(size) || size <= 0) return`, confirmed present and unmodified by the CR-01 fix) — a degenerate toolpath cannot blank the canvas | closed |
| T-02-12 | Repudiation | refused-command disclosure | low | mitigate | `skippedMotionCount` surfaced in `SampleSelect.tsx` UI (confirmed in source) — a partially-parsed file cannot be presented as a complete job | closed |
| T-02-13 | Denial of Service | `src/scene/Workbench.tsx` derived dimensions | low | mitigate | Every dimension derives from fixed, positive imported constants at module load (never user-controlled/runtime data); `npm run build` plus the live visual check (this session) confirm no degenerate geometry | closed |
| T-02-14 | Denial of Service | `src/scene/Toolpath.tsx` marker rendering | low | accept | Exactly two additional mesh elements regardless of toolpath size (one start, one end) — rendering cost does not scale with segment count | closed |

*Status: open · closed · open — below {block_on} threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-02-01 | T-02-03 | Fetching bundled same-origin `.gcode` assets carries no injectable-URL risk; no upload path exists this phase | Orchestrator (per PLAN.md disposition) | 2026-08-14 |
| R-02-02 | T-02-05 | No authentication/session surface exists anywhere in this client-side simulation app | Orchestrator (per PLAN.md disposition) | 2026-08-14 |
| R-02-03 | T-02-06 | No multi-user actions or persistence exists; repudiation is not applicable | Orchestrator (per PLAN.md disposition) | 2026-08-14 |
| R-02-04 | T-02-09 | Test fixtures are hand-authored geometry with no secrets or personal data | Orchestrator (per PLAN.md disposition) | 2026-08-14 |
| R-02-05 | T-02-14 | Marker rendering cost is fixed (2 meshes) regardless of toolpath size — no scaling DoS surface | Orchestrator (per PLAN.md disposition) | 2026-08-14 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-14 | 14 | 14 | 0 | Orchestrator (Claude, L1 grep-depth verification against threat register authored at plan time across 02-01 through 02-05) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-14

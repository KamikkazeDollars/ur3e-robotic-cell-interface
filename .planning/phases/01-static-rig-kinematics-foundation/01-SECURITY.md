---
phase: 01
slug: static-rig-kinematics-foundation
status: verified
threats_open: 0
asvs_level: 1
created: 2026-08-13
---

# Phase 01 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| npm registry → build machine | Untrusted third-party package code executes at install/build time (install scripts, transitive deps) | Package source code |
| build output → public internet | The Vercel production URL is world-readable; anything bundled into `dist/` is public | Bundled JS/CSS/assets |
| developer machine → GitHub/Vercel | Credentials/tokens cross this boundary during repo creation and deploy authorization | Auth tokens |
| shadcn registry → source tree | The design-system CLI writes registry-authored component source directly into `src/components/ui/`, compiled and shipped like first-party code | Generated component source |
| third-party asset host → repository | The UR3e robot description and its meshes are fetched from community/vendor GitHub repositories and committed as code the deployed app renders | URDF XML + Collada/STL mesh files |
| committed assets → browser parser | The description is XML, meshes are Collada/STL, all parsed client-side by the loader | Parsed 3D geometry |

No backend, database, authentication, or user-input surface exists anywhere in this phase — this is a static, client-side-only SPA (per REQUIREMENTS.md Out of Scope).

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-01-SC | Tampering | npm installs (pinned runtime/dev stack) | high | mitigate | Package-legitimacy audit (RESEARCH.md) ran over all 15 packages — zero `[SLOP]`; every `[SUS]` verdict traced to canonical high-download packages. Post-install spot-check confirmed expected versions; `package-lock.json` committed to freeze the resolved tree. | closed |
| T-01-07 | Tampering | npm install of shadcn/ui CLI dependency set (Tailwind, CVA, clsx, tailwind-merge, lucide-react, Radix Slot) | high | mitigate | Absent from RESEARCH.md's audit, so gated by a blocking human checkpoint (01-03 Task 1) verifying registry page, source org, and download volume per package before install. `package-lock.json` committed; verify gate re-asserted TS 5.9/Vite 7 pins post-install. | closed |
| T-01-10 | Tampering | UR3e description + meshes sourced from a community dataset repo, shipped in the public bundle | high | mitigate | Assets fetched once at build-setup time (never at runtime) and committed — any later change is a reviewable diff, not a silent swap. `src/scene/urdf-asset.test.ts` machine-verifies the description's 6 joint names and DH offsets (5-decimal match) against `UR3E_DH`, and proves every referenced mesh resolves. Confirmed passing (32/32 suite, re-run 2026-08-13). | closed |
| T-01-02 | Information Disclosure | Vite static build published to a public URL | medium | mitigate | No secrets exist (client-only SPA, no backend/API keys). `.gitignore` covers `.env`; no `VITE_`-prefixed var introduced. Verified: no env-var read anywhere in `src/`. | closed |
| T-01-05 | Tampering | `src/kinematics/ur3e-dh.ts` constant table (integrity of DH values later phases consume unverified) | medium | mitigate | Transcribed only from RESEARCH.md, cross-verified against two independent official sources. Machine-checked end-to-end: the reference-pose test fails on any single-digit transcription error. | closed |
| T-01-06 | Tampering | Self-confirming test risk (assertions generated from implementation's own output) | medium | mitigate | Reference literals typed in from RESEARCH.md as acceptance criteria; tests written and confirmed red before implementation. | closed |
| T-01-08 | Tampering | Registry-authored `src/components/ui/button.tsx` written directly into the source tree | medium | mitigate | UI-SPEC restricts to the shadcn official registry, single `Button` block, no third-party registry configured (verify gate asserts `components.json`). Generated file reviewed as a git diff before commit. | closed |
| T-01-03 | Denial of Service | Client WebGL context / bundle size on the public URL | low | accept | Single-user interview demo, entirely client-side; no shared resource to exhaust. | closed |
| T-01-04 | Spoofing / Repudiation / Elevation of Privilege | Entire application — no auth/session/account/access-control surface | low | accept | No authentication, session, account, or access-control surface exists anywhere in this project (REQUIREMENTS.md Out of Scope). ASVS L1 V2/V3/V4 not applicable; recorded as deliberate. | closed |
| T-01-09 | Information Disclosure | Rebuilt static bundle republished to the public URL | low | accept | No secret to disclose; the design-token layer is public-by-construction UI metadata. | closed |
| T-01-13 | Denial of Service | Client bundle growth from Tailwind + Radix on the public URL | low | accept | Build-time bounded, single-user demo, client-side only; no shared resource to exhaust. | closed |
| T-01-11 | Spoofing | Loader's package-URI remap target | low | mitigate | Remap points at a same-origin path under the app's own public directory; no remote origin/CDN configured, so mesh resolution cannot be redirected to a third-party host at runtime. | closed |
| T-01-14 | Information Disclosure | Robot description + meshes served from the public URL | low | accept | Publicly published by the vendor and open dataset repos; nothing proprietary, personal, or secret. | closed |
| T-01-12 | Denial of Service | Mesh payload size on first load of the public URL | low | accept | Build-time bounded, fetched once per visitor, single-user demo; loading-state UI (Plan 01-04) makes a slow fetch legible rather than a silent hang. | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `workflow.security_block_on` (high) count toward `threats_open`*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

All threat registers were authored at plan time (each of the four `01-0N-PLAN.md` files contains a `<threat_model>` block); no `## Threat Flags` entries were raised in any `SUMMARY.md`. Preliminary classification confirms every threat closed under ASVS Level 1 (`threats_open: 0`), so per the workflow's short-circuit rule this audit did not require spawning `gsd-security-auditor` — deep L2/L3 verification is reserved for higher ASVS levels.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01-01 | T-01-03, T-01-04, T-01-09, T-01-13, T-01-14, T-01-12 | Single-user, client-side-only interview demo with no backend, auth, or shared server resource — no meaningful attack surface for these categories at this scale. | Phase 01 threat model (plans 01-01 through 01-04) | 2026-08-13 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-13 | 14 | 14 | 0 | Claude (gsd-secure-phase, short-circuit path) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-13

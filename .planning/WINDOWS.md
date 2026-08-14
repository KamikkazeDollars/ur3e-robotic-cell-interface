---
schema_version: 1
open_count: 2
waived_count: 0
fixed_count: 0
total_count: 2
last_updated: 2026-08-14T23:43:38.480Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 03 | deviation | src/trajectory/compile.ts |  | Travel-move waypoint routing still clips through the table per live visual test, despite a passing automated regression test and analytical footprint check (see 03-01-SUMMARY.md Known Issues) | open |  | 2026-08-14T17:34:59.460Z |  |
| 2 | quick | unrun-verify | src/App.tsx |  | npm run dev visual pass not independently verified (no browser tooling) — Red+Dark Grey DOM/canvas visual confirmation for quick plan 260815-3cn still needs a human pass | open |  | 2026-08-14T23:43:38.480Z |  |

````json
[
  {
    "id": 1,
    "kind": "deviation",
    "phase": "03",
    "file": "src/trajectory/compile.ts",
    "line": null,
    "description": "Travel-move waypoint routing still clips through the table per live visual test, despite a passing automated regression test and analytical footprint check (see 03-01-SUMMARY.md Known Issues)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-14T17:34:59.460Z",
    "resolved_at": null
  },
  {
    "id": 2,
    "kind": "unrun-verify",
    "phase": "quick",
    "file": "src/App.tsx",
    "line": null,
    "description": "npm run dev visual pass not independently verified (no browser tooling) — Red+Dark Grey DOM/canvas visual confirmation for quick plan 260815-3cn still needs a human pass",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-14T23:43:38.480Z",
    "resolved_at": null
  }
]
````


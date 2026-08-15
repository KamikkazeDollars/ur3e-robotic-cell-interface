# Deferred Items

## `npm run lint` fails project-wide — missing `eslint.config.js`

**Found during:** Plan 03-04, Task 2 verification (`npx tsc -b && npm run lint`)

**Issue:** `npm run lint` (`eslint .`) fails with `ESLint couldn't find an eslint.config.(js|mjs|cjs) file.`
No ESLint flat-config file exists anywhere in the repo root. This predates plan 03-04 — it is not caused
by this plan's changes (verified: `find . -maxdepth 1 -iname "eslint*"` returns nothing before or after
this plan's edits) and is out of scope per the executor's scope boundary (only auto-fix issues directly
caused by the current task's changes).

**Not fixed here because:** Standing up an ESLint flat config for the whole project is a repo-wide
tooling/config decision (which rules, which plugins, `typescript-eslint` version pairing per CLAUDE.md's
"What NOT to Use" TS 7.0 warning) — out of scope for a scene-color gap-closure plan and risks masking
unrelated pre-existing lint debt under this plan's commit.

**Recommendation:** A future plan (or a `/gsd-quick` task) should scaffold `eslint.config.js` per the
project's stack recommendation (ESLint 9.x flat config + `typescript-eslint` paired to TS 5.9.x) so
`npm run lint` becomes a real, always-available verification gate for future plans instead of a permanent
no-op.

// Shared `CellMode` union, deliberately living at the source root rather
// than inside a feature folder (G-04-1 gap closure, 04-05-PLAN.md). Three
// independent layers now need this type: UI chrome (`uiShellStore`,
// `ModeBar`), domain data (`src/gcode/samples.ts`), and — once plan 04-06
// lands — rail geometry under `src/kinematics`. A type-only module with no
// imports of its own lets all three reach it without `src/gcode` or
// `src/kinematics` taking a dependency on `src/store`, which would invert
// this project's layering (store is UI-facing; gcode/kinematics are not).
export type CellMode = 'printing' | 'milling'

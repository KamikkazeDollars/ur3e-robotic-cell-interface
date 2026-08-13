// Minimal ambient type declarations for `gcode-parser` and `gcode-toolpath`
// (neither package ships its own .d.ts — verified this session by reading
// their shipped `package.json`, no `"types"` field present). Shapes below
// are transcribed directly from 02-RESEARCH.md Pattern 1/Pattern 2, which
// were themselves verified by reading the packages' actual shipped source
// via `npm pack`, not guessed from docs. Only the surface this app actually
// calls is declared.

declare module 'gcode-parser' {
  /** A single tokenized word: `['F', 1200]`, `['X', 10]`, `['G', 1]`, etc.
   * The value is the original string when it fails to parse as a number
   * (gcode-parser's own `parseLine`, verbatim behavior). */
  export type GCodeWord = [string, number | string]

  export interface GCodeParsedLine {
    line: string
    words: GCodeWord[]
    ln?: number
    cs?: number
    err?: boolean
    cmds?: string[]
    comments?: string[]
  }

  export function parseStringSync(
    str: string,
    options?: Record<string, unknown>,
  ): GCodeParsedLine[]
}

declare module 'gcode-toolpath' {
  /** The interpreter's modal state object — verbatim keys from
   * gcode-toolpath@3.0.0's `Toolpath.js` constructor default. `feedrate`
   * here is a MODE flag (G93/G94/G95), never a numeric rate — see
   * 02-RESEARCH.md Pitfall A. Never read it expecting a number. */
  export interface GCodeModal {
    motion: string
    wcs: string
    plane: string
    units: string
    distance: string
    arc: string
    feedrate: string
    cutter: string
    tlo: string
    program: string
    spindle: string
    coolant: string
    tool: number
  }

  /** A position/offset vector in the file's own units (mm for this app's
   * G21-only bundled samples). */
  export interface GCodeVector {
    x: number
    y: number
    z: number
  }

  export interface ToolpathOptions {
    position?: Partial<GCodeVector>
    modal?: Partial<GCodeModal>
    /** v1 = segment start, v2 = segment end, both already G92-offset-corrected. */
    addLine?: (modal: GCodeModal, v1: GCodeVector, v2: GCodeVector) => void
    /** v1 = arc start, v2 = arc end, v0 = arc CENTER (not a "fixed point" —
     * verified via source read, 02-RESEARCH.md Pattern 1). Direction (CW/CCW)
     * must be read from `modal.motion` ('G2'/'G3'), never a boolean param. */
    addArcCurve?: (
      modal: GCodeModal,
      v1: GCodeVector,
      v2: GCodeVector,
      v0: GCodeVector,
    ) => void
  }

  /** The object `new Toolpath(...)` actually returns — an instance of
   * gcode-interpreter's `Interpreter` class, not `Toolpath` itself
   * (gcode-toolpath's constructor ends with `return toolpath`, verified via
   * source read). Declared as an explicit construct-signature return type
   * below since TS class syntax can't otherwise express "constructor returns
   * a different type than its own instance". */
  export interface ToolpathInterpreter {
    loadFromStringSync(str: string): ToolpathInterpreter
  }

  interface ToolpathConstructor {
    new (options?: ToolpathOptions): ToolpathInterpreter
  }

  const Toolpath: ToolpathConstructor
  export default Toolpath
}

import {
  CARRIAGE_FRONT_FACE_Z,
  TOOLPATH_ANCHOR_OFFSET,
  WORKBENCH_TOP_Y,
} from '../gcode/toolpath-anchor'

// UI-SPEC Secondary tone (#E4E7EB) — the same tone RailRig.tsx and
// CellScene.tsx's floor plane already use. No new color is introduced here.
const SECONDARY_TONE = '#E4E7EB'

// Small explicit standoff beyond the carriage's own front face so the
// tabletop's near edge can never touch the carriage — independent of
// TOOLPATH_CLEARANCE_MARGIN, which governs how far the toolpath floats
// beyond the tabletop, not the tabletop's own footprint.
const NEAR_EDGE_STANDOFF = 0.02

// Generous pad beyond the toolpath anchor's own Z so both bundled samples'
// full Z extents stay on the tabletop, not hanging off its far edge.
const FAR_EDGE_PAD = 0.15

// Tabletop width (X), generous enough to cover both samples' X spans with margin.
const TABLETOP_WIDTH = 0.5

// Tabletop slab thickness (Y).
const TABLETOP_THICKNESS = 0.04

// Leg cross-section (square) and how far each leg is inset from the
// tabletop's actual edges, so the four legs read as structural supports
// rather than corner posts flush with the tabletop's own edges.
const LEG_SECTION = 0.03
const LEG_INSET = 0.04

// Derived tabletop Z span: never a second, independently guessed literal —
// both edges trace back to the carriage front face / toolpath anchor.
const TABLETOP_NEAR_Z = CARRIAGE_FRONT_FACE_Z + NEAR_EDGE_STANDOFF
const TABLETOP_FAR_Z = TOOLPATH_ANCHOR_OFFSET.z + FAR_EDGE_PAD
const TABLETOP_DEPTH = TABLETOP_FAR_Z - TABLETOP_NEAR_Z
const TABLETOP_CENTER_Z = TABLETOP_NEAR_Z + TABLETOP_DEPTH / 2

// Tabletop's *top* surface, not its centre, must land exactly at
// WORKBENCH_TOP_Y (the same value the toolpath anchor's Y reads).
const TABLETOP_CENTER_Y = WORKBENCH_TOP_Y - TABLETOP_THICKNESS / 2

// Legs reach from the floor (world Y = 0) up to the tabletop's underside.
const LEG_HEIGHT = WORKBENCH_TOP_Y - TABLETOP_THICKNESS
const LEG_CENTER_Y = LEG_HEIGHT / 2

const LEG_HALF_WIDTH = TABLETOP_WIDTH / 2 - LEG_INSET
const LEG_X_OFFSETS = [-LEG_HALF_WIDTH, LEG_HALF_WIDTH] as const
const LEG_Z_POSITIONS = [TABLETOP_NEAR_Z + LEG_INSET, TABLETOP_FAR_Z - LEG_INSET] as const

/**
 * G-02-01: a simple table the toolpath visibly rests on — one flat tabletop
 * slab plus four square-section legs reaching to the floor. Every dimension
 * is derived from `src/gcode/toolpath-anchor.ts`'s exported constants
 * (`CARRIAGE_FRONT_FACE_Z`, `TOOLPATH_ANCHOR_OFFSET`, `WORKBENCH_TOP_Y`) —
 * this component never restates the toolpath's anchor position or the
 * carriage's front face as a second, independently guessed literal.
 */
export default function Workbench() {
  return (
    <group>
      <mesh
        position={[TOOLPATH_ANCHOR_OFFSET.x, TABLETOP_CENTER_Y, TABLETOP_CENTER_Z]}
        receiveShadow
        castShadow
      >
        <boxGeometry args={[TABLETOP_WIDTH, TABLETOP_THICKNESS, TABLETOP_DEPTH]} />
        <meshStandardMaterial color={SECONDARY_TONE} />
      </mesh>

      {LEG_X_OFFSETS.map((xOffset) =>
        LEG_Z_POSITIONS.map((z) => (
          <mesh
            key={`${xOffset}-${z}`}
            position={[TOOLPATH_ANCHOR_OFFSET.x + xOffset, LEG_CENTER_Y, z]}
            castShadow
          >
            <boxGeometry args={[LEG_SECTION, LEG_HEIGHT, LEG_SECTION]} />
            <meshStandardMaterial color={SECONDARY_TONE} />
          </mesh>
        )),
      )}
    </group>
  )
}

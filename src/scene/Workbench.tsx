import {
  WORKBENCH_TOP_Y,
  WORKBENCH_WIDTH_X,
  WORKBENCH_THICKNESS_Y,
  WORKBENCH_NEAR_Z,
  WORKBENCH_FAR_Z,
  toolpathAnchorForMode,
} from '../gcode/toolpath-anchor'
import { useUiShellStore } from '../store/uiShellStore'
import { SCENE_PALETTE } from './scene-palette'

// The bench is a deliberately distinct mid tone (SCENE_PALETTE.workbench),
// chosen so the toolpath drawn on this surface stays readable against it.

// U-2: the footprint constants this component used to declare privately
// (NEAR_EDGE_STANDOFF, FAR_EDGE_PAD, TABLETOP_WIDTH, TABLETOP_THICKNESS, and
// the derived near/far Z edges) now live in `src/gcode/toolpath-anchor.ts`
// as WORKBENCH_WIDTH_X / WORKBENCH_THICKNESS_Y / WORKBENCH_NEAR_Z /
// WORKBENCH_FAR_Z, so both the rendered bench and the pose-collision
// envelope (`src/collision/pose-collision.ts`) read one footprint. This
// component derives its remaining locals from those imports — the rendered
// bench is pixel-identical to before, this is a move, not a redesign.

// Leg cross-section (square) and how far each leg is inset from the
// tabletop's actual edges, so the four legs read as structural supports
// rather than corner posts flush with the tabletop's own edges.
const LEG_SECTION = 0.03
const LEG_INSET = 0.04

const TABLETOP_DEPTH = WORKBENCH_FAR_Z - WORKBENCH_NEAR_Z
const TABLETOP_CENTER_Z = WORKBENCH_NEAR_Z + TABLETOP_DEPTH / 2

// Tabletop's *top* surface, not its centre, must land exactly at
// WORKBENCH_TOP_Y (the same value the toolpath anchor's Y reads).
const TABLETOP_CENTER_Y = WORKBENCH_TOP_Y - WORKBENCH_THICKNESS_Y / 2

// Legs reach from the floor (world Y = 0) up to the tabletop's underside.
const LEG_HEIGHT = WORKBENCH_TOP_Y - WORKBENCH_THICKNESS_Y
const LEG_CENTER_Y = LEG_HEIGHT / 2

const LEG_HALF_WIDTH = WORKBENCH_WIDTH_X / 2 - LEG_INSET
const LEG_X_OFFSETS = [-LEG_HALF_WIDTH, LEG_HALF_WIDTH] as const
const LEG_Z_POSITIONS = [WORKBENCH_NEAR_Z + LEG_INSET, WORKBENCH_FAR_Z - LEG_INSET] as const

/**
 * G-02-01: a simple table the toolpath visibly rests on — one flat tabletop
 * slab plus four square-section legs reaching to the floor. Every dimension
 * is derived from `src/gcode/toolpath-anchor.ts`'s exported constants
 * (`WORKBENCH_WIDTH_X`, `WORKBENCH_THICKNESS_Y`, `WORKBENCH_NEAR_Z`,
 * `WORKBENCH_FAR_Z`, `WORKBENCH_TOP_Y`) — this component never restates the
 * toolpath's anchor position or the carriage's front face as a second,
 * independently guessed literal.
 *
 * G-04-1 gap closure (04-06-PLAN.md): the bench now travels with the cell's
 * configured station. It subscribes to `cellMode` (the same single-field
 * `useUiShellStore` selector form `ModeBar.tsx` uses) and derives its X from
 * `toolpathAnchorForMode(cellMode).x`, computed once at the top of the
 * component and reused for both the tabletop and the leg map so the two can
 * never disagree. A reactive subscription is correct here for the same
 * reason `cellStore.ts`'s header sanctions one for `selectSample`: the mode
 * changes at human interaction cadence, never per frame. Every other
 * dimension — the Z span, the heights, the widths and leg insets — is
 * unchanged, because the mode moves the station along the rail and nothing
 * else.
 */
export default function Workbench() {
  const cellMode = useUiShellStore((state) => state.cellMode)
  const anchor = toolpathAnchorForMode(cellMode)

  return (
    <group>
      <mesh
        position={[anchor.x, TABLETOP_CENTER_Y, TABLETOP_CENTER_Z]}
        receiveShadow
        castShadow
      >
        <boxGeometry args={[WORKBENCH_WIDTH_X, WORKBENCH_THICKNESS_Y, TABLETOP_DEPTH]} />
        <meshStandardMaterial color={SCENE_PALETTE.workbench.hex} />
      </mesh>

      {LEG_X_OFFSETS.map((xOffset) =>
        LEG_Z_POSITIONS.map((z) => (
          <mesh
            key={`${xOffset}-${z}`}
            position={[anchor.x + xOffset, LEG_CENTER_Y, z]}
            castShadow
          >
            <boxGeometry args={[LEG_SECTION, LEG_HEIGHT, LEG_SECTION]} />
            <meshStandardMaterial color={SCENE_PALETTE.workbench.hex} />
          </mesh>
        )),
      )}
    </group>
  )
}

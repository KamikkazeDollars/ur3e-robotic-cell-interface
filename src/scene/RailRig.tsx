import { RAIL_TRAVEL, RAIL_CENTER_X } from '../kinematics'
import RobotModel from './RobotModel'

// UI-SPEC Secondary tone (#E4E7EB) — track, end-stops, and carriage recede
// behind the robot; Accent is reserved for the nav cube and Reset View CTA
// only. No new colors are introduced anywhere in this file.
const SECONDARY_TONE = '#E4E7EB'

// --- Cosmetic profile/clearance dimensions -------------------------------
// None of these restate a rail *travel* bound (RAIL_TRAVEL.min/.max /
// RAIL_CENTER_X) — those are always read from the kinematics barrel so the
// rendered rail and Phase 5's telemetry readout can never drift apart.

// Twin parallel guide-rail profiles — real linear-rail hardware uses two
// rails, not one wide flat bar (checkpoint follow-up, item 4).
const RAIL_PROFILE_WIDTH = 0.05 // each rail's footprint along Z
const RAIL_PROFILE_HEIGHT = 0.04 // each rail's height
const RAIL_GAP = 0.22 // distance between the two rails' centrelines
const TRACK_OVERHANG = 0.15 // margin past each travel limit so the end-stop blocks sit on the rail ends, not past them

// Discrete end-stop blocks (short and wide, not tall thin fins) spanning
// across both rails at each physical travel limit.
const END_STOP_WIDTH = 0.07 // thin along the travel (X) axis
const END_STOP_HEIGHT = 0.12 // short block, sits just above rail height
const END_STOP_DEPTH = RAIL_GAP + RAIL_PROFILE_WIDTH * 2 + 0.02 // spans both rails plus a small lip

// Carriage — a linear-guide-block silhouette: a wide base "shoe" plate that
// bridges both rails, plus a smaller raised mounting block the robot sits on.
const CARRIAGE_BASE_WIDTH = 0.34
const CARRIAGE_BASE_DEPTH = RAIL_GAP + RAIL_PROFILE_WIDTH * 2 + 0.06
const CARRIAGE_BASE_HEIGHT = 0.05
const CARRIAGE_BLOCK_WIDTH = 0.22
const CARRIAGE_BLOCK_DEPTH = 0.22
const CARRIAGE_BLOCK_HEIGHT = 0.1

/** Overall rail run length, exported for CellScene's footprint-sized floor
 * (checkpoint follow-up, item 3) — the floor must never restate this span. */
export const TRACK_LENGTH = RAIL_TRAVEL.max - RAIL_TRAVEL.min + TRACK_OVERHANG * 2

/** UR3e reach envelope (~500mm per official specs, approximate). Used only
 * for scene-composition floor sizing — not a kinematic constraint, and
 * deliberately not derived from a DH link length (it's the robot's overall
 * working envelope, not a single link). */
export const ROBOT_REACH_ENVELOPE = 0.5 // metres

const FOOTPRINT_MARGIN = 0.3 // metres — modest margin beyond the reach envelope (checkpoint follow-up, item 3)

/** Footprint the floor plane must cover (checkpoint follow-up, item 3):
 * the rail's full run plus the robot's reach envelope on each end, plus a
 * modest margin. */
export const RIG_FOOTPRINT_WIDTH = TRACK_LENGTH + 2 * ROBOT_REACH_ENVELOPE + 2 * FOOTPRINT_MARGIN
export const RIG_FOOTPRINT_DEPTH = 2 * ROBOT_REACH_ENVELOPE + 2 * FOOTPRINT_MARGIN

/**
 * How far forward (world +Z, toward the default camera position) the whole
 * rig is shifted off the world origin (checkpoint follow-up, item 2): the
 * robot no longer sits centred at the origin — its near (camera-side) reach
 * limit is pushed to `ROBOT_REACH_ENVELOPE` in front of the origin, while
 * its far reach limit lands back at the origin. Reuses `ROBOT_REACH_ENVELOPE`
 * rather than introducing a second, unrelated offset constant.
 */
export const RIG_Z_OFFSET = ROBOT_REACH_ENVELOPE

const RAIL_TOP_Y = RAIL_PROFILE_HEIGHT
const END_STOP_CENTER_Y = RAIL_TOP_Y + END_STOP_HEIGHT / 2
const CARRIAGE_BASE_CENTER_Y = RAIL_TOP_Y + CARRIAGE_BASE_HEIGHT / 2
const CARRIAGE_BLOCK_CENTER_Y = RAIL_TOP_Y + CARRIAGE_BASE_HEIGHT + CARRIAGE_BLOCK_HEIGHT / 2
const CARRIAGE_TOP_Y = RAIL_TOP_Y + CARRIAGE_BASE_HEIGHT + CARRIAGE_BLOCK_HEIGHT

const RAIL_Z_OFFSETS = [-RAIL_GAP / 2, RAIL_GAP / 2] as const

/**
 * The 7th external linear-rail axis (D-02): twin parallel guide rails
 * running along world x, discrete end-stop blocks at both physical travel
 * limits (D-07), and a slider-block carriage — carrying the UR3e — parked
 * at the centre of the travel range for this phase's static pose (D-09).
 *
 * Every dimension that relates to travel (rail span, end-stop positions,
 * carriage position) is derived from `RAIL_TRAVEL` / `RAIL_CENTER_X`,
 * imported from the kinematics barrel — never restated as a literal here —
 * so this geometry and Phase 5's remaining-travel readout are provably
 * reading one shared definition, per the plan's rail-agreement prohibition.
 */
export default function RailRig() {
  return (
    <group>
      {RAIL_Z_OFFSETS.map((z) => (
        <mesh key={z} position={[RAIL_CENTER_X, RAIL_PROFILE_HEIGHT / 2, z]} receiveShadow>
          <boxGeometry args={[TRACK_LENGTH, RAIL_PROFILE_HEIGHT, RAIL_PROFILE_WIDTH]} />
          <meshStandardMaterial color={SECONDARY_TONE} />
        </mesh>
      ))}

      {/* End-stop blocks at both physical travel limits (D-07) — the visual
          anchor Phase 5's remaining-travel readout will be read against. */}
      <mesh position={[RAIL_TRAVEL.min, END_STOP_CENTER_Y, 0]} castShadow>
        <boxGeometry args={[END_STOP_WIDTH, END_STOP_HEIGHT, END_STOP_DEPTH]} />
        <meshStandardMaterial color={SECONDARY_TONE} />
      </mesh>
      <mesh position={[RAIL_TRAVEL.max, END_STOP_CENTER_Y, 0]} castShadow>
        <boxGeometry args={[END_STOP_WIDTH, END_STOP_HEIGHT, END_STOP_DEPTH]} />
        <meshStandardMaterial color={SECONDARY_TONE} />
      </mesh>

      {/* Carriage — parked at travel centre (D-09), carrying the robot as
          its child (the official UR3e URDF has no rail joint; the rail is
          this project's own scene-graph composition, not part of the
          description). */}
      <group position={[RAIL_CENTER_X, 0, 0]}>
        <mesh position={[0, CARRIAGE_BASE_CENTER_Y, 0]} castShadow>
          <boxGeometry args={[CARRIAGE_BASE_WIDTH, CARRIAGE_BASE_HEIGHT, CARRIAGE_BASE_DEPTH]} />
          <meshStandardMaterial color={SECONDARY_TONE} />
        </mesh>
        <mesh position={[0, CARRIAGE_BLOCK_CENTER_Y, 0]} castShadow>
          <boxGeometry args={[CARRIAGE_BLOCK_WIDTH, CARRIAGE_BLOCK_HEIGHT, CARRIAGE_BLOCK_DEPTH]} />
          <meshStandardMaterial color={SECONDARY_TONE} />
        </mesh>
        <group position={[0, CARRIAGE_TOP_Y, 0]}>
          <RobotModel />
        </group>
      </group>
    </group>
  )
}

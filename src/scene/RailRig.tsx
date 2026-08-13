import { RAIL_TRAVEL, RAIL_CENTER_X } from '../kinematics'
import RobotModel from './RobotModel'

// UI-SPEC Secondary tone (#E4E7EB) — track and end-stops recede behind the
// robot; Accent is reserved for the nav cube and Reset View CTA only.
const SECONDARY_TONE = '#E4E7EB'

// Cosmetic clearances below — none of these restate a rail *travel* bound
// (RAIL_TRAVEL.min/.max/RAIL_CENTER_X), which are always read from the
// kinematics barrel so the rendered rail and Phase 5's telemetry readout
// can never drift apart.
const TRACK_OVERHANG = 0.15 // margin past each travel limit so end-stops sit on the track, not past its physical ends
const TRACK_WIDTH = 0.3
const TRACK_HEIGHT = 0.08

const END_STOP_WIDTH = 0.12
const END_STOP_HEIGHT = 0.35
const END_STOP_DEPTH = TRACK_WIDTH

const CARRIAGE_WIDTH = 0.4
const CARRIAGE_DEPTH = 0.4
const CARRIAGE_HEIGHT = 0.12

const TRACK_LENGTH = RAIL_TRAVEL.max - RAIL_TRAVEL.min + TRACK_OVERHANG * 2

const TRACK_TOP_Y = TRACK_HEIGHT
const END_STOP_CENTER_Y = TRACK_TOP_Y + END_STOP_HEIGHT / 2
const CARRIAGE_CENTER_Y = TRACK_TOP_Y + CARRIAGE_HEIGHT / 2

/**
 * The 7th external linear-rail axis (D-02): a visible track running along
 * world x, end-stop geometry at both physical travel limits (D-07), and a
 * carriage — carrying the UR3e — parked at the centre of the travel range
 * for this phase's static pose (D-09).
 *
 * Every dimension that relates to travel (track span, end-stop positions,
 * carriage position) is derived from `RAIL_TRAVEL` / `RAIL_CENTER_X`,
 * imported from the kinematics barrel — never restated as a literal here —
 * so this geometry and Phase 5's remaining-travel readout are provably
 * reading one shared definition, per the plan's rail-agreement prohibition.
 */
export default function RailRig() {
  return (
    <group>
      {/* Track — low and flat so it reads as a linear rail, not a plinth.
          Rests on the floor plane (bottom edge at y=0). */}
      <mesh position={[RAIL_CENTER_X, TRACK_HEIGHT / 2, 0]} receiveShadow>
        <boxGeometry args={[TRACK_LENGTH, TRACK_HEIGHT, TRACK_WIDTH]} />
        <meshStandardMaterial color={SECONDARY_TONE} />
      </mesh>

      {/* End-stops at both physical travel limits (D-07) — the visual
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
      <group position={[RAIL_CENTER_X, CARRIAGE_CENTER_Y, 0]}>
        <mesh castShadow>
          <boxGeometry args={[CARRIAGE_WIDTH, CARRIAGE_HEIGHT, CARRIAGE_DEPTH]} />
          <meshStandardMaterial color={SECONDARY_TONE} />
        </mesh>
        <group position={[0, CARRIAGE_HEIGHT / 2, 0]}>
          <RobotModel />
        </group>
      </group>
    </group>
  )
}

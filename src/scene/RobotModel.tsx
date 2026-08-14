import { useEffect, useState } from 'react'
import URDFLoader, { type URDFRobot } from 'urdf-loader'
import { UR3E_JOINT_NAMES, UR3E_READY_POSE } from '../kinematics'
import { useCellStore } from '../store/cellStore'
import RobotPose from './RobotPose'

const URDF_PATH = '/robots/ur3e/ur3e.urdf'
// Remaps the description's `package://ur_description/...` mesh URIs onto
// this project's public asset directory. Must be assigned on the loader
// instance before `.load()` is called — the bare `useLoader(URDFLoader,
// path)` one-liner does not allow that ordering, which is the direct cause
// of a mesh 404 while the URDF XML itself still parses cleanly
// (01-RESEARCH.md, "package:// URI mesh 404s" pitfall).
const PACKAGE_REMAP = { ur_description: '/robots/ur3e' }

function useUR3e() {
  const [robot, setRobot] = useState<URDFRobot>()
  const setRobotLoadStatus = useCellStore((state) => state.setRobotLoadStatus)

  useEffect(() => {
    const loader = new URDFLoader()
    loader.packages = PACKAGE_REMAP

    loader.load(
      URDF_PATH,
      (loadedRobot) => {
        // The description uses a z-up frame; the scene is y-up. Rotating
        // about x preserves the world x axis, so the rail's translation
        // direction (RailRig.tsx, RAIL_TRAVEL/RAIL_CENTER_X) stays
        // consistent with the kinematics module's rail convention.
        loadedRobot.rotation.x = -Math.PI / 2

        // D-08: apply the displayed "ready" pose, never the home/test pose
        // the FK unit test asserts on — the home pose renders as a flat
        // silhouette. Zips the two kinematics-barrel exports together by
        // index rather than restating either list.
        UR3E_JOINT_NAMES.forEach((jointName, i) => {
          loadedRobot.setJointValue(jointName, UR3E_READY_POSE[i])
        })

        // D-03: the flange stays bare — no print head / mill spindle mesh
        // is attached here. Phase 7 owns the tool-changer swap logic.

        setRobot(loadedRobot)
        setRobotLoadStatus('ready')
      },
      undefined,
      (err) => {
        console.error('Failed to load UR3e URDF:', err)
        // Keep the failure path honest — no fallback geometry is set here,
        // so the user sees the error panel over an empty carriage slot
        // rather than a stand-in that implies the real model loaded.
        setRobotLoadStatus('error')
      },
    )
  }, [setRobotLoadStatus])

  return robot
}

/**
 * Loads and poses the official UR3e URDF (D-01) via a manually-constructed
 * `URDFLoader`. Renders nothing while loading and renders nothing on
 * failure — a partially-loaded or stand-in "plausible" robot is exactly the
 * outcome SCENE-04's transparency prohibition forbids; an empty carriage
 * slot is the honest failure state.
 */
export default function RobotModel() {
  const robot = useUR3e()
  return robot ? (
    <>
      <primitive object={robot} />
      {/* D-05: the scrub-driven pose driver, mounted once the robot exists
          so it always has a real `URDFRobot` to call `setJointValue` on. */}
      <RobotPose robot={robot} />
    </>
  ) : null
}

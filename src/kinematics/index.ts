// Barrel export — the single import surface scene code and later phases
// consume. Internal matrix helpers stay out of this contract boundary.
export {
  UR3E_DH,
  UR3E_JOINT_LIMITS,
  UR3E_JOINT_NAMES,
  UR3E_HOME_POSE,
  UR3E_READY_POSE,
  UR3E_PARKED_POSE,
  type JointAngles,
} from './ur3e-dh';

export {
  forwardKinematics,
  isWithinJointLimits,
  type Matrix4,
  type ForwardKinematicsResult,
} from './forward-kinematics';

export {
  RAIL_TRAVEL,
  RAIL_CENTER_X,
  railRemainingTravel,
  clampRailPosition,
  resolveRailPosition,
  RAIL_RESOLUTION_CANDIDATES,
} from './rail';

export {
  solveUR6IK,
  buildToolDownTarget,
  validBranches,
  pickClosestBranch,
  jointSpaceDistance,
  TOOL_FLANGE_OFFSET_Z,
} from './inverse-kinematics';

export { toUrdfJointAngles, URDF_SHOULDER_PAN_OFFSET } from './urdf-joint-mapping';

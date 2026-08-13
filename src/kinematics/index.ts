// Barrel export — the single import surface scene code and later phases
// consume. Internal matrix helpers stay out of this contract boundary.
export {
  UR3E_DH,
  UR3E_JOINT_LIMITS,
  UR3E_JOINT_NAMES,
  UR3E_HOME_POSE,
  UR3E_READY_POSE,
  type JointAngles,
} from './ur3e-dh';

export {
  forwardKinematics,
  isWithinJointLimits,
  type Matrix4,
  type ForwardKinematicsResult,
} from './forward-kinematics';

export { RAIL_TRAVEL, RAIL_CENTER_X, railRemainingTravel, clampRailPosition } from './rail';

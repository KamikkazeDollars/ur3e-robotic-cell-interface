// Barrel export — the single import surface consuming code should use,
// mirroring `src/kinematics/index.ts`'s own discipline.
export {
  poseKeypointsWorld,
  classifyPoseCollision,
  COLLISION_LINK_RADIUS_M,
  COLLISION_LINK_SUBDIVISIONS,
  FLOOR_CLEARANCE_EPSILON_M,
  WORKBENCH_PENETRATION_EPSILON_M,
  type CollisionFlags,
} from './pose-collision'

export {
  validateManualPose,
  MANUAL_POSE_REJECTION_COPY,
  type ManualPoseRejectionReason,
  type ManualPoseVerdict,
} from './manual-pose-safety'

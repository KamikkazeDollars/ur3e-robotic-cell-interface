/**
 * Single source of truth for the scene's default camera framing.
 *
 * Both the initial `PerspectiveCamera` (CellScene.tsx) and the "Reset View"
 * action (CameraResetListener.tsx) read these same two constants — nothing
 * else may restate these numbers. "Reset returns to the starting view" is
 * only provable if the starting view and the reset target are literally
 * the same values (SCENE-02).
 *
 * The rail runs ~3m along X and the robot stands ~1.5m tall, so the camera
 * sits back and slightly elevated to hold the whole rig with comfortable
 * margin, looking at the origin — the point the cell (and the rail-rig
 * mount plan 01-04 inserts into) is centered on.
 */

export const DEFAULT_CAMERA_POSITION = [3.5, 2.5, 4.5] as const

export const DEFAULT_CAMERA_TARGET = [0, 0, 0] as const

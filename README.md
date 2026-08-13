# UR3e Robotic Cell Interface

A browser-based 3D control/visualization interface for a Universal Robots UR3e
mounted on a 7th external linear-rail axis, operating a single robotic cell
that switches between printing and milling modes via an automatic
tool-changer. Users import a g-code file and watch it play back as a
color-coded, animated toolpath in an interactive 3D scene, while monitoring
simulated telemetry, sensors, and setup/calibration parameters across
dedicated tabs.

Built as a technical interview assignment demonstrating full-stack + 3D/
robotics capability under a tight deadline.

## Live deployment

<!-- gsd:live-deployment-url -->

## Stack

- React 19 + TypeScript 5.9.3 + Vite 7
- Three.js + React Three Fiber + drei (3D scene, camera rig, nav cube)
- `urdf-loader` (official UR3e URDF + meshes)
- Hand-written DH-parameter forward kinematics (`src/kinematics/`)
- Zustand (coarse app state)
- Vitest (unit tests)

## Development

```bash
npm install
npm run dev      # local dev server
npm run build    # production build
npm test         # run the Vitest suite
```

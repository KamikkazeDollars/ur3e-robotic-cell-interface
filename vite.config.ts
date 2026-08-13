/// <reference types="vitest/config" />
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // gcode-parser's shipped ESM bundle (a gcode-toolpath transitive
    // dependency, via gcode-interpreter) declares a Transform-subclassing
    // stream class at module scope, which Rollup evaluates eagerly and
    // which fails the production build without these three polyfills
    // (02-RESEARCH.md Pitfall B). `fs` is deliberately left out — the
    // filesystem-backed entry points (parseFile/loadFromFile/loadFromStream)
    // are never called in this app, so leaving `fs` externalised keeps them
    // un-bundled rather than paying for a polyfill nothing here uses.
    //
    // `globals` is explicitly disabled (deviation, Rule 1): this plugin's
    // default `process`/`Buffer`/`global` shim injection rewrites every
    // `process` reference project-wide during Vite's "serve" command —
    // which Vitest also runs under — replacing real Node's `process` with a
    // browser-style stub whose `cwd()` returns `/`. That silently broke
    // `urdf-asset.test.ts`'s `join(process.cwd(), ...)` path resolution.
    // Only the `stream`/`events`/`timers` *module* polyfills below are
    // needed to fix the Pitfall B build failure; the global shims are not.
    nodePolyfills({
      include: ['stream', 'events', 'timers'],
      globals: { process: false, Buffer: false, global: false },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
  },
})

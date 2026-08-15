// Bundled g-code sample metadata (D-01, D-02): the app ships curated,
// developer-authored samples instead of a file-upload control, so this is
// the single list `SampleSelect.tsx`'s dropdown renders and `cellStore.ts`'s
// `selectSample` resolves against. Plan 02-02 appends the mill-sample entry;
// nothing here is restated elsewhere.

import type { CellMode } from '../cell-mode'

export interface GcodeSample {
  /** Stable identifier, used as the store's `selectedSampleId` and the
   * dropdown option's value — never the label, so a label wording change
   * can't silently break selection. */
  id: string
  /** Human-readable text shown in the dropdown. */
  label: string
  /** Public path `selectSample` fetches the raw g-code text from. */
  filePath: string
  /** Which cell mode this sample is meant for (G-04-1 gap closure): the
   * picker filters its option list on this tag, since the cell can only
   * run a job the mounted tool suits — offering a mill job while the print
   * head is mounted (or vice versa) would be a job the cell cannot
   * actually execute. */
  mode: CellMode
}

export const GCODE_SAMPLES: readonly GcodeSample[] = [
  {
    id: 'print',
    label: 'Print sample — 3-layer square perimeter',
    filePath: '/gcode/print-sample.gcode',
    mode: 'printing',
  },
  {
    id: 'mill',
    label: 'Mill sample — rounded-rectangle contour, 3 depth passes',
    filePath: '/gcode/mill-sample.gcode',
    mode: 'milling',
  },
]

/** Returns only the samples tagged for `mode`, preserving `GCODE_SAMPLES`'s
 * own order and readonly-array shape. Pure and store-free so it stays
 * unit-testable under the repo's `environment: 'node'` Vitest setup. */
export function samplesForMode(mode: CellMode): readonly GcodeSample[] {
  return GCODE_SAMPLES.filter((sample) => sample.mode === mode)
}

/** Resolves `sampleId` against `GCODE_SAMPLES` and reports whether it
 * belongs to `mode`. Returns `false` for an id that matches no entry rather
 * than throwing or defaulting to `true` — the same defensive posture
 * `cellStore.selectSample` already takes for an unknown id, so an id that
 * resolves to nothing can never be treated as belonging to the active
 * mode (T-04-15). */
export function sampleMatchesMode(sampleId: string, mode: CellMode): boolean {
  const sample = GCODE_SAMPLES.find((candidate) => candidate.id === sampleId)
  return sample?.mode === mode
}

/** Returns the first sample id tagged for `mode`, or `null` when that mode
 * currently has no samples. The null branch exists so a future mode added
 * without samples degrades to an empty picker rather than crashing, even
 * though both current modes ('printing', 'milling') are always populated. */
export function firstSampleIdForMode(mode: CellMode): string | null {
  return samplesForMode(mode)[0]?.id ?? null
}

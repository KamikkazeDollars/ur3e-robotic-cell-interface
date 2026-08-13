// Bundled g-code sample metadata (D-01, D-02): the app ships curated,
// developer-authored samples instead of a file-upload control, so this is
// the single list `SampleSelect.tsx`'s dropdown renders and `cellStore.ts`'s
// `selectSample` resolves against. Plan 02-02 appends the mill-sample entry;
// nothing here is restated elsewhere.

export interface GcodeSample {
  /** Stable identifier, used as the store's `selectedSampleId` and the
   * dropdown option's value — never the label, so a label wording change
   * can't silently break selection. */
  id: string
  /** Human-readable text shown in the dropdown. */
  label: string
  /** Public path `selectSample` fetches the raw g-code text from. */
  filePath: string
}

export const GCODE_SAMPLES: readonly GcodeSample[] = [
  {
    id: 'print',
    label: 'Print sample — 3-layer square perimeter',
    filePath: '/gcode/print-sample.gcode',
  },
]

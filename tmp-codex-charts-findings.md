**MatrixChart**

- must-fix — `packages/components/src/components/matrix-chart/matrix-chart.svelte:130-166`: `NaN`/`Infinity` values are treated as valid numbers, then poison `Math.min`, `Math.max`, normalization, labels, and `color-mix(... NaN%)`. Filter to finite numbers, render invalid values as missing, and add tests for `NaN`, `Infinity`, and `-Infinity`.

- must-fix — `matrix-chart.svelte:161-183`: diverging color is not zero-centered. With `[-10, 30]`, zero maps blue instead of neutral. Use a symmetric domain around zero for diverging scales, or accept an explicit color domain.

- must-fix — `matrix-chart.svelte:72-100`: sparse domains are inferred only from present rows. A category with no populated cells disappears entirely, so sparse/missing handling is not predictable. Add explicit `xLabels`/`yLabels` domain props or document and test the current behavior.

- must-fix — `matrix-chart.svelte:57-65`: `new ResizeObserver(...)` is unguarded. This crashes in browsers/test environments without `ResizeObserver`. Check `typeof ResizeObserver !== 'undefined'`, fall back to `getBoundingClientRect`, and still disconnect when created.

- suggestion — `matrix-chart.svelte:169-187`: this duplicates color and number-formatting logic instead of reusing `chartPalette` / `formatNumericValue`. Move shared heatmap normalization/color formatting into chart utilities, especially because Spectrogram repeats the same pattern.

- must-fix — `matrix-chart.svelte:237-244`: the SVG has `aria-labelledby`/`title` but no `role="img"`. Either add `role="img"` or make the SVG fully decorative and rely exclusively on the table.

- must-fix — `matrix-chart.test.ts`: tests do not assert actual fill values, degenerate `min === max`, negative/diverging domains, `NaN` handling, or missing whole-row/whole-column sparse domains. Current coverage is mostly render-smoke.

**Waveform**

- must-fix — `packages/components/src/components/waveform/waveform.svelte:68-75`: single-sample path rendering divides by `clampedData.length - 1`, so one sample produces `MNaN,...`. Handle length `1` before computing points, probably by drawing a centered dot/short line.

- must-fix — `waveform.svelte:63`: `NaN` survives the clamp and then creates invalid SVG coordinates and table text. Normalize with `Number.isFinite`; either drop invalid samples, coerce to `0`, or render an explicit missing state.

- must-fix — `waveform.svelte:90-97`: all-zero data in `bars` mode renders visible 2px bars because `Math.max(1, amplitude * midY)` forces nonzero height. Zero amplitude should render zero-height bars or only the baseline.

- must-fix — `waveform.svelte:105-110`: the required accessible data table is only sampled, and the “cap at 20 rows” comment is false for many lengths. Either expose the full data, clearly provide an accessible summary instead, or make sampling explicit in the caption.

- must-fix — `waveform.svelte:68-82` and `87-100`: very large audio arrays produce a huge path string or one SVG rect per sample. Downsample for rendering, preferably to viewport pixels with min/max envelopes, while keeping the accessible fallback truthful.

- must-fix — `waveform.svelte:48-56`: unguarded `ResizeObserver` has the same crash risk as MatrixChart. Add an existence check and fallback measurement.

- must-fix — `waveform.svelte:136-143`: SVG has a title but no `role="img"`. Add `role="img"` or hide it and rely on the table.

- must-fix — `waveform.test.ts`: missing regressions for single sample, all-zero bars, `NaN`, `Infinity`, very large arrays/downsampling, and missing `ResizeObserver`.

**SpectrumChart**

- must-fix — `packages/components/src/components/spectrum-chart/spectrum-chart.svelte:69-96`: bar height uses `Math.max(maxValue, 1)`, so data with max `< 1` never reaches the top tick. Example max `0.8`: axis says `0.8` is the top, but the tallest bar is only 80% height. Use `maxValue` with a zero guard.

- must-fix — `spectrum-chart.svelte:69-80` and `95-104`: negative, `NaN`, and `Infinity` bins break axis math and bar geometry. Enforce finite non-negative linear magnitudes at runtime, or add an explicit decibel/log scale mode.

- must-fix — `spectrum-chart.svelte:53-61`: unguarded `ResizeObserver`; add the same existence guard/fallback.

- must-fix — `spectrum-chart.svelte:139-146`: SVG has title/label wiring but no `role="img"`. Add it or make the SVG decorative.

- suggestion — `spectrum-chart.svelte:206`: table rows are keyed only by `bin.label`; duplicate labels can break keyed rendering. Key by index or a composite key.

- must-fix — `spectrum-chart.test.ts`: tests never assert geometry. Add cases for max `< 1`, all-zero bins, negative bins, `NaN`, `Infinity`, duplicate labels, and missing `ResizeObserver`.

**Spectrogram**

- must-fix — `packages/components/src/components/spectrogram/spectrogram.svelte:73-80`: `isEmpty` only checks `frames.length`. `[{ label: '0 ms', bins: [] }]` renders as a non-empty chart with no cells or usable table. Treat zero-bin frames as empty or invalid.

- must-fix — `spectrogram.svelte:76-84` and `171-181`: ragged frames are not handled. `binCount` comes from the first frame, but rendering loops every frame’s own bins, so later longer frames overflow the plot and shorter frames silently leave holes. Validate consistent lengths or render a rectangular grid with explicit missing cells.

- must-fix — `spectrogram.svelte:97-101` and `171-191`: frequency orientation is inverted/ambiguous. The comment says top is high frequency, but bin index `0` renders at the top, so common low-to-high input puts low frequency at the top. Either invert Y or document/test top-to-bottom bin order.

- must-fix — `spectrogram.svelte:82-94`: `NaN`/`Infinity` values poison global min/max and produce invalid `color-mix` percentages. Filter to finite values and render invalid cells as missing.

- must-fix — `spectrogram.svelte:115-130` and `213-239`: the accessible fallback is a sampled table, not the data table fallback for the supplied data. The caption admits truncation, but there is no complete accessible alternative. Provide a full table mode or an actual accessible summary with min/max/range coverage.

- suggestion — `spectrogram.svelte:86-94` and `134-136`: this duplicates MatrixChart normalization/color/formatting logic. Extract shared heatmap utilities instead of letting the two implementations drift.

- must-fix — `spectrogram.svelte:59-67`: unguarded `ResizeObserver`; add the same existence guard/fallback.

- must-fix — `spectrogram.svelte:162-168`: SVG has a title but no `role="img"`. Add it or hide the SVG and make the table/summary the accessible representation.

- must-fix — `spectrogram.test.ts`: tests do not cover ragged frames, empty frames, all-equal domain, negative/decibel-like values, `NaN`/`Infinity`, Y-axis orientation, sampled-table truncation, or missing `ResizeObserver`.

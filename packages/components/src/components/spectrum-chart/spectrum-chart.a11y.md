# SpectrumChart · accessibility

## Pattern

SpectrumChart presents structured data. Preserve the component's semantic roles, row or item labels, and ordering so assistive technology can announce the same relationships that are visible on screen.

Purpose: Responsive SVG frequency-bin bar chart for visualizing audio spectrum magnitude data.

## Use when

- Displaying pre-computed frequency-domain magnitude data from an FFT or spectrum analyzer.
- Showing a static frequency response or spectrum snapshot with labelled frequency bins.

## Avoid when

- Real-time live audio spectrum is needed — feed live AnalyserNode data as props yourself.
- A full time × frequency heatmap is needed — use spectrogram instead.
- General categorical bar comparison — use bar-chart instead.

## Keyboard and focus

Keyboard behavior follows the rendered native elements and any ARIA pattern documented by the component. Avoid adding handlers that change focus order without a matching visible and programmatic state update.

Keep focus indicators visible. If you wrap or restyle SpectrumChart, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When SpectrumChart accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render SpectrumChart in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `waveform`, `spectrogram`, `bar-chart`.

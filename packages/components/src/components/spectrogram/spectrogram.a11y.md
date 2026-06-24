# Spectrogram · accessibility

## Pattern

Spectrogram presents structured data. Preserve the component's semantic roles, row or item labels, and ordering so assistive technology can announce the same relationships that are visible on screen.

Purpose: Responsive SVG time × frequency heatmap for visualizing audio spectrogram data.

## Use when

- Visualizing how frequency content of a signal changes over time (time × frequency heatmap).
- Displaying pre-computed spectrogram frames from an FFT or short-time Fourier transform.

## Avoid when

- Only a single spectrum snapshot is needed — use spectrum-chart instead.
- Real-time live audio spectrogram is needed — feed frames as props yourself.
- A categorical × categorical heatmap without a time axis is needed — use matrix-chart instead.

## Keyboard and focus

Keyboard behavior follows the rendered native elements and any ARIA pattern documented by the component. Avoid adding handlers that change focus order without a matching visible and programmatic state update.

Keep focus indicators visible. If you wrap or restyle Spectrogram, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When Spectrogram accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render Spectrogram in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `spectrum-chart`, `waveform`, `matrix-chart`.

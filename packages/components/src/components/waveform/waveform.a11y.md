# Waveform · accessibility

## Pattern

Waveform presents structured data. Preserve the component's semantic roles, row or item labels, and ordering so assistive technology can announce the same relationships that are visible on screen.

Purpose: Responsive SVG rendering of time-domain audio amplitude data as a waveform path or bar display.

## Use when

- Visualizing pre-recorded or pre-processed audio amplitude samples in a static display.
- Showing an audio waveform thumbnail or preview with mocked or pre-computed sample data.

## Avoid when

- Real-time live audio capture is needed — wire AudioContext / AnalyserNode yourself and feed samples as props.
- Frequency-domain data — use spectrum-chart or spectrogram instead.

## Keyboard and focus

Keyboard behavior follows the rendered native elements and any ARIA pattern documented by the component. Avoid adding handlers that change focus order without a matching visible and programmatic state update.

Keep focus indicators visible. If you wrap or restyle Waveform, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When Waveform accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render Waveform in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `spectrum-chart`, `spectrogram`, `bar-chart`, `line-chart`.

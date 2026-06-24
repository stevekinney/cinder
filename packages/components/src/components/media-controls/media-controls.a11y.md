# MediaControls · accessibility

## Pattern

MediaControls exposes an operable control surface. Prefer the native interactive element it renders, keep the accessible name specific to the action, and do not replace it with a non-interactive wrapper.

Purpose: Accessible playback controls for play, pause, and replay actions with optional progress display.

## Use when

- Embedding play/pause/replay controls for audio or video content.
- Rendering media controls inside a toolbar or standalone on a card.

## Avoid when

- You need waveform visualization or Web Audio integration — wire that separately.
- You need a full media player UI with seek scrubbing — use a dedicated player component.

## Keyboard and focus

Activation should work with the native Enter and Space behavior of the rendered control. Custom children must not swallow those events unless they replace the whole interaction intentionally.

Keep focus indicators visible. If you wrap or restyle MediaControls, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When MediaControls accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render MediaControls in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `button`, `toolbar`, `progress`, `tooltip`.

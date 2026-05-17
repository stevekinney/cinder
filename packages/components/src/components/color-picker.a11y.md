# Color Picker — Accessibility Rationale

## What this component is — and what it isn't

`color-picker.svelte` is a **visual** color selector. It exposes a 2D saturation/lightness gradient, a hue slider, an optional alpha slider, and an optional palette of preset swatches. It is intentionally _not_ a substitute for a text-entry color field. When precise color values matter (brand hex codes, accessibility-critical contrast targets), pair this component with a future `color-field.svelte` — a labeled text input that parses and normalizes hex/`rgb()`/`hsl()` strings. Users who need exact entry should reach for the field; users who want to graze around a color space should reach for the picker.

## The gradient is `role="application"` on purpose

The 2D saturation/lightness region is the one part of this component that **cannot** be made fully accessible. Two-dimensional pointer-driven manipulation has no clean ARIA equivalent. Wrapping it in `role="slider"` would lie to assistive technology — sliders are one-dimensional, and screen readers expect `aria-valuemin`/`max`/`now` to describe a single magnitude.

Instead, we use `role="application"` with an `aria-label` that explicitly says the region is pointer-driven and that arrow keys offer coarse adjustment. `role="application"` tells screen readers to stop intercepting keys, which is what lets our arrow-key handler get the events. The component still exposes a hue slider, an alpha slider, and a swatch list as **fully accessible alternatives**, so keyboard-only and screen-reader users are not locked out of changing the color — they are just routed through controls that match the semantics they expect.

The arrow-key handling on the gradient itself is a courtesy, not a substitute. Each press moves saturation or lightness by one unit (ten with Shift). It is enough to nudge a color, not enough to reliably land on a specific value. Users who need a specific value should use the swatches or, eventually, the paired color field.

## Hue and alpha as `role="slider"`

The hue control is a one-dimensional 0–359 degree wheel: a textbook slider. We expose `aria-valuemin="0"`, `aria-valuemax="359"`, and `aria-valuenow` rounded to an integer. Arrow keys step by 1 degree (10 with Shift), Page Up/Down jump by 36 (one twelfth of the wheel), and Home/End snap to the wheel's start and end. The control wraps — pressing ArrowLeft at hue 0 lands on 359 — because hue is a wheel, not a line, and respecting that matches user intuition.

The alpha control follows the same pattern with a 0–100 range (representing percent opacity) and a smaller default step. Each press changes alpha by 1% (10% with Shift). We expose `aria-valuetext` as `"NN%"` so screen readers announce a meaningful unit rather than a bare integer.

## Swatches as `role="listbox"` + `role="option"`

The optional preset palette uses the WAI-ARIA Listbox pattern: a `<ul role="listbox">` with an accessible name ("Color swatches") and `<li role="option">` children. Each option carries `aria-selected` reflecting whether its color matches the picker's current value, and an `aria-label` that announces the hex string. Arrow keys move focus among swatches with wrapping; Home and End jump to the first and last. Enter and Space commit the focused swatch.

We do not use selection-follows-focus here. Arrowing past a swatch should let users preview the option without committing — committing comes from an explicit Enter or Space (or click). This avoids the "I arrowed across and lost my selection" footgun common to selection-follows-focus listboxes.

## Form participation and form reset

The component renders a hidden `<input>` so it shows up in `FormData` and participates in `<form>` submission when `name` is set. When the surrounding form fires a `reset` event, the picker reverts to `defaultValue` (or to an empty value when no default was provided). We listen for `reset` on the input's actual form element — not on a passed-in callback — so the contract matches native form controls and consumers don't have to wire anything up.

## Touch precision and fine selection

Both the gradient and the sliders are pointer-driven. On touch devices, the gradient handle is small relative to a fingertip — landing on an exact hex is impractical. This is the same limitation every visual color picker has. Consumers building touch-first interfaces should pair the picker with a text field for exact entry, or expose preset swatches that cover the values they actually care about.

## Reduced motion

The component has no animated transitions in v1, so `prefers-reduced-motion` is a no-op for now. If we add motion later (e.g., handle slide animations on swatch commit), the animation must be gated on `@media (prefers-reduced-motion: no-preference)` — never run unconditionally.

## Forced colors mode

In Windows High Contrast / forced-colors mode the gradient itself cannot be meaningfully rendered (the OS strips background colors). The component still works, but the gradient region will look flat. Sliders and swatches fall back to `Highlight` system color for focus rings via a `@media (forced-colors: active)` block. Users in forced colors mode are exactly the user population most likely to rely on the swatch list or a paired color field — both of which remain fully functional.

## Pairing recommendation

For any production form where users need to choose a color, pair this picker with a text input that accepts and validates `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()`, `rgba()`, `hsl()`, and `hsla()` strings. The picker is the discovery surface; the field is the precision surface. Neither replaces the other.

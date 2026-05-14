# Slider Accessibility

`slider.svelte` implements the WAI-ARIA
[slider pattern](https://www.w3.org/WAI/ARIA/apg/patterns/slider/) for
single-value sliders and the
[multi-thumb slider pattern](https://www.w3.org/WAI/ARIA/apg/patterns/slider-multithumb/)
for two-thumb (range) sliders.

## Role + Semantics

Each thumb is a focusable `<div role="slider">` carrying:

- `aria-valuemin`, `aria-valuemax`, `aria-valuenow` — required numeric state.
- `aria-valuetext` — set when the consumer supplies a `valueText` formatter.
  Screen readers prefer `aria-valuetext` over `aria-valuenow` when both are
  present, so use it for currency, percentages, or other formatted values.
- `aria-orientation="horizontal"` — the slider is exclusively horizontal in
  this implementation.
- `aria-disabled="true"` when `disabled` is set.

### Accessible name

| Mode     | Thumb        | Accessible name           |
| -------- | ------------ | ------------------------- |
| `single` | (only thumb) | `label`                   |
| `range`  | low          | `{label} — minimum value` |
| `range`  | high         | `{label} — maximum value` |

When the slider is composed inside `<FormField>`, the field's label is
linked via `aria-labelledby` and the per-thumb `aria-label` is suppressed
so accessible-name computation has a single unambiguous source.

## Keyboard Interactions

| Key                     | Behavior                                      |
| ----------------------- | --------------------------------------------- |
| `ArrowRight`/`ArrowUp`  | Increase by `step` (or move to next tick)     |
| `ArrowLeft`/`ArrowDown` | Decrease by `step` (or move to previous tick) |
| `PageUp`                | Increase by `pageStep` (default `10 * step`)  |
| `PageDown`              | Decrease by `pageStep`                        |
| `Home`                  | Snap to `min`                                 |
| `End`                   | Snap to `max`                                 |

When `ticks` is supplied as an array, arrow keys move thumbs to the
**adjacent tick** rather than the next `step` increment. This matches user
expectation for "discrete tick" sliders.

## Pointer Interactions

- `pointerdown` on a thumb begins a drag. The component attaches
  `pointermove` and `pointerup` listeners on `document`, so a drag
  continues to follow the pointer even when it leaves the thumb element
  or the track.
- `pointerdown` on the track sets the value at the clicked position
  (single mode) or moves the nearer thumb (range mode), then begins a
  drag on that thumb.
- Touch input is supported via the same Pointer Events API. `touch-action:
none` is applied to the track so the browser does not steal the gesture
  for scrolling.

## Range Mode

- The low thumb's `aria-valuemax` is the current `aria-valuenow` of the
  high thumb, and vice versa. Screen-reader announcements therefore
  reflect the live constraint, not the static `min`/`max` bounds.
- Thumbs are constrained so the low value never exceeds the high value.
- When thumbs overlap, the most recently moved thumb is raised via
  `z-index` so it remains the click target.

## Focus Behavior

- Each thumb receives `tabindex="0"` when enabled and `tabindex="-1"`
  when `disabled`.
- `:focus-visible` produces an outline using `--cinder-focus-ring` (or
  `--cinder-accent` as a fallback) with a 2px offset.

## Reduced Motion

Position transitions on the thumb and the filled range are disabled when
`@media (prefers-reduced-motion: reduce)` matches.

## Color Contrast

The filled range uses `--cinder-accent` and the thumb border uses the
same token. The thumb fill is `--cinder-surface-raised`. Both are part
of the cinder semantic palette and meet WCAG 1.4.11 (non-text contrast).

The tick marks are decorative (`aria-hidden="true"`); they exist as a
visual affordance, not as the channel through which discrete state is
communicated.

## Form Integration

When `name` is set:

- **Single mode** renders one hidden `<input type="hidden" name="{name}">`.
- **Range mode** renders two: `name="{name}.min"` and `name="{name}.max"`.

Hidden inputs make the slider participate in native form submission.
Form `reset` is currently handled by the consumer re-rendering with the
original `defaultValue` — there is no internal listener on the parent
`<form>`'s `reset` event, since the slider does not know which form it
belongs to in advance.

## Content Guidance

- The `label` prop is required. A slider without an accessible name is
  unusable for assistive technology.
- Provide `valueText` whenever the raw number is not self-evident —
  prices, dates, percentages of an unusual base, etc.
- For sliders with fewer than ~10 discrete values, prefer a `select`,
  `radio-group`, or `segmented-control`. Sliders are better for
  continuous ranges or coarse "feel" adjustments.

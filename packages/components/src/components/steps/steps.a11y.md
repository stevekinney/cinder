# Steps — Accessibility Notes

## Why `<nav>` + `<ol>`, not `role="progressbar"`

A wizard step indicator is a **navigational summary** of where the user is in a discrete sequence. `role="progressbar"` is defined in ARIA as a meter — a quantitative value between numeric bounds. Applying it to a step indicator is incorrect for two reasons:

1. There is no meaningful numeric value (what is "55%" of "step 2 of 4"?).
2. Screen readers announce `progressbar` with a computed percentage derived from `aria-valuenow / aria-valuemax`, which is nonsensical for discrete labeled steps.

The correct structure is a `<nav>` landmark wrapping an `<ol>`. This gives users:

- A named navigation landmark (`aria-label` on `<nav>`) they can jump to directly.
- Ordered list semantics ("item 1 of 4", "item 2 of 4") that convey sequence.
- No percentage fabrication.

## `aria-current="step"`

The active step is marked with `aria-current="step"` on its `<li>`. This is one of the spec-defined tokens for `aria-current` alongside `page`, `location`, `date`, `time`, and `true`. Screen readers announce it as "current step" or equivalent, conveying the user's position without requiring an additional visually-hidden label.

`aria-current` is applied to the `<li>` (the semantic step entity), not to a child `<span>`.

## Visually-hidden completion text

The marker element (`<span class="cinder-steps__marker">`) is `aria-hidden="true"`. It is purely decorative — the checkmark icon and step number carry no semantic weight themselves.

Completed steps render a visually-hidden `<span class="cinder-steps__sr-only">` **inside `.cinder-steps__body`**, before the label. A separate visually-hidden whitespace separator follows that span so the caller-provided `completedLabel` remains verbatim while the announcement still has a word boundary. This produces the announcement:

> "Completed Set up profile Tell us about yourself"

The `completedLabel` prop (default `'Completed'`) lets consuming teams localize or override this text without forking the component.

Skipped steps use the same hidden-text placement with `skippedLabel` (default `'Skipped'`). They keep their numeric marker and do not render the completed checkmark or completed label, so a past-but-incomplete step is not announced as finished.

**Current step:** state is conveyed solely by `aria-current="step"` on the `<li>`. No additional visually-hidden text is added to avoid duplicate announcements.

**Upcoming steps:** no state text — the visible label alone is sufficient.

## State label contract

The `completedLabel` and `skippedLabel` prop values are rendered verbatim with no punctuation added by the component. If the caller wants a trailing comma for pause cuing (e.g., "Completed, Set up profile"), they should pass `completedLabel="Completed,"`.

## Default `label` value

The wrapping `<nav>` defaults to `aria-label="Progress"`. Callers on pages with multiple navigation regions should pass a distinct `label` (e.g., `label="Checkout steps"`) to differentiate the landmark from breadcrumbs, primary navigation, and pagination.

## Marker contrast and forced-colors

Completed step markers use `background: var(--cinder-accent)` with `color: var(--cinder-accent-contrast)`. The `--cinder-accent-contrast` token is defined in `tokens-base.css` as a `light-dark()` value that maintains 4.5:1 contrast ratio in both light and dark themes.

The current-step marker uses a `box-shadow` ring. In Windows High Contrast Mode (`forced-colors: active`), `box-shadow` is suppressed by the browser. The CSS includes a `@media (forced-colors: active)` block that restores the ring as a `ButtonText`-colored `outline`.

## Touch targets

The step markers (24px × 24px) are non-interactive display elements. Touch target minimums (WCAG 2.5.5 / 2.5.8) apply to interactive controls, not static indicators.

## No keyboard interaction

This component is read-only — steps are not clickable or focusable. If a future use case requires navigating backward through completed steps, an optional `onSelect` callback should be added to render completed steps as `<button>` elements.

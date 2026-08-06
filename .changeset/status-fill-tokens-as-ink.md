---
'@lostgradient/cinder': patch
---

Stop using the status **fill** tokens (`--cinder-success` / `--cinder-info` /
`--cinder-warning` / `--cinder-danger`) as text color. Those are tuned dark enough
(L≈0.50) to carry a white label; the paired `--cinder-color-*-fg` tokens (L≈0.40)
are the foregrounds. Measured as ink on `--cinder-surface-inset`, the fills land at
3.98 (success), 4.16 (info) and 3.66 (warning) — all below the 4.5:1 AA floor —
while the `-fg` equivalents land 6.1–6.7. `--cinder-warning` was already failing
before the light-ramp retune in #1208; widening the ramp only made it worse.

Swaps every `color:` declaration that paints text: form-field, checkbox,
checkbox-group, radio-group, input, textarea, select, combobox, multi-select,
tag-input, pin-input, phone-input, time-field, date-picker, date-range-field,
schema-form, button, dropdown, copy-button, rating, qr-code, json-editor,
statistic, diff-statistics, status-dot, inline-loading, event-stream-viewer, and
the shared `_field-label` required marker.

Deliberately **not** swapped: `background`, `border`, `outline`, focus-ring
custom properties, and every `color:` whose value is consumed as `currentColor` by
a painted shape rather than by text — lucide icon strokes (Card's risk icon,
ApprovalCard's risk icons, PermissionMatrix's cell tokens, SecretValueField's copy
confirmation), Timeline's `border: 2px solid currentColor` markers, Rating's
mask-clipped star fill, StatusDot's indicator dot, and JsonEditor's lint squiggle.
Those are non-text graphics held to the 3:1 floor, which the fill tokens already
clear; swapping them would have been a visual regression, not an accessibility fix.

EventStreamViewer needed a structural fix rather than a swap: a single
`--cinder-event-stream-viewer-severity-color` variable was painting both the 3px
severity rail and the severity badge text. It is now split into `-color` (the
rail, on the fill ramp) and `-ink` (the badge, on the `-fg` ramp). Pushing the
shared variable to `-fg` would have collapsed all four rails into one 88–90%
lightness band in the dark arm, making the severities indistinguishable.

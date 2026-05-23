# PinInput Accessibility

## ARIA Roles and Attributes

- The outer container is a `role="group"` that owns the accessible group name. The accessible name source is, in order: the `label` prop, the wrapping `<FormField>` label, `aria-labelledby`, then `aria-label`. Development builds warn when none of these are present.
- Each segment is a native `<input maxlength="1">` so the browser handles caret, selection, and IME concerns. Segments are not given a `name` attribute — the form-submitted value comes from a single hidden `<input>` carrying the joined code.
- Every segment carries `aria-labelledby` that points at the group's accessible name **and** a visually hidden span containing `Character {position} of {length}`. Screen readers therefore announce something like "Verification code, Character 2 of 6" when focus enters the second box.
- When the group's only accessible-name source is `aria-label`, each segment receives a computed `aria-label` instead (for example `Code character 1 of 6`), since `aria-labelledby` requires DOM ids to point at.
- `description` and `error` ids compose into a single `aria-describedby` on each segment so the supporting text follows focus across the row.
- `error` sets `aria-invalid="true"` on every segment and visually colors the borders so the invalid state is communicated by both attribute and visual style.

## Keyboard Interactions

| Key                      | Behaviour                                                                         |
| ------------------------ | --------------------------------------------------------------------------------- |
| Type an allowed char     | Writes the character into the focused segment and advances focus to the next one. |
| Backspace, segment empty | Moves focus to the previous segment and clears its character.                     |
| Backspace, segment full  | Clears the current segment without moving focus.                                  |
| Left / Right arrow       | Moves focus to the previous / next segment without altering values.               |
| Home / End               | Moves focus to the first / last segment.                                          |
| Paste                    | Distributes accepted characters across segments starting at the focused segment.  |

Multi-character input (such as iOS / Android one-time-code autofill that types the whole code into the first segment) is treated as a paste: filtered against the active mode, truncated to `length`, and distributed across the row.

## Focus Behaviour

Each segment gets the standard cinder focus ring (`box-shadow` ring plus a `forced-colors` outline fallback). Focus visibly tracks across segments as the user types or pastes. The hidden input that carries the form value is `type="hidden"` and is not in the tab order.

## Disabled State

`disabled` (or a wrapping `<FormField disabled>`) disables every segment and the hidden input. The group element receives `aria-disabled="true"` so assistive technology announces the group as a whole, not just each focused segment.

## Autocomplete

The first segment carries `autocomplete="one-time-code"` by default so iOS Safari and Android Chrome offer SMS-code autofill. Consumers can override `autocomplete` for codes that should not be filled (for example a memorized backup code).

## Visual Style

Segments use a monospace font so every character is the same width. The masked mode renders segments as `type="password"` for sensitive codes (PINs, backup codes); the emitted `value` is unchanged.

## Color Contrast

- Segment text uses `--cinder-text`, satisfying WCAG AA 4.5:1 against the segment surface in both light and dark modes.
- Error borders use `--cinder-danger` as a redundant visual cue alongside `aria-invalid="true"`. The `error` text below the segments provides the message in every case.

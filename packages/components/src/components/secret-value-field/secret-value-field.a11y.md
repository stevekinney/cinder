# SecretValueField · accessibility

## Pattern

Custom composite widget. The field follows no single ARIA authoring practice pattern, but borrows conventions from the password-field and copy-button patterns: a labelled group containing a read-only display region and toggle/copy action buttons.

The hard security constraint governs every accessibility decision: the secret value must never appear in any accessible attribute (`aria-label`, `aria-description`, `title`, `data-*`, etc.), even when "revealed". Only the visible text node contains the value when the user explicitly requests reveal.

## Roles names states

| Element                | Role / attribute                                              | Value                                                                             |
| ---------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Root `div`             | implicit `generic`                                            | —                                                                                 |
| Label `span`           | implicit `generic`; has an `id`                               | Used by `aria-labelledby` on the row group                                        |
| Row `div`              | `role="group"` + `aria-labelledby`                            | Points to the label `span` id                                                     |
| Value `span`           | implicit `generic`; `aria-label`                              | `"{label}, masked"` or `"{label}, revealed"` — never the value                    |
| Prefix `span`          | `aria-hidden="true"`                                          | Decorative metadata; AT skips it                                                  |
| Suffix `span`          | `aria-hidden="true"`                                          | Decorative metadata; AT skips it                                                  |
| Reveal toggle `button` | `type="button"` + `aria-pressed` + `aria-label`               | `aria-pressed="false"/"true"`; label is "Reveal {label}" / "Hide {label}"         |
| Copy `button`          | `type="button"` + `aria-label`                                | `"Copy {label}"` idle; `copiedLabel` (default "Copied") after success             |
| Live region `div`      | `role="status"` + `aria-live="polite"` + `aria-atomic="true"` | Empty at idle; set to `copiedLabel` on successful copy; never contains the secret |

## Keyboard

| Key           | Action                                                                                                      |
| ------------- | ----------------------------------------------------------------------------------------------------------- |
| Tab           | Move focus into and out of the component; cycles through the reveal toggle (if present) and the copy button |
| Space / Enter | Activate the focused button (reveal toggle or copy)                                                         |

## Mouse / pointer

Clicking the copy button copies the value to the clipboard. Clicking the reveal toggle (when `allowReveal` is `true`) toggles the masked/revealed display. Both actions are purely pointer-activated; no drag or long-press behavior is defined.

## Hard scope caps

- The reveal toggle is **only present** when the consumer explicitly sets `allowReveal={true}`. It is never auto-enabled.
- The component does not manage focus trap or dialog behavior — it is designed for inline use in settings tables and cards.
- `initiallyRevealed` affects only the initial render; it does not prevent the user from re-hiding the value if `allowReveal` is also set.
- The `warning` snippet renders visible advisory content adjacent to the value row, but it is not automatically wired with `aria-describedby`. Consumers that need an advisory to be announced as part of the field description should associate that text externally; the component intentionally avoids assuming a warning layout.

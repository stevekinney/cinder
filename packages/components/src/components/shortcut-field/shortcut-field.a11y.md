# ShortcutField · accessibility

## Interaction model

ShortcutField presents a focusable `role="textbox"` with `aria-readonly="true"`. It is a recorder rather than a text editor: the control captures one normalized key combination while it owns focus, then returns to its resting state. The visible `label` is exposed through `aria-label`; applications should provide a specific label when more than one shortcut is present.

## Focus management

- The textbox is keyboard-focusable when enabled and is removed from the tab order when disabled.
- Focus on the textbox arms capture. Pointer activation also arms capture.
- Capture ends on a successful recording, `Escape`, or blur. Focus stays on the textbox after a successful recording or cancellation, so a user can immediately try again.
- The clear button is a separate, labelled tab stop. Activating it clears the value and leaves focus on the button; it is not rendered when there is no value or when the field is disabled.
- The component does not move focus automatically and does not trap focus.

## Keyboard matrix

| Input                                        | Result                                                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `Tab`                                        | Uses normal browser focus movement; capture is not committed.                                                      |
| `Escape` while capturing                     | Cancels capture, clears any validation error, announces cancellation, and preserves the current value.             |
| `Meta`, `Control`, `Alt`, or `Shift` alone   | Keeps capture armed and waits for a non-modifier key.                                                              |
| Any other key while capturing                | Prevents the browser default, normalizes the combination, validates it, and either commits it or reports an error. |
| Clear button activation (`Enter` or `Space`) | Clears the shortcut and announces that it was cleared.                                                             |

Modifier order is stable (`Meta`, `Control`, `Alt`, `Shift`), letter keys are uppercased, and the space key is announced as `Space`.

## Validation behavior

When `validate` rejects a combination, the value is unchanged, `aria-invalid="true"` is set on the textbox, and the error is referenced with `aria-describedby`. The error remains visible until a valid combination is captured, the value is cleared, or capture is cancelled with `Escape`. A valid capture clears the previous error before committing the new value.

## Assistive technology announcements

A polite, visually hidden live region announces successful captures (`Captured …`), validation messages, cancellation, and clearing. Errors are also exposed as visible text associated with the textbox, so users who do not receive live-region updates can still discover the problem. The generated error id is stable for the component instance and uses the consumer-provided root `id` when available.

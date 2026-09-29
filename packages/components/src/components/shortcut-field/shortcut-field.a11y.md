# ShortcutField · accessibility

## Interaction model

ShortcutField presents a focusable `role="textbox"` with `aria-readonly="true"`. It is a recorder rather than a text editor: the control captures one normalized key combination while it owns focus, then returns to its resting state. `label` renders as visible field text by default, composed through the shared `FormFieldFrame` primitive (the same one `FormField`, `Input`, and `PhoneInput` use) — a private `ShortcutFieldControl` reads that primitive's context and applies `aria-labelledby` to the textbox, so the accessible name matches the visible text. Pass `labelVisible={false}` to keep the accessible name while visually hiding the label with the shared `cinder-sr-only` treatment (COR-443); applications should always provide a specific label when more than one shortcut is present.

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

When `validate` rejects a combination, the value is unchanged, `aria-invalid="true"` is set on the textbox (from the shared `FormFieldFrame` context's `invalid` value), and the error is referenced with `aria-describedby`. The error paragraph is the same `FormFieldFrame` error region every other field control uses — mounted only while an error is present (`errorMountedOnDemand`), with `aria-live="polite"` — so it disappears from the DOM, not just visually, once the error clears. The error remains until a valid combination is captured, the value is cleared, or capture is cancelled with `Escape`. A valid capture clears the previous error before committing the new value.

## Assistive technology announcements

A polite, visually hidden live region — separate from `FormFieldFrame`'s validation-error live region — announces successful captures (`Captured …`), validation messages, cancellation, and clearing. Errors are also exposed as visible text associated with the textbox, so users who do not receive live-region updates can still discover the problem. The error id is derived by `FormFieldFrame` from the component's `id` (consumer-provided, or a generated fallback).

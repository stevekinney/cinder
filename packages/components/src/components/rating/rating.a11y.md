# Rating Accessibility

## ARIA Roles and Attributes

- The interactive root is a `role="radiogroup"`. Its accessible name comes from, in order: the `label` prop, a wrapping `<FormField>` label, `aria-labelledby`, then `aria-label`. Development builds warn if none of these are present.
- Each rating step renders a `<button type="button" role="radio">` and is labelled with a precise text equivalent (`3 stars of 5`, `4.5 stars of 5`). Screen readers can announce each option without depending on the star glyph itself.
- The currently committed value carries `aria-checked="true"`; every other option carries `aria-checked="false"`. The unrated state (`value === 0`) leaves every option `aria-checked="false"`.
- `description` and `error` ids compose into a single `aria-describedby` on the group so supporting text follows focus. `error` also sets `aria-invalid="true"` on the group.
- `required` is announced via `aria-required="true"` on the group. Because the radios are button-based, native form-submit blocking is intentionally not wired — pair `required` with validation in your form layer and surface failure through the `error` prop.

## Readonly Display

When `readonly={true}`, the component renders a non-interactive star display with a visually-hidden text equivalent such as `3.5 stars out of 5`. The readonly mode is keyboard-unreachable and removes the `radiogroup` role entirely so it does not appear as a form control to assistive technology.

## Keyboard Interactions

Focus uses a roving `tabindex`. Exactly one option is in the tab order at a time: the currently checked option, or the first option in the unrated state.

| Key                   | Behaviour                                                                      |
| --------------------- | ------------------------------------------------------------------------------ |
| Tab                   | Moves focus to the active option (the checked one, or the first when unrated). |
| ArrowRight / ArrowUp  | Moves focus and the committed value forward by one precision step.             |
| ArrowLeft / ArrowDown | Moves focus and the committed value backward by one precision step.            |
| Home                  | Moves focus and committed value to the first option (`stepSize`).              |
| End                   | Moves focus and committed value to the last option (`count`).                  |
| Space / Enter         | Commits the focused option (or the first option from the unrated state).       |

When the rating is unrated (`value === 0`), pressing `ArrowRight`, `ArrowUp`, `Space`, or `Enter` commits the first option, while `ArrowLeft` and `ArrowDown` wrap to and commit the last option. This matches the WAI-ARIA radio-group keyboard pattern while still letting users enter and leave the rating with arrow keys alone.

## Focus Behaviour

Each option carries the cinder focus ring on `:focus-visible` so keyboard users see a clear ring around the focused star. The native click hit area covers each star independently so pointer users can click a target sized to fingertip taps.

## Pointer Hover

Pointer hover previews a value visually but never commits it. Pointer-leave clears the hover preview back to the committed value. `onchange` is **not** called during hover preview — only on click.

## Disabled State

`disabled` (or a wrapping `<FormField disabled>`) sets `aria-disabled="true"` on the group, disables every option button, dims the group, and prevents hover preview. The hidden form input mirrors the disabled state.

## Color Contrast

The fill color uses `--cinder-warning` against the empty `--cinder-border-strong`, giving a clear visual distinction. Critically, the rating is **not communicated by color alone**: each option has a text label (`3 stars of 5`) and `aria-checked` carries the committed state. A user with low color vision can still tell the rating from screen-reader output or from the readonly text equivalent.

In Windows High Contrast Mode (`forced-colors: active`) the fill switches to the system `Highlight` color so the rating remains visible.

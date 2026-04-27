# Toggle Accessibility

## Pattern

This component implements the **toggle button** pattern — `<button type="button" aria-pressed>` — not the switch pattern (`role="switch" aria-checked`). Use it for actions that toggle a state on or off, such as activating bold formatting, muting audio, or enabling a feature flag. Prefer `role="switch"` (the cinder Switch component) when the control represents a binary system setting that takes immediate effect, such as turning on dark mode at the OS level.

## ARIA Roles and Attributes

| Attribute       | Value                          | Purpose                                                              |
| --------------- | ------------------------------ | -------------------------------------------------------------------- |
| `type`          | `"button"`                     | Prevents form submission; ensures native keyboard activation.        |
| `aria-pressed`  | `"true"` \| `"false"`          | Communicates the current pressed/unpressed state to assistive tech.  |
| `aria-label`    | value of the `label` prop      | Provides a concise accessible name when no visible label is present. |
| `aria-disabled` | `"true"` (when `disabled`)     | Signals the non-interactive state to screen readers.                 |
| `disabled`      | present (when `disabled=true`) | Prevents pointer and keyboard activation at the browser level.       |

`aria-disabled` is only present when `disabled` is `true`; it is omitted entirely (not set to `"false"`) when the button is enabled, so screen readers do not announce a redundant "not disabled" state.

## Keyboard Interactions

| Key   | Behaviour                                                                      |
| ----- | ------------------------------------------------------------------------------ |
| Tab   | Moves focus to the toggle button. Skipped when `disabled`.                     |
| Enter | Activates the button — toggles `aria-pressed`. Native `<button>` handles this. |
| Space | Activates the button — toggles `aria-pressed`. Native `<button>` handles this. |

No custom `onkeydown` handler is needed. The native `<button>` element fires `click` on both Enter and Space automatically, which the `onclick` handler already covers.

## Focus

- The button receives focus in the natural tab order when not `disabled`.
- Focus styles are provided via `:focus-visible` in `toggle.css` using the cinder ring design token system, ensuring the focus indicator is visible in both default and Windows High Contrast Mode (Forced Colors Mode).
- Disabled toggles are removed from tab order by the browser via the `disabled` attribute.

## External Label Association

The `id` prop is placed on the `<button>` element so a consuming page can associate an external visible `<label>` element using `<label for="…">`. When an external label is present, the button's `aria-label` supplements rather than replaces it — screen readers announce the external label text in addition to the `aria-pressed` state.

## Screen Reader Announcements

A typical screen reader announcement when the button receives focus:

- Unpressed: "Dark mode, button, not pressed"
- Pressed: "Dark mode, button, pressed"

The exact phrasing varies by screen reader and browser pairing (NVDA+Firefox, JAWS+Chrome, VoiceOver+Safari all differ slightly), but `aria-pressed` is well-supported across all major combinations.

## Forced Colors Mode (Windows High Contrast)

The CSS uses `outline` rather than `box-shadow` for the focus ring in Forced Colors Mode. `box-shadow` is suppressed by Windows High Contrast Mode, making a `box-shadow`-only ring invisible to users who depend on it. The `@media (forced-colors: active)` block in `toggle.css` switches to a solid `outline` using the `ButtonText` system color.

## Content Guidance

- The `label` prop should be a short, action-oriented phrase describing what the toggle controls: "Bold", "Mute microphone", "Enable spell check".
- Avoid labels that describe the current state rather than the control: prefer "Bold" over "Text is bold".
- The toggle thumb (`aria-hidden="true"`) is purely decorative and must not carry meaningful text.

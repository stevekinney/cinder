# Toggle Accessibility

## Pattern

This component implements the **switch** pattern: `<button type="button" role="switch" aria-checked>`. Use it for binary on/off settings such as notifications, dark mode, automatic saving, or feature enablement.

For command-style toggle buttons such as bold, italic, mute, or selected toolbar tools, use a regular button with `aria-pressed` instead. Those controls represent whether an action mode is active; this component represents whether a setting is on.

## ARIA Roles and Attributes

| Attribute      | Value                          | Purpose                                                              |
| -------------- | ------------------------------ | -------------------------------------------------------------------- |
| `type`         | `"button"`                     | Prevents form submission; ensures native keyboard activation.        |
| `role`         | `"switch"`                     | Communicates switch semantics to assistive technology.               |
| `aria-checked` | `"true"` \| `"false"`          | Communicates whether the switch is on or off.                        |
| `aria-label`   | value of the `label` prop      | Provides a concise accessible name when no visible label is present. |
| `disabled`     | present (when `disabled=true`) | Prevents pointer and keyboard activation and removes from tab order. |

The native `disabled` attribute is sufficient for the underlying `<button>` element. It removes the element from the tab order, prevents activation, and is announced as "dimmed" or "unavailable" by screen readers. `aria-disabled` is intentionally omitted to avoid duplicate disabled-state announcements.

## Keyboard Interactions

| Key   | Behaviour                                                                      |
| ----- | ------------------------------------------------------------------------------ |
| Tab   | Moves focus to the switch. Skipped when `disabled`.                            |
| Enter | Activates the button and toggles `aria-checked`. Native `<button>` handles it. |
| Space | Activates the button and toggles `aria-checked`. Native `<button>` handles it. |

No custom `onkeydown` handler is needed. The native `<button>` element fires `click` on both Enter and Space, which the component's `onclick` handler already covers.

## Focus

- The switch receives focus in the natural tab order when not `disabled`.
- Focus styles are provided via `:focus-visible` in `toggle.css` using the cinder ring design token system.
- Disabled switches are removed from tab order by the browser via the `disabled` attribute.

## External Label Association

The `id` prop is placed on the `<button>` element. Because `aria-label` is present, it takes precedence over an external `<label for="...">` in accessible-name computation. If you need visible adjacent text, render it next to the switch and keep the `label` prop stable.

Do not wrap the switch button in a `<label>`. Label activation forwards clicks to its labeled control and can create double-toggle behavior for a nested interactive button.

## Migration from `pressed`

An earlier revision exposed a bindable `pressed` prop alongside `checked` that flipped the component's ARIA contract between `aria-pressed` and `aria-checked` based on which prop was bound. That dual contract has been removed: Toggle now exposes only `checked` and always renders `role="switch"` + `aria-checked`. Replace `bind:pressed={x}` with `bind:checked={x}`. For toggle-button affordances that should render `aria-pressed` (bold/italic/mute), use `Button` with `aria-pressed` directly.

## Screen Reader Announcements

A typical screen reader announcement when the switch receives focus:

- Off: "Email notifications, switch, off"
- On: "Email notifications, switch, on"

Exact phrasing varies by screen reader and browser pairing, but `role="switch"` with `aria-checked` is the intended semantic pairing for this visual control.

## Forced Colors Mode (Windows High Contrast)

The CSS uses `outline` rather than `box-shadow` for the focus ring in Forced Colors Mode. `box-shadow` is suppressed by Windows High Contrast Mode, making a `box-shadow`-only ring invisible to users who depend on it. The `@media (forced-colors: active)` block in `toggle.css` switches to a solid `outline` using the `ButtonText` system color.

## Content Guidance

- The `label` prop should name the setting controlled by the switch: "Email notifications", "Dark mode", "Auto-save drafts".
- Keep the accessible name stable as the state changes. Let `aria-checked` communicate on/off state instead of changing the label between "Enable" and "Disable".
- The toggle thumb (`aria-hidden="true"`) is decorative and must not carry meaningful text.

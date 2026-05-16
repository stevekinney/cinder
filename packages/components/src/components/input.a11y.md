# Input Accessibility

## ARIA Roles and Attributes

- The `<input>` element is a native form control; no additional `role` is needed.
- The `label` prop renders a `<label>` element with a `for` attribute equal to the `id` prop. This programmatically associates the label with the input so screen readers announce the label text when the input receives focus.
- The `description` prop renders a `<p>` element whose `id` is `{id}-description`. The input's `aria-describedby` attribute references this id so assistive technologies read the description text as supplementary information after the label.
- The `error` prop renders a `<p>` element whose `id` is `{id}-error`. Two attributes change on the input simultaneously: `aria-invalid="true"` signals to assistive tech that the field is in an error state, and `aria-describedby` includes `{id}-error` so the error message is announced.
- When both `description` and `error` are present, `aria-describedby` lists both ids separated by a space (`{id}-description {id}-error`). Screen readers announce them in order.
- The error `<p>` carries `aria-live="polite"` so dynamically injected error messages are announced without interrupting ongoing speech.

## Keyboard Interactions

| Key         | Behaviour                                                                           |
| ----------- | ----------------------------------------------------------------------------------- |
| Tab         | Moves focus to the input. The associated label text is announced by screen readers. |
| Shift + Tab | Moves focus away from the input.                                                    |
| Type        | Updates the bound `value`. No custom keydown handling is added by the component.    |

The input is a native `<input>` element, so all standard browser keyboard interactions (cursor movement, selection, cut/copy/paste) work without any component-level intervention.

## Focus Behaviour

Focus styling is provided by the `.cinder-input:focus-visible` rule using a `box-shadow` ring so the outline is visible in all color schemes. The `outline: transparent` pattern prevents a double-ring in browsers that render both `outline` and `box-shadow`.

In Windows High Contrast Mode (`forced-colors: active`), `box-shadow` is suppressed by the browser. A fallback `outline` rule restores focus visibility using the system `Highlight` color.

## Disabled State

When `disabled={true}` is passed, the native `disabled` attribute is set on `<input>`. The label receives `data-disabled="true"` which CSS uses to apply `cursor: not-allowed`, visually communicating the field is inactive. Disabled inputs are skipped by the tab order automatically via the browser's native behavior.

## Color Contrast

- Label text uses `--cinder-text` (light: oklch 20%, dark: oklch 92%) against the page background, satisfying WCAG AA 4.5:1 for normal text.
- Placeholder text uses `--cinder-text-subtle` which is intentionally lower contrast. Placeholders are not a substitute for labels — the visible `<label>` element carries the accessible name.
- Error text uses `--cinder-danger` which is calibrated to pass WCAG AA contrast against the component surface in both light and dark modes.
- The error-state border uses `--cinder-danger` as a redundant visual cue alongside `aria-invalid`. Color alone is not relied upon — the error text below the input provides the message in all cases.

## Content Guidance

- Always provide a `label` unless the input's purpose is unambiguous from surrounding context (e.g., a search field immediately following a "Search" heading). Even then, pass a visually hidden label via CSS (`sr-only`) rather than omitting it.
- Keep `description` text concise — one sentence of supplementary guidance. Do not repeat information already in the label.
- `error` messages must describe what went wrong and, where possible, how to fix it. Avoid generic messages like "Invalid input."
- Do not rely solely on placeholder text to communicate requirements; use `description` instead, as placeholder text disappears on input and is not consistently announced by all screen reader/browser combinations.

## Addons (leading and trailing)

Decorative addons (currency symbols, units, icons) render inside a wrapper that carries `aria-hidden="true"`. Screen readers skip them. The visible glyph is a visual hint; the input's `<label>` is the source of truth for meaning. If a leading "$" only signals currency, the label should already say "Amount in dollars"—do not rely on the symbol.

Informational addons that convey information not in the label must be surfaced to assistive technology AND associated with the input. Dropping `aria-hidden` on the addon wrapper alone only places the addon text somewhere in the accessibility tree—it does not cause screen readers to announce it when the input receives focus.

**The only supported path for informational addons is the `description` prop.** The input's `aria-describedby` is constructed internally from `descriptionId` and `errId` — a consumer-supplied `aria-describedby` passed via rest props is overwritten by the internal binding. Render the unit label, currency name, or other informational text as the `description` prop value; it will be announced on focus.

`leadingInteractive` / `trailingInteractive` are named for their primary purpose: a focusable control inside the addon. These flags exist to drop `aria-hidden` so the inner button or toggle is reachable and announced independently. They do not wire the addon's content to the input's description.

Interactive addons (clear button, password-reveal toggle, unit toggle): pass `trailingInteractive={true}` (or `leadingInteractive`) and render a `<button>` with an `aria-label` inside the snippet. The button is a sibling of `<input>`, not a child, so it has its own tab stop and is announced independently. The group's `:focus-within` ring fires for both the input and the button—that's intentional; the ring follows focus into the group. The inner control still gets its own `:focus-visible` ring from whatever component it is (e.g. cinder `Button`), so both rings stack: the outer signals "this field has focus inside it", the inner signals "this control specifically".

**Disabled state and interactive addons:** when `disabled={true}` is passed to `Input`, the inner `<input>` becomes disabled and the group paints disabled styling, but interactive controls rendered inside `leading` / `trailing` snippets remain functionally active unless the consumer disables them independently. The component cannot reach into snippet content. Consumers must mirror the input's disabled state on their addon controls (e.g. `<Button disabled={isDisabled}>...</Button>` where `isDisabled` is the same state passed to `Input`).

## Autocomplete guidance

### Sign-in forms (required pattern)

For sign-in forms, the identifier field **must** carry `autocomplete="email"` (when the field collects an email address) or `autocomplete="username"` (when it collects an opaque handle), and the password field **must** carry `autocomplete="current-password"`. These two attributes are what enable password managers and browser autofill to recognize the form as a sign-in form and offer saved credentials.

Omitting them is a regression: users who rely on autofill — including users with motor disabilities for whom typing a password is a significant barrier — lose access to saved credentials, and password managers may misclassify the form as a registration form and save wrong values.

See `packages/playground/src/examples/input/sign-in.example.svelte` for a composition that wires these attributes alongside the top-of-form `role="alert"` auth-error banner.

### General guidance

Always set the `autocomplete` attribute when the input collects a value the browser or password manager can fill. Cinder's `Input` forwards arbitrary `HTMLInputAttributes` via rest props, so `autocomplete="email"`, `autocomplete="current-password"`, `autocomplete="one-time-code"`, `autocomplete="postal-code"`, etc., flow through unchanged.

The most common values are `name`, `email`, `username`, `current-password`, `new-password`, `one-time-code`, `street-address`, `postal-code`, `cc-number`, `cc-exp`, `tel`. Use `autocomplete="off"` only for fields that genuinely should not be filled (search, ephemeral tokens)—overusing `off` degrades the experience for users who rely on autofill, including users with motor disabilities.

Specific notes:

- For login forms, the username field is `autocomplete="username"` and the password is `autocomplete="current-password"`. The "create account" password field is `autocomplete="new-password"`.
- For two-factor codes, `autocomplete="one-time-code"` enables SMS-code autofill on iOS Safari and Android Chrome.
- For "type your email again to confirm deletion" prompts, use `autocomplete="off"` and explain why in `description`.

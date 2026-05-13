# ButtonGroup Accessibility

## Why `role="group"`, not `role="radiogroup"` or `role="toolbar"`

`role="radiogroup"` is for single-selection controls where children are `role="radio"`. That's `segmented-control`'s job.

`role="toolbar"` is a stronger pattern that activates roving-tabindex expectations in screen readers — arrow keys navigate between items, and Tab exits the toolbar entirely. ButtonGroup deliberately does _not_ implement this model: its children are independent actions, and the native Tab order is the correct mental model for users.

`role="group"` is the unopinionated grouping wrapper. It announces the group's accessible name to assistive technologies and does nothing else — no keyboard interception, no selection coordination.

## Accessible name is required

Every ButtonGroup must have a non-empty accessible name, provided via exactly one of:

- **`label`**: an inline string, used when no visible heading already names the group. Emitted as `aria-label` on the container.
- **`labelledBy`**: an element ID pointing at a visible heading that already names the group. Emitted as `aria-labelledby`. Prefer this over `label` when a visible heading exists — it avoids the screen reader announcing the name twice.

The TypeScript discriminated union enforces this at compile time. A dev-mode `$effect` warns at runtime when either value is empty or whitespace-only.

## `aria-pressed` on individual toggle buttons is supported

A ButtonGroup can contain a mix of regular `<Button>` elements and toggle buttons (`<button aria-pressed="true|false">`). Toggle children manage their own `aria-pressed` — the group does not coordinate this state. This is the explicit separation from `segmented-control`: if your buttons share a value, you want `segmented-control`; if they are independent actions (some of which happen to be toggleable), you want `button-group`.

## Orientation

The group uses `data-cinder-orientation` (a data attribute, not an ARIA attribute) to drive the CSS layout direction. `aria-orientation` is intentionally absent: per ARIA 1.2, `aria-orientation` is only valid for roles such as `toolbar`, `listbox`, `menu`, `radiogroup`, `scrollbar`, `separator`, `slider`, `tablist`, and `tree` — not `group`. Emitting it on `role="group"` would produce invalid ARIA and fail automated accessibility audits (axe-core, Deque, IBM Equal Access). Orientation is a visual concern only and is handled entirely through the `data-cinder-orientation` attribute on the container.

## Why this is not `segmented-control`

**Decision rule:** if your buttons share a value (exactly one is selected at a time), use `segmented-control`. If they are independent actions that happen to be visually grouped, use `button-group`.

`segmented-control` owns its child markup, uses `role="radiogroup"` with `role="radio"` children, and manages a bindable `value`. `button-group` is a visual container only — it renders whatever `children` you pass, with no awareness of state.

## Split-button composition

Compose a primary `<Button>` with a `<Dropdown>` whose trigger is an icon button:

```svelte
<ButtonGroup label="Save options">
  <Button>Save</Button>
  <Dropdown id="save-options">
    <DropdownTrigger><Button aria-label="More save options">▾</Button></DropdownTrigger>
    <DropdownMenu>
      <DropdownItem>Save as draft</DropdownItem>
      <DropdownItem>Save and publish</DropdownItem>
    </DropdownMenu>
  </Dropdown>
</ButtonGroup>
```

The `<Dropdown>` already wires `aria-haspopup="menu"` and `aria-expanded` on its trigger. `ButtonGroup` adds nothing beyond visual attachment. This is composition — not a new primitive.

## Keyboard model

Tab enters the first child, Tab moves to the next, Shift+Tab reverses. There is no arrow-key interception. A `<Dropdown>` child's internal arrow handling (up/down through menu items) kicks in once focus is inside the open menu — orthogonal to the group.

## Mixed-size children are a usage error

A `size="lg"` button next to a `size="sm"` button will look broken inside a collapsed group. There is no runtime enforcement — keep child sizes consistent.

## Public styling contract

Direct children are tagged with `data-cinder-button-group-item` at mount. The attribute value is an opaque internal identifier used for ownership tracking — **consumers must match on attribute presence only** (`[data-cinder-button-group-item]`), never on a specific value. The attribute name is namespaced to avoid collisions and is part of the public API — it will not be renamed without a deprecation cycle. Consumers can target this attribute for their own overrides when it lands on a direct child. Manually adding the attribute to a deep descendant is **not** a supported escape hatch.

## Forced-colors / high-contrast mode

The focus elevation rule relies on `z-index`, which is honored in forced-colors mode. The collapsed borders rely on `margin: -1px`, which works regardless of color. No additional `@media (forced-colors: active)` overrides are needed beyond what `<Button>` already ships.

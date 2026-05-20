# NavigationItem Accessibility

## Rendering Strategy

NavigationItem renders as one of two native elements depending on the props passed:

- **`<a href="...">`** — when the `href` prop is present (link arm). Use this when the item navigates to a URL.
- **`<button type="button">`** — when the `onclick` prop is present (button arm). Use this when the item triggers an action (e.g., filtering, opening a panel) without changing the URL.

Choosing the semantically correct element is the foundation of accessible navigation: screen readers announce `<a>` as a "link" and `<button>` as a "button", which sets the correct expectation for keyboard and pointer users.

## ARIA Attributes

### Active state

| Arm    | Attribute      | Value    | Meaning                                                                  |
| ------ | -------------- | -------- | ------------------------------------------------------------------------ |
| Link   | `aria-current` | `"page"` | Indicates this link represents the current page in a navigation set.     |
| Button | `aria-current` | `"page"` | Indicates the button is the currently selected item in a navigation set. |

`aria-pressed` is intentionally not used on the button arm. `aria-pressed` implies toggle semantics—a button that independently switches between on and off states. Navigation selection is not a toggle; the correct signal is `aria-current`, which communicates "this is the active item in a set" without implying the button controls its own binary state.

When not active, neither attribute is rendered (omitting them is preferred over setting a `false` / `undefined` value, which can confuse some assistive technologies).

### Disabled state

Both arms set `aria-disabled="true"` when `disabled` is passed. This approach is used instead of the native `disabled` attribute for two reasons:

1. The native `disabled` attribute removes the element from the tab order entirely, making it invisible to keyboard users. `aria-disabled` keeps the element focusable so users can discover it and understand why it is unavailable.
2. For the `<a>` element, the native `disabled` attribute is not a valid HTML attribute and has no semantic effect.

When `aria-disabled="true"` is set, the click handler intercepts and discards all click events before invoking any consumer-provided callback or navigating.

## Keyboard Interactions

| Key         | Behaviour                                                                           |
| ----------- | ----------------------------------------------------------------------------------- |
| Tab         | Moves focus to the navigation item. Disabled items remain in the tab order.         |
| Shift + Tab | Moves focus away from the navigation item.                                          |
| Enter       | Follows the link (`<a>`) or activates the button (`<button>`). Blocked if disabled. |
| Space       | Activates a `<button>` navigation item. Has no effect on `<a>` by default.          |

## Focus Management

Both element arms are natively focusable and receive a visible `:focus-visible` ring using `box-shadow` to avoid disrupting the layout. In Forced Colors Mode (Windows High Contrast, print media) the `box-shadow` ring is invisible; a fallback `outline` with `ButtonText` color is applied via `@media (forced-colors: active)`.

## Screen Reader Announcements

- An active link is announced with its text content followed by "link" and "current page" (or equivalent in the active AT's language).
- An active button is announced with its text content followed by "button" and "current" (or equivalent in the active AT's language).
- A disabled item is announced with "dimmed" or "unavailable" depending on the assistive technology and browser pairing.

## Navigation Landmark Context

NavigationItem is designed to be used inside a `<nav>` element or another appropriate landmark (`role="navigation"`). The landmark provides the structural context; NavigationItem supplies the individual interactive elements within it. Without a surrounding landmark, groups of navigation items have no ARIA context for screen reader users jumping between landmarks.

## Content Guidance

- Each item must have a meaningful text label visible to all users — do not use icon-only items without a supplemental `aria-label` on the item or a visually hidden span inside `children`.
- Labels should be unique within a navigation region so users can distinguish items when navigating by tab or the screen reader's link/button list.
- Avoid changing an item's label text dynamically as the active state changes — the active state is communicated via `aria-current` / `aria-pressed`, not by altering the label.

## Variants

`NavigationItem` accepts a `variant` prop (`'horizontal'` | `'mobile'`, default `'horizontal'`) that controls stacked layout on small viewports. The value is emitted as a `data-variant` attribute on the root element.

**Visual behavior is CSS-only and viewport-gated.** The `data-variant='mobile'` styles are scoped inside a `@media (max-width: 47.99rem)` rule. Passing `variant='mobile'` on a desktop viewport has no visual effect—the item renders identically to the horizontal variant. This keeps the variant safe to pass at all viewports without conditional JS.

**Usage with `NavigationBar`.** When `NavigationBar` renders with a `menuToggle` snippet (mobile collapse enabled), it passes a `{ variant }` context object to the `items` snippet. Consumers forward this to each `NavigationItem` to enable stacked layout automatically:

```svelte
{#snippet items({ variant })}
  <NavigationItem href="/home" {variant}>Home</NavigationItem>
  <NavigationItem href="/docs" {variant}>Docs</NavigationItem>
{/snippet}
```

When a consumer's `items` snippet does not destructure the context parameter, `NavigationItem` falls back to its own `variant='horizontal'` default. Mobile styling is then opt-in per-item rather than automatic.

**Accessibility impact.** The `variant` prop has no ARIA semantics. It controls layout only. Screen readers announce both variants identically—the accessible name, role (`link` or `button`), and state (`aria-current`, `aria-disabled`) are unchanged by `variant`.

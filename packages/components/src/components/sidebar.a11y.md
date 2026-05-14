# Sidebar — Accessibility Notes

Sidebar is a layout-level navigation container that combines branding, a vertical
nav region, and an optional footer. On wide viewports it renders inline as a
landmark; below the `md` breakpoint (~767px) it renders inside a `<Drawer>`.

## Landmark structure

- Outer container is `<aside>` with a required `aria-label` (defaults to "Sidebar").
- The inner navigation list lives inside a nested `<nav>` element whose
  accessible name is derived by appending `" navigation"` to `ariaLabel`. So
  with `ariaLabel="Workspace"` the `<aside>` is announced as "Workspace,
  complementary" and the inner `<nav>` as "Workspace navigation". The two
  landmarks are distinct in the landmarks list — the component owns this
  separation; consumers do not pass two labels.
- If the page contains more than one `<aside>` or more than one navigation
  landmark, pass a unique `ariaLabel` per Sidebar instance. The default
  "Sidebar" is fine for a single-sidebar page but collides on dashboards with
  primary + contextual sidebars.
- Below the `md` breakpoint the `<aside>` is replaced by `<Drawer>`. The drawer
  carries its own `<dialog role="dialog" aria-modal="true">` and an internal
  heading sourced from `ariaLabel`; the inner `<nav>` is still present inside
  the drawer body with the same derived `" navigation"` label.

## ARIA attributes

| Prop / source                                            | Attribute on aside / drawer                  |
| -------------------------------------------------------- | -------------------------------------------- |
| `ariaLabel` (default `'Sidebar'`)                        | `aria-label` on `<aside>` (or drawer `<h2>`) |
| `ariaLabel` (derived `"${ariaLabel} navigation"`)        | `aria-label` on inner `<nav>`                |
| Passing `aria-label` or `aria-labelledby` via rest props | Stripped — the required prop always wins     |

An empty or whitespace-only `ariaLabel` throws at render time. This is a hard
fail because a landmark with no accessible name is worse than no landmark — it
gets announced as a duplicate by screen readers without context.

## Collapsed mode

Sidebar publishes a `collapsed` boolean via context. Sidebar itself applies a
`data-cinder-collapsed` attribute on the inline `<aside>` (or on the mobile
wrapper inside the drawer) which the stylesheet uses to hide visible text
labels in nav children.

**Accessibility-preserving hide.** Visible text labels (`SideNavigationGroup`
section headers and `NavigationItem` leaf text) are hidden using the
visually-hidden technique (`position: absolute; clip: rect(0,0,0,0); ...`)
rather than `display: none`. The visual presentation is icon-only, but each
focusable element retains its accessible name in the accessibility tree, so
screen-reader users still hear the label when focus lands on the trigger or
link. Decorative chrome (group badge, chevron, disclosed panel) is hidden with
`display: none` because it has no accessible name to preserve.

**Consumer guideline.** Every icon inside a collapsible Sidebar should be
marked `aria-hidden="true"` so it does not duplicate the accessible name. The
text label is what names the element; the icon is decoration.

## Mobile drawer behavior

Below `md`, Sidebar renders inside `<Drawer side="left" size="md">`. The
`collapsed` prop maps to drawer state:

- `collapsed=false` → drawer open
- `collapsed=true` → drawer closed

Mobile drawer inherits Drawer's focus trap, ESC handling, body scroll lock, and
backdrop click — see [`drawer.a11y.md`](drawer.a11y.md).

The brand region renders inline at the top of the drawer body (not as the
drawer's `<h2>` title), so the drawer's visible heading reflects `ariaLabel`
and the brand block stays a visual region rather than the accessible name.

### Wiring the mobile trigger

The mobile drawer has no built-in opener — by design, since the trigger
typically lives in a top navigation bar outside the sidebar. The recommended
pattern is a hamburger button with `aria-controls` pointing at the sidebar and
`aria-expanded` reflecting `!collapsed`:

```svelte
<button
  type="button"
  aria-controls="primary-sidebar"
  aria-expanded={!collapsed}
  aria-label="Open primary navigation"
  onclick={() => (collapsed = !collapsed)}
>
  <!-- hamburger icon -->
</button>

<Sidebar id="primary-sidebar" bind:collapsed ariaLabel="Workspace">...</Sidebar>
```

This wires the open/close affordance into the page chrome and keeps the
trigger discoverable on mobile.

## SSR behavior

In desktop / inline mode the `<aside>` renders normally on the server. In
mobile mode the drawer follows the [OVERLAY-POLICY](../_internal/OVERLAY-POLICY.md):
no overlay markup is emitted on the server. A sidebar that should appear
hydrated-open on a mobile-width SSR response will paint one frame later than
the desktop counterpart.

The `MediaQuery` SSR fallback is `false`, so the server renders the desktop
branch by default. On a mobile-width viewport, the user briefly sees the
desktop `<aside>` before the client-side `MediaQuery` flips and the component
switches to the drawer branch — a one-frame layout shift. If first-paint
mobile correctness matters more than desktop, set `collapsed={true}` as a safe
default so the desktop sidebar renders in icon-only mode before the swap.

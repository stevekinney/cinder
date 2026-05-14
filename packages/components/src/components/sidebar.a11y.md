# Sidebar — Accessibility Notes

Sidebar is a layout-level navigation container that combines branding, a vertical
nav region, and an optional footer. On wide viewports it renders inline as a
landmark; below the `md` breakpoint (~767px) it renders inside a `<Drawer>`.

## Landmark structure

- Outer container is `<aside>` with a required `aria-label` (defaults to "Sidebar").
- The actual navigation list lives inside a nested `<nav>` element that carries
  the same `aria-label`. The `<aside>` provides a complementary-content landmark;
  the inner `<nav>` provides the navigation landmark. Both must have distinct,
  non-empty labels if the page has more than one of each kind.
- Below the `md` breakpoint the `<aside>` is replaced by `<Drawer>`. The drawer
  carries its own `<dialog role="dialog" aria-modal="true">` and an internal
  heading sourced from `ariaLabel`; the inner `<nav>` is still present inside
  the drawer body.

## ARIA attributes

| Prop / source                                            | Attribute on aside / drawer                 |
| -------------------------------------------------------- | ------------------------------------------- |
| `ariaLabel` (default `'Sidebar'`)                        | `aria-label` on `<aside>` and inner `<nav>` |
| Passing `aria-label` or `aria-labelledby` via rest props | Stripped — the required prop always wins    |

An empty or whitespace-only `ariaLabel` throws at render time. This is a hard
fail because a landmark with no accessible name is worse than no landmark — it
gets announced as a duplicate by screen readers without context.

## Collapsed mode

Sidebar publishes a `collapsed` boolean via context. Descendant components
(e.g. `side-navigation-group`, `navigation-item`) can read this context to switch
to an icon-only presentation. Sidebar itself applies a `data-cinder-collapsed`
attribute on the `<aside>` in desktop mode, which the stylesheet uses to hide
text labels in nav children.

**Consumer guideline**: Every `NavigationItem` inside a collapsible sidebar must
carry an `aria-label` so the icon-only presentation retains an accessible name.
Cinder does not synthesize labels from icon glyphs; the consumer owns the text.

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

## SSR behavior

In desktop / inline mode the `<aside>` renders normally on the server. In
mobile mode the drawer follows the [OVERLAY-POLICY](../_internal/OVERLAY-POLICY.md):
no overlay markup is emitted on the server. A sidebar that should appear
hydrated-open on a mobile-width SSR response will paint one frame later than
the desktop counterpart.

The `MediaQuery` SSR fallback is `false`, so the server renders the desktop
branch by default.

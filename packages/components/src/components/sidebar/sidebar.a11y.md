# Sidebar — Accessibility Notes

Sidebar is a layout-level navigation container that combines a vertical nav
region and an optional footer. On wide viewports it renders inline as a
landmark; below the `md` breakpoint (~767px) it renders inside a `<Drawer>`.

## Landmark structure

- Outer container is `<aside>` with a required `aria-label` (defaults to "Sidebar").
- The `navigation` snippet renders inside a structural `<div>`, not another
  landmark. Navigation content owns its landmark and accessible name. The
  recommended `<SideNavigation ariaLabel="Workspace navigation">` composition
  therefore produces one navigation landmark alongside the outer complementary
  landmark, without nesting `<nav>` elements.
- If the page contains more than one `<aside>` or more than one navigation
  landmark, pass a unique `label` per Sidebar instance. The default
  "Sidebar" is fine for a single-sidebar page but collides on dashboards with
  primary + contextual sidebars.
- Below the `md` breakpoint the `<aside>` is replaced by `<Drawer>`. The drawer
  carries its own `<dialog role="dialog" aria-modal="true">` and an internal
  heading sourced from `label`; the navigation snippet keeps ownership of its
  landmark and accessible name inside the drawer body.

## ARIA attributes

| Prop / source                                            | Attribute on aside / drawer                  |
| -------------------------------------------------------- | -------------------------------------------- |
| `label` (default `'Sidebar'`)                            | `aria-label` on `<aside>` (or drawer `<h2>`) |
| Passing `aria-label` or `aria-labelledby` via rest props | Stripped — the required prop always wins     |

`Sidebar.label` does not name navigation content. Pass an accessible name to
the component rendered in the `navigation` snippet, such as
`SideNavigation.ariaLabel`.

An empty or whitespace-only `label` throws at render time. This is a hard
fail because a landmark with no accessible name is worse than no landmark — it
gets announced as a duplicate by screen readers without context.

## Collapsed mode

Sidebar publishes a `collapsed` boolean via context. On the inline `<aside>`
desktop branch, Sidebar applies a `data-cinder-collapsed` attribute that the
stylesheet uses to hide visible text labels in nav children (icon-rail mode).
The mobile branch deliberately omits the attribute: there, `collapsed=true`
means "drawer closed" rather than "icon-only", and `collapsed=false` means
"drawer open". Activating the icon-rail CSS inside an open drawer would cause
a one-frame label flash when the consumer flips `collapsed` from `true` to
`false` to open the drawer.

**Accessibility-preserving hide.** Visible text labels (`SideNavigationGroup`
section headers and `NavigationItem` leaf text) are visually removed without
using `display: none`. Element children use the standard visually-hidden
technique (`position: absolute; clip: rect(0,0,0,0); ...`); direct text nodes
are suppressed by setting the item `font-size` to `0` while restoring icon
descendant sizing. The visual presentation is icon-only, but the label text
stays in the DOM for accessible-name computation. Decorative chrome (group
badge, chevron, disclosed panel) is hidden with `display: none` because it has
no accessible name to preserve.

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

### Wiring the mobile trigger

The mobile drawer has no built-in opener — by design, since the trigger
typically lives in a top navigation bar outside the sidebar. The recommended
pattern is a hamburger button with `aria-controls` pointing at the sidebar and
`aria-expanded` reflecting `!collapsed`:

```svelte
<script lang="ts">
  import { SIDEBAR_MOBILE_MEDIA_QUERY, Sidebar } from '@lostgradient/cinder/sidebar';
  import { MediaQuery } from 'svelte/reactivity';

  const mobile = new MediaQuery(SIDEBAR_MOBILE_MEDIA_QUERY, false);
  let collapsed = $state(mobile.current);

  const triggerLabel = $derived(collapsed ? 'Open primary navigation' : 'Close primary navigation');
</script>

{#if mobile.current}
  <button
    type="button"
    aria-controls="primary-sidebar"
    aria-expanded={!collapsed}
    aria-label={triggerLabel}
    onclick={() => (collapsed = !collapsed)}
  >
    <!-- hamburger icon -->
  </button>
{/if}

<Sidebar id="primary-sidebar" bind:collapsed label="Workspace">...</Sidebar>
```

This wires the open/close affordance into the page chrome and keeps the
trigger discoverable on mobile. `SIDEBAR_MOBILE_MEDIA_QUERY` is the public
breakpoint contract for app chrome that needs to appear at the same viewport
boundary as Sidebar's drawer. On desktop the `id` lands on the `<aside>`.
On mobile, once the drawer has hydrated, the same `id` lands on the
persistent drawer `<dialog>` and resolves whether the drawer is open or
closed. Before hydration the drawer `<dialog>` is not in the DOM at all
(drawer markup is gated on hydration), and the server renders the desktop
branch by default — so on a mobile-width SSR response, `aria-controls`
points at the desktop `<aside>` for one frame before the client swaps to
the drawer `<dialog>`. The relationship resolves throughout, but the
controlled element changes once on hydration — see
[SSR behavior](#ssr-behavior) below. If you need `aria-controls` to point
at the drawer from the very first paint, render the trigger conditionally
on hydration; setting `collapsed` does not change when the drawer mounts.

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

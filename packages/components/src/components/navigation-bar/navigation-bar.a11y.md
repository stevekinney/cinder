# NavigationBar Accessibility

## Landmark Labeling

`NavigationBar` renders a `<nav>` landmark. The accessible name is set via the `label` prop, which defaults to `"Main navigation"`. Pages with more than one `<nav>` landmark must pass distinct values so screen reader users can distinguish them when jumping between landmarks.

The `label` prop always wins over any `aria-label` passed via rest props. The rest `aria-label` is stripped before spreading to prevent silent collisions.

## Mobile Toggle Contract

When a `menuToggle` snippet is provided, the component injects a `NavigationBarToggleAttributes` object into the snippet as its parameter:

```ts
type NavigationBarToggleAttributes = {
  'aria-expanded': 'true' | 'false';
  'aria-controls': string; // the id of the collapsible items region
  onclick?: (event: MouseEvent) => void; // omitted during SSR
};
```

The consumer is responsible for:

1. Spreading these attributes onto a native `<button>` element.
2. Giving the button a meaningful accessible name via `aria-label` (e.g., `"Open menu"` / `"Close menu"`) or visible text.

`aria-expanded` reflects `mobileMenuOpen`. `aria-controls` points at the items region's `id` so assistive technologies can identify the controlled region. The component manages both values internally.

## Keyboard Interactions

| Key    | Behavior                                                                                                         |
| ------ | ---------------------------------------------------------------------------------------------------------------- |
| Tab    | Moves focus through items and actions in DOM order.                                                              |
| Escape | Closes the mobile menu when open. Scoped to the `<nav>` element—Escape pressed outside the navbar has no effect. |

### Scoped Escape behavior

The Escape handler is attached to the `<nav>` element rather than `<svelte:window>`. This means Escape only closes the menu when focus is inside the navbar, avoiding interference with dialogs, comboboxes, or other disclosures elsewhere on the page.

### Cooperative Escape semantics

If a component inside the navbar (a search field, combobox, or nested disclosure) calls `event.preventDefault()` on a keydown event, the menu's Escape handler is skipped. This lets nested interactive widgets own their own Escape behavior without fighting the navbar's dismiss logic.

Consumer `onkeydown` handlers passed via rest props are also respected: the consumer handler runs _first_, and if it calls `preventDefault()`, the internal close is cancelled.

## Focus Return

When the user presses Escape to close the menu, focus is returned to the toggle button that opened it. This focus-return guarantee requires that, on the client, the consumer's `menuToggle` snippet spreads `toggleAttributes.onclick` onto a native `<button>` element so `event.currentTarget` is a real focusable DOM element.

If a consumer wraps the toggle in a custom component without ensuring the native button receives `onclick` directly, Escape still closes the menu but focus does not move. This is a documented degradation, not a bug.

## Disclosure, Not Modal

`NavigationBar` implements the ARIA disclosure pattern. The mobile items panel is not a modal:

- There is no focus trap. Tab order continues naturally from the toggle, through the items, to the actions, and off the navbar.
- Clicking outside the navbar does not close the menu. This is intentional: top-of-page navigation bars are not menus, and outside-click close can swallow scroll-region clicks and surprise users. Consumers who need outside-click close should attach a document-level click listener themselves and set `mobileMenuOpen = false`.

## Route-Change Auto-Close

The component has no router dependency. Consumers using a client-side router ([SvelteKit](https://kit.svelte.dev), etc.) should subscribe to route-change events and set `bind:mobileMenuOpen` to `false` when the route changes. Example:

```svelte
<script>
  import { page } from '$app/state';
  let mobileMenuOpen = $state(false);

  $effect(() => {
    // Close the menu on every navigation.
    page.url;
    mobileMenuOpen = false;
  });
</script>

<NavigationBar bind:mobileMenuOpen>
  {#snippet menuToggle(attrs)}
    <button {...attrs} aria-label="Open menu">Menu</button>
  {/snippet}
  ...
</NavigationBar>
```

## Visibility and Focus Tree

The items panel uses `visibility: hidden` (not `display: none` or `inert`) when closed. `visibility: hidden` removes the panel and its children from the accessibility tree immediately when the menu closes, without waiting for the CSS transition to complete. This means:

- Hidden items cannot receive focus.
- Screen readers do not announce hidden items.
- The transition affects only the opening animation; closing is visually instant (which is intentional—accessibility wins over the close animation).

## Reduced Motion

When `prefers-reduced-motion: reduce` is active, all panel transitions are disabled. The panel still opens and closes; it simply does not animate.

## Forced Colors (High Contrast Mode)

The mobile items panel retains a visible `border-bottom` using the `CanvasText` system color in Forced Colors Mode, ensuring the panel boundary remains visible without relying on `box-shadow` or `background-color` (both of which are overridden by the forced color palette).

## Actions Outside the Panel

The `actions` snippet renders _outside_ the collapsible panel by design. Primary action buttons (sign-in, CTAs) remain visible even when the menu is closed. Sites whose actions are numerous or large can place them inside the `items` snippet instead—the component does not enforce a single layout.

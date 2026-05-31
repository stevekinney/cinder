# Portal — Accessibility Rationale

## What this component is — and what it isn't

`portal.svelte` is a **headless DOM-relocation primitive**. It takes a subtree and moves the wrapping element that contains it into another element — `document.body` by default, or any element you resolve via an `HTMLElement` reference or a CSS selector string. That's the whole job. It renders a single `<div>` wrapper, attaches the move logic, and renders your `children` snippet inside it.

It is **not** an overlay, a dialog, a menu, or any other interactive widget. It has no `role`, no `aria-*` attributes, no keyboard handlers, no focus management, and no live-region semantics — and it should not. Portal is the plumbing that overlays are built _on top of_; it deliberately stays out of the accessibility tree's way so that the component using it (a popover, modal, drawer, toast region) owns the semantics.

Because it is a relocation utility rather than a control, this document is a **rationale and a consumer contract**, not a record of keyboard tests. There is no keyboard surface to test, and fabricating one would misrepresent what the component does.

## Why it exposes no ARIA

The wrapper Portal renders is a structural container, not a labeled region. Giving it a `role` would be actively harmful:

- A `role` on the wrapper would inject an extra node into the accessibility tree between the consumer's overlay element and its contents — usually a `generic`/`group` that the screen reader announces for no reason, or worse, a role that conflicts with the consumer's own `role="dialog"` / `role="menu"` further down the tree.
- An `aria-label` or `aria-describedby` here would attach naming to the wrong element. The thing that needs a name is the consumer's overlay surface (the dialog, the popover panel), not the transport `<div>` that happens to carry it across the DOM.

So Portal forwards whatever attributes you pass through `...rest` and otherwise adds nothing. If you need the relocated content to be announced as a dialog, _you_ put `role="dialog"` and `aria-modal="true"` on _your_ element inside the snippet — Portal will faithfully carry it to the target untouched.

## The consequence consumers must internalize: DOM order is not tab order is not reading order

This is the single most important accessibility fact about portals, and it is the reason portals exist _and_ the reason they're dangerous if used naively.

When Portal moves your content to `document.body`, the content's position in the **DOM** changes — it is no longer a descendant of the trigger that opened it. But three different "orders" derive from DOM position, and they don't all move the way a sighted mouse user expects:

- **Visual order** is controlled by CSS (`position`, `z-index`, transforms). The whole point of portaling is to escape a parent's `overflow: hidden` or stacking context so the overlay can paint on top of everything. This works fine after the move.
- **Sequential focus (Tab) order** follows DOM order, not visual order. After portaling to the end of `<body>`, your overlay's focusable elements now sit at the _end_ of the document's tab sequence — far from the trigger that opened them. A keyboard user who tabs forward from the trigger will _not_ land in the overlay next; they'll continue through the rest of the page and reach the overlay last.
- **Screen-reader reading order** likewise follows DOM order. The overlay is now read at the end of `<body>`, disconnected from its trigger's context.

Portal cannot fix this gap, because fixing it requires knowing the semantics of what you're portaling — and Portal is intentionally semantics-free. **The consumer owns the bridge.** What that bridge looks like depends on the **pattern** you are portaling — modal and non-modal overlays have different obligations.

**Modal overlays** (dialog, alert dialog, drawer, modal sheet) take over the page while open. They must:

1. **Trap focus** inside the overlay, so Tab and Shift+Tab cycle within it rather than escaping into the now-distant page content behind it.
2. **Move focus into** the overlay when it opens (to the first focusable control, the close button, or the surface itself) and **restore focus** to the trigger when it closes. Without this, a keyboard user is stranded at the trigger while the visually-present overlay receives no focus.
3. **Hide the background** from assistive technology — `aria-modal="true"` on the dialog plus `inert` on the sibling page content — so screen-reader and keyboard users can't wander out of the modal into content that is visually obscured. (Prefer `inert`, which also removes the background from the Tab order; `aria-hidden` alone does not.)

**Non-modal overlays** (tooltip, hover card, popover, menu, toast region) do **not** take over the page, so they must **not** trap focus or steal it on open — that would break the pointer-driven, glance-and-dismiss interaction. Instead:

- **Tooltips / hover cards / toasts** are typically not focus targets at all; they associate with their trigger via `aria-describedby` and dismiss on blur/Escape. Do not move focus into them.
- **Popovers / menus** move focus into the surface on open and restore it on close (like a modal) but do **not** inert the background; they close on outside interaction or Escape.

In all cases the consumer also owns:

4. **Labelling** — `aria-labelledby`/`aria-label` and the appropriate `role` (`dialog`, `menu`, `tooltip`, …) on the consumer's element. The accessible name belongs there, never on Portal's wrapper.
5. **Dismissal** — wire `Escape` and any other affordances on the consumer's element. Portal has no key handlers and will not close anything.

> [!WARNING]
> Treating Portal as "the overlay" is the classic mistake. It relocates pixels and DOM nodes; it does **not** relocate focus, manage a focus trap, or hide the background. Skipping the responsibilities above — or applying _modal_ focus-trapping to a _non-modal_ tooltip — produces an overlay that looks correct to a mouse user and is broken or hostile for keyboard and screen-reader users.

## Attribute inheritance and why it exists

When content is portaled to `document.body`, it leaves the subtree it was authored in — and with it, any directionality (`dir`) or theme (`data-cinder-theme`) it was inheriting through the cascade and the DOM. A right-to-left dialog portaled to `<body>` would suddenly render left-to-right; a dark-themed popover would lose its theme.

To preserve correctness across the move, Portal copies `dir` and `data-cinder-theme` from the nearest matching ancestor of the inheritance source onto the wrapper (controlled by `inheritAttributes`, on by default). `dir` is genuinely an accessibility concern: it drives bidirectional text rendering and the reading direction screen readers announce, so carrying it across the portal boundary keeps RTL content from silently flipping. Consumers that portal from a context with a meaningful `dir` (Popover, etc.) should pass an explicit `source` so the original ancestor chain — not the post-move parent, which is the target — is used for the lookup.

## SSR and hydration behavior

There is no `document` on the server, and a portal target like `document.body` or a selector can't be resolved until the browser exists. Portal handles this explicitly rather than crashing or mis-rendering:

- During server-side rendering, the wrapper is emitted but its `children` are **withheld** when portaling is active (`disabled` is false). The component's `shouldRenderChildren` gate requires `hasHydrated` to be true, and `hasHydrated` only flips inside a client `$effect`. So the server never paints portaled children into the SSR HTML — there is no flash of misplaced, un-relocated content, and no hydration-mismatch warning from content that the server put in one place and the client moved to another.
- On the client, after hydration the `$effect` sets `hasHydrated`, the target resolves, and the children render into the relocated wrapper.
- When `disabled` is true, Portal is a no-op: children render inline in document flow on both server and client, exactly where they were authored. This is the SSR-safe and progressive-enhancement-friendly default for content that doesn't actually need to escape its container.
- If a selector target can't be resolved after hydration, the wrapper stays inline at its original anchor (with a dev-only warning) instead of vanishing — children remain in the DOM and therefore in the accessibility tree, even when the intended host is missing.

The practical accessibility upshot: portaled content is **client-only by design**. A consumer relying on portaled content being present without JavaScript should use `disabled` (inline rendering) or render that content through a non-portaled path. For overlays this is the correct trade-off — an overlay that depends on scripted focus management has no meaningful no-JS story anyway.

## Forced colors and reduced motion

Portal renders no visible chrome of its own — no borders, backgrounds, focus rings, or animations — so `forced-colors` (Windows High Contrast) and `prefers-reduced-motion` have nothing to act on at this layer. Those concerns belong to the consumer's overlay surface and its open/close transitions, which Portal carries but does not style or animate.

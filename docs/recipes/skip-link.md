# Skip link

A **skip link** is the small "Skip to main content" anchor that appears the first time a keyboard user presses Tab on a page. It lets them bypass repeated navigation chrome and land directly inside the page's main landmark. The pattern satisfies [WCAG 2.4.1 Bypass Blocks](https://www.w3.org/WAI/WCAG21/Understanding/bypass-blocks.html) and costs almost nothing to implement — and yet I've watched team after team ship apps without one, because the link is invisible until you tab to it and nobody on the team tabs through their own site.

Cinder ships skip links as a **recipe rather than a component**: the existing `<VisuallyHidden focusable>` primitive plus the underlying `.cinder-sr-only-focusable` utility already do the work. A dedicated `<SkipLink>` component would only wrap an anchor — until that wrapper earns its keep, the recipe is the right deliverable.

## A note on naming

Most accessibility literature calls these utility classes `.visually-hidden` and `.focusable`. Cinder uses the project-wide `cinder-` namespace, so the equivalents are:

- `.cinder-sr-only`: the always-hidden screen-reader utility.
- `.cinder-sr-only-focusable`: the focusable modifier that reveals the element on `:focus-visible` / `:focus-within` and pins it to the top-left of the viewport.

If you are translating a snippet from a guide that uses the literature names, mentally replace them with the Cinder names.

## Plain-HTML pattern

```html
<body>
  <a class="cinder-sr-only cinder-sr-only-focusable" href="#main-content"> Skip to main content </a>
  <header>...</header>
  <nav>...</nav>
  <main id="main-content" tabindex="-1">
    <!-- page content -->
  </main>
</body>
```

A few details carry weight in that snippet:

- **Both classes on the anchor.** `.cinder-sr-only` provides the always-hidden resting state; `.cinder-sr-only-focusable` overrides it once the element gains focus. The Svelte component applies both for you when you pass `focusable`; raw markup needs both class names explicitly.
- **`tabindex="-1"` on the target.** Without it, activating the link only scrolls the viewport — focus stays on the link. With `tabindex="-1"`, `<main>` becomes a programmatic focus target so fragment activation moves keyboard focus to the destination, keeps focus and scroll position aligned, and gives assistive technology a reliable landmark to announce. (Whether the screen reader then starts reading the landmark's contents varies by browser/AT combination — I've stopped trying to promise that part; the focus move is what's load-bearing.)
- **No `tabindex="0"` on the target.** A `tabindex="0"` value adds a redundant tab stop on every page. `-1` makes the element programmatically focusable without inserting it into the tab order.
- **One `<main>` per page.** Per the [WAI-ARIA spec](https://www.w3.org/TR/wai-aria-1.2/#main), a document has at most one `main` landmark. The skip link's fragment points at its `id`.

## Svelte: component variant

The canonical Cinder way uses the `<VisuallyHidden>` primitive with `as="a"` and `focusable`. Types come through `HTMLAnchorAttributes`, so `href` is checked normally.

```svelte
<script lang="ts">
  import { VisuallyHidden } from '@lostgradient/cinder';
  let { children } = $props();
</script>

<VisuallyHidden as="a" href="#main-content" focusable>Skip to main content</VisuallyHidden>

<header>
  <!-- site navigation -->
</header>

<main id="main-content" tabindex="-1">
  {@render children()}
</main>
```

Use this variant when the skip link lives inside a Svelte component — typically the topmost `+layout.svelte` in a SvelteKit project, or the root component of a Svelte SPA.

## Svelte: `app.html` variant

In SvelteKit, the skip link can also live in `src/app.html`, immediately inside `<body>`. That puts it ahead of any Svelte-rendered chrome and avoids a per-route component mount. There is no Svelte scope inside `app.html`, so use the raw class-based pattern:

```html
<body>
  <a class="cinder-sr-only cinder-sr-only-focusable" href="#main-content"> Skip to main content </a>
  %sveltekit.body%
</body>
```

The target `<main id="main-content" tabindex="-1">` still lives inside your layout or page, wrapping the route content.

## Placement: first focusable element wins

The skip link must be the **first focusable element on the page**. A single Tab from a fresh page load needs to surface it; otherwise it cannot do its job.

In practice that means:

- In SvelteKit, place it immediately inside `<body>` in `app.html`, or as the very first markup line of the topmost `+layout.svelte` — before any header, logo, locale switcher, theme toggle, or navigation.
- In a Svelte SPA, place it as the first child of the root component's markup.
- Anything focusable rendered _before_ the skip link defeats the purpose. A `<a href="/">Home</a>` logo link in the header counts. A focusable theme toggle counts. Even a wrapping `<button>` around the brand counts.

## Multiple skip links

Most pages need exactly one skip link. The exception is pages with substantial secondary structure — a large in-page navigation alongside the main content, or a complex toolbar where a user might reasonably want to skip to either of two regions.

```svelte
<div class="skip-links">
  <VisuallyHidden as="a" href="#main-content" focusable>Skip to main content</VisuallyHidden>
  <VisuallyHidden as="a" href="#section-nav" focusable>Skip to section navigation</VisuallyHidden>
</div>

<header>...</header>
<nav id="section-nav" tabindex="-1">...</nav>
<main id="main-content" tabindex="-1">...</main>
```

A couple of things to keep in mind when you do this:

- **Each label names its destination.** "Skip to main content" and "Skip to section navigation" — not "Skip" or "Skip 1" / "Skip 2". Generic labels are useless out of context.
- **Default focused styling stacks at top-left.** `.cinder-sr-only-focusable` pins each focused link to the top-left of the viewport. Only one link is focused at a time, so consecutive links visually replace each other as the user tabs through them. That is intentional. If you want a different visual arrangement (a row of pills across the top, say), override the focus selectors on a wrapping class — the technique is documented in [`visually-hidden.a11y.md`](../../packages/components/src/components/visually-hidden.a11y.md#styling-the-focused-state).

## Common pitfalls

- **A focusable element before the skip link.** A logo `<a>`, a language switcher, a "Sign in" button — any of them put a stop ahead of the skip link and the user has to Tab past your chrome to find the thing that was supposed to let them skip your chrome. I've seen this most often with a logo link in the header, because the header is the first thing a designer reaches for.
- **No `tabindex="-1"` on the target.** Activation only scrolls; keyboard focus stays on the anchor, leaving assistive technology without a reliable focused destination. Easy to miss because sighted manual testing _looks_ correct.
- **`tabindex="0"` on the target instead of `-1`.** Creates an extra keyboard stop on every page. Use `-1` — programmatically focusable, not in the tab order.
- **`display: none` instead of the visually-hidden technique.** `display: none` removes the link from the accessibility tree entirely, so keyboard users cannot tab to it. The whole point of `.cinder-sr-only` is to stay in the tree.
- **Generic label text.** "Skip" is not specific enough; "Skip to main content" is. When multiple skip links exist, each label must describe its specific destination.
- **Hard-coded focus visuals on the skip link.** The revealed link inherits Cinder's focus ring policy from the surrounding tokens. Overriding `outline` or `box-shadow` in a one-off rule bypasses the policy — see [`focus-ring-policy.md`](../focus-ring-policy.md).

## See also

- [`visually-hidden.a11y.md`](../../packages/components/src/components/visually-hidden.a11y.md) — accessibility notes for the `<VisuallyHidden>` primitive, including the styling-the-focused-state technique referenced above.
- [`focus-ring-policy.md`](../focus-ring-policy.md) — the focus ring tokens and strategies the revealed skip link inherits.
- [`packages/components/src/styles/utilities.css`](../../packages/components/src/styles/utilities.css) — source of the `.cinder-sr-only` and `.cinder-sr-only-focusable` rules.

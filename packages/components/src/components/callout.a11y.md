# Callout Accessibility

`callout.svelte` is an inline admonition block — the static, prose-embedded
analog of a Markdown note / tip / warning / danger callout. It is **not** a
live region, **not** dismissible, and does not own a heading level. The
goal is to convey contextual guidance inline with surrounding content
without interrupting screen-reader users or polluting the document
outline.

## Role + semantics

The root element is `<aside>` with `data-cinder-variant` driving the
variant color treatment. The component does not set an explicit `role` —
`<aside>` carries the appropriate semantics on its own:

- Directly inside `<body>`, `<main>`, or another sectioning-content
  parent, `<aside>` is exposed as a `complementary` landmark.
  Screen-reader landmark navigation surfaces it alongside banners,
  navigation, and main content.
- Inside `<article>` or `<section>`, `<aside>`'s landmark role is
  suppressed by the HTML spec and the element behaves as generic
  sectioning content. This is the intended placement for inline
  documentation admonitions, where the callout is part of the prose
  flow rather than a navigable region.

This context-sensitivity is **by design**: the same component composes
correctly both as a top-level landmark (e.g. a documentation page
warning above the article) and as embedded prose content.

## Accessible-name precedence

Because `<aside>` can become a landmark depending on placement, an
unlabeled callout at landmark level would surface as a nameless
`complementary` region in screen-reader navigation. The component
derives `aria-label` in three tiers, mirroring `banner.svelte`:

1. If the consumer passes `aria-labelledby`, the root emits
   `aria-labelledby` alone — the derived `aria-label` is suppressed so
   accessible-name computation has a single unambiguous source.
2. Else if the consumer passes `aria-label`, that value is used.
3. Else if the `title` prop is supplied, the title text is promoted to
   `aria-label`.

When none of the three is supplied, the landmark is unnamed. That is
intentional: a callout nested inside `<article>` or `<section>` has no
landmark role to name anyway, and a titleless top-level callout is
expected to be rare. Consumers placing callouts at landmark level should
supply `title` or `aria-label`.

## Why no `role="alert"` and no `aria-live`?

A callout is **static** content. It is rendered alongside the
surrounding prose at page-load time and does not change in response to
user actions. `role="alert"` and `aria-live` are appropriate for content
that appears or updates dynamically and needs assistive tech to announce
it — that is what `alert.svelte` is for. Announcing a static admonition
on every page load would be noisy and incorrect.

The type-level `Omit` removes `role`, `aria-live`, `aria-atomic`,
`aria-relevant`, and `aria-busy` from `CalloutProps`. The runtime also
scrubs all five from rest-props before they reach the DOM, so consumers
who escape the type system (`as never`, spread from an `unknown`
source) cannot accidentally turn a callout into a live region or
override the implicit `<aside>` role. This defense-in-depth pattern
mirrors `banner.svelte`.

Note: `banner.svelte` deliberately does **not** strip `aria-busy`
because `aria-busy` is valid on `role="region"` to signal that
landmark content is updating. Callout strips it because the
`<aside>` root has no explicit role and `aria-busy` has no useful
semantics there — the static design contract makes it dead weight.

## Title rendered as `<p>`, not `<h*>`

The optional `title` prop renders as `<p class="cinder-callout__title">`,
**not** a heading element. This is deliberate: callouts appear inside
existing document structure, and promoting `title` to `<h*>` would force
the component to guess at the surrounding outline level and inject an
entry that may not belong. If a callout genuinely participates in the
outline (e.g. it titles a standalone section), wrap it in a `<section>`
with its own heading rather than promoting `title`.

## Icon channel

When supplied, the `icon` snippet renders inside a wrapper with
`aria-hidden="true"`. The icon is a **second visual channel** alongside
variant color — it helps satisfy WCAG 1.4.1 (Use of Color) by ensuring
the variant is conveyed by more than color alone. The accessible meaning
still lives in `title` and `children`; the icon must not be the only
carrier of information.

## Variant vocabulary

`CalloutVariant` is `'info' | 'success' | 'warning' | 'danger'`, sharing
the semantic tokens (`--cinder-info`, `--cinder-success`,
`--cinder-warning`, `--cinder-danger`) and visual algebra with
`banner.svelte`. `alert.svelte` uses `'error'` instead of `'danger'`;
the divergence is tracked in `banner.a11y.md`. Callout aligns with
banner because both are landmark-class components that draw from the
same design-token surface; alert remains separate because its
`error` vocabulary aligns with form-validation conventions.

## Forced-colors mode

In Windows High Contrast Mode, the variant `background-color` and
`color` values are overridden by system colors, so variants become
visually similar. The component currently pins only the border to
`CanvasText`. If the icon is supplied, its shape remains as a
differentiator; otherwise variants are perceptually indistinguishable in
forced-colors mode. This matches `banner.css` and is tracked as a
shared follow-up.

## When to use callout vs. banner vs. alert

| Component | Position             | Trigger                      | Live region?         | Dismissible? |
| --------- | -------------------- | ---------------------------- | -------------------- | ------------ |
| `Callout` | Inline, inside prose | Static (page load)           | No                   | No           |
| `Banner`  | Page-level strip     | Static or persistent         | No (`role="region"`) | Yes          |
| `Alert`   | Anywhere             | Dynamic (response to action) | Yes (`role="alert"`) | Optional     |

Use `Callout` for documentation admonitions, contextual tips alongside
form fields, or contextual warnings inside an article. Use `Banner` for
page-wide announcements (maintenance windows, trial expiry, cookie
consent). Use `Alert` when assistive tech must be notified that
something appeared or changed.

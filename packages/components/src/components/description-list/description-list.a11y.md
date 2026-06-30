# DescriptionList — Accessibility Notes

## Semantics

`<dl>` is the correct container for term/definition pairs. The HTML Living Standard permits `<dl>` to contain either (a) bare `<dt>`/`<dd>` pairs, or (b) `<div>` elements where **each row `<div>` must contain only `<dt>`, `<dd>`, and script-supporting elements** — no other flow content.

`DescriptionListItem.definition` may be plain text or rich snippet content. When a snippet is used, the rendered markup still lives inside the `<dd>` content model, so authors can include inline tags like `<code>` or structured UI such as small action chips without falling back to a raw `<dl>`.

This component renders actions **inside `<dd>`** (wrapped in a `<div class="cinder-description-list__actions">`), not as a sibling of `<dd>`. This keeps the row `<div>` strictly conforming to the `<dl>` content model. `<dd>`'s content model is flow content, which permits a `<div>` wrapper — and `<div>` is the right element choice because the consumer's snippet may render block-level UI (button groups, dropdown triggers) that a `<span>` cannot legally contain.

## Two-Column Variant

Visual columns come from CSS grid placement; DOM order is preserved (term → definition → actions) so screen reader linearization maintains the term/definition pairing. At narrow container widths (< 28rem) the variant collapses to stacked rows via container query — keeping content readable without the consumer needing to switch variants manually.

## Narrow Variant — When to Use It

The `narrow` variant hides the `<dt>` visually using `.cinder-sr-only` (clip-rect technique). The term text **is not removed** from the DOM and **is not `aria-hidden`**; screen readers still announce it.

**Only use `narrow`** when the surrounding context already makes labels obvious — for example, a single-row metadata strip beside a visible heading, or a values-only strip where a column header above already identifies the field.

**Do not use `narrow` as a general compact mode.** For lists like Status / Owner / Updated / Priority, use `default` or `striped` so sighted users can see the labels.

## Action Link Labels

Any interactive element rendered through the `actions` snippet **must** set an `aria-label` that disambiguates the row:

```svelte
{#snippet actions(item)}
  <button type="button" aria-label={`Edit ${item.term}`}>Edit</button>
{/snippet}
```

Bare "Edit" or "Delete" labels violate [WCAG 2.4.4 Link Purpose in Context](https://www.w3.org/WAI/WCAG21/Understanding/link-purpose-in-context.html) when stripped from surrounding text. The `actions` snippet receives the full `DescriptionListItem` to make disambiguation ergonomic.

## Keying and Duplicate Terms

Rows key on `item.id ?? item.term`. Lists with duplicate terms **must** provide explicit `id` values per item — duplicate keys cause Svelte to throw at runtime.

Example:

```svelte
const items = [
  { id: 'email-work', term: 'Email', definition: 'work@example.com' },
  { id: 'email-personal', term: 'Email', definition: 'personal@example.com' },
];
```

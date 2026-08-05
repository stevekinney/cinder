# Link

Inline text link with consistent focus ring and underline behavior.

## Usage

```svelte
<script lang="ts">
  import Link from '@lostgradient/cinder/link';
</script>

<!-- Links inside a text block must stay distinguishable without relying on color
     (WCAG 1.4.1 / axe link-in-text-block), so in-prose links use underline="always". -->
<p>
  Read the
  <Link href="/docs" underline="always">documentation</Link>
  for more details, or visit the
  <Link href="https://example.com" external underline="always">official site</Link>.
</p>

<!-- Underline/color variants shown as a standalone list (one link per row), not inside
     running prose. Outside a text block the hover/none treatments are an acceptable,
     intentional choice and don't trip axe's link-in-text-block rule. -->
<ul style="list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.5rem;">
  <li><Link href="/pricing" underline="always">Always underlined</Link></li>
  <li><Link href="/pricing" underline="hover">Underline on hover</Link></li>
  <li><Link href="/pricing" underline="none">No underline</Link></li>
  <li><Link href="/pricing" color="inherit" underline="always">Inherits text color</Link></li>
  <li><Link href="/pricing" disabled>Disabled link</Link></li>
</ul>
```

## Guidance

### Use When

- Embedding a navigable link inside body text or prose content.

### Avoid When

- Navigating between pages in a sidebar or nav bar — use NavigationItem.

## Props

<!-- generated:props:start -->

| Prop        | Type                                | Required | Default     | Description                                                                                                                                                                                                                                                                                                                       |
| ----------- | ----------------------------------- | -------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`     | `string`                            | no       | —           | Additional class names merged with `.cinder-link`.                                                                                                                                                                                                                                                                                |
| `color`     | `"primary"` \| `"inherit"`          | no       | `"primary"` | Controls the link color. - `'primary'` — uses the accent/primary color token. - `'inherit'` — inherits the surrounding text color.                                                                                                                                                                                                |
| `disabled`  | `boolean`                           | no       | `false`     | When true, renders a `<span aria-disabled="true">` instead of `<a>`. The href is not emitted and pointer-events are disabled. Use to show a link that is contextually unavailable without removing it from the visual layout.                                                                                                     |
| `external`  | `boolean`                           | no       | `false`     | When true, automatically adds `target="_blank"` and merges `rel="noopener noreferrer"` with any consumer-supplied `rel`. Consumer-supplied `target` is preserved if provided.                                                                                                                                                     |
| `href`      | `string`                            | no       | —           | The URL the link points to. Optional ONLY because a `disabled` link renders a `<span>` with no href. For any enabled (non-disabled) link you must provide it — an `<a>` without `href` is not keyboard-focusable and is not exposed as a link to assistive technology, so an enabled Link without `href` is a bug, not a feature. |
| `rel`       | `string` \| `null`                  | no       | —           | Forwarded to the rendered `<a>`. `"noopener noreferrer"` is merged in whenever the link opens in a new tab — `external` is true OR the resolved target is `"_blank"` (case-insensitive) — and the whole value is de-duplicated case-insensitively.                                                                                |
| `underline` | `"always"` \| `"hover"` \| `"none"` | no       | `"hover"`   | Controls text-decoration behavior. - `'always'` — underline is always visible. - `'hover'` — underline appears on hover and focus (default). - `'none'` — underline is never shown.                                                                                                                                               |
| `children`  | `(opaque)`                          | yes      | —           | The link text or composed content. Required. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                           |
| `target`    | `(opaque)`                          | no       | —           | Forwarded to the rendered `<a>`. `external` supplies `"_blank"` only when no target is given. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                          |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->

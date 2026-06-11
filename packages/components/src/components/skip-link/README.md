# SkipLink

A visually hidden skip-to-content link that becomes visible on keyboard focus and moves focus (and the viewport) to a landmark element, letting keyboard and screen-reader users bypass repeated navigation (WCAG 2.4.1 Bypass Blocks).

## Usage

Place it as the first focusable element in your layout and point `target` at the `id` of your main content region.

```svelte
<script lang="ts">
  import SkipLink from '@lostgradient/cinder/skip-link';
</script>

<SkipLink target="main-content">Skip to main content</SkipLink>

<!-- … site navigation … -->

<main id="main-content">
  <!-- … -->
</main>
```

The default label is "Skip to main content"; pass children to override it. SkipLink handles `prefers-reduced-motion` and the tabindex save/restore dance internally, so the target is never left permanently focusable.

## Props

<!-- generated:props:start -->

| Prop       | Type       | Required | Default | Description                                                                                                                                                                                             |
| ---------- | ---------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`    | `string`   | no       | —       | Additional classes merged onto the visually-hidden anchor.                                                                                                                                              |
| `target`   | `string`   | yes      | —       | The `id` of the element to receive focus when the link is activated.                                                                                                                                    |
| `children` | `(opaque)` | no       | —       | Optional override for the visible label. Defaults to "Skip to main content". A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->

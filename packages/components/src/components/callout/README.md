# Callout

Inline highlight block for tips, warnings, or contextual notes within content flow.

## Usage

```svelte
<script lang="ts">
  import Callout from '@lostgradient/cinder/callout';
</script>

<Callout />
```

## Props

<!-- generated:props:start -->

| Prop       | Type                                                 | Required | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------- | ---------------------------------------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`    | `string`                                             | no       | —       | Extra classes appended to the root element. Pass via the explicit `class` prop — it is excluded from rest-prop spread, so writing `class="x"` inside spread attributes will not reach the root.                                                                                                                                                                                                                                                                                                                                                                           |
| `semantic` | `"aside"` \| `"note"`                                | no       | —       | Root semantics. Default `'aside'`; use `'note'` for static note semantics without a complementary landmark.                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `title`    | `string`                                             | no       | —       | Optional title rendered as a `<p class="cinder-callout__title">`. Rendered as a paragraph rather than a heading element so the callout does not inject an entry into the document outline. If a callout genuinely participates in the outline (e.g. it titles a standalone section), wrap it in a `<section>` with its own heading rather than promoting this prop to `<h*>`. When supplied and no `aria-label` or `aria-labelledby` is passed on rest props, the title also becomes the `aria-label` of the root element so the landmark or note has an accessible name. |
| `variant`  | `"info"` \| `"success"` \| `"warning"` \| `"danger"` | no       | —       | Visual + semantic variant. Default `'info'`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `children` | `(opaque)`                                           | yes      | —       | Callout body content. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `icon`     | `(opaque)`                                           | no       | —       | Optional decorative icon rendered inside an `aria-hidden` wrapper. The icon is a second visual channel alongside variant color — it helps satisfy WCAG 1.4.1 (Use of Color) by ensuring the variant is conveyed by more than color alone. The accessible meaning still lives in `title` and/or `children`; the icon must not be the only carrier of information. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                               |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->

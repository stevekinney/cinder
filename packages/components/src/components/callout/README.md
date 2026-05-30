# Callout

A Callout component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

```svelte
<script lang="ts">
  import Callout from 'cinder/callout';
</script>

<Callout />
```

## Props

<!-- generated:props:start -->

| Prop       | Type                                                 | Required | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------- | ---------------------------------------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`    | `string`                                             | no       | —       | Extra classes appended to the root element. Pass via the explicit `class` prop — it is excluded from rest-prop spread, so writing `class="x"` inside spread attributes will not reach the root.                                                                                                                                                                                                                                                                                                                                                                     |
| `title`    | `string`                                             | no       | —       | Optional title rendered as a `<p class="cinder-callout__title">`. Rendered as a paragraph rather than a heading element so the callout does not inject an entry into the document outline. If a callout genuinely participates in the outline (e.g. it titles a standalone section), wrap it in a `<section>` with its own heading rather than promoting this prop to `<h*>`. When supplied and no `aria-label` or `aria-labelledby` is passed on rest props, the title also becomes the `aria-label` of the root `<aside>` so the landmark has an accessible name. |
| `variant`  | `"info"` \| `"success"` \| `"warning"` \| `"danger"` | no       | —       | Visual + semantic variant. Default `'info'`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `children` | `(opaque)`                                           | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `icon`     | `(opaque)`                                           | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                                                                                                                                                                          |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->

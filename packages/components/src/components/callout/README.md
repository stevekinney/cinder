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

| Prop       | Type                                                 | Required | Default | Description                                                                                                                                                                                     |
| ---------- | ---------------------------------------------------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`    | `string`                                             | no       | —       | Extra classes appended to the root element. Pass via the explicit `class` prop — it is excluded from rest-prop spread, so writing `class="x"` inside spread attributes will not reach the root. |
| `variant`  | `"info"` \| `"success"` \| `"warning"` \| `"danger"` | no       | —       | Visual + semantic variant. Default `'info'`.                                                                                                                                                    |
| `children` | `(opaque)`                                           | —        | —       | function-or-snippet                                                                                                                                                                             |
| `icon`     | `(opaque)`                                           | —        | —       | function-or-snippet                                                                                                                                                                             |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->

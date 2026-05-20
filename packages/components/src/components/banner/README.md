# Banner

A Banner component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

```svelte
<script lang="ts">
  import Banner from 'cinder/banner';
</script>

<Banner />
```

## Props

<!-- generated:props:start -->

| Prop          | Type                                                 | Required | Default | Description                                                                                                                                                                                     |
| ------------- | ---------------------------------------------------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`       | `string`                                             | no       | —       | Extra classes appended to the root element. Pass via the explicit `class` prop — it is excluded from rest-prop spread, so writing `class="x"` inside spread attributes will not reach the root. |
| `dismissible` | `boolean`                                            | no       | —       | Whether the banner shows a dismiss (×) button. Default `true`.                                                                                                                                  |
| `variant`     | `"info"` \| `"success"` \| `"warning"` \| `"danger"` | no       | —       | Visual + semantic variant. Default `'info'`.                                                                                                                                                    |
| `actions`     | `(opaque)`                                           | —        | —       | function-or-snippet                                                                                                                                                                             |
| `children`    | `(opaque)`                                           | —        | —       | function-or-snippet                                                                                                                                                                             |
| `onDismiss`   | `(opaque)`                                           | —        | —       | function-or-snippet                                                                                                                                                                             |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->

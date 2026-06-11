# Banner

Full-width announcement strip for page-level alerts, promotions, or system messages.

## Usage

```svelte
<script lang="ts">
  import Banner from '@lostgradient/cinder/banner';
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
| `actions`     | `(opaque)`                                           | no       | —       | Optional trailing CTA region (e.g., "Renew now" button). A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.             |
| `children`    | `(opaque)`                                           | yes      | —       | Banner body content. A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                 |
| `onDismiss`   | `(opaque)`                                           | no       | —       | Called after the dismiss button is clicked. Use to persist state. A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.    |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->

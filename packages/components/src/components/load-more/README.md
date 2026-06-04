# LoadMore

Sentinel-based infinite-scroll trigger with an always-visible button fallback and accessible status states.

`onLoadMore` should be provided in real usage. When omitted, the component falls back to a no-op handler.

## Usage

```svelte
<script lang="ts">
  import LoadMore from '@lostgradient/cinder/load-more';

  let loading = $state(false);
  let hasMore = $state(true);

  async function fetchNext() {
    loading = true;
    await new Promise((resolve) => setTimeout(resolve, 300));
    loading = false;
    hasMore = false;
  }
</script>

<LoadMore onLoadMore={fetchNext} bind:loading bind:hasMore />
```

## Props

<!-- generated:props:start -->

| Prop               | Type       | Required | Default | Description                                                                                                                |
| ------------------ | ---------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `buttonLabel`      | `string`   | no       | —       | Visible label for the load-more button.                                                                                    |
| `class`            | `string`   | no       | —       | Custom class merged with `.cinder-load-more`.                                                                              |
| `endOfListMessage` | `string`   | no       | —       | Politely announced when the end of the list is reached.                                                                    |
| `hasMore`          | `boolean`  | no       | —       | Whether more items are available. Bindable.                                                                                |
| `loading`          | `boolean`  | no       | —       | Whether a load is in progress. Bindable.                                                                                   |
| `maxRetries`       | `number`   | no       | —       | Maximum consecutive sentinel-triggered requests before auto-loading pauses.                                                |
| `retryLabel`       | `string`   | no       | —       | Visible label for the retry button after a load error.                                                                     |
| `rootMargin`       | `string`   | no       | —       | rootMargin passed to IntersectionObserver. Captured at attachment time.                                                    |
| `onError`          | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `onLoadMore`       | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `root`             | `(opaque)` | no       | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                    |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->
<!-- generated:subcomponents:end -->

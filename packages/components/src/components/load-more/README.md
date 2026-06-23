# LoadMore

Sentinel-based infinite-scroll trigger with an always-visible button fallback and accessible status states.

`onloadmore` should be provided in real usage. When omitted, the component falls back to a no-op handler.

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

<LoadMore onloadmore={fetchNext} bind:loading bind:hasMore />
```

## Props

<!-- generated:props:start -->

| Prop               | Type       | Required | Default | Description                                                                                                                                                                                                                                                                                                     |
| ------------------ | ---------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `buttonLabel`      | `string`   | no       | —       | Visible label for the load-more button.                                                                                                                                                                                                                                                                         |
| `class`            | `string`   | no       | —       | Custom class merged with `.cinder-load-more`.                                                                                                                                                                                                                                                                   |
| `endOfListMessage` | `string`   | no       | —       | Politely announced when the end of the list is reached.                                                                                                                                                                                                                                                         |
| `hasMore`          | `boolean`  | no       | —       | Whether more items are available. Bindable.                                                                                                                                                                                                                                                                     |
| `loading`          | `boolean`  | no       | —       | Whether a load is in progress. Bindable.                                                                                                                                                                                                                                                                        |
| `maxRetries`       | `number`   | no       | —       | Maximum consecutive sentinel-triggered requests before auto-loading pauses.                                                                                                                                                                                                                                     |
| `retryLabel`       | `string`   | no       | —       | Visible label for the retry button after a load error.                                                                                                                                                                                                                                                          |
| `rootMargin`       | `string`   | no       | —       | rootMargin passed to IntersectionObserver. Captured at attachment time.                                                                                                                                                                                                                                         |
| `onerror`          | `(opaque)` | no       | —       | Notified when onloadmore throws or rejects. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                          |
| `onloadmore`       | `(opaque)` | no       | —       | Called when the next page should be loaded. Caller flips `loading` and `hasMore`. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                    |
| `root`             | `(opaque)` | no       | —       | Scroll container the sentinel is observed within. Pass the scrollable ancestor element when the list scrolls inside a container rather than the viewport. `null`/omitted observes against the viewport. Captured at attachment time. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->
<!-- generated:subcomponents:end -->

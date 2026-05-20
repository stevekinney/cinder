# Image

A Image component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

```svelte
<script lang="ts">
  import Image from 'cinder/image';
</script>

<Image />
```

## Props

<!-- generated:props:start -->

| Prop          | Type                              | Required | Default | Description                                                                                                                                                    |
| ------------- | --------------------------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `alt`         | `string`                          | yes      | —       | Alternative text. Required with no default — pass `alt=""` explicitly for decorative images so the choice is intentional, not silent.                          |
| `decoding`    | `"async"` \| `"sync"` \| `"auto"` | no       | —       | Decoding hint. Default `async`.                                                                                                                                |
| `height`      | `number`                          | no       | —       | Native pixel height.                                                                                                                                           |
| `loading`     | `"lazy"` \| `"eager"`             | no       | —       | Loading strategy. Default `lazy`. Override to `eager` for above-the-fold images.                                                                               |
| `placeholder` | `string`                          | no       | —       | Low-resolution image source (typically a base64 data URI) shown as a pixelated background while the main image loads. Fades out once the `<img>` fires `load`. |
| `ratio`       | `string`                          | no       | —       | CSS aspect-ratio applied to the wrapper (e.g. `'16 / 9'`) so layout is stable while the image loads.                                                           |
| `src`         | `string`                          | yes      | —       | Image source URL.                                                                                                                                              |
| `width`       | `number`                          | no       | —       | Native pixel width.                                                                                                                                            |
| `class`       | `(opaque)`                        | —        | —       | unknown-shape                                                                                                                                                  |
| `fallback`    | `(opaque)`                        | —        | —       | function-or-snippet                                                                                                                                            |
| `onerror`     | `(opaque)`                        | —        | —       | function-or-snippet                                                                                                                                            |
| `onload`      | `(opaque)`                        | —        | —       | function-or-snippet                                                                                                                                            |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->

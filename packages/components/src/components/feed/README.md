# Feed

A Feed component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

```svelte
<script lang="ts">
  import Feed from 'cinder/feed';
</script>

<Feed />
```

## Props

<!-- generated:props:start -->

| Prop       | Type       | Required | Default | Description                                                                                                                                                                                                                                                                               |
| ---------- | ---------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`    | `string`   | no       | —       |                                                                                                                                                                                                                                                                                           |
| `live`     | `boolean`  | no       | —       | When true, the wrapper becomes an ARIA live region: `aria-live="polite"` and `aria-atomic="false"`. Use for feeds that mutate while the user is on the page (streaming notifications, log tails, chat-like activity). Defaults to false — a polite live region on a static feed is noise. |
| `children` | `(opaque)` | —        | —       | function-or-snippet                                                                                                                                                                                                                                                                       |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->

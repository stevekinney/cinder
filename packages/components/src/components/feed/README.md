# Feed

A Feed component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

`Feed` is a compound component. Import the parent and compose `Feed.Event` via
the namespace API.

```svelte
<script lang="ts">
  import { Feed } from 'cinder/feed';
</script>

<Feed aria-label="Project activity">
  <Feed.Event datetime="2025-05-12T15:30:00Z">
    {#snippet icon()}
      <span aria-hidden="true">★</span>
    {/snippet}
    {#snippet timestamp()}2m ago{/snippet}
    {#snippet content()}
      <p>Ada Lovelace starred the repository.</p>
    {/snippet}
  </Feed.Event>
</Feed>
```

The leaf remains importable individually for à-la-carte builds — see
`cinder/feed-event`.

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

- `Feed.Event` — a dated event entry with `icon` or `minimal` variant; see
  [`feed-event`](../feed-event/README.md).

<!-- generated:subcomponents:end -->

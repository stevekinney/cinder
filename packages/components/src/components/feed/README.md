# Feed

Scrollable chronological list of activity events with optional load-more pagination.

## Usage

`Feed` is a compound component. Import the parent and compose `Feed.Event` via
the namespace API.

```svelte
<script lang="ts">
  import { Feed } from 'cinder/feed';
</script>

<Feed aria-label="Project activity">
  <Feed.Event datetime="2025-05-12T15:30:00Z" timestamp="2m ago">
    {#snippet icon()}
      <span aria-hidden="true">★</span>
    {/snippet}
    <p>Ada Lovelace starred the repository.</p>
  </Feed.Event>
</Feed>
```

The event body is the default child content. The visible time label is the
`timestamp` string (use the `timestampLabel` snippet only when the label needs
markup); if omitted, it falls back to the raw `datetime` value.

The leaf remains importable individually for à-la-carte builds — see
`cinder/feed-event`.

## Props

<!-- generated:props:start -->

| Prop       | Type       | Required | Default | Description                                                                                                                                                                                                                                                                               |
| ---------- | ---------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`    | `string`   | no       | —       |                                                                                                                                                                                                                                                                                           |
| `live`     | `boolean`  | no       | —       | When true, the wrapper becomes an ARIA live region: `aria-live="polite"` and `aria-atomic="false"`. Use for feeds that mutate while the user is on the page (streaming notifications, log tails, chat-like activity). Defaults to false — a polite live region on a static feed is noise. |
| `children` | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

- `--cinder-feed-rail-size`
<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

- `Feed.Event` — a dated event entry with `icon` or `minimal` variant; see
  [`feed-event`](../feed-event/README.md).

<!-- generated:subcomponents:end -->

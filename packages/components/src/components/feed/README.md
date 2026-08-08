# Feed

Chronological stream of entries: a plain ordered list for user-facing activity, or an operator-facing append-only log region with follow-latest scrolling.

See the [chronological display boundary decision](https://github.com/stevekinney/cinder/blob/main/docs/decisions/chronological-display-boundaries.md) for the boundary between user-facing activity, static history, and execution state.

## Usage

`Feed` is a compound component. Import the parent and compose `Feed.Event`
(and, in streams, `Feed.Boundary`) via the namespace API.

```svelte
<script lang="ts">
  import { Feed } from '@lostgradient/cinder/feed';
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

### The log arm

For operator-facing append-only streams (job runners, deploy logs, webhook
traces), pass `kind="log"`. The feed renders a `role="log"` scroll viewport
with follow-latest scrolling — it pauses when the user scrolls away from the
bottom and resumes when they return or press the built-in control — plus
optional `loading`, `truncated`, and `connectionState` chrome:

```svelte
<Feed kind="log" label="Deploy events" connectionState="connected" bind:following>
  <Feed.Event variant="minimal" datetime="2026-05-12T14:30:00Z" timestamp="14:30:00" tone="info">
    Workflow run started
  </Feed.Event>
  <Feed.Boundary label="Reconnected — 3 events replayed" />
  <Feed.Event variant="minimal" datetime="2026-05-12T14:32:11Z" timestamp="14:32:11" tone="error">
    Activity failed: ChargePayment
  </Feed.Event>
</Feed>
```

Filtering, copy actions, and structured detail inspection are consumer
compositions: pass controls via the `toolbar` snippet and render details
inside `Feed.Event` children. `Feed.Boundary` marks stream discontinuities
(reconnects, sequence gaps) with `role="separator"` semantics — the consumer
owns the wording.

The leaves remain importable individually for à-la-carte builds — see
`@lostgradient/cinder/feed-event` and `@lostgradient/cinder/feed-boundary`.

## Props

<!-- generated:props:start -->

| Prop              | Type                                                             | Required | Default          | Description                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------- | ---------------------------------------------------------------- | -------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`           | `string`                                                         | no       | —                | Additional class merged onto the feed root element.                                                                                                                                                                                                                                                                                                                                                  |
| `connectionState` | `"connected"` \| `"connecting"` \| `"disconnected"` \| `"error"` | no       | —                | Log arm only — requires `kind: 'log'`; rejected by the list arm. Current connection state. When provided, renders a StatusDot connection preset in the toolbar. Omit when the stream has no live transport.                                                                                                                                                                                          |
| `following`       | `boolean`                                                        | no       | —                | Log arm only — requires `kind: 'log'`; rejected by the list arm. When true, appended content automatically scrolls the viewport to the bottom. Scrolling away from the bottom pauses following; scrolling back to the bottom (or the built-in control) resumes it. Bindable so the parent can read the paused state the component sets internally.                                                   |
| `kind`            | `"list"` \| `"log"`                                              | no       | —                | Discriminates the arms. Omit (or pass `'list'`) for the plain list.                                                                                                                                                                                                                                                                                                                                  |
| `label`           | `string`                                                         | no       | `"Activity log"` | Log arm only — requires `kind: 'log'`; rejected by the list arm. Accessible label for the log region. Required for accessibility.                                                                                                                                                                                                                                                                    |
| `live`            | `boolean`                                                        | no       | —                | List arm only (`kind` omitted or `'list'`) — rejected by the log arm, whose `role="log"` viewport is implicitly live. When true, the wrapper becomes an ARIA live region: `aria-live="polite"` and `aria-atomic="false"`. Use for feeds that mutate while the user is on the page (streaming notifications, chat-like activity). Defaults to false — a polite live region on a static feed is noise. |
| `loading`         | `boolean`                                                        | no       | —                | Log arm only — requires `kind: 'log'`; rejected by the list arm. Show a loading skeleton instead of the entries. Use while the first batch of entries is in flight.                                                                                                                                                                                                                                  |
| `truncated`       | `boolean`                                                        | no       | —                | Log arm only — requires `kind: 'log'`; rejected by the list arm. Whether to show the "earlier entries not shown" notice. This is a boolean flag, not a count: the feed never trims its own children. Set it when you have already capped retention and want users to know earlier entries are not shown.                                                                                             |
| `children`        | `(opaque)`                                                       | yes      | —                | Feed entries (typically `<Feed.Event>` / `<Feed.Boundary>` children). Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                     |
| `toolbar`         | `(opaque)`                                                       | no       | —                | Consumer-composed toolbar controls (filter inputs, copy buttons, …), rendered at the end of the toolbar row. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                              |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

- `--cinder-feed-rail-size`
<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

- `Feed.Event` — a dated event entry with `icon` or `minimal` variant; see
  [`feed-event`](../feed-event/README.md).
- `Feed.Boundary` — a `role="separator"` entry marking a stream discontinuity
  (reconnect, sequence gap); see [`feed-boundary`](../feed-boundary/README.md).

<!-- generated:subcomponents:end -->

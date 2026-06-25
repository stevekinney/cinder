# EventStreamViewer

Dense append-only viewer for timestamped operational events. Use it for workflow run logs, job output streams, webhook traces, activity completion feeds, and other real-time or historical event consoles.

## Overview

EventStreamViewer renders a scrollable list of timestamped events, each with a severity tone, optional source label, a one-line summary, and optional expandable JSON details. It handles follow-latest scrolling (auto-scroll to bottom as events arrive), a paused state when the user scrolls away, filtering hooks, and copy actions. Empty, loading, disconnected, and truncated states are built in.

## Usage

```svelte
<script lang="ts">
  import { EventStreamViewer } from '@lostgradient/cinder/event-stream-viewer';
  import type { StreamEvent } from '@lostgradient/cinder/event-stream-viewer';

  let events: StreamEvent[] = $state([]);
</script>

<EventStreamViewer {events} label="Workflow run events" connectionState="connected" />
```

### With filtering

When you pass an `onfilter` callback, the viewer renders a search input. Your component is responsible for filtering the `events` array in response to the callback.

```svelte
<script lang="ts">
  import { EventStreamViewer } from '@lostgradient/cinder/event-stream-viewer';
  import type { StreamEvent } from '@lostgradient/cinder/event-stream-viewer';

  let allEvents: StreamEvent[] = $state([]);
  let query = $state('');

  const filteredEvents = $derived(
    query
      ? allEvents.filter((e) => e.summary.toLowerCase().includes(query.toLowerCase()))
      : allEvents,
  );
</script>

<EventStreamViewer
  events={filteredEvents}
  filterQuery={query}
  onfilter={(q) => {
    query = q;
  }}
  label="Filtered event stream"
/>
```

### With copy-visible action

```svelte
<script lang="ts">
  import { EventStreamViewer } from '@lostgradient/cinder/event-stream-viewer';
  import type { StreamEvent } from '@lostgradient/cinder/event-stream-viewer';

  let events: StreamEvent[] = $state([]);

  function handleCopyVisible(text: string) {
    navigator.clipboard.writeText(text);
  }
</script>

<EventStreamViewer {events} oncopyvisible={handleCopyVisible} label="Event stream" />
```

### Follow-latest with bindable state

The `followLatest` prop is bindable. Bind it to read whether the viewer is paused or to programmatically resume following.

```svelte
<script lang="ts">
  import { EventStreamViewer } from '@lostgradient/cinder/event-stream-viewer';
  import type { StreamEvent } from '@lostgradient/cinder/event-stream-viewer';

  let events: StreamEvent[] = $state([]);
  let followLatest = $state(true);
</script>

<p>Status: {followLatest ? 'Following' : 'Paused'}</p>
<EventStreamViewer {events} bind:followLatest label="Event stream" />
```

## Event structure

Each event in the `events` array follows the `StreamEvent` type:

```ts
type StreamEvent = {
  id: string; // Stable unique identifier (required)
  datetime: string; // ISO 8601 datetime (required, used for machine-readable time)
  timestamp?: string; // Human-readable label e.g. "14:32:01" (falls back to datetime)
  severity?: 'debug' | 'info' | 'success' | 'warning' | 'error';
  source?: string; // Origin label e.g. "worker-1", "payment-service"
  summary: string; // One-line event description (required)
  details?: unknown; // Optional JSON payload rendered in a collapsible JsonViewer
};
```

## Props

<!-- generated:props:start -->

| Prop              | Type                                                             | Required | Default | Description                                                                                                                                                                                                                                                              |
| ----------------- | ---------------------------------------------------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `class`           | `string`                                                         | no       | —       | Additional CSS classes applied to the root element.                                                                                                                                                                                                                      |
| `connectionState` | `"connected"` \| `"connecting"` \| `"disconnected"` \| `"error"` | no       | —       | Current connection state. When provided, renders a StatusDot connection preset in the toolbar. Omit when the stream has no live transport.                                                                                                                               |
| `filterQuery`     | `string`                                                         | no       | —       | Current filter query value, for controlled usage. Pairs with `onfilter`.                                                                                                                                                                                                 |
| `followLatest`    | `boolean`                                                        | no       | —       | When true, new events automatically scroll the list to the bottom. Set to false to pause follow-latest (e.g. while the user reads earlier events). Bindable so the parent can read the paused state the component sets internally.                                       |
| `label`           | `string`                                                         | no       | —       | Accessible label for the event list region. Required for accessibility. Defaults to "Event stream".                                                                                                                                                                      |
| `loading`         | `boolean`                                                        | no       | —       | Show a loading skeleton instead of the event list. Use while the first batch of events is in flight.                                                                                                                                                                     |
| `truncated`       | `boolean`                                                        | no       | —       | Whether to show the "events were truncated" notice. This is a boolean flag, not a count: the viewer never slices `events` itself. Set it to `true` when you have already trimmed the array (e.g. capped retention) and want users to know earlier events are not shown.  |
| `events`          | `(opaque)`                                                       | yes      | —       | Events to render in chronological order, oldest first. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                        |
| `oncopyvisible`   | `(opaque)`                                                       | no       | —       | Callback fired when the user clicks the "Copy visible" toolbar action. Receives the text of all currently visible events. When omitted the copy action is hidden. Not expressible in JSON Schema; see the component types for the signature.                             |
| `onfilter`        | `(opaque)`                                                       | no       | —       | Callback fired when the user updates the filter query in the toolbar's search field. The consumer is responsible for filtering `events` in response. When omitted the filter input is hidden. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

- `--cinder-event-stream-viewer-severity-color`
<!-- generated:variables:end -->

## Accessibility

The viewer exposes a `role="log"` region with `aria-live="polite"` and `aria-atomic="false"` so screen readers announce newly appended events. The region is keyboard focusable (`tabindex="0"`) to support arrow-key scrolling.

Each event's timestamp is wrapped in a `<time datetime="...">` element with the machine-readable ISO value, so assistive technology can parse the precise moment. The visible label is separate from the machine-readable `datetime` attribute.

Severity tones are conveyed both visually (color bar, badge text) and through an `aria-label` on the badge element. Source labels and summary text are part of the document flow and are read naturally.

The JSON details panel is toggled by a button with `aria-expanded` and `aria-controls`. Copy actions have descriptive `aria-label` attributes.

A visually-hidden live region (always in the DOM, never removed with `{#if}`) announces copy confirmation to screen readers without double-announcing on the interactive buttons.

See `event-stream-viewer.a11y.md` for the full accessibility contract.

## Subcomponents

<!-- generated:subcomponents:start -->

This component composes `StatusDot`, `CopyButton`, and `JsonViewer` internally. They are not exposed as sub-namespace exports.

<!-- generated:subcomponents:end -->

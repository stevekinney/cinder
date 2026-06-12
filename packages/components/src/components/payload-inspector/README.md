# PayloadInspector

Composed inspector for structured payloads. Presents a payload with summary metadata, type classification, byte size, truncation state, and three switchable views: Summary, Tree (interactive JSON tree), and Raw (formatted text).

## Overview

`PayloadInspector` wraps `JsonViewer`, `DescriptionList`, `Badge`, and `CopyButton` into a single component optimized for operational dashboards — workflow engines, API consoles, webhook debuggers, and background job UIs. Pass any JSON-serializable value and optionally metadata (content type, source, timestamp); the inspector handles parsing, formatting, copy affordances, and edge cases.

Edge cases handled out of the box:

- `null`, `undefined`, `boolean`, `number` — shown as labeled primitives
- Arrays and objects — navigable in the Tree view
- Invalid JSON strings — shown with a parse error notice; raw text preserved in Raw view
- Empty / no payload — shows a "No payload" placeholder in all views
- Oversized payloads — JsonViewer's built-in cap prevents browser freezes
- Truncated payloads — badge and notice indicate producer-side truncation
- Circular references and non-serializable values (e.g. BigInt) — Tree and Raw views each show an explanatory message; size reads "Unknown size"

## Usage

```svelte
<script lang="ts">
  import { PayloadInspector } from '@lostgradient/cinder/payload-inspector';
</script>

<PayloadInspector
  value={{ userId: 'u_123', action: 'checkout', items: [42, 43] }}
  meta={{ contentType: 'application/json', source: 'order-workflow' }}
/>
```

### With a JSON string

When your data arrives as a serialized string (e.g. from a message queue or API response body), pass it directly. The component parses it automatically:

```svelte
<PayloadInspector
  value={rawJsonString}
  meta={{ contentType: 'application/json', source: '/api/events' }}
/>
```

### With truncation flag

When the producer truncates a payload before sending (e.g. due to wire limits), set `truncated` to signal this to the reader:

```svelte
<PayloadInspector value={truncatedPayload} truncated />
```

### Controlling the active view

Bind `activeView` to control which tab is active from outside the component:

```svelte
<script lang="ts">
  import { PayloadInspector } from '@lostgradient/cinder/payload-inspector';
  let view = $state('tree');
</script>

<PayloadInspector value={data} bind:activeView={view} />
```

### Redacting sensitive fields

Redact the payload **before** passing it as `value`. Every view (Summary, Tree, Raw) then sees only the redacted form — which is the only safe approach since `format` only affects the Raw tab display.

```svelte
<script lang="ts">
  import { PayloadInspector } from '@lostgradient/cinder/payload-inspector';

  function redact(raw: Record<string, unknown>): Record<string, unknown> {
    const { password: _, token: __, ...safe } = raw;
    return safe;
  }
</script>

<PayloadInspector value={redact(payload)} />
```

### Custom raw-view serializer

Pass a `format` function to control how the raw view serializes the payload — for example, to sort keys or use custom indentation. This affects only the Raw tab display text, not the Summary or Tree views, and not the copy buttons.

```svelte
<script lang="ts">
  import { PayloadInspector } from '@lostgradient/cinder/payload-inspector';

  function sortedJson(value: unknown): string {
    return JSON.stringify(value, Object.keys(value as object).sort(), 2);
  }
</script>

<PayloadInspector value={payload} format={sortedJson} />
```

### Custom parser for non-JSON formats

Pass a `parse` function to support alternative serialization formats:

```svelte
<PayloadInspector value={encodedString} parse={(raw) => myDecoder.decode(raw)} />
```

## Props

<!-- generated:props:start -->

| Prop         | Type                               | Required | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------ | ---------------------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `activeView` | `"summary"` \| `"tree"` \| `"raw"` | no       | —       | Initially active view tab. Defaults to "summary". Bind to control the active tab from outside.                                                                                                                                                                                                                                                                                                                                                                                          |
| `class`      | `string`                           | no       | —       | Additional CSS classes applied to the root element.                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `label`      | `string`                           | no       | —       | Label for the inspector region, used as the accessible name for the containing section. Defaults to "Payload inspector".                                                                                                                                                                                                                                                                                                                                                                |
| `maxBytes`   | `number`                           | no       | —       | Maximum byte size before the tree view is replaced with an oversize placeholder. Defaults to 1,048,576 (1 MB). Does not affect the raw view.                                                                                                                                                                                                                                                                                                                                            |
| `truncated`  | `boolean`                          | no       | —       | When true, the payload has been truncated by the producer (e.g. because it exceeded a wire size limit). The inspector renders a truncation badge in the summary and a notice above the raw view.                                                                                                                                                                                                                                                                                        |
| `format`     | `(opaque)`                         | no       | —       | Custom serializer for the Raw view display text. Receives the parsed value and must return a string. Defaults to JSON.stringify with 2-space indentation. Use this to customize key ordering, indentation, or alternative serialization formats. Does not affect the Summary or Tree views, or the copy buttons. For redaction, transform the value upstream and pass the already-redacted value as `value`. Not expressible in JSON Schema; see the component types for the signature. |
| `meta`       | `(opaque)`                         | no       | —       | Structured metadata shown in the summary panel. Pass contentType, source, and/or timestamp to populate the description list rows. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                            |
| `parse`      | `(opaque)`                         | no       | —       | Custom parser applied when `value` is a string. Receives the raw string and must return a parsed value or throw. Defaults to JSON.parse. Use this to support alternative serialization formats. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                              |
| `value`      | `(opaque)`                         | no       | —       | The payload value to inspect. Pass any JSON-serializable value — object, array, string, number, boolean, or null. Pass a string for already- serialized JSON; the component will attempt to parse it. Pass `undefined` when no payload is available yet. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                     |

<!-- generated:props:end -->

### PayloadInspectorMeta type

```ts
type PayloadInspectorMeta = {
  contentType?: string; // e.g. "application/json"
  source?: string; // e.g. workflow name or endpoint path
  timestamp?: string; // ISO 8601 string
};
```

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Accessibility

`PayloadInspector` follows the WAI-ARIA Tabs pattern (via the `Tabs`, `TabList`, `Tab`, and `TabPanel` cinder primitives) for view switching. See [tabs accessibility documentation](../tabs/tabs.a11y.md) for the full keyboard contract.

The root element is a `<section>` with `aria-label` set to the `label` prop ("Payload inspector" by default), providing a landmark for screen reader navigation.

Parse errors render with `role="alert"` for immediate announcement. Empty states use `role="status"`. The byte size span carries an `aria-label` like "13 B payload size" for screen readers that skip the visual context.

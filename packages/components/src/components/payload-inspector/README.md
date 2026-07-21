# PayloadInspector

Compact inspector for structured payloads. Presents a payload as an
interactive JSON tree with a visible label, byte size, truncation state, and a
single copy action.

## Overview

`PayloadInspector` wraps `JsonViewer`, `Badge`, and `CopyButton` into a single
component optimized for operational dashboards — workflow engines, API
consoles, webhook debuggers, and background job UIs. Pass any
JSON-serializable value; the inspector handles parsing, copy affordances, and
edge cases.

Edge cases handled out of the box:

- `null`, `boolean`, `number`, and plain strings — shown inline as primitives
- Arrays and objects — navigable in the JSON tree
- Invalid JSON strings — shown with a parse error notice above the raw text
- Empty / no payload — shows a "No payload" placeholder
- Oversized payloads — JsonViewer's built-in cap prevents browser freezes
- Truncated payloads — a header badge indicates producer-side truncation
- Circular references and non-serializable values (e.g. BigInt) — an
  explanatory message renders instead of the tree; size reads "Unknown size"

## Usage

```svelte
<script lang="ts">
  import { PayloadInspector } from '@lostgradient/cinder/payload-inspector';
</script>

<PayloadInspector
  value={{ userId: 'u_123', action: 'checkout', items: [42, 43] }}
  label="Checkout payload"
/>
```

### With a JSON string

When your data arrives as a serialized string (e.g. from a message queue or
API response body), pass it directly. The component parses it automatically:

```svelte
<PayloadInspector value={rawJsonString} />
```

### With truncation flag

When the producer truncates a payload before sending (e.g. due to wire
limits), set `truncated` to signal this to the reader:

```svelte
<PayloadInspector value={truncatedPayload} truncated />
```

### Copy behavior

The header copy button copies pretty-printed JSON of the parsed value. When
the payload itself is a string — including a JSON-encoded string primitive
like `'"hello"'` — it copies that original string verbatim instead, so the
copied text always matches what was actually passed as `value`. It is hidden
for empty and unserializable payloads.

### Redacting sensitive fields

Redact the payload **before** passing it as `value` — the inspector renders
exactly what it receives:

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

### Custom parser for non-JSON formats

Pass a `parse` function to support alternative serialization formats:

```svelte
<PayloadInspector value={encodedString} parse={(raw) => myDecoder.decode(raw)} />
```

## Props

<!-- generated:props:start -->

| Prop           | Type       | Required | Default | Description                                                                                                                                                                                                                                                                |
| -------------- | ---------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`        | `string`   | no       | —       | Additional CSS classes applied to the root element.                                                                                                                                                                                                                        |
| `initialDepth` | `number`   | no       | —       | Initial collapse depth for the JSON tree. Nodes deeper than this start collapsed. Defaults to 1.                                                                                                                                                                           |
| `label`        | `string`   | no       | —       | Visible header label for the inspector. Defaults to "Payload inspector".                                                                                                                                                                                                   |
| `maxBytes`     | `number`   | no       | —       | Maximum byte size before the tree view is replaced with an oversize placeholder. Defaults to 1,048,576 (1 MB).                                                                                                                                                             |
| `maxDepth`     | `number`   | no       | —       | Hard depth cap for the JSON tree. Nodes deeper than this never render their children. Defaults to 50.                                                                                                                                                                      |
| `truncated`    | `boolean`  | no       | —       | When true, the payload has been truncated by the producer (e.g. because it exceeded a wire size limit). The inspector renders a truncation badge in the header.                                                                                                            |
| `value`        | `unknown`  | no       | —       | The payload value to inspect. Pass any JSON-serializable value — object, array, string, number, boolean, or null. Plain strings are rendered as string values; strings that look like serialized JSON are parsed. Pass `undefined` when no payload is available yet.       |
| `parse`        | `(opaque)` | no       | —       | Custom parser applied when `value` is a string. Receives the raw string and must return a parsed value or throw. Defaults to JSON.parse. Use this to support alternative serialization formats. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Accessibility

The root element is a plain `<div>` — not a landmark — so a dashboard
rendering many inspectors adds nothing to the screen reader's landmark list.
The visible `label` names the panel, and the JSON tree is cinder's
`JsonViewer`, a WAI-ARIA tree composite; see
[json-viewer accessibility documentation](../json-viewer/json-viewer.a11y.md)
for its keyboard contract.

Parse errors render with `role="alert"` for immediate announcement. Empty
states use `role="status"`. The byte size span carries an `aria-label` like
"13 B payload size" for screen readers that skip the visual context. See
[payload-inspector.a11y.md](./payload-inspector.a11y.md) for the full pattern.

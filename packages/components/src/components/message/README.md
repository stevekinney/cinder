# Message

Chat-style bubble that renders a role label, optional timestamp, and arbitrary body content for transcript or run-stream views.

## Usage

```svelte
<script lang="ts">
  import Message from '@lostgradient/cinder/message';
</script>

<Message role="assistant" timestamp="10:00">How can I help?</Message>
```

## Props

<!-- generated:props:start -->

| Prop        | Type                                    | Required | Default | Description                                                                                                                                      |
| ----------- | --------------------------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `class`     | `string`                                | no       | —       | Additional class names merged with `.cinder-message`.                                                                                            |
| `datetime`  | `string`                                | no       | —       | The machine-readable date/time value placed on the `<time datetime>` attribute.                                                                  |
| `name`      | `string`                                | no       | —       | Optional speaker name override (defaults derived from role).                                                                                     |
| `role`      | `"user"` \| `"assistant"` \| `"system"` | yes      | —       | Role of the speaker — drives visual treatment.                                                                                                   |
| `timestamp` | `string`                                | no       | —       | Human-readable display text rendered inside the `<time>` element. Falls back to `datetime` when omitted.                                         |
| `children`  | `(opaque)`                              | yes      | —       | Message body content. A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->

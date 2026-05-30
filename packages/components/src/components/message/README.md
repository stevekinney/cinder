# Message

Chat-style bubble that renders a role label, optional timestamp, and arbitrary body content for transcript or run-stream views.

## Usage

```svelte
<script lang="ts">
  import Message from 'cinder/message';
</script>

<Message role="assistant" timestamp="10:00">How can I help?</Message>
```

## Props

<!-- generated:props:start -->

| Prop       | Type                                    | Required | Default | Description                                                                                                                |
| ---------- | --------------------------------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `class`    | `string`                                | no       | —       | Additional class names merged with `.cinder-message`.                                                                      |
| `name`     | `string`                                | no       | —       | Optional speaker name override (defaults derived from role).                                                               |
| `role`     | `"user"` \| `"assistant"` \| `"system"` | yes      | —       | Role of the speaker — drives visual treatment.                                                                             |
| `time`     | `string`                                | no       | —       | Optional timestamp string rendered in the header.                                                                          |
| `children` | `(opaque)`                              | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->

# Message

> **EXPERIMENTAL** — this component's API may change between minor versions until promoted to stable.

A Message component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

```svelte
<script lang="ts">
  import Message from 'cinder/experimental/message';
</script>

<Message />
```

## Props

<!-- generated:props:start -->

| Prop       | Type                                    | Required | Default | Description                                                  |
| ---------- | --------------------------------------- | -------- | ------- | ------------------------------------------------------------ |
| `class`    | `string`                                | no       | —       | Additional class names merged with `.cinder-message`.        |
| `name`     | `string`                                | no       | —       | Optional speaker name override (defaults derived from role). |
| `role`     | `"user"` \| `"assistant"` \| `"system"` | yes      | —       | Role of the speaker — drives visual treatment.               |
| `time`     | `string`                                | no       | —       | Optional timestamp string rendered in the header.            |
| `children` | `(opaque)`                              | —        | —       | function-or-snippet                                          |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->

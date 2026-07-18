# ChatConversationHeader

Header primitive for the active Chat conversation, composed as a sibling above Chat rather than inside it.

## Usage

```svelte
<script lang="ts">
  import ChatConversationHeader from '@lostgradient/chat/conversation-header';
</script>

<ChatConversationHeader conversation={activeConversation} />
```

## Props

<!-- generated:props:start -->

| Prop                | Type              | Required | Default | Description                                                                                                                                       |
| ------------------- | ----------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`             | `string`          | no       | —       | Additional class name merged with `.cinder-chat-conversation-header`.                                                                             |
| `headingLevel`      | `2` \| `3` \| `4` | no       | —       | Heading level for the conversation title. Default `2`.                                                                                            |
| `showExportActions` | `boolean`         | no       | —       | Whether to render the built-in conversation export actions. Default `true`.                                                                       |
| `actions`           | `(opaque)`        | no       | —       | Additional action controls rendered after the built-in export actions. Not expressible in JSON Schema; see the component types for the signature. |
| `conversation`      | `(opaque)`        | yes      | —       | Active compatible conversation snapshot. Not expressible in JSON Schema; see the component types for the signature.                               |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->
<!-- generated:subcomponents:end -->

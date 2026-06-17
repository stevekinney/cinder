# ChatConversationList

Conversation navigation list for switching among Chat transcripts without embedding the list inside Chat.

## Usage

```svelte
<script lang="ts">
  import ChatConversationList from '@lostgradient/cinder/chat-conversation-list';
</script>

<ChatConversationList
  conversations={conversationSummaries}
  activeConversationId={activeConversation.id}
  onselectconversation={selectConversation}
/>
```

## Props

<!-- generated:props:start -->

| Prop                   | Type               | Required | Default | Description                                                                                                                                                  |
| ---------------------- | ------------------ | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `activeConversationId` | `string` \| `null` | no       | —       | Currently active conversation id.                                                                                                                            |
| `ariaLabel`            | `string`           | no       | —       | Accessible name for the conversations navigation landmark. Default `"Conversations"`.                                                                        |
| `class`                | `string`           | no       | —       | Additional class name merged with `.cinder-chat-conversation-list`.                                                                                          |
| `emptyText`            | `string`           | no       | —       | Empty state text when no conversations are present. Default `"No conversations"`.                                                                            |
| `conversations`        | `(opaque)`         | yes      | —       | Conversation summaries to render. Sorts by latest message/update time descending. Not expressible in JSON Schema; see the component types for the signature. |
| `onselectconversation` | `(opaque)`         | no       | —       | Called when a conversation is selected. Not expressible in JSON Schema; see the component types for the signature.                                           |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->
<!-- generated:subcomponents:end -->

<script lang="ts" module>
  import type { ChatAdapter, ChatCommand, ChatReadReceiptEvent } from './chat-adapter.ts';
  import type { ConversationHistory, Message } from '../conversation-model.ts';
  import type { TypingParticipant } from '../chat.types.ts';

  export type AdapterSwitchFixtureProps = {
    initial: ConversationHistory;
    adapter: ChatAdapter;
    onPushMessage?: (message: Message) => void;
    onTypingChange?: (participants: TypingParticipant[]) => void;
    onReadReceipt?: (event: ChatReadReceiptEvent) => void;
    onAdapterError?: (event: { command: ChatCommand; error: unknown }) => void;
    onerror?: (error: unknown) => void;
  };
</script>

<script lang="ts">
  import { untrack } from 'svelte';
  import Chat from '../chat.svelte';

  let {
    initial,
    adapter,
    onPushMessage = () => {},
    onTypingChange = () => {},
    onReadReceipt = () => {},
    onAdapterError = () => {},
    onerror = (error) => {
      throw error;
    },
  }: AdapterSwitchFixtureProps = $props();

  // Real $state so the test can switch the conversation snapshot and exercise
  // the subscribe `$effect`'s re-subscription on `conversation.id` change.
  let conversation = $state<ConversationHistory>(untrack(() => initial));
  let currentAdapter = $state<ChatAdapter>(untrack(() => adapter));

  export function setConversation(next: ConversationHistory): void {
    conversation = next;
  }

  export function setAdapter(next: ChatAdapter): void {
    currentAdapter = next;
  }

  export function setCallbacks(callbacks: {
    onPushMessage?: (message: Message) => void;
    onTypingChange?: (participants: TypingParticipant[]) => void;
    onReadReceipt?: (event: ChatReadReceiptEvent) => void;
  }): void {
    onPushMessage = callbacks.onPushMessage ?? (() => {});
    onTypingChange = callbacks.onTypingChange ?? (() => {});
    onReadReceipt = callbacks.onReadReceipt ?? (() => {});
  }
</script>

<svelte:boundary {onerror}>
  <div style="height: 20rem;">
    <Chat
      id="switch-chat"
      {conversation}
      adapter={currentAdapter}
      {onPushMessage}
      {onTypingChange}
      {onReadReceipt}
      {onAdapterError}
    />
  </div>
  {#snippet failed(error)}
    <div data-boundary-error>{error}</div>
  {/snippet}
</svelte:boundary>

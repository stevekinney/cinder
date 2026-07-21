<script lang="ts" module>
  import type { ConversationHistory } from '../conversation-model.ts';

  export type SyncWriteFixtureProps = {
    conversation: ConversationHistory;
    /**
     * When true, `subscribe` defers its `$state` write with `queueMicrotask` —
     * the pattern documented on `ChatAdapter.subscribe` — instead of writing
     * synchronously. Used to prove the documented workaround actually avoids
     * the throw.
     */
    deferWrite?: boolean;
  };
</script>

<script lang="ts">
  import Chat from '../chat.svelte';
  import type { ChatAdapter } from './chat-adapter.ts';

  let { conversation, deferWrite = false }: SyncWriteFixtureProps = $props();

  // Mirrors issue #775's repro: a debug-panel-style adapter that logs every
  // `subscribe` call via a `$state` write, exactly the "obvious" thing a
  // consumer would reach for. Chat opens `subscribe` from inside its own mount
  // `$effect`, so a SYNCHRONOUS write here re-enters Svelte's effect flush
  // once another reactive update (e.g. composer input) lands alongside the
  // mount-time call, throwing `effect_update_depth_exceeded`. Deferring the
  // write (`deferWrite`) is the pattern documented on `ChatAdapter.subscribe`.
  let eventLog = $state<string[]>([]);

  export function getEventLog(): string[] {
    return eventLog;
  }

  const adapter: ChatAdapter = {
    sendMessage: async () => {},
    subscribe: (conversationId) => {
      const write = () => {
        eventLog = [...eventLog, `subscribed to "${conversationId}"`];
      };
      if (deferWrite) {
        queueMicrotask(write);
      } else {
        write();
      }
      return () => {};
    },
  };
</script>

<div style="height: 20rem;">
  <Chat id="sync-write-chat" {conversation} {adapter} />
</div>

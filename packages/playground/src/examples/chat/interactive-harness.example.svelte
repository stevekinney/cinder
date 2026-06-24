<script lang="ts" module>
  export const title = 'Interactive harness';
  export const description =
    'Drive Chat from a control panel: reply as the other side (instant / typing / streaming), inject tool calls, toggle features, and watch every callback fire.';

  export function createHistoryMessageTimestamp(page: number, index: number): string {
    return new Date(Date.UTC(2026, 4, 30 - page, 12, index)).toISOString();
  }
</script>

<script lang="ts">
  import {
    Chat,
    appendAssistantMessage,
    appendMessages,
    appendUserMessage,
    createConversation,
    type ChatSubmitEvent,
    type ConversationHistory,
    type JSONValue,
    type Message,
    type ToolErrorCategory,
  } from '@lostgradient/cinder/chat';
  import { Button } from '@lostgradient/cinder/button';
  import { Input } from '@lostgradient/cinder/input';
  import { Segment } from '@lostgradient/cinder/segment';
  import { SegmentedControl } from '@lostgradient/cinder/segmented-control';
  import { Select } from '@lostgradient/cinder/select';
  import { Textarea } from '@lostgradient/cinder/textarea';
  import { Toggle } from '@lostgradient/cinder/toggle';
  import { onDestroy } from 'svelte';

  // Out of scope for this harness (documented, not silently dropped):
  // bottomThreshold / jumpThreshold (kept at defaults so overflow + jump are
  // testable without tuning), viewportAttachment (advanced escape hatch), and
  // the atBottom / unreadCount / newMessageIndicatorVisible bindables (read-only
  // mirrors of behavior the wired callbacks already surface).

  // --- Chat instance (for the imperative streaming + scroll API) ---
  // Plain `let`: only read via `chat?.method()` calls, never reactively.
  let chat: ReturnType<typeof Chat> | undefined;

  // --- Conversation state (immutable snapshots via the cinder/chat builders) ---
  let conversation = $state<ConversationHistory>(createConversation({ id: 'harness' }));

  // --- Feature toggles wired straight onto <Chat> ---
  let attachments = $state(true);
  let search = $state(true);
  let copy = $state(true);
  let editing = $state(true);
  let retry = $state(true);
  let transparentSurface = $state(false);
  let withEmptyPrompts = $state(true);
  let autoReply = $state(true);
  let virtualized = $state(false);
  let historyEnabled = $state(false);
  let historyPage = 0;

  // --- Reply controls ---
  let replyText = $state('Here is the answer, delivered in a few deliberate chunks.');
  let replyMode = $state<'instant' | 'typing' | 'streaming'>('typing');
  let streamMechanism = $state<'imperative' | 'content-mutation'>('imperative');
  let streaming = $state(false);
  let streamingStatus = $state('');

  // --- Tool-call controls ---
  let toolName = $state('exports_check');
  let toolArguments = $state('{ "package": "@lostgradient/cinder" }');
  let toolOutcome = $state<'success' | 'error' | 'action_required'>('success');
  const parsedToolArguments = $derived.by<{ ok: boolean; value: JSONValue }>(() => {
    try {
      return { ok: true, value: JSON.parse(toolArguments) as JSONValue };
    } catch {
      return { ok: false, value: null };
    }
  });

  // --- Event log (queryable: data-event + data-payload per entry) ---
  // Chat emits a burst of identical onunreadindicatorchange events while its
  // empty state settles on mount (all `{unreadCount:0, newMessageIndicatorVisible:
  // false}`). We de-duplicate: a callback whose (event, payload) is identical to
  // the most recent entry for that event is dropped. That kills the mount noise
  // deterministically (no timing dependency) while still recording every real,
  // distinct callback so tests can assert "this fired because of my action".
  type LogEntry = { id: number; event: string; payload: string };
  let log = $state<LogEntry[]>([]);
  let logCounter = 0;
  const lastPayloadByEvent = new Map<string, string>();
  function record(event: string, payload: unknown = ''): void {
    const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
    if (lastPayloadByEvent.get(event) === text) return;
    lastPayloadByEvent.set(event, text);
    logCounter += 1;
    log = [{ id: logCounter, event, payload: text }, ...log].slice(0, 50);
  }

  // --- Pending-operation discipline (instance-local; NEVER module scope) ---
  // A single in-flight typing/streaming op at a time. Timers are tracked so we
  // can cancel deterministically; streamingPartial holds the accumulated text so
  // Stop can preserve it.
  let pendingTimers = new Set<ReturnType<typeof setTimeout>>();
  // Plain `let`: read only inside the streaming functions, never in the
  // template (the assistant message content comes from `conversation`).
  let streamingPartial = '';
  let streamingMessageId: string | null = null;
  // Monotonic token identifying the current stream/typing op. Each scheduled
  // chunk captures the token active when it was queued and bails if a newer op
  // has started — so an already-dequeued timer can't write into a fresh stream.
  let activeOperation = 0;

  function later(callback: () => void, delay: number): void {
    const handle = setTimeout(() => {
      pendingTimers.delete(handle);
      callback();
    }, delay);
    pendingTimers.add(handle);
  }

  function clearTimers(): void {
    for (const handle of pendingTimers) clearTimeout(handle);
    pendingTimers.clear();
  }

  /**
   * Cancel the in-flight op. Modes differ in how they treat partial content:
   * - preservePartial (Stop): keep what streamed so far, commit it to the message.
   * - discard (Clear / Seed / mode switch / new reply): drop the in-flight
   *   (possibly empty) assistant message so no blank bubble is left behind.
   * - destroy (onDestroy): just clear timers.
   */
  function cancelPending(mode: 'preservePartial' | 'discard' | 'destroy'): void {
    clearTimers();
    // Invalidate the current op so any timer callback already dequeued (past
    // clearTimers) bails instead of mutating freshly-reset state.
    activeOperation += 1;
    if (mode === 'destroy') return;

    if (streamingMessageId) {
      if (mode === 'preservePartial') {
        conversation = replaceMessageContent(conversation, streamingMessageId, streamingPartial);
      } else {
        conversation = removeMessage(conversation, streamingMessageId);
      }
      chat?.endStreaming();
    }
    streamingMessageId = null;
    streamingPartial = '';
    streaming = false;
    streamingStatus = '';
  }

  // --- Immutable message helpers (replace/remove by id) ---
  function replaceMessageContent(
    current: ConversationHistory,
    id: string,
    content: string,
  ): ConversationHistory {
    const existing = current.messages[id];
    if (!existing) return current;
    return {
      ...current,
      messages: { ...current.messages, [id]: { ...existing, content } },
      updatedAt: new Date().toISOString(),
    };
  }

  function removeMessage(current: ConversationHistory, id: string): ConversationHistory {
    if (!current.messages[id]) return current;
    const messages = { ...current.messages };
    delete messages[id];
    return {
      ...current,
      ids: current.ids.filter((existing) => existing !== id),
      messages,
      updatedAt: new Date().toISOString(),
    };
  }

  function lastMessageId(current: ConversationHistory): string {
    return current.ids[current.ids.length - 1] ?? '';
  }

  function prependHistoryMessages(current: ConversationHistory): ConversationHistory {
    historyPage += 1;
    const olderMessages: Message[] = Array.from({ length: 6 }, (_, index) => {
      const id = `older-${historyPage}-${index}`;
      return {
        id,
        role: index % 2 === 0 ? 'user' : 'assistant',
        content: `Earlier context ${historyPage}.${index + 1}`,
        position: index,
        createdAt: createHistoryMessageTimestamp(historyPage, index),
        metadata: {},
        hidden: false,
      };
    });
    const messages = Object.fromEntries(olderMessages.map((message) => [message.id, message]));
    for (const [index, id] of current.ids.entries()) {
      const message = current.messages[id];
      if (message) {
        messages[id] = { ...message, position: olderMessages.length + index };
      }
    }
    return {
      ...current,
      ids: [...olderMessages.map((message) => message.id), ...current.ids],
      messages,
      updatedAt: new Date().toISOString(),
    };
  }

  // --- Reply as the other side ---
  function sendReply(text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;
    cancelPending('discard');
    // Start a new operation; stale timers from a prior op will no longer match.
    const operation = ++activeOperation;

    if (replyMode === 'instant') {
      conversation = appendAssistantMessage(conversation, trimmed);
      return;
    }

    if (replyMode === 'typing') {
      streaming = true;
      streamingStatus = 'Assistant is typing…';
      // A deliberately long-ish window so the "typing" state is comfortably
      // observable (by a person and by a test) before the reply lands.
      later(() => {
        if (operation !== activeOperation) return;
        streaming = false;
        streamingStatus = '';
        conversation = appendAssistantMessage(conversation, trimmed);
      }, 1200);
      return;
    }

    // streaming: append one empty assistant message, then grow ITS content.
    conversation = appendAssistantMessage(conversation, '');
    const messageId = lastMessageId(conversation);
    streamingMessageId = messageId;
    streamingPartial = '';
    // `streaming` drives the composer's Stop affordance for BOTH mechanisms;
    // only `beginStreaming()` (the rAF-buffered token path) is imperative-only.
    streaming = true;
    streamingStatus = 'Streaming…';
    if (streamMechanism === 'imperative') {
      chat?.beginStreaming(messageId);
    }
    // Deterministic cadence: a fixed number of chunks at a fixed delay so an
    // intermediate partial state is reliably observable before completion.
    const chunks = splitIntoChunks(trimmed, 5);
    streamChunk(chunks, 0, activeOperation);
  }

  function streamChunk(chunks: string[], index: number, operation: number): void {
    // A newer reply/clear/seed started — this is a stale continuation, bail.
    if (operation !== activeOperation) return;

    if (index >= chunks.length) {
      // Commit the final content into the message, then end the stream.
      conversation = replaceMessageContent(
        conversation,
        streamingMessageId ?? '',
        streamingPartial,
      );
      if (streamMechanism === 'imperative') chat?.endStreaming();
      streamingMessageId = null;
      streaming = false;
      streamingStatus = '';
      return;
    }
    const chunk = chunks[index] ?? '';
    streamingPartial += chunk;
    if (streamMechanism === 'imperative') {
      chat?.pushToken(chunk);
    } else {
      conversation = replaceMessageContent(
        conversation,
        streamingMessageId ?? '',
        streamingPartial,
      );
    }
    later(() => streamChunk(chunks, index + 1, operation), 120);
  }

  function splitIntoChunks(text: string, count: number): string[] {
    const words = text.split(' ');
    const perChunk = Math.max(1, Math.ceil(words.length / count));
    const chunks: string[] = [];
    for (let index = 0; index < words.length; index += perChunk) {
      const slice = words.slice(index, index + perChunk).join(' ');
      chunks.push(index === 0 ? slice : ` ${slice}`);
    }
    return chunks;
  }

  // --- Inject a tool call + paired result (all outcomes) ---
  function injectToolCall(): void {
    if (!parsedToolArguments.ok) return;
    // Unique per injection — deriving from logCounter would reuse the same id
    // for repeated injections that don't add a log entry, breaking pairing.
    const callId = `call-${crypto.randomUUID()}`;
    const result =
      toolOutcome === 'error'
        ? {
            callId,
            outcome: 'error' as const,
            content: null,
            error: {
              code: 'tool_failed',
              category: 'transient' as ToolErrorCategory,
              retryable: true,
              message: 'The tool failed: upstream returned a transient error.',
            },
          }
        : toolOutcome === 'action_required'
          ? {
              callId,
              outcome: 'action_required' as const,
              content: null,
              action: {
                type: 'approval' as const,
                message: 'Approve running this tool before it executes?',
              },
            }
          : { callId, outcome: 'success' as const, content: { status: 'ok' } };

    conversation = appendMessages(
      conversation,
      {
        role: 'tool-call',
        content: '',
        toolCall: { id: callId, name: toolName, arguments: parsedToolArguments.value },
      },
      { role: 'tool-result', content: '', toolResult: result },
    );
  }

  // --- Seed / clear ---
  function seedThread(): void {
    cancelPending('discard');
    let next = createConversation({ id: 'harness-seeded' });
    // Repeated token "alpha" for deterministic search assertions, plus enough
    // messages to overflow the fixed-height viewport.
    next = appendUserMessage(next, 'Tell me about alpha.');
    next = appendAssistantMessage(next, 'alpha is the first item we track.');
    for (let index = 0; index < 12; index += 1) {
      next = appendUserMessage(next, `Follow-up question number ${index + 1}.`);
      next = appendAssistantMessage(
        next,
        `Detailed answer number ${index + 1}, with alpha context.`,
      );
    }
    conversation = next;
  }

  function seedFailedMessage(): void {
    conversation = appendMessages(conversation, {
      role: 'user',
      content: 'This message failed to send.',
      metadata: { _deliveryStatus: 'failed' },
    });
  }

  function clearConversation(): void {
    cancelPending('discard');
    conversation = createConversation({ id: 'harness-cleared' });
    historyPage = 0;
  }

  // --- Chat callbacks ---
  function handleSubmit(event: ChatSubmitEvent): void {
    const content = typeof event.message.content === 'string' ? event.message.content : '';
    record('onsubmit', content);
    conversation = appendMessages(conversation, {
      role: 'user',
      content: event.message.content,
    });
    if (autoReply) sendReply(replyText);
  }

  function handleEdit(event: { messageId: string; content: string }): void {
    record('onedit', event);
    conversation = replaceMessageContent(conversation, event.messageId, event.content);
  }

  async function handleLoadHistory(): Promise<void> {
    conversation = prependHistoryMessages(conversation);
    record('onloadhistory', historyPage);
  }

  onDestroy(() => cancelPending('destroy'));

  const surfaceMode = $derived<'default' | 'transparent'>(
    transparentSurface ? 'transparent' : 'default',
  );
  // `emptyPrompts` is included only when ON. Under exactOptionalPropertyTypes an
  // optional prop must be omitted, not passed as `undefined`, so spread it
  // conditionally rather than passing `emptyPrompts={undefined}`.
  const emptyPromptsProp = $derived(
    withEmptyPrompts ? { emptyPrompts: ['Tell me about alpha', 'Summarize the thread'] } : {},
  );
  const historyProps = $derived(
    historyEnabled ? { moreHistoryAvailable: true, onloadhistory: handleLoadHistory } : {},
  );
</script>

<div style="display: grid; grid-template-columns: 22rem 1fr; gap: 1rem; align-items: start;">
  <!-- Control panel -->
  <div
    data-testid="harness-controls"
    style="display: grid; gap: 1rem; padding: 1rem; border: 1px solid var(--cinder-border-muted); border-radius: var(--cinder-radius-md); background: var(--cinder-surface-inset);"
  >
    <section style="display: grid; gap: 0.5rem;">
      <strong>Reply as the other side</strong>
      <Textarea
        id="harness-reply-text"
        data-testid="reply-text"
        label="Reply text"
        bind:value={replyText}
        rows={2}
      />
      <SegmentedControl
        id="harness-reply-mode"
        selectionMode="single"
        bind:value={replyMode}
        label="Reply mode"
      >
        <Segment value="instant">Instant</Segment>
        <Segment value="typing">Typing</Segment>
        <Segment value="streaming">Streaming</Segment>
      </SegmentedControl>
      {#if replyMode === 'streaming'}
        <SegmentedControl
          id="harness-stream-mechanism"
          selectionMode="single"
          bind:value={streamMechanism}
          label="Streaming mechanism"
        >
          <Segment value="imperative">Imperative</Segment>
          <Segment value="content-mutation">Content</Segment>
        </SegmentedControl>
      {/if}
      <Button data-testid="send-reply" onclick={() => sendReply(replyText)}>Send reply</Button>
    </section>

    <section style="display: grid; gap: 0.5rem;">
      <strong>Inject tool call</strong>
      <Input
        id="harness-tool-name"
        data-testid="tool-name"
        label="Tool name"
        bind:value={toolName}
      />
      <Textarea
        id="harness-tool-arguments"
        data-testid="tool-arguments"
        label="Tool arguments (JSON)"
        bind:value={toolArguments}
        rows={2}
      />
      {#if !parsedToolArguments.ok}
        <span
          data-testid="tool-arguments-error"
          style="color: var(--cinder-danger); font-size: var(--cinder-text-xs);"
        >
          Arguments must be valid JSON.
        </span>
      {/if}
      <Select
        id="harness-tool-outcome"
        label="Outcome"
        bind:value={toolOutcome}
        options={[
          { value: 'success', label: 'success' },
          { value: 'error', label: 'error' },
          { value: 'action_required', label: 'action_required' },
        ]}
      />
      <Button data-testid="inject-tool" disabled={!parsedToolArguments.ok} onclick={injectToolCall}>
        Inject tool call
      </Button>
    </section>

    <section style="display: grid; gap: 0.4rem;">
      <strong>Features</strong>
      <Toggle id="t-attachments" label="attachments" bind:checked={attachments} />
      <Toggle id="t-search" label="search" bind:checked={search} />
      <Toggle id="t-copy" label="copy" bind:checked={copy} />
      <Toggle id="t-editing" label="editing" bind:checked={editing} />
      <Toggle id="t-retry" label="retry" bind:checked={retry} />
      <Toggle id="t-surface" label="transparent surface" bind:checked={transparentSurface} />
      <Toggle id="t-prompts" label="emptyPrompts" bind:checked={withEmptyPrompts} />
      <Toggle id="t-autoreply" label="auto-reply on submit" bind:checked={autoReply} />
      <Toggle id="t-virtualized" label="virtualized transcript" bind:checked={virtualized} />
      <Toggle id="t-history" label="history pagination" bind:checked={historyEnabled} />
    </section>

    <section style="display: grid; gap: 0.4rem;">
      <strong>State</strong>
      <Button data-testid="seed-thread" variant="secondary" onclick={seedThread}
        >Seed sample thread</Button
      >
      <Button data-testid="seed-failed" variant="secondary" onclick={seedFailedMessage}
        >Seed failed message</Button
      >
      <Button data-testid="clear" variant="secondary" onclick={clearConversation}>Clear</Button>
      <Button data-testid="scroll-top" variant="ghost" onclick={() => chat?.scrollToTop()}
        >Scroll to top</Button
      >
      <Button data-testid="scroll-bottom" variant="ghost" onclick={() => chat?.scrollToBottom()}
        >Scroll to bottom</Button
      >
      <Button data-testid="focus-input" variant="ghost" onclick={() => chat?.focusInput()}
        >Focus composer</Button
      >
    </section>

    <section style="display: grid; gap: 0.25rem;">
      <strong>Event log</strong>
      <!-- tabindex=0 gives the scrollable region keyboard access (axe
           scrollable-region-focusable). A group label names it without a `log`
           role, which would collide with the chat timeline's own role="log".
           svelte:element keeps the rendered DOM as a div while avoiding the
           static a11y warning for this focusable scroll-region pattern. -->
      <svelte:element
        this={'div'}
        data-testid="event-log"
        role="group"
        aria-label="Event log"
        tabindex={0}
        style="display: grid; gap: 0.15rem; max-height: 10rem; overflow: auto; font-size: var(--cinder-text-xs); font-family: var(--cinder-font-mono);"
      >
        {#each log as entry (entry.id)}
          <div data-testid="event-log-entry" data-event={entry.event} data-payload={entry.payload}>
            {entry.event}: {entry.payload}
          </div>
        {/each}
      </svelte:element>
    </section>
  </div>

  <!-- The Chat under test, in a fixed-height box so the thread overflows. -->
  <div style="height: 34rem;">
    <Chat
      bind:this={chat}
      id="harness-chat"
      {conversation}
      {streaming}
      {streamingStatus}
      capabilities={{ attachments, search, copy, editing, retry }}
      {surfaceMode}
      {virtualized}
      virtualizationEstimatedRowHeight={72}
      virtualizationInitialHeight={480}
      virtualizationOverscan={2}
      {...emptyPromptsProp}
      {...historyProps}
      onsubmit={handleSubmit}
      onedit={handleEdit}
      onretry={(messageId: string) => record('onretry', messageId)}
      onstopgenerating={(event: { messageId: string }) => {
        cancelPending('preservePartial');
        record('onstopgenerating', event.messageId);
      }}
      onjumptolatest={() => record('onjumptolatest')}
      onscrollstatechange={(event: { atBottom: boolean }) =>
        record('onscrollstatechange', { atBottom: event.atBottom })}
      onunreadindicatorchange={(event: {
        unreadCount: number;
        newMessageIndicatorVisible: boolean;
      }) => record('onunreadindicatorchange', event)}
      onexpandedchange={(expanded: boolean) => record('onexpandedchange', { expanded })}
      onattachmentadd={(attachment: { id: string }) => record('onattachmentadd', attachment.id)}
      onattachmentremove={(attachment: { id: string }) =>
        record('onattachmentremove', attachment.id)}
      onattachmentfailure={(_file: File, error: string) => record('onattachmentfailure', error)}
    >
      {#snippet header()}
        <div
          data-testid="harness-header"
          style="padding: 0.5rem 0.75rem; font-weight: var(--cinder-font-semibold);"
        >
          Harness conversation
        </div>
      {/snippet}
      {#snippet messageActions(message: Message)}
        <Button
          iconOnly={true}
          label="Message action"
          size="xs"
          variant="ghost"
          data-testid="harness-message-action"
          data-message-id={message.id}
        >
          ★
        </Button>
      {/snippet}
      {#snippet messageStatus(message: Message)}
        <span data-testid="harness-message-status" data-message-id={message.id}>·</span>
      {/snippet}
    </Chat>
  </div>
</div>

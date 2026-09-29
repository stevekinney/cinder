import {
  appendStreamingMessage,
  cancelStreamingMessage,
  finalizeStreamingMessage,
  updateStreamingMessage,
} from 'conversationalist';
import type { ChatPushHandlers } from '../components/chat/adapter/chat-adapter.ts';
import { appendToolCall, appendToolResult } from '../components/chat/builders.ts';
import type { ConversationHistory, ToolResult } from '../components/chat/conversation-model.ts';
import { remapMessageId } from './session-controller-rows.ts';
import type { TurnState } from './session-controller-run.ts';
import {
  ChatRunFailureError,
  type ChatSessionControllerOptions,
} from './session-controller-support.ts';
import type { ChatStreamEvent } from './stream-event-codec.ts';

type SessionEventDependencies = {
  events: AsyncIterable<ChatStreamEvent>;
  controller: AbortController;
  userMessageId: string;
  state: TurnState;
  options: ChatSessionControllerOptions;
  emit: (callback: (handlers: ChatPushHandlers) => void) => void;
  update: (conversation: ConversationHistory) => void;
  toolOwners: Map<string, string>;
  pendingApprovals: Set<string>;
  reportError: (error: unknown) => void;
  isCurrent: () => boolean;
  isProtocolFailure: () => boolean;
  markProtocolFailure: () => void;
};

export async function consumeSessionEvents(dependencies: SessionEventDependencies): Promise<void> {
  const { events, controller, state, isCurrent, isProtocolFailure, markProtocolFailure } =
    dependencies;
  for await (const event of events) {
    if (controller.signal.aborted && !isProtocolFailure()) break;
    // Re-read per event, not once per stream. Every `await` on the iterator
    // is a gap in which a submission, a navigation or a disposal can land,
    // and the frame that comes back after one is exactly the stale callback
    // this guard exists to stop.
    if (!isCurrent()) break;
    switch (event.type) {
      case 'text':
        // LEGACY and RICH are two projections of the same tokens, and a host
        // that emits both would otherwise have its text counted twice.
        // Whichever vocabulary speaks first owns the row for this turn; the
        // other is dropped rather than merged, because merging two views of
        // one stream produces text that never existed.
        if (state.richTextSeen) break;
        state.legacyTextSeen = true;
        appendAssistantText(dependencies, state.currentAssistantText + event.text, event.text);
        break;
      case 'stream:text-delta':
        if (state.legacyTextSeen) break;
        state.richTextSeen = true;
        appendAssistantText(dependencies, event.accumulated, event.content);
        break;
      case 'tool_call':
        applyToolCall(dependencies, event.id, event.name, event.arguments);
        break;
      case 'tool_result':
        applyToolResult(dependencies, event.callId, event);
        break;
      case 'tool.settled':
        // A settlement is only reducible once the call it settles has a row.
        // `tool.settled` reports that a tool FINISHED EXECUTING, which a
        // producer can know before the step owning the call has completed —
        // so it legitimately reaches the wire ahead of the `tool_call` frame.
        // Appending a result for a call the transcript cannot see is rejected
        // by the conversation model itself, so an early settlement is left to
        // the transcript-ordered `tool_result` that follows the call.
        if (!state.toolCalls.has(event.toolCallId)) break;
        applyToolResult(dependencies, event.toolCallId, event.result);
        break;
      case 'assistant.step.started':
        applyStepStarted(dependencies, event.step, event.messageId);
        break;
      case 'run.completed':
        // Recorded, not applied. Reconciliation happens once, after the
        // stream has closed, so a frame that follows the terminal cannot be
        // reduced into a history the terminal has already replaced.
        state.terminalConversation = event.conversation;
        break;
      case 'assistant.step.completed':
        // Only the step that is actually open: a late or duplicated
        // completion for a step already closed must not finalize the row the
        // NEXT step is streaming into.
        if (event.step === state.currentStep) settleCurrentRow(dependencies);
        break;
      case 'run.error':
      case 'run.tripwire':
        markProtocolFailure();
        controller.abort();
        throw new ChatRunFailureError(event.error);
      default:
        // The remaining `stream:*`, `tool.*` and `run.*` members the codec
        // vocabulary carries have no reducer here yet. They fall through as a
        // no-op rather than crash this loop.
        break;
    }
  }
}

function appendAssistantText(
  { state, options, emit, update }: SessionEventDependencies,
  rowText: string,
  pushed: string,
): void {
  state.text += pushed;
  state.currentAssistantText = rowText;
  emit((handlers) => handlers.onTokenPush(pushed));
  update(
    updateStreamingMessage(
      options.getConversation(),
      state.currentAssistantMessageId,
      state.currentAssistantText,
    ),
  );
}

function applyToolCall(
  { state, options, update, toolOwners, userMessageId }: SessionEventDependencies,
  id: string,
  name: string,
  args: Extract<ChatStreamEvent, { type: 'tool_call' }>['arguments'],
): void {
  if (state.toolCalls.has(id)) return;
  const next = appendToolCall(options.getConversation(), { id, name, arguments: args });
  update(next);
  recordProvisionalRow(state, next, (message) => message.toolCall?.id === id);
  toolOwners.set(id, userMessageId);
  state.toolCalls.add(id);
  state.committed = options.getConversation();
}

/**
 * Remembers the row a builder just appended so a terminal snapshot can
 * replace it. The row's own identifier is the client's, minted by the
 * builder; the terminal names the same content under the host's.
 */
function recordProvisionalRow(
  state: TurnState,
  history: ConversationHistory,
  matches: (message: ConversationHistory['messages'][string]) => boolean,
): void {
  const row = history.ids.findLast((id) => {
    const message = history.messages[id];
    return message !== undefined && matches(message);
  });
  if (row !== undefined) state.provisionalIds.add(row);
}

function applyToolResult(
  dependencies: SessionEventDependencies,
  callId: string,
  result: ToolResult,
): void {
  const { state, options, update, pendingApprovals, reportError } = dependencies;
  // Keyed by CALL identifier, not by frame: `tool_result` and `tool.settled`
  // are the legacy and rich projections of one settlement, and a host that
  // emits both would otherwise append the same outcome twice — and call the
  // host's own `onToolResult` observer twice for one tool run.
  if (state.toolResults.has(callId)) return;
  state.provisionalIds.add(callId);
  state.toolResultSeen = true;
  state.toolResults.add(callId);
  const requiresApproval = result.outcome === 'action_required' && result.action !== undefined;
  state.approvalRequired ||= requiresApproval;
  if (requiresApproval) pendingApprovals.add(callId);
  else pendingApprovals.delete(callId);
  const next = appendToolResult(options.getConversation(), result);
  update(next);
  recordProvisionalRow(state, next, (message) => message.toolResult?.callId === callId);
  state.committed = options.getConversation();
  try {
    options.hooks?.onToolResult?.(result);
  } catch (observerError) {
    reportError(observerError);
  }
}

/**
 * Settles the row the current step was streaming into.
 *
 * An EMPTY row is cancelled rather than finalized, the same rule the end of a
 * turn applies. A step that only called a tool — the model reaching for
 * `remember_note` without saying anything first — owns no prose, so it owns
 * no row; finalizing it would leave an empty assistant bubble above the tool
 * activity that nothing will ever fill.
 */
function settleCurrentRow({ state, options, update }: SessionEventDependencies): void {
  const conversation = options.getConversation();
  if (state.currentAssistantText) {
    update(finalizeStreamingMessage(conversation, state.currentAssistantMessageId));
    return;
  }
  update(cancelStreamingMessage(conversation, state.currentAssistantMessageId));
  // The row is gone, so a terminal snapshot has nothing to replace here.
  state.provisionalIds.delete(state.currentAssistantMessageId);
}

/**
 * Opens the row a step's text belongs to, and adopts the host's identifier
 * for it.
 *
 * A NEW step gets a new row, placed after whatever the previous step left
 * behind — which is what puts a follow-up reply below the tool activity it
 * is replying about, rather than back inside the row that already precedes
 * it. The FIRST step reuses the placeholder the run opened, so a
 * single-step response still renders as one assistant turn.
 */
function applyStepStarted(
  dependencies: SessionEventDependencies,
  step: number,
  messageId: string,
): void {
  const { state, options, update } = dependencies;
  if (state.currentStep !== -1 && state.currentStep !== step) {
    settleCurrentRow(dependencies);
    const next = appendStreamingMessage(options.getConversation(), 'assistant');
    update(next.conversation);
    state.currentAssistantMessageId = next.messageId;
    state.currentAssistantText = '';
    state.provisionalIds.add(next.messageId);
  }
  const remapped = remapMessageId(
    options.getConversation(),
    state.currentAssistantMessageId,
    messageId,
  );
  if (remapped !== options.getConversation()) {
    state.provisionalIds.delete(state.currentAssistantMessageId);
    state.provisionalIds.add(messageId);
    state.currentAssistantMessageId = messageId;
    update(remapped);
  }
  state.currentStep = step;
}

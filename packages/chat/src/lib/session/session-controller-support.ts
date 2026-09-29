import type { ApprovalResolution } from '@lostgradient/cinder';
import type { ChatAdapter, ChatToolResult } from '../components/chat/adapter/chat-adapter.ts';
import { removeMessage } from '../components/chat/builders.ts';
import type { ConversationHistory, ToolResult } from '../components/chat/conversation-model.ts';
import type { ChatAttachment } from '../components/chat/input/chat-attachment.ts';
import {
  decodeChatStreamEvents,
  guardChatStreamEvents,
  type ChatSerializedRunError,
  type ChatStreamEvent,
} from './stream-event-codec.ts';

/** Error raised when a transport emits a terminal `run.error` or `run.tripwire` frame. */
export class ChatRunFailureError extends Error {
  readonly runError: ChatSerializedRunError;

  constructor(runError: ChatSerializedRunError) {
    super(runError.message);
    this.name = 'ChatRunFailureError';
    this.runError = runError;
  }
}

/**
 * A holder's claim about how far the session had moved when it last looked.
 *
 * Carried by the host across an asynchronous fetch and handed back to
 * `adoptHistory`, which refuses anything captured before a write it has since
 * accepted. The shape is deliberately plain data so a host can put it in a
 * request, a store, or a closure without the controller caring.
 */
export type ChatHistoryToken = Readonly<{
  conversationId: string;
  generation: number;
  revision: number;
}>;

/**
 * Context supplied to each transport turn.
 *
 * `submissionId` names the user-initiated turn, so a host can correlate a
 * continuation with the submission that opened it. `historyToken` is the
 * token to hand back when this request's response carries an authoritative
 * snapshot. `isCurrent` is a LIVE reading, not a value: a long-lived
 * transport calls it again after every await to find out whether the work it
 * is about to do still has a reader.
 *
 * There is deliberately no `assistantMessageId` here. The authoritative
 * identifier for an assistant step belongs to the host and travels on the
 * `assistant.step.*` frames; a field on the request would invite a client to
 * mint one and would make the wire's identifier the second opinion.
 */
export type ChatSessionRequest = {
  conversation: ConversationHistory;
  signal: AbortSignal;
  turn: number;
  attachments: ChatAttachment[];
  submissionId: string;
  historyToken: ChatHistoryToken;
  isCurrent: () => boolean;
};
/** Supported transport return values, decoded lazily by the controller. */
export type ChatSessionTransportResult =
  AsyncIterable<ChatStreamEvent> | ReadableStream<Uint8Array> | Response;
/** Produces a stream for one controller turn. */
export type ChatSessionTransport = (
  request: ChatSessionRequest,
) => ChatSessionTransportResult | Promise<ChatSessionTransportResult>;
/**
 * Which side drives a conversation's execution for one submission.
 *
 * `browser` is the historical behaviour and stays the default: the client
 * owns the loop, so a turn that ended with every tool call resolved is the
 * cue to submit the next step. `server` says the host ran the whole turn
 * inside one response — every step already crossed the wire, so continuing
 * would either duplicate the turn or ask for a step the host has nothing to
 * answer with.
 *
 * Ownership is a property of the SUBMISSION, never of a frame. No terminal
 * frame promotes or demotes it: a host that wants the browser to continue
 * says so by being configured that way, not by what it happened to send.
 */
export type ChatExecutionOwner = 'browser' | 'server';

/** Optional observers and approval handlers for controller lifecycle events. */
export type ChatSessionHooks = {
  onToolResult?: (result: ChatToolResult) => void;
  resolveToolApproval?: (
    toolCallId: string,
    resolution: ApprovalResolution,
  ) => Promise<ToolResult | undefined>;
  onError?: (error: unknown) => void;
  onStreamingChange?: (streaming: boolean) => void;
};
export type ChatSessionControllerOptions = {
  transport: ChatSessionTransport;
  getConversation: () => ConversationHistory;
  setConversation: (conversation: ConversationHistory) => void;
  executionOwner?: ChatExecutionOwner;
  maxContinuationTurns?: number;
  hooks?: ChatSessionHooks;
};
export type ChatSessionController = {
  adapter: ChatAdapter;
  stop: () => Promise<void>;
  /** The session's position right now, to carry across an asynchronous read. */
  captureHistoryToken: () => ChatHistoryToken;
  /** Whether a token still describes the session its holder last saw. */
  isHistoryTokenCurrent: (token: ChatHistoryToken) => boolean;
  /**
   * Installs a full-session snapshot, or refuses it.
   *
   * Refused while a run is in flight, when the token has been retired, and
   * when the snapshot belongs to another conversation. Returns whether it was
   * installed, so a caller can tell "applied" from "silently dropped".
   */
  adoptHistory: (history: ConversationHistory, token: ChatHistoryToken) => boolean;
  /**
   * Retires every outstanding token and aborts work in flight.
   *
   * The host calls this when something it owns — a navigation, a surface
   * teardown — means nothing already in flight should be allowed to land. The
   * controller has no opinion about URLs, visibility or refresh cadence; this
   * is the one seam through which those decisions reach it.
   */
  invalidate: () => void;
  dispose: () => void;
};

export async function decodeTransportResult(
  result: ChatSessionTransportResult,
  onProtocolError: (error: unknown) => void,
): Promise<AsyncIterable<ChatStreamEvent>> {
  const decodeOptions = { onProtocolError };
  if (result instanceof Response) {
    if (!result.ok || !result.body) throw new Error(await result.text());
    return decodeChatStreamEvents(result.body, decodeOptions);
  }
  if (result instanceof ReadableStream) return decodeChatStreamEvents(result, decodeOptions);
  return guardChatStreamEvents(result, decodeOptions);
}

export function cleanIncompleteToolRows(
  history: ConversationHistory,
  userMessageId?: string,
): ConversationHistory {
  const start = userMessageId ? history.ids.indexOf(userMessageId) : -1;
  const suffix = history.ids.slice(start + 1);
  const calls = new Set<string>();
  const results = new Set<string>();
  for (const id of suffix) {
    const message = history.messages[id];
    if (message?.role === 'tool-call' && message.toolCall) calls.add(message.toolCall.id);
    if (message?.role === 'tool-result' && message.toolResult)
      results.add(message.toolResult.callId);
  }
  const incomplete = suffix.filter((id) => {
    const message = history.messages[id];
    return (
      (message?.role === 'tool-call' && message.toolCall && !results.has(message.toolCall.id)) ||
      (message?.role === 'tool-result' &&
        message.toolResult &&
        !calls.has(message.toolResult.callId))
    );
  });
  return incomplete.toReversed().reduce((current, id) => removeMessage(current, id), history);
}

export function pruneMessageAttachments(
  history: ConversationHistory,
  attachments: Map<string, ChatAttachment[]>,
  resolvedApprovalOwners: Set<string>,
): void {
  const retainedOwners = new Set<string>();
  const callOwners = new Map<string, string>();
  let latestUserMessageId: string | undefined;
  for (const id of history.ids) {
    const message = history.messages[id];
    latestUserMessageId = recordAttachmentOwnership(
      id,
      message,
      latestUserMessageId,
      retainedOwners,
      callOwners,
    );
  }
  for (const owner of resolvedApprovalOwners) retainedOwners.add(owner);
  for (const id of attachments.keys()) {
    if (!retainedOwners.has(id)) attachments.delete(id);
  }
}

function recordAttachmentOwnership(
  id: string,
  message: ConversationHistory['messages'][string] | undefined,
  latestUserMessageId: string | undefined,
  retainedOwners: Set<string>,
  callOwners: Map<string, string>,
): string | undefined {
  if (message?.role === 'user') {
    retainedOwners.add(id);
    return id;
  }
  recordToolCallOwner(message, latestUserMessageId, callOwners);
  recordToolResultOwner(message, callOwners, retainedOwners);
  return latestUserMessageId;
}

function recordToolCallOwner(
  message: ConversationHistory['messages'][string] | undefined,
  latestUserMessageId: string | undefined,
  callOwners: Map<string, string>,
): void {
  if (message?.role === 'tool-call' && message.toolCall && latestUserMessageId)
    callOwners.set(message.toolCall.id, latestUserMessageId);
}

function recordToolResultOwner(
  message: ConversationHistory['messages'][string] | undefined,
  callOwners: Map<string, string>,
  retainedOwners: Set<string>,
): void {
  if (message?.role !== 'tool-result' || message.toolResult?.outcome !== 'action_required') return;
  const owner = callOwners.get(message.toolResult.callId);
  if (message.toolResult.action && owner) retainedOwners.add(owner);
}

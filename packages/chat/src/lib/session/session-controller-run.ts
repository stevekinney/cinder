import {
  appendStreamingMessage,
  cancelStreamingMessage,
  finalizeStreamingMessage,
} from 'conversationalist';
import type { ChatPushHandlers } from '../components/chat/adapter/chat-adapter.ts';
import { markMessageDeliveryFailed } from '../components/chat/builders.ts';
import type { ConversationHistory } from '../components/chat/conversation-model.ts';
import type { ChatAttachment } from '../components/chat/input/chat-attachment.ts';
import { consumeSessionEvents } from './session-controller-events.ts';
import {
  captureHistoryToken,
  invalidateOutstandingWork,
  isRunRequestCurrent,
  type SessionRunRequest,
  type SessionRunState,
} from './session-controller-history.ts';
import { mergeRunHistory } from './session-controller-rows.ts';
import {
  decodeTransportResult,
  type ChatExecutionOwner,
  type ChatSessionControllerOptions,
} from './session-controller-support.ts';

type SessionRunnerDependencies = {
  options: ChatSessionControllerOptions;
  maxTurns: number;
  executionOwner: ChatExecutionOwner;
  lifecycle: SessionRunState;
  toolOwners: Map<string, string>;
  pendingApprovals: Set<string>;
  update: (conversation: ConversationHistory) => void;
  emit: (callback: (handlers: ChatPushHandlers) => void) => void;
  notifyStreaming: (value: boolean) => void;
  reportError: (error: unknown) => void;
};

export type TurnState = {
  /** Whole-turn text, which decides whether the row is finalized or cancelled. */
  text: string;
  /** Text of the row currently open, which resets at every step boundary. */
  currentAssistantText: string;
  /** The row this turn is streaming into — the host's identifier once it says so. */
  currentAssistantMessageId: string;
  /** The open step, or -1 before any boundary has been announced. */
  currentStep: number;
  legacyTextSeen: boolean;
  richTextSeen: boolean;
  toolResultSeen: boolean;
  approvalRequired: boolean;
  committed: ConversationHistory;
  toolCalls: Set<string>;
  toolResults: Set<string>;
  /** The authoritative history a `run.completed` frame carried, if any. */
  terminalConversation: ConversationHistory | undefined;
  /** Rows this run appended itself, which a terminal snapshot may replace. */
  provisionalIds: Set<string>;
  /** Rows that already existed when this run started, which it may not replace. */
  runStartIds: ReadonlySet<string>;
};

export function createSessionRunner({
  options,
  maxTurns,
  executionOwner,
  lifecycle,
  toolOwners,
  pendingApprovals,
  update,
  emit,
  notifyStreaming,
  reportError,
}: SessionRunnerDependencies): {
  executeRun: (userMessageId: string, attachments?: ChatAttachment[]) => Promise<void>;
  stopActiveRun: () => Promise<void>;
} {
  const assertActive = (): void => {
    if (lifecycle.disposed) throw new Error('Chat session is disposed');
    if (lifecycle.running) throw new Error('Chat session is already running');
  };
  const run = async (userMessageId: string, attachments: ChatAttachment[] = []): Promise<void> => {
    assertActive();
    lifecycle.running = true;
    lifecycle.activeUserMessageId = userMessageId;
    // Captured ONCE, before anything is awaited. Every guard below compares
    // against this reading, so a submission or navigation that lands while
    // the transport is thinking is visible as a difference rather than read
    // back as the new truth.
    const request: SessionRunRequest = {
      token: captureHistoryToken(lifecycle, options.getConversation().id),
      submissionId: lifecycle.submissionId,
      runToken: (lifecycle.activeRunToken += 1),
    };
    let turn = 0;
    notifyStreaming(true);
    try {
      while (++turn <= maxTurns) {
        const before = options.getConversation();
        const started = appendStreamingMessage(before, 'assistant');
        update(started.conversation);
        const messageId = started.messageId;
        emit((handlers) => handlers.onStreamBegin(messageId));
        const controller = new AbortController();
        lifecycle.active = controller;
        const shouldContinue = await executeTurn({
          options,
          update,
          emit,
          reportError,
          turn,
          userMessageId,
          attachments,
          lifecycle,
          toolOwners,
          pendingApprovals,
          before,
          messageId,
          controller,
          executionOwner,
          request,
        });
        if (!shouldContinue) return;
      }
      const error = new Error(`Reached the tool-call continuation limit (${maxTurns}).`);
      update(markMessageDeliveryFailed(options.getConversation(), userMessageId));
      reportError(error);
      throw error;
    } finally {
      lifecycle.running = false;
      notifyStreaming(false);
    }
  };
  const executeRun = async (
    userMessageId: string,
    attachments: ChatAttachment[] = [],
  ): Promise<void> => {
    const promise = run(userMessageId, attachments);
    lifecycle.activeRun = promise;
    try {
      await promise;
    } finally {
      if (lifecycle.activeRun === promise) lifecycle.activeRun = undefined;
    }
  };
  const stopActiveRun = async (): Promise<void> => {
    // Cancelling retires outstanding work as thoroughly as a navigation does:
    // a transport whose headers land after this must not install anything.
    invalidateOutstandingWork(lifecycle);
    // The initiating send/retry owns any run rejection. Stop only promises
    // that the run has settled and released the controller for its next turn.
    try {
      await lifecycle.activeRun;
    } catch {
      // The initiating promise remains the owner of the rejection.
    }
  };
  return { executeRun, stopActiveRun };
}

type TurnDependencies = Pick<
  SessionRunnerDependencies,
  'options' | 'update' | 'emit' | 'reportError'
> & {
  turn: number;
  userMessageId: string;
  attachments: ChatAttachment[];
  lifecycle: SessionRunState;
  toolOwners: Map<string, string>;
  pendingApprovals: Set<string>;
  before: ConversationHistory;
  messageId: string;
  controller: AbortController;
  executionOwner: ChatExecutionOwner;
  request: SessionRunRequest;
};

async function executeTurn({
  options,
  update,
  emit,
  reportError,
  turn,
  userMessageId,
  attachments,
  lifecycle,
  toolOwners,
  pendingApprovals,
  before,
  messageId,
  controller,
  executionOwner,
  request,
}: TurnDependencies): Promise<boolean> {
  // Two things abort the transport from inside this loop rather than
  // from the user: a protocol failure at its throw site (see
  // `decodeTransportResult`) and a terminal `run.*` failure frame. In
  // both cases the signal is already aborted by the time the rejection
  // reaches the catch, and remembering WHY keeps that from reading as a
  // user cancellation — which would swallow the error entirely.
  let protocolFailure = false;
  const isCurrent = (): boolean =>
    isRunRequestCurrent(lifecycle, options.getConversation().id, request);
  // Settling a cancelled turn's row is still a WRITE, so it needs the two
  // guards that say the write would land somewhere it belongs: the session is
  // alive, and the conversation on screen is still the one this row is in.
  const canSettleRow = (): boolean =>
    !lifecycle.disposed && request.token.conversationId === options.getConversation().id;
  const turnState: TurnState = {
    text: '',
    currentAssistantText: '',
    currentAssistantMessageId: messageId,
    currentStep: -1,
    legacyTextSeen: false,
    richTextSeen: false,
    toolResultSeen: false,
    approvalRequired: false,
    committed: before,
    toolCalls: new Set<string>(),
    toolResults: new Set<string>(),
    terminalConversation: undefined,
    provisionalIds: new Set<string>([messageId, userMessageId]),
    runStartIds: new Set<string>(before.ids),
  };
  try {
    const events = await decodeTransportResult(
      await options.transport({
        conversation: before,
        signal: controller.signal,
        turn,
        attachments,
        submissionId: request.submissionId,
        historyToken: request.token,
        isCurrent: () => isCurrent() && !controller.signal.aborted,
      }),
      () => {
        // A frame can fail validation after the user has already
        // stopped: the transport may still deliver a queued malformed
        // frame. That is a cancellation, not a protocol failure — the
        // command must still resolve cleanly — so the cause is only
        // recorded when nothing had aborted this turn yet.
        if (!controller.signal.aborted) protocolFailure = true;
        controller.abort();
      },
    );
    // AFTER the headers, and after the body was handed over as a decodable
    // stream: both are awaits, and either can outlive the session that asked
    // for them. Returning here leaves the conversation exactly as whoever
    // superseded this run left it — this run writes nothing at all.
    if (!isCurrent()) return false;
    await consumeSessionEvents({
      events,
      controller,
      isCurrent,
      userMessageId,
      state: turnState,
      options,
      emit,
      update,
      toolOwners,
      pendingApprovals,
      reportError,
      isProtocolFailure: () => protocolFailure,
      markProtocolFailure: () => {
        protocolFailure = true;
      },
    });
    // A USER CANCELLATION is not staleness, and the order of these two checks
    // is what keeps them apart. Cancelling retires the run's token, so the
    // staleness guard below would swallow this case — leaving the row the
    // turn was streaming into flagged as streaming forever, which renders as
    // a live shimmer nothing will ever end. The row still has to settle; only
    // the terminal reconciliation is abandoned.
    if (controller.signal.aborted && !protocolFailure) {
      if (canSettleRow()) finalizeTurn(options, update, turnState);
      return false;
    }
    // The terminal is authoritative about THIS RUN's rows and nothing else,
    // so it is reconciled against whatever is on screen rather than installed
    // over it. Guarded like every other installation: a terminal that arrives
    // after a cancel, a navigation or a newer accepted snapshot has nothing
    // left to be authoritative about.
    if (!isCurrent()) return false;
    if (turnState.terminalConversation !== undefined)
      update(
        mergeRunHistory(
          options.getConversation(),
          turnState.terminalConversation,
          turnState.provisionalIds,
          turnState.runStartIds,
        ),
      );
    finalizeTurn(options, update, turnState);
  } catch (error) {
    if (controller.signal.aborted && !protocolFailure) {
      if (canSettleRow()) finalizeTurn(options, update, turnState);
      return false;
    }
    // The transport's signal is the only way it learns the command
    // failed. A stream-guard rejection (malformed frame, non-increasing
    // sequence, mixed envelope) surfaces here while the transport's
    // provider or background work may still be running on that signal,
    // so abort it before rolling back and reporting. A protocol failure
    // has already aborted at its throw site; this covers every other
    // way the turn can fail, and aborting twice is a no-op.
    controller.abort();
    // A failure belongs to the session that asked for it. Rolling back and
    // marking a turn failed after something superseded this run would write
    // this run's stale history over whatever replaced it — and would show a
    // retry affordance for a turn nobody is looking at any more.
    if (!isCurrent()) return false;
    update(
      markMessageDeliveryFailed(
        cancelStreamingMessage(turnState.committed, turnState.currentAssistantMessageId),
        userMessageId,
      ),
    );
    reportError(error);
    throw error;
  } finally {
    emit((handlers) => handlers.onStreamEnd());
    if (lifecycle.active === controller) lifecycle.active = undefined;
  }
  if (shouldStopAfterTurn(turnState, executionOwner)) return false;
  return true;
}

function finalizeTurn(
  options: ChatSessionControllerOptions,
  update: (conversation: ConversationHistory) => void,
  state: TurnState,
): void {
  const conversation = options.getConversation();
  update(
    state.text
      ? finalizeStreamingMessage(conversation, state.currentAssistantMessageId)
      : cancelStreamingMessage(conversation, state.currentAssistantMessageId),
  );
}

function shouldStopAfterTurn(state: TurnState, executionOwner: ChatExecutionOwner): boolean {
  // The server-owned check comes FIRST and looks at nothing else. Every other
  // clause here reads the turn's content to decide whether the client still
  // owes the host a step; when the host owns execution it never does, so
  // consulting the content at all would let a frame decide ownership.
  if (executionOwner === 'server') return true;
  if (!state.toolResultSeen || state.approvalRequired) return true;
  return [...state.toolCalls].some((id) => !state.toolResults.has(id));
}

import type { ChatHistoryToken } from './session-controller-support.ts';

/**
 * Everything one controller instance knows about what is in flight and how
 * far the conversation has moved.
 *
 * `generation` and `revision` answer two different questions, and collapsing
 * them into one counter breaks both:
 *
 * - `revision` counts EVERY accepted write. A full-session snapshot the host
 *   fetched is only safe to install while nothing has been written since it
 *   was asked for, so `adoptHistory` compares it.
 * - `generation` counts only the events that retire outstanding work — a new
 *   submission, a cancel, a navigation, disposal. A run writes constantly, so
 *   a run-scoped guard that compared `revision` would consider its own first
 *   delta a reason to abandon itself.
 */
export type SessionRunState = {
  active: AbortController | undefined;
  disposed: boolean;
  running: boolean;
  activeRun: Promise<void> | undefined;
  activeUserMessageId: string | undefined;
  generation: number;
  revision: number;
  submissionId: string;
  activeRunToken: number;
  submissionCounter: number;
};

/** Identity a run carries for the whole of one turn. */
export type SessionRunRequest = {
  token: ChatHistoryToken;
  submissionId: string;
  runToken: number;
};

export function createSessionRunState(): SessionRunState {
  return {
    active: undefined,
    disposed: false,
    running: false,
    activeRun: undefined,
    activeUserMessageId: undefined,
    generation: 0,
    revision: 0,
    submissionId: '',
    activeRunToken: 0,
    submissionCounter: 0,
  };
}

export function captureHistoryToken(
  lifecycle: SessionRunState,
  conversationId: string,
): ChatHistoryToken {
  return { conversationId, generation: lifecycle.generation, revision: lifecycle.revision };
}

/**
 * Whether a token still describes the session exactly as its holder last saw
 * it. Used for a FULL-session snapshot, which replaces membership outright
 * and so may not be installed over any write at all.
 */
export function isHistoryTokenCurrent(
  lifecycle: SessionRunState,
  conversationId: string,
  token: ChatHistoryToken,
): boolean {
  return (
    !lifecycle.disposed &&
    token.conversationId === conversationId &&
    token.generation === lifecycle.generation &&
    token.revision === lifecycle.revision
  );
}

/**
 * Whether a run may still install anything.
 *
 * Deliberately NOT a function of `revision` — see `SessionRunState` — and
 * deliberately not a function of the abort signal either. Aborting already
 * has its own handling, with a protocol-failure exemption that has to keep
 * working; folding the signal in here would swallow a terminal failure that
 * aborted on its way to being reported.
 */
export function isRunRequestCurrent(
  lifecycle: SessionRunState,
  conversationId: string,
  request: SessionRunRequest,
): boolean {
  return (
    !lifecycle.disposed &&
    request.runToken === lifecycle.activeRunToken &&
    request.submissionId === lifecycle.submissionId &&
    request.token.conversationId === conversationId &&
    request.token.generation === lifecycle.generation
  );
}

/**
 * Opens a new submission, retiring every token and run that came before it.
 *
 * A submission is what the transport identifies a turn by, so it must change
 * exactly when the user asks for something new — a send, a retry, an edit —
 * and must NOT change when a run continues itself after a tool resolves. A
 * continuation is more of the same submission; only the run token moves.
 */
export function startSubmission(lifecycle: SessionRunState): void {
  lifecycle.generation += 1;
  lifecycle.submissionCounter += 1;
  lifecycle.submissionId = `chat-${lifecycle.generation}-${lifecycle.submissionCounter}`;
  lifecycle.activeRunToken += 1;
}

/**
 * Retires every outstanding token and run, and aborts whatever is in flight.
 *
 * The generation bump is what makes a callback that is already scheduled —
 * a resolved fetch, a parsed body, a pending snapshot — unable to apply when
 * it finally runs. Clearing `submissionId` is what stops a run whose
 * transport has not yet answered from being treated as the current one.
 */
export function invalidateOutstandingWork(lifecycle: SessionRunState): void {
  lifecycle.generation += 1;
  lifecycle.submissionId = '';
  lifecycle.activeRunToken += 1;
  lifecycle.active?.abort();
}

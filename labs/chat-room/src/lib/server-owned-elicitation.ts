/**
 * The server-owned family's approval path, expressed through Operative's
 * elicitation API instead of a signed park-and-resume token.
 *
 * WHY A REGISTRY AT ALL. `onElicitation` is a server-side callback: the loop
 * calls it and waits for a decision. In the browser-owned route the decision
 * comes back on the NEXT HTTP request, carrying a signed token that describes
 * the parked call — the server holds nothing between the two. Here the run
 * lives on the server and never left, so the question has to wait somewhere
 * in this process while a second request answers it. That somewhere is this
 * module, and the difference between the two is the substance of the
 * comparison in `docs/reference-architecture.md`.
 *
 * ONE PENDING QUESTION AT A TIME, asked SEQUENTIALLY when a step carries more
 * than one gated call.
 *
 * An earlier version of this comment justified the single slot by claiming
 * `stopAfterAnyToolCall` limited a step to one gated call. That was wrong on
 * two counts, and review caught it: the stop condition runs AFTER a step and
 * does not constrain how many calls the provider emits, and this family no
 * longer uses that condition at all. A step really can carry two
 * `remember_note` calls.
 *
 * So the gate asks about each one in turn, and the slot is what makes that
 * safe rather than what assumes it away: each question resolves before the
 * next registers, and every answer names the call it is answering. A second
 * SIMULTANEOUS question is still refused rather than queued — a queue would
 * let a click meant for one question settle another.
 *
 * `globalThis`, not a module-level `Map`, for the reason every other slot in
 * this family is there: Vite re-evaluates a server module on edit, and a
 * module-scoped registry would come back empty in the new instance — leaving
 * the previous evaluation's run waiting on a promise nothing can resolve,
 * with the answering request reporting "nothing pending".
 */
const PENDING_SLOT = Symbol.for('cinder.chat-room.server-owned.pending-elicitations');

/** What a client needs in order to ask a person the question. */
export type PendingElicitation = {
	readonly toolName: string;
	readonly callId: string;
	readonly message: string;
	/** The arguments the model proposed, so the question is about something. */
	readonly arguments: Record<string, unknown>;
};

type Waiting = PendingElicitation & {
	readonly settle: (approved: boolean) => void;
};

type PendingHost = { [PENDING_SLOT]?: Map<string, Waiting> };

function registry(): Map<string, Waiting> {
	const host = globalThis as PendingHost;
	host[PENDING_SLOT] ??= new Map();
	return host[PENDING_SLOT];
}

/** Thrown when a second question arrives for a conversation already waiting. */
export class ElicitationAlreadyPendingError extends Error {
	override readonly name = 'ElicitationAlreadyPendingError';

	constructor(conversationId: string) {
		super(`This conversation is already waiting on an approval: ${conversationId}`);
	}
}

/**
 * Registers a question and waits for a person to answer it.
 *
 * Resolves `false` — a denial — when the signal aborts. That is the honest
 * mapping rather than a rejection: the client closed the stream, so nobody is
 * going to approve anything, and a denial is what "do not run this tool"
 * means. A rejection would surface as a run error and report a broken run
 * where there was only a cancelled one.
 *
 * ALWAYS removes its own entry, on every path. A question left behind after
 * its run ended would make the next turn's question fail as
 * already-pending — and the stale one would be answerable, resolving a
 * promise nothing is waiting on.
 */
export function requestApproval(
	conversationId: string,
	pending: PendingElicitation,
	signal?: AbortSignal
): Promise<boolean> {
	const pendingByConversation = registry();
	if (pendingByConversation.has(conversationId)) {
		throw new ElicitationAlreadyPendingError(conversationId);
	}

	return new Promise<boolean>((resolve) => {
		let settled = false;
		const finish = (approved: boolean): void => {
			if (settled) return;
			settled = true;
			pendingByConversation.delete(conversationId);
			signal?.removeEventListener('abort', onAbort);
			resolve(approved);
		};
		const onAbort = (): void => finish(false);

		// Checked BEFORE registering, and again through the listener. An already
		// aborted signal fires no `abort` event, so a question registered here
		// would wait forever for a client that has already gone.
		if (signal?.aborted === true) {
			resolve(false);
			return;
		}

		pendingByConversation.set(conversationId, { ...pending, settle: finish });
		signal?.addEventListener('abort', onAbort, { once: true });
	});
}

/** The question this conversation is waiting on, if any. */
export function peekApproval(conversationId: string): PendingElicitation | undefined {
	const waiting = registry().get(conversationId);
	if (waiting === undefined) return undefined;
	// The `settle` closure is deliberately NOT returned: it is this process's
	// way to resolve the promise, and a caller holding it could answer a
	// question twice or answer one it never read.
	const { toolName, callId, message, arguments: proposed } = waiting;
	return { toolName, callId, message, arguments: proposed };
}

/** Why an answer did not settle a question. */
export type AnswerOutcome = 'settled' | 'nothing-pending' | 'wrong-call';

/**
 * Answers the pending question, but only if it is the one being answered.
 *
 * `callId` IS REQUIRED, and that is the fix for a real race review found: a
 * click on question A that arrives after A's run ended and B has registered
 * would otherwise settle B. The answer carries no identity of its own, so the
 * only thing that can tell the two apart is the call id the client was shown —
 * and comparing it here, in the same synchronous step that settles, is what
 * makes the check atomic with respect to the decision.
 *
 * An OUTCOME rather than a throw, because neither miss is a server fault:
 * "nothing is pending" is what a client sees when it answers after the run
 * ended or after another tab answered first, and "wrong call" is what it sees
 * when the question moved on while the person was reading it.
 */
export function answerApproval(
	conversationId: string,
	callId: string,
	approved: boolean
): AnswerOutcome {
	const waiting = registry().get(conversationId);
	if (waiting === undefined) return 'nothing-pending';
	if (waiting.callId !== callId) return 'wrong-call';
	waiting.settle(approved);
	return 'settled';
}

/** Forgets every pending question, for tests. */
export function forgetPendingApprovals(): void {
	for (const waiting of [...registry().values()]) waiting.settle(false);
	(globalThis as PendingHost)[PENDING_SLOT] = undefined;
}

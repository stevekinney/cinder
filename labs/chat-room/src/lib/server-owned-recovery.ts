import type { AgentRun, SessionHandle } from '@lostgradient/operative';

/**
 * What a re-attach attempt actually found.
 *
 * `handle.recover()` answers `AgentRun | null`, and `null` is AMBIGUOUS: it is
 * returned both when there was nothing in flight to re-attach to, and when a
 * durable re-attach was attempted and every candidate rejected. Those are
 * opposite outcomes — one is a healthy idle session, the other is a run whose
 * work is gone — and a UI that renders them the same way is lying about one of
 * them.
 *
 * Operative resolves the ambiguity through the emitter rather than the return
 * value: the dispatched `session.recover` event carries a `failures` array,
 * empty for "nothing to resume" and populated for "attempted and failed", each
 * entry naming the rejected `runId` and its `error`. That is the observability
 * AB-29 shipped, and this module's whole job is to consume it rather than
 * leaving callers to guess from a bare `null`.
 */
export type RecoveryOutcome =
	| {
			/** A run was still in flight and this process re-attached to it. */
			readonly kind: 'recovered';
			readonly run: AgentRun;
	  }
	| {
			/**
			 * NOTHING IS CURRENTLY RESUMABLE — which is not the same as nothing
			 * having been in flight, and this comment used to say the latter.
			 *
			 * A second check after an orphan was reported also lands here,
			 * because Operative reconciles the stranded run as it reports the
			 * rejection. A run was in flight then, and its work was lost; only
			 * the present tense is safe to assert.
			 */
			readonly kind: 'nothing-to-resume';
	  }
	| {
			/**
			 * A re-attach was attempted and every candidate rejected — the run is
			 * an orphan, terminally. This is the outcome this lab expects, because
			 * its `resolveWorkflowServices` answers `unavailable`: a run's provider
			 * is bound to a request-scoped key and its writer to one HTTP
			 * response's controller, so after a restart there is nothing to rebuild
			 * and nothing to resume INTO.
			 */
			readonly kind: 'orphaned';
			readonly failures: readonly RecoveryFailure[];
	  };

export type RecoveryFailure = {
	readonly runId: string;
	/** A SENTENCE, not the thrown value — see `describeRecoveryError`. */
	readonly reason: string;
};

const recoveryLocks = new Map<string, Promise<void>>();

/** Serializes recovery attempts for one conversation so losers read the winner's record. */
export async function withRecoveryLock<T>(id: string, operation: () => Promise<T>): Promise<T> {
	const previous = recoveryLocks.get(id) ?? Promise.resolve();
	let release!: () => void;
	const current = new Promise<void>((resolve) => {
		release = resolve;
	});
	recoveryLocks.set(id, current);
	await previous;
	try {
		return await operation();
	} finally {
		release();
		if (recoveryLocks.get(id) === current) recoveryLocks.delete(id);
	}
}

/** Formats a recovery diagnostic without copying provider error text to logs. */
export function recoveryFailureLog(conversationId: string, runId: string): string {
	return `[server-owned] recovery rejected for run ${runId} in conversation ${conversationId}; details withheld`;
}

/**
 * Renders a rejected re-attach as a SERVER-SIDE DIAGNOSTIC.
 *
 * NOT for a surface a person reads, which is what this said before the
 * endpoint learned to redact. The string is `Error.message` verbatim, and a
 * resume rejection can quote a connection string — so returning a string
 * prevents forwarding a live `Error` object, and nothing more. Whoever sends
 * this across a response or logging boundary is responsible for replacing it.
 * The recovery endpoint withholds the raw reason in both places and logs only
 * the run and conversation identifiers through `recoveryFailureLog`.
 *
 * A string by construction, so a caller cannot accidentally forward a live
 * error object across the response boundary — the same reasoning as
 * `describeCause` in the runtime module, applied to the same class of value.
 * No-throw for the same reason too: this runs while classifying a failure, and
 * a value that will not describe itself must not turn one failure into two.
 */
export function describeRecoveryError(error: unknown): string {
	try {
		if (error instanceof Error) {
			return error.name === 'Error' ? error.message : `${error.name}: ${error.message}`;
		}
		return typeof error === 'string' ? error : String(error);
	} catch {
		return `a ${typeof error} that could not be described`;
	}
}

/**
 * Calls `recover()` and classifies what it found.
 *
 * The listener is registered BEFORE `recover()` is called, not after. The event
 * is dispatched during the call, so subscribing afterwards would miss it
 * entirely and every orphaned run would be misreported as "nothing to resume" —
 * the benign answer, which is the wrong direction to be wrong in.
 */
export async function classifyRecovery(handle: SessionHandle): Promise<RecoveryOutcome> {
	let failures: readonly RecoveryFailure[] = [];

	const onRecover = (event: Event): void => {
		const detail = event as Event & {
			failures?: readonly { runId?: unknown; error?: unknown }[];
		};
		failures = (detail.failures ?? []).map((failure) => ({
			runId: typeof failure.runId === 'string' ? failure.runId : 'unknown',
			reason: describeRecoveryError(failure.error)
		}));
	};

	handle.emitter.addEventListener('session.recover', onRecover);
	try {
		const run = await handle.recover();
		if (run !== null) return { kind: 'recovered', run };
		return failures.length === 0 ? { kind: 'nothing-to-resume' } : { kind: 'orphaned', failures };
	} finally {
		// Removed in `finally`, so a throwing `recover()` does not leave a
		// listener attached to a long-lived emitter. The handle outlives this
		// call; the listener must not.
		handle.emitter.removeEventListener('session.recover', onRecover);
	}
}

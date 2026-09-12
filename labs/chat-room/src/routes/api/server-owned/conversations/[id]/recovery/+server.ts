import { json } from '@sveltejs/kit';
import { createSessionHandle } from '@lostgradient/operative';

import {
	AGENT_NAME,
	loadConversation,
	orphanedRunsOf,
	rememberOrphanedRuns
} from '$lib/server-owned-conversations';
import { emptyToolbox } from '$lib/toolbox';
import { durableRuntime } from '$lib/server-owned-durable';
import { classifyRecovery, withRecoveryLock } from '$lib/server-owned-recovery';
import { serverOwnedRuntime } from '$lib/server-owned-runtime';
import { raise, unavailableDuringShutdown } from '$lib/server-owned-unavailable';

import type { RequestHandler } from './$types';

/**
 * What a durable re-attach finds for this conversation, as data.
 *
 * A POST, and the first version of this was a GET on the reasoning that
 * `recover()` re-attaches to work already running rather than starting
 * anything. That reasoning was falsified by the paragraph below it: `recover()`
 * RECONCILES a stranded run as it reports the rejection, so the first call
 * consumes the only orphan diagnosis there will ever be.
 *
 * A one-shot operation behind a safe, cacheable, retry-on-a-whim verb is a
 * diagnosis waiting to be spent by a link prefetch, an infrastructure retry, or
 * a monitor — before the person it was for ever opened the panel. The verb has
 * to say that asking changes something, because asking does.
 *
 * The interesting answer in THIS lab is `orphaned`. The variant supplies
 * `resolveWorkflowServices` returning `unavailable`, because a run's
 * dependencies are a provider bound to a request-scoped API key and a writer
 * bound to one HTTP response's stream controller — after a restart there is
 * nothing to rebuild and nothing to resume into. So a run that was in flight
 * when the process died is terminally orphaned, and this endpoint says so
 * rather than reporting the benign "nothing to resume" that a bare `null` from
 * `recover()` would suggest.
 *
 * ORPHANED IS REPORTED ONCE, which is Operative's behaviour and not this
 * endpoint's. `recover()` reconciles a stranded `running` ref as it reports the
 * rejection (AB-28), so the second call finds nothing still marked running and
 * answers `nothing-to-resume`. Measured, not assumed — see the transcript in
 * `docs/durability-exercise.md`. The response says so in `note` so a reader
 * who asks twice sees the reason rather than a classification that evaporated.
 */
export const POST: RequestHandler = async ({ params }) => {
	try {
		return await withRecoveryLock(params.id, () => respond(params.id));
	} catch (cause) {
		return unavailableDuringShutdown(cause) ?? raise(cause);
	}
};

async function respond(id: string): Promise<Response> {
	const existing = await loadConversation(id);
	if (existing === undefined) {
		return json({ error: 'No such conversation.' }, { status: 404 });
	}

	void existing;

	const { sessions, durability } = serverOwnedRuntime();
	const durable = await durableRuntime();

	const handle = createSessionHandle(id, {
		store: sessions,
		engine: durable.engine,
		checkpointStore: durable.checkpointStore,
		agentName: AGENT_NAME,
		// `runOptions` is REQUIRED by `SessionHandleContext`, even though this
		// endpoint never generates. `recover()` re-attaches to work already
		// running — it reads `runs.at(-1)`, derives the `runId`, and calls
		// `engine.resume(runId)` — so it never reaches `generate`.
		//
		// NOT "read-only", which is what this said while the endpoint was a GET.
		// `recover()` reconciles the stranded run it reports, which is the whole
		// reason the verb is a POST; calling it read-only here would invite
		// restoring the caching and retry behaviour that consumes the one-time
		// orphan diagnosis.
		//
		// This one THROWS rather than returning an empty stream, and the
		// distinction is the whole point. A no-op provider would let a
		// misconfiguration silently produce an empty reply that looks like a
		// model answering with nothing; a refusal cannot be used by accident.
		// It also makes the claim above falsifiable: if a future Operative
		// version does call `generate` on this path, this endpoint fails loudly
		// instead of quietly inventing a run.
		//
		// Recorded as an ergonomics gap in AB — asking whether anything is
		// recoverable should not require supplying run behaviour.
		runOptions: {
			generate: () => {
				throw new Error(
					'The recovery endpoint does not generate. It re-attaches to an existing run, and reaching this function means the re-attach path changed.'
				);
			},
			toolbox: emptyToolbox
		}
	});

	const outcome = await classifyRecovery(handle);

	// RECORDED IMMEDIATELY, before the response is built and before anything
	// else awaits. The classification is consumed by the call that produced it,
	// so every instruction between here and the write is a window in which a
	// concurrent request can read an empty history and report that nothing was
	// ever orphaned.
	//
	// It does not close the window — two requests racing `recover()` are only
	// fully ordered by a lock this lab does not have — but it is as early as the
	// evidence can be made durable, which is the part that matters: the record
	// outlives the one response that carried the diagnosis.
	if (outcome.kind === 'orphaned') {
		await rememberOrphanedRuns(
			id,
			outcome.failures.map((failure) => failure.runId)
		);
	}

	if (outcome.kind === 'recovered') {
		// STEP-LEVEL, and the reason is where the run's events come from rather
		// than a property of the handle's type.
		//
		// A live turn streams because THIS process is holding the provider
		// connection and re-encoding its deltas. A recovered run is one the
		// engine resumed from a checkpoint: its progress is whatever the
		// workflow has written since, which advances a step at a time. No
		// reassembly of the tokens that were in flight when the last process
		// died is possible, because nothing persisted them.
		//
		// NOT a `DiagnosticAgentRun`, which is what CIN-445 expected and what an
		// earlier version of this comment repeated. `SessionHandle.recover()` is
		// declared `Promise<AgentRun | null>` and wraps the recovered handle with
		// `createAgentRun`, deliberately — upstream's own comment says "wrap it
		// as an `AgentRun` so the caller can observe the resumed run normally".
		// `server-owned-recovery-contract.test.ts` pins both halves so this
		// cannot drift back into a comfortable paraphrase.
		return json({
			kind: 'recovered',
			progress: 'step-level',
			durability,
			note: 'Progress advances a step at a time. The tokens that were in flight when the previous process died were never persisted, so there is nothing to replay.'
		});
	}

	if (outcome.kind === 'nothing-to-resume') {
		// READ AFTER CLASSIFYING, not before. A snapshot taken before `recover()`
		// is stale the moment two POSTs overlap: both would see an empty history,
		// one would consume and record the orphan, and the other would answer
		// `nothing-to-resume` while reporting that nothing had ever been orphaned
		// — losing the very evidence this field exists to preserve.
		//
		// Re-loaded rather than cached, because the write that matters may have
		// been another request's.
		const recorded = await loadConversation(id);
		const previouslyOrphaned = recorded === undefined ? [] : orphanedRunsOf(recorded.metadata);
		// PREVIOUSLY ORPHANED RUNS CROSS, so a second ask can say which of two
		// things "nothing currently resumable" means without relying on a page
		// remembering. The classification is available exactly once — the
		// reconciliation happens as it is reported — so a dropped response or a
		// plain reload used to lose the evidence and leave the next answer
		// claiming no run was ever in flight.
		return json({ kind: 'nothing-to-resume', durability, previouslyOrphaned });
	}

	// REDACTED at this boundary, not in the classifier.
	//
	// `classifyRecovery` reports the engine's own words, which is right for a
	// server log and for the unit tests that pin the distinction it draws. What
	// is wrong is sending those words to a browser: a resume rejection can
	// quote a connection string, a header, or a database URL with a password in
	// it, and review demonstrated exactly that with
	// `postgres://user:hunter2@host/db unreachable`. Asserting the stack is
	// absent does not make the message safe.
	//
	// The run id crosses, because it is this lab's own identifier and it is what
	// makes two orphaned runs distinguishable in the interface. The reason does
	// not.
	for (const failure of outcome.failures) {
		console.error(
			`[server-owned] recovery rejected for ${failure.runId} in conversation ${id}: ${failure.reason}`
		);
	}

	return json({
		kind: 'orphaned',
		durability,
		failures: outcome.failures.map((failure) => ({
			runId: failure.runId,
			reason: 'The engine refused to resume this run. The details are in the server log.'
		})),
		note: 'Reported once. Operative reconciles a stranded run to terminal as it reports the rejection, so asking again answers "nothing to resume".'
	});
}

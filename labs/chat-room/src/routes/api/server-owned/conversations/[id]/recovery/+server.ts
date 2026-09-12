import { json } from '@sveltejs/kit';
import { createSessionHandle } from '@lostgradient/operative';

import { AGENT_NAME, loadConversation } from '$lib/server-owned-conversations';
import { emptyToolbox } from '$lib/toolbox';
import { durableRuntime } from '$lib/server-owned-durable';
import { classifyRecovery } from '$lib/server-owned-recovery';
import { serverOwnedRuntime } from '$lib/server-owned-runtime';
import { raise, unavailableDuringShutdown } from '$lib/server-owned-unavailable';

import type { RequestHandler } from './$types';

/**
 * What a durable re-attach finds for this conversation, as data.
 *
 * A GET rather than a POST, and that is a deliberate contract rather than a
 * convenience: `recover()` re-attaches to work that is ALREADY running, it does
 * not start anything. "Disconnect is not stop" is Operative's own framing, and
 * a verb that implied mutation here would invite a caller to treat asking about
 * a run as restarting one.
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
export const GET: RequestHandler = async ({ params }) => {
	try {
		return await respond(params.id);
	} catch (cause) {
		return unavailableDuringShutdown(cause) ?? raise(cause);
	}
};

async function respond(id: string): Promise<Response> {
	if ((await loadConversation(id)) === undefined) {
		return json({ error: 'No such conversation.' }, { status: 404 });
	}

	const { sessions, durability } = serverOwnedRuntime();
	const durable = await durableRuntime();

	const handle = createSessionHandle(id, {
		store: sessions,
		engine: durable.engine,
		checkpointStore: durable.checkpointStore,
		agentName: AGENT_NAME,
		// `runOptions` is REQUIRED by `SessionHandleContext`, even to ask a
		// read-only question about recovery. `recover()` re-attaches to work
		// already running — it reads `runs.at(-1)`, derives the `runId`, and
		// calls `engine.resume(runId)` — so it never reaches `generate`.
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
		return json({ kind: 'nothing-to-resume', durability });
	}

	return json({
		kind: 'orphaned',
		durability,
		failures: outcome.failures,
		note: 'Reported once. Operative reconciles a stranded run to terminal as it reports the rejection, so asking again answers "nothing to resume".'
	});
}

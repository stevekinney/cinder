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

	const { sessions } = serverOwnedRuntime();
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
		// A recovered run is a DIAGNOSTIC one — Operative documents it as
		// "useful for inspection and cancellation only", and the type omits
		// `output()` and `unwrap()` because the originating schema may no longer
		// be available to validate against.
		//
		// Reported rather than smoothed over. A surface that presented this as
		// equivalent to a live run would be claiming a guarantee the package
		// deliberately withholds, and the first person to call for its output
		// would find out the hard way.
		return json({
			kind: 'recovered',
			progress: 'step-level',
			note: 'A recovered run supports inspection and cancellation. It cannot produce validated output, because the schema it was started with may be gone.'
		});
	}

	if (outcome.kind === 'nothing-to-resume') {
		return json({ kind: 'nothing-to-resume' });
	}

	return json({ kind: 'orphaned', failures: outcome.failures });
}

import { json } from '@sveltejs/kit';
import { z } from 'zod';

import { loadConversation } from '$lib/server-owned-conversations';
import { answerApproval, peekApproval } from '$lib/server-owned-elicitation';
import { raise, unavailableDuringShutdown } from '$lib/server-owned-unavailable';

import type { RequestHandler } from './$types';

/**
 * The question a server-owned run is waiting on, and the answer to it.
 *
 * OUT OF BAND, and that is forced rather than chosen. The run lives on the
 * server and its stream is a one-way response body, so a question raised mid-run
 * cannot be asked over the connection that is delivering the answer tokens —
 * and `@lostgradient/chat`'s wire vocabulary is a closed union with no frame
 * for it, which this issue's delivery boundary (`labs/chat-room` only) puts out
 * of reach. upstream: CIN-615 tracks replacing this side channel rather than using a `tool.progress`
 * frame carrying a question, which would have been a lie about what that frame
 * means.
 *
 * So: GET reads the pending question, POST answers it. Both are scoped to one
 * conversation, because that is what the registry keys on.
 */
const answerSchema = z.object({
	approved: z.boolean(),
	/**
	 * The call this answer is about, as read from `GET`.
	 *
	 * REQUIRED, and the fix for a race review found: a click on one question
	 * that arrives after its run ended and a second question has registered
	 * would otherwise settle the second. The answer carries no identity of its
	 * own, so the id the client was shown is the only thing that can tell them
	 * apart.
	 */
	callId: z.string().min(1)
});

export const GET: RequestHandler = async ({ params }) => {
	try {
		if ((await loadConversation(params.id)) === undefined) {
			return json({ error: 'No such conversation.' }, { status: 404 });
		}

		const pending = peekApproval(params.id);

		// 200 WITH `pending: null` rather than a 404. "Nothing is being asked"
		// is the ordinary state of a conversation, and a client polling while a
		// turn streams would otherwise have to treat a routine answer as an
		// error response.
		return json({ pending: pending ?? null });
	} catch (cause) {
		return unavailableDuringShutdown(cause) ?? raise(cause);
	}
};

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		if ((await loadConversation(params.id)) === undefined) {
			return json({ error: 'No such conversation.' }, { status: 404 });
		}

		let body: unknown;
		try {
			body = await request.json();
		} catch {
			return json({ error: 'Request body must be JSON.' }, { status: 400 });
		}

		const parsed = answerSchema.safeParse(body);
		if (!parsed.success) {
			return json(
				{ error: 'Body must be { "approved": boolean, "callId": string }.' },
				{ status: 400 }
			);
		}

		const outcome = answerApproval(params.id, parsed.data.callId, parsed.data.approved);

		// 409 rather than 404, and rather than a silent 200. The conversation
		// exists; what is absent is the question being answered — either because
		// the run ended, or another client answered first, or the run has moved
		// on to a different call. A 200 would tell the caller its click took
		// effect.
		//
		// The two misses are reported DIFFERENTLY, because they mean different
		// things to a client: nothing pending means stop asking, while a
		// mismatch means re-read the current question and offer that one
		// instead.
		if (outcome === 'nothing-pending') {
			return json({ error: 'This conversation is not waiting on an approval.' }, { status: 409 });
		}
		if (outcome === 'wrong-call') {
			return json(
				{ error: 'That approval is for a call this conversation has moved past.' },
				{ status: 409 }
			);
		}

		return json({ approved: parsed.data.approved, callId: parsed.data.callId });
	} catch (cause) {
		return unavailableDuringShutdown(cause) ?? raise(cause);
	}
};

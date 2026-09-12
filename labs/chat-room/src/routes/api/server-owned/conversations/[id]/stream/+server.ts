import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import { createSessionHandle, stopWhen } from '@lostgradient/operative';
import { createAnthropicProviderStream } from '@lostgradient/operative/anthropic';
import type { BeforeToolExecutionHook, OnElicitation, ToolCall } from '@lostgradient/operative';
import { z } from 'zod';

import { chatRunResponse } from '$lib/chat-run-response';
import { raise, unavailableDuringShutdown } from '$lib/server-owned-unavailable';
import { AGENT_NAME, loadConversation } from '$lib/server-owned-conversations';
import { durableRuntime } from '$lib/server-owned-durable';
import { serverOwnedRuntime } from '$lib/server-owned-runtime';
import {
	ELICITATION_MESSAGE,
	ELICITED_TOOL_NAME,
	requestContext,
	serverOwnedToolbox
} from '$lib/toolbox';
import { requestApproval } from '$lib/server-owned-elicitation';
import { createChatRunOptions } from '$lib/chat-agent';

import type { RequestHandler } from './$types';

const turnSchema = z.object({ text: z.string().trim().min(1).max(4000) });

const MODEL = 'claude-sonnet-5';
const MAX_TOKENS = 4096;

/**
 * Streams a turn for a SERVER-owned conversation.
 *
 * Through `createSessionHandle`, which is the seam that ties this variant's
 * three pieces together: it reads and writes the conversation through the
 * `SessionStore`, and takes the durable `engine` and `checkpointStore` so a
 * run is checkpointed as it goes. Hand-rolling load → append → run → save
 * around the store works, and was the first version of this file, but it
 * leaves the durable engine built and unused — and `handle.recover()` is
 * what <issue>CIN-445</issue> will need.
 *
 * The wire is not re-specified. `createChatRunOptions` is the same
 * definition `/api/chat`'s agent is built from, so both route families emit
 * one NDJSON vocabulary from one piece of plumbing rather than from two that
 * agree today.
 *
 * The browser sends ONE message, never a transcript: the history is the
 * store's, and only the turn just typed has to cross.
 */
export const POST: RequestHandler = async ({ params, request }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Request body must be JSON.' }, { status: 400 });
	}

	const parsed = turnSchema.safeParse(body);
	if (!parsed.success) {
		return json({ error: 'A message between 1 and 4000 characters is required.' }, { status: 400 });
	}

	// Checked before the run rather than left to the handle: a missing
	// conversation is a 404, and discovering it inside a streaming response
	// would mean reporting it as a mid-stream failure instead.
	//
	// GUARDED, because `loadConversation` reaches `serverOwnedRuntime()` too.
	// This lookup runs before the lifecycle block below, so leaving it
	// unguarded meant a POST arriving after termination latched still got a
	// generic 500 — the shutdown mapping was in the route but not on the first
	// line that could trigger it.
	try {
		if ((await loadConversation(params.id)) === undefined) {
			return json({ error: 'No such conversation.' }, { status: 404 });
		}
	} catch (cause) {
		return unavailableDuringShutdown(cause) ?? raise(cause);
	}

	if (!env.ANTHROPIC_API_KEY) {
		return json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 503 });
	}

	// KNOWN DIFFERENCE from `/api/chat`: no prompt-cache boundary.
	//
	// The canonical route marks the newest message with `cacheBoundary` before
	// the run, so each turn caches the prompt prefix and the next turn reads it
	// back instead of reprocessing the transcript. Here the turn is appended by
	// `handle.run()` inside the session, so there is no equivalent moment to
	// mark it — the nearest seam is a `prepareStep` hook mutating the run's
	// conversation.
	//
	// Not done, deliberately: a cache boundary's effect is only observable in a
	// provider's `cache_read_input_tokens`, which the local fixture does not
	// report, so the change could be written but not verified from this
	// repository. Shipping an unverifiable optimization into the path that
	// bills is worse than recording the gap.
	//
	// The cost is real and grows with transcript length, so this is a follow-up
	// rather than a non-issue.
	// Resolved BEFORE `chatRunResponse` opens a stream, and that ordering is
	// what makes a clean 503 possible at all: once NDJSON frames are flowing
	// the status is already sent, and a lifecycle failure could only truncate
	// the body. Catching here keeps the failure a readable sentence.
	let sessions;
	let durable;
	try {
		({ sessions } = serverOwnedRuntime());
		durable = await durableRuntime();
	} catch (cause) {
		return unavailableDuringShutdown(cause) ?? raise(cause);
	}

	return chatRunResponse({
		signal: request.signal,
		start: (writer) => {
			const gate = createElicitationGate(params.id, request.signal);
			return createSessionHandle(params.id, {
				store: sessions,
				engine: durable.engine,
				checkpointStore: durable.checkpointStore,
				agentName: AGENT_NAME,
				runOptions: createChatRunOptions({
					generate: createAnthropicProviderStream({
						model: MODEL,
						maximumTokens: MAX_TOKENS,
						apiKey: env.ANTHROPIC_API_KEY,
						// As in `/api/chat`: Operative's provider does not read
						// `ANTHROPIC_BASE_URL` itself, so omitting this forward would
						// send every Playwright spec at the real, billed API.
						baseURL: env.ANTHROPIC_BASE_URL
					}),
					// The family's OWN toolbox, whose `remember_note` carries no
					// armorer approval policy — the approval moved from the
					// toolbox to the loop.
					//
					// Why it had to move. The gated tool parks: `beforeExecute`
					// answers `needs_approval`, armorer mints a signed token,
					// the run stops, and the client is expected to call the
					// transport again carrying that token. That works for the
					// browser-owned route, where the conversation lives in the
					// tab. Here it cannot: the transport has no user turn to
					// send on a continuation, so the park had no way to be
					// resolved in this family at all — which is why the toolbox
					// used to be empty here.
					//
					// `ctx.elicit(...)` in a `beforeToolExecution` hook asks the
					// question instead, and the run WAITS inside the step rather
					// than stopping. The answer arrives on a separate request to
					// `…/elicitation` and resolves the promise this process is
					// holding. A denial filters the call out of the array the
					// hook returns, and Operative seals it with an error result
					// — so the model is told the tool did not run rather than
					// the run failing.
					toolbox: serverOwnedToolbox,
					// NO `stopAfterAnyToolCall` here, unlike the browser-owned
					// route. Stopping after a tool call hands control back to a
					// client that would have to start the next turn — and this
					// family's client cannot, because a continuation carries no
					// user text to send. Left in, an approved note produced a
					// tool result and nothing after it, and the session
					// controller's continuation attempt failed the turn the
					// tool had just succeeded in.
					//
					// Without it the loop carries on to a second generate and
					// finishes with the assistant's reply, so the browser
					// receives one complete turn.
					stopWhen: [stopWhen.noToolCalls()],
					...gate.runOptions,
					requestContext,
					writer
				})
			}).run(parsed.data.text);
		}
	});
};

/**
 * One request's elicitation gate: the hook that asks, and the callback that
 * waits for an answer.
 *
 * BUILT TOGETHER, because Operative's `ctx.elicit(message, schema)` carries no
 * call identity. The hook knows which call it is asking about; the callback is
 * what registers the question a person will see. Threading the one to the
 * other through a shared closure is the only way to put the call's own id and
 * arguments in front of the person deciding — and without that, review found,
 * approving one note also ran a second, unseen one.
 *
 * PER REQUEST, never module-scoped: the closure holds this turn's abort signal
 * and the call it is currently asking about.
 */
function createElicitationGate(
	conversationId: string,
	signal: AbortSignal
): {
	runOptions: { onElicitation: OnElicitation; beforeToolExecution: BeforeToolExecutionHook[] };
} {
	// The call the hook is asking about right now. Set immediately before each
	// `elicit` and cleared after, so the callback below always describes the
	// question it is actually registering.
	let asking: ToolCall | undefined;

	const onElicitation: OnElicitation = async (elicitation) => {
		const approved = await requestApproval(
			conversationId,
			{
				toolName: asking?.name ?? ELICITED_TOOL_NAME,
				callId: asking?.id ?? 'unknown',
				message: elicitation.message,
				arguments: toProposedArguments(asking?.arguments)
			},
			signal
		);

		// `null` IS the denial in Operative's contract, and `{ data }` the
		// acceptance. `ctx.elicit` maps them to `null` / the value and never
		// throws, so the hook below decides what a denial means.
		//
		// PARSED through the caller's own `schema`, not cast past it.
		// `OnElicitation` is generic in the answer's type and the request
		// carries the schema that defines it, so a literal would only
		// type-check behind an assertion — and the assertion is exactly what
		// would go stale if the hook ever asks a different question.
		return approved ? { data: elicitation.schema.parse({ approved: true }) } : null;
	};

	/**
	 * Asks about EACH gated call, and drops the ones answered no.
	 *
	 * Sequential rather than concurrent: the registry holds one question per
	 * conversation, and two questions racing for that slot would make the
	 * second fail as already-pending. Asking in order also matches what a
	 * person can actually do, which is answer one at a time.
	 *
	 * A dropped call is not an error the run has to survive — Operative seals a
	 * filtered call with an error result so nothing is left dangling for a
	 * later replay to trip over.
	 */
	const beforeToolExecution: BeforeToolExecutionHook = async (context) => {
		const gated = context.toolCalls.filter((call) => call.name === ELICITED_TOOL_NAME);
		if (gated.length === 0) return context.toolCalls;

		const elicit = context.elicit;
		// `elicit` is ABSENT unless `onElicitation` was supplied — Operative
		// builds it from that callback — so a hook wired without it gets no
		// question. Treated as a denial rather than an approval: a gate that
		// fails open is not a gate.
		if (elicit === undefined) {
			return context.toolCalls.filter((call) => call.name !== ELICITED_TOOL_NAME);
		}

		const denied = new Set<string>();
		for (const call of gated) {
			asking = call;
			try {
				// The SCHEMA is what Operative validates the answer against, and
				// it is the host's own shape rather than the tool's input: the
				// person is answering "may this run", not re-authoring the note.
				const answer = await elicit(ELICITATION_MESSAGE, z.object({ approved: z.literal(true) }));
				if (answer === null) denied.add(call.id);
			} finally {
				asking = undefined;
			}
		}

		// The DENIAL's own frame is not written here, and an earlier attempt to
		// write it here is why: a hook runs before the step's `tool_call` frames
		// reach the wire, so the result arrived describing a call the client had
		// not seen yet and was dropped. `pumpChatRun` settles any call a step
		// leaves without a result, in the same loop that writes the calls — the
		// one place where the ordering is right by construction.
		return context.toolCalls.filter((call) => !denied.has(call.id));
	};

	return { runOptions: { onElicitation, beforeToolExecution: [beforeToolExecution] } };
}

/**
 * The model's proposed arguments, as something JSON-safe to show a person.
 *
 * An OBJECT or nothing. A person is being asked to approve a specific note, so
 * a non-object argument list is reported as an empty one rather than coerced
 * into a shape the client would render as `[object Object]`.
 */
function toProposedArguments(proposed: unknown): Record<string, unknown> {
	if (typeof proposed !== 'object' || proposed === null || Array.isArray(proposed)) return {};
	return { ...(proposed as Record<string, unknown>) };
}

import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import { createSessionHandle } from '@lostgradient/operative';
import { createAnthropicProviderStream } from '@lostgradient/operative/anthropic';
import type { StepContext, ToolCall, ToolExecutionHookContext } from '@lostgradient/operative';
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
		start: (writer) =>
			createSessionHandle(params.id, {
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
					// tab. Here it cannot: the transport rejects a
					// continuation before it reaches `fetch`, because the last
					// message on a continuation is a tool result rather than
					// the string-valued user message it checks for (see
					// `conversation-surface.svelte`). So the park had no way to
					// be resolved in this family at all, which is why the
					// toolbox used to be empty here.
					//
					// `ctx.elicit(...)` in a `beforeToolExecution` hook asks
					// the question instead, and the run WAITS inside the step
					// rather than stopping. The answer arrives on a separate
					// request to `…/elicitation` and resolves the promise this
					// process is holding. A denial filters the call out of the
					// array the hook returns, and Operative seals it with an
					// error result — so the model is told the tool did not run
					// rather than the run failing.
					toolbox: serverOwnedToolbox,
					// `elicitation`, not `request` — the route's own `request` is
					// the HTTP one, and its `signal` is what this callback needs.
					onElicitation: async (elicitation) => {
						const { message, context, schema } = elicitation;
						// The call being asked about. `context` carries the
						// conversation and step, not the tool call, so the
						// pending calls are read off the conversation — the
						// gated one is the only one the hook elicits for.
						const call = pendingElicitedCall(context.conversation);
						const approved = await requestApproval(
							params.id,
							{
								toolName: call?.name ?? ELICITED_TOOL_NAME,
								callId: call?.id ?? 'unknown',
								message,
								arguments: toProposedArguments(call?.arguments)
							},
							request.signal
						);
						// `null` IS the denial in Operative's contract, and
						// `{ data }` the acceptance. `ctx.elicit` maps them to
						// `null` / the value and never throws, so the hook
						// below decides what a denial means.
						//
						// PARSED through the caller's own `schema`, not cast past
						// it. `OnElicitation` is generic in the answer's type and
						// the request carries the schema that defines it, so a
						// literal would only type-check behind an assertion — and
						// the assertion is exactly the thing that would go stale
						// if the hook below ever asks a different question.
						return approved ? { data: schema.parse({ approved: true }) } : null;
					},
					beforeToolExecution: [gateElicitedTool],
					requestContext,
					writer
				})
			}).run(parsed.data.text)
	});
};

/**
 * The pending tool call the hook is eliciting about.
 *
 * Read off the conversation rather than threaded through, because Operative's
 * `ElicitationRequest.context` is a `StepContext` — conversation, step, and
 * signal — with no tool call on it. The gated tool is the only one the hook
 * elicits for, so the pending call carrying that name is the subject.
 *
 * `undefined` is tolerated rather than thrown on: the question still has a
 * message, and refusing to ask it because the call could not be identified
 * would turn a cosmetic gap in the prompt into a failed run.
 */
function pendingElicitedCall(conversation: StepContext['conversation']): ToolCall | undefined {
	const pending = conversation.getPendingToolCalls();
	return pending.find((call) => call.name === ELICITED_TOOL_NAME) ?? pending[0];
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

/**
 * Asks before the gated tool runs, and drops it when the answer is no.
 *
 * `elicit` is ABSENT unless `onElicitation` was supplied — Operative builds
 * `ctx.elicit` from it — so a caller that wires the hook without the callback
 * gets no question. Treated as a denial rather than an approval: a gate that
 * fails open is not a gate.
 *
 * Returns the calls to execute. A dropped call is not an error the run has to
 * survive: Operative seals a filtered call with an error result so nothing is
 * left dangling for a later replay to trip over.
 */
async function gateElicitedTool(context: ToolExecutionHookContext): Promise<ToolCall[]> {
	const gated = context.toolCalls.filter((call) => call.name === ELICITED_TOOL_NAME);
	if (gated.length === 0) return context.toolCalls;

	const elicit = context.elicit;
	if (elicit === undefined) {
		return context.toolCalls.filter((call) => call.name !== ELICITED_TOOL_NAME);
	}

	// The SCHEMA is what Operative validates the answer against, and it is the
	// host's own shape rather than the tool's input: the person is answering
	// "may this run", not re-authoring the note.
	const answer = await elicit(ELICITATION_MESSAGE, z.object({ approved: z.literal(true) }));
	if (answer !== null) return context.toolCalls;
	return context.toolCalls.filter((call) => call.name !== ELICITED_TOOL_NAME);
}

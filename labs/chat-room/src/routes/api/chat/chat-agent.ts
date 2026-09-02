/**
 * The Operative-backed agent loop for `/api/chat`, factored out of the route
 * so the exact same pump — the code that turns run events into NDJSON
 * frames and a terminal envelope — runs under both the real HTTP handler and
 * the deterministic unit tests in `chat-agent.test.ts`. Only the `generate`
 * function differs: the route wraps `createAnthropicProviderStream`, the
 * tests wrap a local fixture with no network or model calls.
 *
 * Wire parity with the pre-Operative hand-assembled loop is the whole point
 * of this file: `ChatStreamFrame` carries exactly the three shapes the
 * published `@lostgradient/chat` decoder accepts (`text`, `tool_call`,
 * `tool_result`), byte-for-byte, no wider vocabulary.
 */
import {
	AgentRunError,
	createAgent,
	StepCompletedEvent,
	stopWhen,
	type AgentRun,
	type AnyToolbox,
	type ConversationHistory,
	type EnhancedStreamingOptions,
	type OperativeExecuteOptions,
	type StandaloneAgent,
	type StepResult,
	type StreamingGenerateFunction
} from '@lostgradient/operative';
import { withEnhancedStreaming } from '@lostgradient/operative/streaming';

import type { ToolAction, ToolError, JSONValue, PendingToolApproval } from 'armorer';

/** One NDJSON frame, matching `@lostgradient/chat`'s `decodeChatStreamEvents` union exactly. */
export type ChatStreamFrame =
	| { type: 'text'; text: string }
	| { type: 'tool_call'; id: string; name: string; arguments: JSONValue }
	| {
			type: 'tool_result';
			callId: string;
			outcome: 'success' | 'error' | 'action_required';
			content: JSONValue;
			error?: ToolError;
			action?: ToolAction;
			pendingApproval?: PendingToolApproval;
	  };

/** The terminal, non-streamed outcome of a chat run — never written to the NDJSON body. */
export type ChatRunEnvelope =
	| { ok: true; status: 'completed'; content: string; output?: unknown }
	| { ok: false; status: string; error: { kind: string; code: string; message: string } };

/**
 * Stops the loop the instant a step produces ANY tool call, approval-gated
 * or not — restoring the pre-Operative contract byte-for-byte: one server
 * step per HTTP request, never a follow-up generate call in the same
 * response. Without this, `stopWhen: [pendingApproval(), noToolCalls()]`
 * alone lets an ordinary (non-approval) tool call run to completion AND
 * generate its follow-up reply within one request — which collides with
 * `packages/chat`'s `createChatSessionController`, whose continuation loop
 * (`session-controller.ts`, `while (++turn <= maxTurns)`) already re-POSTs
 * whenever it sees a resolved, non-approval tool result, regardless of
 * whether a follow-up reply also arrived in that same response. Two real
 * problems traced back to that same collision during review: a redundant
 * second (billed) turn after the answer had already streamed, and a message-
 * ordering bug on the client when a tool step and assistant text landed in
 * one response. `packages/chat` is out of scope for this change — this stop
 * condition is the fix that belongs on this side of the boundary, and it
 * makes both problems moot by never producing that response shape.
 *
 * This makes `pendingApproval()` redundant (every approval-gated call also
 * has `toolCalls.length > 0`), but it stays in the list for clarity — the
 * intent ("stop and hand control back on an approval") is easy to read at
 * the call site even though this condition alone already covers it.
 */
const stopAfterAnyToolCall = (step: StepResult): boolean => step.toolCalls.length > 0;

/**
 * Builds the module-scoped-toolbox, request-local-eventTarget agent for one
 * `/api/chat` request.
 *
 * `stopWhen` combines `noToolCalls()` (a plain text reply is done after one
 * step) with `stopAfterAnyToolCall` (any step with tool calls is also done
 * after one step, whether or not those calls need approval) and, for
 * intent-at-a-glance, `pendingApproval()`. Without at least one condition
 * that stops on ordinary text, a plain reply would otherwise run to
 * `maximumSteps` — see the declarations' own example for the same pairing.
 */
export function createChatAgent(options: {
	generate: StreamingGenerateFunction;
	toolbox: AnyToolbox;
	requestContext: OperativeExecuteOptions['requestContext'];
	eventTarget: NonNullable<EnhancedStreamingOptions['eventTarget']>;
}): StandaloneAgent {
	return createAgent({
		generate: withEnhancedStreaming(options.generate, { eventTarget: options.eventTarget }),
		toolbox: options.toolbox,
		executeOptions: { requestContext: options.requestContext },
		stopWhen: [stopWhen.noToolCalls(), stopWhen.pendingApproval(), stopAfterAnyToolCall]
	});
}

export function startChatRun(agent: StandaloneAgent, conversation: ConversationHistory): AgentRun {
	return agent.run({ conversation });
}

/**
 * Turns one classified failure into the safe `{ kind, code, message }`
 * envelope. `RunResultBase.error` and a caught `result()` rejection are both
 * typed `unknown` — this is the one place that narrows them, rather than
 * serializing an unknown error object (which could carry a credential-bearing
 * provider response) straight onto the wire.
 *
 * Exported so `chat-agent.test.ts` can pin the `AgentRunError` shapes
 * `@lostgradient/operative` documents directly — most usefully
 * `StandardSchemaValidationError` (`kind: 'output'`, `code: 'INVALID_OUTPUT'`),
 * which this route never triggers live: `createChatAgent` sets no `output`
 * schema, and even an agent that does only ever raises it from
 * `AgentRun.output()`/`.unwrap()`, not from `run.result()` — confirmed
 * empirically, contrary to `RunResultBase.schemaValidation`, which records a
 * failed validation without changing `finishReason` or setting `.error`.
 */
export function classifyChatRunFailure(error: unknown, fallbackStatus: string): ChatRunEnvelope {
	if (error instanceof AgentRunError) {
		return {
			ok: false,
			status: error.kind === 'abort' ? 'aborted' : fallbackStatus,
			error: { kind: error.kind, code: error.code, message: error.message }
		};
	}

	// An abort that arrives as something other than an `AgentRunError` is still
	// an abort, and the caller has already told us so through `fallbackStatus`.
	//
	// This matters because the abort path is the one place where misclassifying
	// is user-visible. `0.7.0` observably RESOLVES `result()` on abort, carrying
	// a real `AgentRunError`, so today every abort takes the branch above. But
	// Operative documents `result()` as REJECTING on abort, and a version that
	// follows its own documentation — or that rejects with the underlying
	// signal's `DOMException` rather than an `AgentRunError` — lands here
	// instead. Reporting `kind: 'generate'` then would make the route call
	// `controller.error(...)` rather than closing cleanly, turning a user
	// pressing "stop generating" into an error banner they never caused.
	const aborted = fallbackStatus === 'aborted';

	return {
		ok: false,
		status: fallbackStatus,
		error: {
			kind: aborted ? 'abort' : 'generate',
			code: aborted ? 'ABORTED' : 'UNKNOWN',
			message: error instanceof Error ? error.message : 'Unknown error'
		}
	};
}

const FAILURE_FINISH_REASONS = new Set([
	'error',
	'aborted',
	'tripwire',
	'budget-exceeded',
	'elicitation-denied',
	'maximum-steps'
]);

/**
 * Consumes one `AgentRun`'s event stream, projecting each step's tool calls
 * and results into `onFrame` as they complete, then resolves the terminal
 * envelope from `run.result()`.
 *
 * Tool-call frames intentionally surface only once a step's provider
 * response has closed — `StepCompletedEvent.toolCalls`/`.results` are only
 * available after that point under 0.7.0's `withEnhancedStreaming`, and nothing
 * in the wire contract for this change requires earlier timing.
 *
 * `run.result()` is documented ("Any pending `result()` promise rejects with
 * an abort reason") to reject on abort, but empirically (`0.7.0`, verified
 * against the installed package directly) it RESOLVES for both an abort and
 * a generate failure, carrying `finishReason: 'aborted' | 'error'` and a real
 * `AgentRunError` on `.error`. The outer try/catch stays anyway as a genuine
 * defensive fallback — an escaped rejection here becomes an unhandled
 * promise rejection in the route's pump, the same hazard class the
 * pre-Operative loop's `'abort'` listener existed to prevent — so this
 * function is correct whichever path a given failure takes.
 */
export async function pumpChatRun(
	run: AgentRun,
	onFrame: (frame: ChatStreamFrame) => void
): Promise<ChatRunEnvelope> {
	try {
		for await (const event of run) {
			if (!(event instanceof StepCompletedEvent)) continue;

			// All calls before any result, matching the pre-Operative handler's
			// emission order byte-for-byte: it streamed `tool_call` frames as each
			// content block completed, then emitted every `tool_result` only after
			// the whole response ended and `toolbox.execute` returned. Interleaving
			// call/result per call instead would represent a step's calls as
			// sequential (call → observe its result → call again) rather than the
			// single parallel assistant step they actually were, which is also what
			// `createChatSessionController` assumes when it appends these frames to
			// the conversation in arrival order.
			for (const toolCall of event.toolCalls) {
				onFrame({
					type: 'tool_call',
					id: toolCall.id,
					name: toolCall.name,
					arguments: toolCall.arguments
				});
			}

			// Pre-indexed once per step rather than `event.results.find(...)`
			// inside the loop below — `toolCalls`/`results` are already fully
			// materialized on `StepCompletedEvent`, so a per-call linear scan is
			// needless O(steps × calls²) work for no behavior difference.
			const resultsByCallId = new Map(event.results.map((result) => [result.callId, result]));

			for (const toolCall of event.toolCalls) {
				const result = resultsByCallId.get(toolCall.id);
				if (!result) continue;

				onFrame({
					type: 'tool_result',
					callId: result.callId,
					outcome: result.outcome,
					content: result.content,
					...(result.error ? { error: result.error } : {}),
					...(result.action ? { action: result.action } : {}),
					...(result.pendingApproval ? { pendingApproval: result.pendingApproval } : {})
				});
			}
		}
	} catch (cause) {
		// Iteration failing is secondary to `run.result()`, which is the
		// authoritative terminal outcome — fall through and let it decide.
		void cause;
	}

	try {
		const result = await run.result();

		if (FAILURE_FINISH_REASONS.has(result.finishReason)) {
			return classifyChatRunFailure(result.error, result.finishReason);
		}

		return {
			ok: true,
			status: 'completed',
			content: result.content,
			...('output' in result ? { output: result.output } : {})
		};
	} catch (cause) {
		return classifyChatRunFailure(cause, 'aborted');
	}
}

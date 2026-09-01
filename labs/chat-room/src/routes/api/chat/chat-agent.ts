/**
 * The Operative-backed agent loop for `/api/chat`, factored out of the route
 * so the exact same pump — the code that turns run events into NDJSON
 * frames and a terminal envelope — runs under both the real HTTP handler and
 * the deterministic unit tests in `chat-server.test.ts`. Only the `generate`
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
 * Builds the module-scoped-toolbox, request-local-eventTarget agent for one
 * `/api/chat` request.
 *
 * `stopWhen` combines `pendingApproval()` with `noToolCalls()` — per the
 * declarations' own example, `pendingApproval()` alone never stops a normal,
 * no-tool-call turn, so a plain text reply would otherwise run to
 * `maximumSteps` instead of finishing after one step.
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
		stopWhen: [stopWhen.pendingApproval(), stopWhen.noToolCalls()]
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
 * Exported so `chat-server.test.ts` can pin the `AgentRunError` shapes
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

	return {
		ok: false,
		status: fallbackStatus,
		error: {
			kind: 'generate',
			code: 'UNKNOWN',
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

			for (const toolCall of event.toolCalls) {
				onFrame({
					type: 'tool_call',
					id: toolCall.id,
					name: toolCall.name,
					arguments: toolCall.arguments
				});

				const result = event.results.find((candidate) => candidate.callId === toolCall.id);
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

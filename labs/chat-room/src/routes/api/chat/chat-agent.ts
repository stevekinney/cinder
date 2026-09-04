/**
 * The Operative-backed agent loop for `/api/chat`, factored out of the route
 * so the exact same pump — the code that turns run events into NDJSON
 * frames and a terminal envelope — runs under both the real HTTP handler and
 * the deterministic unit tests in `chat-agent.test.ts`. Only the `generate`
 * function differs: the route wraps `createAnthropicProviderStream`, the
 * tests wrap a local fixture with no network or model calls.
 *
 * The wire is `@lostgradient/chat`'s `ChatStreamEvent` vocabulary, encoded by
 * its own `encodeChatStreamEvent` so this side can never emit a frame the
 * published decoder rejects. Every frame carries the `wireVersion: 1` +
 * `sequence` envelope, assigned by {@link createChatStreamWriter}; the three
 * legacy frames (`text`, `tool_call`, `tool_result`) keep their exact
 * pre-Operative shape underneath it, so a client that renders only those
 * (today's `session-controller.ts`) is unaffected by the wider vocabulary.
 */
import {
	AgentRunError,
	StepCompletedEvent,
	ToolErrorBubbleEvent,
	ToolPolicyDeniedBubbleEvent,
	ToolProgressBubbleEvent,
	ToolStartedBubbleEvent,
	ToolsExecutedEvent,
	createAgent,
	stopWhen,
	type AgentRun,
	type AgentRunErrorCode,
	type AgentRunErrorKind,
	type AnyToolbox,
	type ConversationHistory,
	type EnhancedStreamingOptions,
	type OperativeExecuteOptions,
	type StandaloneAgent,
	type StepResult,
	type StreamEvent,
	type StreamingGenerateFunction
} from '@lostgradient/operative';
import { withEnhancedStreaming } from '@lostgradient/operative/streaming';
import { encodeChatStreamEvent, type ChatStreamEvent } from '@lostgradient/chat';

import type { JSONValue, ToolExecutionResult, ToolResult } from 'armorer';

/**
 * One frame as the pump produces it — a `ChatStreamEvent` before the writer
 * stamps the envelope on. Distributive so every member of the union loses
 * exactly its two envelope keys and nothing else.
 */
export type ChatStreamFrame = ChatStreamEvent extends infer Member
	? Member extends ChatStreamEvent
		? Omit<Member, 'wireVersion' | 'sequence'>
		: never
	: never;

type ChatToolResult = Extract<ChatStreamEvent, { type: 'tool.settled' }>['result'];
type ChatSerializedRunError = Extract<ChatStreamEvent, { type: 'run.error' }>['error'];

/** The one supported wire version — must match `@lostgradient/chat`'s decoder. */
const WIRE_VERSION = 1;

/**
 * The request-scoped sink for one response body. Owns the two invariants the
 * reference architecture's wire contract puts on the producer: `sequence` is
 * strictly increasing from zero across EVERY frame (legacy and typed alike,
 * one counter), and nothing follows the single terminal `run.*` frame — a
 * late `stream:*` event from a listener that outlives the run, or a second
 * terminal from a defensive code path, is dropped here rather than reaching
 * the wire.
 */
export type ChatStreamWriter = {
	write(frame: ChatStreamFrame): void;
	/** True once a terminal `run.*` frame has been written. */
	readonly terminated: boolean;
};

export function createChatStreamWriter(sink: (line: string) => void): ChatStreamWriter {
	let sequence = 0;
	let terminated = false;
	return {
		write(frame) {
			if (terminated) return;
			// `encodeChatStreamEvent` re-projects and validates every field, so a
			// malformed frame throws HERE, at the producer, instead of decoding
			// as garbage on the client. The cast is the one place TypeScript
			// can't re-distribute the spread over the union on its own.
			//
			// The counter advances and the stream is marked terminated only
			// AFTER the line is encoded and sunk: a frame that throws never
			// reached the wire, so it must not consume a sequence number or
			// close the stream against the corrected frame that follows it.
			const line = encodeChatStreamEvent({
				...frame,
				wireVersion: WIRE_VERSION,
				sequence
			} as ChatStreamEvent);
			sink(line);
			sequence += 1;
			if (frame.type.startsWith('run.')) terminated = true;
		},
		get terminated() {
			return terminated;
		}
	};
}

/** The terminal, non-streamed outcome of a chat run — never written to the NDJSON body. */
export type ChatRunEnvelope =
	| { ok: true; status: 'completed'; content: string; output?: unknown }
	| {
			ok: false;
			status: string;
			error: { kind: AgentRunErrorKind; code: AgentRunErrorCode; message: string };
	  };

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
 * Values Operative types as `unknown` (`stream:tool-call-complete.arguments`,
 * every `error`) go through here before they are written. An `Error` becomes
 * its `{ name, message }` and NOTHING else — never `cause`, which for a
 * provider failure can be the raw HTTP response, credential headers
 * included, and never `stack`. Anything else round-trips through JSON,
 * which is exactly what the wire would do to it anyway, so the type is
 * honest rather than a cast.
 */
function toJSONValue(value: unknown): JSONValue {
	if (value instanceof Error) return { name: value.name, message: value.message };
	if (value === undefined) return null;
	return JSON.parse(JSON.stringify(value)) as JSONValue;
}

const STREAM_EVENT_TYPES = [
	'stream:block-start',
	'stream:block-delta',
	'stream:block-complete',
	'stream:text-delta',
	'stream:tool-call-start',
	'stream:tool-call-delta',
	'stream:tool-call-complete',
	'stream:usage',
	'stream:complete',
	'stream:error'
] as const satisfies readonly StreamEvent['type'][];

/**
 * Mirrors one Operative `StreamEvent` field-for-field onto the wire, only
 * projecting the two `unknown`-typed fields to JSON-safe values.
 */
function toStreamFrame(event: StreamEvent): ChatStreamFrame {
	switch (event.type) {
		case 'stream:tool-call-complete':
			return { ...event, arguments: toJSONValue(event.arguments) };
		case 'stream:error':
			return { type: 'stream:error', error: toJSONValue(event.error) };
		case 'stream:complete':
			// Operative's `StreamState` holds `readonly` block arrays; the wire
			// type owns mutable copies, so copy rather than alias.
			return {
				type: 'stream:complete',
				state: {
					...event.state,
					blocks: [...event.state.blocks],
					toolCalls: [...event.state.toolCalls]
				}
			};
		default:
			return event;
	}
}

/**
 * Builds the module-scoped-toolbox, request-local-writer agent for one
 * `/api/chat` request.
 *
 * The `TypedEventTarget` is created here rather than accepted, so the route
 * cannot accidentally share one across requests: every `stream:*` event the
 * wrapper dispatches goes straight to THIS request's writer. `liveToolCalls`
 * is what makes `stream:tool-call-start`/`-delta` arrive while the provider
 * response is still open — the streaming adapter calls
 * `streaming.report?.(...)` the moment it sees a tool-use block, and without
 * the option the wrapper installs no `report` and synthesizes both events
 * only after the response resolves.
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
	writer: ChatStreamWriter;
}): StandaloneAgent {
	// Operative's `TypedEventTarget` class is not a public export, only its
	// type (through `EnhancedStreamingOptions`); the wrapper dispatches via
	// plain `dispatchEvent`, so a bare `EventTarget` is the same object at
	// runtime — this cast only buys the typed `addEventListener` overloads.
	const eventTarget = new EventTarget() as NonNullable<EnhancedStreamingOptions['eventTarget']>;

	// Registered first so the legacy `text` frame precedes its typed mirror
	// on the wire — listeners fire in registration order — and the
	// legacy-only client sees each delta at the earliest sequence number.
	eventTarget.addEventListener('stream:text-delta', (event) => {
		options.writer.write({ type: 'text', text: event.detail.content });
	});
	for (const type of STREAM_EVENT_TYPES) {
		eventTarget.addEventListener(type, (event) => {
			options.writer.write(toStreamFrame(event.detail));
		});
	}

	return createAgent({
		generate: withEnhancedStreaming(options.generate, { eventTarget, liveToolCalls: true }),
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
export function classifyChatRunFailure(
	error: unknown,
	fallbackStatus: string
): Extract<ChatRunEnvelope, { ok: false }> {
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
 * Projects one authoritative `ToolExecutionResult` (from `tools.executed` /
 * `step.completed`) to the wire's `ChatToolResult`. Shared by the legacy
 * `tool_result` frame and the typed `tool.settled` frame so the two can
 * never disagree about a call's outcome.
 */
function toChatToolResult(
	result: ToolResult & Pick<ToolExecutionResult, 'pendingApproval'>
): ChatToolResult {
	return {
		callId: result.callId,
		outcome: result.outcome,
		content: result.content,
		...(result.error ? { error: result.error } : {}),
		...(result.action ? { action: result.action } : {}),
		...(result.pendingApproval ? { pendingApproval: toJSONValue(result.pendingApproval) } : {})
	};
}

/** The single terminal frame for a failed run, chosen by its finish reason. */
function toTerminalFailureFrame(
	envelope: Extract<ChatRunEnvelope, { ok: false }>,
	error: unknown
): ChatStreamFrame {
	if (envelope.status === 'aborted') return { type: 'run.aborted', reason: envelope.error.message };
	const serialized: ChatSerializedRunError = {
		name: error instanceof Error ? error.name : 'Error',
		...envelope.error
	};
	if (envelope.status === 'tripwire') return { type: 'run.tripwire', error: serialized };
	return { type: 'run.error', error: serialized };
}

/**
 * Consumes one `AgentRun`'s event stream, projecting tool lifecycle events
 * and each step's tool calls and results into `writer` as they happen, then
 * derives the ONE terminal `run.*` frame — and the envelope the route uses
 * to decide how to end the response — from `run.result()`.
 *
 * The terminal frame is derived from `run.result()`, not from Operative's
 * own `run.completed`/`run.error` events, because for a failed run Operative
 * fires BOTH (`run.error`, then `run.completed` with `finishReason: 'error'`)
 * — mirroring those would put two terminals on the wire. `run.result()` is
 * the one authoritative outcome, and the writer refuses a second terminal
 * regardless.
 *
 * `tool.settled` is sourced from `ToolsExecutedEvent.results` rather than
 * from Operative's `ToolSettledBubbleEvent` for two reasons verified against
 * 0.8.0: the bubble's `result` is the tool's RAW return value, not the
 * `ToolResult` the wire wants, and an approval-paused call never gets a
 * bubble at all — only `tools.executed` carries its `action_required`
 * result with the `pendingApproval` descriptor the client needs.
 *
 * `run.result()` is documented ("Any pending `result()` promise rejects with
 * an abort reason") to reject on abort, but empirically (verified against
 * the installed package directly) it RESOLVES for both an abort and a
 * generate failure, carrying `finishReason: 'aborted' | 'error'` and a real
 * `AgentRunError` on `.error`. The outer try/catch stays anyway as a genuine
 * defensive fallback — an escaped rejection here becomes an unhandled
 * promise rejection in the route's pump, the same hazard class the
 * pre-Operative loop's `'abort'` listener existed to prevent — so this
 * function is correct whichever path a given failure takes.
 */
export async function pumpChatRun(
	run: AgentRun,
	writer: ChatStreamWriter
): Promise<ChatRunEnvelope> {
	try {
		for await (const event of run) {
			if (event instanceof ToolStartedBubbleEvent) {
				writer.write({
					type: 'tool.started',
					toolCallId: event.toolCallId,
					toolName: event.toolName
				});
			} else if (event instanceof ToolProgressBubbleEvent) {
				writer.write({
					type: 'tool.progress',
					toolCallId: event.toolCallId,
					toolName: event.toolName,
					...(event.percent !== undefined ? { percent: event.percent } : {}),
					...(event.message !== undefined ? { message: event.message } : {})
				});
			} else if (event instanceof ToolErrorBubbleEvent) {
				writer.write({
					type: 'tool.error',
					toolCallId: event.toolCallId,
					toolName: event.toolName,
					error: toJSONValue(event.error)
				});
			} else if (event instanceof ToolPolicyDeniedBubbleEvent) {
				writer.write({
					type: 'tool.policy-denied',
					toolCallId: event.toolCallId,
					toolName: event.toolName,
					...(event.reason !== undefined ? { reason: event.reason } : {})
				});
			} else if (event instanceof ToolsExecutedEvent) {
				for (const result of event.results) {
					writer.write({
						type: 'tool.settled',
						toolCallId: result.toolCallId,
						toolName: result.toolName,
						result: toChatToolResult(result)
					});
				}
			} else if (event instanceof StepCompletedEvent) {
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
					writer.write({
						type: 'tool_call',
						id: toolCall.id,
						name: toolCall.name,
						arguments: toJSONValue(toolCall.arguments)
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
					writer.write({ type: 'tool_result', ...toChatToolResult(result) });
				}
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
			const envelope = classifyChatRunFailure(result.error, result.finishReason);
			writer.write(toTerminalFailureFrame(envelope, result.error));
			return envelope;
		}

		writer.write({
			type: 'run.completed',
			conversation: result.conversation.current,
			content: result.content,
			usage: result.usage,
			finishReason: result.finishReason
		});
		return {
			ok: true,
			status: 'completed',
			content: result.content,
			...('output' in result ? { output: result.output } : {})
		};
	} catch (cause) {
		const envelope = classifyChatRunFailure(cause, 'aborted');
		writer.write(toTerminalFailureFrame(envelope, cause));
		return envelope;
	}
}

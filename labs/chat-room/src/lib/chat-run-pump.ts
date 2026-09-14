import {
	StepCompletedEvent,
	ToolErrorBubbleEvent,
	ToolPolicyDeniedBubbleEvent,
	ToolProgressBubbleEvent,
	ToolStartedBubbleEvent,
	ToolsExecutedEvent,
	type AgentRun,
	type ConversationHistory
} from '@lostgradient/operative';
import type { ChatStreamEvent } from '@lostgradient/chat';
import type { JSONValue, ToolExecutionResult, ToolResult } from 'armorer';
import {
	type ChatRunEnvelope,
	type ChatSerializedRunError,
	type ChatStreamFrame,
	type ChatStreamWriter,
	classifyChatRunFailure,
	SAFE_CHAT_FAILURE_MESSAGE
} from './chat-agent.ts';
import { serverOwnedPersistenceFailureHint } from './server-owned-snapshot.ts';

type ChatToolResult = Extract<ChatStreamEvent, { type: 'tool.settled' }>['result'];
const FAILURE_FINISH_REASONS = new Set([
	'error',
	'aborted',
	'tripwire',
	'budget-exceeded',
	'elicitation-denied',
	'maximum-steps'
]);
function toJSONValue(value: unknown): JSONValue {
	if (value instanceof Error) return { name: value.name, message: value.message };
	if (value === undefined) return null;
	return JSON.parse(JSON.stringify(value)) as JSONValue;
}

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

function toTerminalFailureFrame(
	envelope: Extract<ChatRunEnvelope, { ok: false }>
): ChatStreamFrame {
	if (envelope.status === 'aborted') return { type: 'run.aborted', reason: envelope.error.message };
	const serialized: ChatSerializedRunError = {
		name: 'Error',
		...envelope.error
	};
	serialized.message =
		serialized.message === 'The turn outcome could not be saved.'
			? serialized.message
			: SAFE_CHAT_FAILURE_MESSAGE;
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
 * from Operative's `ToolSettledBubbleEvent` for two reasons originally verified against
 * 0.8.0 and retained by the current installed-package regression suite: the bubble's `result` is the tool's RAW return value, not the
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
	writer: ChatStreamWriter,
	options: {
		beforeFailure?: (input: {
			conversation: ConversationHistory;
			error: ChatSerializedRunError;
		}) => Promise<void>;
	} = {}
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
					if (result) {
						writer.write({ type: 'tool_result', ...toChatToolResult(result) });
						continue;
					}

					// A CALL WITH NO RESULT STILL GETS ONE, and this used to be a
					// bare `continue`.
					//
					// The client renders a pending tool row from the `tool_call`
					// frame above and settles it on a result, and the session
					// controller treats a call without one as unresolved — so
					// skipping here left that row pending until another turn or a
					// reload cleared it. There was no frame saying what happened,
					// because from the wire's point of view nothing had.
					//
					// A step reaches this state whenever a `beforeToolExecution`
					// hook filters a call out: Operative seals it in the
					// CONVERSATION, so a later replay is intact, but dispatches no
					// event. The server-owned family's approval gate is the first
					// caller here to do that deliberately, and a gate whose "no" is
					// invisible is worse than no gate.
					//
					// Reported as an ERROR outcome rather than a success carrying a
					// refusal, because the tool did not run. The wording stays
					// generic on purpose: this is the pump, which knows a result is
					// missing but not why, and a message naming approval would be
					// wrong for every other cause.
					const syntheticResult: ChatToolResult = {
						callId: toolCall.id,
						outcome: 'error',
						content: 'This call did not run, and reported no result.'
					};
					writer.write({
						type: 'tool.settled',
						toolCallId: toolCall.id,
						toolName: toolCall.name,
						result: syntheticResult
					});
					writer.write({ type: 'tool_result', ...syntheticResult });
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
			let envelope = classifyChatRunFailure(result.error, result.finishReason);
			if (envelope.status !== 'aborted' && options.beforeFailure !== undefined) {
				const serialized: ChatSerializedRunError = {
					name: result.error instanceof Error ? result.error.name : 'Error',
					...envelope.error
				};
				try {
					await options.beforeFailure({
						conversation: result.conversation.current,
						error: serialized
					});
				} catch {
					const failedUserMessageId = [...result.conversation.current.ids]
						.reverse()
						.find((messageId) => result.conversation.current.messages[messageId]?.role === 'user');
					if (failedUserMessageId !== undefined && failedUserMessageId.length > 0) {
						writer.write({
							type: 'stream:error',
							error: serverOwnedPersistenceFailureHint(failedUserMessageId) as JSONValue
						});
					}
					envelope = {
						ok: false,
						status: 'error',
						error: {
							kind: 'generate',
							code: 'UNKNOWN',
							message: 'The turn outcome could not be saved.',
							retryable: false
						}
					};
				}
			}
			writer.write(toTerminalFailureFrame(envelope));
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
		writer.write(toTerminalFailureFrame(envelope));
		return envelope;
	}
}

import { describe, expect, test } from 'bun:test';
import {
	AgentRunError,
	AbortAgentRunError,
	StandardSchemaValidationError,
	createAgent,
	stopWhen,
	type EnhancedStreamingOptions,
	type StreamingGenerateFunction
} from '@lostgradient/operative';
import { withEnhancedStreaming } from '@lostgradient/operative/streaming';
import { createTool, createToolbox, type AnyToolbox, type ToolRequestContext } from 'armorer';
import { appendUserMessage, createConversationHistory } from '@lostgradient/chat';
import { z } from 'zod';

import {
	classifyChatRunFailure,
	createChatAgent,
	createChatStreamWriter,
	pumpChatRun,
	startChatRun
} from './chat-agent';

import type { ChatStreamEvent } from '@lostgradient/chat';

/**
 * Deterministic unit tests for the Operative-backed agent loop. Every
 * `generate` function here is hand-written and local — zero model or network
 * calls, per CIN-434. `test:unit` runs this file (see `package.json`).
 */

const requestContext: ToolRequestContext = {
	authority: {
		principalId: 'test-user',
		tenantId: 'test-tenant',
		ownerId: 'test-session',
		capabilities: [],
		authorizationRevision: '1'
	},
	audience: 'tenant',
	agentId: 'test-assistant',
	runId: 'test-run'
};

function freshEventTarget(): NonNullable<EnhancedStreamingOptions['eventTarget']> {
	return new EventTarget() as unknown as NonNullable<EnhancedStreamingOptions['eventTarget']>;
}

function conversationWith(userText: string) {
	return appendUserMessage(
		createConversationHistory({ id: `test-${crypto.randomUUID()}` }),
		userText
	);
}

const LEGACY_TYPES = new Set(['text', 'tool_call', 'tool_result']);
const TERMINAL_TYPES = new Set(['run.completed', 'run.error', 'run.tripwire', 'run.aborted']);

/** Parses the NDJSON lines the writer produced back into frames. */
function decodeLines(lines: string[]): ChatStreamEvent[] {
	return lines.map((line) => {
		if (!line.endsWith('\n')) throw new Error(`frame is not newline-terminated: ${line}`);
		return JSON.parse(line) as ChatStreamEvent;
	});
}

/** The three frames the client renders today, stripped of their envelope. */
function legacyFrames(frames: ChatStreamEvent[]): Array<Record<string, unknown>> {
	return frames
		.filter((frame) => LEGACY_TYPES.has(frame.type))
		.map((frame) => {
			const stripped: Record<string, unknown> = { ...frame };
			delete stripped['wireVersion'];
			delete stripped['sequence'];
			return stripped;
		});
}

function ofType<T extends ChatStreamEvent['type']>(
	frames: ChatStreamEvent[],
	type: T
): Array<Extract<ChatStreamEvent, { type: T }>> {
	return frames.filter(
		(frame): frame is Extract<ChatStreamEvent, { type: T }> => frame.type === type
	);
}

/**
 * Every frame carries the envelope, `sequence` is strictly increasing from
 * zero, and exactly one terminal `run.*` frame closes the stream — the
 * reference architecture's stream wire contract, asserted on every run.
 */
function expectWellFormedWire(frames: ChatStreamEvent[]): void {
	frames.forEach((frame, index) => {
		expect(frame.wireVersion).toBe(1);
		expect(frame.sequence).toBe(index);
	});
	const terminals = frames.filter((frame) => TERMINAL_TYPES.has(frame.type));
	expect(terminals).toHaveLength(1);
	expect(frames.at(-1)).toBe(terminals[0]);
}

async function runAndCollect(
	generate: StreamingGenerateFunction,
	toolbox: AnyToolbox = createToolbox([]),
	lines: string[] = []
): Promise<{ frames: ChatStreamEvent[]; envelope: Awaited<ReturnType<typeof pumpChatRun>> }> {
	// Mirrors the route exactly: one request-local writer feeds both the
	// `stream:*` forwarding `createChatAgent` installs and the `tool.*`/`run.*`
	// frames `pumpChatRun` emits, so this collects the same bytes the wire sees.
	const writer = createChatStreamWriter((line) => lines.push(line));
	const agent = createChatAgent({ generate, toolbox, requestContext, writer });
	const run = startChatRun(agent, conversationWith('hello'));
	const envelope = await pumpChatRun(run, writer);
	const frames = decodeLines(lines);
	expectWellFormedWire(frames);
	return { frames, envelope };
}

describe('pumpChatRun: completed success', () => {
	test('streams text deltas and resolves ok:true with the final content', async () => {
		// `streaming.update(text)` takes the FULL accumulated text so far, not a
		// delta — `withEnhancedStreaming` diffs each call against the previous one
		// internally to compute the `stream:text-delta` event's `content` field
		// (see `node_modules/@lostgradient/operative/dist/streaming-*.js`). So the
		// second call below is the whole string again, and the SECOND `text` frame
		// this test asserts is only the new suffix ("there!"), not a repeat of the
		// first.
		const generate: StreamingGenerateFunction = async ({ streaming }) => {
			streaming.update('Hello ');
			streaming.update('Hello there!');
			return { content: 'Hello there!', toolCalls: [] };
		};

		const { frames, envelope } = await runAndCollect(generate);

		expect(legacyFrames(frames)).toEqual([
			{ type: 'text', text: 'Hello ' },
			{ type: 'text', text: 'there!' }
		]);
		expect(envelope).toEqual({ ok: true, status: 'completed', content: 'Hello there!' });
	});

	test('mirrors every text delta as a typed stream:text-delta frame with the accumulated text', async () => {
		const generate: StreamingGenerateFunction = async ({ streaming }) => {
			streaming.update('Hello ');
			streaming.update('Hello there!');
			return { content: 'Hello there!', toolCalls: [] };
		};

		const { frames } = await runAndCollect(generate);

		expect(
			ofType(frames, 'stream:text-delta').map(({ content, accumulated }) => ({
				content,
				accumulated
			}))
		).toEqual([
			{ content: 'Hello ', accumulated: 'Hello ' },
			{ content: 'there!', accumulated: 'Hello there!' }
		]);
		// The legacy `text` frame is written first so a client that renders only
		// the legacy vocabulary sees the delta at the earliest sequence number.
		const firstText = frames.findIndex((frame) => frame.type === 'text');
		const firstDelta = frames.findIndex((frame) => frame.type === 'stream:text-delta');
		expect(firstText).toBeLessThan(firstDelta);
		// Block lifecycle and completion events ride along, field for field.
		expect(ofType(frames, 'stream:block-start')).toHaveLength(1);
		expect(ofType(frames, 'stream:block-complete')).toHaveLength(1);
		expect(ofType(frames, 'stream:complete')[0]?.state.textContent).toBe('Hello there!');
	});

	test('closes with exactly one run.completed frame carrying the final conversation', async () => {
		const generate: StreamingGenerateFunction = async ({ streaming }) => {
			streaming.update('done');
			return {
				content: 'done',
				toolCalls: [],
				usage: { prompt: 3, completion: 1, total: 4 }
			};
		};

		const { frames } = await runAndCollect(generate);

		const completed = ofType(frames, 'run.completed');
		expect(completed).toHaveLength(1);
		const [frame] = completed;
		expect(frame?.content).toBe('done');
		expect(frame?.finishReason).toBe('stop-condition');
		expect(frame?.usage).toEqual({ prompt: 3, completion: 1, total: 4 });
		// The conversation is the plain `ConversationHistory` snapshot, not the
		// `Conversation` class instance Operative hands back, and it already
		// contains the assistant reply.
		const history = frame?.conversation;
		expect(history?.ids).toHaveLength(2);
		const lastId = history?.ids.at(-1) ?? '';
		expect(history?.messages[lastId]?.role).toBe('assistant');
	});
});

describe('pumpChatRun: provider failure', () => {
	test('surfaces kind: "generate" when the provider throws', async () => {
		const generate: StreamingGenerateFunction = async () => {
			throw new Error('simulated provider failure');
		};

		const { frames, envelope } = await runAndCollect(generate);

		expect(envelope.ok).toBe(false);
		if (envelope.ok) throw new Error('unreachable');
		expect(envelope.error.kind).toBe('generate');
		expect(envelope.error.message).toContain('simulated provider failure');

		// One terminal frame, even though Operative fires `run.error` AND a
		// `run.completed` (finishReason 'error') for the same failure — verified
		// against 0.8.0 directly. The frame is a serialized run error with no
		// `cause`: the reference architecture's error contract forbids forwarding
		// it, since it can carry a credential-bearing provider response.
		const [terminal] = ofType(frames, 'run.error');
		expect(terminal?.error.kind).toBe('generate');
		expect(terminal?.error.message).toContain('simulated provider failure');
		expect(terminal?.error).not.toHaveProperty('cause');
		expect(ofType(frames, 'run.completed')).toHaveLength(0);
	});

	test('a stream:error raised by the wrapper is forwarded with a JSON-safe error, never the cause', async () => {
		// `withEnhancedStreaming` dispatches `stream:error` from its own catch
		// when `generate` throws — with the thrown value itself as `error`.
		// Model a provider failure whose `cause` is a credential-bearing
		// response: neither it nor the stack may reach the wire.
		const generate: StreamingGenerateFunction = async () => {
			throw new Error('provider exploded', {
				cause: { headers: { authorization: 'Bearer sk-secret' } }
			});
		};

		const { frames } = await runAndCollect(generate);

		const [streamError] = ofType(frames, 'stream:error');
		expect(streamError?.error).toEqual({ name: 'Error', message: 'provider exploded' });
		expect(JSON.stringify(frames)).not.toContain('sk-secret');
		expect(ofType(frames, 'run.error')).toHaveLength(1);
	});
});

describe('pumpChatRun: aborted request', () => {
	test('surfaces kind: "abort" when the run is aborted mid-generate', async () => {
		// Deterministic coordination, not a wall-clock delay: the generate
		// function resolves `abortListenerReady` the instant its own abort
		// listener is registered, and the test awaits that signal before calling
		// `run.abort()` — so the abort always lands after the listener exists,
		// with no timing threshold to tune or race.
		let signalAbortListenerReady: () => void;
		const abortListenerReady = new Promise<void>((resolve) => {
			signalAbortListenerReady = resolve;
		});
		const generate: StreamingGenerateFunction = (context) =>
			new Promise((_resolve, reject) => {
				context.signal?.addEventListener('abort', () => reject(new Error('generate aborted')));
				signalAbortListenerReady();
			});

		const lines: string[] = [];
		const writer = createChatStreamWriter((line) => lines.push(line));
		const agent = createChatAgent({ generate, toolbox: createToolbox([]), requestContext, writer });
		const run = startChatRun(agent, conversationWith('hello'));

		await abortListenerReady;
		run.abort('test abort');

		const envelope = await pumpChatRun(run, writer);

		expect(envelope.ok).toBe(false);
		if (envelope.ok) throw new Error('unreachable');
		expect(envelope.error.kind).toBe('abort');
		expect(envelope.error.code).toBe('ABORTED');

		const frames = decodeLines(lines);
		expectWellFormedWire(frames);
		expect(frames.at(-1)).toMatchObject({ type: 'run.aborted' });
	});
});

describe('pumpChatRun: roll_dice tool path', () => {
	const rollDice = createTool({
		name: 'roll_dice',
		version: '1.0.0',
		description: 'Roll one die and always return 4 — deterministic, for tests.',
		input: z.object({ sides: z.number().int(), count: z.number().int() }),
		async execute() {
			return { rolls: [4], total: 4 };
		}
	});

	// The run stops right after the tool step — see `stopAfterAnyToolCall` in
	// `chat-agent.ts` — so this request never reaches a second `generate` call
	// for a follow-up reply. `generate` below asserts that by throwing if it is
	// ever invoked a second time: the pre-Operative contract this restores has
	// the client's existing continuation loop (`packages/chat`'s
	// `createChatSessionController`) re-POST for the follow-up instead.
	test('emits a tool_call then a tool_result carrying 4, and stops without generating a follow-up', async () => {
		let calls = 0;
		const generate: StreamingGenerateFunction = async () => {
			calls += 1;
			if (calls > 1) throw new Error('generate should not be called a second time in this run');
			return {
				content: '',
				toolCalls: [{ id: 'call-1', name: 'roll_dice', arguments: { sides: 6, count: 1 } }]
			};
		};

		const { frames, envelope } = await runAndCollect(generate, createToolbox([rollDice]));

		expect(legacyFrames(frames)).toEqual([
			{ type: 'tool_call', id: 'call-1', name: 'roll_dice', arguments: { sides: 6, count: 1 } },
			{
				type: 'tool_result',
				callId: 'call-1',
				outcome: 'success',
				content: { rolls: [4], total: 4 }
			}
		]);
		expect(envelope).toEqual({ ok: true, status: 'completed', content: '' });
		expect(calls).toBe(1);
	});

	test('emits tool.started then tool.settled keyed by toolCallId, with the result as a ChatToolResult', async () => {
		const generate: StreamingGenerateFunction = async () => ({
			content: '',
			toolCalls: [{ id: 'call-1', name: 'roll_dice', arguments: { sides: 6, count: 1 } }]
		});

		const { frames } = await runAndCollect(generate, createToolbox([rollDice]));

		expect(
			ofType(frames, 'tool.started').map(({ toolCallId, toolName }) => ({ toolCallId, toolName }))
		).toEqual([{ toolCallId: 'call-1', toolName: 'roll_dice' }]);
		const settled = ofType(frames, 'tool.settled');
		expect(settled).toHaveLength(1);
		expect(settled[0]).toMatchObject({
			toolCallId: 'call-1',
			toolName: 'roll_dice',
			result: { callId: 'call-1', outcome: 'success', content: { rolls: [4], total: 4 } }
		});
		const order = frames.map((frame) => frame.type);
		expect(order.indexOf('tool.started')).toBeLessThan(order.indexOf('tool.settled'));
		// The typed completion of the tool-call block rides along with parsed arguments.
		expect(ofType(frames, 'stream:tool-call-complete')[0]).toMatchObject({
			toolName: 'roll_dice',
			arguments: { sides: 6, count: 1 }
		});
	});

	test('forwards stream:tool-call-start/-delta the moment the generate function reports them', async () => {
		const lines: string[] = [];
		let liveFramesWhenReported = -1;
		const generate: StreamingGenerateFunction = async ({ streaming }) => {
			streaming.report?.({
				type: 'stream:tool-call-start',
				toolName: 'roll_dice',
				blockId: 'toolu_1'
			});
			streaming.report?.({
				type: 'stream:tool-call-delta',
				toolName: 'roll_dice',
				blockId: 'toolu_1',
				partialArguments: '{"sides": 6'
			});
			// Captured BEFORE this function resolves: the frames are on the wire
			// while the provider response is still open, which is the whole point
			// of `liveToolCalls`.
			liveFramesWhenReported = decodeLines(lines).filter((frame) =>
				frame.type.startsWith('stream:tool-call-')
			).length;
			return {
				content: '',
				toolCalls: [{ id: 'toolu_1', name: 'roll_dice', arguments: { sides: 6, count: 1 } }]
			};
		};

		const { frames } = await runAndCollect(generate, createToolbox([rollDice]), lines);

		expect(liveFramesWhenReported).toBe(2);
		expect(ofType(frames, 'stream:tool-call-start')[0]).toMatchObject({
			toolName: 'roll_dice',
			blockId: 'toolu_1'
		});
		expect(ofType(frames, 'stream:tool-call-delta')[0]).toMatchObject({
			blockId: 'toolu_1',
			partialArguments: '{"sides": 6'
		});
		// With live reporting the block id IS the provider's tool-call id, so the
		// mid-stream frames and the later `tool.*` frames correlate directly.
		expect(ofType(frames, 'tool.started')[0]?.toolCallId).toBe('toolu_1');
	});

	test('an invalid tool call settles as an error with a JSON-safe tool.error, never the raw cause', async () => {
		const generate: StreamingGenerateFunction = async () => ({
			content: '',
			toolCalls: [{ id: 'call-bad', name: 'roll_dice', arguments: { sides: 'six' } }]
		});

		const { frames } = await runAndCollect(generate, createToolbox([rollDice]));

		const [toolError] = ofType(frames, 'tool.error');
		expect(toolError).toMatchObject({ toolCallId: 'call-bad', toolName: 'roll_dice' });
		expect(toolError?.error).toMatchObject({ name: 'ZodError', message: expect.any(String) });
		expect(ofType(frames, 'tool.settled')[0]).toMatchObject({
			toolCallId: 'call-bad',
			result: { callId: 'call-bad', outcome: 'error' }
		});
		expect(legacyFrames(frames).at(-1)).toMatchObject({ type: 'tool_result', outcome: 'error' });
	});

	test('an approval-gated call settles as action_required with the pending approval descriptor', async () => {
		const rememberNote = createTool({
			name: 'remember_note',
			version: '1.0.0',
			description: 'Save a note — approval-gated.',
			input: z.object({ text: z.string() }),
			policy: { beforeExecute: () => ({ status: 'needs_approval', reason: 'Save this note?' }) },
			async execute({ text }) {
				return { saved: true, text };
			}
		});
		const generate: StreamingGenerateFunction = async () => ({
			content: '',
			toolCalls: [{ id: 'call-note', name: 'remember_note', arguments: { text: 'milk' } }]
		});

		const { frames } = await runAndCollect(
			generate,
			createToolbox([rememberNote], { approvalSecret: 'test-secret' })
		);

		// Operative never emits a `tool.settled` bubble for a paused call — the
		// authoritative result only appears on `tools.executed` — so the frame
		// has to be sourced from there, and this pins that it is.
		const [settled] = ofType(frames, 'tool.settled');
		expect(settled).toMatchObject({
			toolCallId: 'call-note',
			toolName: 'remember_note',
			result: {
				callId: 'call-note',
				outcome: 'action_required',
				action: { type: 'approval', message: 'Save this note?' }
			}
		});
		expect(settled?.result.pendingApproval).toBeDefined();
		expect(legacyFrames(frames).at(-1)).toMatchObject({
			type: 'tool_result',
			outcome: 'action_required'
		});
	});
});

describe('createChatStreamWriter', () => {
	test('envelopes every frame with wireVersion 1 and a strictly increasing sequence', () => {
		const lines: string[] = [];
		const writer = createChatStreamWriter((line) => lines.push(line));
		writer.write({ type: 'text', text: 'a' });
		writer.write({ type: 'tool.started', toolCallId: 'c', toolName: 't' });
		expect(decodeLines(lines)).toEqual([
			{ type: 'text', text: 'a', wireVersion: 1, sequence: 0 },
			{ type: 'tool.started', toolCallId: 'c', toolName: 't', wireVersion: 1, sequence: 1 }
		]);
	});

	test('drops everything after the first terminal frame', () => {
		const lines: string[] = [];
		const writer = createChatStreamWriter((line) => lines.push(line));
		writer.write({ type: 'run.aborted', reason: 'stop' });
		expect(writer.terminated).toBe(true);
		writer.write({ type: 'text', text: 'late' });
		writer.write({
			type: 'run.error',
			error: { name: 'E', message: 'm', kind: 'generate', code: 'UNKNOWN' }
		});
		expect(decodeLines(lines).map((frame) => frame.type)).toEqual(['run.aborted']);
	});
});

describe('classifyChatRunFailure', () => {
	test('maps an AgentRunError to its kind/code/message', () => {
		const error = new AgentRunError('boom', { kind: 'policy', code: 'TRIPWIRE' });
		const envelope = classifyChatRunFailure(error, 'error');
		expect(envelope).toEqual({
			ok: false,
			status: 'error',
			error: { kind: 'policy', code: 'TRIPWIRE', message: 'boom' }
		});
	});

	test('routes kind: "abort" to status "aborted" regardless of fallbackStatus', () => {
		const error = new AbortAgentRunError('stopped');
		const envelope = classifyChatRunFailure(error, 'error');
		expect(envelope).toEqual({
			ok: false,
			status: 'aborted',
			error: { kind: 'abort', code: 'ABORTED', message: 'stopped' }
		});
	});

	// Pins CIN-434's confirmed fact: output-validation failures are an
	// `AgentRunError` with `kind: 'output'`, `code: 'INVALID_OUTPUT'` — there is
	// no separate `OutputValidationError`. `StandardSchemaValidationError` is
	// the concrete class Operative throws for this (from `AgentRun.output()` /
	// `.unwrap()`, not from `run.result()` — see the doc comment on
	// `classifyChatRunFailure`), so constructing one directly here exercises
	// the real shape rather than a hand-rolled stand-in.
	test('maps a StandardSchemaValidationError to kind: "output", code: "INVALID_OUTPUT"', () => {
		const error = new StandardSchemaValidationError([{ message: 'expected an object' }]);
		const envelope = classifyChatRunFailure(error, 'error');
		expect(envelope.ok).toBe(false);
		if (envelope.ok) throw new Error('unreachable');
		expect(envelope.error.kind).toBe('output');
		expect(envelope.error.code).toBe('INVALID_OUTPUT');
	});

	// The route branches on `error.kind === 'abort'` to choose between closing
	// the stream cleanly and calling `controller.error(...)`. `0.7.0` resolves
	// `result()` on abort, so this rejection path is not exercised today — but
	// Operative documents `result()` as REJECTING on abort, so a version that
	// follows its own documentation, or that surfaces the signal's own
	// `DOMException` instead of an `AgentRunError`, must not turn a user
	// pressing "stop generating" into an error banner they never caused.
	test('classifies a non-AgentRunError rejection on the abort path as an abort', () => {
		const envelope = classifyChatRunFailure(new Error('The operation was aborted'), 'aborted');
		expect(envelope).toEqual({
			ok: false,
			status: 'aborted',
			error: { kind: 'abort', code: 'ABORTED', message: 'The operation was aborted' }
		});
	});

	test('classifies a non-Error rejection on the abort path as an abort', () => {
		expect(classifyChatRunFailure('stopped', 'aborted')).toMatchObject({
			status: 'aborted',
			error: { kind: 'abort' }
		});
	});

	test('falls back to kind: "generate" for a plain, unclassified error', () => {
		const envelope = classifyChatRunFailure(new Error('network blip'), 'error');
		expect(envelope).toEqual({
			ok: false,
			status: 'error',
			error: { kind: 'generate', code: 'UNKNOWN', message: 'network blip' }
		});
	});
});

// Sanity check that `createAgent`/`withEnhancedStreaming` (the primitives
// `createChatAgent` composes) are wired the way this file assumes — a
// regression in `createChatAgent`'s own composition would still pass the
// tests above if it happened to swap in equivalent-looking pieces, so this
// exercises `createAgent` directly with the same `stopWhen` combination.
describe('createChatAgent composition', () => {
	test('the production stopWhen combination still stops a plain text-only run at step 1', async () => {
		const generate: StreamingGenerateFunction = async ({ streaming }) => {
			streaming.update('done');
			return { content: 'done', toolCalls: [] };
		};
		const agent = createAgent({
			generate: withEnhancedStreaming(generate, { eventTarget: freshEventTarget() }),
			toolbox: createToolbox([]),
			executeOptions: { requestContext },
			stopWhen: [
				stopWhen.noToolCalls(),
				stopWhen.pendingApproval(),
				(step) => step.toolCalls.length > 0
			]
		});
		const result = await agent.run({ conversation: conversationWith('hi') }).result();
		expect(result.finishReason).toBe('stop-condition');
		expect(result.content).toBe('done');
	});
});

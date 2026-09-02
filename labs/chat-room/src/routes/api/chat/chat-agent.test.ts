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
	pumpChatRun,
	startChatRun,
	type ChatStreamFrame
} from './chat-agent';

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

async function runAndCollect(
	generate: StreamingGenerateFunction,
	toolbox: AnyToolbox = createToolbox([])
): Promise<{ frames: ChatStreamFrame[]; envelope: Awaited<ReturnType<typeof pumpChatRun>> }> {
	// Mirrors the route: `createChatAgent` never wires the text-delta listener
	// itself, so the caller attaches it to the exact `eventTarget` instance it
	// hands to `createChatAgent` — the same request-local pattern `+server.ts`
	// follows.
	const eventTarget = freshEventTarget();
	const frames: ChatStreamFrame[] = [];
	eventTarget.addEventListener('stream:text-delta', (event) => {
		frames.push({ type: 'text', text: event.detail.content });
	});

	const agent = createChatAgent({ generate, toolbox, requestContext, eventTarget });
	const run = startChatRun(agent, conversationWith('hello'));
	const envelope = await pumpChatRun(run, (frame) => frames.push(frame));
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

		expect(frames).toEqual([
			{ type: 'text', text: 'Hello ' },
			{ type: 'text', text: 'there!' }
		]);
		expect(envelope).toEqual({ ok: true, status: 'completed', content: 'Hello there!' });
	});
});

describe('pumpChatRun: provider failure', () => {
	test('surfaces kind: "generate" when the provider throws', async () => {
		const generate: StreamingGenerateFunction = async () => {
			throw new Error('simulated provider failure');
		};

		const { envelope } = await runAndCollect(generate);

		expect(envelope.ok).toBe(false);
		if (envelope.ok) throw new Error('unreachable');
		expect(envelope.error.kind).toBe('generate');
		expect(envelope.error.message).toContain('simulated provider failure');
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

		const agent = createChatAgent({
			generate,
			toolbox: createToolbox([]),
			requestContext,
			eventTarget: freshEventTarget()
		});
		const run = startChatRun(agent, conversationWith('hello'));

		await abortListenerReady;
		run.abort('test abort');

		const envelope = await pumpChatRun(run, () => {});

		expect(envelope.ok).toBe(false);
		if (envelope.ok) throw new Error('unreachable');
		expect(envelope.error.kind).toBe('abort');
		expect(envelope.error.code).toBe('ABORTED');
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

		expect(frames).toEqual([
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

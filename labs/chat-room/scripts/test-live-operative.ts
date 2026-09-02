#!/usr/bin/env bun
/**
 * Exactly one real request against the live Anthropic API, through the same
 * `createChatAgent`/`startChatRun`/`pumpChatRun` pump `/api/chat` uses in
 * production — no `ANTHROPIC_BASE_URL` override, no fixture.
 *
 * Deliberately NOT wired into `test`, `test:unit`, or any CI-invoked script:
 * it costs real money and needs a real, server-only `ANTHROPIC_API_KEY`. Run
 * it by hand (`bun run test:live-operative`) only in an environment that
 * already has that credential available as an environment variable — this
 * script reads it but never logs, prints, or otherwise echoes its value.
 */
import { createAnthropicProviderStream } from '@lostgradient/operative/anthropic';
import { createToolbox } from 'armorer';
import { appendUserMessage, createConversationHistory } from '@lostgradient/chat';

import {
	createChatAgent,
	pumpChatRun,
	startChatRun,
	type ChatStreamFrame
} from '../src/routes/api/chat/chat-agent';

import type { EnhancedStreamingOptions } from '@lostgradient/operative';

const MODEL = 'claude-sonnet-5';
const MAX_TOKENS = 256;

async function main(): Promise<void> {
	const apiKey = process.env['ANTHROPIC_API_KEY'];

	if (!apiKey) {
		console.error('test:live-operative requires ANTHROPIC_API_KEY in the environment.');
		process.exitCode = 1;
		return;
	}

	const toolbox = createToolbox([]);
	const eventTarget = new EventTarget() as unknown as NonNullable<
		EnhancedStreamingOptions['eventTarget']
	>;

	const frames: ChatStreamFrame[] = [];
	// `createChatAgent` never wires this listener itself — the caller attaches
	// it to the exact `eventTarget` instance passed in, same as `+server.ts`
	// and `chat-agent.test.ts`. Without it this script would report success
	// on a run that silently dropped every text delta.
	eventTarget.addEventListener('stream:text-delta', (event) => {
		frames.push({ type: 'text', text: event.detail.content });
	});

	const agent = createChatAgent({
		generate: createAnthropicProviderStream({ model: MODEL, maximumTokens: MAX_TOKENS, apiKey }),
		toolbox,
		requestContext: {
			authority: {
				principalId: 'live-operative-check',
				tenantId: 'chat-room',
				ownerId: 'live-operative-check',
				capabilities: [],
				authorizationRevision: '1'
			},
			audience: 'tenant',
			agentId: 'chat-room-assistant',
			runId: 'live-operative-check'
		},
		eventTarget
	});

	const conversation = appendUserMessage(
		createConversationHistory({ id: 'live-operative-check' }),
		'Reply with exactly the word: pong'
	);

	const run = startChatRun(agent, conversation);
	let envelope: Awaited<ReturnType<typeof pumpChatRun>>;
	try {
		envelope = await pumpChatRun(run, (frame) => frames.push(frame));
	} finally {
		// Same best-effort teardown the route performs, so this check exercises
		// production's cleanup path too and never leaves provider-side resources
		// hanging on a failed run.
		try {
			run[Symbol.dispose]();
		} catch {
			// The run is ending either way; a disposal failure has nothing left to attach to.
		}
	}

	if (!envelope.ok) {
		console.error(
			`test:live-operative failed: status=${envelope.status} kind=${envelope.error.kind} code=${envelope.error.code}`
		);
		process.exitCode = 1;
		return;
	}

	if (envelope.status !== 'completed') {
		console.error(`test:live-operative expected status "completed", got "${envelope.status}".`);
		process.exitCode = 1;
		return;
	}

	// A "completed" envelope whose content doesn't actually satisfy the
	// prompt — or with the streaming path silently dropping every delta while
	// `envelope.content` still comes through some other way — is exactly the
	// failure mode a status-only (or merely non-empty) check would miss.
	// `envelope.content` (the run's own accumulated text) and the assembled
	// `stream:text-delta` frames (what the listener above actually observed)
	// are two independent sources, so both are checked against the requested
	// reply, not just against each other.
	const textFrames = frames.filter((frame) => frame.type === 'text');
	const assembledFromFrames = textFrames.map((frame) => frame.text).join('');
	const expectedSubstring = 'pong';

	if (!envelope.content.toLowerCase().includes(expectedSubstring)) {
		console.error(
			`test:live-operative failed: envelope.content did not contain "${expectedSubstring}" — got ${JSON.stringify(envelope.content)}.`
		);
		process.exitCode = 1;
		return;
	}

	if (textFrames.length === 0 || !assembledFromFrames.toLowerCase().includes(expectedSubstring)) {
		console.error(
			`test:live-operative failed: the streamed stream:text-delta frames did not assemble into text containing "${expectedSubstring}" — got ${JSON.stringify(assembledFromFrames)} across ${textFrames.length} frame(s). The streaming path may be dropping deltas even though the run completed.`
		);
		process.exitCode = 1;
		return;
	}

	console.log(
		`test:live-operative OK — reached status: 'completed' with content containing "${expectedSubstring}" across ${textFrames.length} text frame(s).`
	);
}

await main();

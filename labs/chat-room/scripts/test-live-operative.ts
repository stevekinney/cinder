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
	createChatStreamWriter,
	pumpChatRun,
	startChatRun
} from '../src/routes/api/chat/chat-agent';

import { decodeChatStreamEvent, type ChatStreamEvent } from '@lostgradient/chat';

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

	// The same writer the route builds, reading back what actually went on the
	// wire: every line is decoded with the published decoder, so this check
	// fails if the run emits a frame the client would reject.
	const frames: ChatStreamEvent[] = [];
	const writer = createChatStreamWriter((line) => {
		frames.push(decodeChatStreamEvent(line));
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
		writer
	});

	const conversation = appendUserMessage(
		createConversationHistory({ id: 'live-operative-check' }),
		'Reply with exactly the word: pong'
	);

	const run = startChatRun(agent, conversation);
	// Disposed even when the pump throws, so a failed live check cannot leave
	// a provider connection open. `Symbol.dispose` is the same mechanism the
	// route's `finally` uses; `.finally` rather than a `try` block so the
	// envelope keeps its discriminated-union narrowing below.
	const envelope = await pumpChatRun(run, writer).finally(() => {
		try {
			run[Symbol.dispose]();
		} catch {
			// Best effort: cleanup must not mask the check's own result.
		}
	});

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
	// `text` frames (what actually reached the wire, decoded back with the
	// published decoder) are two independent sources, so both are checked
	// against the requested reply, not just against each other.
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
			`test:live-operative failed: the streamed text frames did not assemble into text containing "${expectedSubstring}" — got ${JSON.stringify(assembledFromFrames)} across ${textFrames.length} frame(s). The streaming path may be dropping deltas even though the run completed.`
		);
		process.exitCode = 1;
		return;
	}

	console.log(
		`test:live-operative OK — reached status: 'completed' with content containing "${expectedSubstring}" across ${textFrames.length} text frame(s).`
	);
}

await main();

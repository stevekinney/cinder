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
import { appendUserMessage, createConversationHistory } from 'conversationalist';

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

	const frames: ChatStreamFrame[] = [];
	const run = startChatRun(agent, conversation);
	const envelope = await pumpChatRun(run, (frame) => frames.push(frame));

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

	console.log(
		`test:live-operative OK — reached status: 'completed' (${frames.length} frame(s) streamed).`
	);
}

await main();

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./+server.ts', import.meta.url), 'utf8');
const resumeSource = readFileSync(new URL('./resume/+server.ts', import.meta.url), 'utf8');

describe('chat stream cancellation tool-execution guard', () => {
	test('checks settlement before and after awaiting tool execution', () => {
		expect(source).toContain('toolCalls.length > 0 && !settled');
		expect(source).toContain(
			'const results = await toolbox.execute(toolCalls, { requestContext });'
		);
		expect(source).toContain('if (settled) return;');
	});
});

describe('chat approval continuation response', () => {
	test('forwards another pending approval stage to the client', () => {
		expect(resumeSource).toContain('...(result.action ? { action: result.action } : {})');
		expect(resumeSource).toContain(
			'...(result.pendingApproval ? { pendingApproval: result.pendingApproval } : {})'
		);
	});
});

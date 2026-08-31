import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./+server.ts', import.meta.url), 'utf8');

describe('chat stream cancellation tool-execution guard', () => {
	test('checks settlement before and after awaiting tool execution', () => {
		expect(source).toContain('toolCalls.length > 0 && !settled');
		expect(source).toContain(
			'const results = await toolbox.execute(toolCalls, { requestContext });'
		);
		expect(source).toContain('if (settled) return;');
	});
});

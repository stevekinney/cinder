import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import { updatePendingApproval } from '$lib/pending-approval';
import type { SignedPendingToolApproval } from 'armorer';

const source = readFileSync(new URL('./+server.ts', import.meta.url), 'utf8');
const resumeSource = readFileSync(new URL('./resume/+server.ts', import.meta.url), 'utf8');

describe('chat stream cancellation tool-execution guard', () => {
	test('checks settlement before and after awaiting tool execution', () => {
		expect(source).toContain('toolCalls.length > 0 && !settled');
		expect(source).toMatch(
			/const results = await toolbox\.execute\(toolCalls, \{ requestContext \}\);\s+if \(settled\) return;/
		);
	});
});

describe('chat approval continuation response', () => {
	test('forwards another pending approval stage to the client', () => {
		expect(resumeSource).toContain('...(result.action ? { action: result.action } : {})');
		expect(resumeSource).toContain(
			'...(result.pendingApproval ? { pendingApproval: result.pendingApproval } : {})'
		);
	});

	test('retains and replaces a pending approval returned by resume', () => {
		const pendingApprovals = new Map<string, SignedPendingToolApproval>();
		const first = { approvalToken: 'first' } as SignedPendingToolApproval;
		const second = { approvalToken: 'second' } as SignedPendingToolApproval;

		updatePendingApproval(pendingApprovals, {
			callId: 'call',
			outcome: 'action_required',
			content: null,
			pendingApproval: first
		});
		updatePendingApproval(pendingApprovals, {
			callId: 'call',
			outcome: 'action_required',
			content: null,
			pendingApproval: second
		});

		expect(pendingApprovals.get('call')).toBe(second);

		updatePendingApproval(pendingApprovals, {
			callId: 'call',
			outcome: 'success',
			content: null
		});
		expect(pendingApprovals.has('call')).toBe(false);
	});
});

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import { updatePendingApproval } from '$lib/pending-approval';
import type { SignedPendingToolApproval } from 'armorer';

const source = readFileSync(new URL('./+server.ts', import.meta.url), 'utf8');
const resumeSource = readFileSync(new URL('./resume/+server.ts', import.meta.url), 'utf8');

describe('chat stream cancellation guard', () => {
	test('registers the request signal on the same one-shot abort path cancel() uses', () => {
		expect(source).toContain("request.signal.addEventListener('abort', onRequestAbort)");
		expect(source).toContain("run?.abort('client cancelled')");
		expect(source).toContain("run?.abort('request aborted')");
	});

	test('removes the request-signal listener and disposes the run on every terminal path', () => {
		expect(source).toMatch(
			/request\.signal\.removeEventListener\('abort', onRequestAbort\);\s+activeRun\[Symbol\.dispose\]\(\);/
		);
	});

	test('guards every controller transition behind the settled one-shot flag', () => {
		expect(source).toContain('if (settled) return;');
		expect(source).toContain('settled = true;');
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
		const first = {
			callId: 'call',
			toolName: 'remember_note',
			arguments: {},
			action: { type: 'approval' as const },
			approvalToken: 'first'
		} satisfies SignedPendingToolApproval;
		const second = {
			callId: 'call',
			toolName: 'remember_note',
			arguments: {},
			action: { type: 'approval' as const },
			approvalToken: 'second'
		} satisfies SignedPendingToolApproval;

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

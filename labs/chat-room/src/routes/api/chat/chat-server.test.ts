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

	// A request-signal abort is the one path where nothing else transitions the
	// stream: `settled = true` is exactly what stops the async pump's terminal
	// branch from running, so the handler has to close the controller itself or
	// the stream never reaches a terminal state at all. `cancel()` deliberately
	// does not, because there the consumer has already torn the readable down.
	test('closes the stream from the request-abort handler but not from cancel()', () => {
		expect(source).toMatch(
			/function onRequestAbort\(\): void \{[\s\S]*?run\?\.abort\('request aborted'\);[\s\S]*?closeStream\?\.\(\);[\s\S]*?\n\t\}/
		);
		expect(source).toMatch(/cancel\(\) \{\s+settled = true;\s+run\?\.abort\('client cancelled'\);\s+\}/);
	});

	test('guards the abort handler as a one-shot', () => {
		expect(source).toMatch(/function onRequestAbort\(\): void \{\s+if \(settled\) return;/);
	});

	test('removes the request-signal listener and disposes the run on every terminal path', () => {
		expect(source).toMatch(/request\.signal\.removeEventListener\('abort', onRequestAbort\);/);
		expect(source).toMatch(/try \{\s+activeRun\[Symbol\.dispose\]\(\);\s+\} catch \{/);
	});

	// A single generic `expect(source).toContain('if (settled) return;')` would
	// still pass with `enqueueFrame`'s guard alone, even if the terminal guard
	// before `controller.close()`/`controller.error()` or the catch-path guard
	// before the second `controller.error()` were deleted — reintroducing the
	// double-settlement race these guards exist to prevent. Each transition's
	// own guard is asserted by name below instead.
	test('guards the terminal close()/error() transition behind its own settled check', () => {
		expect(source).toMatch(/if \(settled\) return;\s+settled = true;\s+\/\/ A user-initiated stop/);
	});

	test('closes the stream for a successful or cleanly aborted envelope', () => {
		expect(source).toMatch(
			/envelope\.ok \|\| envelope\.error\.kind === 'abort'\) \{\s+controller\.close\(\);/
		);
	});

	test('errors the stream for any other envelope failure', () => {
		expect(source).toContain('controller.error(new Error(envelope.error.message));');
	});

	test('guards the catch-path controller.error() behind its own settled check', () => {
		expect(source).toMatch(
			/catch \(cause\) \{\s+if \(!settled\) \{\s+settled = true;\s+controller\.error\(cause\);\s+\}\s+\}/
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

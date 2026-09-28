import { describe, expect, spyOn, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import { updatePendingApproval } from '$lib/pending-approval';
import { requestContext, toolbox } from '$lib/toolbox';
import type { SignedPendingToolApproval } from 'armorer';

const resumeSource = readFileSync(new URL('./resume/+server.ts', import.meta.url), 'utf8');
/**
 * The stream's lifecycle moved to `$lib/chat-run-response.ts` when the
 * server-owned route family needed the same handling and copying it was the
 * alternative. These guards follow the code rather than the file: what they
 * pin — one-shot abort, close-from-abort-but-not-cancel, the post-listener
 * re-check, disposal on every terminal path — is the same set of races
 * wherever it lives, and it is now shared by both route families rather than
 * duplicated into a second copy that could drift.
 */
const streamSource = readFileSync(
	new URL('../../../lib/chat-run-response.ts', import.meta.url),
	'utf8'
);

describe('chat stream cancellation guard', () => {
	test('registers the request signal on the same one-shot abort path cancel() uses', () => {
		expect(streamSource).toContain("options.signal.addEventListener('abort', onRequestAbort)");
		expect(streamSource).toContain("run?.abort('client cancelled')");
		expect(streamSource).toContain("run?.abort('request aborted')");
	});

	// A request-signal abort is the one path where nothing else transitions the
	// stream: `settled = true` is exactly what stops the async pump's terminal
	// branch from running, so the handler has to close the controller itself or
	// the stream never reaches a terminal state at all. `cancel()` deliberately
	// does not, because there the consumer has already torn the readable down.
	test('closes the stream from the request-abort handler but not from cancel()', () => {
		expect(streamSource).toMatch(
			/function onRequestAbort\(\): void \{[\s\S]*?run\?\.abort\('request aborted'\);[\s\S]*?closeStream\?\.\(\);[\s\S]*?\n\t\}/
		);
		expect(streamSource).toMatch(
			/cancel\(\) \{\s+settled = true;\s+run\?\.abort\('client cancelled'\);\s+\}/
		);
	});

	// The window between the two guards spans `startChatRun`, which opens a
	// billed provider request — so an abort lost in it costs money as well as
	// leaving the stream open.
	test('re-checks the signal after attaching the listener, without returning', () => {
		expect(streamSource).toMatch(
			/options\.signal\.addEventListener\('abort', onRequestAbort\);[\s\S]*?if \(options\.signal\.aborted\) onRequestAbort\(\);/
		);
		// The absence of a `return` is the load-bearing half. Returning here
		// would skip the pump, and with it the `finally` that removes the
		// listener and disposes the run — trading a lost abort for a leaked one.
		const recheck = streamSource.slice(
			streamSource.indexOf('if (options.signal.aborted) onRequestAbort();')
		);
		expect(recheck.slice(0, recheck.indexOf('void (async'))).not.toContain('return;');
	});

	test('guards the abort handler as a one-shot', () => {
		expect(streamSource).toMatch(/function onRequestAbort\(\): void \{\s+if \(settled\) return;/);
	});

	test('removes the request-signal listener and disposes the run on every terminal path', () => {
		expect(streamSource).toMatch(
			/options\.signal\.removeEventListener\('abort', onRequestAbort\);/
		);
		expect(streamSource).toMatch(/try \{\s+activeRun\[Symbol\.dispose\]\(\);\s+\} catch \{/);
	});

	// A single generic `expect(streamSource).toContain('if (settled) return;')` would
	// still pass with `enqueueFrame`'s guard alone, even if the terminal guard
	// before `controller.close()` or the catch-path guard before
	// `controller.error()` were deleted — reintroducing the double-settlement
	// race these guards exist to prevent. Each transition's own guard is
	// asserted by name below instead.
	test('guards the terminal close() transition behind its own settled check', () => {
		expect(streamSource).toMatch(
			/if \(settled\) return;\s+settled = true;\s+\/\/ Every settled run/
		);
	});

	test('closes the stream for every settled run, failed ones included', () => {
		// This used to error the stream on failure, which destroys the
		// connection serving the response body — so the terminal `run.error`
		// frame went out with it and the browser saw `ERR_EMPTY_RESPONSE`. The
		// frame IS the outcome; the body is complete once it is written.
		expect(streamSource).toMatch(
			/settled = true;\s+\/\/ Every settled run[\s\S]*?controller\.close\(\);/
		);
	});

	test('no longer tears the connection down to report a failure', () => {
		// The only surviving `controller.error` is the catch path, where
		// nothing was written and the client would otherwise hang.
		// Statements only: the comment above that catch path explains why the
		// old failure branch was removed, and naming it there must not count
		// as calling it.
		const errorCalls = streamSource.match(/^\s*controller\.error\(/gm) ?? [];
		expect(errorCalls).toHaveLength(1);
		expect(streamSource).not.toContain('controller.error(new Error(envelope.error.message));');
	});

	test('guards the catch-path controller.error() behind its own settled check', () => {
		expect(streamSource).toMatch(
			/catch \(cause\) \{\s+if \(!settled\) \{\s+settled = true;\s+controller\.error\(cause\);\s+\}\s+\}/
		);
	});
});

describe('chat approval continuation response', () => {
	test('rejects an approval action with missing published fields before resume execution', async () => {
		let resumeCalls = 0;
		const resumeApproval = spyOn(toolbox, 'resumeApproval').mockImplementation(async () => {
			resumeCalls += 1;
			throw new Error('resumeApproval must not run for malformed input');
		});

		try {
			const { POST } = await import('./resume/+server.ts');
			const response = await POST({
				request: new Request('http://localhost/api/chat/resume', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						approval: {
							callId: 'call-malformed',
							toolName: 'remember_note',
							arguments: { text: 'A note' },
							action: { type: 'approval', message: 'Save this note?' },
							approvalToken: 'a'.repeat(64)
						},
						decision: 'approve'
					})
				}),
				url: new URL('http://localhost/api/chat/resume')
			} as Parameters<typeof POST>[0]);

			expect(response.status).toBe(400);
			expect(await response.json()).toEqual({ error: 'Invalid request body' });
			expect(resumeCalls).toBe(0);
		} finally {
			resumeApproval.mockRestore();
		}
	});

	test('rejects unknown fields inside a complete approval action before resume execution', async () => {
		let resumeCalls = 0;
		const resumeApproval = spyOn(toolbox, 'resumeApproval').mockImplementation(async () => {
			resumeCalls += 1;
			throw new Error('resumeApproval must not run for malformed input');
		});

		try {
			const { POST } = await import('./resume/+server.ts');
			const approval = {
				callId: 'call-unknown-action-field',
				toolName: 'remember_note',
				arguments: { text: 'A note' },
				action: {
					type: 'approval',
					message: 'Save this note?',
					risk: 'medium',
					operation: {
						kind: 'command',
						command: 'remember_note',
						filesTouched: ['notes.txt'],
						argsPreview: { text: 'A note' },
						unexpected: true
					},
					sandbox: { provider: 'local', name: 'sandbox', workingDir: '/tmp' },
					env: ['MODE=test'],
					snapshotId: 'snapshot-1',
					expiresAt: '2026-09-27T00:00:00.000Z',
					editableArgs: true,
					policyVersion: 'policy-1',
					idempotencyKey: 'approval-1'
				},
				reason: 'Save this note?',
				metadata: { source: 'test' },
				policyPauseTier: 'tool',
				satisfiedPolicyPauses: [
					{
						action: {
							type: 'approval',
							risk: 'low',
							operation: { kind: 'other', argsPreview: {} },
							policyVersion: 'policy-1',
							idempotencyKey: 'pause-1'
						},
						reason: 'A prior policy pause',
						tier: 'tool'
					}
				],
				approvalToken: 'a'.repeat(64)
			};
			const response = await POST({
				request: new Request('http://localhost/api/chat/resume', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ approval, decision: 'approve' })
				}),
				url: new URL('http://localhost/api/chat/resume')
			} as Parameters<typeof POST>[0]);

			expect(response.status).toBe(400);
			expect(await response.json()).toEqual({ error: 'Invalid request body' });
			expect(resumeCalls).toBe(0);
		} finally {
			resumeApproval.mockRestore();
		}
	});

	test('rejects each semantic approval violation independently', async () => {
		const baseAction = {
			type: 'approval',
			risk: 'low',
			operation: { kind: 'command', command: 'remember_note' },
			sandbox: { provider: 'local', name: 'sandbox', workingDir: '/tmp' },
			expiresAt: '2026-09-27T00:00:00.000Z',
			policyVersion: 'policy-1',
			idempotencyKey: 'approval-1'
		};
		const cases = [
			{ name: 'invalid expiry', action: { ...baseAction, expiresAt: 'invalid' } },
			{
				name: 'empty command',
				action: { ...baseAction, operation: { kind: 'command', command: '' } }
			},
			{
				name: 'empty file list',
				action: { ...baseAction, operation: { kind: 'file-write', filesTouched: [] } }
			},
			{
				name: 'empty sandbox provider',
				action: { ...baseAction, sandbox: { provider: '', name: 'sandbox', workingDir: '/tmp' } }
			},
			{ name: 'empty policy version', action: { ...baseAction, policyVersion: '' } },
			{ name: 'empty idempotency key', action: { ...baseAction, idempotencyKey: '' } },
			{
				name: 'invalid nested policy pause',
				action: {
					...baseAction
				},
				satisfiedPolicyPauses: [
					{
						action: {
							type: 'approval',
							risk: 'low',
							operation: { kind: 'command', command: '' },
							policyVersion: 'policy-1',
							idempotencyKey: 'pause-1'
						}
					}
				]
			}
		];
		let resumeCalls = 0;
		const resumeApproval = spyOn(toolbox, 'resumeApproval').mockImplementation(async () => {
			resumeCalls += 1;
			throw new Error('resumeApproval must not run for malformed input');
		});
		try {
			const { POST } = await import('./resume/+server.ts');
			for (const { name, action, satisfiedPolicyPauses } of cases) {
				const response = await POST({
					request: new Request('http://localhost/api/chat/resume', {
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({
							approval: {
								callId: `call-${name}`,
								toolName: 'remember_note',
								arguments: { text: 'A note' },
								action,
								...(satisfiedPolicyPauses === undefined ? {} : { satisfiedPolicyPauses }),
								approvalToken: 'a'.repeat(64)
							},
							decision: 'approve'
						})
					}),
					url: new URL('http://localhost/api/chat/resume')
				} as Parameters<typeof POST>[0]);
				expect(response.status, name).toBe(400);
				expect(await response.json(), name).toEqual({ error: 'Invalid request body' });
			}
			expect(resumeCalls).toBe(0);
		} finally {
			resumeApproval.mockRestore();
		}
	});

	test('passes a complete signed approval descriptor unchanged to resumeApproval', async () => {
		const pending = await toolbox.execute(
			{ id: 'call-complete-descriptor', name: 'remember_note', arguments: { text: 'A note' } },
			{ requestContext }
		);
		expect(pending.outcome).toBe('action_required');
		if (!('pendingApproval' in pending) || pending.pendingApproval === undefined) {
			throw new Error('expected a signed pending approval');
		}

		const originalApproval = pending.pendingApproval;
		if (
			typeof originalApproval.approvalToken !== 'string' ||
			originalApproval.action.type !== 'approval'
		) {
			throw new Error('expected a signed approval action');
		}
		const resumeApproval = spyOn(toolbox, 'resumeApproval');
		try {
			const { POST } = await import('./resume/+server.ts');
			const response = await POST({
				request: new Request('http://localhost/api/chat/resume', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ approval: originalApproval, decision: 'approve' })
				}),
				url: new URL('http://localhost/api/chat/resume')
			} as Parameters<typeof POST>[0]);

			expect(response.status).toBe(200);
			expect(resumeApproval).toHaveBeenCalledTimes(1);
			const forwarded: unknown = resumeApproval.mock.calls[0]?.[0];
			expect(forwarded).toEqual(originalApproval);
			expect(originalApproval.approvalBinding).toBeDefined();
		} finally {
			resumeApproval.mockRestore();
		}
	});

	test('preserves a fully populated approval descriptor during parsing', async () => {
		const pending = await toolbox.execute(
			{ id: 'call-parser-contract', name: 'remember_note', arguments: { text: 'A note' } },
			{ requestContext }
		);
		if (!('pendingApproval' in pending) || pending.pendingApproval === undefined) {
			throw new Error('expected a signed pending approval');
		}
		const approval = {
			...pending.pendingApproval,
			action: {
				type: 'approval' as const,
				message: 'Save this note?',
				risk: 'medium' as const,
				operation: {
					kind: 'command' as const,
					command: 'remember_note',
					filesTouched: ['notes.txt'],
					argsPreview: { text: 'A note' }
				},
				sandbox: { provider: 'local', name: 'sandbox', workingDir: '/tmp' },
				env: ['MODE=test'],
				snapshotId: 'snapshot-1',
				expiresAt: '2026-09-27T00:00:00.000Z',
				editableArgs: true,
				policyVersion: 'policy-1',
				idempotencyKey: 'approval-1'
			},
			reason: 'Save this note?',
			metadata: { source: 'test' },
			policyPauseTier: 'tool',
			satisfiedPolicyPauses: [
				{
					action: {
						type: 'approval' as const,
						risk: 'low' as const,
						operation: { kind: 'other' as const, argsPreview: {} },
						policyVersion: 'policy-1',
						idempotencyKey: 'pause-1'
					},
					reason: 'A prior policy pause',
					tier: 'tool' as const
				}
			]
		};
		let forwarded: unknown;
		const resumeApproval = spyOn(toolbox, 'resumeApproval').mockImplementation(async (value) => {
			forwarded = value;
			throw new Error('parser probe');
		});
		try {
			const { POST } = await import('./resume/+server.ts');
			await expect(
				POST({
					request: new Request('http://localhost/api/chat/resume', {
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({ approval, decision: 'approve' })
					}),
					url: new URL('http://localhost/api/chat/resume')
				} as Parameters<typeof POST>[0])
			).rejects.toThrow('parser probe');
			expect(forwarded).toEqual(approval);
		} finally {
			resumeApproval.mockRestore();
		}
	});

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
			action: {
				type: 'approval' as const,
				risk: 'low' as const,
				operation: { kind: 'command' as const, command: 'remember_note', argsPreview: {} },
				policyVersion: 'test-policy',
				idempotencyKey: 'approval-first'
			},
			approvalToken: 'first'
		} satisfies SignedPendingToolApproval;
		const second = {
			callId: 'call',
			toolName: 'remember_note',
			arguments: {},
			action: {
				type: 'approval' as const,
				risk: 'low' as const,
				operation: { kind: 'command' as const, command: 'remember_note', argsPreview: {} },
				policyVersion: 'test-policy',
				idempotencyKey: 'approval-second'
			},
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

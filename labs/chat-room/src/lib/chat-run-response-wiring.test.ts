import { describe, expect, it, mock, spyOn } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const applicationRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Every streaming endpoint goes through `chatRunResponse`.
 *
 * `chat-server.test.ts` pins the stream's lifecycle — that a settled run
 * closes cleanly, that a late write is dropped rather than throwing, that an
 * abort disposes the run and removes its listener. Those assertions used to
 * be reachable only through `/api/chat`, because the logic lived in that
 * route. Extracting it into `$lib/chat-run-response` made them faster and
 * shared, and quietly severed the connection: they now exercise the helper,
 * and nothing checks that either endpoint still calls it.
 *
 * The consequence is specific. Swapping `chatRunResponse(...)` in either route
 * for a hand-rolled `new Response(stream)` would leave every cancellation,
 * close, and disposal assertion green while removing those protections from
 * the path that opens a billed provider request — and the first symptom would
 * be a run that keeps streaming, and being billed, after the client hung up.
 *
 * A static check rather than a behavioural one, deliberately: driving abort
 * semantics through both handlers again would re-import the provider, the
 * toolbox, and the session store to re-prove what the helper's own tests
 * already prove. What is missing is the WIRING, and the wiring is a fact about
 * the source. `toolbox-ownership.test.ts` guards the sibling invariant the
 * same way, for the same reason.
 */
const STREAMING_ENDPOINTS = [
	'routes/api/chat/+server.ts',
	'routes/api/server-owned/conversations/[id]/stream/+server.ts'
] as const;

/**
 * Comments removed before matching. See the note at the read below for why this
 * file strips while the engine guard does not — the two assert opposite things,
 * so they err in opposite directions.
 */
const COMMENTS = /\/\*[\s\S]*?\*\/|(^|[^:])\/\/[^\n]*/g;

const withoutComments = (source: string): string =>
	source.replace(COMMENTS, (match, prefix: string | undefined) => prefix ?? '');

describe('streaming endpoints share one stream lifecycle', () => {
	for (const endpoint of STREAMING_ENDPOINTS) {
		it(`${endpoint} responds through chatRunResponse`, () => {
			// COMMENTS STRIPPED, and the direction matters — this is the mirror
			// of `operative-is-the-only-engine.test.ts`, which deliberately
			// scans raw source.
			//
			// That guard asserts something is ABSENT, so a comment hiding a real
			// import would be a false negative: silent, and the failure it
			// exists to catch. This one asserts something is PRESENT, so a
			// commented-out `return chatRunResponse(…)` is a false POSITIVE — the
			// route could return `Response.error()` instead while every
			// assertion below still passed, and the billed endpoint would have
			// bypassed the shared cancellation and disposal lifecycle this test
			// claims to pin.
			//
			// Over-stripping is safe here for the same reason: removing too much
			// makes an assertion fail loudly rather than pass quietly.
			const source = withoutComments(readFileSync(resolve(applicationRoot, endpoint), 'utf8'));

			// Imported from the shared module, not redefined locally under the
			// same name.
			expect(source).toContain("from '$lib/chat-run-response'");
			expect(source).toContain('chatRunResponse');

			// And it is what the handler RETURNS. A route that imported the
			// helper and then built its own `Response` would satisfy the checks
			// above while bypassing every lifecycle guarantee they stand for.
			expect(source).toMatch(/return\s+chatRunResponse\(/);

			// No hand-rolled streaming response beside it. `new Response(` with a
			// stream is the shape this guard exists to keep out of these two
			// files; `json(...)` for the early 400/404/503 returns is fine and
			// stays.
			expect(source).not.toContain('new Response(');

			// And the REQUEST'S OWN SIGNAL is what it hands over. Returning
			// `chatRunResponse(...)` with a signal that never aborts satisfies
			// every check above while severing the helper's request-abort path —
			// so a client that disconnects cannot stop the run, and the provider
			// keeps going and keeps billing. That is the failure these
			// lifecycle tests exist for, reachable without touching the helper.
			expect(source).toMatch(/signal:\s*request\.signal/);
		});
	}
});

describe('recovery endpoint serializes classification and history reconciliation', () => {
	it('holds the complete response operation behind the conversation lock', () => {
		const source = readFileSync(
			resolve(applicationRoot, 'routes/api/server-owned/conversations/[id]/recovery/+server.ts'),
			'utf8'
		);
		expect(source).toContain('withRecoveryLock');
		expect(source).toMatch(
			/return\s+await\s+withRecoveryLock\(params\.id,\s*\(\)\s*=>\s*respond\(params\.id\)\)/
		);
		expect(source).not.toContain('failure.reason}`');
		expect(source).toContain('recoveryFailureLog');
	});

	it('serializes concurrent POST recovery and persists the first orphan diagnosis', async () => {
		let releaseFirst!: () => void;
		const firstHeld = new Promise<void>((resolve) => {
			releaseFirst = resolve;
		});
		let classifyCalls = 0;
		const metadata: { orphanedRuns?: string[] } = {};
		const rememberOrphanedRuns = async (_id: string, runIds: readonly string[]) => {
			metadata.orphanedRuns = [...(metadata.orphanedRuns ?? []), ...runIds];
		};

		const recovery = await import('./server-owned-recovery.ts');
		mock.module('$lib/server-owned-conversations', () => ({
			AGENT_NAME: 'test-agent',
			loadConversation: async () => ({ metadata }),
			orphanedRunsOf: (value: typeof metadata) => value.orphanedRuns ?? [],
			rememberOrphanedRuns
		}));
		mock.module('$lib/server-owned-runtime', () => ({
			serverOwnedRuntime: () => ({ sessions: {}, durability: 'memory' })
		}));
		mock.module('$lib/server-owned-durable', () => ({
			durableRuntime: async () => ({ engine: {}, checkpointStore: {} })
		}));
		mock.module('$lib/toolbox', () => ({ emptyToolbox: {} }));
		mock.module('@lostgradient/operative', () => ({
			createSessionHandle: () => ({})
		}));
		mock.module('$lib/server-owned-unavailable', () => ({
			raise: (cause: unknown) => {
				throw cause;
			},
			unavailableDuringShutdown: () => undefined
		}));
		mock.module('$lib/server-owned-recovery', () => ({
			...recovery,
			classifyRecovery: async () => {
				classifyCalls += 1;
				if (classifyCalls === 1) {
					await firstHeld;
					return { kind: 'orphaned', failures: [{ runId: 'run-1', reason: 'lost' }] };
				}
				return { kind: 'nothing-to-resume' };
			}
		}));

		try {
			const { POST } = await import('../routes/api/server-owned/conversations/[id]/recovery/+server.ts');
			const first = POST({ params: { id: 'conversation-1' } } as never);
			await Promise.resolve();
			const second = POST({ params: { id: 'conversation-1' } } as never);
			await Promise.resolve();
			expect(classifyCalls).toBe(1);

			releaseFirst();
			const [firstResponse, secondResponse] = await Promise.all([first, second]);
			expect((await firstResponse.json()).kind).toBe('orphaned');
			expect(await secondResponse.json()).toEqual({
				kind: 'nothing-to-resume',
				durability: 'memory',
				previouslyOrphaned: ['run-1']
			});
		} finally {
			mock.restore();
		}
	});

	it('redacts provider credentials when POST logs an orphan rejection', async () => {
		const credential = 'postgres://user:hunter2@host/db';
		const recovery = await import('./server-owned-recovery.ts');
		mock.module('$lib/server-owned-conversations', () => ({
			AGENT_NAME: 'test-agent',
			loadConversation: async () => ({ metadata: {} }),
			orphanedRunsOf: () => [],
			rememberOrphanedRuns: async () => undefined
		}));
		mock.module('$lib/server-owned-runtime', () => ({
			serverOwnedRuntime: () => ({ sessions: {}, durability: 'memory' })
		}));
		mock.module('$lib/server-owned-durable', () => ({
			durableRuntime: async () => ({ engine: {}, checkpointStore: {} })
		}));
		mock.module('$lib/toolbox', () => ({ emptyToolbox: {} }));
		mock.module('@lostgradient/operative', () => ({ createSessionHandle: () => ({}) }));
		mock.module('$lib/server-owned-unavailable', () => ({
			raise: (cause: unknown) => {
				throw cause;
			},
			unavailableDuringShutdown: () => undefined
		}));
		mock.module('$lib/server-owned-recovery', () => ({
			...recovery,
			classifyRecovery: async () => ({
				kind: 'orphaned',
				failures: [{ runId: 'run-secret', reason: `${credential} unreachable` }]
			})
		}));
		const error = spyOn(console, 'error').mockImplementation(() => undefined);

		try {
			const { POST } = await import('../routes/api/server-owned/conversations/[id]/recovery/+server.ts');
			const response = await POST({ params: { id: 'conversation-secret' } } as never);
			expect(await response.json()).toEqual({
				kind: 'orphaned',
				durability: 'memory',
				failures: [
					{
						runId: 'run-secret',
						reason: 'The engine refused to resume this run. The details are in the server log.'
					}
				],
				note: expect.any(String)
			});
			expect(error).toHaveBeenCalledTimes(1);
			expect(error.mock.calls[0]?.[0]).not.toContain(credential);
		} finally {
			error.mockRestore();
			mock.restore();
		}
	});
});

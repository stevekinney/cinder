import { mock } from 'bun:test';

const mode = process.argv[2];
const metadata: { orphanedRuns?: string[] } = {};
let classifyCalls = 0;
let enteredFirst!: () => void;
const firstEntered = new Promise<void>((resolve) => {
	enteredFirst = resolve;
});
let releaseFirst!: () => void;
const firstHeld = new Promise<void>((resolve) => {
	releaseFirst = resolve;
});
const credential = 'postgres://user:hunter2@host/db';
const logged: string[] = [];
const recovery = await import('./server-owned-recovery.ts');

mock.module('$lib/server-owned-conversations', () => ({
	AGENT_NAME: 'test-agent',
	loadConversation: async () => ({ metadata }),
	orphanedRunsOf: (value: typeof metadata) => value.orphanedRuns ?? [],
	rememberOrphanedRuns: async (_id: string, runIds: readonly string[]) => {
		metadata.orphanedRuns = [...(metadata.orphanedRuns ?? []), ...runIds];
	}
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
	classifyRecovery: async () => {
		classifyCalls += 1;
		if (mode === 'concurrent' && classifyCalls === 1) {
			enteredFirst();
			await firstHeld;
			return { kind: 'orphaned', failures: [{ runId: 'run-1', reason: 'lost' }] };
		}
		if (mode === 'redaction') {
			return {
				kind: 'orphaned',
				failures: [{ runId: 'run-secret', reason: `${credential} unreachable` }]
			};
		}
		return { kind: 'nothing-to-resume' };
	}
}));

console.error = (...values: unknown[]) => {
	logged.push(values.map(String).join(' '));
};

const { POST } = await import('../routes/api/server-owned/conversations/[id]/recovery/+server.ts');
if (mode === 'concurrent') {
	const first = POST({ params: { id: 'conversation-1' } } as never);
	await firstEntered;
	const second = POST({ params: { id: 'conversation-1' } } as never);
	await new Promise<void>((resolve) => setImmediate(resolve));
	const classifyCallsBeforeRelease = classifyCalls;
	releaseFirst();
	const [firstResponse, secondResponse] = await Promise.all([first, second]);
	process.stdout.write(
		JSON.stringify({
			classifyCallsBeforeRelease,
			firstKind: (await firstResponse.json()).kind,
			second: await secondResponse.json()
		})
	);
} else if (mode === 'redaction') {
	const response = await POST({ params: { id: 'conversation-secret' } } as never);
	process.stdout.write(JSON.stringify({ response: await response.json(), logged }));
} else {
	throw new Error(`unknown fixture mode: ${String(mode)}`);
}

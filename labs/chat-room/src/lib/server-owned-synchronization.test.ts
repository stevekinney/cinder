import { describe, expect, test } from 'bun:test';

import { createServerOwnedSynchronizer } from './server-owned-synchronization';
import type { ServerOwnedConversationSnapshot } from './server-owned-snapshot';

const snapshot = (id: string): ServerOwnedConversationSnapshot => ({
	id,
	title: id,
	conversation: {} as never,
	turnFailures: {}
});

const response = (body: ServerOwnedConversationSnapshot, ok = true): Response =>
	new Response(JSON.stringify(body), { status: ok ? 200 : 503 });

describe('server-owned synchronizer', () => {
	test('reads immediately, then waits five seconds after completion', async () => {
		const timers: (() => void)[] = [];
		const delays: number[] = [];
		const calls: string[] = [];
		let resolveTimerRegistration!: () => void;
		const timerRegistered = new Promise<void>((resolve) => (resolveTimerRegistration = resolve));
		let resolveRead: ((value: Response) => void) | undefined;
		const synchronizer = createServerOwnedSynchronizer({
			id: 'c1',
			visible: () => true,
			streaming: () => false,
			fetcher: async () => {
				calls.push('read');
				return new Promise<Response>((resolve) => (resolveRead = resolve));
			},
			setTimer: (callback, delay) => {
				timers.push(callback);
				delays.push(delay);
				resolveTimerRegistration();
				return timers.length as never;
			},
			clearTimer: () => undefined,
			apply: () => undefined
		});
		synchronizer.trigger();
		expect(calls).toEqual(['read']);
		resolveRead?.(response(snapshot('c1')));
		await timerRegistered;
		expect(timers).toHaveLength(1);
		expect(delays).toEqual([5000]);
		timers[0]!();
		expect(calls).toEqual(['read', 'read']);
		synchronizer.dispose();
	});

	test('coalesces triggers and drops a response invalidated by streaming', async () => {
		let resolveRead: ((value: Response) => void) | undefined;
		let applied = 0;
		const synchronizer = createServerOwnedSynchronizer({
			id: 'c1',
			visible: () => true,
			streaming: () => false,
			fetcher: async () => new Promise<Response>((resolve) => (resolveRead = resolve)),
			apply: () => applied++
		});
		synchronizer.trigger();
		synchronizer.trigger();
		synchronizer.setStreaming(true);
		resolveRead?.(response(snapshot('stale')));
		await Promise.resolve();
		await Promise.resolve();
		expect(applied).toBe(0);
		synchronizer.setStreaming(false);
		synchronizer.dispose();
	});

	test('consumes streaming triggers into one postrun refresh', async () => {
		let reads = 0;
		let resolveReadStarted!: () => void;
		const readStarted = new Promise<void>((resolve) => (resolveReadStarted = resolve));
		const synchronizer = createServerOwnedSynchronizer({
			id: 'c1',
			visible: () => true,
			streaming: () => true,
			fetcher: async () => {
				reads += 1;
				resolveReadStarted();
				return response(snapshot('fresh'));
			},
			apply: () => undefined,
			setTimer: () => 1 as never,
			clearTimer: () => undefined
		});
		synchronizer.trigger();
		synchronizer.trigger();
		synchronizer.setStreaming(false);
		await readStarted;
		expect(reads).toBe(1);
		synchronizer.dispose();
	});

	test('coalesces pending triggers into one read after the active read completes', async () => {
		let resolveFirst!: (response: Response) => void;
		let resolveSecondStarted!: () => void;
		const secondReadStarted = new Promise<void>((resolve) => (resolveSecondStarted = resolve));
		let calls = 0;
		const synchronizer = createServerOwnedSynchronizer({
			id: 'c1',
			visible: () => true,
			streaming: () => false,
			fetcher: async () => {
				calls += 1;
				if (calls === 1) return new Promise<Response>((resolve) => (resolveFirst = resolve));
				resolveSecondStarted();
				return response(snapshot('fresh'));
			},
			apply: () => undefined,
			setTimer: () => 1 as never,
			clearTimer: () => undefined
		});
		synchronizer.trigger();
		synchronizer.trigger();
		synchronizer.trigger();
		expect(calls).toBe(1);
		resolveFirst(response(snapshot('first')));
		await secondReadStarted;
		expect(calls).toBe(2);
		synchronizer.dispose();
	});

	test('does not apply a body that becomes stale while JSON is pending', async () => {
		let applied = 0;
		let releaseBody!: () => void;
		const synchronizer = createServerOwnedSynchronizer({
			id: 'c1',
			visible: () => true,
			streaming: () => false,
			fetcher: async () => {
				const body = new ReadableStream({
					start(controller) {
						releaseBody = () => {
							controller.enqueue(new TextEncoder().encode(JSON.stringify(snapshot('stale'))));
							controller.close();
						};
					}
				});
				return new Response(body);
			},
			apply: () => applied++
		});
		synchronizer.trigger();
		await Promise.resolve();
		synchronizer.setStreaming(true);
		releaseBody();
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();
		expect(applied).toBe(0);
		synchronizer.dispose();
	});

	test('hiding aborts an in-flight read and showing triggers a fresh one', async () => {
		const signals: AbortSignal[] = [];
		let reads = 0;
		const synchronizer = createServerOwnedSynchronizer({
			id: 'c1',
			visible: () => true,
			streaming: () => false,
			fetcher: async (_input, init) => {
				reads++;
				signals.push(init?.signal as AbortSignal);
				return new Promise<Response>(() => undefined);
			},
			apply: () => undefined
		});
		synchronizer.trigger();
		synchronizer.setVisible(false);
		expect(signals[0]?.aborted).toBe(true);
		synchronizer.setVisible(true);
		expect(reads).toBe(2);
		synchronizer.dispose();
	});

	test('releases a non-ok response so a later scheduled refresh can run', async () => {
		const timers: (() => void)[] = [];
		let reads = 0;
		const synchronizer = createServerOwnedSynchronizer({
			id: 'c1',
			visible: () => true,
			streaming: () => false,
			fetcher: async () => {
				reads++;
				return response(snapshot('c1'), false);
			},
			setTimer: (callback) => {
				timers.push(callback);
				return timers.length as never;
			},
			clearTimer: () => undefined,
			apply: () => undefined
		});
		synchronizer.trigger();
		await Promise.resolve();
		await Promise.resolve();
		expect(reads).toBe(1);
		expect(timers).toHaveLength(1);
		timers[0]!();
		await Promise.resolve();
		expect(reads).toBe(2);
		synchronizer.dispose();
	});
});

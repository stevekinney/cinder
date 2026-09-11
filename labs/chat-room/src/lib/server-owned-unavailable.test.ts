import { describe, expect, it } from 'bun:test';

import { RuntimeTerminatingError } from './server-owned-runtime.ts';
import { unavailableDuringShutdown } from './server-owned-unavailable.ts';

/**
 * A shutdown is a 503, not a 500.
 *
 * Every server-owned endpoint reaches `serverOwnedRuntime()` beneath it, and
 * that refuses once a terminating disposal latches. Unhandled, it becomes a
 * generic 500 — telling a client the server is broken when it is shutting down
 * cleanly, and giving it nothing to act on.
 */
describe('unavailableDuringShutdown', () => {
	it('answers a terminating runtime with a 503 and a retry hint', async () => {
		const response = unavailableDuringShutdown(new RuntimeTerminatingError());

		expect(response).toBeDefined();
		if (response === undefined) return;

		expect(response.status).toBe(503);
		expect(response.headers.get('retry-after')).toBe('5');

		const body = (await response.json()) as { error: string };
		// A sentence, not a stack trace — and one that says what to do.
		expect(body.error).toBe('The server is shutting down. Try again in a moment.');
	});

	it('does not swallow anything else', () => {
		// The failure mode worth guarding: a helper that returned a 503 for
		// every error would convert real crashes into "try again shortly" and
		// hide them from whoever needs to see them.
		expect(unavailableDuringShutdown(new Error('storage exploded'))).toBeUndefined();
		expect(unavailableDuringShutdown(new TypeError('not a function'))).toBeUndefined();
		expect(unavailableDuringShutdown('a string')).toBeUndefined();
		expect(unavailableDuringShutdown(undefined)).toBeUndefined();
	});

	it('carries no detail from the cause into the response', async () => {
		// The credential boundary applies to lifecycle errors too: whatever the
		// engine or storage said stays server-side.
		const secretish = new RuntimeTerminatingError();
		secretish.message = 'connection string postgres://user:hunter2@host/db';

		const response = unavailableDuringShutdown(secretish);
		expect(response).toBeDefined();
		if (response === undefined) return;

		const text = await response.text();
		expect(text).not.toContain('hunter2');
		expect(text).not.toContain('postgres://');
	});
});

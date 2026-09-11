import { describe, expect, it } from 'bun:test';
import { appendUserMessage, getMessages } from '@lostgradient/chat';
import type { AgentSession } from '@lostgradient/operative';

import {
	appendUserTurn,
	createConversation,
	listConversations,
	loadConversation,
	messageCountOf
} from './server-owned-conversations.ts';
import { disposeServerOwnedRuntime, serverOwnedRuntime } from './server-owned-runtime.ts';

/**
 * What was actually persisted, as an order-independent set.
 *
 * A count alone is not evidence for the claim these tests make. Two messages
 * is equally consistent with both turns surviving, with one turn stored twice,
 * and with both contents replaced by something else — so a store that
 * corrupted every message body would keep these tests green. Concurrency is
 * the one place where asserting on the CONTENT rather than the tally is the
 * whole point.
 */
const contentsOf = (session: AgentSession): string[] =>
	getMessages(session.conversationHistory)
		.map((message) => (typeof message.content === 'string' ? message.content : ''))
		.sort();

describe('server-owned conversations', () => {
	it('creates a conversation the list can see', async () => {
		await disposeServerOwnedRuntime();
		const created = await createConversation('Release planning');

		const listed = await listConversations();
		expect(listed).toHaveLength(1);
		expect(listed[0].id).toBe(created.id);
		expect(listed[0].title).toBe('Release planning');
		expect(listed[0].messageCount).toBe(0);
		await disposeServerOwnedRuntime();
	});

	it('returns every conversation, with its title and size', async () => {
		await disposeServerOwnedRuntime();
		const first = await createConversation('First');
		const second = await createConversation('Second');

		const listed = await listConversations();

		// Set, not sequence. ORDER IS DELIBERATELY NOT ASSERTED HERE, and the
		// reason is worth recording rather than rediscovering:
		//
		//   * `list()` sorts by `updatedAt`, newest first — verified against
		//     sessions whose timestamps genuinely differ.
		//   * Sessions saved inside one millisecond share an `updatedAt`, and
		//     the tie falls back to key order, which is unrelated to creation
		//     order. Two `createConversation` calls in a unit test land in the
		//     same millisecond routinely.
		//   * A caller cannot stage distinct timestamps to avoid that: the
		//     store OWNS `updatedAt` and overwrites any value passed to
		//     `update()`. Backdating a session is simply not possible.
		//
		// So the only ways to assert order here are to sleep between creates
		// — making correctness depend on clock granularity, which is the
		// CIN-601 defect — or to assert upstream's sort, which is Operative's
		// test to own, not this lab's. What belongs here is that the service
		// surfaces every conversation with the right title and size.
		expect(listed).toHaveLength(2);
		expect(listed.map((entry) => entry.title).sort()).toEqual(['First', 'Second']);
		expect(listed.map((entry) => entry.id).sort()).toEqual([first.id, second.id].sort());
		expect(listed.every((entry) => entry.messageCount === 0)).toBe(true);
		await disposeServerOwnedRuntime();
	});

	it('appends a turn and reports it in the list', async () => {
		await disposeServerOwnedRuntime();
		const created = await createConversation('Planning');
		await appendUserTurn(created.id, 'What shipped this week?');

		const session = await loadConversation(created.id);
		expect(session).toBeDefined();
		expect(messageCountOf(session!)).toBe(1);
		expect(contentsOf(session!)).toEqual(['What shipped this week?']);
		expect((await listConversations())[0].messageCount).toBe(1);
		await disposeServerOwnedRuntime();
	});

	it('distinguishes a missing conversation from an empty one', async () => {
		await disposeServerOwnedRuntime();
		const created = await createConversation('Empty');

		// Empty: present, zero messages.
		const empty = await loadConversation(created.id);
		expect(empty).toBeDefined();
		expect(messageCountOf(empty!)).toBe(0);

		// Missing: absent entirely. The route renders these differently, so
		// collapsing both to a falsy value would lose a real distinction.
		expect(await loadConversation('not-a-conversation')).toBeUndefined();
		expect(await appendUserTurn('not-a-conversation', 'hello')).toBeUndefined();
		await disposeServerOwnedRuntime();
	});

	it('keeps both turns when two arrive concurrently', async () => {
		await disposeServerOwnedRuntime();
		const created = await createConversation('Two tabs');

		await Promise.all([
			appendUserTurn(created.id, 'from tab one'),
			appendUserTurn(created.id, 'from tab two')
		]);

		const session = await loadConversation(created.id);
		expect(messageCountOf(session!)).toBe(2);
		expect(contentsOf(session!)).toEqual(['from tab one', 'from tab two']);
		await disposeServerOwnedRuntime();
	});

	it('merges concurrent turns through save() too, so update() is intent rather than a fix', async () => {
		await disposeServerOwnedRuntime();
		const created = await createConversation('Two tabs, the wrong way');
		const { sessions } = serverOwnedRuntime();

		// Both writers must have LOADED before either saves, and that is gated
		// rather than hoped for. `Promise.all` alone does not order them: if the
		// second `load()` resolved after the first `save()`, it would read the
		// first turn and even a last-write-wins store would produce both
		// contents — leaving the test green without ever reaching the
		// optimistic-conflict merge it claims to measure.
		let loaded = 0;
		let releaseBoth: () => void = () => {};
		const bothLoaded = new Promise<void>((resolve) => {
			releaseBoth = resolve;
		});

		// The shape `appendUserTurn` does not use: read the session, build a
		// new history from what was read, then save. Both writers start from
		// the same zero-message history, which the gate is what guarantees.
		const appendByLoadThenSave = async (text: string): Promise<void> => {
			const session = await sessions.load(created.id);
			if (session === undefined) return;

			loaded += 1;
			if (loaded === 2) releaseBoth();
			await bothLoaded;

			await sessions.save({
				...session,
				conversationHistory: appendUserMessage(session.conversationHistory, text)
			});
		};

		await Promise.all([appendByLoadThenSave('from tab one'), appendByLoadThenSave('from tab two')]);

		// TWO. This spec was written expecting one — expecting `save()` to
		// drop a turn and thereby justify `appendUserTurn`'s use of
		// `update()` — and it failed, because `save()`'s merge keeps both.
		//
		// Kept, inverted, because the measurement is the useful part: the
		// store is safer than the pessimistic reading of "merging on
		// optimistic-concurrency conflicts" suggests, and a later reader
		// considering `save()` should find that recorded rather than a
		// warning that turns out to be false.
		const session = await loadConversation(created.id);
		expect(messageCountOf(session!)).toBe(2);
		expect(contentsOf(session!)).toEqual(['from tab one', 'from tab two']);
		await disposeServerOwnedRuntime();
	});
});

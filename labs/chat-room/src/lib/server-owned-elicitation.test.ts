import { afterEach, describe, expect, test } from 'bun:test';

import {
	ElicitationAlreadyPendingError,
	answerApproval,
	forgetPendingApprovals,
	peekApproval,
	requestApproval
} from '$lib/server-owned-elicitation';

const QUESTION = {
	toolName: 'remember_note',
	callId: 'toolu_1',
	message: 'Save this note?',
	arguments: { text: 'Ship the release notes' }
};

afterEach(() => {
	forgetPendingApprovals();
});

describe('requestApproval', () => {
	test('a person answering yes resolves the waiting run', async () => {
		const waiting = requestApproval('conversation-1', QUESTION);

		expect(peekApproval('conversation-1')).toEqual(QUESTION);
		expect(answerApproval('conversation-1', QUESTION.callId, true)).toBe('settled');
		expect(await waiting).toBe(true);
	});

	test('a person answering no resolves it false', async () => {
		const waiting = requestApproval('conversation-1', QUESTION);

		answerApproval('conversation-1', QUESTION.callId, false);

		expect(await waiting).toBe(false);
	});

	test('the question is gone once answered', async () => {
		const waiting = requestApproval('conversation-1', QUESTION);
		answerApproval('conversation-1', QUESTION.callId, true);
		await waiting;

		expect(peekApproval('conversation-1')).toBeUndefined();
		// A second answer reports that nothing was pending rather than resolving
		// a promise nobody is waiting on. Without the delete in `finish`, the
		// stale entry would still be here and this would read `true`.
		expect(answerApproval('conversation-1', QUESTION.callId, true)).toBe('nothing-pending');
	});

	test('two conversations wait independently', async () => {
		const first = requestApproval('conversation-1', QUESTION);
		const second = requestApproval('conversation-2', { ...QUESTION, callId: 'toolu_2' });

		answerApproval('conversation-2', 'toolu_2', true);
		answerApproval('conversation-1', QUESTION.callId, false);

		expect([await first, await second]).toEqual([false, true]);
	});

	test('an answer naming a different call does not settle the pending one', async () => {
		// The race this exists for: question A is displayed, A's run ends, a new
		// turn registers question B, and the click meant for A finally arrives.
		// Without the id comparison that click settles B — approving a note
		// nobody was shown.
		const waiting = requestApproval('conversation-1', { ...QUESTION, callId: 'toolu_b' });

		expect(answerApproval('conversation-1', 'toolu_a', true)).toBe('wrong-call');

		// Still pending, and still answerable by the right id.
		expect(peekApproval('conversation-1')?.callId).toBe('toolu_b');
		expect(answerApproval('conversation-1', 'toolu_b', false)).toBe('settled');
		expect(await waiting).toBe(false);
	});

	test('a second question for one conversation is refused, not queued', async () => {
		const waiting = requestApproval('conversation-1', QUESTION);

		// Queueing would let a click meant for the new question answer the old
		// one. Refusing surfaces the condition that produced two at once.
		expect(() => requestApproval('conversation-1', QUESTION)).toThrow(
			ElicitationAlreadyPendingError
		);

		answerApproval('conversation-1', QUESTION.callId, true);
		expect(await waiting).toBe(true);
	});

	test('a client that disconnects counts as a denial', async () => {
		const controller = new AbortController();
		const waiting = requestApproval('conversation-1', QUESTION, controller.signal);

		controller.abort();

		// `false` rather than a rejection: nobody is left to approve anything,
		// and "do not run this tool" is what that means. A rejection would reach
		// the run as an error and report a broken run where there was a cancelled
		// one.
		expect(await waiting).toBe(false);
		expect(peekApproval('conversation-1')).toBeUndefined();
	});

	test('an ALREADY aborted signal denies without registering a question', async () => {
		const controller = new AbortController();
		controller.abort();

		const waiting = requestApproval('conversation-1', QUESTION, controller.signal);

		// An already-aborted signal fires no `abort` event, so a question
		// registered here would wait forever. It must never be registered at
		// all — which this asserts by checking nothing is pending while the
		// promise is still unawaited.
		expect(peekApproval('conversation-1')).toBeUndefined();
		expect(await waiting).toBe(false);
	});

	test('an answer after the client disconnected reports nothing pending', async () => {
		const controller = new AbortController();
		const waiting = requestApproval('conversation-1', QUESTION, controller.signal);
		controller.abort();
		await waiting;

		expect(answerApproval('conversation-1', QUESTION.callId, true)).toBe('nothing-pending');
	});

	test('peeking does not hand out the means to answer', async () => {
		const waiting = requestApproval('conversation-1', QUESTION);

		const pending = peekApproval('conversation-1');

		// The `settle` closure is this process's private handle on the promise. A
		// caller holding it could answer a question twice, or answer one it never
		// read — so the peeked shape must carry only the question.
		expect(pending).not.toBeUndefined();
		expect(Object.keys(pending ?? {}).sort()).toEqual([
			'arguments',
			'callId',
			'message',
			'toolName'
		]);
		expect(Reflect.get(pending ?? {}, 'settle')).toBeUndefined();

		answerApproval('conversation-1', QUESTION.callId, true);
		await waiting;
	});
});

describe('answerApproval', () => {
	test('reports false when nothing is pending', () => {
		expect(answerApproval('conversation-nobody-asked-about', 'toolu_1', true)).toBe(
			'nothing-pending'
		);
	});
});

import { expect, test } from '@playwright/test';
import { gotoHydrated } from '../hydration';
import type { Locator, Page } from '@playwright/test';

// Exercises streaming x edit x retry state-machine seams: overlapping async
// operations writing into the SAME `conversation` snapshot through Chat's
// adapter commands. Every scenario reuses the single `#interleaving-chat`
// instance seeded in `+page.svelte`, so each `test.describe` below reloads
// the page to start from the same known state.

const FULL_SEND_TEXT = 'Sure, here is a deterministic reply.';
const FULL_RETRY_TEXT = 'Retried reply: the quarterly numbers are in.';

async function goto(page: Page): Promise<void> {
	await gotoHydrated(page, '/exercises/interleaving');
}

function messageRow(chat: Locator, text: string): Locator {
	// `.chat-message-wrapper` is the row root; the hover-revealed action bar
	// (Edit/Copy/Retry) is a SIBLING of the `.chat-message` bubble inside it,
	// so scoping to `.chat-message` can never reach the buttons.
	return chat.locator('.chat-message-wrapper', { hasText: text });
}

test.describe('interleaving: edit a prior message while a new reply streams', () => {
	let page: Page;

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		await goto(page);
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('editing is NOT blocked while streaming; both the edit and the stream land without corrupting the transcript', async () => {
		const chat = page.locator('#interleaving-chat');
		const log = page.getByTestId('interleaving-log');
		const messagesLog = chat.getByRole('log', { name: 'Messages' });

		await chat.getByRole('textbox', { name: 'Message' }).fill('Tell me a joke.');
		await chat.getByRole('button', { name: 'Send message' }).click();
		await expect(log).toContainText('sendMessage');

		// Wait for the new reply to have produced SOME, but not all, content —
		// proves the edit below really lands mid-stream.
		await expect(messagesLog).toContainText('Sure, here');
		await expect(messagesLog).not.toContainText(FULL_SEND_TEXT);

		// Edit the FIRST seeded user message — unrelated to the streaming reply.
		const originalRow = messageRow(chat, "What's the weather like today?");
		const editButton = originalRow.getByRole('button', { name: 'Edit message' });
		await editButton.focus();
		await editButton.click();
		await chat
			.getByRole('textbox', { name: 'Edit message content' })
			.fill('What is the forecast for tomorrow?');
		await chat.getByRole('button', { name: 'Save & Resend' }).click();

		await expect(log).toContainText('editMessage:');
		await expect(chat.getByText('What is the forecast for tomorrow?')).toBeVisible();

		// The concurrent stream still finishes cleanly with the full text.
		await expect(messagesLog).toContainText(FULL_SEND_TEXT);
		await expect(chat.getByRole('button', { name: 'Send message' })).toBeVisible();
	});
});

test.describe('interleaving: two concurrent retryMessage dispatches for the same id', () => {
	let page: Page;

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		await goto(page);
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('a second PROGRAMMATIC retryMessage for an in-flight id is single-flighted, same as the UI path', async () => {
		// Chat's dispatcher single-flights retryMessage per message id: the UI
		// path (rapid double-click — covered in message-lifecycle.e2e.ts) and a
		// direct `chat.retryMessage(id)` call while the first retry is still
		// streaming are both swallowed instead of double-dispatching the
		// adapter command.
		const chat = page.locator('#interleaving-chat');
		const log = page.getByTestId('interleaving-log');
		const messagesLog = chat.getByRole('log', { name: 'Messages' });

		await chat.getByRole('button', { name: 'Retry' }).click();
		await expect(log).toContainText('retryMessage:');

		// Dispatch a SECOND retryMessage for the same message id while the
		// first is still streaming — bypasses the UI (its Retry button already
		// unmounted once the failed flag cleared), exercising the programmatic
		// path directly the way a racing consumer call would.
		await page.getByTestId('force-retry-again').click();

		const entries = await log.locator('li').allTextContents();
		expect(entries.filter((entry) => entry.startsWith('retryMessage:'))).toHaveLength(1);

		// The single surviving loop reveals the full deterministic text — no
		// duplicate row, no garbled partial content left behind.
		await expect(messagesLog).toContainText(FULL_RETRY_TEXT);
		const matchingRows = messageRow(chat, FULL_RETRY_TEXT);
		await expect(matchingRows).toHaveCount(1);

		// Clean terminal state once the surviving stream finishes.
		await expect(chat.getByRole('button', { name: 'Send message' })).toBeVisible();
		await expect(chat.getByText('Failed to send', { exact: true })).toHaveCount(0);
	});
});

test.describe('interleaving: stop mid-retry, then a fresh retry recovers', () => {
	let page: Page;

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		await goto(page);
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('stopping mid-retry returns the message to a failed, retryable state with no stuck streaming', async () => {
		const chat = page.locator('#interleaving-chat');
		const log = page.getByTestId('interleaving-log');
		const messagesLog = chat.getByRole('log', { name: 'Messages' });

		await chat.getByRole('button', { name: 'Retry' }).click();
		await expect(messagesLog).toContainText('Retried reply:');
		await expect(messagesLog).not.toContainText(FULL_RETRY_TEXT);

		await chat.getByRole('button', { name: 'Stop generating' }).click();
		await expect(log).toContainText('stopGenerating:');

		// Clean terminal state: composer re-enabled, no content past the point
		// of the stop, and the message is failed-and-retryable again rather
		// than stuck in a permanent streaming/partial state.
		await expect(chat.getByRole('button', { name: 'Send message' })).toBeVisible();
		await expect(messagesLog).not.toContainText(FULL_RETRY_TEXT);
		await expect(chat.getByText('Failed to send', { exact: true })).toBeVisible();
		await expect(chat.getByRole('button', { name: 'Retry' })).toBeVisible();
	});
});

test.describe('interleaving: submit a new message immediately after stopping a send', () => {
	let page: Page;

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		await goto(page);
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('the new turn streams cleanly and the stopped message stays frozen', async () => {
		const chat = page.locator('#interleaving-chat');
		const log = page.getByTestId('interleaving-log');
		const messagesLog = chat.getByRole('log', { name: 'Messages' });

		await chat.getByRole('textbox', { name: 'Message' }).fill('First message, will be stopped.');
		await chat.getByRole('button', { name: 'Send message' }).click();
		await expect(messagesLog).toContainText('Sure, here');

		await chat.getByRole('button', { name: 'Stop generating' }).click();
		await expect(log).toContainText('stopGenerating:');
		await expect(chat.getByRole('button', { name: 'Send message' })).toBeVisible();

		// The seed has 4 messages (Q1, A1, Q2, A2); this turn appended Q3 and
		// the stopped reply A3 as messages 5 and 6 (index 4 and 5).
		const stoppedReply = messagesLog.locator('.chat-message').nth(5);
		const frozenText = await stoppedReply.textContent();
		expect(frozenText).toBeTruthy();
		expect(frozenText).not.toContain(FULL_SEND_TEXT);

		await chat
			.getByRole('textbox', { name: 'Message' })
			.fill('Second message, sent right after the stop.');
		await chat.getByRole('button', { name: 'Send message' }).click();

		await expect(messagesLog).toContainText(FULL_SEND_TEXT);
		await expect(chat.getByRole('button', { name: 'Send message' })).toBeVisible();

		// The stopped reply (still message index 5) never grew past its frozen
		// text — the new turn appended fresh messages after it instead of
		// resuming or corrupting it.
		await expect(stoppedReply).toHaveText(frozenText ?? '');
		await expect(messagesLog.locator('.chat-message').nth(7)).toContainText(FULL_SEND_TEXT);
	});
});

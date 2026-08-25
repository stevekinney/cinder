import { expect, test } from '@playwright/test';
import { gotoHydrated } from '../hydration';
import type { Locator, Page } from '@playwright/test';

// Exercises retry / edit / stop-generating across two Chat instances on the
// same page: one wired through a ChatAdapter, one wired through plain
// onsubmit/onretry/onedit/onstopgenerating callback props with no adapter at
// all. Everything is deterministic — the "assistant reply" is a fixed,
// in-page token sequence, never a real network call.

const ADAPTER_CHAT_SELECTOR = '#message-lifecycle-adapter-chat';
type FailMode = 'resolve' | 'reject' | 'throw';

async function retryFailedMessage(
	chat: Locator,
	log: Locator,
	replacementText: string,
	expectedLogSubstring: string
) {
	await expect(chat.getByText('Failed to send', { exact: true })).toBeVisible();

	const retryButton = chat.getByRole('button', { name: 'Retry' });
	await expect(retryButton).toBeVisible();
	await retryButton.click();

	await expect(log).toContainText(expectedLogSubstring);
	await expect(chat.getByText('Failed to send', { exact: true })).toHaveCount(0);
	await expect(chat.getByText(replacementText)).toBeVisible();
}

async function editUserMessage(
	chat: Locator,
	log: Locator,
	newText: string,
	expectedLogSubstring: string
) {
	// User-message action buttons (Edit, etc.) render outside their message
	// wrapper's own box (positioned to the left of a right-aligned bubble) and
	// only become pointer-hit-testable while their wrapper is hovered — a
	// region that doesn't geometrically overlap the buttons themselves, so a
	// literal mouse hover-then-click can never reach them. Focusing first
	// exercises the same keyboard-accessible reveal path real keyboard/AT
	// users rely on, and makes the button hit-testable for the click that
	// follows.
	const editButton = chat.getByRole('button', { name: 'Edit message' });
	await editButton.focus();
	await editButton.click();

	const editBox = chat.getByRole('textbox', { name: 'Edit message content' });
	await editBox.fill(newText);
	await chat.getByRole('button', { name: 'Save & Resend' }).click();

	await expect(log).toContainText(expectedLogSubstring);
	await expect(chat.getByText(newText)).toBeVisible();
}

async function sendAndStopGenerating(chat: Locator, log: Locator, expectedLogSubstring: string) {
	const messagesLog = chat.getByRole('log', { name: 'Messages' });

	await chat.getByRole('textbox', { name: 'Message' }).fill('Tell me something long, please.');
	await chat.getByRole('button', { name: 'Send message' }).click();

	// Wait for the stream to have produced some, but not all, of its content
	// before interrupting it — proves the stop actually landed mid-stream
	// rather than after it had already finished on its own.
	await expect(messagesLog).toContainText('Streaming a');

	await chat.getByRole('button', { name: 'Stop generating' }).click();

	await expect(log).toContainText(expectedLogSubstring);
	await expect(chat.getByRole('button', { name: 'Send message' })).toBeVisible();
	await expect(messagesLog).not.toContainText('by token.');
}

async function setFailMode(page: Page, mode: FailMode): Promise<void> {
	await page.getByTestId('fail-mode-a').selectOption(mode);
}

test.describe('message lifecycle: retry, edit, and stop-generating', () => {
	let page: Page;

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		await gotoHydrated(page, '/exercises/message-lifecycle');
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('adapter-driven Chat: adapter.retryMessage, adapter.editMessage, adapter.stopGenerating', async () => {
		const chat = page.locator(ADAPTER_CHAT_SELECTOR);
		const log = page.getByTestId('adapter-log');

		await retryFailedMessage(
			chat,
			log,
			'Retried reply: the deterministic fact arrived on retry.',
			'retryMessage:'
		);
		await editUserMessage(chat, log, 'Updated question via adapter.editMessage', 'editMessage:');
		await sendAndStopGenerating(chat, log, 'stopGenerating');
	});

	test('callback-only Chat (no adapter): onretry, onedit, onstopgenerating', async () => {
		const chat = page.locator('#message-lifecycle-plain-chat');
		const log = page.getByTestId('plain-log');

		await retryFailedMessage(
			chat,
			log,
			'Retried via plain callback: the deterministic fact arrived on retry.',
			'onretry:'
		);
		await editUserMessage(chat, log, 'Updated question via plain onedit', 'onedit:');
		await sendAndStopGenerating(chat, log, 'onstopgenerating:');

		// Sanity check that the plain-callback path really has no adapter wired.
		await expect(log).toContainText('onsubmit');
		await expect(log).toContainText('onretry:');
		await expect(log).toContainText('onedit:');
		await expect(log).toContainText('onstopgenerating:');
	});
});

// Adapter failure-routing matrix: `ChatAdapter`'s doc comment states Chat
// "awaits [command methods] and routes any failure (a rejected promise OR a
// synchronous throw from the method) to `onadaptererror`". Each command is
// exercised in both failure modes, asserting the `command: message` tag Chat
// hands `onadaptererror` and that the UI recovers afterward (composer usable,
// no stuck streaming state, transcript uncorrupted). Each test reloads the
// page so error text / call counters start from a known-clean state.
test.describe('adapter failure-routing matrix', () => {
	test.beforeEach(async ({ page }) => {
		await gotoHydrated(page, '/exercises/message-lifecycle');
	});

	test('sendMessage: reject and throw both route to onadaptererror, and the composer recovers', async ({
		page
	}) => {
		const chat = page.locator(ADAPTER_CHAT_SELECTOR);
		const errorEl = page.getByTestId('adapter-error');
		const composer = chat.getByRole('textbox', { name: 'Message' });
		const sendButton = chat.getByRole('button', { name: 'Send message' });

		for (const mode of ['reject', 'throw'] as const) {
			await setFailMode(page, mode);
			await composer.fill(`Trigger sendMessage ${mode}`);
			await sendButton.click();

			await expect(errorEl).toContainText('sendMessage:');
			await expect(errorEl).toContainText(`fail-mode: ${mode}`);

			// UI recovers: composer stays usable, no stuck streaming state.
			await expect(composer).toBeEditable();
			await expect(sendButton).toBeVisible();

			// Transcript uncorrupted: the adapter failed before ever appending
			// the message, so it must never appear.
			await expect(chat.getByText(`Trigger sendMessage ${mode}`)).toHaveCount(0);
			await composer.fill('');
		}
	});

	test('retryMessage: reject and throw both route to onadaptererror, and retry still recovers', async ({
		page
	}) => {
		const chat = page.locator(ADAPTER_CHAT_SELECTOR);
		const errorEl = page.getByTestId('adapter-error');
		const retryButton = chat.getByRole('button', { name: 'Retry' });

		for (const mode of ['reject', 'throw'] as const) {
			await setFailMode(page, mode);
			await retryButton.click();

			await expect(errorEl).toContainText('retryMessage:');
			await expect(errorEl).toContainText(`fail-mode: ${mode}`);

			// Transcript uncorrupted: the failed message and its retry button
			// are exactly where they started.
			await expect(chat.getByText('Failed to send', { exact: true })).toBeVisible();
			await expect(retryButton).toBeVisible();
		}

		await setFailMode(page, 'resolve');
		await retryButton.click();
		await expect(
			chat.getByText('Retried reply: the deterministic fact arrived on retry.')
		).toBeVisible();
	});

	test('editMessage: reject and throw both route to onadaptererror, and editing still recovers', async ({
		page
	}) => {
		const chat = page.locator(ADAPTER_CHAT_SELECTOR);
		const errorEl = page.getByTestId('adapter-error');
		const originalText = 'What is the capital of deterministic testing?';

		for (const mode of ['reject', 'throw'] as const) {
			await setFailMode(page, mode);

			const editButton = chat.getByRole('button', { name: 'Edit message' });
			await editButton.focus();
			await editButton.click();
			const editBox = chat.getByRole('textbox', { name: 'Edit message content' });
			await editBox.fill(`Edited during ${mode} failure`);
			await chat.getByRole('button', { name: 'Save & Resend' }).click();

			await expect(errorEl).toContainText('editMessage:');
			await expect(errorEl).toContainText(`fail-mode: ${mode}`);

			// Transcript uncorrupted: original content survives the failure.
			await expect(chat.getByText(originalText)).toBeVisible();
		}

		await setFailMode(page, 'resolve');
		const editButton = chat.getByRole('button', { name: 'Edit message' });
		await editButton.focus();
		await editButton.click();
		await chat.getByRole('textbox', { name: 'Edit message content' }).fill('Recovered edit');
		await chat.getByRole('button', { name: 'Save & Resend' }).click();
		await expect(chat.getByText('Recovered edit')).toBeVisible();
	});

	test('stopGenerating: reject and throw both route to onadaptererror, and the stream finishes on its own', async ({
		page
	}) => {
		const chat = page.locator(ADAPTER_CHAT_SELECTOR);
		const errorEl = page.getByTestId('adapter-error');
		const messagesLog = chat.getByRole('log', { name: 'Messages' });

		for (const mode of ['reject', 'throw'] as const) {
			await setFailMode(page, 'resolve');
			await chat.getByRole('textbox', { name: 'Message' }).fill('Tell me something long, please.');
			await chat.getByRole('button', { name: 'Send message' }).click();
			await expect(messagesLog).toContainText('Streaming a');

			await setFailMode(page, mode);
			await chat.getByRole('button', { name: 'Stop generating' }).click();

			await expect(errorEl).toContainText('stopGenerating:');
			await expect(errorEl).toContainText(`fail-mode: ${mode}`);

			// The failed stopGenerating call never set the stop flag, so the
			// generation keeps running to completion by itself — recovery, not
			// a stuck streaming state.
			await expect(chat.getByRole('button', { name: 'Send message' })).toBeVisible({
				timeout: 5000
			});
			await expect(messagesLog).toContainText('token by token.');
		}
	});
});

// Single-flight: with `retryMessage`/`sendMessage` deliberately slow to
// resolve (see RETRY_DELAY_MS / streamReply's per-token delay in
// adapter-panel.svelte and message-lifecycle-shared.ts), a rapid double-click
// exercises whether Chat's own command dispatcher single-flights a command
// that's already in flight, independent of any disabling the button itself
// might do — `{ force: true }` bypasses Playwright's actionability checks so
// both clicks land even if the button became disabled between them.
test.describe('adapter single-flight', () => {
	test.beforeEach(async ({ page }) => {
		await gotoHydrated(page, '/exercises/message-lifecycle');
	});

	test('sendMessage: rapid double-click invokes the adapter exactly once', async ({ page }) => {
		const chat = page.locator(ADAPTER_CHAT_SELECTOR);
		const composer = chat.getByRole('textbox', { name: 'Message' });
		const sendButton = chat.getByRole('button', { name: 'Send message' });
		const countEl = page.getByTestId('call-count-a-sendMessage');

		await composer.fill('Rapid double-click send test.');
		await Promise.all([sendButton.click({ force: true }), sendButton.click({ force: true })]);

		// Wait for the stream to fully resolve so the counter is stable to read.
		await expect(sendButton).toBeVisible({ timeout: 5000 });
		await expect(countEl).toHaveText('1');
	});

	// retryMessage is single-flighted like sendMessage (cinder#897): a rapid
	// double-click dispatches the adapter's retryMessage exactly once, so a
	// non-idempotent retry (e.g. one that hits a billed API) can't
	// double-fire from one user gesture.
	test('retryMessage: rapid double-click is single-flighted; the adapter runs once', async ({
		page
	}) => {
		const chat = page.locator(ADAPTER_CHAT_SELECTOR);
		const retryButton = chat.getByRole('button', { name: 'Retry' });
		const countEl = page.getByTestId('call-count-a-retryMessage');

		await Promise.all([retryButton.click({ force: true }), retryButton.click({ force: true })]);

		await expect(chat.getByText('Failed to send', { exact: true })).toHaveCount(0, {
			timeout: 5000
		});
		await expect(countEl).toHaveText('1');
	});
});

// Strengthened stop-generating coverage: beyond "some content landed, the
// ending never did" (still covered above via `sendAndStopGenerating`), prove
// the adapter method fired exactly once, the streaming UI state is fully
// torn down, and a token that arrives after the stop (simulated in
// `streamReply`) does not silently re-append to the frozen transcript.
test.describe('stop-generating: invocation count, full teardown, and post-stop token freeze', () => {
	test.beforeEach(async ({ page }) => {
		await gotoHydrated(page, '/exercises/message-lifecycle');
	});

	test('adapter-driven Chat', async ({ page }) => {
		const chat = page.locator(ADAPTER_CHAT_SELECTOR);
		const log = page.getByTestId('adapter-log');
		const messagesLog = chat.getByRole('log', { name: 'Messages' });
		const countEl = page.getByTestId('call-count-a-stopGenerating');

		await chat.getByRole('textbox', { name: 'Message' }).fill('Tell me something long, please.');
		await chat.getByRole('button', { name: 'Send message' }).click();
		await expect(messagesLog).toContainText('Streaming a');

		await chat.getByRole('button', { name: 'Stop generating' }).click();

		await expect(log).toContainText('stopGenerating:');
		await expect(countEl).toHaveText('1');

		// Streaming state fully cleared: stop button gone, send button and
		// composer usable again.
		await expect(chat.getByRole('button', { name: 'Stop generating' })).toHaveCount(0);
		await expect(chat.getByRole('button', { name: 'Send message' })).toBeVisible();
		await expect(chat.getByRole('textbox', { name: 'Message' })).toBeEditable();

		// The mock stream deliberately attempts one more token push after the
		// stop landed — prove the page-level guard actually blocked it rather
		// than the token simply not having arrived yet.
		await expect(log).toContainText('post-stop-token:blocked');
		await expect(messagesLog).not.toContainText('LATE TOKEN AFTER STOP');
		await expect(messagesLog).not.toContainText('by token.');
	});
});

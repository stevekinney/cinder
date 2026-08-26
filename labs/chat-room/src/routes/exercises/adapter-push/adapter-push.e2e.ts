import { expect, test } from '@playwright/test';
import { gotoHydrated } from '../hydration';

test('adapter push seam: streamed reply, pushed message, typing indicator, and read receipts', async ({
	page
}) => {
	await gotoHydrated(page, '/exercises/adapter-push');

	const log = page.getByRole('log', { name: 'Messages' });

	// --- onStreamBegin / onTokenPush / onStreamEnd -------------------------
	// Sending a message routes through `adapter.sendMessage`, which drives the
	// entire assistant reply through the push handlers Chat wired at
	// `subscribe` time — no bind:this, no imperative beginStreaming call.
	await page.getByRole('textbox', { name: 'Message' }).fill('Hello there');
	await page.getByRole('button', { name: 'Send message' }).click();

	await expect(log.getByText('Hello there')).toBeVisible();
	await expect(
		log.getByText("This entire reply streamed through the adapter's onStreamBegin")
	).toBeVisible();

	// --- onMessage -> onpushmessage forwarding ------------------------------
	await page.getByTestId('push-message').click();
	await expect(
		log.getByText('A teammate just joined and pushed this message in from another client.')
	).toBeVisible();
	await expect(page.getByTestId('event-log').getByText(/onpushmessage received/)).toBeVisible();

	// --- onTypingChange -> typingParticipants indicator (adapter path) -----
	// With no `typingParticipants` prop supplied, the adapter's boolean push
	// drives Chat's built-in per-participant indicator with a synthetic
	// fallback participant.
	const typingIndicator = page.locator('[data-cinder-participant-typing]');
	await expect(typingIndicator).toHaveCount(0);

	await page.getByTestId('push-typing-start').click();
	await expect(typingIndicator).toBeVisible();
	await expect(typingIndicator).toContainText('Someone is typing');
	await expect(page.getByTestId('event-log').getByText('ontypingchange: true')).toBeVisible();

	await page.getByTestId('push-typing-stop').click();
	await expect(page.locator('[data-cinder-participant-typing]')).toHaveCount(0);
	await expect(page.getByTestId('event-log').getByText('ontypingchange: false')).toBeVisible();

	// --- typingParticipants prop, exercised directly ------------------------
	// A DEFINED `typingParticipants` prop is authoritative over the adapter
	// push, so this shows a named participant instead of the generic fallback.
	await page.getByTestId('toggle-direct-typing').click();
	await expect(typingIndicator).toBeVisible();
	await expect(typingIndicator).toContainText('Priya is typing');

	// The adapter's push is now suppressed while the direct prop is active —
	// starting (and clearing) the adapter push does not change the label.
	await page.getByTestId('push-typing-start').click();
	await expect(typingIndicator).toContainText('Priya is typing');
	await page.getByTestId('push-typing-stop').click();
	await expect(typingIndicator).toContainText('Priya is typing');

	await page.getByTestId('toggle-direct-typing').click();
	await expect(page.locator('[data-cinder-participant-typing]')).toHaveCount(0);

	// --- onReadReceipt -> readReceipts badge on the user message (adapter) -
	// Only one user message exists in this transcript, so the badge selector
	// is unambiguous.
	const readBadge = page.locator('[data-cinder-receipt-status="read"]');
	await expect(readBadge).toHaveCount(0);
	await page.getByTestId('push-read-receipt').click();
	await expect(readBadge).toBeVisible();
	await expect(page.getByTestId('event-log').getByText(/onreadreceipt: message/)).toBeVisible();

	// --- readReceipts prop, exercised directly ------------------------------
	await page.getByTestId('toggle-direct-read-receipt').click();
	await expect(readBadge).toBeVisible();
	await expect(readBadge).toHaveAttribute('aria-label', 'Read by Priya');
});

test('prop ownership transitions: defined props suppress adapter pushes, which accumulate underneath and are revealed on undefined', async ({
	page
}) => {
	await gotoHydrated(page, '/exercises/adapter-push');

	const log = page.getByRole('log', { name: 'Messages' });
	const typingIndicator = page.locator('[data-cinder-participant-typing]');
	const readBadge = page.locator('[data-cinder-receipt-status="read"]');

	// A user message is required so read receipts have a target message id.
	await page.getByRole('textbox', { name: 'Message' }).fill('Hello there');
	await page.getByRole('button', { name: 'Send message' }).click();
	await expect(log.getByText('Hello there')).toBeVisible();

	// --- typingParticipants: adapter push accumulates while suppressed -----
	await page.getByTestId('toggle-direct-typing').click();
	await expect(typingIndicator).toContainText('Priya is typing');

	// The adapter push still lands and is recorded internally even though the
	// defined prop is currently authoritative over what's rendered.
	await page.getByTestId('push-typing-start').click();
	await expect(typingIndicator).toContainText('Priya is typing');

	// Flipping the prop to `undefined` reveals the accumulated adapter state
	// immediately -- no further push required.
	await page.getByTestId('toggle-direct-typing').click();
	await expect(typingIndicator).toContainText('Someone is typing');

	// Flipping back re-suppresses the adapter-derived state.
	await page.getByTestId('toggle-direct-typing').click();
	await expect(typingIndicator).toContainText('Priya is typing');

	// Cleanup: clear the adapter's accumulated flag and drop the direct prop.
	await page.getByTestId('push-typing-stop').click();
	await page.getByTestId('toggle-direct-typing').click();
	await expect(typingIndicator).toHaveCount(0);

	// --- readReceipts: adapter push accumulates while suppressed -----------
	await page.getByTestId('toggle-direct-read-receipt').click();
	await expect(readBadge).toHaveAttribute('aria-label', 'Read by Priya');

	// Push a distinctly-named adapter read receipt while the direct prop is
	// still authoritative -- it must not change what's displayed.
	await page.getByTestId('push-read-receipt-secondary').click();
	await expect(readBadge).toHaveAttribute('aria-label', 'Read by Priya');

	// Flipping the prop to `undefined` reveals the accumulated adapter state.
	await page.getByTestId('toggle-direct-read-receipt').click();
	await expect(readBadge).toHaveAttribute('aria-label', 'Read by Jordan');

	// Flipping back re-suppresses it.
	await page.getByTestId('toggle-direct-read-receipt').click();
	await expect(readBadge).toHaveAttribute('aria-label', 'Read by Priya');
});

test('subscription lifecycle: adapter/conversation swap tears down the old subscription before the new one takes over', async ({
	page
}) => {
	await gotoHydrated(page, '/exercises/adapter-push');

	const subscribeCountA = page.getByTestId('lifecycle-subscribe-count-a');
	const unsubscribeCountA = page.getByTestId('lifecycle-unsubscribe-count-a');
	const subscribeCountB = page.getByTestId('lifecycle-subscribe-count-b');
	const unsubscribeCountB = page.getByTestId('lifecycle-unsubscribe-count-b');
	const fixtureChat = page.getByTestId('lifecycle-fixture-chat');
	const fixtureTypingIndicator = fixtureChat.locator('[data-cinder-participant-typing]');

	await expect(subscribeCountA).toHaveText('0');
	await expect(subscribeCountB).toHaveText('0');

	// --- mount: adapter A subscribes -----------------------------------
	await page.getByTestId('toggle-lifecycle-fixture').click();
	await expect(subscribeCountA).toHaveText('1');
	await expect(unsubscribeCountA).toHaveText('0');
	await expect(subscribeCountB).toHaveText('0');

	await page.getByTestId('push-lifecycle-via-a').click();
	await expect(fixtureTypingIndicator).toBeVisible();

	// --- swap: adapter A tears down as/before adapter B opens -----------
	await page.getByTestId('swap-lifecycle-adapter').click();
	await expect(unsubscribeCountA).toHaveText('1');
	await expect(subscribeCountB).toHaveText('1');
	await expect(unsubscribeCountB).toHaveText('0');

	// Chat's own teardown clears adapter-derived typing state on resubscribe.
	await expect(fixtureTypingIndicator).toHaveCount(0);

	// The OLD (adapter A) subscription's handler reference is a guaranteed
	// no-op now -- our adapter clears it to `undefined` on its own teardown.
	await page.getByTestId('push-lifecycle-via-a').click();
	await expect(fixtureTypingIndicator).toHaveCount(0);

	// The NEW (adapter B) subscription is live.
	await page.getByTestId('push-lifecycle-via-b').click();
	await expect(fixtureTypingIndicator).toBeVisible();

	// --- unmount: the currently-active subscription (B) tears down -----
	await page.getByTestId('toggle-lifecycle-fixture').click();
	await expect(unsubscribeCountB).toHaveText('1');
	await expect(fixtureChat).toHaveCount(0);
});

test('out-of-order stream pushes degrade gracefully: no crash, no ghost message, clean console', async ({
	page
}) => {
	const consoleErrors: string[] = [];
	page.on('console', (message) => {
		if (message.type() === 'error') consoleErrors.push(message.text());
	});

	await gotoHydrated(page, '/exercises/adapter-push');
	await page.clock.install();

	const eventLog = page.getByTestId('event-log');
	const messageWrappers = page.locator('.chat-message-wrapper');
	await expect(messageWrappers).toHaveCount(0);

	// --- onTokenPush before onStreamBegin -------------------------------
	await page.getByTestId('push-token-before-begin').click();
	await expect(eventLog.getByText('onTokenPush fired before onStreamBegin')).toBeVisible();
	await expect(messageWrappers).toHaveCount(0);

	// --- double onStreamBegin --------------------------------------------
	await page.getByTestId('push-double-stream-begin').click();
	await expect(eventLog.getByText('onStreamBegin fired twice in a row')).toBeVisible();
	await expect(messageWrappers).toHaveCount(0);

	// --- onStreamEnd twice -------------------------------------------------
	await page.getByTestId('push-stream-end-twice').click();
	await expect(eventLog.getByText('onStreamEnd fired twice in a row')).toBeVisible();
	await expect(messageWrappers).toHaveCount(0);

	// --- onStreamEnd without a prior onStreamBegin --------------------------
	await page.getByTestId('push-stream-end-without-begin').click();
	await expect(eventLog.getByText('onStreamEnd fired with no prior onStreamBegin')).toBeVisible();
	await expect(messageWrappers).toHaveCount(0);

	// Chat is still fully functional afterwards -- the malformed sequence did
	// not corrupt its internal streaming state.
	const log = page.getByRole('log', { name: 'Messages' });
	await page.getByRole('textbox', { name: 'Message' }).fill('Still works');
	await page.getByRole('button', { name: 'Send message' }).click();
	// The fixture deliberately spaces tokens 15ms apart. Advance browser time so
	// the recovery assertion tests stream state rather than host timer scheduling.
	await page.clock.runFor(1000);
	await expect(log.getByText('Still works')).toBeVisible();
	await expect(
		log.getByText("This entire reply streamed through the adapter's onStreamBegin")
	).toBeVisible();

	expect(consoleErrors).toEqual([]);
});

test('subscribe-in-effect hazard fixture: a synchronous $state write inside subscribe throws the documented effect-depth error', async ({
	page
}) => {
	// The docs describe `effect_update_depth_exceeded` as thrown from Svelte's
	// flush loop -- it may land inside the `<svelte:boundary>`'s tracked
	// subtree (caught, rendered as `hazard-fixture-error`) OR escape as an
	// uncaught page error / console error if the throw happens outside what
	// the boundary is watching at that instant. Capture all three surfaces
	// rather than betting on one.
	const consoleErrors: string[] = [];
	const pageErrors: string[] = [];
	page.on('console', (message) => {
		if (message.type() === 'error') consoleErrors.push(message.text());
	});
	page.on('pageerror', (pageError) => pageErrors.push(String(pageError)));

	await gotoHydrated(page, '/exercises/adapter-push');

	const hazardChat = page.getByTestId('hazard-fixture-chat');
	const hazardError = page.getByTestId('hazard-fixture-error');

	// Enabling the fixture mounts a Chat instance whose adapter violates the
	// documented `subscribe` contract (writes `$state` synchronously instead
	// of deferring via `queueMicrotask`/`tick`). Immediately driving a second
	// reactive update (typing into ITS OWN composer) puts another update in
	// flight alongside the still-settling mount effect, which is what the
	// docs say is needed to actually trip `effect_update_depth_exceeded`.
	// The mount itself may already have thrown by the time this runs (the
	// composer could be gone), so the fill is best-effort and non-fatal.
	await page.getByTestId('toggle-hazard-fixture').click();
	await hazardChat
		.getByRole('textbox', { name: 'Message' })
		.fill('trigger', { timeout: 2000 })
		.catch(() => {});

	const errorCode = 'effect_update_depth_exceeded';
	await expect
		.poll(
			async () =>
				(await hazardError.count()) > 0 ||
				consoleErrors.some((text) => text.includes(errorCode)) ||
				pageErrors.some((text) => text.includes(errorCode)),
			{ timeout: 5000 }
		)
		.toBe(true);

	// If the boundary is the surface that caught it, it recovers via `reset`
	// without a full navigation.
	if (await hazardError.count()) {
		await page.getByTestId('hazard-fixture-reset').click();
		await expect(hazardError).toHaveCount(0);
		await expect(page.getByTestId('toggle-hazard-fixture')).toHaveText(/Enable/);
	}
});

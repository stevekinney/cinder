/**
 * Provider failures, from the upstream rejection to what the reader sees.
 *
 * The path has four links and every one of them was missing or lossy before
 * CIN-438: Operative classifies the failure, the route puts that classification
 * on the wire, the session controller turns the terminal frame into a reported
 * error instead of dropping it, and the banner renders the classification
 * rather than flattening it to one sentence.
 *
 * The two fixture scenarios are chosen to differ ONLY in the upstream status —
 * 429 against 401. Same `kind`, same `code`, same shape of message. If the
 * rendered disposition still differs between them, it can only have come from
 * the classification travelling the whole way.
 */

import { expect, test, type Page } from '@playwright/test';

import { gotoHydrated } from '../../exercises/hydration';
import { fixtureRequestCount, newFixtureMarker } from '../../fixture-probe';
import { MIDSTREAM_PARTIAL_TEXT, fixtureMarker } from '../../streaming-fixture';

const BANNER = '[data-testid="demo-error"]';
const DISPOSITION = '[data-testid="demo-error-disposition"]';

async function sendAndFail(
	page: Page,
	scenario: 'ratelimited' | 'unauthorized' | 'midstream'
): Promise<{ marker: string }> {
	const marker = newFixtureMarker();

	await gotoHydrated(page, '/');
	await page
		.getByRole('textbox', { name: 'Message' })
		.fill(`Say something ${fixtureMarker(scenario, marker)}`);
	await page.getByRole('button', { name: 'Send message' }).click();

	// The banner appearing is the settle signal: it is written from the error
	// path, so it cannot be there until the turn has finished failing.
	await expect(page.locator(BANNER)).not.toBeEmpty();
	return { marker };
}

test('a provider failure reaches the banner instead of being dropped', async ({ page }) => {
	const { marker } = await sendAndFail(page, 'unauthorized');

	// Before the controller grew a reducer for terminal frames, `run.error`
	// was decoded and silently discarded — the banner never heard about it,
	// and the only reason a failure ever showed was the transport throwing.
	// Worse, the route answered a failure by erroring the stream, which tore
	// the connection down and took the frame with it: every provider failure
	// arrived as "Failed to fetch", with no kind, code, or retryability.
	await expect(page.locator(BANNER)).toContainText('Invalid API key supplied to the fixture.');

	// One upstream request for one turn. The 401 scenario is deliberate here:
	// see `the SDK retries a rate limit on its own` below.
	expect(await fixtureRequestCount(marker)).toBe(1);
});

test('a failed turn leaves no dangling assistant row', async ({ page }) => {
	await sendAndFail(page, 'ratelimited');

	const log = page.getByRole('log', { name: 'Messages' });
	// The user's message survives — it has to, or Retry would have nothing to
	// resend — while the streaming placeholder is cancelled rather than frozen
	// half-written, which would read as an answer the assistant never gave.
	await expect(log.getByRole('article')).toHaveCount(1);
	await expect(page.getByRole('button', { name: 'Stop generating' })).toHaveCount(0);
});

test('renders a retryable failure and a terminal one distinguishably', async ({ page }) => {
	await sendAndFail(page, 'ratelimited');
	await expect(page.locator(BANNER)).toHaveAttribute('data-retryable', 'true');
	await expect(page.locator(DISPOSITION)).toContainText('you can try that again');

	await sendAndFail(page, 'unauthorized');
	await expect(page.locator(BANNER)).toHaveAttribute('data-retryable', 'false');
	await expect(page.locator(DISPOSITION)).toContainText('retrying will not help');
});

test('takes the classification from the run rather than from the wording', async ({ page }) => {
	// The two failures differ only in the upstream status code. Nothing in the
	// message text, the error kind, or the code distinguishes them, so a
	// client guessing from any of those would render the same disposition for
	// both — which is exactly the bug the `retryable` field exists to prevent.
	await sendAndFail(page, 'unauthorized');
	const terminal = await page.locator(BANNER).textContent();

	await sendAndFail(page, 'ratelimited');
	const retryable = await page.locator(BANNER).textContent();

	expect(terminal).not.toBe(retryable);
	expect(terminal).toContain('retrying will not help');
	expect(retryable).toContain('you can try that again');
});

test('does not re-send the turn on its own', async ({ page }) => {
	const { marker } = await sendAndFail(page, 'unauthorized');

	// Parity with today: re-sending is the user's to press. A 401 is the
	// honest scenario for this claim — the SDK will not retry it at the
	// transport level, so any count above one could only be the application
	// deciding to try again by itself.
	//
	// Scoped deliberately to "the turn settles without a resend". A sleep here
	// would only have proven that no resend happened inside whatever window I
	// picked, and a resend scheduled a second later would still have passed —
	// so the window bought nothing and cost a fixed delay on every engine.
	// These are the observable conditions of a settled, idle turn instead.
	await expect(page.getByRole('button', { name: 'Stop generating' })).toHaveCount(0);
	await expect(page.getByRole('log', { name: 'Messages' })).toContainText('Failed to send');
	await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
	await expect(page.locator(BANNER)).not.toBeEmpty();

	// Nothing further reached the provider on the way to that resting state.
	expect(await fixtureRequestCount(marker)).toBe(1);
});

test('the transport retries a rate limit on its own, which is not the app retrying', async ({
	page
}) => {
	// Recorded rather than asserted around, because it is the reason the two
	// specs above use a 401. The provider transport underneath Operative
	// retries a 429 with backoff, so ONE turn produces three upstream requests
	// and takes seconds to fail. That is the transport's policy, invisible to
	// the run and to the user, and entirely separate from the application
	// re-sending a turn — which it still never does.
	const { marker } = await sendAndFail(page, 'ratelimited');
	expect(await fixtureRequestCount(marker)).toBeGreaterThan(1);

	// The transcript still shows exactly one attempt: the retries happened
	// beneath the run, not as turns the user can see.
	await expect(page.getByRole('log', { name: 'Messages' }).getByRole('article')).toHaveCount(1);
});

test('a failure raised after the stream opened still lands as a clean failed turn', async ({
	page
}) => {
	// The other scenarios reject before the stream opens. This one opens it,
	// sends a text delta, and only then raises an `error` event — a different
	// path through the route, and the one the criterion names.
	//
	// Observed, and worth recording rather than asserting around: the partial
	// text never reaches the screen at all. The provider's error event
	// supersedes the content it had already written, so the run surfaces the
	// failure without ever emitting that delta downstream. That is the outcome
	// we want — a half sentence frozen in the transcript reads as an answer
	// the assistant gave — but it is NOT the mechanism I expected, which was
	// "render, then take it away". An earlier version of this spec asserted
	// the text appeared first and failed for that reason.
	const marker = newFixtureMarker();
	await gotoHydrated(page, '/');
	await page
		.getByRole('textbox', { name: 'Message' })
		.fill(`Say something ${fixtureMarker('midstream', marker)}`);
	await page.getByRole('button', { name: 'Send message' }).click();

	const log = page.getByRole('log', { name: 'Messages' });
	await expect(page.locator(BANNER)).not.toBeEmpty();

	await expect(log).not.toContainText(MIDSTREAM_PARTIAL_TEXT);
	await expect(log.getByRole('article')).toHaveCount(1);
	await expect(page.getByRole('button', { name: 'Stop generating' })).toHaveCount(0);

	// The user's message is marked failed, so the retry affordance the app
	// already had is what offers a second attempt — not the app taking one.
	await expect(log).toContainText('Failed to send');
	expect(await fixtureRequestCount(marker)).toBe(1);
});

/**
 * What `retry` covers, asserted against measurement.
 *
 * CIN-439 specified that an invalid-then-valid fixture renders `attempts=2`
 * and resolves the typed output. It does not: `RetryOptions` retries the
 * generate CALL on transient failures, and a response that arrives intact and
 * fails the schema is not a failure of the call. These specs pin the gap,
 * because a consumer who configures `retry` expecting it to re-roll a bad
 * answer has one and cannot see it.
 */

import { expect, test } from '@playwright/test';

import { gotoHydrated } from '../hydration';

type Panel = 'transient' | 'invalid' | 'hook';
const field = (panel: Panel, name: string) => `[data-testid="retry-${panel}-${name}"]`;

test('retries a transient generate failure and resolves the typed output', async ({ page }) => {
	await gotoHydrated(page, '/exercises/retry');

	await expect(page.locator(field('transient', 'calls'))).toHaveText('2');
	await expect(page.locator(field('transient', 'schema-valid'))).toHaveText('true');
	await expect(page.locator(field('transient', 'output'))).toContainText('forty-two');
});

test('does not retry a response that fails the output schema', async ({ page }) => {
	await gotoHydrated(page, '/exercises/retry');

	// One call, not two — and the fixture was willing to answer correctly on a
	// second. It is never asked.
	await expect(page.locator(field('invalid', 'calls'))).toHaveText('1');
	await expect(page.locator(field('invalid', 'schema-valid'))).toHaveText('false');
	await expect(page.locator(field('invalid', 'output'))).toHaveText('(none)');
});

test('does not retry a response rejected by validateResponse either', async ({ page }) => {
	await gotoHydrated(page, '/exercises/retry');

	// Rejecting in the hook is the obvious way to say "ask again". It ends the
	// run instead, which is the second half of the same surprise.
	await expect(page.locator(field('hook', 'calls'))).toHaveText('1');
	await expect(page.locator(field('hook', 'finish'))).toHaveText('error');
	await expect(page.locator(field('hook', 'output'))).toHaveText('(none)');
});

test('the same retry budget produces different call counts', async ({ page }) => {
	await gotoHydrated(page, '/exercises/retry');

	// The comparison is the exercise. All three panels configure
	// `retry: { attempts: 2 }`; only the shape of the failure differs, and only
	// one of them is retried. Asserting each count alone would let a future
	// change make them all agree without failing anything.
	const calls = await Promise.all(
		(['transient', 'invalid', 'hook'] as Panel[]).map((panel) =>
			page.locator(field(panel, 'calls')).innerText()
		)
	);
	expect(calls).toEqual(['2', '1', '1']);
});

test('never renders stale output for a run that produced none', async ({ page }) => {
	await gotoHydrated(page, '/exercises/retry');

	for (const panel of ['invalid', 'hook'] as Panel[]) {
		await expect(page.locator(field(panel, 'output'))).toHaveText('(none)');
		await expect(page.locator(field(panel, 'output'))).not.toContainText('42');
	}
});

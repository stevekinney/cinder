/**
 * A named stop condition ending the loop after one step.
 *
 * The assertion that matters is the negative one — no second generation — and
 * it is invisible in the transcript. A run that took two generate calls and
 * produced nothing the second time renders identically to this one, which is
 * why the fixture counts its own calls.
 */

import { expect, test } from '@playwright/test';

import { gotoHydrated } from '../hydration';

const field = (name: string) => `[data-testid="stop-condition-${name}"]`;

test('takes exactly one generation step', async ({ page }) => {
	await gotoHydrated(page, '/exercises/stop-condition');

	// One, not two. The loop's default is to resolve the tool and generate
	// again to narrate it; the named condition is what prevents that, and this
	// count is the only observable difference.
	await expect(page.locator(field('generate-calls'))).toHaveText('1');
	await expect(page.locator(field('steps'))).toHaveText('1');
});

test('executes the tool exactly once', async ({ page }) => {
	await gotoHydrated(page, '/exercises/stop-condition');

	await expect(page.locator(field('tool-executions'))).toHaveText('1');
	await expect(page.locator(field('tool-result'))).toContainText('4');
});

test('settles as a stop-condition finish rather than an error or a step limit', async ({
	page
}) => {
	await gotoHydrated(page, '/exercises/stop-condition');

	// `stop-condition` specifically: a run that hit `maximum-steps`, or errored
	// out, would also have stopped — and would mean something entirely
	// different about whether the condition did its job.
	await expect(page.locator(field('finish'))).toHaveText('stop-condition');
});

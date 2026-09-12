/**
 * Focus behaviour on the server-owned approval, in every engine.
 *
 * ITS OWN FILE so it can join a cross-engine shard without dragging
 * `server-owned.e2e.ts` — nineteen tests — along with it. `playwright.config.ts`
 * names focus as the most engine-divergent behaviour in this lab and WebKit's
 * focus-on-removal semantics differ from Chromium's, so a regression here
 * passing only in Chromium would be the silent reduction those shards exist to
 * prevent.
 */

import { expect, test } from '@playwright/test';

import { gotoHydrated } from '../exercises/hydration';
import { newFixtureMarker } from '../fixture-probe';
import { fixtureMarker } from '../streaming-fixture';

/** A title no other test will collide with, in this run or a previous one. */
const uniqueTitle = (label: string): string =>
	`${label} ${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

test('answering keeps focus inside the chat', async ({ page }) => {
	// Every path that clears the question removes the focused subtree, and a
	// browser then drops focus to `<body>` — outside the chat's tab context, at
	// the moment the turn resumes. Asserted on the RESULT rather than on the
	// handler, because three separate paths clear `pending` and only one of
	// them used to hand focus off.
	await gotoHydrated(page, '/server-owned');
	const title = uniqueTitle('Approval focus');
	await page.locator('[data-testid="server-owned-new-title"]').fill(title);
	await page.locator('[data-testid="server-owned-create"]').click();
	await page.getByRole('link', { name: new RegExp(title) }).click();
	await page.waitForSelector('body[data-hydrated="true"]');

	const marker = newFixtureMarker();
	const composer = page.getByRole('textbox');
	await composer.fill(fixtureMarker('approval', marker));
	await composer.press('Enter');

	const approve = page.locator('[data-testid="approval-approve"]');
	await expect(approve).toBeVisible();

	// FOCUSED BY KEYBOARD, not clicked — a click leaves focus wherever the
	// browser decides, which would let this pass without the handoff.
	await approve.focus();
	await expect(approve).toBeFocused();
	await approve.press('Enter');

	await expect(page.locator('[data-testid="server-owned-chat"]')).toHaveAttribute(
		'data-streaming',
		'false'
	);

	// NOT `<body>`. The status region is where the consequence of the decision
	// is announced, so it is where focus belongs.
	const landed = await page.evaluate(() => ({
		tag: document.activeElement?.tagName.toLowerCase() ?? '(none)',
		testId: document.activeElement?.getAttribute('data-testid') ?? '(none)'
	}));
	expect(landed.tag).not.toBe('body');
	expect(landed.testId).toBe('approval-question');
});

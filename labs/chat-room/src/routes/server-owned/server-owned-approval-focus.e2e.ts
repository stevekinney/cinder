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

test('a remote answer hands focus back when polling removes the controls', async ({
	page,
	request
}) => {
	await gotoHydrated(page, '/server-owned');
	const title = uniqueTitle('Remote approval focus');
	await page.locator('[data-testid="server-owned-new-title"]').fill(title);
	await page.locator('[data-testid="server-owned-create"]').click();
	await page.getByRole('link', { name: new RegExp(title) }).click();
	await page.waitForSelector('body[data-hydrated="true"]');

	const composer = page.getByRole('textbox');
	await composer.fill(fixtureMarker('approval', newFixtureMarker()));
	await composer.press('Enter');
	const approve = page.locator('[data-testid="approval-approve"]');
	await expect(approve).toBeVisible();
	await approve.focus();

	// The detail page does not expose its id as an attribute; derive it from the
	// current URL so the second client answers the exact question being polled.
	const conversationId = new URL(page.url()).pathname.split('/').at(-1);
	if (conversationId === undefined) throw new Error('conversation id missing from detail URL');
	const pending = await request.get(
		`/api/server-owned/conversations/${conversationId}/elicitation`
	);
	const body = (await pending.json()) as { pending: { callId: string } };
	await request.post(`/api/server-owned/conversations/${conversationId}/elicitation`, {
		data: { approved: false, callId: body.pending.callId }
	});

	await expect(approve).toHaveCount(0);
	await expect(page.locator('[data-testid="approval-question"]')).toBeFocused();
});

test('a remote replacement hands focus back when the pending call changes', async ({ page }) => {
	await gotoHydrated(page, '/server-owned');
	const title = uniqueTitle('Replacement approval focus');
	await page.locator('[data-testid="server-owned-new-title"]').fill(title);
	await page.locator('[data-testid="server-owned-create"]').click();
	await page.getByRole('link', { name: new RegExp(title) }).click();
	await page.waitForSelector('body[data-hydrated="true"]');
	await page.getByRole('textbox').fill(fixtureMarker('approval', newFixtureMarker()));
	await page.getByRole('textbox').press('Enter');

	const approve = page.locator('[data-testid="approval-approve"]');
	await expect(approve).toBeVisible();
	await approve.focus();
	await page.route('**/api/server-owned/conversations/*/elicitation', async (route) => {
		if (route.request().method() !== 'GET') return route.continue();
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				pending: {
					toolName: 'remember_note',
					callId: 'remote-call-b',
					message: 'Save the replacement note?',
					arguments: { text: 'replacement' }
				}
			})
		});
	});

	await expect(page.locator('[data-testid="approval-question"]')).toContainText(
		'Save the replacement note?'
	);
	await expect(page.locator('[data-testid="approval-question"]')).toBeFocused();
});

test('stale approval POST outcomes cannot mutate a removed or replaced question', async ({
	page
}) => {
	await gotoHydrated(page, '/server-owned');
	const title = uniqueTitle('Stale approval outcome');
	await page.locator('[data-testid="server-owned-new-title"]').fill(title);
	await page.locator('[data-testid="server-owned-create"]').click();
	await page.getByRole('link', { name: new RegExp(title) }).click();
	await page.waitForSelector('body[data-hydrated="true"]');
	await page.getByRole('textbox').fill(fixtureMarker('approval', newFixtureMarker()));
	await page.getByRole('textbox').press('Enter');

	const question = page.locator('[data-testid="approval-question"]');
	const approve = page.locator('[data-testid="approval-approve"]');
	const failure = page.locator('[data-testid="server-owned-turn-failure"]');
	await expect(approve).toBeVisible();

	let remoteState: 'server' | 'removed' | 'replaced' = 'server';
	let releasePost: (() => void) | undefined;
	let postOutcome: 'success' | 'conflict' | 'error' | 'network' = 'success';
	await page.route('**/api/server-owned/conversations/*/elicitation', async (route) => {
		if (route.request().method() === 'GET') {
			if (remoteState === 'removed') {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: '{"pending":null}'
				});
				return;
			}
			if (remoteState === 'replaced') {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						pending: {
							toolName: 'remember_note',
							callId: 'remote-replacement',
							message: 'Save the replacement note?',
							arguments: { text: 'replacement' }
						}
					})
				});
				return;
			}
			await route.continue();
			return;
		}

		await new Promise<void>((resolve) => {
			releasePost = resolve;
		});
		if (postOutcome === 'network') {
			await route.abort('failed');
		} else {
			await route.fulfill({
				status: postOutcome === 'conflict' ? 409 : postOutcome === 'error' ? 500 : 200,
				contentType: 'application/json',
				body: postOutcome === 'error' ? JSON.stringify({ error: 'stale approval failed' }) : '{}'
			});
		}
	});

	for (const [index, outcome] of ['success', 'conflict', 'error', 'network'].entries()) {
		postOutcome = outcome as typeof postOutcome;
		remoteState = index % 2 === 0 ? 'removed' : 'replaced';
		releasePost = undefined;
		await approve.focus();
		await approve.press('Enter');
		await expect.poll(() => releasePost !== undefined).toBe(true);
		if (remoteState === 'removed') {
			await expect(approve).toHaveCount(0);
		} else {
			await expect(question).toContainText('replacement note');
		}
		releasePost?.();
		releasePost = undefined;
		await expect(failure).toBeEmpty();
		remoteState = 'server';
		await expect(approve).toBeVisible();
	}
});

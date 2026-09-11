/**
 * The server-owned family's BROWSER paths, split from its sibling spec so the
 * cross-engine shards can run these without also tripling the tests that do
 * not touch a browser.
 *
 * Both tests here drive a real engine path: the create flow's `fetch` plus
 * reload, and the incremental-rendering test, which streams a `ReadableStream`
 * through the page's session controller. That is what the cross-engine shards
 * exist for. The `request`-fixture tests stay in `server-owned.e2e.ts`, where
 * the chromium project's root matcher runs them once — that fixture is a
 * Node-side HTTP client, so three engines would execute identical code three
 * times.
 *
 * Placed in `webkit-2` by measurement: `--list` per project read
 * 49/48/62/51/50, and `webkit-3` is already at the 62 the ceiling note
 * describes.
 *
 * Every test works against a conversation it creates under a unique title.
 * The store is in-memory and per-process, so conversations outlive the test
 * that made them and an assertion on list totals would be order-dependent.
 */

import { expect, test } from '@playwright/test';

import { gotoHydrated } from '../exercises/hydration';
import {
	fixtureGateHeld,
	fixtureRequestCount,
	newFixtureMarker,
	releaseFixtureGate
} from '../fixture-probe';
import { STEPPED_CHUNKS, fixtureMarker } from '../streaming-fixture';

/** A title no other test will collide with, in this run or a previous one. */
const uniqueTitle = (label: string): string =>
	`${label} ${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

test('creates a conversation and renders it in the server-rendered list', async ({ page }) => {
	await gotoHydrated(page, '/server-owned');
	const title = uniqueTitle('Release planning');

	await page.locator('[data-testid="server-owned-new-title"]').fill(title);
	await page.locator('[data-testid="server-owned-create"]').click();

	// The row for THIS conversation, located by its unique title — not the
	// first row, and not a count.
	const row = page.locator('[data-testid="server-owned-conversation"]').filter({ hasText: title });
	await expect(row).toHaveCount(1);
	await expect(row.locator('[data-testid="server-owned-conversation-count"]')).toHaveText(
		'0 messages'
	);
});

test('renders a server-owned reply incrementally, not as a buffered whole', async ({
	page,
	request
}) => {
	const created = await request.post('/api/server-owned/conversations', {
		data: { title: uniqueTitle('Incremental') }
	});
	const { conversation } = (await created.json()) as { conversation: { id: string } };

	const marker = newFixtureMarker();
	await gotoHydrated(page, `/server-owned/${conversation.id}`);

	const log = page.getByRole('log', { name: 'Messages' });
	await page
		.getByRole('textbox', { name: 'Message' })
		.fill(`Walk me through it ${fixtureMarker('stepped', marker)}`);
	await page.getByRole('button', { name: 'Send message' }).click();

	// Gates, not timing. The fixture parks between chunks until this test
	// releases it, so each state below is causally separated from the next
	// rather than separated by a hopeful wait — three renders of one assistant
	// message, which is what "incremental" has to mean to be worth asserting.
	await expect.poll(() => fixtureGateHeld(marker)).toBe(true);

	// One chunk on screen, the rest not yet produced.
	await expect(log).toContainText(STEPPED_CHUNKS[0]);
	await expect(log).not.toContainText(STEPPED_CHUNKS[1]);
	expect(await releaseFixtureGate(marker)).toBe(true);

	// Two. `released: true` again proves the third did not exist when two were
	// rendered — a buffered whole could not produce this state at all.
	await expect(log).toContainText(`${STEPPED_CHUNKS[0]} ${STEPPED_CHUNKS[1]}`);
	await expect(log).not.toContainText(STEPPED_CHUNKS[2]);
	expect(await releaseFixtureGate(marker)).toBe(true);

	// Three, and the turn has unwound.
	await expect(log).toContainText(STEPPED_CHUNKS.join(' '));
	await expect(page.getByRole('button', { name: 'Send message' })).toBeVisible();

	// And the SERVER kept it: a reload re-reads the transcript from the session
	// store. This is the assertion the canonical exemplar cannot make — there
	// the browser owns the transcript, so a reload starts empty.
	await page.reload();
	await page.locator('body[data-hydrated="true"]').waitFor();
	await expect(page.getByRole('log', { name: 'Messages' })).toContainText(STEPPED_CHUNKS.join(' '));
});

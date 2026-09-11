/**
 * The server-owned route family: its label, its list, and its endpoints.
 *
 * Every test works against a conversation it creates under a unique title,
 * and asserts on THAT conversation rather than on list totals. The variant's
 * store is in-memory and per-process, and Playwright runs the whole file
 * against one `preview` server, so conversations outlive the test that made
 * them. A `toHaveCount` on the list would pass alone and fail in a suite —
 * order-dependence dressed up as a flake.
 *
 * NOT added to the cross-engine shards, deliberately. Those exist for real
 * fetch/ReadableStream paths that behave differently per engine, and only one
 * test here is that: the create flow's browser `fetch` plus reload. The other
 * three drive Playwright's `request` fixture, which is a Node-side HTTP client
 * — running them under WebKit and Firefox would execute the identical code
 * three times and prove nothing. If cross-engine coverage of the create flow
 * is wanted, it belongs in its own small spec rather than tripling this file.
 */

import { expect, test } from '@playwright/test';

import { gotoHydrated } from '../exercises/hydration';

/** A title no other test will collide with, in this run or a previous one. */
const uniqueTitle = (label: string): string =>
	`${label} ${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

test('labels itself as the noncanonical variant', async ({ page }) => {
	await gotoHydrated(page, '/server-owned');

	const banner = page.locator('[data-testid="server-owned-banner"]');
	await expect(banner).toBeVisible();
	await expect(banner).toContainText('Noncanonical variant');

	// Points at the canonical exemplar by name, so a reader who lands here
	// first knows where the reference implementation is rather than assuming
	// this is it.
	await expect(banner.locator('a')).toHaveAttribute('href', '/');

	// Standing context, not an event: `alert` would be announced ahead of the
	// page's own heading on every visit.
	await expect(banner).toHaveAttribute('role', 'note');
});

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

test('rejects an empty title at the endpoint rather than storing it', async ({ request }) => {
	const response = await request.post('/api/server-owned/conversations', {
		data: { title: '   ' }
	});

	// 400, and the reason — not a 500 from something downstream discovering
	// the problem later, and not the submitted value echoed back.
	expect(response.status()).toBe(400);
	const body: unknown = await response.json();
	expect((body as { error?: string }).error).toContain('title');
});

test('appends a turn and reports the new count', async ({ request }) => {
	const created = await request.post('/api/server-owned/conversations', {
		data: { title: uniqueTitle('Appending') }
	});
	expect(created.status()).toBe(201);
	const { conversation } = (await created.json()) as { conversation: { id: string } };

	const appended = await request.post(`/api/server-owned/conversations/${conversation.id}/turns`, {
		data: { text: 'What shipped this week?' }
	});
	expect(appended.status()).toBe(201);
	expect((await appended.json()) as { messageCount: number }).toMatchObject({ messageCount: 1 });

	const loaded = await request.get(`/api/server-owned/conversations/${conversation.id}`);
	expect(loaded.status()).toBe(200);
	const body = (await loaded.json()) as { messages: Array<{ role: string }> };
	expect(body.messages).toHaveLength(1);
	expect(body.messages[0].role).toBe('user');
});

test('distinguishes a missing conversation from an empty one', async ({ request }) => {
	const created = await request.post('/api/server-owned/conversations', {
		data: { title: uniqueTitle('Empty') }
	});
	const { conversation } = (await created.json()) as { conversation: { id: string } };

	// Exists, no messages: 200 with an empty transcript.
	const empty = await request.get(`/api/server-owned/conversations/${conversation.id}`);
	expect(empty.status()).toBe(200);
	expect(((await empty.json()) as { messages: unknown[] }).messages).toHaveLength(0);

	// Gone: 404 on both read and append. Collapsing these into one response
	// would leave the page unable to tell "start typing" from "this is gone".
	expect((await request.get('/api/server-owned/conversations/nope')).status()).toBe(404);
	expect(
		(
			await request.post('/api/server-owned/conversations/nope/turns', { data: { text: 'hi' } })
		).status()
	).toBe(404);
});

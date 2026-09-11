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
 * The BROWSER-driving tests live in `server-owned-streaming.e2e.ts`, which is
 * in a cross-engine shard. What remains here drives Playwright's `request`
 * fixture — a Node-side HTTP client — plus one pure rendering check, none of
 * which differ per engine, so the chromium project's root matcher runs them
 * once.
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

test('server-renders the conversation list into the navigation response', async ({ request }) => {
	// The defining contract of this route family, asserted where it is actually
	// observable: in the bytes the server sends, before any script runs.
	//
	// Every other list assertion in this family runs after
	// `body[data-hydrated="true"]`, so moving the list into browser-side
	// startup would leave all of them green while deleting the one property
	// that makes this variant different from the canonical exemplar. Reading
	// the raw response is the only check that notices.
	const title = uniqueTitle('Server rendered');
	const created = await request.post('/api/server-owned/conversations', { data: { title } });
	expect(created.status()).toBe(201);

	const page = await request.get('/server-owned');
	expect(page.status()).toBe(200);
	const html = await page.text();

	// Scoped to the LIST ELEMENT, not searched across the whole document, and
	// the difference is the entire value of this test. SvelteKit serializes the
	// server `load` result into the response for hydration, so `title` appears
	// in a trailing script regardless of what the `{#each}` rendered —
	// `expect(html).toContain(title)` would pass against a list that rendered
	// nothing, which is precisely the regression this is here to catch. An
	// empty `<ul>` would likewise still supply the list marker.
	const listStart = html.indexOf('data-testid="server-owned-list"');
	expect(listStart).toBeGreaterThan(-1);
	const listEnd = html.indexOf('</ul>', listStart);
	expect(listEnd).toBeGreaterThan(listStart);
	const list = html.slice(listStart, listEnd);

	// A row, its title link, and this conversation's title — all inside that
	// slice, so all of them came from the server's own render.
	expect(list).toContain('data-testid="server-owned-conversation"');
	expect(list).toContain('data-testid="server-owned-conversation-title"');
	expect(list).toContain(title);

	// And the live region the create form announces through is in the document
	// too, rather than mounted later by the browser — the same "exists before
	// it has anything to say" rule `error-live-regions.e2e.ts` enforces, here
	// pinned one step earlier, at the server.
	expect(html).toContain('data-testid="server-owned-failure"');
});

test('rejects an empty title at the endpoint rather than storing it', async ({ request }) => {
	// "rather than storing it" is half the claim, and the status code cannot
	// speak to it: a handler that created an empty-titled session and THEN
	// returned 400 would satisfy every assertion below except the last pair,
	// while quietly polluting the list every run.
	const before = await request.get('/api/server-owned/conversations');
	expect(before.status()).toBe(200);
	const listedBefore = (await before.json()) as { conversations: { id: string }[] };

	const response = await request.post('/api/server-owned/conversations', {
		data: { title: '   ' }
	});

	// 400, and the reason — not a 500 from something downstream discovering
	// the problem later, and not the submitted value echoed back.
	expect(response.status()).toBe(400);
	const body: unknown = await response.json();
	expect((body as { error?: string }).error).toContain('title');

	// And nothing was written. Compared by ID rather than by count, so a
	// concurrent create from another test in the same file cannot make this
	// pass or fail for the wrong reason.
	const after = await request.get('/api/server-owned/conversations');
	const listedAfter = (await after.json()) as { conversations: { id: string }[] };
	const added = listedAfter.conversations
		.map((conversation) => conversation.id)
		.filter((id) => !listedBefore.conversations.some((existing) => existing.id === id));
	expect(added).toEqual([]);
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

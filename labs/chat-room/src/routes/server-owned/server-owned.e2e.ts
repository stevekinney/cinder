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
import { newFixtureMarker } from '../fixture-probe';
import { APPROVAL_FOLLOW_UP_TEXT, APPROVAL_NOTE_TEXT, fixtureMarker } from '../streaming-fixture';

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
	const body = (await loaded.json()) as { messages: Array<{ role: string; content: string }> };
	expect(body.messages).toHaveLength(1);
	expect(body.messages[0].role).toBe('user');

	// The submitted TEXT, not just a message of the right role. A handler that
	// passed a constant — or the wrong field of the request body — to
	// `appendUserTurn` satisfies the count and the role, and the service-level
	// tests call `appendUserTurn` directly, so nothing else covers the wiring
	// from this request body to that argument.
	expect(body.messages[0].content).toBe('What shipped this week?');
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

test('centres its capped column instead of pinning it to the left edge', async ({ page }) => {
	// The route caps `main` at 48rem for readability. Capping WITHOUT centring
	// leaves that column against the left edge on any viewport wider than the
	// cap, with the rest of the window empty — which is how it shipped, and is
	// the one route in this lab that set a cap and not the centring.
	//
	// Asserted as symmetry rather than as a computed style: `margin-inline: auto`
	// is one way to achieve it, and this should not fail if the layout is
	// recentred by different means.
	await page.setViewportSize({ width: 1400, height: 900 });
	await page.goto('/server-owned');

	const box = await page.locator('main').boundingBox();
	expect(box).not.toBeNull();
	if (box === null) return;

	const viewport = page.viewportSize();
	expect(viewport).not.toBeNull();
	if (viewport === null) return;

	// Narrower than the viewport, or the cap is not in effect and this asserts
	// nothing.
	expect(box.width).toBeLessThan(viewport.width);

	const left = box.x;
	const right = viewport.width - (box.x + box.width);
	expect(Math.abs(left - right)).toBeLessThanOrEqual(2);
});

test('reports a conversation with no in-flight run as nothing to resume', async ({ request }) => {
	// The benign branch, and the one that must NOT be confused with an orphan.
	// A fresh conversation has never had a run, so `recover()` answers `null`
	// with an empty `failures` array — which is a healthy idle session, not a
	// lost one.
	//
	// Worth pinning precisely because both branches return `null` from
	// `recover()`: if the endpoint ever stops reading the emitter, THIS test
	// keeps passing while the orphan case silently reports benign. So it is the
	// weaker half of the pair and is named as such.
	const created = await request.post('/api/server-owned/conversations', {
		data: { title: uniqueTitle('Recovery') }
	});
	expect(created.status()).toBe(201);
	const { conversation } = (await created.json()) as { conversation: { id: string } };

	// POST, not GET. Asking RECONCILES a stranded run, so the question is not
	// safely repeatable — a prefetch or an infrastructure retry would spend the
	// only orphan diagnosis before anyone saw it.
	const recovery = await request.post(
		`/api/server-owned/conversations/${conversation.id}/recovery`
	);
	expect(recovery.status()).toBe(200);
	// `durability` rides along on every outcome, because "nothing to resume" is
	// the TRUTH under in-memory storage and a bug-shaped surprise under on-disk
	// storage. The suite runs with the variable unset, so `in-memory` is the
	// expected answer here — and asserting it pins that the suite is exercising
	// the default rather than inheriting a database from someone's experiment.
	expect(await recovery.json()).toEqual({
		kind: 'nothing-to-resume',
		durability: 'in-memory'
	});
});

test('distinguishes a missing conversation from one with nothing to resume', async ({
	request
}) => {
	// A 404 rather than a cheerful `nothing-to-resume`, which is the same
	// distinction the conversation endpoint makes: "this does not exist" and
	// "this exists and is idle" are different answers, and collapsing them
	// would let a typo in an id read as a healthy session.
	const missing = await request.post(
		'/api/server-owned/conversations/does-not-exist-at-all/recovery'
	);
	expect(missing.status()).toBe(404);
	expect(await missing.json()).toEqual({ error: 'No such conversation.' });
});

test('the detail route offers the recovery question and names its backing store', async ({
	page,
	request
}) => {
	// A BROWSER test in this file rather than in `server-owned-streaming.e2e.ts`,
	// against that file's stated convention, and deliberately: the two WebKit
	// shards the streaming file sits in are at the 64-context ceiling with no
	// headroom, and nothing about this panel is engine-divergent — it is a fetch
	// and three branches of text. The alternative was rebalancing a shard to add
	// a test that gains nothing from three engines.
	const created = await request.post('/api/server-owned/conversations', {
		data: { title: uniqueTitle('Recovery panel') }
	});
	const { conversation } = (await created.json()) as { conversation: { id: string } };

	await gotoHydrated(page, `/server-owned/${conversation.id}`);

	const status = page.locator('[data-testid="recovery-status"]');
	const durability = page.locator('[data-testid="recovery-durability"]');

	// Mounted and EMPTY before the question is asked. Both halves matter for the
	// same reason the error regions in `error-live-regions.e2e.ts` do: a live
	// region that appears with text already in it is not reliably announced.
	await expect(status).toHaveCount(1);
	await expect(status).toBeEmpty();
	await expect(status).toHaveAttribute('role', 'status');
	await expect(durability).toBeEmpty();

	// The panel is a disclosure, CLOSED by default — expanded it took enough of
	// the fixed-height column to squeeze the transcript to nothing on a short
	// viewport. Its regions are in the DOM either way, which is what the live
	// region rule needs; the control has to be revealed.
	await page.getByText('Durable recovery', { exact: true }).click();

	await page.locator('[data-testid="recovery-check"]').click();

	// The benign branch, which is the honest answer under in-memory storage —
	// and the ANNOUNCEMENT carries the storage, not just the paragraph beside
	// it. A screen reader hearing only "nothing is currently resumable" would
	// not learn that in-memory storage could not have observed a previous run
	// even if one had existed.
	await expect(status).toContainText('Nothing is currently resumable');
	await expect(status).toContainText('No run is in flight');
	await expect(status).toContainText('Storage is in memory');
	await expect(durability).toContainText('CHAT_ROOM_SERVER_OWNED_DATABASE');

	// The orphan branch's list and its once-only note belong to the orphan
	// outcome alone. Asserting their ABSENCE here is what keeps the benign
	// answer from quietly growing a failure list.
	await expect(page.locator('[data-testid="recovery-failures"]')).toHaveCount(0);
	await expect(page.locator('[data-testid="recovery-once"]')).toHaveCount(0);
});

test('answers nothing when no approval is pending, and refuses an answer to a question nobody asked', async ({
	request
}) => {
	const created = await request.post('/api/server-owned/conversations', {
		data: { title: uniqueTitle('Elicitation idle') }
	});
	const { conversation } = (await created.json()) as { conversation: { id: string } };

	const idle = await request.get(`/api/server-owned/conversations/${conversation.id}/elicitation`);
	expect(idle.status()).toBe(200);
	// 200 with `pending: null`, not a 404: "nothing is being asked" is the
	// ordinary state, and a client polling during a turn would otherwise have to
	// treat the routine answer as an error.
	expect(await idle.json()).toEqual({ pending: null });

	const unsolicited = await request.post(
		`/api/server-owned/conversations/${conversation.id}/elicitation`,
		{ data: { approved: true, callId: 'toolu_nothing_pending' } }
	);
	// 409, not a silent 200. The conversation exists; what is absent is a
	// question — so this answer arrived after the run ended or after another
	// client answered first, and a 200 would tell the caller its click landed.
	expect(unsolicited.status()).toBe(409);
	expect(await unsolicited.json()).toEqual({
		error: 'This conversation is not waiting on an approval.'
	});
});

test('rejects a malformed approval body at the boundary', async ({ request }) => {
	const created = await request.post('/api/server-owned/conversations', {
		data: { title: uniqueTitle('Elicitation malformed') }
	});
	const { conversation } = (await created.json()) as { conversation: { id: string } };

	// Validated where the contract is owned, before it can propagate into a
	// generic downstream failure — the same rule the turn endpoint follows.
	const wrongType = await request.post(
		`/api/server-owned/conversations/${conversation.id}/elicitation`,
		{ data: { approved: 'yes', callId: 'toolu_1' } }
	);
	expect(wrongType.status()).toBe(400);

	// A missing `callId` is rejected too. It is what binds an answer to the
	// question it was shown for, so an answer without one could settle whatever
	// happens to be pending.
	const noCallId = await request.post(
		`/api/server-owned/conversations/${conversation.id}/elicitation`,
		{ data: { approved: true } }
	);
	expect(noCallId.status()).toBe(400);

	const notJson = await request.post(
		`/api/server-owned/conversations/${conversation.id}/elicitation`,
		{ headers: { 'content-type': 'application/json' }, data: 'not json at all' }
	);
	expect(notJson.status()).toBe(400);

	const missing = await request.post('/api/server-owned/conversations/nope/elicitation', {
		data: { approved: true }
	});
	expect(missing.status()).toBe(404);
});

test('a person approving the note lets the tool run', async ({ request }) => {
	const created = await request.post('/api/server-owned/conversations', {
		data: { title: uniqueTitle('Elicitation approved') }
	});
	const { conversation } = (await created.json()) as { conversation: { id: string } };

	const marker = newFixtureMarker();
	// NOT awaited yet. The run parks inside its step waiting on the question, so
	// awaiting the stream here would deadlock against the answer below — which
	// is the whole difference from the browser-owned route, where the run STOPS
	// and the client starts a second request.
	const turn = request.post(`/api/server-owned/conversations/${conversation.id}/stream`, {
		data: { text: fixtureMarker('approval', marker) }
	});

	const pending = await expect
		.poll(
			async () => {
				const response = await request.get(
					`/api/server-owned/conversations/${conversation.id}/elicitation`
				);
				const body = (await response.json()) as {
					pending: { toolName: string; message: string; arguments: { text?: string } } | null;
				};
				return body.pending;
			},
			{ message: 'the run never asked for approval' }
		)
		.not.toBeNull();
	void pending;

	const asked = await request.get(`/api/server-owned/conversations/${conversation.id}/elicitation`);
	const question = (await asked.json()) as {
		pending: { toolName: string; callId: string; message: string; arguments: { text?: string } };
	};
	expect(question.pending.toolName).toBe('remember_note');
	expect(question.pending.message).toBe('Save this note?');
	// The MODEL'S proposed arguments, so the person is approving a specific note
	// rather than a category of action.
	expect(question.pending.arguments.text).toBe(APPROVAL_NOTE_TEXT);

	const answered = await request.post(
		`/api/server-owned/conversations/${conversation.id}/elicitation`,
		{ data: { approved: true, callId: question.pending.callId } }
	);
	expect(answered.status()).toBe(200);

	const body = await (await turn).text();
	// The tool RAN, which is the claim: an approval that produced no settled
	// result would mean the hook let the call through and something else dropped
	// it.
	expect(body).toContain('"type":"tool.settled"');
	expect(body).toContain('"outcome":"success"');
	expect(body).toContain(APPROVAL_NOTE_TEXT);
	expect(body).toContain('"type":"run.completed"');
});

test('a person denying the note drops the call without failing the run', async ({ request }) => {
	const created = await request.post('/api/server-owned/conversations', {
		data: { title: uniqueTitle('Elicitation denied') }
	});
	const { conversation } = (await created.json()) as { conversation: { id: string } };

	const marker = newFixtureMarker();
	const turn = request.post(`/api/server-owned/conversations/${conversation.id}/stream`, {
		data: { text: fixtureMarker('approval', marker) }
	});

	await expect
		.poll(async () => {
			const response = await request.get(
				`/api/server-owned/conversations/${conversation.id}/elicitation`
			);
			return ((await response.json()) as { pending: unknown }).pending;
		})
		.not.toBeNull();

	const asked = await request.get(`/api/server-owned/conversations/${conversation.id}/elicitation`);
	const { pending } = (await asked.json()) as { pending: { callId: string } };

	await request.post(`/api/server-owned/conversations/${conversation.id}/elicitation`, {
		data: { approved: false, callId: pending.callId }
	});

	const body = await (await turn).text();
	// The model PROPOSED the call, and the denial is REPORTED rather than left
	// as an absence. This assertion used to pin `not.toContain('tool.settled')`,
	// which described the defect instead of the contract: Operative seals a
	// filtered call in the conversation but dispatches no event, so the client's
	// pending tool row stayed pending until another turn or a reload cleared it.
	expect(body).toContain('"type":"tool_call"');
	expect(body).toContain('"type":"tool_result"');
	expect(body).toContain('"outcome":"error"');
	expect(body).toContain('did not run');

	// And the run COMPLETED. `ctx.elicit` returns `null` rather than throwing, so
	// a denial is the hook's decision and not a terminal — which is the
	// difference from `ElicitationDeniedError`, the shape a denial takes when a
	// tool throws on one.
	expect(body).toContain('"type":"run.completed"');
	expect(body).not.toContain('"type":"run.error"');

	// The question is gone either way, so the next turn can ask its own.
	const afterwards = await request.get(
		`/api/server-owned/conversations/${conversation.id}/elicitation`
	);
	expect(await afterwards.json()).toEqual({ pending: null });
});

test('a person approves the note in the browser and the turn completes', async ({ page }) => {
	// The whole point of the elicitation path, driven the way a person drives
	// it. The request-fixture specs above prove the endpoints; this proves there
	// is a way to reach them without one — which is what makes the feature
	// operable rather than merely present.
	await gotoHydrated(page, '/server-owned');
	const title = uniqueTitle('Browser approval');
	await page.locator('[data-testid="server-owned-new-title"]').fill(title);
	await page.locator('[data-testid="server-owned-create"]').click();

	// Creating ADDS TO THE LIST; it does not navigate. Following the new
	// conversation's own link is how a person reaches the detail route, and
	// asserting on that link by title is what keeps this test independent of
	// every other conversation the suite leaves behind in the shared process.
	await page.getByRole('link', { name: new RegExp(title) }).click();
	await page.waitForSelector('body[data-hydrated="true"]');

	const question = page.locator('[data-testid="approval-question"]');

	// Mounted and empty before anything asks — the same live-region rule every
	// announcing region in this lab follows.
	await expect(question).toHaveCount(1);
	await expect(question).toBeEmpty();
	await expect(page.locator('[data-testid="approval-approve"]')).toHaveCount(0);

	const marker = newFixtureMarker();
	const composer = page.getByRole('textbox');
	await composer.fill(fixtureMarker('approval', marker));
	await composer.press('Enter');

	await expect(question).toContainText('Save this note?');
	await expect(question).toContainText('remember_note');

	// The MODEL'S own argument, so the person approves a specific note — in its
	// own disclosure rather than inside the announcement. A note has no length
	// limit, and rendering it inline took the transcript's space on a short
	// viewport; `<summary>` also gives the keyboard path for free, which a
	// bounded scroll box could not without a dead tab stop.
	const proposed = page.locator('[data-testid="approval-arguments"]');
	await expect(proposed).toContainText('remember_note');
	await proposed.getByRole('group').or(proposed.locator('summary')).first().click();
	await expect(proposed).toContainText(APPROVAL_NOTE_TEXT);

	await page.locator('[data-testid="approval-approve"]').click();

	// SETTLED FIRST, then judged. The ordering is the whole difference between
	// this test and the hollow version it replaces: `toBeEmpty()` on the failure
	// banner passes the instant it is called, so checking it before the turn
	// finished passed even with the continuation bug deliberately restored.
	// `data-streaming` only flips false after the controller's continuation loop
	// has run to its end, which is where that failure lands.
	await expect(page.locator('[data-testid="server-owned-chat"]')).toHaveAttribute(
		'data-streaming',
		'false'
	);

	// The assistant's REPLY arrived, which is what "the turn completed" means.
	// The approved tool alone proves only that the side effect ran; the follow-up
	// is what the run produced after it, in the same response.
	await expect(page.locator('[data-testid="server-owned-chat"]')).toContainText(
		APPROVAL_FOLLOW_UP_TEXT
	);

	// And no failure. This is the regression that made the browser path
	// unusable: the tool succeeded server-side, the session controller asked for
	// a continuation, and the transport threw — marking the turn failed right
	// after its side effect had landed.
	await expect(page.locator('[data-testid="server-owned-turn-failure"]')).toBeEmpty();

	// And the controls are gone, because a question that is answered is not a
	// control anyone should be able to press again.
	await expect(page.locator('[data-testid="approval-approve"]')).toHaveCount(0);
	await expect(question).toBeEmpty();

	// THE PERSISTED ORDER IS THE CORRECT ONE, and it is what this pins.
	//
	// Live, the two model steps of one response land in a single assistant row
	// and the follow-up text renders ABOVE the tool disclosure it is replying
	// about — the session controller inserts one assistant placeholder before
	// reading any frames, so the second step's text goes back into a row that
	// already precedes the tool activity. Measured:
	//
	//   live:   You … | Assistant "Saved that note." Called 1 tool … Succeeded
	//   reload: You … | Assistant Called 1 tool … Succeeded | Assistant "Saved that note."
	//
	// Delineating assistant steps belongs to the wire and the controller in
	// `@lostgradient/chat`, which this issue's delivery boundary excludes —
	// CIN-615 carries it with these measurements. What is asserted here is the
	// half that IS this route's to keep true: the server's own history, which a
	// reload renders, puts the tool before the reply.
	await page.reload();
	await page.waitForSelector('body[data-hydrated="true"]');

	const persisted = await page
		.locator('[data-testid="server-owned-chat"]')
		.evaluate((root) => (root.textContent ?? '').replace(/\s+/g, ' ').trim());

	const toolAt = persisted.indexOf('remember_note');
	const replyAt = persisted.indexOf(APPROVAL_FOLLOW_UP_TEXT);
	expect(toolAt).toBeGreaterThan(-1);
	expect(replyAt).toBeGreaterThan(-1);
	expect(toolAt).toBeLessThan(replyAt);
});

test('the transcript survives a short viewport instead of collapsing to nothing', async ({
	page,
	request
}) => {
	// A REGRESSION TEST for a measured collapse, not a precaution. The detail
	// route is a fixed-height flex column, and adding the approval region and
	// the recovery panel to it gave the non-flexible children more than the
	// viewport: at 844x390 the transcript and composer resolved to exactly 0px,
	// leaving a page nobody could read or type into.
	//
	// The assertion is on the RENDERED HEIGHT rather than on the CSS, because
	// the CSS that produced the collapse was individually reasonable — a fixed
	// `100dvh` column and a `min-block-size: 0` flex child — and only the
	// combination was wrong. A rule-shaped assertion would have passed.
	const created = await request.post('/api/server-owned/conversations', {
		data: { title: uniqueTitle('Short viewport') }
	});
	const { conversation } = (await created.json()) as { conversation: { id: string } };

	// Phone landscape, the shape this was measured collapsing at.
	await page.setViewportSize({ width: 844, height: 390 });
	await gotoHydrated(page, `/server-owned/${conversation.id}`);

	// Measured with the recovery panel CLOSED, which is how it loads. That is
	// the fix: expanded it consumed 200-285px of a fixed-height column whose
	// only flexible child is the transcript.

	const height = await page
		.locator('[data-testid="server-owned-chat"]')
		.evaluate((element) => Math.round(element.getBoundingClientRect().height));

	// A floor, not an exact number: the point is that the transcript is usable,
	// and pinning the precise height would fail on every future change to the
	// panel's copy.
	expect(height).toBeGreaterThan(100);

	// And the composer is reachable, which is the other half of usable — a
	// transcript with a floor still fails the user if the page cannot scroll to
	// what sits below it.
	await expect(page.getByRole('textbox')).toBeVisible();
});

test('a denied note leaves no tool row pending in the browser', async ({ page }) => {
	// The BROWSER half of the denial. The endpoint spec above reads the wire;
	// this reads what a person is left looking at, which is where the defect
	// actually showed: the client renders a pending row from `tool_call` and
	// settles it on a result, so a denial that produced no result left that row
	// pending until another turn or a reload cleared it.
	await gotoHydrated(page, '/server-owned');
	const title = uniqueTitle('Browser denial');
	await page.locator('[data-testid="server-owned-new-title"]').fill(title);
	await page.locator('[data-testid="server-owned-create"]').click();
	await page.getByRole('link', { name: new RegExp(title) }).click();
	await page.waitForSelector('body[data-hydrated="true"]');

	const marker = newFixtureMarker();
	const composer = page.getByRole('textbox');
	await composer.fill(fixtureMarker('approval', marker));
	await composer.press('Enter');

	await expect(page.locator('[data-testid="approval-question"]')).toContainText('Save this note?');
	await page.locator('[data-testid="approval-deny"]').click();

	await expect(page.locator('[data-testid="server-owned-chat"]')).toHaveAttribute(
		'data-streaming',
		'false'
	);

	// SETTLED, and settled as a refusal. The row reads `remember_note Failed`
	// rather than staying pending — which is the whole finding: the client
	// renders a pending row from the `tool_call` frame and resolves it on a
	// result, and a denial used to produce no result at all.
	//
	// `Failed` is the rendered state; the message itself sits inside the row's
	// Result disclosure, so asserting the status is asserting what a reader
	// actually sees without opening anything.
	const chat = page.locator('[data-testid="server-owned-chat"]');
	await expect(chat).toContainText('remember_note');
	await expect(chat).toContainText('Failed');

	// The turn itself did not fail — a denial is a decision, not an error.
	await expect(page.locator('[data-testid="server-owned-turn-failure"]')).toBeEmpty();
});

test('a long approval question leaves the transcript its space', async ({ page }) => {
	// The gap the idle viewport test leaves: it measures before anything is
	// pending, and the approval question is the one region that appears MID-TURN
	// and renders content whose length the model chooses. The tool's schema puts
	// no limit on `text`, so an unbounded prompt grows with whatever was written
	// — inside a fixed-viewport-height column whose only flexible child is the
	// transcript.
	//
	// The `approval-long` fixture scenario proposes a note long enough to show
	// it. A short note could not: the defect is proportional to the argument.
	await page.setViewportSize({ width: 844, height: 390 });
	await gotoHydrated(page, '/server-owned');
	const title = uniqueTitle('Long approval');
	await page.locator('[data-testid="server-owned-new-title"]').fill(title);
	await page.locator('[data-testid="server-owned-create"]').click();
	await page.getByRole('link', { name: new RegExp(title) }).click();
	await page.waitForSelector('body[data-hydrated="true"]');

	const chat = page.locator('[data-testid="server-owned-chat"]');
	const idleHeight = await chat.evaluate((element) =>
		Math.round(element.getBoundingClientRect().height)
	);

	const marker = newFixtureMarker();
	const composer = page.getByRole('textbox');
	await composer.fill(fixtureMarker('approval-long', marker));
	await composer.press('Enter');

	const question = page.locator('[data-testid="approval-question"]');
	await expect(question).toContainText('Save this note?');

	// MEASURED WHILE THE QUESTION IS UP, which is the whole point — the idle
	// measurement in the sibling test cannot see a region that only exists
	// mid-turn and whose size the model chooses.
	const metrics = await page.evaluate(() => {
		const chatElement = document.querySelector('[data-testid="server-owned-chat"]');
		const proposed = document.querySelector('[data-testid="approval-arguments"]');
		return {
			chat: chatElement ? Math.round(chatElement.getBoundingClientRect().height) : -1,
			proposed: proposed ? Math.round(proposed.getBoundingClientRect().height) : -1,
			// Closed on arrival, which is what keeps it to one line.
			open: proposed instanceof HTMLDetailsElement ? proposed.open : true
		};
	});

	// The transcript is still usable. A floor rather than an exact number: the
	// claim is that a long note cannot consume the transcript, not that the
	// layout never changes.
	expect(metrics.chat).toBeGreaterThan(100);
	// And the note costs one line until someone asks for it, however long it is.
	expect(metrics.open).toBe(false);
	expect(metrics.proposed).toBeLessThan(idleHeight);

	// Answer it, so the turn does not stay parked for the next test in this file.
	await page.locator('[data-testid="approval-deny"]').click();
	await expect(chat).toHaveAttribute('data-streaming', 'false');
});

test('a failed recovery check says so in its alert', async ({ page, request }) => {
	// THE INJECTION HALF. `error-live-regions.e2e.ts` pins that this region is
	// mounted and empty before anything fails; nothing covered what happens
	// when something does, so deleting both failure assignments in the panel
	// left every test green.
	//
	// The failure is produced by intercepting the request rather than by
	// breaking the server, because the panel's contract is about what it does
	// with a response it cannot use — and a 503 is the shape this route family
	// actually returns while shutting down.
	const created = await request.post('/api/server-owned/conversations', {
		data: { title: uniqueTitle('Recovery failure') }
	});
	const { conversation } = (await created.json()) as { conversation: { id: string } };

	await gotoHydrated(page, `/server-owned/${conversation.id}`);
	await page.getByText('Durable recovery', { exact: true }).click();

	const alert = page.locator('[data-testid="recovery-error"]');
	await expect(alert).toBeEmpty();

	await page.route(`**/api/server-owned/conversations/${conversation.id}/recovery`, (route) =>
		route.fulfill({
			status: 503,
			contentType: 'application/json',
			body: JSON.stringify({ error: 'The server is shutting down. Try again in a moment.' })
		})
	);

	await page.locator('[data-testid="recovery-check"]').click();

	// THE SERVER'S SENTENCE, not the JSON envelope — the same rule the
	// streaming surface follows.
	await expect(alert).toContainText('shutting down');
	await expect(alert).not.toContainText('{');
	// And the outcome regions stay empty, because nothing was classified.
	await expect(page.locator('[data-testid="recovery-status"]')).toBeEmpty();

	// A network failure reaches the same region with its own sentence, which is
	// the second assignment the old coverage could not see.
	await page.unroute(`**/api/server-owned/conversations/${conversation.id}/recovery`);
	await page.route(`**/api/server-owned/conversations/${conversation.id}/recovery`, (route) =>
		route.abort('failed')
	);

	await page.locator('[data-testid="recovery-check"]').click();
	await expect(alert).toContainText('could not reach the server');
});

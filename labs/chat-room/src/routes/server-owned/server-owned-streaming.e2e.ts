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

test('creates a conversation through the browser and finds it in the list after a reload', async ({
	page
}) => {
	await gotoHydrated(page, '/server-owned');
	const title = uniqueTitle('Release planning');

	await page.locator('[data-testid="server-owned-new-title"]').fill(title);

	// The RELOAD is the behaviour, not an implementation detail of it. The
	// route reloads rather than splicing the POST response into the list
	// precisely because the list is the server's to render — so a change to a
	// client-side insertion would keep the row assertion below green while
	// deleting the property the route exists to demonstrate. Waiting on the
	// document navigation is what notices.
	const reloaded = page.waitForNavigation({ waitUntil: 'load' });
	await page.locator('[data-testid="server-owned-create"]').click();
	const navigation = await reloaded;
	expect(navigation?.url()).toContain('/server-owned');
	await page.locator('body[data-hydrated="true"]').waitFor();

	// The row for THIS conversation, located by its unique title — not the
	// first row, and not a count.
	//
	// That the list is SERVER-rendered is still not what this test shows: the
	// assertions below run after hydration. `server-owned.e2e.ts` asserts that
	// separately, against the navigation response's raw HTML.
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
	// Asserted before the body is read. Without this, an endpoint returning a
	// 500 or an HTML error page fails on the next line as a JSON parse or a
	// destructure of `undefined` — a shape error that names nothing about the
	// request that actually failed.
	expect(created.status()).toBe(201);
	const { conversation } = (await created.json()) as { conversation: { id: string } };

	const marker = newFixtureMarker();
	await gotoHydrated(page, `/server-owned/${conversation.id}`);

	// The turn-failure live region exists BEFORE anything can fail, which is
	// the invariant `error-live-regions.e2e.ts` enforces for every other banner
	// in this repository. It cannot be asserted there because that spec walks
	// static routes and this one needs a conversation to exist first.
	const turnFailure = page.getByTestId('server-owned-turn-failure');
	await expect(turnFailure).toHaveCount(1);
	await expect(turnFailure).toBeEmpty();
	await expect(turnFailure).toHaveAttribute('role', 'alert');

	const log = page.getByRole('log', { name: 'Messages' });
	const prompt = `Walk me through it ${fixtureMarker('stepped', marker)}`;
	await page.getByRole('textbox', { name: 'Message' }).fill(prompt);
	await page.getByRole('button', { name: 'Send message' }).click();

	// Gates, not timing. The fixture parks between chunks until this test
	// releases it, so each state below is causally separated from the next
	// rather than separated by a hopeful wait — three renders of one assistant
	// message, which is what "incremental" has to mean to be worth asserting.
	// Separated from the assertions below on purpose: "the preview server never
	// reached the fixture" and "the stream rendered wrong" are different
	// failures, and without this they are indistinguishable from whichever
	// assertion happens to fail first. (This guard was lost once already, in
	// the edit that removed an over-eager polling timeout from the line below.)
	await expect
		.poll(() => fixtureRequestCount(marker), {
			message: `the preview server never reached the fixture for ${marker} — is ANTHROPIC_BASE_URL set on its webServer entry?`
		})
		.toBeGreaterThan(0);

	await expect.poll(() => fixtureGateHeld(marker)).toBe(true);

	// One chunk on screen, the rest not yet produced.
	await expect(log).toContainText(STEPPED_CHUNKS[0]);
	await expect(log).not.toContainText(STEPPED_CHUNKS[1]);

	// Mid-stream, and this is where `streaming` proves it reached `<Chat>`
	// rather than only the page's own attribute: Stop generating is a control
	// the component renders from that prop alone. Left at its default the
	// composer would still offer Send here, and a user with a slow response and
	// no way to cancel it is the failure this assertion exists for.
	await expect(page.getByRole('button', { name: 'Stop generating' })).toBeVisible();
	await expect(page.locator('[data-testid="server-owned-chat"]')).toHaveAttribute(
		'data-streaming',
		'true'
	);

	expect(await releaseFixtureGate(marker)).toBe(true);

	// Two. `released: true` again proves the third did not exist when two were
	// rendered — a buffered whole could not produce this state at all.
	await expect(log).toContainText(`${STEPPED_CHUNKS[0]} ${STEPPED_CHUNKS[1]}`);
	await expect(log).not.toContainText(STEPPED_CHUNKS[2]);
	expect(await releaseFixtureGate(marker)).toBe(true);

	// Three, and the turn has unwound.
	await expect(log).toContainText(STEPPED_CHUNKS.join(' '));
	await expect(page.getByRole('button', { name: 'Send message' })).toBeVisible();

	// `streaming` has unwound in the component too: Send is back, and Stop
	// generating — which Chat renders only while a response is in flight — is
	// gone.
	await expect(page.locator('[data-testid="server-owned-chat"]')).toHaveAttribute(
		'data-streaming',
		'false'
	);
	await expect(page.getByRole('button', { name: 'Stop generating' })).toHaveCount(0);

	// And the SERVER kept it: a reload re-reads the transcript from the session
	// store. This is the assertion the canonical exemplar cannot make — there
	// the browser owns the transcript, so a reload starts empty.
	await page.reload();
	await page.locator('body[data-hydrated="true"]').waitFor();

	const reloadedLog = page.getByRole('log', { name: 'Messages' });
	await expect(reloadedLog).toContainText(STEPPED_CHUNKS.join(' '));

	// BOTH turns, with their roles. Asserting only the assistant's chunks would
	// stay green on a session-handle path that persisted the reply while
	// dropping or corrupting the prompt that produced it — and the prompt is
	// the half this route family is about, since `handle.run(text)` is what
	// appends it. The `/turns` endpoint test does not cover this path: it posts
	// directly rather than going through the stream.
	await expect(reloadedLog).toContainText(prompt);
	await expect(reloadedLog.getByRole('article', { name: 'You' })).toHaveCount(1);
	await expect(reloadedLog.getByRole('article', { name: 'Assistant' })).toHaveCount(1);
});

test('the transcript scrolls, not the page, once the conversation outgrows the viewport', async ({
	page,
	request
}) => {
	// Chat's root is `height: 100%`, which against an auto-height ancestor
	// resolves to auto — the transcript viewport then sizes to its content and
	// the PAGE scrolls instead. That renders, and looks correct with two
	// messages, so it is only wrong once there are enough of them: exactly the
	// regression a screenshot would miss and a reader would hit immediately.
	const created = await request.post('/api/server-owned/conversations', {
		data: { title: uniqueTitle('Layout') }
	});
	expect(created.status()).toBe(201);
	const { conversation } = (await created.json()) as { conversation: { id: string } };

	for (const size of [
		{ width: 1280, height: 860 },
		{ width: 390, height: 844 }
	]) {
		await page.setViewportSize(size);
		await gotoHydrated(page, `/server-owned/${conversation.id}`);

		// Enough turns that an auto-height transcript would grow past the
		// viewport. Gated on the transcript actually overflowing rather than on
		// a turn count, so this keeps meaning the same thing if row heights or
		// the fixture's reply length change.
		const log = page.getByRole('log', { name: 'Messages' });
		const chat = page.locator('[data-testid="server-owned-chat"]');
		const overflows = async (): Promise<boolean> =>
			log.evaluate((element) => element.scrollHeight > element.clientHeight + 1);

		// CAPPED. An unbounded send loop reports a regression as a bare 30-second
		// timeout naming nothing; the cap plus the assertion below names the
		// property that failed. Eight turns overflow both viewports with room to
		// spare — this is a ceiling, not a target.
		const MAXIMUM_TURNS = 12;
		const messages = log.getByRole('article');
		let sent = 0;

		while (!(await overflows()) && sent < MAXIMUM_TURNS) {
			await page.getByRole('textbox', { name: 'Message' }).fill('Walk me through it');
			await page.getByRole('button', { name: 'Send message' }).click();
			sent += 1;

			// Both gates, in this order, and neither alone is enough. The count
			// proves the assistant's reply has begun arriving — so streaming has
			// definitely started — and only then does `data-streaming` going
			// false mean the turn UNWOUND rather than never having begun.
			//
			// Send being enabled and the composer being empty are both true
			// before a run starts too, so gating on those would let the next
			// `fill` land mid-run, where the controller's already-running guard
			// drops it silently. That silent drop is the same one this route
			// disables Retry over.
			await expect(messages).toHaveCount(sent * 2);
			await expect(chat).toHaveAttribute('data-streaming', 'false');
		}

		// Named rather than left to the loop's exit condition: a transcript that
		// never overflows is the defect itself, and it should say so.
		expect(await overflows()).toBe(true);

		// The transcript overflows — and the DOCUMENT still does not. Both halves
		// are needed: page-scroll is what a collapsed viewport produces, and
		// asserting only that the page fits would pass on an empty conversation.
		const metrics = await page.evaluate(() => ({
			documentScroll: document.documentElement.scrollHeight,
			viewport: window.innerHeight,
			bodyScrollWidth: document.body.scrollWidth,
			viewportWidth: window.innerWidth
		}));

		// `chat` is read above; referenced here so the wrapper's role in the
		// gate is obvious to a reader scanning only the assertions.
		await expect(chat).toHaveAttribute('data-streaming', 'false');

		expect(metrics.documentScroll).toBeLessThanOrEqual(metrics.viewport);
		// And nothing pushes the page sideways at 390px, which is where a
		// `max-content` track or an uncapped payload would show up first.
		expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth);
	}
});

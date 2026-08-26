import { expect, test } from '@playwright/test';
import { gotoHydrated } from '../hydration';

test('scroll state binds and jump-to-latest fires when new messages arrive while scrolled up', async ({
	page
}) => {
	await gotoHydrated(page, '/exercises/history-scroll');

	const atBottom = page.getByTestId('history-scroll-at-bottom');
	const unreadCount = page.getByTestId('history-scroll-unread-count');
	const indicatorVisible = page.getByTestId('history-scroll-indicator-visible');
	const eventLog = page.getByTestId('history-scroll-event-log-item');

	// Seeded with a long transcript; Chat starts pinned to the bottom.
	await expect(atBottom).toHaveText('true');
	await expect(unreadCount).toHaveText('0');
	await expect(indicatorVisible).toHaveText('false');

	// Scroll away from the bottom deterministically via the imperative API
	// rather than a real wheel gesture.
	await page.getByTestId('history-scroll-scroll-top').click();
	await expect(atBottom).toHaveText('false');
	await expect(eventLog.last()).toHaveText('scrollstatechange: atBottom=false');

	// A message arrives while scrolled away: unreadCount/newMessageIndicatorVisible
	// bind up, onunreadindicatorchange fires, and the jump-to-latest button appears.
	await page.getByTestId('history-scroll-simulate-incoming').click();
	await expect(unreadCount).toHaveText('1');
	await expect(indicatorVisible).toHaveText('true');
	await expect(eventLog.last()).toContainText('unreadindicatorchange: unreadCount=1 visible=true');

	const jumpButton = page.getByRole('button', { name: /Jump to/ });
	await expect(jumpButton).toBeVisible();

	// Clicking Chat's own jump-to-latest button fires onjumptolatest and
	// scrolls back to the bottom, clearing the unread state.
	await jumpButton.click();
	await expect(eventLog.last()).toHaveText('jumptolatest');
	await expect(atBottom).toHaveText('true');
	await expect(unreadCount).toHaveText('0');
	await expect(indicatorVisible).toHaveText('false');
});

test('bottomThreshold override widens the "at bottom" zone', async ({ page }) => {
	await gotoHydrated(page, '/exercises/history-scroll');

	const atBottom = page.getByTestId('history-scroll-at-bottom');

	// An enormous bottomThreshold means the full scroll-to-top distance still
	// counts as "at bottom" (distanceFromBottom <= bottomThreshold).
	await page.getByTestId('history-scroll-bottom-threshold').fill('100000');
	await page.getByTestId('history-scroll-scroll-top').click();
	await expect(atBottom).toHaveText('true');

	// Resetting to the library default lets scrolling to the top actually
	// register as scrolled away from the bottom again.
	await page.getByTestId('history-scroll-bottom-threshold').fill('150');
	await page.getByTestId('history-scroll-scroll-top').click();
	await expect(atBottom).toHaveText('false');
});

test('jumpThreshold override suppresses the jump-to-latest button until reset', async ({
	page
}) => {
	await gotoHydrated(page, '/exercises/history-scroll');

	// A very high jumpThreshold means the scroll-to-top distance never crosses
	// it, so the far-scrolled jump button doesn't render — but Chat still
	// shows its separate "new message indicator" toast (`.chat-new-indicator`,
	// gated on unread state alone, not on jumpThreshold) once a message
	// arrives, and it renders with the same "Jump to N new messages"
	// accessible name as the jump button. Scope by class to tell the two
	// apart rather than `getByRole('button', { name: /Jump to/ })`, which
	// matches both.
	const jumpButton = page.locator('.chat-jump-button');

	await page.getByTestId('history-scroll-jump-threshold').fill('100000');
	await page.getByTestId('history-scroll-scroll-top').click();
	await expect(page.getByTestId('history-scroll-at-bottom')).toHaveText('false');
	// Synchronize on the scrollstatechange event, not just the bound prop:
	// appending before Chat's scroll tracking has settled races the unread
	// bookkeeping this test is asserting on.
	await expect(page.getByTestId('history-scroll-event-log-item').last()).toHaveText(
		'scrollstatechange: atBottom=false'
	);
	await page.getByTestId('history-scroll-simulate-incoming').click();

	await expect(page.getByTestId('history-scroll-unread-count')).toHaveText('1');
	await expect(jumpButton).toHaveCount(0);

	// Resetting jumpThreshold back to the library default lets the button
	// reappear once threshold and unread state actually agree.
	await page.getByTestId('history-scroll-jump-threshold').fill('200');
	await page.getByTestId('history-scroll-scroll-top').click();
	await expect(jumpButton).toBeVisible();
});

test('history pagination via adapter.loadOlderMessages prepends pages and exhausts moreHistoryAvailable', async ({
	page
}) => {
	await gotoHydrated(page, '/exercises/history-scroll');

	const messageCount = page.getByTestId('history-scroll-message-count');
	const pagesRemaining = page.getByTestId('history-scroll-pages-remaining');
	const moreHistory = page.getByTestId('history-scroll-more-history');
	const loadEarlier = page.getByRole('button', { name: 'Load earlier messages (custom)' });

	await expect(messageCount).toHaveText('60');
	await expect(pagesRemaining).toHaveText('3');
	await expect(moreHistory).toHaveText('true');
	await expect(loadEarlier).toBeVisible();

	// `loadEarlier.click()` scrolls the trigger into view first (it sits above
	// the currently-loaded messages), which is itself a legitimate scroll
	// away from the bottom — Chat may log a trailing `scrollstatechange`
	// entry after the "loaded a page" one. Assert the log contains the
	// expected entry rather than assuming it's strictly the last one.
	await loadEarlier.click();
	await expect(messageCount).toHaveText('64');
	await expect(pagesRemaining).toHaveText('2');
	await expect(
		page
			.getByTestId('history-scroll-event-log-item')
			.getByText('adapter: loaded a page, hasMore=true', { exact: true })
	).toBeVisible();

	await loadEarlier.click();
	await expect(messageCount).toHaveText('68');
	await expect(pagesRemaining).toHaveText('1');

	// Third and final page exhausts the queue: moreHistoryAvailable flips to
	// false and Chat hides the "Load earlier messages" trigger entirely.
	await loadEarlier.click();
	await expect(messageCount).toHaveText('72');
	await expect(pagesRemaining).toHaveText('0');
	await expect(moreHistory).toHaveText('false');
	await expect(
		page
			.getByTestId('history-scroll-event-log-item')
			.getByText('adapter: loaded a page, hasMore=false', { exact: true })
	).toBeVisible();
	await expect(loadEarlier).toHaveCount(0);
});

test('history pagination via onLoadHistory callback (no adapter.loadOlderMessages)', async ({
	page
}) => {
	await gotoHydrated(page, '/exercises/history-scroll');

	await page.getByTestId('history-scroll-mode-callback').check();
	await expect(page.getByTestId('history-scroll-message-count')).toHaveText('60');
	await expect(page.getByTestId('history-scroll-pages-remaining')).toHaveText('3');

	const loadEarlier = page.getByRole('button', { name: 'Load earlier messages (custom)' });
	await loadEarlier.click();

	await expect(page.getByTestId('history-scroll-message-count')).toHaveText('64');
	await expect(page.getByTestId('history-scroll-pages-remaining')).toHaveText('2');
	// See the adapter-mode test above: `loadEarlier.click()` scrolls the
	// trigger into view first, which can legitimately log a trailing
	// `scrollstatechange` entry after this one.
	await expect(
		page
			.getByTestId('history-scroll-event-log-item')
			.getByText('callback: loaded a page, hasMore=true', { exact: true })
	).toBeVisible();

	// Exhaust the remaining two pages: onLoadHistory is driving this (there is
	// no adapter.loadOlderMessages in this mode), and moreHistoryAvailable is
	// managed entirely by this page's own state, not by Chat internals.
	await loadEarlier.click();
	await loadEarlier.click();

	await expect(page.getByTestId('history-scroll-message-count')).toHaveText('72');
	await expect(page.getByTestId('history-scroll-more-history')).toHaveText('false');
	await expect(loadEarlier).toHaveCount(0);
});

test('adapter.loadOlderMessages failure surfaces onadaptererror and recovers on the next load', async ({
	page
}) => {
	await gotoHydrated(page, '/exercises/history-scroll');

	const loadEarlier = page.getByRole('button', { name: 'Load earlier messages (custom)' });
	const errorCommand = page.getByTestId('history-scroll-adapter-error-command');
	const messageCount = page.getByTestId('history-scroll-message-count');

	await expect(errorCommand).toHaveText('none');

	await page.getByTestId('history-scroll-fail-mode').check();
	await loadEarlier.click();

	// onadaptererror fires with the failing command, surfaced via a
	// dedicated status field (not just the shared event log).
	await expect(errorCommand).toHaveText('loadOlderMessages');
	await expect(
		page
			.getByTestId('history-scroll-event-log-item')
			.getByText('adaptererror: command=loadOlderMessages', { exact: true })
	).toBeVisible();

	// The trigger returns to its idle label rather than getting stuck on
	// "Loading earlier messages (custom)", and the transcript is unchanged.
	await expect(loadEarlier).toBeVisible();
	await expect(loadEarlier).toBeEnabled();
	await expect(page.getByRole('button', { name: 'Loading earlier messages (custom)' })).toHaveCount(
		0
	);
	await expect(messageCount).toHaveText('60');

	// Clearing fail mode lets a subsequent load succeed normally.
	await page.getByTestId('history-scroll-fail-mode').uncheck();
	await loadEarlier.click();
	await expect(messageCount).toHaveText('64');
});

test('single-flight: double-clicking the load-earlier trigger invokes loadOlderMessages exactly once', async ({
	page
}) => {
	await gotoHydrated(page, '/exercises/history-scroll');

	// Slow mode holds the in-flight promise open long enough for a second,
	// near-simultaneous click to land while Chat's own `isLoadingHistory`
	// guard is active.
	await page.getByTestId('history-scroll-slow-load').check();

	const loadEarlier = page.getByRole('button', { name: 'Load earlier messages (custom)' });
	const invocationCount = page.getByTestId('history-scroll-load-invocation-count');

	await expect(invocationCount).toHaveText('0');

	// Two synchronous `.click()` calls in the same page-side evaluation fire
	// both DOM click events back to back — closer to a real rapid double
	// click than two separately-awaited Playwright `.click()` calls, which
	// would each wait for the button's `disabled` state and could let the
	// second click land only after the first load already finished.
	await loadEarlier.evaluate((element) => {
		(element as HTMLButtonElement).click();
		(element as HTMLButtonElement).click();
	});

	await expect(invocationCount).toHaveText('1');
	await expect(page.getByTestId('history-scroll-message-count')).toHaveText('64');
	// Still exactly one invocation once the (single) load has resolved.
	await expect(invocationCount).toHaveText('1');
});

test('scroll anchoring on prepend keeps an anchored mid-transcript message visually stable', async ({
	page
}) => {
	await gotoHydrated(page, '/exercises/history-scroll');

	// The anchor's position is measured RELATIVE TO THE TIMELINE's own box, not
	// to the page. History anchoring is a promise about the scroll container's
	// contents, and this exercise page shifts the whole chat down the page by a
	// line (~23px) when a load completes and the event log grows — a page-
	// relative reading counts that as anchor drift and reports a Chat bug that
	// is really this page's layout. Both rects move together, so the relative
	// reading is immune.
	//
	// Read via `page.evaluate` rather than Playwright's locator-based
	// `boundingBox`: Chat's scroll-tracking keeps producing `scrollstatechange`
	// events (each logged into a growing/sliding `eventLog`) while the transcript
	// settles, which made the locator's element-stability check flaky ("Element
	// is not attached to the DOM") even though the anchor never unmounts.
	const ANCHOR_PREFIX = 'Live message 5 —';

	// Settle by requiring `scrollTop` to hold across consecutive ANIMATION
	// FRAMES. Two `page.evaluate` reads in quick succession can both land inside
	// a single frame and report a gliding scroll as "stable" — this exercise's
	// programmatic scroll-to-top takes ~1.35s to finish, so that mistake yields a
	// baseline captured mid-glide, thousands of pixels from the settled position.
	function settleAndReadAnchor(): Promise<{ relative: number; scrollTop: number } | null> {
		return page.evaluate(async (prefix) => {
			const timeline = document.querySelector('.chat-timeline');
			if (!timeline) return null;
			const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
			let stableFrames = 0;
			let last = timeline.scrollTop;
			const start = performance.now();
			while (stableFrames < 10 && performance.now() - start < 8000) {
				await frame();
				stableFrames = timeline.scrollTop === last ? stableFrames + 1 : 0;
				last = timeline.scrollTop;
			}
			const target = Array.from(document.querySelectorAll('.chat-message-body')).find((element) =>
				element.textContent?.trimStart().startsWith(prefix)
			);
			if (!target) return null;
			return {
				relative: target.getBoundingClientRect().top - timeline.getBoundingClientRect().top,
				scrollTop: timeline.scrollTop
			};
		}, ANCHOR_PREFIX);
	}

	// Chat starts pinned to the bottom (SEED_COUNT=60). A programmatic
	// scroll-to-top is respected since cinder#864's guarded sentinel
	// settlement — the bottom sentinel no longer re-asserts atBottom=true
	// mid-scroll and snaps the viewport back down.
	await page.getByTestId('history-scroll-scroll-top').click();
	await expect(page.getByTestId('history-scroll-at-bottom')).toHaveText('false');
	await expect(page.getByText(/^Live message 5 —/)).toBeVisible();

	const before = await settleAndReadAnchor();
	expect(before).not.toBeNull();
	// Proof the baseline really is the settled top, not a mid-glide sample.
	expect(before!.scrollTop).toBe(0);

	// Sample the anchor EVERY FRAME from before the prepend until well after it.
	// A terminal-state-only check cannot see a transient mis-anchored frame, and
	// a transient one is exactly what a user perceives as a flash. The sampler
	// runs for a fixed WALL-CLOCK window and resolves a promise when it stops, so
	// it never outlives the measurement and burns frames under the later awaits —
	// and so the assertions below never depend on achieving a particular frame
	// rate, which CPU contention can starve.
	await page.evaluate((prefix) => {
		const timeline = document.querySelector('.chat-timeline');
		if (!timeline) return;
		const samples: number[] = [];
		const scope = window as unknown as {
			__anchorSamples: number[];
			__anchorSamplingDone: Promise<void>;
		};
		scope.__anchorSamples = samples;
		scope.__anchorSamplingDone = new Promise<void>((resolve) => {
			const start = performance.now();
			const tick = () => {
				const target = Array.from(document.querySelectorAll('.chat-message-body')).find((element) =>
					element.textContent?.trimStart().startsWith(prefix)
				);
				if (target) {
					samples.push(target.getBoundingClientRect().top - timeline.getBoundingClientRect().top);
				}
				if (performance.now() - start < 1500) requestAnimationFrame(tick);
				else resolve();
			};
			requestAnimationFrame(tick);
		});
	}, ANCHOR_PREFIX);

	// `dispatchEvent('click')` rather than `.click()`: the load-earlier
	// trigger sits above the anchor message, offscreen once the anchor is in
	// view, and Playwright's `.click()` would first scroll the trigger into
	// view itself — a scroll the test doesn't want, since it would move the
	// viewport before the prepend even happens and swamp the anchoring
	// assertion below.
	await page.getByRole('button', { name: 'Load earlier messages (custom)' }).dispatchEvent('click');
	await expect(page.getByTestId('history-scroll-message-count')).toHaveText('64');

	const frames = await page.evaluate(async () => {
		const scope = window as unknown as {
			__anchorSamples: number[];
			__anchorSamplingDone: Promise<void>;
		};
		await scope.__anchorSamplingDone;
		return scope.__anchorSamples;
	});
	// Enough coverage to be meaningful, but low enough that a starved frame rate
	// is not itself a failure — the flash spans whole frames, so a slow sampler
	// still lands inside it.
	expect(frames.length).toBeGreaterThan(10);

	// The settled state is exact: prepending older messages leaves the anchored
	// message where it was, to the pixel.
	const after = await settleAndReadAnchor();
	expect(after).not.toBeNull();
	expect(Math.abs(after!.relative - before!.relative)).toBeLessThanOrEqual(3);

	// Convergence: once the prepend settles, the anchor stays put for the rest of
	// the sampling window. On chat 0.7.1 the restore ran a frame after the prepend
	// flush and the anchor was displaced by ~1312px; on 0.8.1 (cinder#1237, which
	// moved the restore into the same flush) the residual excursion is ~500px and
	// lasts two samples.
	//
	// This deliberately does NOT assert zero displaced samples. The sampler runs in
	// `requestAnimationFrame`, which fires BEFORE paint, so a state corrected by a
	// microtask later in the same frame is recorded here but never actually shown
	// to a user. Distinguishing the two needs paint-time instrumentation this test
	// does not have — Cinder's own harness asserts painted frames and passes. What
	// is unambiguous, and what this pins, is that nothing is left displaced: any
	// excursion is confined to the frames right after the prepend.
	//
	// cinder#1259 tracked whether those two frames are actually painted; it closed
	// as completed without changing this behavior, so the assertion below stays as
	// written. The rAF-vs-paint caveat above is a property of this sampler, not of
	// any Cinder bug, so it outlives the issue.
	const SETTLED_FROM = 20;
	expect(frames.length).toBeGreaterThan(SETTLED_FROM + 10);
	const settledFrames = frames.slice(SETTLED_FROM);
	const displacedAfterSettling = settledFrames.filter(
		(value) => Math.abs(value - before!.relative) > 3
	);
	expect(displacedAfterSettling).toHaveLength(0);
});

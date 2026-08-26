import { expect, test } from '@playwright/test';
import { gotoHydrated } from '../hydration';
import type { Page } from '@playwright/test';

// Chat renders SSR without virtualization (`isVirtualized` is gated on a
// client-only `hasMounted` flag), so the server markup — and briefly the
// hydrated DOM — has all 500 `.chat-message` rows. `data-cinder-virtualized`
// on `.chat-timeline` is the component's own signal that the client has
// mounted and switched to the windowed render path; every row-count
// assertion below waits for it before counting, and uses `expect.poll`
// rather than a one-shot `.count()` so a late windowing pass still resolves
// the assertion instead of racing it.
async function waitForVirtualizedTimeline(page: Page) {
	await expect(page.locator('.chat-timeline[data-cinder-virtualized]')).toBeVisible();
}

test('virtualized transcript keeps DOM row count far below the message count', async ({ page }) => {
	await gotoHydrated(page, '/exercises/virtualization');
	await waitForVirtualizedTimeline(page);

	await expect(page.getByTestId('virtualization-message-count')).toHaveText('500');

	// Virtualization windows the DOM to roughly viewport + overscan, not the
	// full 500-message transcript. This is the core proof that virtualized
	// rendering is actually on, not just accepted as a prop.
	await expect.poll(() => page.locator('.chat-message').count()).toBeGreaterThan(0);
	await expect.poll(() => page.locator('.chat-message').count()).toBeLessThan(100);

	// The row-count check above only proves pruning happened — it says
	// nothing about which rows survived. Confirm the rendered set is the
	// correct CONTIGUOUS window (no gaps, so no stale/duplicate positions
	// slipped in) and contains no duplicate messages.
	const bodies = await page.locator('.chat-message-body').allTextContents();
	const renderedIndices = bodies
		.map((text) => text.match(/Message (\d+)/)?.[1])
		.filter((value): value is string => value !== undefined)
		.map(Number)
		.sort((a, b) => a - b);

	expect(new Set(bodies).size).toBe(bodies.length);
	expect(renderedIndices.length).toBeGreaterThan(1);
	for (let index = 1; index < renderedIndices.length; index += 1) {
		expect(renderedIndices[index] - renderedIndices[index - 1]).toBe(1);
	}
});

test('scrollToTop and scrollToBottom navigate the virtualized transcript end to end', async ({
	page
}) => {
	await gotoHydrated(page, '/exercises/virtualization');
	await waitForVirtualizedTimeline(page);

	// Chat starts pinned to the bottom; the last seeded message is reachable
	// without any scrolling.
	await expect(page.getByText('Message 499')).toBeVisible();

	// scrollToTop releases the stick-to-bottom pin and lands on the transcript
	// start — the virtualizer renders the first window and prunes the bottom.
	await page.getByTestId('virtualization-scroll-top').click();
	await expect(page.getByText('Message 0')).toBeVisible();
	await expect(page.getByText('Message 499')).not.toBeVisible();

	// And the round-trip: scrollToBottom re-pins to the live edge.
	await page.getByTestId('virtualization-scroll-bottom').click();
	await expect(page.getByText('Message 499')).toBeVisible();
	await expect(page.getByText('Message 0')).not.toBeVisible();
});

test('tuning virtualizationOverscan changes the rendered row count but stays well below the message count', async ({
	page
}) => {
	await gotoHydrated(page, '/exercises/virtualization');
	await waitForVirtualizedTimeline(page);

	const baselineRowCount = await page.locator('.chat-message').count();

	await page.getByTestId('virtualization-overscan').fill('40');
	// Overscan is read on the next virtualizer sync; scrolling forces one.
	await page.getByTestId('virtualization-scroll-top').click();
	await page.getByTestId('virtualization-scroll-bottom').click();

	await expect.poll(() => page.locator('.chat-message').count()).toBeGreaterThan(baselineRowCount);
	await expect.poll(() => page.locator('.chat-message').count()).toBeLessThan(250);
});

test('streaming a new message into a virtualized transcript renders and finalizes it', async ({
	page
}) => {
	await gotoHydrated(page, '/exercises/virtualization');
	await waitForVirtualizedTimeline(page);

	await expect(page.getByTestId('virtualization-message-count')).toHaveText('500');

	await page.getByTestId('virtualization-stream-message').click();
	await expect(page.getByText('Streamed reply into the virtualized transcript.')).toBeVisible();
	await expect(page.getByTestId('virtualization-message-count')).toHaveText('501');

	// The streamed message is the new last message; scrolling to bottom still
	// reaches it, proving the virtualizer's item count and keys were kept in
	// sync with the growing transcript.
	await page.getByTestId('virtualization-scroll-bottom').click();
	await expect(page.getByText('Streamed reply into the virtualized transcript.')).toBeVisible();
});

test('in-conversation search scrolls an off-window virtualized match into the DOM and highlights it', async ({
	page
}) => {
	await gotoHydrated(page, '/exercises/virtualization');
	await waitForVirtualizedTimeline(page);

	// Chat starts bottom-anchored (initial window near index 499), so the
	// needle planted at index 50 is not mounted yet.
	await expect(page.locator('.chat-message-body', { hasText: 'gronkle-marker-50' })).toHaveCount(0);

	// Ctrl+F / Cmd+F is intercepted by Chat's own container-level keydown
	// handler; it bubbles from any focused element inside the chat surface.
	await page.locator('.chat-input-editor').click();
	await page.keyboard.press('Control+f');

	const searchInput = page.getByRole('searchbox', { name: 'Search messages' });
	await expect(searchInput).toBeVisible();
	await searchInput.fill('gronkle-marker-50');

	// Navigate to the (only) match.
	await page.getByRole('button', { name: 'Next match' }).click();

	// The match becomes visible — the virtualizer scrolled its row into the
	// DOM — and is highlighted via Chat's own `data-search-match` marker on
	// the current match.
	const currentMatch = page.locator('.chat-message-wrapper[data-search-match]');
	await expect(currentMatch).toBeVisible();
	await expect(currentMatch).toContainText('gronkle-marker-50');
});

test('interleaving a prepended older batch and an appended live message keeps virtual rows unique, ordered, and crash-free', async ({
	page
}) => {
	await gotoHydrated(page, '/exercises/virtualization');
	await waitForVirtualizedTimeline(page);

	// Move to a mid-transcript scroll position via real wheel gestures: Chat
	// starts pinned to the bottom, and auto-stick-to-bottom intentionally
	// releases only for user-initiated scrolling (or Chat's own scroll APIs,
	// which can only target the edges). A wheel gesture is the realistic way
	// to hold a MID-transcript position, exercising the same path a real
	// user would take.
	const timeline = page.locator('.chat-timeline');
	const timelineBox = await timeline.boundingBox();
	if (!timelineBox) throw new Error('`.chat-timeline` has no bounding box');

	await page.mouse.move(
		timelineBox.x + timelineBox.width / 2,
		timelineBox.y + timelineBox.height / 2
	);
	// Goal-seeking rather than a fixed tick budget. `15 × 2000px` encoded an
	// assumption that one wheel event applies its full delta — true in Chromium
	// and WebKit, false in Firefox, which caps a single wheel event at just under
	// one scrollport height (a 457px port applies ~423px). Firefox needed 21 ticks
	// where Chromium needed 5, so the fixed budget undershot and left the view
	// pinned near the bottom.
	//
	// Deriving the count from the engine instead of guessing it. Not a loosening:
	// the assertion below is untouched, and it still fails just as loudly if the
	// cap is exhausted, if the gesture overshoots to the very top, or if the
	// virtualizer stops rendering mid-range rows.
	// A range (not an exact index) tolerates the gap between
	// `virtualizationEstimatedRowHeight` and each row's real measured height.
	const midBandRendered = (bodies: string[]) =>
		bodies.some((text) => {
			const index = Number(text.match(/^Message (\d+)/)?.[1]);
			return Number.isFinite(index) && index > 100 && index < 400;
		});

	const inMidBand = () =>
		page.locator('.chat-message-body').allTextContents().then(midBandRendered);

	for (let tick = 0; tick < 200 && !(await inMidBand()); tick += 1) {
		// Overshot past the whole transcript — wheeling more cannot help, and the
		// assertion should report that rather than the loop spinning to its cap.
		if ((await timeline.evaluate((element) => element.scrollTop)) === 0) break;
		await page.mouse.wheel(0, -2000);
	}

	// Assert a mid-range message is actually rendered — proof the scroll
	// landed mid-transcript rather than silently no-oping and leaving the
	// view pinned to the bottom. A range (not an exact index) tolerates the
	// gap between `virtualizationEstimatedRowHeight` and each row's real
	// measured height.
	await expect.poll(inMidBand).toBe(true);

	await page.getByTestId('virtualization-prepend-older').click();
	await page.getByTestId('virtualization-append-live').click();

	await expect(page.getByTestId('virtualization-message-count')).toHaveText('506');

	// No crash: the page is still responsive and the virtualized timeline is
	// still mounted.
	await expect(page.locator('.chat-timeline[data-cinder-virtualized]')).toBeVisible();

	// No duplicate rows rendered via stale virtual positions.
	const bodies = await page.locator('.chat-message-body').allTextContents();
	expect(new Set(bodies).size).toBe(bodies.length);

	// Order spot-check: first, last, and the prepend/original boundary — the
	// pair most likely to expose a stale virtual position, since it's where
	// the newly-inserted batch meets the original transcript.
	await page.getByTestId('virtualization-scroll-top').click();
	await expect(page.getByText(/^Older batch 0-0/)).toBeVisible();
	await expect(page.getByText(/^Older batch 0-4/)).toBeVisible();
	await expect(page.getByText(/^Message 0$/)).toBeVisible();

	await page.getByTestId('virtualization-scroll-bottom').click();
	await expect(page.getByText('Live append 1')).toBeVisible();
});

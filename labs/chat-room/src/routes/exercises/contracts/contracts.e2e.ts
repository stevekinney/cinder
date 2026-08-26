import { expect, test } from '@playwright/test';
import { gotoHydrated } from '../hydration';
import type { Page } from '@playwright/test';

// Pins the two documented environmental contracts from the Chat package
// README: the schema-version compatibility claim, and the height-collapse
// trap plus its three documented escapes.

// The trap and the escapes are distinguished by BEHAVIOR, not a magic pixel
// number: an escape's Chat is constrained to its container and scrolls its
// message log internally; the trap's Chat is content-sized — it grows to its
// intrinsic height (which can exceed the escapes' containers) and its log
// never scrolls internally, so overflow leaks to the page instead.
const CONTAINER_TOLERANCE_PX = 2;

async function chatMetrics(page: Page, chatSelector: string, wrapperTestId: string) {
	const chatBox = await page.locator(chatSelector).boundingBox();
	const wrapperBox = await page.getByTestId(wrapperTestId).boundingBox();
	const logScroll = await page
		.locator(chatSelector)
		.getByRole('log')
		.evaluate((el) => ({ scrollHeight: el.scrollHeight, clientHeight: el.clientHeight }));
	return { chatBox, wrapperBox, logScroll };
}

test.describe('contracts: schema version', () => {
	let page: Page;

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		await gotoHydrated(page, '/exercises/contracts');
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('current schema renders normally', async () => {
		const chat = page.locator('#contracts-schema-current-chat');
		await expect(chat.getByText('Yes — this is a seeded reply.')).toBeVisible();
	});

	test('an older compatible schema renders as-is, per the documented contract', async () => {
		const chat = page.locator('#contracts-schema-older-chat');
		await expect(chat.getByText('Yes — this is a seeded reply.')).toBeVisible();
	});

	test('a newer schema still renders, but warns in the console that @lostgradient/chat needs upgrading', async ({
		browser
	}) => {
		// The schema-version contract (cinder#896, fixed in PR #903): Chat
		// console-warns when a history is stamped with a newer schema version
		// than it supports. The warning fires on mount, so a fresh page with
		// the listener attached before navigation is required.
		const warnPage = await browser.newPage();
		const schemaWarnings: string[] = [];
		warnPage.on('console', (message) => {
			if (message.type() === 'warning' && message.text().includes('schema version')) {
				schemaWarnings.push(message.text());
			}
		});
		await gotoHydrated(warnPage, '/exercises/contracts');

		const chat = warnPage.locator('#contracts-schema-newer-chat');
		await expect(chat.getByText('Yes — this is a seeded reply.')).toBeVisible();
		expect(schemaWarnings.length).toBeGreaterThan(0);
		expect(schemaWarnings[0]).toContain('newer than the supported version');

		await warnPage.close();
	});
});

test.describe('contracts: height collapse', () => {
	let page: Page;

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		await gotoHydrated(page, '/exercises/contracts');
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('the trap: with no ancestor resolving to a definite height, Chat is content-sized and never scrolls internally', async () => {
		const { chatBox, logScroll } = await chatMetrics(
			page,
			'#contracts-height-trap-chat',
			'height-trap-wrapper'
		);
		expect(chatBox).not.toBeNull();

		// Unconstrained: the message log has nothing to scroll — all overflow
		// leaks to the page. (With the seeded transcript, the trap's intrinsic
		// height can exceed the escapes' containers; "small card" applies to
		// an empty conversation, "grows with content" to a seeded one — both
		// are the same failure: the container imposed nothing.)
		expect(logScroll.scrollHeight).toBeLessThanOrEqual(
			logScroll.clientHeight + CONTAINER_TOLERANCE_PX
		);
	});

	test('escape 1: a fixed-height container lets Chat fill it exactly and scroll internally', async () => {
		const { chatBox, wrapperBox, logScroll } = await chatMetrics(
			page,
			'#contracts-height-fixed-chat',
			'height-fixed-wrapper'
		);
		expect(chatBox).not.toBeNull();
		expect(wrapperBox).not.toBeNull();
		expect(Math.abs(chatBox!.height - wrapperBox!.height)).toBeLessThanOrEqual(
			CONTAINER_TOLERANCE_PX
		);
		expect(logScroll.scrollHeight).toBeGreaterThan(logScroll.clientHeight);
	});

	test("escape 2: a flex column with `flex: 1; min-height: 0` on Chat's cell lets it fill the remaining space and scroll internally", async () => {
		const { chatBox, wrapperBox, logScroll } = await chatMetrics(
			page,
			'#contracts-height-flex-chat',
			'height-flex-wrapper'
		);
		expect(chatBox).not.toBeNull();
		expect(wrapperBox).not.toBeNull();

		// The wrapper also contains a small header row, so the chat fills
		// most-but-not-all of it; the load-bearing assertions are that the
		// chat is CONSTRAINED (strictly shorter than its container) and its
		// log scrolls internally instead of growing the page.
		expect(chatBox!.height).toBeLessThanOrEqual(wrapperBox!.height);
		expect(logScroll.scrollHeight).toBeGreaterThan(logScroll.clientHeight);
	});

	test('escape 3: a grid with a `minmax(0, 1fr)` track and `min-height: 0` on the cell lets it fill the remaining space and scroll internally', async () => {
		const { chatBox, wrapperBox, logScroll } = await chatMetrics(
			page,
			'#contracts-height-grid-chat',
			'height-grid-wrapper'
		);
		expect(chatBox).not.toBeNull();
		expect(wrapperBox).not.toBeNull();
		expect(chatBox!.height).toBeLessThanOrEqual(wrapperBox!.height);
		expect(logScroll.scrollHeight).toBeGreaterThan(logScroll.clientHeight);
	});
});

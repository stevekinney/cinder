import { expect, test } from '@playwright/test';
import { gotoHydrated } from '../hydration';
import type { Locator, Page } from '@playwright/test';

// Exercises the documented tool-approval contract:
//   - `chat.types.d.ts`'s `onapprove`/`ondeny` JSDoc: when an adapter is wired,
//     Chat calls `adapter.approveToolCall`/`denyToolCall` FIRST, then the
//     matching callback — exactly once each.
//   - `chat.svelte`'s `resolveToolApproval`: an optimistic commit guards
//     double-resolution, and a rejected adapter call rolls the commit back so
//     the prompt returns to "pending" instead of getting stuck.
//   - `chat.svelte`'s assertive-announcement precedence: a pending
//     action-required tool approval keeps the assertive live-region channel;
//     a racing consumer `announce(..., 'assertive')` is dropped.

function approveButton(chat: Locator): Locator {
	return chat.getByRole('button', { name: 'Approve' });
}

function rejectButton(chat: Locator): Locator {
	return chat.getByRole('button', { name: 'Reject' });
}

test.describe('tool approval: adapter/callback ordering', () => {
	let page: Page;

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		await gotoHydrated(page, '/exercises/tool-approval');
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('approve: adapter.approveToolCall fires before onapprove, exactly once each', async () => {
		const chat = page.locator('#tool-approval-both-chat');
		const log = page.getByTestId('both-log');

		await approveButton(chat).first().click();

		await expect(log).toContainText('adapter.approveToolCall:call-approve');
		await expect(log).toContainText('onapprove:call-approve');

		const entries = await log.locator('li').allTextContents();
		expect(
			entries.filter((entry) => entry === 'adapter.approveToolCall:call-approve')
		).toHaveLength(1);
		expect(entries.filter((entry) => entry === 'onapprove:call-approve')).toHaveLength(1);
		expect(entries.indexOf('adapter.approveToolCall:call-approve')).toBeLessThan(
			entries.indexOf('onapprove:call-approve')
		);
	});

	test('deny: adapter.denyToolCall fires before ondeny, exactly once each', async () => {
		const chat = page.locator('#tool-approval-both-chat');
		const log = page.getByTestId('both-log');

		await rejectButton(chat).first().click();

		await expect(log).toContainText('adapter.denyToolCall:call-deny');
		await expect(log).toContainText('ondeny:call-deny');

		const entries = await log.locator('li').allTextContents();
		expect(entries.filter((entry) => entry === 'adapter.denyToolCall:call-deny')).toHaveLength(1);
		expect(entries.filter((entry) => entry === 'ondeny:call-deny')).toHaveLength(1);
		expect(entries.indexOf('adapter.denyToolCall:call-deny')).toBeLessThan(
			entries.indexOf('ondeny:call-deny')
		);
	});
});

test.describe('tool approval: rejection routing', () => {
	let page: Page;

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		await gotoHydrated(page, '/exercises/tool-approval');
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('a rejected adapter.approveToolCall routes to onadaptererror, rolls back, and leaves the prompt actionable', async () => {
		const chat = page.locator('#tool-approval-fail-chat');
		const log = page.getByTestId('fail-log');

		await page.getByTestId('toggle-fail-approve').click();
		await approveButton(chat).click();

		const error = page.getByTestId('fail-error');
		await expect(error).toContainText('approveToolCall');
		await expect(error).toContainText('Simulated approveToolCall rejection');

		// onapprove must NOT have fired — only the adapter call attempt is logged.
		await expect(log).toContainText('adapter.approveToolCall:call-fail');
		const entries = await log.locator('li').allTextContents();
		expect(entries.filter((entry) => entry === 'onapprove:call-fail')).toHaveLength(0);

		// Rollback returns the prompt to pending: Approve/Reject render again.
		await expect(approveButton(chat)).toBeVisible();
		await expect(rejectButton(chat)).toBeVisible();
		await expect(approveButton(chat)).toBeEnabled();
	});
});

test.describe('tool approval: callback-only (no adapter)', () => {
	let page: Page;

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		await gotoHydrated(page, '/exercises/tool-approval');
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('onapprove and ondeny fire alone, with no adapter entries', async () => {
		const chat = page.locator('#tool-approval-callback-only-chat');
		const log = page.getByTestId('callback-only-log');

		await approveButton(chat).first().click();
		await rejectButton(chat).first().click();

		await expect(log).toContainText('onapprove:call-approve');
		await expect(log).toContainText('ondeny:call-deny');

		const entries = await log.locator('li').allTextContents();
		expect(entries).toHaveLength(2);
		expect(entries.some((entry) => entry.startsWith('adapter.'))).toBe(false);
	});
});

test.describe('tool approval: rapid double-click against a slow adapter', () => {
	let page: Page;

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		await gotoHydrated(page, '/exercises/tool-approval');
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('a single approveToolCall invocation regardless of a rapid second click', async () => {
		const chat = page.locator('#tool-approval-double-click-chat');
		const button = approveButton(chat);

		// Chat commits the resolved id to an internal Set SYNCHRONOUSLY, before
		// the (slow) adapter promise settles, and that same commit unmounts the
		// Approve/Reject buttons. Two SYNCHRONOUS DOM clicks in one evaluate are
		// the only deterministic double-click here: a second Playwright
		// `.click()` would retry against the already-unmounted button until the
		// test times out.
		await button.evaluate((el) => {
			(el as HTMLElement).click();
			(el as HTMLElement).click();
		});

		await expect(page.getByTestId('double-click-count')).toHaveText(
			'approveToolCall invocations: 1'
		);
	});
});

test.describe('tool approval: assertive announcement precedence', () => {
	let page: Page;

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		await gotoHydrated(page, '/exercises/tool-approval');
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('a pending tool-approval keeps the assertive channel; a racing consumer announce is dropped', async () => {
		const chat = page.locator('#tool-approval-assertive-chat');
		const assertiveRegion = chat.locator('[aria-live="assertive"]');

		await expect(assertiveRegion).toContainText(
			'Action required: Purge the CDN cache for all regions?'
		);

		await page.getByTestId('announce-consumer-text').click();

		await expect(assertiveRegion).toContainText(
			'Action required: Purge the CDN cache for all regions?'
		);
		await expect(assertiveRegion).not.toContainText('Consumer text should not win.');
	});
});

// CIN-506: a COMPLETED tool-call/tool-result pair renders through the grouped
// ToolCallGroup/ToolCallTimeline path (chat.svelte's `renderRow.type ===
// 'tool-call-group'` branch), unlike the `action_required` scenarios above,
// which render as an ungrouped approval-prompt row instead. The grouped row
// (`.chat-tool-call-timeline` in tool-call-timeline.svelte) carries the
// widest content in the transcript — serialized JSON via ToolPayloadCode —
// and, before this fix, declared no inline-size cap of its own, so it
// stretched to the full timeline width regardless of every other row's
// `--cinder-chat-message-max-width` readability cap (chat-message.svelte).
test.describe('tool call group: readability cap (CIN-506)', () => {
	const READABILITY_CAP_REM = 48; // The `--cinder-chat-message-max-width` default.
	const PIXEL_TOLERANCE = 2; // Sub-pixel layout rounding.

	// `rem` is user-scalable by design, so the cap is resolved against the
	// page's actual root font size rather than assumed to be 16px.
	const readabilityCapInPixels = (page: Page): Promise<number> =>
		page.evaluate(
			(rem) => rem * parseFloat(getComputedStyle(document.documentElement).fontSize),
			READABILITY_CAP_REM
		);

	test('at a wide viewport, the grouped tool-call row does not exceed the shared readability cap', async ({
		page
	}) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await gotoHydrated(page, '/exercises/tool-approval');

		const row = page.locator(
			'[data-testid="tool-approval-width-cap-wrapper"] .chat-tool-call-timeline'
		);
		await expect(row).toBeVisible();

		const width = await row.evaluate((element) => element.getBoundingClientRect().width);
		expect(width).toBeLessThanOrEqual((await readabilityCapInPixels(page)) + PIXEL_TOLERANCE);
	});

	test('below the breakpoint, the grouped tool-call row still fills the available width instead of shrinking to fit-content', async ({
		page
	}) => {
		await page.setViewportSize({ width: 375, height: 800 });
		await gotoHydrated(page, '/exercises/tool-approval');

		const row = page.locator(
			'[data-testid="tool-approval-width-cap-wrapper"] .chat-tool-call-timeline'
		);
		await expect(row).toBeVisible();

		const { availableWidth, rowWidth } = await page.evaluate(() => {
			const timelineElement = document.querySelector(
				'#tool-approval-width-cap-chat .chat-timeline'
			);
			const rowElement = document.querySelector(
				'[data-testid="tool-approval-width-cap-wrapper"] .chat-tool-call-timeline'
			);
			if (!(timelineElement instanceof HTMLElement) || !(rowElement instanceof HTMLElement)) {
				throw new Error('Expected both the timeline and the tool-call-group row to be present.');
			}
			const timelineStyle = getComputedStyle(timelineElement);
			const paddingLeft = Number.parseFloat(timelineStyle.paddingLeft);
			const paddingRight = Number.parseFloat(timelineStyle.paddingRight);
			return {
				availableWidth: timelineElement.getBoundingClientRect().width - paddingLeft - paddingRight,
				rowWidth: rowElement.getBoundingClientRect().width
			};
		});

		// A `fit-content`/`max-content` regression would size the row to its
		// (much narrower) content instead of the full available width.
		expect(Math.abs(rowWidth - availableWidth)).toBeLessThanOrEqual(PIXEL_TOLERANCE);
	});

	test('a long unbroken payload scrolls inside its own code block rather than widening the page', async ({
		page
	}) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await gotoHydrated(page, '/exercises/tool-approval');

		// The Arguments/Result code blocks only exist in the DOM once the
		// disclosure is open — expand it first (EntryFrame renders "Expand …" /
		// "Collapse …" as the accessible name depending on state).
		const wrapper = page.getByTestId('tool-approval-width-cap-wrapper');
		await wrapper.getByRole('button', { name: /^Expand/ }).click();

		const codeViewports = wrapper.locator('.cinder-code-block__viewport');
		await expect(codeViewports.first()).toBeVisible();

		const { pageScrollWidth, viewportWidth, codeBlocksOverflow } = await page.evaluate(() => {
			const viewports = Array.from(
				document.querySelectorAll(
					'[data-testid="tool-approval-width-cap-wrapper"] .cinder-code-block__viewport'
				)
			).filter((element): element is HTMLElement => element instanceof HTMLElement);
			return {
				pageScrollWidth: document.documentElement.scrollWidth,
				viewportWidth: window.innerWidth,
				// The long, unbroken token has nowhere to wrap, so the code block's
				// own scroll region — not the page — must absorb the overflow.
				codeBlocksOverflow: viewports.map((element) => element.scrollWidth > element.clientWidth)
			};
		});

		expect(pageScrollWidth).toBeLessThanOrEqual(viewportWidth + PIXEL_TOLERANCE);
		expect(codeBlocksOverflow.length).toBeGreaterThan(0);
		expect(codeBlocksOverflow.some(Boolean)).toBe(true);
	});
});

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

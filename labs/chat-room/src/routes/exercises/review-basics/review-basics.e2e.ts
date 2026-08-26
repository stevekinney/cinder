import { expect, test } from '@playwright/test';
import { gotoHydrated } from '../hydration';
import type { Page } from '@playwright/test';

// The baseline ReviewEditor surface. Everything the other `review-*` exercises
// build on is pinned here once: that the composed shell mounts, that a seeded
// thread anchors to the text it claims, and that the two bindable props round
// trip. Behaviour-specific routes own the rest — views/diff, comment CRUD,
// anchoring under edits, exports, front matter, session, and SSR/a11y.

const ROUTE = '/exercises/review-basics';

async function ready(page: Page) {
	await gotoHydrated(page, ROUTE);
	// The live ProseMirror surface only exists after MarkdownEditor mounts inside
	// its `{#if browser}` guard, so SSR markup alone is not enough to interact.
	await expect(page.locator('.ProseMirror')).toBeVisible();
}

test.describe('review-basics: the composed shell', () => {
	let page: Page;

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		await ready(page);
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('renders the document through a live ProseMirror surface', async () => {
		const editor = page.locator('.ProseMirror');
		await expect(editor).toHaveAttribute('role', 'textbox');
		await expect(editor).toContainText('Release Plan');
		await expect(editor).toContainText('Document review export behavior');
	});

	test('offers the three document views as a tablist', async () => {
		const tabs = page.getByRole('tab');
		await expect(tabs).toHaveCount(3);
		await expect(tabs.nth(0)).toHaveText(/Editor/);
		await expect(tabs.nth(1)).toHaveText(/Diff/);
		await expect(tabs.nth(2)).toHaveText(/Summary/);
	});

	test('renders ONE control row, with the formatting controls inside it', async () => {
		// The editor view used to stack MarkdownEditor's own formatting toolbar
		// underneath the review controls — two full-height bars, ~90px of chrome
		// before any document text. The formatting controls now live inside the
		// unified bar (`.controls-formatting`), matching what the diff and summary
		// views already did. Asserted structurally rather than by pixel height so
		// this survives spacing changes.
		const container = page.getByTestId('review-editor');
		const controls = container.getByRole('group', { name: 'Review editor controls' });
		await expect(controls).toBeVisible();

		// The formatting group is a descendant of the unified bar, not a sibling
		// row below it. That containment IS the fix.
		await expect(controls.locator('.controls-formatting')).toHaveCount(1);
		await expect(
			controls.locator('.controls-formatting').getByRole('button', { name: 'Undo' })
		).toBeVisible();

		// And the document starts immediately after that single row: the editor's
		// top is within one row-height of the control bar's bottom.
		const controlsBox = await controls.boundingBox();
		const editorBox = await page.locator('.ProseMirror').boundingBox();
		expect(controlsBox).not.toBeNull();
		expect(editorBox).not.toBeNull();
		expect(editorBox!.y - (controlsBox!.y + controlsBox!.height)).toBeLessThan(controlsBox!.height);
	});

	test('the comments toggle points at a sidebar id that actually exists', async () => {
		// The toggle used to derive the sidebar's id from its own — the bar is
		// `{id}-controls`, so it advertised `{id}-controls-sidebar` while the
		// sidebar is `{id}-sidebar`, and the reference never resolved in any state.
		const toggle = page.getByRole('button', { name: /comments sidebar/ });
		await expect(toggle).toHaveAttribute('aria-controls', 'review-basics-editor-sidebar');
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');

		await toggle.click();
		await expect(toggle).toHaveAttribute('aria-expanded', 'true');
		// Now that it is open, the advertised target resolves for real.
		await expect(page.locator('#review-basics-editor-sidebar')).toBeVisible();

		await toggle.click();
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');
	});

	test('screen-reader announcements stay visually hidden', async () => {
		// LiveRegion hid itself with a bare `sr-only` class, which Cinder does not
		// ship (`cinder-sr-only`), and the component declares no styles of its own —
		// so every announcement rendered as visible page text. Asserted by measuring
		// the region rather than by class name, so it pins the outcome, not the fix.
		const live = page.locator('[role="status"][aria-live="polite"]').first();
		await expect(live).toHaveCount(1);
		const box = await live.boundingBox();
		// A correctly-hidden live region is clipped to ~1px, not laid out.
		expect(box === null || box.width <= 2).toBe(true);
	});
});

test.describe('review-basics: a seeded thread', () => {
	let page: Page;

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		await ready(page);
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('anchors to exactly the text it quotes, and nothing else', async () => {
		// The regression this pins: a thread supplied through the `threads` prop
		// used to be mapped through Milkdown's initial content-set transaction,
		// which replaces the whole document. `from` collapsed to 0 and `to`
		// expanded to the document end, so ONE thread decorated EVERY block — six
		// spans for a 12-character quote — and the anchor's `quote` was overwritten
		// with the entire document text, destroying the only data re-anchoring
		// could have used to recover.
		//
		// Count and text together are the assertion: a count of 1 alone would pass
		// if the single span covered the whole document.
		const anchors = page.locator('.comment-anchor');
		await expect(anchors).toHaveCount(1);
		await expect(anchors.first()).toHaveText('Release Plan');
		await expect(anchors.first()).toHaveAttribute('data-thread-id', 'thread-release-plan-title');
	});

	test('surfaces its comment through the sidebar', async () => {
		await page.getByRole('button', { name: /comments sidebar/ }).click();
		const sidebar = page.locator('#review-basics-editor-sidebar');
		await expect(sidebar).toBeVisible();
		await expect(sidebar).toContainText('Title reads well — keep it.');
	});

	test('reports its counts to the page unchanged on load', async () => {
		// The page renders component state into these nodes, so they observe the
		// bindable props rather than the rendered DOM. On a clean load nothing has
		// mutated them.
		await expect(page.getByTestId('thread-count')).toHaveText('threads: 1');
		await expect(page.getByTestId('comment-count')).toHaveText('comments: 1');
	});
});

test.describe('review-basics: bindable props round-trip', () => {
	test('typing into the document updates the bound value and fires onchange', async ({
		browser
	}) => {
		// A fresh page: this test mutates the document, so it must not share state
		// with the read-only assertions above.
		const page = await browser.newPage();
		await ready(page);

		const lengthBefore = await page.getByTestId('value-length').textContent();
		expect(lengthBefore).toBe('value length: 194');

		// Type at the very end of the document so the seeded anchor (which sits in
		// the heading) is untouched — this test is about `value`, not anchoring.
		const editor = page.locator('.ProseMirror');
		await editor.click();
		await page.keyboard.press('ControlOrMeta+End');
		await page.keyboard.type(' plus');

		// `value` is bound, so the page's own readout must move. Auto-retrying
		// expect: the editor flushes its change asynchronously.
		await expect(page.getByTestId('value-length')).not.toHaveText('value length: 194');

		// And the notification callback fired at least once. The log records
		// `change:<length>` entries, so a non-empty log with a change entry is the
		// observable proof that `onchange` is wired, not just the binding.
		await expect(
			page.getByTestId('event-log').locator('li').filter({ hasText: 'change:' })
		).not.toHaveCount(0);

		await page.close();
	});
});

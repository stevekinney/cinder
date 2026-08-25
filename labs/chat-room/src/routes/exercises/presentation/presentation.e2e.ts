import { expect, test } from '@playwright/test';
import { gotoHydrated } from '../hydration';

// Exercises the presentation props (density/variant/surfaceMode, all reflected
// as `data-*` attributes on `.chat-container`) and the ChatCapabilities editor
// (attachments/search/copy/editing/retry) against a single seeded, deterministic
// conversation — a user message, a completed assistant reply, and a FAILED
// assistant message. No network calls; everything is scripted in-page.

const CHAT = '#presentation-chat';

test.describe('presentation: density, variant, surfaceMode', () => {
	test('toggling controls updates the data attributes Chat reads for styling', async ({ page }) => {
		await gotoHydrated(page, '/exercises/presentation');

		const chat = page.locator(CHAT);
		await expect(chat).toHaveAttribute('data-cinder-density', 'comfortable');
		await expect(chat).toHaveAttribute('data-cinder-variant', 'bubble');
		await expect(chat).toHaveAttribute('data-surface-mode', 'default');

		await page.getByRole('radio', { name: 'Compact' }).check();
		await expect(chat).toHaveAttribute('data-cinder-density', 'compact');

		await page.getByRole('radio', { name: 'Flat' }).check();
		await expect(chat).toHaveAttribute('data-cinder-variant', 'flat');

		await page.getByRole('radio', { name: 'Transparent' }).check();
		await expect(chat).toHaveAttribute('data-surface-mode', 'transparent');

		// And back, proving the bindings are two-way live, not one-shot at mount.
		await page.getByRole('radio', { name: 'Comfortable' }).check();
		await page.getByRole('radio', { name: 'Bubble' }).check();
		await page.getByRole('radio', { name: 'Default' }).check();
		await expect(chat).toHaveAttribute('data-cinder-density', 'comfortable');
		await expect(chat).toHaveAttribute('data-cinder-variant', 'bubble');
		await expect(chat).toHaveAttribute('data-surface-mode', 'default');
	});
});

test.describe('presentation: ChatCapabilities', () => {
	test('attachments: OFF hides the attach button, ON restores it', async ({ page }) => {
		await gotoHydrated(page, '/exercises/presentation');

		const chat = page.locator(CHAT);
		await expect(chat.getByRole('button', { name: 'Attach file', exact: true })).toBeVisible();

		await page.getByTestId('capability-attachments').uncheck();
		await expect(chat.getByRole('button', { name: 'Attach file', exact: true })).toHaveCount(0);

		await page.getByTestId('capability-attachments').check();
		await expect(chat.getByRole('button', { name: 'Attach file', exact: true })).toBeVisible();
	});

	test('copy: OFF removes per-message copy buttons, ON restores them', async ({ page }) => {
		await gotoHydrated(page, '/exercises/presentation');

		const chat = page.locator(CHAT);
		await expect(chat.getByRole('button', { name: 'Copy message' }).first()).toBeVisible();

		await page.getByTestId('capability-copy').uncheck();
		await expect(chat.getByRole('button', { name: 'Copy message' })).toHaveCount(0);

		await page.getByTestId('capability-copy').check();
		await expect(chat.getByRole('button', { name: 'Copy message' }).first()).toBeVisible();
	});

	test('editing: OFF removes the edit affordance on the user message, ON restores it', async ({
		page
	}) => {
		await gotoHydrated(page, '/exercises/presentation');

		const chat = page.locator(CHAT);
		await expect(chat.getByRole('button', { name: 'Edit message' })).toBeVisible();

		await page.getByTestId('capability-editing').uncheck();
		await expect(chat.getByRole('button', { name: 'Edit message' })).toHaveCount(0);

		await page.getByTestId('capability-editing').check();
		await expect(chat.getByRole('button', { name: 'Edit message' })).toBeVisible();
	});

	test('retry: OFF removes the retry button on the seeded failed message, ON restores it', async ({
		page
	}) => {
		await gotoHydrated(page, '/exercises/presentation');

		const chat = page.locator(CHAT);
		await expect(chat.getByText('Failed to send', { exact: true })).toBeVisible();
		await expect(chat.getByRole('button', { name: 'Retry' })).toBeVisible();

		await page.getByTestId('capability-retry').uncheck();
		await expect(chat.getByRole('button', { name: 'Retry' })).toHaveCount(0);
		// `ChatMessage` gates the whole failed-message block (label + button) on
		// the same `onretry` prop Chat only passes through when the retry
		// capability is enabled, so the label disappears along with the button.
		await expect(chat.getByText('Failed to send', { exact: true })).toHaveCount(0);

		await page.getByTestId('capability-retry').check();
		await expect(chat.getByText('Failed to send', { exact: true })).toBeVisible();
		await expect(chat.getByRole('button', { name: 'Retry' })).toBeVisible();

		// The restored button still does the real thing: retries the message.
		await chat.getByRole('button', { name: 'Retry' }).click();
		await expect(chat.getByText('Retried reply: arrived on retry.')).toBeVisible();
		await expect(chat.getByText('Failed to send', { exact: true })).toHaveCount(0);
	});

	test('search: OFF suppresses Cmd/Ctrl+F, ON opens the search bar with working highlight and navigation', async ({
		page
	}) => {
		await gotoHydrated(page, '/exercises/presentation');

		const chat = page.locator(CHAT);
		const composer = chat.getByRole('textbox', { name: 'Message' });

		// The Chat handler checks `event.ctrlKey || event.metaKey`, so Control+F
		// exercises the same branch on every platform without relying on
		// OS-specific browser shortcut interception.

		// --- OFF: the shortcut does nothing ------------------------------
		await page.getByTestId('capability-search').uncheck();
		await composer.click();
		await page.keyboard.press('Control+f');
		await expect(page.getByRole('search', { name: 'Search messages' })).toHaveCount(0);

		// --- ON: the shortcut opens the bar, matches, and highlights -----
		await page.getByTestId('capability-search').check();
		await composer.click();
		await page.keyboard.press('Control+f');

		const searchBar = page.getByRole('search', { name: 'Search messages' });
		await expect(searchBar).toBeVisible();

		const searchInput = searchBar.getByRole('searchbox', { name: 'Search messages' });
		await searchInput.fill('deterministic');

		// Two seeded messages contain "deterministic": the user question and the
		// completed assistant reply.
		await expect(searchBar.getByText('1 of 2')).toBeVisible();

		const currentMatch = chat.locator('[data-search-match]');
		await expect(currentMatch).toHaveCount(1);
		await expect(currentMatch).toContainText('deterministic');

		await searchBar.getByRole('button', { name: 'Next match' }).click();
		await expect(searchBar.getByText('2 of 2')).toBeVisible();
		await expect(chat.locator('[data-search-match]')).toHaveCount(1);

		await searchBar.getByRole('button', { name: 'Close search' }).click();
		await expect(searchBar).toHaveCount(0);
	});
});

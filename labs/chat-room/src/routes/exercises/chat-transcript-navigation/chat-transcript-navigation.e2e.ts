import { expect, test } from '@playwright/test';
import { gotoHydrated } from '../hydration';

test('renders a bounded live child transcript and accessible navigation rail', async ({ page }) => {
	await gotoHydrated(page, '/exercises/chat-transcript-navigation');

	const rail = page.getByRole('navigation', { name: 'User messages' });
	await expect(rail).toBeVisible();
	const rows = rail.getByRole('button');
	await expect(rows).toHaveCount(1);
	await rows.first().focus();
	await expect(rows.first()).toHaveAttribute('aria-describedby', /navigation-preview/);
	await expect(page.locator('[id$="-navigation-preview"]')).toContainText('Show me the nested run');
	await expect(page.getByRole('region', { name: 'Nested session transcript' })).toBeVisible();

	await rows.first().click();
	await expect(page.getByText('Selected message: 1')).toBeVisible();
});

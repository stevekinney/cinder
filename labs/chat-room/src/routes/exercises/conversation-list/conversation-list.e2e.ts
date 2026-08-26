import { expect, test } from '@playwright/test';
import { gotoHydrated } from '../hydration';
import { pressNextTabStop } from '../keyboard';

test('switching conversations swaps the header and the rendered transcript', async ({ page }) => {
	await gotoHydrated(page, '/exercises/conversation-list');

	// Launch support is seeded as the initial active conversation.
	await expect(page.getByRole('heading', { name: 'Launch support' })).toBeVisible();

	const log = page.getByRole('log', { name: 'Messages' });
	await expect(log.getByText('When do we launch the rocket?')).toBeVisible();
	await expect(log.getByText('We launch the rocket on Friday at 9am.')).toBeVisible();
	await expect(log.getByText('Can you resend the invoice?')).not.toBeVisible();

	// Selecting a different conversation in the list swaps both the header
	// and the Chat transcript.
	await page.getByRole('button', { name: 'Billing question' }).click();

	await expect(page.getByRole('heading', { name: 'Billing question' })).toBeVisible();
	await expect(log.getByText('Can you resend the invoice?')).toBeVisible();
	await expect(log.getByText("Sure, I've resent the invoice to your inbox.")).toBeVisible();

	// The previous conversation's transcript is gone, not just scrolled away.
	await expect(log.getByText('When do we launch the rocket?')).not.toBeVisible();
	await expect(log.getByText('We launch the rocket on Friday at 9am.')).not.toBeVisible();

	// Sending a message appends only to the active conversation.
	const composer = page.getByRole('textbox', { name: 'Message' });
	await composer.fill('What is the total?');
	await page.getByRole('button', { name: 'Send message' }).click();

	await expect(log.getByText('What is the total?', { exact: true })).toBeVisible();
	await expect(log.getByText('You said: What is the total?')).toBeVisible();

	// Switching back to the third seeded conversation confirms the echoed
	// reply above stayed scoped to billing, not bled into onboarding.
	await page.getByRole('button', { name: 'Onboarding walkthrough' }).click();

	await expect(page.getByRole('heading', { name: 'Onboarding walkthrough' })).toBeVisible();
	await expect(log.getByText('How do I invite my team?')).toBeVisible();
	await expect(log.getByText('What is the total?')).not.toBeVisible();

	// Switching back to billing shows the echoed reply persisted.
	await page.getByRole('button', { name: 'Billing question' }).click();
	await expect(log.getByText('You said: What is the total?')).toBeVisible();
});

test('the list sorts by recency descending even though the page hands it unsorted summaries', async ({
	page
}) => {
	await gotoHydrated(page, '/exercises/conversation-list');

	// The page feeds ChatConversationList raw insertion order (launch, billing,
	// onboarding — oldest-created first). ChatConversationList's prop docs say
	// it sorts by recency internally, so the rendered order should be reversed:
	// onboarding (newest) first, launch (oldest) last. This pins that the
	// component really does its own sorting rather than trusting the caller.
	const mainList = page.getByTestId('main-conversation-list');
	const titles = mainList.locator('.cinder-chat-conversation-list__title');
	await expect(titles).toHaveText(['Onboarding walkthrough', 'Billing question', 'Launch support']);
});

test('unread count and participant names derive from namespaced conversation metadata', async ({
	page
}) => {
	await gotoHydrated(page, '/exercises/conversation-list');

	// Billing is seeded with conversation.metadata._unreadCount = 2 and
	// _participantNames = ['Ali Chen', 'Jordan Reyes'].
	const billingButton = page.getByRole('button', { name: 'Billing question' });
	await expect(billingButton.locator('.cinder-chat-conversation-list__badge')).toHaveText('2');
	await expect(billingButton).toHaveAccessibleName(/2 unread messages/);

	// Selecting billing shows the same metadata reflected in the header's
	// participant display (≤2 participants renders both names in full).
	await billingButton.click();
	const participants = page.getByText('Ali Chen, Jordan Reyes');
	await expect(participants).toBeVisible();
	await expect(participants).toHaveAttribute('title', 'Ali Chen, Jordan Reyes');
});

test('aria-current, keyboard selection, and focus survive the Chat remount', async ({
	page,
	browserName
}) => {
	await gotoHydrated(page, '/exercises/conversation-list');

	const launchButton = page.getByRole('button', { name: 'Launch support' });
	const billingButton = page.getByRole('button', { name: 'Billing question' });
	const onboardingButton = page.getByRole('button', { name: 'Onboarding walkthrough' });

	// Launch support is the initially active conversation; it's the only item
	// carrying aria-current, using the "page" value (not aria-selected).
	await expect(launchButton).toHaveAttribute('aria-current', 'page');
	await expect(billingButton).not.toHaveAttribute('aria-current');
	await expect(onboardingButton).not.toHaveAttribute('aria-current');

	// Native Tab order follows the rendered (sorted) DOM order: onboarding,
	// billing, launch — the component adds no roving-tabindex of its own.
	await onboardingButton.focus();
	await expect(onboardingButton).toBeFocused();
	await pressNextTabStop(page, browserName);
	await expect(billingButton).toBeFocused();
	await pressNextTabStop(page, browserName);
	await expect(launchButton).toBeFocused();

	// Enter activates the focused item, same as a click.
	await billingButton.focus();
	await page.keyboard.press('Enter');
	await expect(page.getByRole('heading', { name: 'Billing question' })).toBeVisible();
	await expect(billingButton).toHaveAttribute('aria-current', 'page');
	await expect(launchButton).not.toHaveAttribute('aria-current');
	// The list itself lives outside the page's {#key activeConversationId}
	// block (only Chat remounts), so the activated button is never removed
	// from the DOM and keeps focus through the swap.
	await expect(billingButton).toBeFocused();

	// Space activates the focused item too.
	await onboardingButton.focus();
	await page.keyboard.press(' ');
	await expect(page.getByRole('heading', { name: 'Onboarding walkthrough' })).toBeVisible();
	await expect(onboardingButton).toHaveAttribute('aria-current', 'page');
	await expect(onboardingButton).toBeFocused();
});

test('activeConversationId={null} marks no item active, and ariaLabel overrides the landmark name', async ({
	page
}) => {
	await gotoHydrated(page, '/exercises/conversation-list');

	const nav = page.getByRole('navigation', { name: 'Active null demo conversations' });
	await expect(nav).toBeVisible();

	const items = nav.locator('[data-cinder-conversation-item]');
	await expect(items).toHaveCount(3);
	for (const item of await items.all()) {
		await expect(item).not.toHaveAttribute('aria-current');
	}
});

test('empty state renders the default text and an emptyText override', async ({ page }) => {
	await gotoHydrated(page, '/exercises/conversation-list');

	const defaultTextList = page.getByRole('navigation', { name: 'Empty state demo conversations' });
	await expect(defaultTextList.locator('[data-cinder-conversation-item]')).toHaveCount(3);
	await expect(defaultTextList.getByRole('status')).toHaveCount(0);

	await page.getByTestId('empty-state-clear').click();
	await expect(defaultTextList.getByRole('status')).toHaveText('No conversations');
	await expect(defaultTextList.locator('[data-cinder-conversation-item]')).toHaveCount(0);

	await page.getByTestId('empty-state-restore').click();
	await expect(defaultTextList.locator('[data-cinder-conversation-item]')).toHaveCount(3);
	await expect(defaultTextList.getByRole('status')).toHaveCount(0);

	const customTextList = page.getByRole('navigation', {
		name: 'Custom empty text demo conversations'
	});
	await expect(customTextList.getByRole('status')).toHaveText('No saved conversations yet');
});

test('ChatConversationHeader renders its built-in export actions by default', async ({
	context,
	page,
	browserName
}) => {
	test.skip(
		browserName !== 'chromium',
		'Only Chromium maps both clipboard-read and clipboard-write permissions'
	);

	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await gotoHydrated(page, '/exercises/conversation-list');

	const header = page.getByTestId('header-default-export');
	await expect(header.getByRole('heading', { name: 'Header demo conversation' })).toBeVisible();

	// 3 participant names truncate to "first two + N" in the display label,
	// with the full list available via the title attribute.
	const participants = header.getByText('Priya Patel, Sam Osei +1');
	await expect(participants).toBeVisible();
	await expect(participants).toHaveAttribute('title', 'Priya Patel, Sam Osei, Lee Kim');

	await header.getByRole('button', { name: 'Export conversation' }).click();
	await header.getByRole('menuitem', { name: /Copy as Markdown/ }).click();

	const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
	expect(clipboardText).toContain('Testing the header export actions.');
	await expect(page.getByText('Copied as Markdown')).toBeAttached();
});

test('headingLevel={3} renders the conversation title as an actual h3', async ({ page }) => {
	await gotoHydrated(page, '/exercises/conversation-list');

	const header = page.getByTestId('header-heading-level-3');
	await expect(header.locator('h3')).toHaveText('Header demo conversation');
	await expect(header.locator('h2')).toHaveCount(0);
});

test('an actions snippet renders and receives the header conversation summary', async ({
	page
}) => {
	await gotoHydrated(page, '/exercises/conversation-list');

	const content = page.getByTestId('header-actions-content');
	await expect(content).toHaveText(
		'Header demo conversation · 2 messages · Priya Patel, Sam Osei, Lee Kim'
	);
});

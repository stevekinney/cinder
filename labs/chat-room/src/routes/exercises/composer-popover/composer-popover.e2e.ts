import { expect, test } from '@playwright/test';
import { gotoHydrated } from '../hydration';

test.describe('ChatComposerPopover slash-command menu', () => {
	test('typing "/" opens the menu and Escape dismisses it', async ({ page }) => {
		await gotoHydrated(page, '/exercises/composer-popover');

		const composer = page.getByRole('combobox', { name: 'Message' });
		const menu = page.getByRole('listbox', { name: 'Composer suggestions' });

		await expect(menu).toBeHidden();
		await composer.click();
		await composer.pressSequentially('/');

		await expect(menu).toBeVisible();
		await expect(composer).toHaveAttribute('aria-expanded', 'true');
		await expect(menu.getByRole('option', { name: 'Help, Show available commands' })).toBeVisible();
		await expect(
			menu.getByRole('option', { name: 'New thread, Start a fresh conversation' })
		).toBeVisible();

		await page.keyboard.press('Escape');
		await expect(menu).toBeHidden();
		await expect(composer).toHaveAttribute('aria-expanded', 'false');
	});

	test('arrow keys navigate the menu without sending, Enter inserts the selection', async ({
		page
	}) => {
		await gotoHydrated(page, '/exercises/composer-popover');

		const composer = page.getByRole('combobox', { name: 'Message' });
		const log = page.getByRole('log', { name: 'Messages' });

		await composer.click();
		await composer.pressSequentially('/');

		const help = page.getByRole('option', { name: 'Help, Show available commands' });
		const newThread = page.getByRole('option', {
			name: 'New thread, Start a fresh conversation'
		});

		// The first row is active by default; arrow down moves to the second.
		await expect(help).toHaveAttribute('aria-selected', 'true');
		await page.keyboard.press('ArrowDown');
		await expect(newThread).toHaveAttribute('aria-selected', 'true');
		await expect(help).toHaveAttribute('aria-selected', 'false');

		// Navigating never submits — the message log stays empty and the
		// composer keeps focus with the raw "/" still in place.
		await expect(log.locator('[data-role]')).toHaveCount(0);
		await expect(composer).toHaveValue('/');

		await page.keyboard.press('ArrowUp');
		await expect(help).toHaveAttribute('aria-selected', 'true');

		await page.keyboard.press('Enter');

		// Enter inserted the active row's text instead of sending the message.
		await expect(log.locator('[data-role]')).toHaveCount(0);
		await expect(composer).toHaveValue('/help ');
		await expect(page.getByTestId('last-selection')).toHaveText(/Inserted "Help"/);
		await expect(page.getByRole('listbox', { name: 'Composer suggestions' })).toBeHidden();

		// The inserted command behaves like ordinary composer text: it submits
		// normally through the regular send flow, proving the popover only
		// intercepted Enter while the menu was open.
		await composer.pressSequentially('me');
		await page.getByRole('button', { name: 'Send message' }).click();
		await expect(log.getByText('/help me', { exact: true })).toBeVisible();
		await expect(log.getByText('You said: /help me')).toBeVisible();
	});

	test('fuzzy filtering narrows the menu via filterFuzzySubsequence', async ({ page }) => {
		await gotoHydrated(page, '/exercises/composer-popover');

		const composer = page.getByRole('combobox', { name: 'Message' });
		const menu = page.getByRole('listbox', { name: 'Composer suggestions' });

		await composer.click();
		await composer.pressSequentially('/cd');

		await expect(menu.getByRole('option')).toHaveCount(1);
		await expect(
			menu.getByRole('option', { name: 'Clear draft, Empty the composer' })
		).toBeVisible();
	});

	test('empty query shows no matches for an unmatched subsequence', async ({ page }) => {
		await gotoHydrated(page, '/exercises/composer-popover');

		const composer = page.getByRole('combobox', { name: 'Message' });
		const menu = page.getByRole('listbox', { name: 'Composer suggestions' });

		await composer.click();
		await composer.pressSequentially('/zzz');

		// The `role="listbox"` element itself renders with zero options and zero
		// height when nothing matches — the "No suggestions" copy lives in a
		// sibling `.cinder-command-menu__empty` element, not inside the listbox.
		// That makes the listbox a legitimate zero-size element by CSS geometry
		// (Playwright's `toBeVisible()` treats it as hidden), even though the
		// popover is genuinely open and showing content to the user. Assert on
		// attachment plus the actual visible content rather than the listbox's
		// own geometry. See stevekinney/cinder upstream friction notes.
		await expect(menu).toBeAttached();
		await expect(menu.getByRole('option')).toHaveCount(0);
		await expect(page.getByText('No suggestions')).toBeVisible();
	});

	test('clearInput and getComposerValue drive the draft preview imperatively', async ({ page }) => {
		await gotoHydrated(page, '/exercises/composer-popover');

		const composer = page.getByRole('combobox', { name: 'Message' });
		const preview = page.getByTestId('draft-preview');

		await expect(preview).toHaveText('Draft: ""');

		await composer.click();
		await composer.pressSequentially('hello there');
		await page.getByRole('button', { name: 'Refresh draft preview' }).click();
		await expect(preview).toHaveText('Draft: "hello there"');

		await page.getByRole('button', { name: 'Clear draft' }).click();
		await expect(composer).toHaveValue('');
		await expect(preview).toHaveText('Draft: ""');
	});
});

test.describe('insertAtRange boundary contract', () => {
	test('an end index beyond value.length clamps to the end and lands the caret there', async ({
		page
	}) => {
		await gotoHydrated(page, '/exercises/composer-popover');

		const composer = page.getByRole('combobox', { name: 'Message' });
		const preview = page.getByTestId('draft-preview');
		const caret = page.getByTestId('caret-position');

		await composer.click();
		await composer.pressSequentially('hi');

		await page.getByRole('button', { name: 'Insert clamped at end' }).click();

		// `end` (2 + 1000) clamps to the composer's current length (2) per the
		// native `setRangeText` contract, so the insertion lands at the end
		// rather than throwing or truncating anything already in the box.
		await expect(composer).toHaveValue('hi[clamped]');
		await page.getByRole('button', { name: 'Refresh draft preview' }).click();
		await expect(preview).toHaveText('Draft: "hi[clamped]"');
		await expect(caret).toHaveText('Caret: 11-11');
	});

	test('a reversed range throws without crashing the page or touching the composer', async ({
		page
	}) => {
		await gotoHydrated(page, '/exercises/composer-popover');

		const composer = page.getByRole('combobox', { name: 'Message' });
		const rangeError = page.getByTestId('insert-range-error');

		await composer.click();
		await composer.pressSequentially('hello there');

		await page.getByRole('button', { name: 'Insert reversed range' }).click();

		// FRICTION: the task brief describes the reversed-range contract as
		// "THROWS RangeError", but the underlying primitive is the native
		// `HTMLTextAreaElement.setRangeText`, and Chromium reports a reversed
		// range as `DOMException` named "IndexSizeError" — never a `RangeError`
		// instance. Asserting the documented "RangeError" name here would be a
		// false assertion against this codebase's actual (Chromium-only,
		// per playwright.config.ts) test runtime, so this pins the name that is
		// actually thrown instead of the name the brief describes.
		await expect(rangeError).toHaveText('Range error: IndexSizeError');
		await expect(composer).toHaveValue('hello there');

		// The page itself stayed interactive — a crash would make this hang or
		// throw instead of resolving.
		await expect(composer).toBeEnabled();
	});
});

test.describe('ARIA under reactive updates', () => {
	test('aria-controls, aria-activedescendant, and aria-expanded track the open popover', async ({
		page
	}) => {
		await gotoHydrated(page, '/exercises/composer-popover');

		const composer = page.getByRole('combobox', { name: 'Message' });
		const menu = page.getByRole('listbox', { name: 'Composer suggestions' });

		await composer.click();
		await composer.pressSequentially('/');
		await expect(menu).toBeVisible();
		await expect(composer).toHaveAttribute('aria-expanded', 'true');

		const menuId = await menu.getAttribute('id');
		expect(menuId).toBeTruthy();
		await expect(composer).toHaveAttribute('aria-controls', menuId ?? '');

		const selectedOption = menu.getByRole('option', { selected: true });
		const selectedId = await selectedOption.getAttribute('id');
		expect(selectedId).toBeTruthy();
		await expect(composer).toHaveAttribute('aria-activedescendant', selectedId ?? '');

		await page.keyboard.press('ArrowDown');

		const nextSelectedOption = menu.getByRole('option', { selected: true });
		const nextSelectedId = await nextSelectedOption.getAttribute('id');
		expect(nextSelectedId).toBeTruthy();
		expect(nextSelectedId).not.toBe(selectedId);
		await expect(composer).toHaveAttribute('aria-activedescendant', nextSelectedId ?? '');

		await page.keyboard.press('Escape');

		await expect(menu).toBeHidden();
		await expect(composer).toHaveAttribute('aria-expanded', 'false');
		// `activeItemId` and `open` clear together in ChatComposerPopover, so
		// `composerAriaActiveDescendant` becomes `undefined` and the attribute
		// itself is removed rather than left pointing at a stale option id —
		// no lingering-AT-focus bug was found here.
		await expect(composer).not.toHaveAttribute('aria-activedescendant');
	});
});

test.describe('IME composition and oncomposerkeydown', () => {
	test('the hook fires on a normal Enter but not during IME composition', async ({ page }) => {
		await gotoHydrated(page, '/exercises/composer-popover');

		const composer = page.getByRole('combobox', { name: 'Message' });
		const log = page.getByRole('log', { name: 'Messages' });
		const keydownCount = page.getByTestId('composer-keydown-count');

		await expect(keydownCount).toHaveText('Composer keydown count: 0');

		// Baseline: a normal Enter reaches the hook and sends the message
		// through the ordinary submit flow.
		await composer.click();
		await composer.pressSequentially('hello');
		await composer.press('Enter');

		await expect(keydownCount).toHaveText('Composer keydown count: 1');
		await expect(log.getByText('hello', { exact: true })).toBeVisible();

		const messageCountBeforeIme = await log.locator('[data-role]').count();

		// IME case: `page.keyboard`/`pressSequentially` fire native, non-composing
		// key events, and there is no public Chromium/CDP hook to drive a real
		// IME session deterministically. Dispatching a synthetic `KeyboardEvent`
		// with `isComposing: true` directly on the textarea (rather than through
		// `page.keyboard`) is the deterministic substitute: it exercises the
		// exact guard `chat-input.svelte`'s `handleKeyDown` branches on
		// (`event.isComposing || isComposing`), it's spec-legal — `isComposing`
		// is a documented member of `KeyboardEventInit`
		// (https://w3c.github.io/uievents/#dictdef-keyboardeventinit) — and it
		// was verified locally to set `event.isComposing === true` on dispatch.
		// A real composed keystroke would be racy across CI machines; this is
		// not.
		await composer.pressSequentially('IME');
		await composer.evaluate((element) => {
			element.dispatchEvent(new Event('compositionstart', { bubbles: true }));
		});
		await composer.evaluate((element) => {
			element.dispatchEvent(
				new KeyboardEvent('keydown', {
					key: 'Enter',
					code: 'Enter',
					isComposing: true,
					bubbles: true,
					cancelable: true
				})
			);
		});
		await composer.evaluate((element) => {
			element.dispatchEvent(new Event('compositionend', { bubbles: true }));
		});

		// The hook did not fire during composition, and no message was sent —
		// both the counter and the message log stay exactly where they were.
		await expect(keydownCount).toHaveText('Composer keydown count: 1');
		await expect(log.locator('[data-role]')).toHaveCount(messageCountBeforeIme);
	});
});

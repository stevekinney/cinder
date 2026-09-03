import { expect, test } from '@playwright/test';

// `--cinder-chat-message-max-width` is registered with `@property` in
// `packages/chat/src/lib/components/chat/chat.css`. A registration is a
// browser-side contract that the source-regex unit tests cannot see through:
// a typed registration whose `initial-value` is not computationally
// independent (a `rem` length, for one) is silently dropped by the engine,
// and the token then has no default at all. This spec reads the computed
// result back from the lab's real production bundle, so it also proves the
// sidecar reached the client build at all (CIN-514).

const TOKEN = '--cinder-chat-message-max-width';

test.describe('chat measure token registration', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await page.locator('.cinder-chat').first().waitFor();
	});

	test('the @property registration is live and supplies the 48rem default', async ({ page }) => {
		// An unset registered property computes to its `initial-value` on every
		// element; a dropped registration computes to the empty string.
		await expect
			.poll(() =>
				page.evaluate(
					(token) => getComputedStyle(document.documentElement).getPropertyValue(token).trim(),
					TOKEN
				)
			)
			.toBe('48rem');
		expect(
			await page.evaluate(
				(token) =>
					getComputedStyle(document.querySelector('.cinder-chat')!).getPropertyValue(token).trim(),
				TOKEN
			)
		).toBe('48rem');
	});

	test('an override on :root inherits into the Chat root', async ({ page }) => {
		// This is the regression the registration exists to prevent: with the
		// default declared on `.cinder-chat` itself, an ancestor's value never
		// reached the component, whatever the layer.
		await page.addStyleTag({ content: `:root { ${TOKEN}: 30rem; }` });
		await expect
			.poll(() =>
				page.evaluate(
					(token) =>
						getComputedStyle(document.querySelector('.cinder-chat')!)
							.getPropertyValue(token)
							.trim(),
					TOKEN
				)
			)
			.toBe('30rem');
	});
});

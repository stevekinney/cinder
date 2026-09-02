import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

// `--cinder-chat-message-max-width` is registered with `@property` in
// `packages/chat/src/lib/components/chat/chat.css`. A registration is a
// browser-side contract that the source-regex unit tests cannot see through:
// a typed registration whose `initial-value` is not computationally
// independent (a `rem` length, for one) is silently dropped by the engine,
// and the token then has no default at all. This spec feeds the real sidecar
// source to real engines and reads the computed result back.
//
// The stylesheet is injected rather than relied on from the bundle because
// the lab's production client bundle currently drops the sidecar (CIN-514);
// once that lands, the injection is redundant but still harmless.
const CHAT_CSS = readFileSync(
	join(
		dirname(fileURLToPath(import.meta.url)),
		'../../../../packages/chat/src/lib/components/chat/chat.css'
	),
	'utf8'
);

const TOKEN = '--cinder-chat-message-max-width';

test.describe('chat measure token registration', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await page.locator('.cinder-chat').first().waitFor();
		await page.addStyleTag({ content: CHAT_CSS });
	});

	test('the @property registration is live and supplies the 48rem default', async ({ page }) => {
		// An unset registered property computes to its `initial-value` on every
		// element; a dropped registration computes to the empty string.
		await expect
			.poll(() =>
				page.evaluate(
					(token) => getComputedStyle(document.documentElement).getPropertyValue(token),
					TOKEN
				)
			)
			.toBe('48rem');
		expect(
			await page.evaluate(
				(token) => getComputedStyle(document.querySelector('.cinder-chat')!).getPropertyValue(token),
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
					(token) => getComputedStyle(document.querySelector('.cinder-chat')!).getPropertyValue(token),
					TOKEN
				)
			)
			.toBe('30rem');
	});
});

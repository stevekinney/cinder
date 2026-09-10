/**
 * The typed-agent result contract, asserted against what the runtime does
 * rather than what a reader would assume.
 *
 * CIN-439 specified `status=failed` with `kind`/`code` on the terminal
 * result. Measured against `@lostgradient/operative@0.10.0`, that is not the
 * behavior: a schema-invalid run settles `stop-condition` with no
 * `result.error`, exactly like a valid one. These specs pin the real
 * asymmetry, because it is the trap — a consumer reading `finishReason`
 * alone cannot tell a garbage answer from a good one.
 */

import { expect, test } from '@playwright/test';

import { gotoHydrated } from '../hydration';

const field = (panel: 'valid' | 'invalid', name: string) =>
	`[data-testid="output-${panel}-${name}"]`;

test('a valid run resolves its typed output', async ({ page }) => {
	await gotoHydrated(page, '/exercises/output');

	await expect(page.locator(field('valid', 'finish'))).toHaveText('stop-condition');
	await expect(page.locator(field('valid', 'schema-valid'))).toHaveText('true');
	await expect(page.locator(field('valid', 'output'))).toContainText('forty-two');

	// Neither accessor rejects on the happy path, which is what makes the
	// rejection below meaningful rather than a property of every run.
	await expect(page.locator(field('valid', 'unwrap'))).toHaveText('(resolved)');
	await expect(page.locator(field('valid', 'output-method'))).toHaveText('(resolved)');
});

test('an invalid run is indistinguishable from a valid one by finishReason', async ({ page }) => {
	await gotoHydrated(page, '/exercises/output');

	// The whole point. Same finish reason, no error on the terminal result —
	// a consumer that branches on `finishReason` ships a bug here.
	await expect(page.locator(field('invalid', 'finish'))).toHaveText('stop-condition');
	await expect(page.locator(field('invalid', 'finish'))).toHaveText(
		await page.locator(field('valid', 'finish')).innerText()
	);
	await expect(page.locator(field('invalid', 'has-error'))).toHaveText('false');
});

test('schemaValidation is the only terminal field that tells them apart', async ({ page }) => {
	await gotoHydrated(page, '/exercises/output');

	await expect(page.locator(field('valid', 'schema-valid'))).toHaveText('true');
	await expect(page.locator(field('invalid', 'schema-valid'))).toHaveText('false');
});

test('unwrap() and output() reject with one shared error carrying kind and code', async ({
	page
}) => {
	await gotoHydrated(page, '/exercises/output');

	await expect(page.locator(field('invalid', 'unwrap'))).toHaveText('OutputValidationError');
	await expect(page.locator(field('invalid', 'output-method'))).toHaveText('OutputValidationError');

	// Identity, not shape. `result()` caches, and both accessors are documented
	// to surface that one cached error — comparing messages would pass even if
	// each call minted a fresh instance.
	await expect(page.locator(field('invalid', 'same-instance'))).toHaveText('true');

	// The kind/code pair CIN-439 asked for is real; it just lives on the
	// rejection and on `schemaValidation.error`, never on `result.error`.
	await expect(page.locator(field('invalid', 'kind-code'))).toHaveText('output / INVALID_OUTPUT');
});

test('never exposes stale or partial output on a failed validation', async ({ page }) => {
	await gotoHydrated(page, '/exercises/output');

	// `result.output` is absent rather than holding the rejected candidate or
	// a remembered earlier value — the failure mode this criterion guards is a
	// UI rendering `42` as though the agent had answered.
	await expect(page.locator(field('invalid', 'output'))).toHaveText('(none)');
	await expect(page.locator(field('invalid', 'output'))).not.toContainText('42');
});

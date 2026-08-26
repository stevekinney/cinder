import { expect, test } from '@playwright/test';
import { gotoHydrated } from '../hydration';

test('shows starter prompts, streaming status, metadata fallback, and callback overrides', async ({
	page
}) => {
	await gotoHydrated(page, '/exercises/assistant-metadata');

	const log = page.getByRole('log', { name: 'Messages' });

	// Empty state: starter prompt buttons are shown before any message exists.
	const starterPrompt = page.getByRole('button', { name: 'Explain quantum entanglement' });
	await expect(starterPrompt).toBeVisible();
	await expect(page.getByRole('button', { name: 'What is superposition?' })).toBeVisible();

	// Clicking a starter prompt submits it as a user message. Retried via
	// `toPass()`: this is the page's first interaction, and under heavy
	// parallel test load SvelteKit's hydration can still be attaching event
	// listeners when the click fires, so the click is silently lost rather
	// than slow — a plain `.click()` doesn't catch that, since Playwright's
	// actionability checks don't confirm a listener is attached. The click is
	// gated on the message not already being present so a retry can't
	// double-submit. Scoped to `.chat-message` (not `log.getByText`, which
	// also matches the starter-prompt button itself since it renders inside
	// the `log` region).
	const firstUserMessage = log.locator('.chat-message', {
		hasText: 'Explain quantum entanglement'
	});
	await expect(async () => {
		if ((await firstUserMessage.count()) === 0) await starterPrompt.click();
		await expect(firstUserMessage).toBeVisible({ timeout: 1000 });
	}).toPass();

	// While streaming has started but no content has arrived yet, the
	// "Thinking…" streamingStatus label is shown.
	await expect(page.getByRole('status', { name: 'Thinking…' })).toBeVisible();

	// First assistant reply completes, sourced from message.metadata['cinder:*']
	// fallbacks (no messageReasoning/messageSteps/messageSuggestions override).
	await expect(
		log.getByText('Quantum entanglement is a phenomenon where two particles')
	).toBeVisible();

	const reasoningToggle = page.getByRole('button', { name: /reasoning/i }).first();
	await expect(reasoningToggle).toBeVisible();
	await reasoningToggle.click();
	await expect(log.getByText('Recall the EPR paradox and Bell inequality')).toBeVisible();

	await expect(log.getByText('Recall physics')).toBeVisible();
	await expect(log.getByText('EPR paradox and Bell inequality basics.')).toBeVisible();

	const fallbackSuggestion = page.getByRole('button', { name: 'Explain superposition' });
	await expect(fallbackSuggestion).toBeVisible();
	await expect(page.getByRole('button', { name: "What is Bell's theorem?" })).toBeVisible();

	// Selecting a suggestion chip submits it as a new user message, which
	// advances to the second scripted turn (the messageReasoning/messageSteps/
	// messageSuggestions callback override path, with no metadata set on the
	// message at all).
	await fallbackSuggestion.click();
	await expect(log.getByText('Explain superposition', { exact: true })).toBeVisible();

	await expect(page.getByRole('status', { name: 'Thinking…' })).toBeVisible();

	await expect(
		log.getByText('Superposition is the idea that a quantum system can exist')
	).toBeVisible();

	const overrideReasoningToggle = page.getByRole('button', { name: /reasoning/i }).nth(1);
	await expect(overrideReasoningToggle).toBeVisible();
	await overrideReasoningToggle.click();
	await expect(
		log.getByText('Override reasoning: contrast superposition with entanglement')
	).toBeVisible();

	await expect(log.getByText('Contrast concepts')).toBeVisible();
	await expect(log.getByText('Compare entanglement with superposition.')).toBeVisible();

	await expect(page.getByRole('button', { name: 'Explain wave-particle duality' })).toBeVisible();
});

test('metadata/callback precedence on the same message: fallback, suppression, override', async ({
	page
}) => {
	await gotoHydrated(page, '/exercises/assistant-metadata');

	const log = page.getByRole('log', { name: 'Messages' });
	const starterPrompt = page.getByRole('button', { name: 'Explain quantum entanglement' });

	// First interaction on the page — see the note on the `toPass()` pattern
	// in the test above.
	const firstUserMessage = log.locator('.chat-message', {
		hasText: 'Explain quantum entanglement'
	});
	await expect(async () => {
		if ((await firstUserMessage.count()) === 0) await starterPrompt.click();
		await expect(firstUserMessage).toBeVisible({ timeout: 1000 });
	}).toPass();

	await expect(
		log.getByText('Quantum entanglement is a phenomenon where two particles')
	).toBeVisible();

	// (a) Metadata fallback (the default, pre-any-override state): reasoning,
	// steps, and suggestions all come from message.metadata['cinder:*'] since
	// messageReasoning/messageSteps/messageSuggestions return undefined for
	// this message (no callback opinion).
	const reasoningToggle = page.getByRole('button', { name: /reasoning/i }).first();
	await expect(reasoningToggle).toBeVisible();
	await reasoningToggle.click();
	await expect(log.getByText('Recall the EPR paradox and Bell inequality')).toBeVisible();
	await expect(log.getByText('Recall physics')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Explain superposition' })).toBeVisible();
	await expect(page.getByRole('button', { name: "What is Bell's theorem?" })).toBeVisible();

	// (b) Suppression: the callback returns '' / [] for this message — the
	// documented suppression-sentinel contract (resolveMessageReasoning /
	// resolveMessageSteps / resolveMessageSuggestions in @lostgradient/chat).
	// That is authoritative, so metadata does NOT fall through — nothing
	// renders, even though the message still carries the metadata.
	await page.getByTestId('metadata-mode-suppress').click();
	await expect(log.getByText('Recall the EPR paradox and Bell inequality')).toHaveCount(0);
	await expect(page.getByRole('button', { name: /reasoning/i })).toHaveCount(0);
	await expect(log.getByText('Recall physics')).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Explain superposition' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: "What is Bell's theorem?" })).toHaveCount(0);

	// (c) Override: a non-empty callback return wins outright over metadata.
	// The reasoning disclosure's expanded state persists per message id
	// (owned by Chat's own disclosure state, independent of whether the
	// toggle was rendered in between) — it was expanded in (a), so the
	// override reasoning text is visible immediately, no re-click needed.
	await page.getByTestId('metadata-mode-override').click();
	await expect(
		log.getByText('Callback override reasoning wins over cinder:reasoning metadata.')
	).toBeVisible();
	await expect(log.getByText('Callback step')).toBeVisible();
	await expect(log.getByText('Supplied by messageSteps, not metadata.')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Callback override suggestion' })).toBeVisible();
	// The original metadata content is nowhere present now that the override wins.
	await expect(log.getByText('Recall the EPR paradox and Bell inequality')).toHaveCount(0);
	await expect(log.getByText('Recall physics')).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Explain superposition' })).toHaveCount(0);

	// Back to (a): clearing the override falls through to metadata again.
	await page.getByTestId('metadata-mode-fallback').click();
	await expect(log.getByText('Recall the EPR paradox and Bell inequality')).toBeVisible();
	await expect(log.getByText('Recall physics')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Explain superposition' })).toBeVisible();
	await expect(
		log.getByText('Callback override reasoning wins over cinder:reasoning metadata.')
	).toHaveCount(0);
});

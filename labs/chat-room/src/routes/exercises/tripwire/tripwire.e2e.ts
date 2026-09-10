/**
 * A tripwire-mode input guardrail, and the control that makes it meaningful.
 *
 * "A detector fired" is the easy half and it is not what `mode: 'tripwire'`
 * buys you: the third panel fires the same detector, at the same confidence,
 * over the same injection, and the run keeps going. So the assertions here
 * are paired — every claim about the tripped panel is checked against the
 * `validate` panel, where the same detection produced a different terminal
 * shape. Read on its own, `finishReason: 'tripwire'` would look like proof of
 * something the counters are actually the proof of.
 */

import { expect, test } from '@playwright/test';

import { gotoHydrated } from '../hydration';

const field = (panel: string, name: string) => `[data-testid="tripwire-${panel}-${name}"]`;

test('halts the run before the model is ever called', async ({ page }) => {
	await gotoHydrated(page, '/exercises/tripwire');

	await expect(page.locator(field('tripped', 'finish'))).toHaveText('tripwire');

	// The termination evidence. `generate` is a local function that counts its
	// own invocations, so zero here means the provider call the guardrail
	// exists to prevent genuinely never happened — not merely that its result
	// was discarded afterwards.
	await expect(page.locator(field('tripped', 'generate-calls'))).toHaveText('0');
	await expect(page.locator(field('tripped', 'steps'))).toHaveText('0');

	// Nothing was appended: the transcript still holds only the user message
	// the page seeded. A substituted refusal would make this 2.
	await expect(page.locator(field('tripped', 'transcript-length'))).toHaveText('1');

	// Nothing reached the generator to inspect, which is the same fact from
	// the other side.
	await expect(page.locator(field('tripped', 'prompt-seen'))).toHaveText('(generate not called)');
});

test('surfaces the guardrail identity on both the event and the terminal error', async ({
	page
}) => {
	await gotoHydrated(page, '/exercises/tripwire');

	// Both views, rendered in one canonical shape so every field is pinned
	// rather than two of four being searched for. `confidence` in particular:
	// a terminal error reconstructed with 0.9 while the event still reported
	// 0.3 would violate the same-identity claim and pass a substring check.
	const identity = 'prompt-injection · prompt-injection · input · 0.3';

	// The live view: `run.tripwire`, dispatched before the run settles.
	await expect(page.locator(field('tripped', 'event-identity'))).toHaveText(identity);
	await expect(page.locator(field('tripped', 'event-step'))).toHaveText('0');

	// The settled view: the same identity reconstructed onto `result.error`,
	// which is all a caller holding only the awaited result can see. Both are
	// asserted because they are populated by different code paths.
	await expect(page.locator(field('tripped', 'error'))).toHaveText('GuardrailTripwireError');
	await expect(page.locator(field('tripped', 'error-identity'))).toHaveText(identity);

	// …and that they are the same, compared in the page rather than inferred
	// from two assertions that happen to name the same literal.
	await expect(page.locator(field('tripped', 'identity-matches'))).toHaveText('true');
});

test('the same detector under the default mode does not stop the run', async ({ page }) => {
	await gotoHydrated(page, '/exercises/tripwire');

	// The control. Same injection, same detector, and NO `mode` passed — so
	// this covers operative's own defaulting rather than an explicitly
	// configured `'validate'`, which would leave the sentence this test is
	// named after unverified. The result is a terminal shape indistinguishable
	// from a successful run: no error, and the same `stop-condition` the
	// benign panel reports.
	await expect(page.locator(field('continued', 'finish'))).toHaveText('stop-condition');
	await expect(page.locator(field('continued', 'error'))).toHaveText('(none)');
	await expect(page.locator(field('continued', 'event-identity'))).toHaveText('(none)');

	// Continuing is NOT the same as letting the prompt through. The input
	// guardrail short-circuits generate even in the default mode, so the
	// injection never reaches the model here either — and without this line a
	// regression that started calling `generate` and then overwrote its answer
	// would leave the step, transcript, and substitution assertions all green.
	await expect(page.locator(field('continued', 'generate-calls'))).toHaveText('0');
	await expect(page.locator(field('continued', 'prompt-seen'))).toHaveText('(generate not called)');

	// It took a step and grew the transcript, which is exactly what the
	// tripped panel did not do.
	await expect(page.locator(field('continued', 'steps'))).toHaveText('1');
	await expect(page.locator(field('continued', 'transcript-length'))).toHaveText('2');

	// What landed there is not the model's answer — the page decides that
	// against its own fixture constant. Asserting the refusal WORDING would
	// pin operative's copy, which can change without any of this behavior
	// changing; the substitution itself is the fact the panel is about.
	await expect(page.locator(field('continued', 'substituted'))).toHaveText('true');

	// And what landed there is an assistant message with something in it.
	// "Differs from MODEL_ANSWER" alone would accept an appended system or
	// tool message, or one with empty content — none of which is the refusal
	// this panel says it is showing.
	await expect(page.locator(field('continued', 'transcript-roles'))).toHaveText('user, assistant');
	await expect(page.locator(field('continued', 'last-role'))).toHaveText('assistant');
	await expect(page.locator(field('continued', 'last-nonempty'))).toHaveText('true');
});

test('leaves a benign request alone', async ({ page }) => {
	await gotoHydrated(page, '/exercises/tripwire');

	// Without this panel, a guardrail that refused everything would pass every
	// assertion above.
	await expect(page.locator(field('clean', 'finish'))).toHaveText('stop-condition');
	await expect(page.locator(field('clean', 'generate-calls'))).toHaveText('1');
	await expect(page.locator(field('clean', 'event-identity'))).toHaveText('(none)');

	// The model's own answer reached the transcript untouched. This is also
	// what keeps the `substituted` field above honest: a field that read
	// `true` unconditionally would pass there and fail here.
	await expect(page.locator(field('clean', 'substituted'))).toHaveText('false');
	await expect(page.locator(field('clean', 'last-message'))).toContainText('Paris');

	// Structurally untouched, not merely correct at the tail: a guardrail
	// that appended a refusal BEFORE the right answer would leave a
	// last-message check green on a three-message transcript.
	await expect(page.locator(field('clean', 'transcript-length'))).toHaveText('2');
	await expect(page.locator(field('clean', 'transcript-roles'))).toHaveText('user, assistant');

	// And the REQUEST was left alone, not just the reply. This page's
	// `generate` returns a fixed string without reading its context, so
	// nothing above would notice a guardrail that sanitized the user message
	// on its way through — the answer, the count, and the roles would all
	// still be right. What `generate` was handed is the only thing that says
	// the prompt arrived intact.
	await expect(page.locator(field('clean', 'prompt-seen'))).toHaveText(
		'What is the capital of France?'
	);
});

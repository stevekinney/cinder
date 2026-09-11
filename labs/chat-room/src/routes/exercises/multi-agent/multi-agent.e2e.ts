/**
 * The multi-agent exercise: one parent agent, one `createSubagentTool`
 * delegation, and what actually crosses back.
 *
 * Network-free. The child agent's `generate` returns a fixed string and the
 * parent's returns one tool call and then a narration, so every number this
 * spec reads is produced by Operative's own loop against local fixtures.
 *
 * The assertions are RELATIONAL rather than literal wherever Operative owns
 * the value. `returnMode: 'summary'` with the default summarizer applies a
 * character cap whose exact cut point and truncation marker are vendor copy —
 * pinning either would fail on a cosmetic upstream change while telling a
 * reader nothing. What the page demonstrates, and what this pins, is that the
 * three settings differ from one another in the specific ways the route
 * claims.
 */

import { expect, test } from '@playwright/test';

import { gotoHydrated } from '../hydration';

/** Every panel has settled, so no assertion below reads a pending state. */
async function settled(page: import('@playwright/test').Page): Promise<void> {
	await expect(page.getByTestId('multi-agent-status')).toHaveText('3 of 3 delegations settled.');
}

test('the parent delegates exactly once and the child runs exactly once', async ({ page }) => {
	await gotoHydrated(page, '/exercises/multi-agent');
	await settled(page);

	// Two parent turns: the one that emits the tool call, and the one after the
	// result comes back. One child turn, from the single delegation. A loop
	// that re-entered the subagent would move the second number, and a stop
	// condition that never fired would move the first.
	await expect(page.getByTestId('multi-agent-summary-parent-calls')).toHaveText('2');
	await expect(page.getByTestId('multi-agent-summary-child-calls')).toHaveText('1');
	await expect(page.getByTestId('multi-agent-summary-tool-executions')).toHaveText('1');
	await expect(page.getByTestId('multi-agent-summary-finish')).toHaveText('stop-condition');

	// The delegation is in the transcript as a call and a result, not only in
	// the counters above.
	const roles = await page.getByTestId('multi-agent-summary-roles').textContent();
	expect(roles).toContain('tool-call');
	expect(roles).toContain('tool-result');
});

test("the delegation renders as a tool-activity entry in Chat's transcript", async ({ page }) => {
	await gotoHydrated(page, '/exercises/multi-agent');
	await settled(page);

	// This is the acceptance criterion: the delegation is visible as tool
	// activity in the transcript, not merely reported by the page's own
	// bookkeeping beneath it.
	//
	// Chat renders a consecutive tool-call run as its own transcript row rather
	// than inside a message wrapper — `.chat-tool-call-timeline`, a labelled
	// `section` — and falls back to cinder's `RunStepTimeline` when the tools
	// carry no activity presentation, which is the case for a plain
	// `createSubagentTool`. Asserting the shape that actually renders rather
	// than the presented variant: a selector for the other branch would pass
	// vacuously against zero elements if this ever stopped rendering at all.
	const timeline = page.locator('[data-testid="multi-agent-chat"] .chat-tool-call-timeline');
	await expect(timeline).toHaveCount(1);

	// ONE call, and it completed. The heading counts both, so a call left
	// unpaired with its result — which renders the same row — says "Called 1
	// tools" with no completion clause.
	await expect(timeline).toHaveAttribute('data-cinder-tool-call-count', '1');
	await expect(timeline.getByRole('heading')).toHaveText('Called 1 tools, 1 complete');

	// Named, and reported as succeeded.
	await expect(timeline.locator('.cinder-run-step-timeline__label')).toHaveText(
		'consult_researcher'
	);
	await expect(timeline.locator('.cinder-run-step-timeline__status')).toHaveAttribute(
		'aria-label',
		'Status: Succeeded'
	);
});

test('expanding the entry shows the question sent and the summary that came back', async ({
	page
}) => {
	await gotoHydrated(page, '/exercises/multi-agent');
	await settled(page);

	const timeline = page.locator('[data-testid="multi-agent-chat"] .chat-tool-call-timeline');

	// Two separate disclosures rather than one — the payloads are collapsed
	// independently, so each has to be opened to be read.
	await timeline.getByRole('button', { name: 'Arguments' }).click();
	await timeline.getByRole('button', { name: 'Result' }).click();

	const payloads = timeline.locator('.cinder-run-step-timeline__detail-content');
	await expect(payloads).toHaveCount(2);

	// The arguments the parent sent, which is what proves the child was asked
	// this page's question rather than something the loop synthesized.
	await expect(timeline).toContainText('What did we decide about the staging bucket?');

	// And the summary content that crossed back. The child's answer is that
	// sentence repeated thirty times; under the cap the entry carries the
	// opening and not the thirtieth repetition.
	const shown = (await timeline.textContent()) ?? '';
	const occurrences = shown.split('The staging bucket was retained.').length - 1;
	expect(occurrences).toBeGreaterThan(0);
	expect(occurrences).toBeLessThan(30);
});

test("'summary' caps the child's answer rather than condensing it", async ({ page }) => {
	await gotoHydrated(page, '/exercises/multi-agent');
	await settled(page);

	// The headline the route exists to make legible. Under the default
	// summarizer the returned text is SHORTER than the child's answer and
	// still OPENS with the child's own words — which is what a head truncation
	// looks like and what real condensation need not do.
	await expect(page.getByTestId('multi-agent-summary-shortened')).toHaveText('true');
	await expect(page.getByTestId('multi-agent-summary-whole')).toHaveText('false');
	await expect(page.getByTestId('multi-agent-summary-opening')).toHaveText('true');
	await expect(page.getByTestId('multi-agent-summary-custom')).toHaveText('no');

	const capped = Number(await page.getByTestId('multi-agent-summary-length').textContent());
	const whole = Number(await page.getByTestId('multi-agent-full-length').textContent());
	expect(capped).toBeGreaterThan(0);
	expect(capped).toBeLessThan(whole);
});

test("'full' returns the child's answer unchanged", async ({ page }) => {
	await gotoHydrated(page, '/exercises/multi-agent');
	await settled(page);

	await expect(page.getByTestId('multi-agent-full-whole')).toHaveText('true');
	await expect(page.getByTestId('multi-agent-full-shortened')).toHaveText('false');
	await expect(page.getByTestId('multi-agent-full-finish')).toHaveText('stop-condition');
});

test('a caller-supplied summarizer is what actually condenses', async ({ page }) => {
	await gotoHydrated(page, '/exercises/multi-agent');
	await settled(page);

	// The seam the default fills with a cap. The returned text is this page's
	// own summarizer output exactly — so it is shorter than the capped panel's,
	// and it does NOT open with the child's words the way a truncation does.
	await expect(page.getByTestId('multi-agent-custom-custom')).toHaveText('yes');
	await expect(page.getByTestId('multi-agent-custom-opening')).toHaveText('false');
	await expect(page.getByTestId('multi-agent-custom-whole')).toHaveText('false');

	const condensed = Number(await page.getByTestId('multi-agent-custom-length').textContent());
	const capped = Number(await page.getByTestId('multi-agent-summary-length').textContent());
	expect(condensed).toBeLessThan(capped);
});

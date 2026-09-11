/**
 * The multi-agent exercise: three independent runs, one per `returnMode`
 * setting, each with its own parent agent, its own researcher subagent, and
 * exactly one `createSubagentTool` delegation — and what actually crosses back
 * from each.
 *
 * "One parent, one delegation" is PER PANEL. Loading the route starts all
 * three, which is why the count assertions below are parameterised over every
 * panel rather than reading the first one: the three share no state, so a loop
 * re-entering the subagent on one of them would leave the others' numbers
 * untouched.
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
async function settled(page: import('@playwright/test').Page, total = 3): Promise<void> {
	await expect(page.getByTestId('multi-agent-status')).toHaveText(
		`${total} of ${total} delegations settled.`
	);
}

// Every panel, not just the one whose output the other tests read. Each runs
// its OWN parent and child, so a loop that re-entered the subagent on the
// `full` or custom path would leave those panels' output assertions green —
// the same string can come back after one delegation or after three.
const PANELS = ['summary', 'full', 'custom'] as const;

for (const panel of PANELS) {
	test(`the ${panel} panel delegates exactly once and its child runs exactly once`, async ({
		page
	}) => {
		await gotoHydrated(page, '/exercises/multi-agent');
		await settled(page);

		// Two parent turns: the one that emits the tool call, and the one after
		// the result comes back. One child turn, from the single delegation. A
		// loop that re-entered the subagent would move the second number, and a
		// stop condition that never fired would move the first.
		await expect(page.getByTestId(`multi-agent-${panel}-parent-calls`)).toHaveText('2');
		await expect(page.getByTestId(`multi-agent-${panel}-child-calls`)).toHaveText('1');
		await expect(page.getByTestId(`multi-agent-${panel}-tool-executions`)).toHaveText('1');
		await expect(page.getByTestId(`multi-agent-${panel}-finish`)).toHaveText('stop-condition');

		// The delegation is in the transcript as a call and a result, not only in
		// the counters above.
		const roles = await page.getByTestId(`multi-agent-${panel}-roles`).textContent();
		expect(roles).toContain('tool-call');
		expect(roles).toContain('tool-result');

		// And the child was asked THIS question. The fixture records what
		// reached it, because otherwise `createSubagentTool` dropping or
		// corrupting whatever `toAgentInput` produced is undetectable: the child
		// answers the same way regardless, and the transcript shows the parent's
		// original tool-call arguments rather than what crossed the boundary.
		await expect(page.getByTestId(`multi-agent-${panel}-received`)).toHaveText(
			'What did we decide about the staging bucket?'
		);
	});
}

test('a failed delegation reaches the announcer', async ({ page }) => {
	// The registry entry in `error-live-regions.e2e.ts` covers the "before"
	// half — mounted and empty. This is the other half: without it, deleting the
	// `announcement = ...` assignment would leave the whole suite green while a
	// real failure became silent to assistive technology.
	await gotoHydrated(page, '/exercises/multi-agent?fail=1');
	await settled(page, 4);

	const announcer = page.getByTestId('multi-agent-failure');
	await expect(announcer).toHaveAttribute('role', 'alert');
	await expect(announcer).toContainText('Induced delegation failure.');

	// The visible per-panel message is separate from the region that announces,
	// and is NOT itself a live region — two regions describing one failure would
	// say it twice.
	const visible = page.getByTestId('multi-agent-induced-failed');
	await expect(visible).toBeVisible();
	await expect(visible).not.toHaveAttribute('role', 'alert');

	// The three real panels still settled, so the induced failure is additive
	// rather than a way of skipping them.
	await expect(page.getByTestId('multi-agent-summary-finish')).toHaveText('stop-condition');

	// And the gate is REACTIVE, not read once at init. SvelteKit reuses this
	// component across a client-side navigation to the same route, so a
	// one-time read would leave the panel set frozen at whatever `?fail=` was
	// present on first load. Driven through the router's own path — a
	// same-origin anchor click — with a marker proving the document was not
	// replaced, since a full reload would rebuild everything and prove nothing.
	await page.evaluate(() => {
		(window as unknown as { sameDocument?: boolean }).sameDocument = true;
		const anchor = document.createElement('a');
		anchor.href = '/exercises/multi-agent';
		anchor.id = 'clear-fail-probe';
		anchor.textContent = 'probe';
		document.body.append(anchor);
	});
	await page.locator('#clear-fail-probe').click();

	await settled(page, 3);
	expect(
		await page.evaluate(
			() => (window as unknown as { sameDocument?: boolean }).sameDocument === true
		)
	).toBe(true);

	// The induced panel is gone, and the announcer cleared with it rather than
	// holding a failure that no longer has a panel.
	await expect(page.getByTestId('multi-agent-induced-failed')).toHaveCount(0);
	await expect(announcer).toBeEmpty();
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

	// And the summary content that crossed back — compared against what the
	// panel REPORTS came back, rather than against a range. An occurrence count
	// anywhere from 1 to 29 is satisfied by any shortened-but-wrong payload,
	// including the first sentence alone, so it could not support this test's
	// own claim that the disclosure shows the summary that crossed the tool
	// boundary.
	const payload = timeline.locator('.cinder-run-step-timeline__detail-content');
	const disclosed = (await payload.last().textContent()) ?? '';

	const reportedLength = Number(await page.getByTestId('multi-agent-summary-length').textContent());
	const reportedPrefix = Number(await page.getByTestId('multi-agent-summary-prefix').textContent());

	// Same length, and the same verbatim prefix of the child's answer, as the
	// value the run reported. Two independent readings of one string: the
	// panel's, computed from the tool result, and the transcript's, rendered by
	// Chat.
	expect(disclosed.trim().length).toBe(reportedLength);
	// The WHOLE reported prefix, not a whole-sentence approximation of it.
	// Flooring to complete sentences discarded up to one sentence of the
	// comparison — and the sibling test establishes that this prefix ends
	// mid-sentence, so the discarded remainder is exactly where a corrupted
	// partial sentence would hide.
	const childAnswer = 'The staging bucket was retained. '.repeat(30);
	expect(disclosed.trim().slice(0, reportedPrefix)).toBe(childAnswer.slice(0, reportedPrefix));
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

	// The assertions above are all satisfied by an EXTRACTIVE summarizer too —
	// one returning the child's first sentence is nonempty, shorter, starts
	// with the same words, and differs from the custom panel. They would stay
	// green while this page's central claim became false, so the shape of the
	// cut has to be asserted directly.
	//
	// Nearly everything returned is the child's answer verbatim from the
	// start. A first-sentence extractor would leave one sentence's worth (33
	// characters); a rewriting summarizer, almost none.
	const prefix = Number(await page.getByTestId('multi-agent-summary-prefix').textContent());
	expect(prefix).toBeGreaterThan(100);

	// And the cut lands where the budget ran out rather than where a sentence
	// ended. Anything that respected sentence boundaries would stop on a
	// multiple of the repeated unit.
	await expect(page.getByTestId('multi-agent-summary-mid-sentence')).toHaveText('true');

	// The vendor's truncation marker is deliberately NOT matched — it is copy
	// that can change without any of this behaviour changing, which is why the
	// prefix is measured instead of the whole string being compared.
	expect(prefix).toBeLessThanOrEqual(capped);
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

	// DERIVED from the child's result, not a canned string. The summary carries
	// the source's length, so `matchesCustomSummary` above can only read `yes`
	// if the callback received this child's actual answer — a callback handed
	// nothing, or the wrong run's result, produces a different number and
	// fails. Almost none of it is the child's text verbatim, which is what
	// separates condensation from the cap.
	const prefix = Number(await page.getByTestId('multi-agent-custom-prefix').textContent());
	expect(prefix).toBeLessThan(5);
	await expect(page.getByTestId('multi-agent-custom-mid-sentence')).toHaveText('false');
});

/** Bounded so an unreachable control reports rather than hanging the run. */
const TAB_BUDGET = 40;

/**
 * Walks the tab order ONCE and reports which of the named controls it reached.
 *
 * One walk rather than a probe walk plus a second walk, because the second
 * would start from wherever the first left focus and would depend on how the
 * engine wraps past the end of the document. Chromium cycles back into the
 * page; Firefox does not, within any budget worth waiting for — which is
 * exactly how the two-walk version failed there while passing in Chromium.
 */
async function tabOrderReaches(
	page: import('@playwright/test').Page,
	controls: Record<string, import('@playwright/test').Locator>
): Promise<Set<string>> {
	const reached = new Set<string>();
	const names = Object.keys(controls);

	await page.locator('body').press('Tab');
	for (let step = 0; step < TAB_BUDGET && reached.size < names.length; step += 1) {
		for (const name of names) {
			if (reached.has(name)) continue;
			if (await controls[name].evaluate((element) => element === document.activeElement)) {
				reached.add(name);
			}
		}
		if (reached.size === names.length) break;
		await page.keyboard.press('Tab');
	}
	return reached;
}

test('the transcript disclosures are operable from the keyboard', async ({ page }) => {
	await gotoHydrated(page, '/exercises/multi-agent');
	await settled(page);

	const timeline = page.locator('[data-testid="multi-agent-chat"] .chat-tool-call-timeline');
	const argumentsTrigger = timeline.getByRole('button', { name: 'Arguments' });
	const resultTrigger = timeline.getByRole('button', { name: 'Result' });

	// `Attach file` is the CONTROL CONTROL: an ordinary enabled button that is
	// unambiguously supposed to be tabbable. If the walk does not reach it, this
	// platform does not put buttons in the tab order at all — macOS ships Full
	// Keyboard Access off, and Safari then tabs only between text fields and
	// lists. Probed on this route: Chromium and Firefox reach it, WebKit reaches
	// no button at all (`log → textarea → body`).
	//
	// NOT Send, which was the first choice and silently disabled this entire
	// test: Chat disables Send while the composer is empty, and a disabled button
	// never receives sequential focus — so the probe returned false in Chromium
	// too, and both branches fell through to programmatic `focus()`.
	const attachFile = page.getByRole('button', { name: 'Attach file' });
	const reached = await tabOrderReaches(page, {
		attachFile,
		argumentsTrigger,
		resultTrigger
	});

	if (reached.has('attachFile')) {
		// REACHABLE. `focus()` would succeed on an element with `tabindex="-1"`
		// or one skipped in document order, so it proves activation once focus is
		// somehow there and never that a keyboard user can arrive.
		expect(reached.has('argumentsTrigger')).toBe(true);
		expect(reached.has('resultTrigger')).toBe(true);
	}

	// OPERABLE, everywhere — including where the platform excludes buttons from
	// the tab order, since the controls are still focusable and still respond.
	await argumentsTrigger.focus();
	await expect(argumentsTrigger).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(timeline).toContainText('What did we decide about the staging bucket?');

	// ONE Tab, and Result must have focus — not "Result is reachable within a
	// budget". A bounded walk answers the weaker question, and would pass the
	// regression this test is named for: if expanding Arguments dropped focus
	// to `<body>`, the walk would traverse the rest of the document, wrap in
	// Chromium, and eventually arrive.
	//
	// Asserting the next stop is legitimate because the expanded panel holds a
	// `pre` and nothing focusable, so Result genuinely is next in order. If
	// that ever stops being true this fails loudly, which is the right outcome
	// for a change to what the disclosure renders.
	//
	// Only where the platform tabs to controls at all; WebKit reaches no button
	// and the operability half below still runs there.
	if (reached.has('attachFile')) {
		await page.keyboard.press('Tab');
		await expect(resultTrigger).toBeFocused();
	} else {
		await resultTrigger.focus();
	}

	// Space on the second, since the two are independent and either key is a
	// legitimate way to operate a button.
	await page.keyboard.press('Space');
	await expect(timeline.locator('.cinder-run-step-timeline__detail-content')).toHaveCount(2);

	// FOCUS SURVIVES THE ACTIVATION, and can leave afterwards. Ending at the
	// payload count would stay green if expanding Result dropped focus to
	// `<body>` or began trapping Tab — the disclosure would open and the
	// keyboard user would be at a dead end.
	await expect(resultTrigger).toBeFocused();

	if (reached.has('attachFile')) {
		// One Tab, to a named control. Measured rather than assumed, and
		// identical in Chromium and Firefox: the order after an expanded Result
		// is `Copy message`, then the composer, then `Attach file`. Asserting
		// the next stop is the same discipline as the Tab into Result — a
		// budgeted walk would accept focus having gone somewhere wrong and
		// wandered back.
		await page.keyboard.press('Tab');

		// Asserted by the FOCUSED element's accessible name rather than against
		// a locator. The transcript renders one `Copy message` button per
		// message, so `getByRole(...).first()` is a different button than the
		// one Tab lands on — that mismatch failed this assertion while focus
		// was in fact exactly where it should be.
		//
		// Naming the element that has focus states the real claim: focus left
		// the disclosure and landed on a named control, not on `<body>` and not
		// back on itself.
		const landed = await page.evaluate(() => {
			const active = document.activeElement;
			return active === null || active === document.body
				? '(no control)'
				: (active.getAttribute('aria-label') ?? active.textContent ?? '').trim();
		});
		expect(landed).toBe('Copy message');
	}
});

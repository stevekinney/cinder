import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { gotoHydrated } from '../hydration';

// ROADMAP X-1: per-keystroke diff cost of ReviewEditor's live toolbar badge.
//
// `review-editor-impl.svelte` (the shipped component, not the experimental
// DEP-422 parity module) derives its toolbar diff stats with:
//
//   const diffStats = $derived.by(() => computeReviewEditorDiffStats(original, value));
//
// `computeReviewEditorDiffStats` is not itself exported, but `createReviewEditorState`
// — which wraps the exact same function, imported from the exact same module —
// is, from `@lostgradient/editor/review-editor`. The page under test calls it
// directly and brackets each recompute with `performance.now()`, executed in
// the page, not from Playwright's Node-side clock — the methodology this repo
// already had to learn the hard way after retracting two phantom scroll-timing
// bugs (see project memory / ROADMAP_PROGRESS.md).
//
// `value` is NOT written on every physical keydown: `MarkdownEditor` only
// flushes its bindable `value` from a debounced `onchange` (300ms
// `changeDebounceMs` stacked on `@milkdown/plugin-listener`'s own ~200ms
// internal debounce — see `markdown-editor.svelte`'s placeholder comment, and
// the page's own header comment). So this spec paces one keystroke at a time,
// waiting for the debounced settle (and therefore the real recompute) before
// sending the next one, rather than typing a fast burst and hoping enough
// recomputes fire to sample. That pacing is what makes "one recompute per
// keystroke" a proven fact below rather than an assumption — a coalesced
// recompute would leave the poll below waiting past its timeout instead of
// silently under-reporting.

const ROUTE = '/exercises/review-diff-performance';

// Appended one character at a time after the document's trailing marker line.
// Ordinary prose, not a stress pattern — the point is a realistic edit in a
// large document, not an adversarial one. No markdown-triggering characters
// (`#`, `-`, `` ` ``, `*`) so typing doesn't also exercise autoformatting.
const TYPED_TEXT = ' A decision is needed soon.';

function sampleCountLocator(page: Page) {
	return page.getByTestId('diff-perf-sample-count');
}

async function readSamples(page: Page): Promise<number[]> {
	const raw = await page.getByTestId('diff-perf-samples').getAttribute('data-value');
	return JSON.parse(raw ?? '[]') as number[];
}

test.beforeEach(async ({ page }) => {
	await gotoHydrated(page, ROUTE);
	await expect(page.locator('[data-testid="review-editor"][data-ready="true"]')).toHaveCount(1, {
		timeout: 20_000
	});
	await expect(page.locator('#diff-perf .ProseMirror')).toBeVisible();
	// `$effect` runs once on mount regardless of any keystroke, capturing the
	// zero-diff (value === original) baseline recompute. Wait for that one
	// sample to land before typing, so the keystroke count below starts clean.
	await expect(sampleCountLocator(page)).toHaveText('1', { timeout: 10_000 });
});

test('the fixture document is large enough to matter', async ({ page }) => {
	// Checked, not asserted from a comment: "hundreds of lines / several
	// thousand words" per CLAUDE.md's methodology section.
	const lines = Number(await page.getByTestId('diff-perf-doc-lines').textContent());
	const words = Number(await page.getByTestId('diff-perf-doc-words').textContent());
	const chars = Number(await page.getByTestId('diff-perf-doc-chars').textContent());
	expect(lines).toBeGreaterThan(300);
	expect(words).toBeGreaterThan(6000);
	expect(chars).toBeGreaterThan(40_000);
});

test('the diff recompute fires exactly once per settled keystroke, and stays under a 100ms regression ceiling', async ({
	page
}, testInfo) => {
	// This is a per-test BUDGET increase, not wait-threshold padding: every
	// keystroke below deliberately waits out a real ~300-500ms debounce (see the
	// file header) before the next one, so `TYPED_TEXT.length` keystrokes need
	// that many real debounce cycles no matter how fast anything computes.
	// Playwright's 30s default was measured too tight for that, independent of
	// machine load.
	test.setTimeout(60_000);

	// Reach the exact end of the document via the short, unwrapped trailing
	// marker line — this editor has no document-wide "go to end" keybinding,
	// but `End` on a single unwrapped line is native contenteditable behavior.
	await page.getByText('Open questions are tracked separately.').click();
	await page.keyboard.press('End');

	let expectedCount = 1; // the beforeEach's baseline sample
	for (const char of TYPED_TEXT) {
		await page.keyboard.press(char === ' ' ? 'Space' : char);
		expectedCount += 1;
		// Polls for the real debounced settle rather than sleeping a guessed
		// duration — this is the condition, not a timer, that proves the
		// recompute actually happened for this keystroke specifically.
		await expect(sampleCountLocator(page)).toHaveText(String(expectedCount), { timeout: 8_000 });
	}

	const recorded = await readSamples(page);
	expect(recorded).toHaveLength(TYPED_TEXT.length + 1);

	const [baseline, ...keystrokeSamples] = recorded;
	expect(keystrokeSamples).toHaveLength(TYPED_TEXT.length);

	const sorted = [...keystrokeSamples].sort((a, b) => a - b);
	const min = sorted[0];
	const max = sorted[sorted.length - 1];
	const median = sorted[Math.floor(sorted.length / 2)];
	const p95 = sorted[Math.floor(sorted.length * 0.95)];

	await testInfo.attach('diff-recompute-timings-ms', {
		body: JSON.stringify({ baseline, keystrokeSamples, min, median, p95, max }, null, 2),
		contentType: 'application/json'
	});
	// Also on stdout: the attachment above is only easy to read from an HTML
	// report, and this number is the entire point of the ROADMAP item.
	console.log('[X-1 diff recompute, ms]', {
		baseline,
		min,
		median,
		p95,
		max,
		n: keystrokeSamples.length
	});

	// A generous, deliberately-far-above-frame-budget tripwire, not a tight perf
	// assertion. The real ~16.67ms / ~8ms frame-budget comparison this
	// measurement exists to answer is made from the recorded distribution above
	// (see ROADMAP.md / ROADMAP_PROGRESS.md for the numbers from a clean run and
	// the acceptable/not-acceptable judgment) — a hard millisecond threshold that
	// close to a frame budget would be exactly the kind of flaky assertion
	// CLAUDE.md's methodology section warns against on a shared, variably-loaded
	// dev machine. 100ms only catches a catastrophic regression, which is what a
	// CI-less repeated-run assertion can responsibly promise.
	for (const elapsed of keystrokeSamples) {
		expect(elapsed).toBeLessThan(100);
	}
});

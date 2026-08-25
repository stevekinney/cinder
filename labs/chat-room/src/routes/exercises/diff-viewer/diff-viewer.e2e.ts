import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { gotoHydrated } from '../hydration';

// ROADMAP DV-1 / DV-2 / DV-3 — `DiffViewer` from `@lostgradient/editor/diff-viewer`,
// mounted directly instead of through `ReviewEditor`'s diff view.
//
// Three things here are pinned as PRESENT-TENSE BEHAVIOUR rather than as things
// that ought to be true, and each is flagged where it appears: the window-level
// key bindings firing on every instance at once (DV-3), the hardcoded
// `id="diff-view-mode"` repeating once per default toolbar, and `getHunks()`
// returning nothing for a front-matter-only edit that the toolbar reports as a
// change. If any of those goes red after an upstream release, the fix has
// arrived — the assertion is the notification, which is why none of them is
// written loosely enough to survive it.
//
// Every expected hunk shape below was derived by running the shipped
// `computeLineDiff` / `groupIntoHunks` over the exact fixture strings the page
// builds, not by reading the algorithm and predicting. That matters most for the
// `modified` vs `added`+`removed` split, which depends on diff-match-patch's
// `diff_cleanupSemantic` output and is not obvious from the source.
//
// No `pressNextTabStop` here, deliberately: nothing in this file asserts a Tab
// ORDER. The focus states DV-3 needs are set directly (`locator.focus()`, or a
// click on a non-focusable region), so the WebKit plain-Tab divergence that
// helper documents never comes into it.

const ROUTE = '/exercises/diff-viewer';

type HunkRow = {
	index: number;
	originalStart: number;
	originalCount: number;
	currentStart: number;
	currentCount: number;
	lines: number;
	originalLines: number;
	currentLines: number;
};

// Two changed lines, twelve line-indices apart — beyond the `2 * CONTEXT_LINES`
// merge window — so they stay two hunks. Each carries three context lines on the
// side that has room: the first hunk starts at document line 1 because there are
// only two lines above the change.
const HUNKS_TWO: HunkRow[] = [
	{
		index: 0,
		originalStart: 1,
		originalCount: 6,
		currentStart: 1,
		currentCount: 6,
		lines: 6,
		originalLines: 1,
		currentLines: 1
	},
	{
		index: 1,
		originalStart: 12,
		originalCount: 4,
		currentStart: 12,
		currentCount: 4,
		lines: 4,
		originalLines: 1,
		currentLines: 1
	}
];

// Every change index inside one merge window, so the whole 15-line body is a
// single hunk. Twelve of those lines changed; the three blank lines did not.
const HUNKS_ALL: HunkRow[] = [
	{
		index: 0,
		originalStart: 1,
		originalCount: 15,
		currentStart: 1,
		currentCount: 15,
		lines: 15,
		originalLines: 12,
		currentLines: 12
	}
];

// One insertion and one deletion. Note the asymmetric counts — an added line
// exists only in `current`, so the first hunk spans 6 original lines and 7
// current ones, and its `originalLines` array is empty.
const HUNKS_ADDED_AND_REMOVED: HunkRow[] = [
	{
		index: 0,
		originalStart: 2,
		originalCount: 6,
		currentStart: 2,
		currentCount: 7,
		lines: 7,
		originalLines: 0,
		currentLines: 1
	},
	{
		index: 1,
		originalStart: 11,
		originalCount: 5,
		currentStart: 12,
		currentCount: 4,
		lines: 5,
		originalLines: 1,
		currentLines: 0
	}
];

const HUNKS_B: HunkRow[] = [
	{
		index: 0,
		originalStart: 1,
		originalCount: 5,
		currentStart: 1,
		currentCount: 5,
		lines: 5,
		originalLines: 3,
		currentLines: 3
	}
];

// The authored front matter, line for line. This is the regression pin for the
// corruption the export pipeline shipped once: a whole document handed to
// `normalize()` came back with the opening `---` re-read as a thematic break and
// the YAML as a setext heading — blank lines injected, sequence-item indentation
// flattened, every subsequent line number shifted. `'  - dana'` with its two
// leading spaces is the assertion that catches that first.
const FRONT_MATTER_UNCHANGED = [
	'---',
	'title: Release Plan',
	'owner: platform',
	'reviewers:',
	'  - dana',
	'  - kit',
	'---'
];

const viewer = (page: Page, name: string): Locator => page.getByTestId(`viewer-${name}`);

/**
 * A viewer's BODY rows only.
 *
 * The child combinator is load-bearing. `DiffFrontMatter` renders its own
 * `.diff-line` elements nested inside `.front-matter-content`, so a descendant
 * selector would fold eight front-matter rows into every body count and make the
 * front-matter/body split — the thing DV-1's most interesting assertion rests on
 * — invisible.
 */
const bodyLines = (page: Page, name: string): Locator =>
	viewer(page, name).locator('.diff-content > .diff-line');

/**
 * Body lines that actually carry text.
 *
 * DiffViewer renders exactly one EMPTY `.diff-line` before it has computed
 * anything — measured on both the manual-tier control and the override, which
 * report `{count: 1, withText: 0}` apiece. So "nothing was computed" cannot be
 * expressed as `bodyLines(...).toHaveCount(0)`; that counts a placeholder node
 * and reads as a diff that exists.
 *
 * Filtering on text is the same claim stated accurately, and it is strictly
 * stronger than the count was: a line that rendered real content would be
 * caught here, where a count could be satisfied by any single node.
 */
const bodyLinesWithText = (page: Page, name: string): Locator =>
	viewer(page, name).locator('.diff-content > .diff-line').filter({ hasText: /\S/ });

/**
 * The UNCHANGED front-matter rows, whose text can be compared byte for byte.
 *
 * `:not([data-selected])` is what makes byte-exactness safe. A `same` row is
 * `<span class="diff-text">{text}</span>` — one expression, no surrounding
 * template whitespace, so `textContent` is exactly the document's line, leading
 * spaces and all. A CHANGED row wraps its text in an `{#if}` over the view mode
 * and so may carry compiler-inserted whitespace, which would make a byte-exact
 * comparison a test of Svelte's whitespace handling rather than of the diff
 * pipeline. `DiffLine` renders `data-selected` on changed rows only, which
 * separates them cleanly.
 */
const unchangedFrontMatterText = (page: Page, name: string): Locator =>
	viewer(page, name).locator('.front-matter-content .diff-line:not([data-selected]) .diff-text');

const changedFrontMatterText = (page: Page, name: string): Locator =>
	viewer(page, name).locator('.front-matter-content .diff-line[data-selected] .diff-text');

const changeCounter = (page: Page, name: string): Locator =>
	viewer(page, name).locator('.change-counter');

const modeRadio = (page: Page, name: string, label: string): Locator =>
	viewer(page, name).getByRole('radio', { name: label });

async function expectHunks(page: Page, testId: string, expected: HunkRow[]): Promise<void> {
	await expect
		.poll(async () => JSON.parse((await page.getByTestId(testId).textContent()) ?? 'null'))
		.toEqual(expected);
}

/**
 * Park focus on `<body>`, and confirm it landed there rather than assuming it.
 *
 * DV-3's whole claim is about what happens when focus is OUTSIDE every viewer.
 * If a click quietly left focus on some element inside one of them, the test
 * would still pass and would be measuring something else entirely.
 */
async function focusDocumentBody(page: Page): Promise<void> {
	await page.getByTestId('neutral-region').click();
	expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('BODY');
}

/**
 * The state DV-3's key presses are supposed to move, read in one shot so a
 * "nothing happened" assertion compares whole snapshots rather than four
 * independent values that could drift apart.
 */
async function keyboardState(page: Page) {
	return {
		counterA: (await changeCounter(page, 'a').textContent())?.trim().replace(/\s+/g, ' '),
		counterB: (await changeCounter(page, 'b').textContent())?.trim().replace(/\s+/g, ' '),
		modeA: await page.getByTestId('mode-a').textContent(),
		modeB: await page.getByTestId('mode-b').textContent()
	};
}

test.beforeEach(async ({ page }) => {
	await gotoHydrated(page, ROUTE);

	// The body diff is produced by an `$effect`, which does not run during SSR:
	// the server sends the front-matter block and ZERO body rows, and the rows
	// appear only once hydration has flushed.
	//
	// NOT gated on `.diff-viewer[data-ready]`, which looks like the intended
	// signal — the component's own comment calls it "E2E test synchronization" —
	// and is not one on this tier. It renders when `!isComputing && !isStale`,
	// and both are false before the controller has run at all, so it is present
	// in the SSR HTML of a viewer that has computed nothing. It becomes a real
	// signal only at the manual tier, where `isStale` is set, and that is the one
	// place below that waits on it.
	await expect(bodyLines(page, 'a')).toHaveCount(15);
	await expect(bodyLines(page, 'b')).toHaveCount(5);
});

// ---------------------------------------------------------------------------
// DV-1 — the standalone mount, getHunks, front matter, and the view modes
// ---------------------------------------------------------------------------

test('getHunks matches bind:hunks and the rendered hunk headers on a known two-hunk document', async ({
	page
}) => {
	await expectHunks(page, 'hunks-a', HUNKS_TWO);

	// `getHunks()` is a SEPARATE observation from `bind:hunks`, not a synonym for
	// it: the binding is written by an `$effect` copying out of the `computedHunks`
	// `$derived`, and `getHunks()` returns that copied field. Reading it through a
	// button click is what makes the two comparable at a defined moment.
	await page.getByTestId('read-hunks-a').click();
	await expectHunks(page, 'imperative-a', HUNKS_TWO);
	expect(await page.getByTestId('imperative-a').textContent()).toBe(
		await page.getByTestId('hunks-a').textContent()
	);

	// The rendered headers are an INDEPENDENT path to the same hunks — they come
	// from `hunkStartMap`, which reads the `$derived` directly rather than the
	// effect-synced copy. Agreement between the two is the cross-check; comparing
	// `getHunks()` only against `bind:hunks` would compare one field with itself.
	const headers = viewer(page, 'a').locator('.hunk-header .hunk-range');
	await expect(headers).toHaveCount(2);
	await expect(headers.nth(0)).toHaveText('@@ -1,6 +1,6 @@');
	await expect(headers.nth(1)).toHaveText('@@ -12,4 +12,4 @@');

	await expect(changeCounter(page, 'a')).toHaveText('1 / 2');
});

test('an identical document yields an empty hunk list, not one all-context hunk', async ({
	page
}) => {
	await page.getByTestId('doc-a-identical').click();

	// Asserted as an EMPTY ARRAY rather than as "no hunk headers rendered". The
	// weaker form passes against a component that computed a hunk and failed to
	// render it, which is a different bug wearing the same clothes.
	await expectHunks(page, 'hunks-a', []);
	await page.getByTestId('read-hunks-a').click();
	await expectHunks(page, 'imperative-a', []);

	// The rows are still all there — fifteen of them — they are simply all
	// `same`. A viewer that had thrown the document away would also report zero
	// hunks, and this is what tells the two apart.
	await expect(bodyLines(page, 'a')).toHaveCount(15);
	await expect(
		viewer(page, 'a').locator(
			'.diff-content > .diff-line-added, .diff-content > .diff-line-removed, .diff-content > .diff-line-modified'
		)
	).toHaveCount(0);

	await expect(viewer(page, 'a').locator('.no-changes')).toHaveCount(1);
	await expect(changeCounter(page, 'a')).toHaveCount(0);
	await expect(viewer(page, 'a').locator('.hunk-header')).toHaveCount(0);
});

test('an entirely rewritten body collapses into a single hunk spanning the document', async ({
	page
}) => {
	await page.getByTestId('doc-a-all-changed').click();

	await expectHunks(page, 'hunks-a', HUNKS_ALL);
	await page.getByTestId('read-hunks-a').click();
	await expectHunks(page, 'imperative-a', HUNKS_ALL);

	const headers = viewer(page, 'a').locator('.hunk-header .hunk-range');
	await expect(headers).toHaveCount(1);
	await expect(headers).toHaveText('@@ -1,15 +1,15 @@');

	// Twelve changes inside one hunk: the hunk count and the change count are
	// different quantities, and a fixture where they happened to match would hide
	// a component that confused them.
	await expect(changeCounter(page, 'a')).toHaveText('1 / 12');
});

test('a front-matter-only edit reports changes in the toolbar and nothing in getHunks', async ({
	page
}) => {
	await page.getByTestId('doc-a-front-matter-only').click();

	// The divergence, stated as plainly as it can be: the document changed, the
	// toolbar says so, and the hunk list — the thing a consumer would drive a
	// revert or an apply from — is empty. `computedHunks` is
	// `groupIntoHunks(lineDiffs)`, body only; `diffStats` sums body AND front
	// matter. The front-matter-inclusive grouping exists in the component
	// (`unifiedDiffHunks`) and is wired only to the copy-diff path.
	await expectHunks(page, 'hunks-a', []);
	await page.getByTestId('read-hunks-a').click();
	await expectHunks(page, 'imperative-a', []);

	// Exactly one stat badge, reading `~1`: the toolbar's stats sum body AND front
	// matter, so the one modified YAML line surfaces here while `getHunks()` — the
	// body-only grouping — reports nothing.
	await expect(viewer(page, 'a').locator('.stat-badge')).toHaveText('~1');
	await expect(viewer(page, 'a').locator('.front-matter-only-hint')).toHaveText(
		'Front matter only'
	);
	// `hasChanges` is true, so the "No changes" success badge must NOT be showing
	// — the toolbar and the hunk list genuinely disagree, rather than the toolbar
	// simply being empty too.
	await expect(viewer(page, 'a').locator('.no-changes')).toHaveCount(0);
	await expect(viewer(page, 'a').locator('.front-matter-section')).toHaveAttribute(
		'data-has-changes',
		'true'
	);
	await expect(viewer(page, 'a').locator('.front-matter-header .cinder-badge')).toHaveText(
		'Changed'
	);

	// And no body navigation exists, because there is no body change to navigate.
	await expect(changeCounter(page, 'a')).toHaveCount(0);
});

test('the displayed front matter is byte-identical to the authored front matter', async ({
	page
}) => {
	await page.getByTestId('doc-a-front-matter-only').click();

	// Read through `allTextContents`, NOT `toHaveText`. Playwright's text matchers
	// normalise whitespace, which would silently "fix" the exact thing this test
	// exists to catch: `'  - dana'` compared as `'- dana'` passes against a
	// pipeline that flattened the sequence indentation.
	//
	// The array comparison covers the other half of that corruption too. An
	// injected blank line would appear as an extra row — `DiffLine` renders an
	// empty line as a non-breaking space, so it would show up as an unmistakable
	// extra element rather than as nothing.
	//
	// Asserted in `original` and `final` rather than `unified` because a modified
	// line renders word-level `<del>`/`<ins>` fragments in unified — its text
	// content is the two versions concatenated, which is not a line of either
	// document. In the other two modes each row is exactly one document's line.
	await page.getByTestId('set-mode-a-original').click();
	await expect(page.getByTestId('mode-a')).toHaveText('original');
	expect(await unchangedFrontMatterText(page, 'a').allTextContents()).toEqual(
		FRONT_MATTER_UNCHANGED
	);
	await expect(changedFrontMatterText(page, 'a')).toHaveText('status: draft');

	await page.getByTestId('set-mode-a-final').click();
	await expect(page.getByTestId('mode-a')).toHaveText('final');
	expect(await unchangedFrontMatterText(page, 'a').allTextContents()).toEqual(
		FRONT_MATTER_UNCHANGED
	);
	await expect(changedFrontMatterText(page, 'a')).toHaveText('status: ready');

	// Instance B has no front matter at all, which is what proves the block above
	// is driven by the document rather than always rendered.
	await expect(viewer(page, 'b').locator('.front-matter-section')).toHaveCount(0);
});

test('viewMode is bound in both directions, across all three modes', async ({ page }) => {
	// ROADMAP DV-1 says "both view modes". There are three — `unified`, `final`,
	// `original` — and the component's own `VIEW_MODES` array is what `Ctrl+Shift+D`
	// cycles. Two of three would leave one rendering branch unvisited.

	// Component to page: drive the segmented control the way a user does.
	for (const [label, mode] of [
		['Final', 'final'],
		['Original', 'original'],
		['Unified', 'unified']
	] as const) {
		await modeRadio(page, 'a', label).click();
		await expect(page.getByTestId('mode-a')).toHaveText(mode);
		await expect(modeRadio(page, 'a', label)).toHaveAttribute('aria-checked', 'true');
	}

	// Page to component: write the bound prop from outside and watch the control
	// follow. Both directions are needed — a one-way binding would satisfy either
	// half on its own.
	for (const [mode, label] of [
		['original', 'Original'],
		['final', 'Final'],
		['unified', 'Unified']
	] as const) {
		await page.getByTestId(`set-mode-a-${mode}`).click();
		await expect(modeRadio(page, 'a', label)).toHaveAttribute('aria-checked', 'true');
		await expect(page.getByTestId('mode-a')).toHaveText(mode);
	}

	// Instance B is untouched throughout. It shares the page and nothing else.
	await expect(page.getByTestId('mode-b')).toHaveText('unified');
});

test('final hides removed lines, original hides added lines, and the change count follows', async ({
	page
}) => {
	await page.getByTestId('doc-a-added-and-removed').click();
	await expectHunks(page, 'hunks-a', HUNKS_ADDED_AND_REMOVED);

	// Sixteen rows in unified: fifteen body lines plus the inserted one. One is
	// `added`, one is `removed`, and the visibility gate is what each mode moves.
	await expect(bodyLines(page, 'a')).toHaveCount(16);
	await expect(viewer(page, 'a').locator('.diff-content > .diff-line-added')).toHaveCount(1);
	await expect(viewer(page, 'a').locator('.diff-content > .diff-line-removed')).toHaveCount(1);
	await expect(changeCounter(page, 'a')).toHaveText('1 / 2');

	await page.getByTestId('set-mode-a-final').click();
	await expect(bodyLines(page, 'a')).toHaveCount(15);
	await expect(viewer(page, 'a').locator('.diff-content > .diff-line-added')).toHaveCount(1);
	await expect(viewer(page, 'a').locator('.diff-content > .diff-line-removed')).toHaveCount(0);
	// `changedLineIndices` is filtered by view mode too, so hiding a row also
	// removes it from the navigation. That coupling is easy to break and invisible
	// from the row counts alone.
	await expect(changeCounter(page, 'a')).toHaveText('1 / 1');

	await page.getByTestId('set-mode-a-original').click();
	await expect(bodyLines(page, 'a')).toHaveCount(15);
	await expect(viewer(page, 'a').locator('.diff-content > .diff-line-added')).toHaveCount(0);
	// In `original` a removed line loses its strikethrough and its `-` gutter, and
	// its class changes with it — so it is `.diff-line-removed-original` here, not
	// `.diff-line-removed`.
	await expect(
		viewer(page, 'a').locator('.diff-content > .diff-line-removed-original')
	).toHaveCount(1);
	await expect(changeCounter(page, 'a')).toHaveText('1 / 1');

	// Word-level markup exists only in unified. Asserted on the two-hunk fixture,
	// whose changes are `modified` lines — the only type that carries word changes.
	await page.getByTestId('doc-a-two-hunk').click();
	await page.getByTestId('set-mode-a-unified').click();
	await expect(viewer(page, 'a').locator('del.word-removed').first()).toHaveText('first');
	await expect(viewer(page, 'a').locator('ins.word-added').first()).toHaveText('second');
	await page.getByTestId('set-mode-a-final').click();
	await expect(viewer(page, 'a').locator('del.word-removed')).toHaveCount(0);
	await expect(viewer(page, 'a').locator('ins.word-added')).toHaveCount(0);
});

test('revert is a request: the component reports the hunk index and changes nothing itself', async ({
	page
}) => {
	const secondHunk = viewer(page, 'a').locator('.hunk-header').nth(1);
	await secondHunk.getByRole('button', { name: 'Revert this change' }).click();

	// The FIRST argument is the hunk's own index, not its position among the
	// rendered headers — they agree here only because nothing has been reverted
	// yet, which is why the second header is the one clicked.
	await expect(page.getByTestId('revert-log')).toHaveText('reverthunk:1');

	// The document moved because THIS PAGE moved it in the callback. `DiffViewer`
	// holds `original` and `current` as plain props and writes to neither.
	await expectHunks(page, 'hunks-a', [HUNKS_TWO[0]]);
	await expect(viewer(page, 'a').locator('.hunk-header')).toHaveCount(1);

	await viewer(page, 'a').getByRole('button', { name: 'Revert All' }).click();
	await expect(page.getByTestId('revert-log')).toHaveText('reverthunk:1|revertall');
	await expectHunks(page, 'hunks-a', []);
	await expect(viewer(page, 'a').locator('.no-changes')).toHaveCount(1);
});

test('hunk headers render only for a viewer that supplied onreverthunk', async ({ page }) => {
	// B has a hunk and no `onreverthunk`, so it gets no header and no revert
	// affordance. Without this, the header assertions above would also pass
	// against a component that rendered headers unconditionally.
	await expectHunks(page, 'hunks-b', HUNKS_B);
	await expect(viewer(page, 'b').locator('.hunk-header')).toHaveCount(0);
	await expect(viewer(page, 'b').getByRole('button', { name: 'Revert this change' })).toHaveCount(
		0
	);
	await expect(viewer(page, 'b').getByRole('button', { name: 'Revert All' })).toHaveCount(0);

	await expect(viewer(page, 'a').locator('.hunk-header')).toHaveCount(2);
});

// ---------------------------------------------------------------------------
// DV-2 — the slot-semantics divergence between Chat and DiffViewer
// ---------------------------------------------------------------------------

test("DiffViewer's toolbar snippet replaces the whole toolbar, taking toolbarActions with it", async ({
	page
}) => {
	await expect(page.getByTestId('c-toolbar-replacement')).toBeVisible();

	// Everything the default toolbar owned, gone in one substitution: the view
	// mode control, the stat badges, the copy and revert actions, the change
	// navigation. The template is a hard `{#if toolbar}…{:else}<DiffToolbar/>{/if}`
	// with no seam in between.
	await expect(viewer(page, 'c').locator('.diff-toolbar')).toHaveCount(0);
	// Not `#diff-view-mode` (cinder#1309 gave every instance a unique,
	// non-deterministic id, so that literal no longer exists on ANY instance —
	// it would pass here whether or not C's override worked). The role-based
	// query is the one that actually distinguishes "no toolbar rendered" from
	// "a toolbar rendered under a different id".
	await expect(viewer(page, 'c').getByRole('radiogroup')).toHaveCount(0);
	await expect(viewer(page, 'c').getByRole('radio')).toHaveCount(0);
	await expect(viewer(page, 'c').locator('.stat-badge')).toHaveCount(0);
	await expect(viewer(page, 'c').locator('.change-counter')).toHaveCount(0);
	await expect(viewer(page, 'c').getByRole('button', { name: 'Copy unified diff' })).toHaveCount(0);

	// The sharpest part, and the one nothing warns about: `toolbarActions` — the
	// prop documented as the way to add a button WITHOUT replacing the toolbar —
	// is rendered inside the `{:else}` branch, so supplying both silently drops it.
	//
	// Asserted as a DIFFERENTIAL against instance A, which passes the identical
	// prop and no override. A bare `count 0` would be equally satisfied by a
	// `toolbarActions` that renders nowhere at all, and would make "the override
	// drops it" a claim the test never touched.
	await expect(page.getByTestId('a-toolbar-action')).toHaveCount(1);
	await expect(page.getByTestId('c-toolbar-action')).toHaveCount(0);

	// The diff content itself is untouched, which is what makes this a toolbar
	// replacement rather than a broken viewer.
	await expect(bodyLines(page, 'c')).toHaveCount(4);
	await expect(viewer(page, 'c').locator('.diff-content > .diff-line-modified')).toHaveCount(1);

	// The contrast that gives the counts above their meaning: A supplies no
	// override and has all of it.
	await expect(viewer(page, 'a').locator('.diff-toolbar')).toHaveCount(1);
	await expect(viewer(page, 'a').getByRole('radio')).toHaveCount(3);
});

test('the toolbar context carries no renderDefault, so the default cannot be re-rendered', async ({
	page
}) => {
	// Enumerated at runtime from the object the component actually passes. This is
	// the DiffViewer half of DV-2 stated directly rather than inferred from the
	// missing button: four read-only fields, and no way back to the default.
	await expect(page.getByTestId('c-toolbar-context-keys')).toHaveText(
		'hasChanges,hunks,stats,viewMode'
	);
	await expect(page.getByTestId('c-toolbar-replacement')).toContainText('hasChanges=true');
	await expect(page.getByTestId('c-toolbar-replacement')).toContainText('hunks=1');
});

test("Chat's messagePart override receives a renderDefault and wraps the built-in rendering", async ({
	page
}) => {
	// The other half of the divergence. Chat types its override as
	// `Snippet<[part, renderDefault]>` and passes both, so a consumer can add
	// markup AROUND the default instead of replacing it — the inversion of control
	// DiffViewer's `toolbar` does not offer.
	const wrapped = page.getByTestId('chat-wrapped-part');
	await expect(wrapped).toBeVisible();
	await expect(page.getByTestId('chat-wrapper-marker')).toHaveText('wrapped by the consumer');

	// Inside the consumer's own wrapper, which is the whole point: the default
	// rendering is nested in markup the override authored. If `renderDefault` were
	// not passed, this text would be absent (the snippet would render nothing but
	// its marker, or throw), while the marker assertion above would still pass —
	// so both assertions are needed and neither is redundant.
	await expect(wrapped).toContainText(
		'The default renderer produced this paragraph, and the override chose to keep it.'
	);
});

test('at the manual tier a toolbar override leaves the diff permanently uncomputable', async ({
	page
}) => {
	// Over 100KB the controller sets `isStale` and returns without computing. The
	// only caller of `triggerCompute()` is the Compute Diff button, and that button
	// lives inside the default toolbar — so the override deletes the sole route to
	// a computed diff. `getHunks()` does not rescue it: it reads a result, it
	// cannot ask for one.

	// E, the control: default toolbar, so the button exists and the tier is real.
	await expect(viewer(page, 'e').locator('.diff-warning')).toContainText('manual trigger');
	await expect(viewer(page, 'e').locator('.diff-viewer[data-ready]')).toHaveCount(0);
	await expect(bodyLinesWithText(page, 'e')).toHaveCount(0);
	const compute = viewer(page, 'e').getByRole('button', { name: 'Compute Diff' });
	await expect(compute).toHaveCount(1);

	// D, the same document behind an override.
	await expect(page.getByTestId('d-toolbar-replacement')).toBeVisible();
	await expect(viewer(page, 'd').getByRole('button', { name: 'Compute Diff' })).toHaveCount(0);
	await expect(viewer(page, 'd').locator('.diff-viewer[data-ready]')).toHaveCount(0);
	await expect(bodyLinesWithText(page, 'd')).toHaveCount(0);

	await compute.click();

	// `data-ready` is a genuine signal HERE and only here: at this tier `isStale`
	// starts true, so the attribute's appearance marks the transition rather than
	// restating the initial state. The compute is deferred through
	// `requestIdleCallback` (timeout 2000), so this waits on the attribute the
	// component already renders instead of on a guessed duration.
	await expect(viewer(page, 'e').locator('.diff-viewer[data-ready]')).toHaveCount(1);
	await expect(bodyLines(page, 'e')).toHaveCount(12);
	// One modified line out of twelve, and the "Outdated" badge — which shares the
	// `.stat-badge` class — is gone now that `isStale` cleared.
	await expect(viewer(page, 'e').locator('.stat-badge')).toHaveText('~1');

	// D is still exactly where it started. Nothing a consumer can reach moves it.
	// Text-filtered for the same reason as above: the placeholder line is present
	// in every state, so counting nodes here would assert against the placeholder
	// rather than against the absence of a diff.
	await expect(viewer(page, 'd').locator('.diff-viewer[data-ready]')).toHaveCount(0);
	await expect(bodyLinesWithText(page, 'd')).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// DV-3 — the window-level key bindings
//
// FIXED behavior as of `@lostgradient/editor@0.10.0` (cinder#1310). The
// handler moved from a bare `<svelte:window onkeydown>` onto each instance's
// own root element (`<Surface onkeydown={handleKeydown}>`), relying on DOM
// event bubbling: a keydown only reaches an element listener if the focused
// element is that element or a descendant of it. Since focus is exclusive to
// one element document-wide, at most one `DiffViewer` instance's handler can
// ever fire for a given keystroke. This is a deliberate behavior change, not
// only a bug fix: focus on `<body>` (or anywhere outside every instance) now
// fires NOTHING, even with a single `DiffViewer` on the page — previously it
// fired, because the listener was global. The `input`/`textarea`/
// `[contenteditable]` guard still exists on top of this scoping; it is
// untouched by the fix and not retested exhaustively here.
// ---------------------------------------------------------------------------

test('] does nothing with focus on the document body — no viewer owns it', async ({ page }) => {
	await focusDocumentBody(page);
	const before = await keyboardState(page);

	// ONE direction only, deliberately. Pressing `]` then `[` would advance and
	// then revert, landing back on `before` whether or not either individual
	// keystroke actually fired — a round trip cannot distinguish "nothing
	// happened" from "both directions fired and cancelled out". A single press
	// is the only shape that makes the equality assertion below load-bearing.
	await page.keyboard.press(']');

	// A causal barrier, not a wait — see the comment on the equivalent
	// assertion below for why this is how "nothing happened" is proven rather
	// than assumed.
	await page.getByTestId('read-hunks-a').click();
	await expectHunks(page, 'imperative-a', HUNKS_TWO);

	expect(await keyboardState(page)).toEqual(before);
});

test('Ctrl+Shift+D does nothing with focus on the document body', async ({ page }) => {
	// Different starting modes, so if this DID fire (the old bug) the two
	// would land on different values rather than coincidentally matching.
	await page.getByTestId('set-mode-a-original').click();
	await expect(page.getByTestId('mode-a')).toHaveText('original');
	await expect(page.getByTestId('mode-b')).toHaveText('unified');

	await focusDocumentBody(page);
	await page.keyboard.press('Control+Shift+D');

	// A causal barrier: an unrelated click with its own observable effect,
	// ordered after the keystroke, so anything the keystroke scheduled would
	// already be visible by the time this assertion runs.
	await page.getByTestId('read-hunks-a').click();
	await expectHunks(page, 'imperative-a', HUNKS_TWO);

	await expect(page.getByTestId('mode-a')).toHaveText('original');
	await expect(page.getByTestId('mode-b')).toHaveText('unified');
});

test('a decoy input outside every viewer fires nothing either, for the same scoping reason', async ({
	page
}) => {
	// `decoy-input` sits in instance B's section but OUTSIDE `viewer-b`'s own
	// DOM subtree (a sibling `<input>`, not a descendant) — so this is really
	// the same "outside every instance" case as the two tests above, not a
	// distinct input-guard case anymore. Kept as its own test because it was
	// the guard the pre-fix code relied on, and because an input element is
	// exactly the kind of target a future regression might special-case badly.
	await page.getByTestId('decoy-input').focus();
	const before = await keyboardState(page);

	await page.keyboard.press(']');
	await page.keyboard.press('Control+Shift+D');

	await page.getByTestId('read-hunks-a').click();
	await expectHunks(page, 'imperative-a', HUNKS_TWO);

	expect(await keyboardState(page)).toEqual(before);
});

test('focus inside one viewer scopes the keystroke to that viewer only', async ({ page }) => {
	// The differential that proves scoping rather than a page-wide guard: focus
	// a real, non-input control INSIDE instance A's own subtree (a toolbar
	// button), and confirm A advances while B — which never had focus inside
	// it — does not.
	await viewer(page, 'a').getByRole('button', { name: 'Next change' }).focus();

	await page.keyboard.press(']');

	await expect(changeCounter(page, 'a')).toHaveText('2 / 2');
	await expect(changeCounter(page, 'b')).toHaveText('1 / 3');
});

test('every default toolbar gets a unique per-instance id, and aria-labelledby resolves within its own instance', async ({
	page
}) => {
	// cinder#1309's fix: `DiffToolbar` derives its `SegmentedControl` id from
	// `$props.id()` (Svelte's SSR-stable per-instance id) instead of the
	// literal `"diff-view-mode"`. The ids are now non-deterministic strings —
	// asserting an exact value would be asserting Svelte's internal counter
	// format, not the contract. What the contract actually promises is
	// uniqueness and same-instance label resolution.
	//
	// Three, not five: C and D replaced their toolbars, so only A, B and E
	// render the segmented control.
	const radiogroups = page.getByRole('radiogroup');
	await expect(radiogroups).toHaveCount(3);

	const ids = await radiogroups.evaluateAll((nodes) => nodes.map((node) => node.id));
	expect(new Set(ids).size).toBe(3);
	expect(ids.every((id) => id.length > 0)).toBe(true);

	// Each radiogroup's `aria-labelledby` must resolve, via `getElementById`,
	// to a label node inside THAT SAME instance's own subtree — not always the
	// first instance in the document, which was cinder#1309's actual defect.
	const resolutions = await radiogroups.evaluateAll((nodes) =>
		nodes.map((node) => {
			const labelledBy = node.getAttribute('aria-labelledby');
			const label = labelledBy ? document.getElementById(labelledBy) : null;
			return {
				ownTestId: node.closest('[data-testid]')?.getAttribute('data-testid') ?? null,
				labelTestId: label?.closest('[data-testid]')?.getAttribute('data-testid') ?? null
			};
		})
	);
	expect(resolutions).toEqual([
		{ ownTestId: 'viewer-a', labelTestId: 'viewer-a' },
		{ ownTestId: 'viewer-b', labelTestId: 'viewer-b' },
		{ ownTestId: 'viewer-e', labelTestId: 'viewer-e' }
	]);
});

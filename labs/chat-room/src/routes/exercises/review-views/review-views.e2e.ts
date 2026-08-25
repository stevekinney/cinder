import { expect, test } from '@playwright/test';
import { gotoHydrated } from '../hydration';
import type { Locator, Page } from '@playwright/test';

// ReviewEditor's view layer: the editor/diff/summary tablist, the diff
// view-mode radiogroup, DiffStatistics, and Revert All.
//
// Boundaries with the sibling routes: `review-ssr-and-a11y` owns every live
// region (including the "Switched to diff view" announcement, which is
// `cinder-sr-only` and therefore NOT reachable through a visible-text locator)
// and every pre-hydration/SSR assertion. `review-modes` owns readonly
// mechanics — the readonly instance appears here only to show that Revert All
// is gated on `!readonly`.

/** Every derived id on the main instance descends from `id="views-editor"`. */
const CONTROLS = '#views-editor-controls';
const VIEW_TABLIST = '#views-editor-controls-view-mode';
const DIFF_MODE_GROUP = '#views-editor-controls-diff-view-mode';
const EDITOR_PANEL = '#views-editor-editor-panel';
const DIFF_PANEL = '#views-editor-diff-panel';
const SUMMARY_PANEL = '#views-editor-summary-panel';

type ViewName = 'Editor' | 'Diff' | 'Summary';

/** The page wraps each ReviewEditor in its own testid; the component's own
 *  container is `[data-testid="review-editor"]` and carries no id, so every
 *  locator has to be scoped through the wrapper. */
function instance(page: Page, testId: string): Locator {
	return page.getByTestId(testId);
}

function surface(scope: Locator): Locator {
	return scope.getByTestId('review-editor');
}

async function openReviewViews(page: Page): Promise<void> {
	await gotoHydrated(page, '/exercises/review-views');
	// `data-ready` is the right signal for the FIRST interaction only. See the
	// comment on `selectView` for why it is still the wrong one to wait on
	// after that, even though it no longer lies once the editor unmounts.
	await expect(surface(instance(page, 'views-main'))).toHaveAttribute('data-ready', 'true');
}

/**
 * Click a view tab and wait for the swap.
 *
 * The settle signal is `data-view`, never `data-ready`. `data-ready` mirrors
 * `editorViewReady`, which the component now resets (cinder#1301) via an
 * effect keyed on `editorRef` itself, so the attribute is absent for the
 * whole time no `MarkdownEditor` is mounted — the Diff/Summary views, and the
 * gap while a fresh one is mounting on the way back. That fixed a real bug
 * (it used to stay `"true"` forever after the first mount), but it still
 * means `data-ready` answers "is *some* editor mounted and ready", not "did
 * the view finish switching": waiting on it after a view switch waits for the
 * remount, one tick behind `data-view`, or for nothing at all in the
 * Diff/Summary direction. When the editor pane itself is what matters, wait
 * on `.ProseMirror`.
 */
async function selectView(scope: Locator, name: ViewName): Promise<void> {
	await scope.getByRole('tab', { name }).click();
	await expect(surface(scope)).toHaveAttribute('data-view', name.toLowerCase());
}

test.describe('review-views: the view tablist', () => {
	let page: Page;

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		await openReviewViews(page);
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('one unified control bar hosts the view tablist and the formatting toolbar', async () => {
		const main = instance(page, 'views-main');
		await selectView(main, 'Editor');

		// There is exactly ONE control row. The formatting controls (undo, redo,
		// block type, overflow) are hosted INSIDE it, in `.controls-formatting`,
		// rather than in a second toolbar row stacked underneath — there is no
		// `.editor-toolbar-wrapper` anywhere.
		await expect(main.locator('.review-editor-controls')).toHaveCount(1);
		await expect(main.locator('.editor-toolbar-wrapper')).toHaveCount(0);
		await expect(main.locator(`${CONTROLS} .controls-formatting .editor-toolbar`)).toHaveCount(1);

		// BEHAVIOUR CHANGE: the outer bar used to be a second `role="toolbar"`
		// wrapping the editor's own `toolbar`, which is not a shape ARIA expects.
		// It is now `role="group"` with `aria-label="Review editor controls"`:
		// the bar hosts a `tablist` (never a valid child of `toolbar`) and, in
		// the editor view, the editor's `toolbar` (which may not nest inside
		// another `toolbar`). A labelled group describes what the bar is and
		// keeps both children valid.
		const bar = page.locator(CONTROLS);
		await expect(bar).toHaveAttribute('role', 'group');
		await expect(bar).toHaveAttribute('aria-label', 'Review editor controls');
		await expect(main.getByRole('toolbar', { name: 'Formatting toolbar' })).toHaveCount(1);

		// The tablist is labelled by an sr-only span rather than an aria-label,
		// so the accessible name comes from text the eye never sees.
		const tablist = page.locator(VIEW_TABLIST);
		await expect(tablist).toHaveAttribute('role', 'tablist');
		await expect(tablist).toHaveAttribute('aria-orientation', 'horizontal');
		await expect(tablist).toHaveAttribute('aria-labelledby', `${VIEW_TABLIST.slice(1)}-label`);
		await expect(page.locator(`${VIEW_TABLIST}-label`)).toHaveText('Review editor view');
		await expect(page.locator(`${VIEW_TABLIST}-label`)).toHaveClass(/cinder-sr-only/);

		// DOM order is Editor / Diff / Summary.
		await expect(tablist.getByRole('tab')).toHaveText(['Editor', 'Diff', 'Summary']);
	});

	test('selecting a tab sets data-view and swaps in exactly one panel', async () => {
		const main = instance(page, 'views-main');

		await selectView(main, 'Editor');
		await expect(main.getByRole('tabpanel')).toHaveCount(1);
		await expect(page.locator(EDITOR_PANEL)).toHaveAttribute('aria-label', 'Editor view');
		// The other two panels are not hidden — they do not exist.
		await expect(page.locator(DIFF_PANEL)).toHaveCount(0);
		await expect(page.locator(SUMMARY_PANEL)).toHaveCount(0);

		await selectView(main, 'Diff');
		await expect(main.getByRole('tabpanel')).toHaveCount(1);
		await expect(page.locator(DIFF_PANEL)).toHaveAttribute('aria-label', 'Diff view');
		await expect(page.locator(EDITOR_PANEL)).toHaveCount(0);
		await expect(page.locator(SUMMARY_PANEL)).toHaveCount(0);

		await selectView(main, 'Summary');
		await expect(main.getByRole('tabpanel')).toHaveCount(1);
		await expect(page.locator(SUMMARY_PANEL)).toHaveAttribute('aria-label', 'Summary view');
		await expect(page.locator(EDITOR_PANEL)).toHaveCount(0);
		await expect(page.locator(DIFF_PANEL)).toHaveCount(0);
	});

	test('only the selected tab carries aria-controls; unselected tabs carry none', async () => {
		const main = instance(page, 'views-main');

		// cinder#1303: every tab used to point at its panel id unconditionally,
		// so in each view two of the three `aria-controls` references dangled —
		// the view area renders exactly one panel at a time via an `{#if}`
		// chain, not three panels with two merely hidden, so an inactive tab's
		// target never existed in the document. Fixed by only passing `controls`
		// to the active segment, so an unselected tab now omits `aria-controls`
		// entirely rather than pointing it at a nonexistent id — a dangling
		// reference fails axe's `aria-valid-attr-value` and any screen reader
		// that follows the tab-to-panel relationship, where an absent attribute
		// simply doesn't claim to control anything (yet).
		const panelIds = { Editor: EDITOR_PANEL, Diff: DIFF_PANEL, Summary: SUMMARY_PANEL } as const;
		for (const view of ['Editor', 'Diff', 'Summary'] as const) {
			await selectView(main, view);
			for (const tab of ['Editor', 'Diff', 'Summary'] as const) {
				const tabLocator = main.getByRole('tab', { name: tab });
				if (tab === view) {
					await expect(tabLocator).toHaveAttribute('aria-controls', panelIds[tab].slice(1));
				} else {
					await expect(tabLocator).not.toHaveAttribute('aria-controls');
				}
				await expect(page.locator(panelIds[tab])).toHaveCount(tab === view ? 1 : 0);
			}
		}
	});

	test('arrow keys activate automatically, answer both axes, and wrap', async () => {
		const main = instance(page, 'views-main');
		await selectView(main, 'Editor');

		const tab = (name: ViewName) => main.getByRole('tab', { name });
		// Roving tabindex: only the selected tab is in the tab order.
		await expect(tab('Editor')).toHaveAttribute('tabindex', '0');
		await expect(tab('Diff')).toHaveAttribute('tabindex', '-1');

		await tab('Editor').focus();

		// Activation is automatic — moving focus also changes the view. Focus
		// moves synchronously but `aria-selected`/`data-view` flush on a later
		// microtask, so every assertion below goes through auto-retrying
		// `expect`; a synchronous read straight after `press` would race.
		await page.keyboard.press('ArrowRight');
		await expect(surface(main)).toHaveAttribute('data-view', 'diff');
		await expect(tab('Diff')).toHaveAttribute('aria-selected', 'true');
		await expect(tab('Diff')).toBeFocused();

		// The tablist declares `aria-orientation="horizontal"` yet answers the
		// vertical arrows too: the roving helper is invoked with both axes
		// enabled unless the orientation is explicitly vertical.
		await page.keyboard.press('ArrowDown');
		await expect(surface(main)).toHaveAttribute('data-view', 'summary');
		await expect(tab('Summary')).toHaveAttribute('aria-selected', 'true');

		// Forward from the last tab wraps to the first.
		await page.keyboard.press('ArrowRight');
		await expect(surface(main)).toHaveAttribute('data-view', 'editor');
		await expect(tab('Editor')).toHaveAttribute('aria-selected', 'true');

		await page.keyboard.press('End');
		await expect(surface(main)).toHaveAttribute('data-view', 'summary');

		await page.keyboard.press('ArrowLeft');
		await expect(surface(main)).toHaveAttribute('data-view', 'diff');

		await page.keyboard.press('ArrowUp');
		await expect(surface(main)).toHaveAttribute('data-view', 'editor');

		await page.keyboard.press('End');
		await expect(surface(main)).toHaveAttribute('data-view', 'summary');
		await page.keyboard.press('Home');
		await expect(surface(main)).toHaveAttribute('data-view', 'editor');
		await expect(tab('Editor')).toBeFocused();
		await expect(tab('Summary')).toHaveAttribute('tabindex', '-1');
	});
});

test.describe('review-views: the baseline gate and diff statistics', () => {
	let page: Page;

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		await openReviewViews(page);
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('statistics summarise the fixture and omit the zero category', async () => {
		const stats = instance(page, 'views-main').locator('.cinder-diff-statistics');
		await expect(stats).toHaveAttribute('role', 'group');

		// The group's own label is the TOTAL of the three counts — one added
		// line plus one modified line reads as "2 lines changed", not "2 lines
		// added". Each surviving stat carries its own pluralised label.
		await expect(stats).toHaveAttribute('aria-label', '2 lines changed');
		await expect(stats.locator('[aria-label="1 line added"]')).toHaveCount(1);
		await expect(stats.locator('[aria-label="1 line modified"]')).toHaveCount(1);

		// `zeroVisible={false}`: the removed category is dropped entirely rather
		// than rendered as "0 removed".
		await expect(stats.locator('.cinder-diff-statistics__stat--removed')).toHaveCount(0);
		await expect(stats.locator('.cinder-diff-statistics__stat')).toHaveCount(2);

		// DiffStatistics has a "No changes" chip for the all-zero case, but the
		// control bar only mounts the component when at least one count is
		// non-zero, so that chip is unreachable from ReviewEditor by
		// construction — not merely absent for this fixture.
		await expect(page.locator('.cinder-diff-statistics__stat--none')).toHaveCount(0);
	});

	test('the statistics chip is a property of the document, not of the active view', async () => {
		const main = instance(page, 'views-main');
		for (const view of ['Diff', 'Summary', 'Editor'] as const) {
			await selectView(main, view);
			await expect(main.locator('.cinder-diff-statistics')).toHaveCount(1);
		}
	});

	test('an omitted `original` collapses the surface to the Editor tab alone', async () => {
		// `showDiffTabs={!!original}` and the wrapper defaults `original` to `''`,
		// so omitting the prop is the same as passing an empty string.
		const scope = instance(page, 'views-no-original');
		await expect(scope.getByRole('tab')).toHaveCount(1);
		await expect(scope.getByRole('tab')).toHaveText(['Editor']);
		await expect(scope.locator('.cinder-diff-statistics')).toHaveCount(0);
		await expect(scope.getByLabel('Revert all changes')).toHaveCount(0);
		// A tablist is still rendered — it just has nothing to switch between.
		await expect(scope.getByRole('tablist')).toHaveCount(1);
	});

	test('an empty-string `original` behaves identically to an omitted one', async () => {
		const scope = instance(page, 'views-empty-original');
		await expect(scope.getByRole('tab')).toHaveCount(1);
		await expect(scope.getByRole('tab')).toHaveText(['Editor']);
		await expect(scope.locator('.cinder-diff-statistics')).toHaveCount(0);
		await expect(scope.getByLabel('Revert all changes')).toHaveCount(0);
	});
});

test.describe('review-views: the diff panel', () => {
	let page: Page;

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		await openReviewViews(page);
		await selectView(instance(page, 'views-main'), 'Diff');
	});

	test.afterAll(async () => {
		await page.close();
	});

	/** Reset to Unified so each test starts from the same mode regardless of
	 *  the order it runs in. */
	async function useMode(name: 'Unified' | 'Final' | 'Original'): Promise<void> {
		const radio = page.locator(DIFF_MODE_GROUP).getByRole('radio', { name });
		await radio.click();
		await expect(radio).toHaveAttribute('aria-checked', 'true');
	}

	test('the diff view-mode control is a radiogroup, not a second tablist', async () => {
		const main = instance(page, 'views-main');
		await selectView(main, 'Diff');
		const group = page.locator(DIFF_MODE_GROUP);

		// Only ONE tablist exists on this surface. The diff modes are radios:
		// they choose how the same panel renders, they do not swap panels, so
		// they carry `aria-checked` and — unlike the view tabs — no
		// `aria-controls` at all.
		await expect(main.getByRole('tablist')).toHaveCount(1);
		await expect(group).toHaveAttribute('role', 'radiogroup');
		await expect(group).toHaveAttribute('aria-labelledby', `${DIFF_MODE_GROUP.slice(1)}-label`);
		await expect(page.locator(`${DIFF_MODE_GROUP}-label`)).toHaveText('Diff view mode');
		await expect(group.getByRole('radio')).toHaveText(['Unified', 'Final', 'Original']);
		await expect(group.locator('[role="radio"][aria-controls]')).toHaveCount(0);

		// Roving tabindex, same as the tablist: only the checked radio is in the
		// tab order.
		await useMode('Unified');
		await expect(group.getByRole('radio', { name: 'Unified' })).toHaveAttribute('tabindex', '0');
		await expect(group.getByRole('radio', { name: 'Final' })).toHaveAttribute('tabindex', '-1');
	});

	test('the radiogroup is diff-only, and a separator precedes whichever optional cluster the bar has', async () => {
		const main = instance(page, 'views-main');

		// BEHAVIOUR CHANGE: the separator used to be diff-exclusive — the control
		// bar emitted one only ahead of the diff-mode radiogroup, so the editor
		// view had none. The bar now emits `.controls-separator` ahead of BOTH
		// optional trailing clusters: one before `.controls-formatting` (editor
		// view) and one before the radiogroup (diff view). The two clusters are
		// mutually exclusive — the formatting toolbar only exists while the
		// editor is mounted — so the count is still never more than one, and the
		// separator is still absent in Summary, which has neither cluster.
		const separator = main.locator('.controls-separator');

		await selectView(main, 'Editor');
		await expect(page.locator(DIFF_MODE_GROUP)).toHaveCount(0);
		await expect(separator).toHaveCount(1);
		await expect(separator).toHaveAttribute('aria-hidden', 'true');
		// It leads the formatting cluster rather than the radiogroup here.
		await expect(main.locator('.controls-separator + .controls-formatting')).toHaveCount(1);

		// Summary mounts no editor and no diff controls, so there is nothing for a
		// separator to divide and none is rendered.
		await selectView(main, 'Summary');
		await expect(page.locator(DIFF_MODE_GROUP)).toHaveCount(0);
		await expect(separator).toHaveCount(0);

		await selectView(main, 'Diff');
		await expect(page.locator(DIFF_MODE_GROUP)).toHaveCount(1);
		await expect(main.locator('.controls-formatting')).toHaveCount(0);
		await expect(separator).toHaveCount(1);
		// The separator is decorative and hidden from the accessibility tree.
		await expect(separator).toHaveAttribute('aria-hidden', 'true');
	});

	test('unified mode shows word-level changes on a modified row', async () => {
		const main = instance(page, 'views-main');
		await selectView(main, 'Diff');
		await useMode('Unified');

		// Nine rows: seven unchanged, one modified, one added.
		await expect(main.locator('.diff-line')).toHaveCount(9);
		await expect(main.locator('.diff-line-modified')).toHaveCount(1);
		await expect(main.locator('.diff-line-added')).toHaveCount(1);
		await expect(main.locator('.diff-line-removed')).toHaveCount(0);

		// The modified row's gutter marks it `~`, and only unified mode renders
		// the intra-line word diff.
		await expect(main.locator('.diff-line-modified .diff-gutter')).toHaveText('~');
		await expect(main.locator('del.word-removed')).toHaveCount(1);
		await expect(main.locator('ins.word-added')).toHaveCount(2);

		// Changed rows are real buttons with a spoken label; unchanged rows are
		// plain divs carrying no label at all, so a screen reader walks past them.
		const changed = main.locator('button.diff-line');
		await expect(changed).toHaveCount(2);
		await expect(main.getByRole('button', { name: /^Modified line:/ })).toHaveCount(1);
		await expect(main.getByRole('button', { name: /^Added line:/ })).toHaveCount(1);
		await expect(main.locator('div.diff-line')).toHaveCount(7);
		await expect(main.locator('div.diff-line[aria-label]')).toHaveCount(0);

		// In unified mode the modified row's label carries BOTH sides.
		await expect(main.getByRole('button', { name: /^Modified line:/ })).toHaveAttribute(
			'aria-label',
			/ changed to /
		);
	});

	test('final mode keeps every row but renders only the new text', async () => {
		const main = instance(page, 'views-main');
		await selectView(main, 'Diff');
		await useMode('Final');

		// Row count is unchanged (the fixture removes nothing), but the modified
		// row swaps its modifier class and drops the inline word diff.
		await expect(main.locator('.diff-line')).toHaveCount(9);
		await expect(main.locator('.diff-line-modified-final')).toHaveCount(1);
		await expect(main.locator('.diff-line-modified')).toHaveCount(0);
		await expect(main.locator('.diff-line-added')).toHaveCount(1);
		await expect(main.locator('del.word-removed')).toHaveCount(0);
		await expect(main.locator('ins.word-added')).toHaveCount(0);

		// The label now names only the post-edit text.
		const modified = main.getByRole('button', { name: /^Modified line:/ });
		await expect(modified).toHaveAttribute('aria-label', /and inline review\.$/);
		await expect(modified).not.toHaveAttribute('aria-label', / changed to /);
	});

	test('original mode drops added rows entirely and shows the baseline text', async () => {
		const main = instance(page, 'views-main');
		await selectView(main, 'Diff');
		await useMode('Original');

		// The added row is not merely restyled — it is gone, so the row count
		// falls from nine to eight.
		await expect(main.locator('.diff-line')).toHaveCount(8);
		await expect(main.locator('.diff-line-added')).toHaveCount(0);
		await expect(main.getByRole('button', { name: /^Added line:/ })).toHaveCount(0);
		await expect(main.locator('.diff-line-modified-original')).toHaveCount(1);

		const modified = main.getByRole('button', { name: /^Modified line:/ });
		await expect(modified).toHaveAttribute('aria-label', /a dashboard and export actions\.$/);
	});

	test("ReviewEditor suppresses DiffViewer's own toolbar and hunk chrome", async () => {
		const main = instance(page, 'views-main');
		await selectView(main, 'Diff');

		// ReviewEditor passes DiffViewer an EMPTY `toolbar` snippet, which
		// overrides the default one wholesale: no view-mode duplicate, no change
		// navigation, no copy or manual-compute button. Hunk headers disappear
		// for a different reason — they render only when `onreverthunk` is
		// supplied, and ReviewEditor never supplies it.
		await expect(main.locator('.diff-toolbar')).toHaveCount(0);
		await expect(main.locator('.hunk-header')).toHaveCount(0);
		await expect(main.locator('.hunk-revert-button')).toHaveCount(0);
		for (const name of ['Next change', 'Previous change', 'Copy unified diff', 'Compute Diff']) {
			await expect(main.getByRole('button', { name })).toHaveCount(0);
		}
	});

	test("DiffViewer's keyboard shortcuts are scoped to focus inside its own subtree, not the window", async () => {
		// FIXED contract as of `@lostgradient/editor@0.10.0` (cinder#1310). The
		// handler moved from a bare `<svelte:window onkeydown>` onto DiffViewer's
		// own root element, relying on DOM event bubbling — so a keystroke only
		// reaches it when the currently focused element is inside that instance's
		// own subtree. `ReviewEditor`'s OWN mode-switcher radiogroup
		// (`DIFF_MODE_GROUP`, id-prefixed `views-editor-controls-…`) is rendered
		// by ReviewEditor itself, alongside DiffViewer rather than inside its
		// `toolbar` snippet (which this route passes empty — see "ReviewEditor
		// suppresses DiffViewer's own toolbar and hunk chrome" above) — so even
		// ReviewEditor's own controls are now OUTSIDE the scope that fires these
		// shortcuts. The one thing genuinely inside DiffViewer's own subtree here
		// is the diff content itself: each diff line renders as a
		// `role="button"`, and focusing one is what makes the shortcuts fire.
		const main = instance(page, 'views-main');
		// Round-trip through the editor first so the DiffViewer below is a fresh
		// mount — otherwise "auto-selected on mount" would be asserting about
		// whatever a previous test left behind.
		await selectView(main, 'Editor');
		await selectView(main, 'Diff');
		await useMode('Unified');

		const group = page.locator(DIFF_MODE_GROUP);
		const mode = (name: string) => group.getByRole('radio', { name });

		// The first change is auto-selected on mount without any interaction.
		const selected = main.locator('.diff-line[data-selected="true"]');
		await expect(selected).toHaveAttribute('aria-label', /^Modified line:/);

		// Focus OUTSIDE every DiffViewer instance: clicking a page heading leaves
		// `document.activeElement` on `<body>`. This now fires nothing — a
		// deliberate behavior change from the old global listener, not only a
		// bug fix. Proven with a causal barrier (`useMode` has its own
		// observable effect) rather than a bare absence-of-change assertion,
		// which could equally pass because nothing had happened yet.
		await page.getByRole('heading', { name: 'Views and diff' }).click();
		await page.keyboard.press(']');
		await page.keyboard.press('Control+Shift+D');
		await useMode('Final');
		await useMode('Unified');
		await expect(selected).toHaveAttribute('aria-label', /^Modified line:/);

		// Focus a diff line — genuinely inside DiffViewer's own Surface root —
		// and the same shortcuts now work. `]` / `[` walk the changed rows and
		// wrap at both ends.
		await selected.focus();
		await page.keyboard.press(']');
		await expect(main.locator('.diff-line[data-selected="true"]')).toHaveAttribute(
			'aria-label',
			/^Added line:/
		);
		await page.keyboard.press(']');
		await expect(main.locator('.diff-line[data-selected="true"]')).toHaveAttribute(
			'aria-label',
			/^Modified line:/
		);
		await page.keyboard.press('[');
		await expect(main.locator('.diff-line[data-selected="true"]')).toHaveAttribute(
			'aria-label',
			/^Added line:/
		);

		// Ctrl+Shift+D cycles Unified → Final → Original → Unified, and the
		// toolbar radiogroup follows because both read the same bound
		// `diffViewMode` — even though the radiogroup itself sits outside
		// DiffViewer's own subtree, the keystroke that changes the bound value
		// still has to originate INSIDE it. Note the modifier is literally
		// Control on every platform — the handler checks `event.ctrlKey`, so
		// macOS does not get the Cmd-based chord it would expect. Focus stays on
		// the same diff-line button across all three presses: each mode change
		// re-renders the diff body, but does not move focus away from it.
		await expect(mode('Unified')).toHaveAttribute('aria-checked', 'true');
		await page.keyboard.press('Control+Shift+D');
		await expect(mode('Final')).toHaveAttribute('aria-checked', 'true');
		await page.keyboard.press('Control+Shift+D');
		await expect(mode('Original')).toHaveAttribute('aria-checked', 'true');
		await page.keyboard.press('Control+Shift+D');
		await expect(mode('Unified')).toHaveAttribute('aria-checked', 'true');
	});
});

test.describe('review-views: the summary panel', () => {
	let page: Page;

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		await openReviewViews(page);
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('the summary is a readonly editor showing changes and feedback', async () => {
		const main = instance(page, 'views-main');
		await selectView(main, 'Summary');

		// The summary is rendered by a second MarkdownEditor mounted readonly —
		// a real ProseMirror document, not static HTML — so the markdown
		// structure is inspectable as headings.
		const summary = main.locator('.ProseMirror');
		await expect(summary).toHaveAttribute('contenteditable', 'false');
		await expect(main.locator('.editor-toolbar')).toHaveCount(0);

		await expect(main.getByRole('heading', { name: 'Changes Made', level: 2 })).toBeVisible();
		await expect(main.getByRole('heading', { name: 'Feedback', level: 2 })).toBeVisible();
		// Thread commentary is keyed by the anchor's quote.
		await expect(main.getByRole('heading', { name: 'On "Release Plan"', level: 3 })).toBeVisible();
		await expect(summary).toContainText('Title reads well');

		// The generator emits a `# Review Summary` title for clipboard exports,
		// and the view strips it before rendering: the tab already says
		// "Summary", so repeating it in the document would be noise.
		await expect(summary).not.toContainText('Review Summary');
	});

	test('with nothing changed and no threads the summary falls back to an empty region', async () => {
		const scope = instance(page, 'views-summary-empty');
		await selectView(scope, 'Summary');

		// `original === value` and `threads: []` is the only combination that
		// takes this branch — a single thread on an unedited document would
		// still generate a document.
		const region = scope.locator('.summary-view');
		await expect(region).toHaveAttribute('role', 'region');
		await expect(region).toHaveAttribute('aria-label', 'Review summary');
		await expect(region).toContainText('No changes or comments to summarize.');
		await expect(scope.locator('.summary-hint')).toContainText(
			'Edit the document or add comments to generate a summary.'
		);
		// No MarkdownEditor is mounted at all on this branch.
		await expect(scope.locator('.ProseMirror')).toHaveCount(0);
	});
});

test.describe('review-views: revert all', () => {
	let page: Page;

	// Revert All rewrites `value`, so this describe owns its own page — the
	// mutation is not something the read-only describes above should inherit.
	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		await openReviewViews(page);
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('Revert All is absent outside the diff view and absent when readonly', async () => {
		const main = instance(page, 'views-main');

		// The button is gated on `activeView === 'diff' && hasContentChanges &&
		// !readonly`. First two thirds of that gate:
		await selectView(main, 'Editor');
		await expect(main.getByLabel('Revert all changes')).toHaveCount(0);
		await selectView(main, 'Summary');
		await expect(main.getByLabel('Revert all changes')).toHaveCount(0);
		await selectView(main, 'Diff');
		await expect(main.getByLabel('Revert all changes')).toHaveCount(1);

		// Last third: an otherwise identical readonly instance reaches the diff
		// view — statistics and all — and still offers no way to revert.
		// (`review-modes` owns everything else about readonly.)
		const readonly = instance(page, 'views-readonly');
		await selectView(readonly, 'Diff');
		await expect(readonly.locator('.cinder-diff-statistics')).toHaveCount(1);
		await expect(readonly.locator('.diff-line')).toHaveCount(9);
		await expect(readonly.getByLabel('Revert all changes')).toHaveCount(0);
		// Put it back so its DiffViewer stops listening for window keystrokes.
		await selectView(readonly, 'Editor');
	});

	test('Revert All restores the baseline, fires onchange once, and stays in the diff view', async () => {
		const main = instance(page, 'views-main');
		await selectView(main, 'Diff');

		const revert = main.getByRole('button', { name: 'Revert all changes' });
		// Icon-only button: the visible label is sr-only text behind the
		// aria-label, and the same string doubles as the tooltip.
		await expect(revert).toHaveAttribute('title', 'Revert all changes');
		await expect(revert.locator('.cinder-sr-only')).toHaveText('Revert All');
		await expect(page.getByTestId('change-count')).toHaveText('changes: 0');
		await expect(page.getByTestId('value-equals-original')).toHaveText(
			'value equals original: false'
		);

		await revert.click();

		// `value` becomes `original` exactly, and `onchange` fires once with
		// that same string — the component does not also emit an intermediate
		// value on the way there.
		await expect(page.getByTestId('value-equals-original')).toHaveText(
			'value equals original: true'
		);
		await expect(page.getByTestId('change-count')).toHaveText('changes: 1');
		await expect(page.getByTestId('last-change-is-original')).toHaveText(
			'last change is original: true'
		);

		// The surface does not bounce back to the editor: it stays on the diff
		// view, now showing an all-unchanged document.
		await expect(surface(main)).toHaveAttribute('data-view', 'diff');
		await expect(main.locator('.diff-line')).toHaveCount(8);
		await expect(main.locator('button.diff-line')).toHaveCount(0);

		// The statistics chip and the button itself both disappear, because both
		// hang off `hasContentChanges`, which is now false…
		await expect(main.locator('.cinder-diff-statistics')).toHaveCount(0);
		await expect(main.getByLabel('Revert all changes')).toHaveCount(0);

		// …but the tabs and the diff radios are gated on `original` and on
		// `activeView`, not on whether anything changed, so they all survive.
		await expect(main.getByRole('tab')).toHaveText(['Editor', 'Diff', 'Summary']);
		await expect(page.locator(DIFF_MODE_GROUP).getByRole('radio')).toHaveText([
			'Unified',
			'Final',
			'Original'
		]);
	});
});

test.describe('review-views: leaving the editor view destroys the editor', () => {
	let page: Page;

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		await openReviewViews(page);
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('the ProseMirror instance is discarded and rebuilt, taking undo history with it', async () => {
		const main = instance(page, 'views-main');
		await selectView(main, 'Editor');

		const editorPane = main.locator('.ProseMirror');
		await expect(editorPane).toBeVisible();

		// Make one real edit so there is undo history to lose. `pressSequentially`
		// drives ProseMirror through genuine input events; writing to the DOM
		// directly would not register a transaction. Click the first paragraph
		// rather than the editor's centre — clicking decorated text (the seeded
		// thread's anchor sits on the title) opens the thread popover instead of
		// placing a caret.
		const undo = main.getByRole('button', { name: 'Undo' });
		await expect(undo).toBeDisabled();
		await editorPane.locator('p').first().click();
		await page.keyboard.press('End');
		await page.keyboard.type(' now');
		await expect(undo).toBeEnabled();

		const lengthAfterEdit = await page.getByTestId('value-length').textContent();

		// Stamp the live node so its identity is checkable after the round trip.
		await editorPane.evaluate((node) => node.setAttribute('data-probe', 'first'));

		await selectView(main, 'Diff');
		// The editor is gone, not hidden — and so is the formatting toolbar that
		// was hosted in the control bar.
		await expect(main.locator('.ProseMirror')).toHaveCount(0);
		await expect(main.locator('.controls-formatting')).toHaveCount(0);
		// `data-ready` used to be STICKY (cinder#1301): it kept claiming the
		// editor was ready even after it unmounted, because the latch behind it
		// was set once and never cleared. Fixed by deriving the reset from
		// `editorRef` itself, so the attribute is now correctly absent for as
		// long as no editor is mounted — pinned here, not just in
		// `review-ssr-and-a11y`'s own coverage of the same fix, because this is
		// the test that actually drives an editor through the unmount.
		await expect(surface(main)).not.toHaveAttribute('data-ready');

		await selectView(main, 'Editor');
		await expect(main.locator('.ProseMirror')).toBeVisible();
		// …and comes back once the remounted editor reports ready again.
		await expect(surface(main)).toHaveAttribute('data-ready', 'true');

		// A different DOM node: the stamp did not come back with it.
		await expect(main.locator('.ProseMirror')).not.toHaveAttribute('data-probe', 'first');
		await expect(main.locator('.ProseMirror[data-probe]')).toHaveCount(0);

		// The document survives, because it lives in the bindable `value` rather
		// than in the editor…
		await expect(page.getByTestId('value-length')).toHaveText(lengthAfterEdit ?? '');
		// …but undo history does not: a peek at the diff silently throws away
		// every step the user could have undone.
		await expect(main.getByRole('button', { name: 'Undo' })).toBeDisabled();

		// Nor does focus return to the editor — it lands back on the body, so a
		// keyboard user has to find their way in again.
		await expect(main.locator('.ProseMirror')).not.toBeFocused();
	});
});

test.describe('review-views: the comments sidebar outlives view switches', () => {
	let page: Page;

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		await openReviewViews(page);
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('sidebar open state is independent of the active view', async () => {
		const main = instance(page, 'views-main');
		await selectView(main, 'Editor');

		// The toggle's accessible name carries both the next action and the
		// comment count, so it changes when the sidebar opens.
		const toggle = main.getByRole('button', { name: 'Open comments sidebar (1 comment)' });

		// While the sidebar is closed its `aria-controls` target does not exist —
		// the aside is behind an `{#if sidebarOpen}`, so the reference dangles
		// until it is opened. Worth knowing before trusting the attribute.
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');
		await expect(toggle).toHaveAttribute('aria-controls', 'views-editor-sidebar');
		await expect(page.locator('#views-editor-sidebar')).toHaveCount(0);

		await toggle.click();
		const opened = main.getByRole('button', { name: 'Close comments sidebar (1 comment)' });
		await expect(opened).toHaveAttribute('aria-expanded', 'true');
		await expect(page.locator('#views-editor-sidebar')).toHaveCount(1);

		// Only `.review-editor-main` swaps on a view change; the sidebar is a
		// sibling of it, so it stays mounted the whole way round.
		for (const view of ['Diff', 'Summary', 'Editor'] as const) {
			await selectView(main, view);
			await expect(page.locator('#views-editor-sidebar')).toHaveCount(1);
			await expect(opened).toHaveAttribute('aria-expanded', 'true');
		}
	});
});

test.describe('review-views: the toolbar and the panel normalise differently', () => {
	let page: Page;

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		await openReviewViews(page);
	});

	test.afterAll(async () => {
		await page.close();
	});

	// PINNED KNOWN BUG — this is wrong behaviour, pinned deliberately so a fix
	// shows up as a failing test rather than passing unnoticed.
	//
	// ReviewEditor computes `diffStats` by running both documents through
	// `normalize()` from the markdown pipeline, which canonicalises `__bold__`
	// to `**bold**`. The DiffViewer it renders in the same panel runs its own
	// regex `normalizeForDiff()`, which does no such canonicalisation. Give the
	// two the same document with only its bold syntax changed and they disagree
	// outright: the toolbar counts zero changes, so it shows no statistics chip
	// and — because Revert All hangs off `hasContentChanges` — offers no way to
	// revert, while the panel underneath renders a modified row for the very
	// difference the toolbar says does not exist.
	//
	// The fix is for both to share one normaliser. Until then, a formatting-only
	// edit is visible but unrevertable.
	test('a formatting-only edit renders as a modified row the toolbar cannot see', async () => {
		const scope = instance(page, 'views-formatting-only');
		await selectView(scope, 'Diff');

		// The panel sees the change…
		await expect(scope.locator('.diff-line-modified')).toHaveCount(1);
		await expect(scope.getByRole('button', { name: /^Modified line:/ })).toHaveAttribute(
			'aria-label',
			/__first__ .* changed to .*\*\*first\*\*/
		);

		// …and the toolbar does not.
		await expect(scope.locator('.cinder-diff-statistics')).toHaveCount(0);
		await expect(scope.getByLabel('Revert all changes')).toHaveCount(0);

		// The Diff and Summary tabs are still offered, because `showDiffTabs`
		// keys off `!!original` rather than off the stats — so the surface
		// invites you into a view whose own controls have given up on it.
		await expect(scope.getByRole('tab')).toHaveText(['Editor', 'Diff', 'Summary']);
	});
});

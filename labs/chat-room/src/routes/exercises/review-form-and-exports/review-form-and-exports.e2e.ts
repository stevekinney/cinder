import { expect, test } from '@playwright/test';
import { applyPatchInTempRepo } from '../git-apply';
import { gotoHydrated } from '../hydration';
import type { Locator, Page } from '@playwright/test';

// ReviewEditor's form participation and its export menu are two renderings of
// the same five derivations, so this file pins them together, plus the pure
// functions (`@lostgradient/editor/review-editor` and `.../export`) that are
// supposed to reproduce them outside the component.
//
// Everything asserted here was checked against the running component; where a
// behavior is WRONG but real it is pinned as such, with a comment saying so,
// rather than softened into something that passes.

const ROUTE = '/exercises/review-form-and-exports';

// The five hidden inputs, in DOM order. `name` is a PREFIX: the component
// joins it to each field with a hyphen.
const REVIEW_FIELDS = [
	'review-original',
	'review-current',
	'review-comments',
	'review-diff',
	'review-summary'
];

// The unified diff for the seeded fixture, byte for byte. One modified line and
// one added line, three lines of context, merged into a single hunk. Written
// out rather than derived so a change in the diff algorithm shows up as a
// failure here instead of being absorbed by a self-referential comparison.
const EXPECTED_DIFF = [
	'--- a/document.md',
	'+++ b/document.md',
	'@@ -1,8 +1,9 @@',
	' # Release Plan',
	' ',
	'-The first release includes a dashboard and export actions.',
	'+The first release includes a dashboard, export actions, and inline review.',
	' ',
	' ## Checklist',
	' ',
	' - Finalize the component API',
	' - Add playground coverage',
	'+- Document review export behavior',
	''
].join('\n');

// `generateMarkdownSummary` output for the same fixture, byte for byte. RE-2
// asks for an anchored thread's export to be pinned exactly, so a change to the
// orphan branch — or to any of the three heading shapes — cannot quietly alter
// what an anchored thread produces.
//
// The fixture is never typed into on the shared page (the one test that types
// has its own). `generateMarkdownSummary` now normalizes by default too
// (`@lostgradient/editor@0.11.0`, cinder#1307/#1318), through the same
// `normalizeDocument` `generateUnifiedDiff` uses — which is what keeps the
// `- ` bullets below stable even though Milkdown's own serializer prefers `*`:
// normalization canonicalizes back to `-` for this fixture (see "typing
// changes `review-current` and `review-diff`" below), so both exports agree.
const EXPECTED_SUMMARY = [
	'## Changes Made',
	'',
	'The following edits were made to the document:',
	'',
	'### Lines 1-5',
	'',
	'```diff',
	' # Release Plan',
	' ',
	'-The first release includes a dashboard and export actions.',
	'+The first release includes a dashboard, export actions, and inline review.',
	' ',
	' ## Checklist',
	'```',
	'',
	'### Lines 7-8',
	'',
	'```diff',
	' - Finalize the component API',
	' - Add playground coverage',
	'+- Document review export behavior',
	'```',
	'',
	'## Feedback',
	'',
	'The following comments were made and may require action:',
	'',
	'### On "Release Plan"',
	'',
	'> Title reads well — keep it.',
	''
].join('\n');

// The fourth editor's summary at rest, byte for byte. Its `original` equals its
// initial `value`, so there is no `## Changes Made` section at all and the whole
// document is the Feedback section RE-2 is about.
//
// Read it as the strongest available statement of "never prints a coordinate it
// does not have": there is not a single DIGIT in it. Three threads — one
// anchored to a quote, one anchored to the heading, one document-level — and the
// export prints quotes and comment bodies and nothing else. No `from`, no `to`,
// no `lastKnownOffset`, no line number.
const EXPECTED_ORPHAN_SUMMARY_AT_REST = [
	'## Feedback',
	'',
	'The following comments were made and may require action:',
	'',
	'### On "beta rollout"',
	'',
	'> Which teams, exactly?',
	'',
	'### On "Beta Notes"',
	'',
	'> Heading reads fine.',
	'',
	'### Document-level feedback',
	'',
	'> Overall: ready to ship.',
	''
].join('\n');

// `generateCommentsExport` output for the same fixture. Note `**Total
// comments:** 1` against a thread that holds TWO comments — the second carries
// `deletedAt`, and every comments export filters soft-deleted comments out.
const EXPECTED_COMMENTS_MARKDOWN = [
	'# Review Comments\n',
	'Comments on specific text selections:\n',
	'### Comment at offset 0\n',
	'> Release Plan',
	'',
	'**maya** (2026-08-11):',
	'Title reads well — keep it.',
	'',
	'---\n',
	'---\n',
	'**Total threads:** 1',
	'**Total comments:** 1'
].join('\n');

// Everything the published wrapper must forward through `bind:this`. An earlier
// build forwarded NONE of it — `bind:this` handed back an object with no
// methods — so this list is the regression guard, not decoration.
const IMPERATIVE_METHODS = [
	'clearAllThreads',
	'createBlockThread',
	'createComment',
	'createDocumentThread',
	'createThread',
	'deleteComment',
	'deleteThread',
	'exportMarkdownSummary',
	'exportUnifiedDiff',
	'focus',
	'getAst',
	'getEditor',
	'getFormData',
	'getMarkdown',
	'getSelection',
	'getState',
	'getView',
	'reset',
	'scrollToThread',
	'setMarkdown',
	'setState',
	'updateComment'
];

const namedEditor = (page: Page) => page.getByTestId('named-editor');
const bareEditor = (page: Page) => page.getByTestId('bare-editor');
// The fourth instance, which carries the orphan / anchored / document-level
// thread trio. Its five hidden inputs sit outside any form on purpose — `name`
// is what emits them, not a surrounding <form> — so they are read directly.
const orphanField = (page: Page, field: string) => page.locator(`input[name="orphan-${field}"]`);
const exportTrigger = (page: Page) =>
	namedEditor(page).getByRole('button', { name: 'Copy to clipboard' });
const exportMenu = (page: Page) => page.locator('#exports-editor-export-menu');
// The copy announcer is `cinder-sr-only` — clipped, not hidden — so it has text
// but is never visible. Assert on it through the DOM, never through a
// visible-text locator.
const copyAnnouncer = (page: Page) =>
	namedEditor(page).locator('.export-actions .cinder-sr-only[aria-live="polite"]');

/**
 * Navigate and wait until all four ReviewEditor instances have a live
 * ProseMirror view. `data-ready` is set once the view exists and no pending
 * state is queued; without it, an early click can land on markup whose editor
 * has not mounted.
 */
async function gotoReady(page: Page) {
	await gotoHydrated(page, ROUTE);
	// Four Milkdown instances mount here (~360ms locally). The generous
	// timeout is headroom for parallel-worker CPU contention, not an
	// expectation that it is ever slow.
	await expect(page.locator('[data-testid="review-editor"][data-ready="true"]')).toHaveCount(4, {
		timeout: 15000
	});
}

/**
 * Open the export menu, click one item, and return what landed on the
 * clipboard.
 *
 * The clipboard read is gated on the copy announcement rather than issued
 * straight after the click: `createCopyState.trigger()` awaits
 * `copyToClipboard(text)` and only then writes `copiedKey`, so the announcement
 * strictly follows the write. Waiting for it with an auto-retrying matcher is
 * what makes the `evaluate` below deterministic.
 */
async function copyFromExportMenu(
	page: Page,
	itemName: string | RegExp,
	announcement: string
): Promise<string> {
	await exportTrigger(page).click();
	await expect(exportMenu(page)).toBeVisible();
	await exportMenu(page).getByRole('menuitem', { name: itemName }).click();
	await expect(copyAnnouncer(page)).toHaveText(announcement);
	return page.evaluate(() => navigator.clipboard.readText());
}

async function submitAndRead(page: Page, submitTestId: string, countTestId: string) {
	const count = Number(
		(await page.getByTestId(countTestId).textContent())?.replace(/\D/g, '') ?? 0
	);
	await page.getByTestId(submitTestId).click();
	await expect(page.getByTestId(countTestId)).toHaveText(`submits: ${count + 1}`);
}

const valueOf = (locator: Locator) => locator.inputValue();

test.describe('review form participation', () => {
	let page: Page;

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		await gotoReady(page);
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('`name` emits exactly five prefixed hidden inputs, server-rendered, and nothing unprefixed', async ({
		request
	}) => {
		// Fetched as raw HTML rather than read from the hydrated page: the claim
		// is that the inputs exist in the SSR payload, so a form posted before
		// hydration still carries the review. A DOM read cannot tell the two
		// apart.
		const html = await (await request.get(ROUTE)).text();

		for (const field of REVIEW_FIELDS) {
			expect(html).toContain(`name="${field}"`);
		}
		expect(html.match(/name="review-/g)).toHaveLength(5);
		// The third editor sets `name="bare"` and the fourth `name="orphan"`, so
		// the page's full hidden-input census is 5 + 0 + 5 + 5.
		expect(html.match(/name="bare-/g)).toHaveLength(5);
		expect(html.match(/name="orphan-/g)).toHaveLength(5);
		expect(html.match(/type="hidden"/g)).toHaveLength(15);

		// PINNED KNOWN BUG. `getFieldName()` reads
		// `name ? \`${name}-${field}\` : field`, and the prop is documented as a
		// "form field name prefix" — which reads as though omitting it yields
		// bare `original` / `current` / … inputs. It does not: the whole block is
		// wrapped in `{#if name}`, so the fallback branch is dead code and an
		// editor without `name` contributes nothing to its form at all. The
		// second editor on this page proves the DOM half; this proves no bare
		// names leak into the SSR payload either.
		for (const bare of ['original', 'current', 'comments', 'diff', 'summary']) {
			expect(html).not.toContain(`name="${bare}"`);
		}
	});

	test('submitting the surrounding form yields exactly those five keys, carrying the live props', async () => {
		await submitAndRead(page, 'submit-named', 'named-submit-count');

		await expect(page.getByTestId('named-form-keys')).toHaveText(REVIEW_FIELDS.join(','));

		// `review-current` is the live `value` verbatim...
		expect(await valueOf(page.getByTestId('submitted-current'))).toBe(
			await valueOf(page.getByTestId('live-value'))
		);
		// ...and `review-comments` is `JSON.stringify(threads)` on the RUNTIME
		// array, ProseMirror positions included. That is a different shape from
		// what `getState()` persists (below), which drops `from`/`to`.
		const comments = await valueOf(page.getByTestId('submitted-comments'));
		expect(comments).toBe(await valueOf(page.getByTestId('live-threads-json')));
		const parsed = JSON.parse(comments) as Array<{ anchor: Record<string, unknown> }>;
		expect(parsed[0].anchor).toMatchObject({ from: 1, to: 13, lastKnownOffset: 0 });

		// The diff and summary are the module functions' output, unmodified.
		expect(await valueOf(page.getByTestId('submitted-diff'))).toBe(EXPECTED_DIFF);
		expect(await valueOf(page.getByTestId('submitted-summary'))).toBe(
			await valueOf(page.getByTestId('module-summary'))
		);
	});

	test('the submitted summary is structured for an LLM and drops soft-deleted comments', async () => {
		await submitAndRead(page, 'submit-named', 'named-submit-count');
		const summary = await valueOf(page.getByTestId('submitted-summary'));

		// RE-2: the anchored thread's export, pinned byte for byte rather than by
		// `toContain`, so a future change to the orphan branch cannot silently
		// alter what an anchored thread produces. The looser assertions below are
		// kept because they say what each byte MEANS — a diff on the literal alone
		// would not tell a reader which part regressed.
		expect(summary).toBe(EXPECTED_SUMMARY);

		expect(summary.startsWith('## Changes Made')).toBe(true);
		expect(summary).toContain('## Feedback');
		expect(summary).toContain('### On "Release Plan"');
		expect(summary).toContain('Title reads well — keep it.');
		// The heading shape for an ANCHORED thread carries no parenthetical. That
		// is the discriminator the orphan tests below turn on.
		expect(summary).not.toContain('(no longer in the document)');
		// The thread's second comment carries `deletedAt`. It is still in
		// `threads` (and still in the hidden `review-comments` JSON), but every
		// export filters it.
		expect(summary).not.toContain('Retracted: ignore this one.');
	});

	test('typing changes `review-current` and `review-diff` — and rewrites list markers nobody touched', async ({
		page: ownPage
	}) => {
		// Its own page: this test mutates the document, which would invalidate
		// the byte-exact fixtures every other test in the file depends on.
		await gotoReady(ownPage);
		const before = await valueOf(ownPage.getByTestId('live-value'));

		// Clicking the editor's centre lands the caret at an arbitrary offset.
		// Target the first paragraph and press End instead, so the insertion
		// point is the same on every run.
		const paragraph = namedEditor(ownPage)
			.getByRole('textbox', { name: 'Markdown editor' })
			.locator('p')
			.first();
		await paragraph.click();
		await ownPage.keyboard.press('End');
		await ownPage.keyboard.type(' ZZTOP');

		await expect(ownPage.getByTestId('live-value')).not.toHaveValue(before);
		await submitAndRead(ownPage, 'submit-named', 'named-submit-count');

		const current = await valueOf(ownPage.getByTestId('submitted-current'));
		expect(current).toBe(await valueOf(ownPage.getByTestId('live-value')));
		expect(current).toContain('inline review. ZZTOP');
		expect(await valueOf(ownPage.getByTestId('submitted-diff'))).toContain(
			'+The first release includes a dashboard, export actions, and inline review. ZZTOP'
		);

		// PINNED QUIRK, and the reason `generateUnifiedDiff` normalizes by
		// default. One keystroke re-serializes the WHOLE document through
		// Milkdown, whose Markdown serializer prefers `*` bullets and terminates
		// the file with a newline. So `review-current` comes back changed in
		// three places the reviewer never touched...
		expect(before).toContain('- Finalize the component API');
		expect(current).toContain('* Finalize the component API');
		expect(current.endsWith('\n')).toBe(true);
		// ...while `review-diff` shows none of it, because the diff normalizes
		// both sides back to `-` before comparing. The two fields disagree about
		// what the document says, and the diff is the one telling the truth.
		expect(await valueOf(ownPage.getByTestId('submitted-diff'))).toContain(
			' - Finalize the component API'
		);
	});

	test('omitting `name` emits no hidden inputs at all and contributes nothing to its form', async () => {
		await expect(page.locator('#exports-unnamed-form input[type="hidden"]')).toHaveCount(0);

		await submitAndRead(page, 'submit-unnamed', 'unnamed-submit-count');
		await expect(page.getByTestId('unnamed-form-keys')).toHaveText('');
	});

	test('without `original` the toolbar reports no changes while the form claims the whole document was added', async () => {
		// Half one: the control bar. `showDiffTabs={!!original}` hides the Diff
		// and Summary tabs, and `diffStats` short-circuits to all zeroes, so the
		// DiffStatistics group is not rendered at all.
		await expect(bareEditor(page).getByRole('tab')).toHaveText(['Editor']);
		await expect(bareEditor(page).getByRole('group', { name: /lines? changed/ })).toHaveCount(0);
		// The seeded editor, for contrast: three tabs and a live count.
		await expect(namedEditor(page).getByRole('tab')).toHaveText(['Editor', 'Diff', 'Summary']);
		await expect(namedEditor(page).getByRole('group', { name: '2 lines changed' })).toBeVisible();

		// Half two: the same instance's hidden inputs. `generateUnifiedDiff`
		// reads a missing original as an empty left-hand side, which is
		// indistinguishable from "this file is new".
		await submitAndRead(page, 'submit-bare', 'bare-submit-count');
		await expect(page.getByTestId('bare-form-keys')).toHaveText(
			'bare-original,bare-current,bare-comments,bare-diff,bare-summary'
		);
		expect(await valueOf(page.getByTestId('bare-submitted-original'))).toBe('');

		const diff = await valueOf(page.getByTestId('bare-submitted-diff'));
		// PINNED KNOWN BUG: two answers to "what changed?" from one component.
		// The toolbar says nothing; the form says every line is an addition.
		// `@@ -0,0 +…` is the git convention for an empty original side, so the
		// output is well-formed — it just contradicts the chrome next to it.
		expect(diff).toContain('@@ -0,0 +1,3 @@');
		const addedLines = diff
			.split('\n')
			.filter((line) => line.startsWith('+') && line !== '+++ b/document.md');
		const lineCount = Number(
			(await page.getByTestId('bare-line-count').textContent())?.replace(/\D/g, '')
		);
		expect(addedLines).toHaveLength(lineCount);
		expect(
			diff.split('\n').some((line) => line.startsWith('-') && line !== '--- a/document.md')
		).toBe(false);
	});
});

test.describe('the imperative surface behind bind:this', () => {
	let page: Page;

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		await gotoReady(page);
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('`bind:this` exposes the documented methods', async () => {
		const keys = (await page.getByTestId('instance-keys').textContent())?.split(',') ?? [];
		// Not an exact-list assertion: a DEV build also hangs `$destroy`, `$on`
		// and `$set` on the instance (Svelte's legacy-API stubs, which only
		// throw a "the component API changed" error), and this suite runs
		// against a production preview where those are compiled out.
		for (const method of IMPERATIVE_METHODS) {
			expect(keys).toContain(method);
		}
	});

	test('getFormData() returns the same five values the hidden inputs carry', async () => {
		await page.getByTestId('read-form-data').click();
		await expect(page.getByTestId('imperative-form-data')).not.toHaveValue('');

		const data = JSON.parse(await valueOf(page.getByTestId('imperative-form-data'))) as Record<
			string,
			string
		>;
		expect(Object.keys(data)).toEqual(['original', 'current', 'comments', 'diff', 'summary']);

		// The hidden inputs and getFormData() read the same `$derived`s, and
		// this is where that stops being a claim in the README.
		for (const [field, key] of [
			['review-original', 'original'],
			['review-current', 'current'],
			['review-comments', 'comments'],
			['review-diff', 'diff'],
			['review-summary', 'summary']
		] as const) {
			expect(data[key]).toBe(
				await page.locator(`#exports-form input[name="${field}"]`).inputValue()
			);
		}
		expect(data.diff).toBe(EXPECTED_DIFF);
	});

	test('getState() carries a `reviewSession` key that JSON.stringify silently drops', async () => {
		await page.getByTestId('read-state-keys').click();
		// The object literal always sets `reviewSession: undefined`, so the key
		// EXISTS on the returned state...
		await expect(page.getByTestId('imperative-state-keys')).toHaveText(
			'schemaVersion,content,original,threads,reviewSession,frontMatter,frontMatterRaw,updatedAt'
		);
		// ...but `JSON.stringify` omits undefined-valued keys, which is why the
		// JSON export below has seven keys and not eight. Two different answers
		// to "what shape is ReviewState?" depending on how you look at it.
	});
});

test.describe('the export menu', () => {
	let page: Page;

	test.beforeAll(async ({ browser }) => {
		// An explicit context: `test.use({ permissions })` configures the `page`
		// FIXTURE, and a describe-shared page built from `browser.newPage()`
		// would not inherit it — clipboard reads would fail on permission.
		const context = await browser.newContext({
			permissions: ['clipboard-read', 'clipboard-write']
		});
		page = await context.newPage();
		await gotoReady(page);
	});

	test.afterAll(async () => {
		await page.context().close();
	});

	test('the trigger opens a five-item menu in a fixed order', async () => {
		const trigger = exportTrigger(page);
		await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
		await expect(trigger).toHaveAttribute('aria-controls', 'exports-editor-export-menu');
		await expect(trigger).toHaveAttribute('aria-expanded', 'false');

		await trigger.click();
		// `aria-expanded` is driven off the popover's `toggle` event rather than
		// the click, so it lands a tick late — an auto-retrying matcher, not a
		// read-after-click.
		await expect(trigger).toHaveAttribute('aria-expanded', 'true');

		const menu = exportMenu(page);
		await expect(menu).toHaveAttribute('role', 'menu');
		// DOM order is Content, Summary, Git Diff, Comments, JSON — note that
		// JSON is LAST in the DOM even though the format list in the source
		// declares it third.
		await expect(menu.getByRole('menuitem')).toHaveText([
			'Content',
			'Summary (for LLM)',
			'Git Diff',
			'Comments',
			'JSON'
		]);

		// Close it again: the trigger is a toggle, and every test below opens
		// the menu from a closed state.
		await trigger.click();
		await expect(trigger).toHaveAttribute('aria-expanded', 'false');
		await expect(menu).toBeHidden();
	});

	test('Content copies the live value verbatim', async () => {
		const copied = await copyFromExportMenu(page, 'Content', 'Copied Content');
		expect(copied).toBe(await valueOf(page.getByTestId('live-value')));
	});

	test('Summary (for LLM) copies generateMarkdownSummary().markdown', async () => {
		const copied = await copyFromExportMenu(
			page,
			/^Summary \(for LLM\)/,
			'Copied Summary (for LLM)'
		);
		expect(copied).toBe(await valueOf(page.getByTestId('module-summary')));
		// RE-2 asks for the UI path and the imperative path to be asserted to
		// agree. For the summary that is three surfaces meeting on one literal:
		// the clipboard here, the `review-summary` hidden input, and
		// `getFormData().summary` — all reading the same `$derived`.
		expect(copied).toBe(EXPECTED_SUMMARY);
		expect(copied).toBe(
			await page.locator('#exports-form input[name="review-summary"]').inputValue()
		);
		expect(copied.startsWith('## Changes Made')).toBe(true);
		expect(copied).toContain('## Feedback');
		expect(copied).toContain('### On "Release Plan"');
	});

	test('Git Diff copies generateUnifiedDiff().diff', async () => {
		const copied = await copyFromExportMenu(page, /^Git Diff/, 'Copied Git Diff');
		expect(copied).toBe(EXPECTED_DIFF);
		expect(copied).toBe(await valueOf(page.getByTestId('module-diff')));
	});

	test('Comments copies generateCommentsExport().markdown', async () => {
		const copied = await copyFromExportMenu(page, /^Comments/, 'Copied Comments');
		expect(copied).toBe(EXPECTED_COMMENTS_MARKDOWN);
		expect(copied).toBe(await valueOf(page.getByTestId('module-comments-markdown')));
		// Worth stating because the two sibling exports disagree: this one opens
		// `# Review Comments`, while the empty-input path opens `# Comments`.
		expect(copied.startsWith('# Review Comments')).toBe(true);
		expect(copied.endsWith('**Total comments:** 1')).toBe(true);
	});

	test('JSON copies the whole ReviewState — not the comments-only JSON export', async () => {
		const copied = await copyFromExportMenu(page, /^JSON/, 'Copied JSON');
		const state = JSON.parse(copied) as {
			schemaVersion: number;
			original: string;
			threads: Array<{ anchor: Record<string, unknown>; comments: unknown[] }>;
			frontMatter: unknown;
			frontMatterRaw: unknown;
		};

		expect(Object.keys(state)).toEqual([
			'schemaVersion',
			'content',
			'original',
			'threads',
			'frontMatter',
			'frontMatterRaw',
			'updatedAt'
		]);
		expect(state.schemaVersion).toBe(4);
		// `reviewSession` is set to `undefined` by getState() and therefore never
		// survives serialization — see the imperative test above.
		expect(copied).not.toContain('reviewSession');
		// No front matter in this fixture, and the parser reports that as null
		// rather than as an empty object. (`review-front-matter` owns the
		// populated case.)
		expect(state.frontMatter).toBeNull();
		expect(state.frontMatterRaw).toBeNull();

		// The PERSISTED anchor shape: `from`/`to` are runtime ProseMirror
		// positions and are stripped, and undefined-valued optional fields
		// (`type`, `blockId`, `originalPosition`) vanish with them. This is a
		// different serialization of the same thread from the one the
		// `review-comments` hidden input carries.
		expect(Object.keys(state.threads[0].anchor)).toEqual([
			'quote',
			'prefix',
			'suffix',
			'status',
			'originalQuote',
			'lastKnownOffset'
		]);
		// Soft-deleted comments DO survive here — the state is an audit trail,
		// unlike the markdown exports, which filter them.
		expect(state.threads[0].comments).toHaveLength(2);

		// And the proof that this is not `generateCommentsJSON`: that export
		// produces `{ threads: [{ type, selection, … }] }` with no document
		// content at all.
		const commentsJson = await valueOf(page.getByTestId('module-comments-json'));
		expect(commentsJson).not.toBe(copied);
		expect(JSON.parse(commentsJson)).toEqual({
			threads: [
				{
					id: 'thread-release-plan-title',
					type: 'text',
					comments: [
						{
							id: 'comment-visible',
							body: 'Title reads well — keep it.',
							authorId: 'maya',
							createdAt: '2026-08-11T12:00:00.000Z'
						}
					],
					// `from`/`to` here are TEXT OFFSETS derived from
					// `lastKnownOffset` and the quote length — a third coordinate
					// space, sharing field names with the ProseMirror positions in
					// the hidden input.
					selection: { text: 'Release Plan', from: 0, to: 12 }
				}
			]
		});
	});

	test('copy confirmation announces, swaps the icon, and reverts after ~2s', async () => {
		await exportTrigger(page).click();
		await expect(exportMenu(page)).toBeVisible();
		await exportMenu(page)
			.getByRole('menuitem', { name: /^Git Diff/ })
			.click();

		// Selecting an item closes the menu (`closeOnSelect` defaults true), but
		// the popover stays in the DOM, so the confirmation state is still
		// readable — through the DOM, not through role locators, which skip
		// hidden subtrees.
		const menu = exportMenu(page);
		await expect(copyAnnouncer(page)).toHaveText('Copied Git Diff');
		await expect(menu.locator('.copied-label')).toHaveText('Copied!');
		await expect(menu.locator('svg.export-icon-success')).toHaveCount(1);

		// GOTCHA, pinned deliberately: `Copied!` is a sibling span INSIDE the
		// menu item, so for those two seconds the item's accessible name is
		// "Git Diff Copied!" and an exact-name locator stops matching it. Any
		// follow-up interaction in that window has to use a prefix match.
		// (Reopening costs ~25ms against the 2000ms window.)
		await exportTrigger(page).click();
		await expect(
			menu.getByRole('menuitem', { name: 'Git Diff Copied!', exact: true })
		).toBeVisible();
		await expect(menu.getByRole('menuitem', { name: 'Git Diff', exact: true })).toHaveCount(0);

		// After the window the label, the icon, the announcement and the
		// original accessible name all come back. Auto-retry rather than a
		// fixed sleep — the reset is a 2000ms `setTimeout` from the copy, not
		// from here.
		await expect(menu.getByRole('menuitem', { name: 'Git Diff', exact: true })).toBeVisible({
			timeout: 5000
		});
		await expect(menu.locator('.copied-label')).toHaveCount(0);
		await expect(menu.locator('svg.export-icon-success')).toHaveCount(0);
		await expect(copyAnnouncer(page)).toHaveText('');
	});
});

test.describe('the pure export functions', () => {
	let page: Page;

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		await gotoReady(page);
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('buildFormDataFromValues reproduces four of the five hidden inputs and quietly drops anchor positions from the fifth', async () => {
		await submitAndRead(page, 'submit-named', 'named-submit-count');

		for (const [moduleTestId, submittedTestId] of [
			['module-original', 'submitted-original'],
			['module-current', 'submitted-current'],
			['module-diff', 'submitted-diff'],
			['module-summary', 'submitted-summary']
		] as const) {
			expect(await valueOf(page.getByTestId(moduleTestId))).toBe(
				await valueOf(page.getByTestId(submittedTestId))
			);
		}

		// PINNED KNOWN BUG. `buildFormDataFromValues` is the documented stand-in
		// for the component's own form payload, but it rebuilds every anchor
		// field by field and never copies `from`/`to`. `buildFormData(state)`,
		// which serializes `state.threads` as-is, keeps them — so the two
		// "equivalent" helpers emit different JSON for the same threads, and
		// only one of them matches the DOM.
		const submitted = await valueOf(page.getByTestId('submitted-comments'));
		expect(await valueOf(page.getByTestId('module-comments-from-state'))).toBe(submitted);
		const fromValues = await valueOf(page.getByTestId('module-comments-from-values'));
		expect(fromValues).not.toBe(submitted);

		const [fromValuesAnchor] = (
			JSON.parse(fromValues) as Array<{ anchor: Record<string, unknown> }>
		).map((thread) => thread.anchor);
		expect(fromValuesAnchor).not.toHaveProperty('from');
		expect(fromValuesAnchor).not.toHaveProperty('to');
		// Everything else about the thread is untouched, which is what makes the
		// omission easy to miss.
		expect(JSON.parse(fromValues.replace(/"from":\d+,"to":\d+,/, ''))).toEqual(
			JSON.parse(submitted.replace(/"from":\d+,"to":\d+,/, ''))
		);
	});

	test('the review-editor export helpers are pass-throughs to @lostgradient/editor/export', async () => {
		// Two separate published entry points. `exportMarkdownSummary(state)` is
		// documented as a "stateless wrapper" around `generateMarkdownSummary`,
		// and this is where that stops being a docstring: same state in, byte
		// identical markdown out.
		expect(await valueOf(page.getByTestId('module-summary'))).toBe(
			await valueOf(page.getByTestId('core-summary'))
		);
	});

	test('getSummaryContentWithoutHeading is an identity function', async () => {
		const summary = await valueOf(page.getByTestId('module-summary'));
		// PINNED KNOWN BUG (dead code). The helper strips a leading
		// `# Review Summary` heading so UI previews can skip it — but
		// `generateMarkdownSummary` never emits that heading. Its sections start
		// at `## Changes Made`, so the regex matches nothing and the function
		// returns its input for every state that can be constructed.
		expect(summary).not.toContain('# Review Summary');
		expect(await valueOf(page.getByTestId('module-summary-without-heading'))).toBe(summary);
	});

	test('generateUnifiedDiff normalizes both sides, so a formatting-only edit produces no diff at all', async () => {
		// `- item one` vs `* item one`: the same list, two bullet characters.
		await expect(page.getByTestId('normalized-diff')).toHaveValue('');
		await expect(page.getByTestId('normalized-stats')).toHaveText(
			'additions:0 deletions:0 hunks:0'
		);

		// `normalizeInputs: false` compares the raw strings and finds the change.
		const raw = await valueOf(page.getByTestId('raw-diff'));
		expect(raw).toBe(
			[
				'--- a/document.md',
				'+++ b/document.md',
				'@@ -1,1 +1,1 @@',
				'-- item one',
				'+* item one',
				''
			].join('\n')
		);
		await expect(page.getByTestId('raw-stats')).toHaveText('additions:1 deletions:1 hunks:1');

		// PINNED DEVIATION: the hunk header spells out a count of 1
		// (`@@ -1,1 +1,1 @@`). Git omits `,1` and writes `@@ -1 +1 @@`. Both are
		// accepted by `git apply`, so this is cosmetic — but it means the output
		// is not byte-identical to what git would produce for the same change.
		expect(raw).toContain('@@ -1,1 +1,1 @@');
	});

	test('the summary now normalizes too, so the same state yields an empty diff and an empty-changes summary', async () => {
		// Same `ReviewState`, two exports, now the same answer. `generateUnifiedDiff`
		// runs both sides through the markdown pipeline before comparing;
		// `generateMarkdownSummary` used to call `computeLineDiff` on the raw
		// strings with no normalization step and no option to add one, so the diff
		// said "nothing changed" while the summary reported a modified line — for a
		// document whose only difference was which bullet character it used.
		//
		// Fixed in `@lostgradient/editor@0.11.0`: `generateMarkdownSummary` gained
		// its own `normalizeInputs` option, defaulting to `true`, routed through the
		// same shared `normalizeDocument` as `generateUnifiedDiff` (cinder#1307,
		// cinder#1318). Both exports now agree that a `-`-vs-`*` bullet is not a
		// change.
		await expect(page.getByTestId('normalized-diff')).toHaveValue('');
		const summary = await valueOf(page.getByTestId('formatting-only-summary'));
		expect(summary).toBe('No changes or feedback to report.');
		expect(summary).not.toContain('## Changes Made');
		await expect(page.getByTestId('formatting-only-summary-stats')).toHaveText(
			'changeCount:0 threadCount:0'
		);
		// And no Feedback section, because the state carries no threads — the two
		// sections are independent.
		expect(summary).not.toContain('## Feedback');
	});

	test('the comments export falls through three location formats and two headings', async () => {
		// `originalPosition` wins when present, and adds a `*Position: …*` line.
		const withPosition = await valueOf(page.getByTestId('location-position'));
		expect(withPosition).toContain('### Comment at Line 3:1');
		expect(withPosition).toContain('*Position: Line 3, Column 1 (offset 4)*');

		// Without it, the textBetween offset is the next-best address...
		expect(await valueOf(page.getByTestId('location-offset'))).toContain('### Comment at offset 4');
		// ...and with neither, the comment is printed with no location at all
		// rather than being dropped.
		expect(await valueOf(page.getByTestId('location-unknown'))).toContain(
			'### Comment (location unknown)'
		);

		// `formatTimestamp` calls `toISOString()` on an Invalid Date, which
		// throws, and swallows it — so an unparseable `createdAt` costs the
		// parenthetical, not the comment.
		const unparseable = await valueOf(page.getByTestId('unparseable-timestamp'));
		expect(unparseable).toContain('**maya**:');
		expect(unparseable).not.toContain('(');

		// The empty path uses a DIFFERENT top-level heading from the populated
		// one (`# Comments` vs `# Review Comments`) — a real inconsistency, not
		// a typo in this test.
		expect(await valueOf(page.getByTestId('empty-comments-export'))).toBe(
			'# Comments\n\nNo comments to export.'
		);
		// A thread whose every comment is soft-deleted is filtered before the
		// heading is chosen, so it takes the empty path even though
		// `state.threads` is non-empty.
		expect(await valueOf(page.getByTestId('all-soft-deleted-export'))).toBe(
			'# Comments\n\nNo comments to export.'
		);
	});
});

// ROADMAP RE-2. Everything above asserts that the diff LOOKS right — byte-exact
// literals, hunk headers, `+`/`-` line counts. That is exactly the standard the
// front-matter corruption cleared before it was fixed: correct `---`/`+++`
// headers over content that existed in neither document. The only assertion that
// actually settles "is this a patch?" is git's, so these tests hand the string
// to `git apply` in a throwaway repo.
//
// This is the no-front-matter half of the criterion; `review-front-matter` owns
// the other half against a YAML document, and both import the same helper.
test.describe('the exported diff is a patch git will apply', () => {
	let page: Page;

	test.beforeAll(async ({ browser }) => {
		// An explicit permissioned context, for the same reason the export-menu
		// describe needs one: `test.use({ permissions })` configures the `page`
		// FIXTURE, and a describe-shared page from `browser.newPage()` would not
		// inherit it, so the clipboard read below would fail on permission.
		const context = await browser.newContext({
			permissions: ['clipboard-read', 'clipboard-write']
		});
		page = await context.newPage();
		await gotoReady(page);
	});

	test.afterAll(async () => {
		await page.context().close();
	});

	test('all three export surfaces ship one string, and git applies it to the original', async () => {
		// The three surfaces RE-2 names, read in the order a consumer would meet
		// them: the hidden input a form POSTs, the imperative `getFormData()`, and
		// the export menu. All three read the same `$derived` in
		// `review-editor-impl.svelte`, which is a claim about the implementation —
		// this is where it becomes an observation.
		//
		// The criterion calls the menu item "Copy Diff". There is no such label:
		// it is "Git Diff", behind a trigger whose accessible name is "Copy to
		// clipboard". Correcting the wording rather than inventing a selector.
		const hidden = await page.locator('#exports-form input[name="review-diff"]').inputValue();

		await page.getByTestId('read-form-data').click();
		await expect(page.getByTestId('imperative-form-data')).not.toHaveValue('');
		const imperative = (
			JSON.parse(await valueOf(page.getByTestId('imperative-form-data'))) as Record<string, string>
		).diff;

		const copied = await copyFromExportMenu(page, /^Git Diff/, 'Copied Git Diff');

		expect(hidden).toBe(EXPECTED_DIFF);
		expect(imperative).toBe(EXPECTED_DIFF);
		expect(copied).toBe(EXPECTED_DIFF);

		// The document written to disk is the one the COMPONENT is holding, read
		// back out of its own hidden input rather than retyped from the fixture —
		// so an edit to `+page.svelte` cannot leave the patch and the file it is
		// applied to describing different documents.
		const original = await page.locator('#exports-form input[name="review-original"]').inputValue();
		const current = await page.locator('#exports-form input[name="review-current"]').inputValue();

		// Stated rather than assumed, because the next assertion adds a byte the
		// component never emitted: at rest the current document has no trailing
		// newline, and `applyPatchInTempRepo` writes the seed file with one
		// because `normalizeInputs: true` makes the patch describe both sides as
		// newline-terminated.
		expect(current.endsWith('\n')).toBe(false);

		// `--check` runs inside the helper; this compares the APPLIED BYTES, which
		// is strictly stronger. Measured while building this: `git apply` searches
		// for a hunk's context instead of trusting its start line, so a patch with
		// a wrong `@@` start still passes `--check`. Only the result catches it.
		expect(applyPatchInTempRepo(original, hidden)).toBe(`${current}\n`);
	});

	test('the appliability check is itself capable of failing', async () => {
		// A control for the harness, not for the component. An appliability
		// assertion is worth nothing unless a bad patch actually reddens it, and
		// two of these three are the exact failure shapes RE-2 was written about.
		const original = await page.locator('#exports-form input[name="review-original"]').inputValue();

		// One: a hunk header that lies about its own line counts. This is the
		// front-matter corruption's signature — a patch that looks entirely
		// well-formed to a reader and to `hunkCounts()`-style structural checks.
		expect(() =>
			applyPatchInTempRepo(original, EXPECTED_DIFF.replace('@@ -1,8 +1,9 @@', '@@ -1,9 +1,9 @@'))
		).toThrow(/corrupt patch/);

		// Two: an edited context line, i.e. a patch describing a document that is
		// not the one on disk.
		expect(() =>
			applyPatchInTempRepo(original, EXPECTED_DIFF.replace(' ## Checklist', ' ## CHECKLIST'))
		).toThrow(/patch failed/);

		// Three: the empty string, which is what `generateUnifiedDiff` returns for
		// two documents that normalize identically. `git apply` answers "No valid
		// patches in input"; the helper refuses first, so the fixture error reads
		// as a fixture error.
		expect(() => applyPatchInTempRepo(original, '')).toThrow(/empty patch/);

		// UNFALSIFIABLE BY COMPONENT CODE, and kept deliberately: this pins GIT's
		// behavior, not the editor's. A hunk header claiming line 4 for a hunk
		// that starts at line 1 is ACCEPTED, and produces the identical result,
		// because git searches for the context. It is the measurement that
		// justifies comparing applied bytes above instead of trusting `--check`,
		// and without it a reader would reasonably assume `--check` pins the
		// header.
		const shifted = EXPECTED_DIFF.replace('@@ -1,8 +1,9 @@', '@@ -4,8 +4,9 @@');
		expect(applyPatchInTempRepo(original, shifted)).toBe(
			applyPatchInTempRepo(original, EXPECTED_DIFF)
		);
	});

	test('a patch produced AFTER a real edit still applies — to the canonical document, not the editor bytes', async ({
		page: ownPage
	}) => {
		// Its own page: this types into the shared fixture.
		//
		// The at-rest test above proves the export is appliable for a document
		// nobody has touched. That is the easy case: both sides are already
		// canonical Markdown, so normalization is the identity. The moment anyone
		// types, Milkdown re-serializes the WHOLE document — `-` bullets become
		// `*`, a trailing newline appears — and the question becomes whether the
		// patch still describes the file a consumer has on disk. It does, and the
		// mechanism is the normalization the diff applies to both sides.
		await gotoReady(ownPage);
		const paragraph = namedEditor(ownPage)
			.getByRole('textbox', { name: 'Markdown editor' })
			.locator('p')
			.first();
		await paragraph.click();
		await ownPage.keyboard.press('End');
		await ownPage.keyboard.type(' ZZTOP');
		await expect(ownPage.getByTestId('live-value')).toHaveValue(/ZZTOP/);

		await submitAndRead(ownPage, 'submit-named', 'named-submit-count');
		const original = await valueOf(ownPage.getByTestId('submitted-original'));
		const current = await valueOf(ownPage.getByTestId('submitted-current'));
		const diff = await valueOf(ownPage.getByTestId('submitted-diff'));

		const applied = applyPatchInTempRepo(original, diff);
		expect(applied).toContain('inline review. ZZTOP');

		// And the part worth knowing before you ship this patch anywhere: applying
		// it does NOT reproduce the document the editor is holding. The editor's
		// `value` has `*` bullets; the patch normalizes them back to `-`, so the
		// file on disk afterwards is the CANONICAL form of the review, not the
		// component's serialization of it. Neither is wrong, but a consumer
		// round-tripping value → patch → disk → value will see their bullets flip.
		expect(applied).not.toBe(current);
		// Stated as a census rather than as one example, so "the bullets flip" is
		// a measurement instead of an impression: the editor's serialization has
		// three `*` list items and the applied file has none.
		const bulletsIn = (document: string, marker: string) =>
			document.split('\n').filter((line) => line.startsWith(marker)).length;
		expect(bulletsIn(current, '* ')).toBe(3);
		expect(bulletsIn(current, '- ')).toBe(0);
		expect(bulletsIn(applied, '* ')).toBe(0);
		expect(bulletsIn(applied, '- ')).toBe(3);
	});
});

// ROADMAP RE-2, the summary half: orphaned threads must be labelled as no longer
// in the document, and the export must not print a coordinate it does not have.
test.describe('exportMarkdownSummary and the three thread heading shapes', () => {
	let page: Page;

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		await gotoReady(page);
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('at rest all three threads are anchored and the summary is a Feedback section with no digit in it', async () => {
		// Asserted first so the post-deletion test below is a real TRANSITION
		// rather than a reading of a state that was seeded that way. Nothing on
		// this page seeds `status: 'orphaned'`.
		await expect(page.getByTestId('orphan-thread-statuses')).toHaveText(
			'thread-heading:anchored,thread-rollout:anchored,thread-whole-document:anchored'
		);
		await expect(page.getByTestId('orphan-thread-count')).toHaveText('threads: 3');

		const summary = await orphanField(page, 'summary').inputValue();
		expect(summary).toBe(EXPECTED_ORPHAN_SUMMARY_AT_REST);
		// The component's own export and the module function fed the same live
		// props, byte identical.
		expect(summary).toBe(await valueOf(page.getByTestId('orphan-module-summary')));

		// "Never prints a coordinate it does not have", at its strongest: with
		// `original === value` there is no `## Changes Made` section, and the
		// Feedback section that remains contains no digit at all. No anchor
		// position, no text offset, no line number — just quotes and bodies.
		expect(summary).not.toMatch(/\d/);
		expect(summary).not.toContain('## Changes Made');

		// `threadCount` counts every visible thread including the document-level
		// one, which is what makes "3" here rather than "2".
		await expect(page.getByTestId('orphan-module-stats')).toHaveText('changeCount:0 threadCount:3');
	});

	test('an unedited document exports the empty string, which is not a patch', async () => {
		// The fixture's `original` equals its `value`, so `generateUnifiedDiff`
		// short-circuits to `''` — not to a zero-hunk patch. Worth pinning as
		// component behavior AND as the justification for the helper's guard:
		// `git apply` answers "No valid patches in input" for empty stdin, which
		// would read as an appliability failure rather than as "there was nothing
		// to apply".
		const diff = await orphanField(page, 'diff').inputValue();
		expect(diff).toBe('');
		const original = await orphanField(page, 'original').inputValue();
		expect(() => applyPatchInTempRepo(original, diff)).toThrow(/empty patch/);
	});

	test('deleting the anchored text relabels that thread and leaves the other two alone', async ({
		page: ownPage
	}) => {
		// Its own page: this edits the document.
		//
		// The orphan is PRODUCED rather than seeded. Deleting the exact
		// ProseMirror range the anchor covers is the path a reviewer takes when
		// they act on a comment, and it is the only way to prove `anchor.status`
		// survives the component's own persistence round-trip
		// (`getState()` → `toPersistedThreads`) into the export. A hand-written
		// `status: 'orphaned'` in the fixture would prove only that the export
		// function reads the field.
		await gotoReady(ownPage);
		await ownPage.getByTestId('orphan-delete').click();

		// The re-anchoring pass is debounced ~300ms and writes the new status back
		// into the bindable array. Waiting on THAT — an auto-retrying read of a
		// value the page already renders — rather than on a sleep sized to the
		// debounce.
		await expect(ownPage.getByTestId('orphan-thread-statuses')).toHaveText(
			'thread-heading:anchored,thread-rollout:orphaned,thread-whole-document:anchored'
		);
		// Orphaning is not deletion: the thread stays in the array and the comment
		// survives.
		await expect(ownPage.getByTestId('orphan-thread-count')).toHaveText('threads: 3');

		// And wait for the EDITED TEXT to reach the page as well, which is a
		// separate settle from the one above and arrives later.
		//
		// The summary `$derived` reads both `orphanThreads` and `orphanValue`. The
		// statuses settle on the re-anchoring pass; `orphanValue` settles on the
		// editor's own change propagation, which is two stacked TRAILING debounces
		// — Milkdown's listener plugin at 200ms, then the editor wrapper's
		// `onchange` at a further 300ms. So the statuses can read `orphaned` while
		// `content` is still the original text, and a summary read in that window
		// legitimately has no `## Changes Made` section: there is nothing to diff
		// yet.
		//
		// That is exactly how this test failed — asserting `## Changes Made`
		// against a state whose content had not moved. Verified by feeding the
		// post-delete document to `generateMarkdownSummary` directly, which emits
		// the section and `### Lines 1-5`, so the export is not at fault.
		//
		// Waiting on the rendered value, not on a duration: the readout is the
		// condition, and a slower machine takes longer rather than passing wrongly.
		await expect(ownPage.getByTestId('orphan-live-value')).not.toHaveValue(
			/The beta rollout ships/
		);

		// The hidden input is a `$derived` of the same threads array, so it has
		// already settled by the time the status line above reads `orphaned`.
		// Polled anyway rather than read once: the two are updated by the same
		// flush, and depending on that ordering is the kind of assumption that
		// only fails under load.
		await expect
			.poll(() => orphanField(ownPage, 'summary').inputValue())
			.toContain('(no longer in the document)');
		const summary = await orphanField(ownPage, 'summary').inputValue();

		// The three heading shapes, side by side in one export. Only the first
		// carries the parenthetical, and it is the only anchor whose quote is gone.
		expect(summary).toContain('### On "beta rollout" (no longer in the document)');
		expect(summary).toContain('### On "Beta Notes"');
		expect(summary).not.toContain('### On "Beta Notes" (no longer in the document)');
		expect(summary).toContain('### Document-level feedback');
		// The document-level thread is NOT labelled as orphaned, which is the
		// confusion this trio exists to rule out: "no quote" and "quote is gone"
		// are different states with different headings.
		expect(summary).not.toContain('### Document-level feedback (no longer in the document)');
		// Every comment survives the orphaning.
		expect(summary).toContain('> Which teams, exactly?');
		expect(summary).toContain('> Heading reads fine.');
		expect(summary).toContain('> Overall: ready to ship.');

		// Component and module still agree after a real edit.
		expect(summary).toBe(await valueOf(ownPage.getByTestId('orphan-module-summary')));

		// The coordinate assertion, now scoped: the deletion gave the document a
		// `## Changes Made` section, and THAT section legitimately prints
		// `### Lines a-b` computed from the line diff. The Feedback section still
		// prints no number of any kind — least of all the stale offset the
		// orphaned anchor is still carrying internally.
		expect(summary).toContain('## Changes Made');
		expect(summary).toMatch(/### Lines \d+-\d+/);
		const feedback = summary.slice(summary.indexOf('## Feedback'));
		expect(feedback).not.toMatch(/\d/);
		expect(feedback).not.toMatch(/offset|position|column/i);
	});
});

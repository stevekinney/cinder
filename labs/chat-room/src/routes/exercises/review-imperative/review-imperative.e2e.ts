import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { deleteComment, timestamp, type Thread } from '@lostgradient/editor/comments';
import { gotoHydrated } from '../hydration';

// ROADMAP RE-1: the eight thread and comment mutation methods on ReviewEditor's
// imperative surface, driven through `bind:this`.
//
// Two things this suite pins that are easy to get wrong by reading the types:
//
//  1. These methods are REQUESTS, not mutations. Each fires a callback and
//     changes nothing itself; `threads` only moves because the page owns a
//     reducer. A test that asserted only the return value would pass against a
//     component that never notified anyone.
//  2. `createThread` gates on `currentSelection` — a private `$state` fed by the
//     inner MarkdownEditor's `onselectionchange` — and NOT on the view-derived
//     `getSelection()`. Those two agree only as of
//     `@lostgradient/editor@0.9.1`. Before it, the listener re-read `view.state`
//     from inside `EditorState.apply`, so `currentSelection` lagged the live
//     selection by exactly one selection-changing transaction: a single
//     dispatch returned null, and a mouse drag silently anchored short of what
//     was highlighted. That was cinder#1288, fixed by cinder#1289. Both halves
//     are pinned below against the FIXED contract — one dispatch is now enough,
//     and a native drag anchors exactly the range it covered — so both go red
//     against 0.9.0.

// ROADMAP RE-3 and RE-4 live in the last two describe blocks, against two
// FURTHER instances on the same route — `#imperative-content` for `setMarkdown`,
// `reset`, `getMarkdown` and `getAst`, `#imperative-tall` for `scrollToThread`
// and `getEditor`. The page's header comment explains why they are separate
// instances rather than more buttons on the two above.
//
// RE-4's `scrollToThread` bugs (cinder#1316, cinder#1317) are FIXED and
// VERIFIED as of `@lostgradient/editor@0.11.0`, and the two tests below are
// retargeted against the fixed contract: `scrollToThread` now reaches the
// same anchor `scroll-into-view-control` already reached, and an unknown
// thread id throws rather than returning silently indistinguishable from a
// successful call. (Focus still does not move either way, which is unchanged
// and not one of the two bugs that were fixed.)
//
// That same 0.11.0 bump introduced a NEW regression in RE-3's `reset()`:
// once `setMarkdown` had been called on an editor instance, a later `reset()`
// no longer reached the live document. Filed as stevekinney/cinder#1328,
// FIXED and VERIFIED as of `@lostgradient/editor@0.12.0` — the two tests in
// the content-replacement block below are retargeted against the fixed
// contract. See those tests themselves for the mechanism.

const ROUTE = '/exercises/review-imperative';

const AUTHOR = 'author-1';
const PARAGRAPH_THREE = 'Timeline risk: the migration script is untested.';

// Restated from the page rather than imported, the same way `PARAGRAPH_THREE`
// above is: a `.svelte` module cannot export a constant to a spec, and a shared
// constants module would let the fixture and the expectation drift together —
// the spec would keep passing while the document it describes changed.
const CONTENT_HEADING = 'Content Replacement Fixture';
const CONTENT_ORIGINAL_HEADING = 'Content Baseline';
const CONTENT_REPLACEMENT =
	'### Content Replacement Fixture\n\n' +
	'A late addition pushes the rest of the document down.\n\n' +
	'The rollout plan names a dashboard owner and a migration owner.\n\n' +
	'The deployment window is now agreed.';
const SURVIVING_QUOTE = 'dashboard owner';
const REMOVED_QUOTE = 'rollback checklist';
const TALL_QUOTE = 'migration script';
const TALL_ORPHAN_ID = 'tall-orphan-1';

type AnchorRow = {
	id: string;
	type: string;
	/** What the component actually reported, before the page's `?? 'text'`. */
	rawType: string | null;
	/** The component's real block marker — see the block-thread test. */
	blockId: string | null;
	quote: string;
	from: number | null;
	to: number | null;
	lastKnownOffset: number | null;
	status: string | null;
	comments: number;
};

async function anchors(page: Page): Promise<AnchorRow[]> {
	return JSON.parse((await page.getByTestId('anchors-json').textContent()) ?? '[]');
}

/** The independent textBetween derivation, taken from ProseMirror by the page. */
async function probe(page: Page): Promise<(number | null)[]> {
	return JSON.parse((await page.getByTestId('probe-json').textContent()) ?? '[]');
}

async function events(page: Page): Promise<string[]> {
	const raw = (await page.getByTestId('events').textContent()) ?? '';
	return raw.length ? raw.split('|') : [];
}

const threadCount = (page: Page) => page.getByTestId('thread-count');
const lastReturn = (page: Page) => page.getByTestId('last-return');

/**
 * Read a readout that the page renders across several template lines.
 *
 * `textContent()` is raw, so those carry the surrounding newlines and tabs while
 * the single-line readouts above do not. `JSON.parse` tolerates that; a bare
 * string comparison does not, which is the one that silently fails.
 */
async function readoutText(page: Page, testId: string): Promise<string> {
	return ((await page.getByTestId(testId).textContent()) ?? '').trim();
}

async function contentAnchors(page: Page): Promise<AnchorRow[]> {
	return JSON.parse(await readoutText(page, 'content-anchors-json'));
}

async function tallAnchors(page: Page): Promise<AnchorRow[]> {
	return JSON.parse(await readoutText(page, 'tall-anchors-json'));
}

async function contentEvents(page: Page): Promise<string[]> {
	const raw = await readoutText(page, 'content-events');
	return raw.length ? raw.split('|') : [];
}

type MarkdownReport = {
	fromGetMarkdown: string;
	valueProp: string;
	getMarkdownLength: number;
	valuePropLength: number;
};

async function contentMarkdown(page: Page): Promise<MarkdownReport> {
	return JSON.parse(await readoutText(page, 'content-markdown-json'));
}

type AstRow = { type: string; depth: number | null; text: string };

/**
 * Click `getAst` and return its projection, retrying until the pipeline answers.
 *
 * `getAst` throws `Markdown pipeline is not ready yet.` until a dynamic
 * `import('@lostgradient/markdown/pipeline')` resolves, and that import lives in
 * an effect SEPARATE from editor creation — so `data-ready`, which the
 * `beforeEach` gate waits on, does not cover it.
 *
 * Polled by RE-ASKING rather than by sleeping: the observable condition is "the
 * pipeline answered", and the only way to observe it is another call. The
 * `dragSelectFirstParagraph` helper above uses the same shape for the same
 * reason.
 */
async function readAst(page: Page): Promise<AstRow[]> {
	await expect
		.poll(async () => {
			await page.getByTestId('content-get-ast').click();
			return readoutText(page, 'content-ast-error');
		})
		.toBe('');
	return JSON.parse(await readoutText(page, 'content-ast-json'));
}

/**
 * The rendered block structure of the content editor, projected into the same
 * shape `getAst` reports.
 *
 * Filtered to headings and paragraphs because those are the only node types this
 * fixture contains — comparing against every child would fail on any decoration
 * widget ProseMirror chose to render, which is not what this asserts.
 */
async function renderedBlocks(page: Page): Promise<AstRow[]> {
	return page
		.locator('#imperative-content .ProseMirror > :is(h1,h2,h3,h4,h5,h6,p)')
		.evaluateAll((nodes) =>
			nodes.map((node) => {
				const tag = node.tagName.toLowerCase();
				return {
					type: tag === 'p' ? 'paragraph' : 'heading',
					depth: tag === 'p' ? null : Number(tag.slice(1)),
					text: node.textContent ?? ''
				};
			})
		);
}

async function probeUndoDepth(page: Page, expectedProbe: number): Promise<number> {
	await page.getByTestId('content-probe-undo').click();
	// The probe counter, not the depth: the depth before and after a reset can
	// legitimately be the same number, so polling on it could not tell a fresh
	// answer from a stale render.
	await expect
		.poll(async () => JSON.parse(await readoutText(page, 'content-undo-json')).probe)
		.toBe(expectedProbe);
	return JSON.parse(await readoutText(page, 'content-undo-json')).depth;
}

type ScrollSample = {
	winY: number;
	domTop: number;
	scrollerTop: number;
	anchorTop: number | null;
	viewportHeight: number;
	active: string;
};

type ScrollReport = {
	threadId: string;
	before: ScrollSample;
	after: ScrollSample;
	moved: boolean;
	threw: string | null;
	returned: string;
	calls: number;
	lastCallArgument: string | null;
};

async function scrollReport(page: Page): Promise<ScrollReport> {
	return JSON.parse(await readoutText(page, 'scroll-json'));
}

type EditorIdentity = {
	present: boolean;
	status: string | null;
	stableAcrossCalls: boolean;
	distinctFromOtherInstance: boolean;
	actionCtxIsEditorCtx: boolean | null;
	actionThrew: string | null;
	viewDocSize: number | null;
	otherViewDocSize: number | null;
};

async function editorIdentity(page: Page): Promise<EditorIdentity> {
	return JSON.parse(await readoutText(page, 'editor-identity-json'));
}

/**
 * Press a control by keyboard rather than clicking it.
 *
 * Every RE-4 assertion reads `document.activeElement` back out of the page, and
 * macOS WebKit — which this spec runs in, per `CROSS_ENGINE` in
 * `playwright.config.ts` — does not focus a `<button>` on click. A `.click()`
 * there leaves focus on `<body>` for reasons that have nothing to do with the
 * component, and "focus did not move" would be unfalsifiable in one of the three
 * engines.
 */
async function pressControl(page: Page, testId: string): Promise<void> {
	const control = page.getByTestId(testId);
	await control.focus();
	await control.press('Enter');
}

/** Seed the RE-3 instance with the surviving thread and the doomed one. */
async function seedContent(page: Page): Promise<AnchorRow[]> {
	await pressControl(page, 'content-seed');
	await expect(page.getByTestId('content-thread-count')).toHaveText('content threads: 2');
	return contentAnchors(page);
}

/** Seed the RE-4 instance's anchored thread and return its id. */
async function seedTall(page: Page): Promise<string> {
	await pressControl(page, 'tall-seed');
	await expect(page.getByTestId('tall-thread-count')).toHaveText('scroll threads: 2');

	const anchored = (await tallAnchors(page)).find((row) => row.id !== TALL_ORPHAN_ID)!;
	// The page's hand-derived positions, asserted here rather than taken on trust.
	// The selection that produced this thread was made at literal ProseMirror
	// coordinates; if that arithmetic is wrong the selection covers different
	// text, the thread anchors it, and every measurement below is of the wrong
	// anchor while still looking self-consistent.
	expect(anchored.quote).toBe(TALL_QUOTE);
	expect(anchored.from).toBe(1493);
	expect(anchored.to).toBe(1509);
	expect(anchored.status).toBe('anchored');
	// The thread arrived through the component's own notification rather than
	// being pushed into the array by the page, which is what makes it a real
	// anchor for `scrollToThread` to resolve rather than a fixture object.
	await expect(page.getByTestId('tall-events')).toHaveText(`onthreadcreate:${anchored.id}`);
	return anchored.id;
}

/**
 * Select the first paragraph with a real mouse drag.
 *
 * This used to be a workaround: a drag emits MANY selection transactions, which
 * was the only way past the one-transaction lag cinder#1288 described, and its
 * docblock said the helper should disappear once the fix shipped. It has shipped
 * (`@lostgradient/editor@0.9.1`), and the shared `createAnchored` below no longer
 * drags — it takes the deterministic `getView()` path, so the rest of the suite
 * stops paying bounding-box arithmetic for nothing.
 *
 * The helper survives for ONE caller, deliberately and against its own former
 * advice: `the anchor covers exactly the text a native drag highlighted` is the
 * only test here that exercises Milkdown's real pointer-driven selection
 * pipeline, and the native path is where #1288's severity was worst — it did not
 * merely refuse, it anchored text nobody selected. Deleting the last native
 * assertion because the bug that motivated it was fixed is how the regression
 * comes back unnoticed.
 */
async function dragSelectFirstParagraph(page: Page): Promise<void> {
	const paragraph = page.locator('#imperative-editor .ProseMirror p').first();
	await paragraph.scrollIntoViewIfNeeded();
	const box = await paragraph.boundingBox();
	expect(box).not.toBeNull();
	const y = box!.y + box!.height / 2;
	await page.mouse.move(box!.x + 2, y);
	await page.mouse.down();
	for (let step = 1; step <= 8; step += 1) {
		await page.mouse.move(box!.x + 2 + ((box!.width - 4) * step) / 8, y);
	}
	await page.mouse.up();
	// Polls the view-derived `getSelection()` readout — which is what is
	// observable from here — rather than `currentSelection`, which is private.
	await expect
		.poll(async () => {
			await page.getByTestId('read-selection').click();
			const raw = (await page.getByTestId('selection-json').textContent()) ?? 'null';
			return JSON.parse(raw)?.viaGetSelection?.isCollapsed;
		})
		.toBe(false);
}

/**
 * Put a known, exact selection in the editable view through the public
 * `getView()` — the path `CLAUDE.md`'s `bind:this` guidance implies — and wait
 * until the component reports it.
 *
 * ONE selection-changing dispatch, which is precisely what cinder#1288 made
 * insufficient and cinder#1289 made sufficient.
 */
async function selectQuote(page: Page): Promise<{ from: number; to: number }> {
	await page.getByTestId('select-quote').click();
	await expect
		.poll(async () => {
			const raw = (await page.getByTestId('selection-json').textContent()) ?? 'null';
			return JSON.parse(raw)?.viaGetSelection?.isCollapsed;
		})
		.toBe(false);
	return JSON.parse((await page.getByTestId('selection-json').textContent()) ?? 'null').view;
}

/**
 * Create one anchored thread through the imperative surface, and return its id.
 *
 * `create-thread-nodomselect` rather than `create-thread`: it takes whatever is
 * already selected instead of selecting for itself, which is the plain consumer
 * path AND the button that records `selection-at-call` for the equality test.
 */
async function createAnchored(page: Page): Promise<string> {
	await selectQuote(page);
	await page.getByTestId('create-thread-nodomselect').click();
	await expect(threadCount(page)).toHaveText('threads: 1');
	return (await anchors(page))[0].id;
}

test.beforeEach(async ({ page }) => {
	await gotoHydrated(page, ROUTE);
	// Matching the `ready()` gate every other review-* spec uses. Without it this
	// file failed 3 of 8 repeats with `Cannot read properties of null` on the
	// selection readout, and 7 of 55 across the suite — a racy setup that reads as
	// a component bug. All FOUR editors must be up — the two RE-1 instances plus
	// the RE-3 and RE-4 ones — so the count is 4.
	await expect(page.locator('[data-testid="review-editor"][data-ready="true"]')).toHaveCount(4);
	await expect(page.locator('#imperative-editor .ProseMirror')).toBeVisible();
	await expect(page.locator('#imperative-readonly .ProseMirror')).toBeVisible();
	await expect(page.locator('#imperative-content .ProseMirror')).toBeVisible();
	await expect(page.locator('#imperative-tall .ProseMirror')).toBeVisible();
	await expect(threadCount(page)).toHaveText('threads: 0');
});

test.describe('review-imperative: creation', () => {
	test('createThread anchors the selection, and both coordinate spaces agree', async ({ page }) => {
		const id = await createAnchored(page);

		const [row] = await anchors(page);
		expect(row.id).toBe(id);
		expect(row.type).toBe('text');
		expect(row.status).toBe('anchored');
		expect(row.comments).toBe(1);

		// EXACT, not merely self-consistent. The page's fixture comment derives
		// these by hand — 'dashboard' sits at index 29 of paragraph one, whose
		// ProseMirror content starts at 15 and whose textBetween run starts at 13 —
		// so 44/53 and 42 are three independent arithmetic claims about one
		// selection, not three readouts of the same number. Asserting them became
		// possible only once a single dispatch was enough to anchor at all; the
		// drag this used to take could not name its own range.
		expect(row.quote).toBe('dashboard');
		expect(row.from).toBe(44);
		expect(row.to).toBe(53);
		expect(row.lastKnownOffset).toBe(42);

		// The other half of the block-thread distinction: a text anchor carries no
		// `blockId`. Asserted here rather than only there, so the pair cannot both
		// drift to the same value and keep passing.
		expect(row.rawType).toBeNull();
		expect(row.blockId).toBeNull();

		// COORDINATE SPACE 1 — the rendered decoration. The `.comment-anchor` span
		// must cover exactly the quoted text, not merely overlap it.
		const decoration = page.locator('#imperative-editor .ProseMirror span.comment-anchor');
		await expect(decoration).toHaveCount(1);
		expect((await decoration.textContent()) ?? '').toBe(row.quote);

		// COORDINATE SPACE 2 — `lastKnownOffset` is a doc.textBetween() offset, NOT
		// a ProseMirror position, and the two are different numbers for the same
		// selection. `probe-json` is derived straight from ProseMirror rather than
		// from the component's offset helper — but it is fed the component's own
		// `anchor.from`, so it is independent of the HELPER and not of the anchor.
		// It catches a coordinate-space mixup between two fields of one anchor. It
		// cannot catch an anchor that describes the wrong text, which is exactly
		// why the next test has to exist.
		const [offset] = await probe(page);
		expect(row.lastKnownOffset).toBe(offset);
		expect(row.from).not.toBe(row.lastKnownOffset);
		expect(row.from).toBeGreaterThan(row.lastKnownOffset!);

		expect(await events(page)).toEqual([`onthreadcreate:${id}`]);
	});

	test('the anchor covers exactly the text a native drag highlighted', async ({ page }) => {
		// The native path, kept deliberately — see `dragSelectFirstParagraph`. This
		// is the assertion the coordinate-space test is NAMED for and cannot make:
		// both of that test's comparisons take the anchor as their input (the
		// rendered span against the anchor's own quote, `lastKnownOffset` against a
		// probe derived from the anchor's own `from`), so they hold perfectly while
		// the anchor describes text nobody selected. Only comparing against the
		// selection captured at call time can catch that.
		//
		// REGRESSION PIN for cinder#1288. Against `@lostgradient/editor@0.9.0` this
		// drag selected 15..89 and anchored 15..86 — a silent, wrong-text anchor, the
		// worst of that bug's three symptoms. Equality is the fixed contract.
		await dragSelectFirstParagraph(page);
		await page.getByTestId('create-thread-nodomselect').click();
		await expect(threadCount(page)).toHaveText('threads: 1');

		const [row] = await anchors(page);
		const selected = JSON.parse(
			(await page.getByTestId('selection-at-call').textContent()) ?? '{}'
		);

		expect(row.from).toBe(selected.from);
		expect(row.to).toBe(selected.to);

		// And the consequence, stated in the terms a user would notice: the quote is
		// the whole highlighted paragraph, not a prefix of it.
		const paragraph =
			(await page.locator('#imperative-editor .ProseMirror p').first().textContent()) ?? '';
		expect(row.quote).toBe(paragraph);
	});

	test('a single programmatic selection through getView() is enough to anchor', async ({
		page
	}) => {
		// The page selects through the public `getView()` — the path CLAUDE.md's
		// `bind:this` guidance implies — with exactly ONE selection-changing
		// transaction.
		const view = await selectQuote(page);
		expect(view).toEqual({ from: 44, to: 53 });

		await page.getByTestId('create-thread').click();

		// REGRESSION PIN for cinder#1288, the other half. Against 0.9.0 this was a
		// silent null with no thread and no callback: one dispatch left
		// `currentSelection` holding the previous collapsed caret, so the selection
		// guard refused, and `select-quote` + `create-thread` dispatching the same
		// range meant Milkdown suppressed the duplicate and no second notification
		// ever arrived to unstick it. Now the listener is handed the live selection,
		// so one dispatch anchors — at the exact range, which is what separates this
		// from "it returned something".
		await expect(threadCount(page)).toHaveText('threads: 1');
		const [row] = await anchors(page);
		await expect(lastReturn(page)).toHaveText(`last return: ${row.id}`);
		expect(row.from).toBe(44);
		expect(row.to).toBe(53);
		expect(row.quote).toBe('dashboard');
		expect(await events(page)).toEqual([`onthreadcreate:${row.id}`]);
	});

	test('createDocumentThread is document-typed, quoteless, and sorts ahead of anchored threads', async ({
		page
	}) => {
		await createAnchored(page);
		await page.getByTestId('create-document-thread').click();
		await expect(threadCount(page)).toHaveText('threads: 2');

		const rows = await anchors(page);
		const documentThread = rows.find((row) => row.type === 'document');
		expect(documentThread).toBeDefined();
		expect(documentThread!.quote).toBe('');
		expect(documentThread!.lastKnownOffset).toBeNull();

		// Sorts ahead of anchored threads in the sidebar. Asserted against the
		// rendered order rather than the array, since the array is the page's and
		// the ordering is the component's.
		// Scoped: the readonly editor on this page has a sidebar toggle too, and an
		// unscoped role query matches both.
		const host = page.locator('[data-testid="editor-host"]');
		await host.getByRole('button', { name: /comments sidebar/ }).click();
		const rows_ = page.locator('#imperative-editor-sidebar button.thread-item');
		await expect(rows_).toHaveCount(2);
		// The document thread is first, and it is the one the component marks as
		// document-level — asserting both rules out a coincidental ordering that
		// happened to put the right row on top.
		await expect(rows_.first()).toHaveAttribute('data-document', 'true');
		await expect(rows_.nth(1)).not.toHaveAttribute('data-document', 'true');
	});

	test('createDocumentThread is not orphaned by a re-anchoring pass', async ({ page }) => {
		await page.getByTestId('create-document-thread').click();
		await expect(threadCount(page)).toHaveText('threads: 1');

		// Removing text triggers re-anchoring. A document thread has no quote to
		// lose, so it must come through untouched rather than being swept up.
		// Poll for the ANCHORED thread to orphan first. That is the observable proof
		// a re-anchoring pass actually ran; polling `.not.toBe('orphaned')` on the
		// document thread matched on the first sample and would have passed against
		// a component that never re-anchors at all.
		await selectQuote(page);
		await page.getByTestId('create-thread-nodomselect').click();
		await expect(threadCount(page)).toHaveText('threads: 2');

		await page.getByTestId('remove-quote').click();
		await expect
			.poll(async () => (await anchors(page)).some((row) => row.status === 'orphaned'))
			.toBe(true);

		// The re-anchoring pass has now demonstrably run. The document thread came
		// through it untouched.
		const documentRow = (await anchors(page)).find((row) => row.type === 'document');
		expect(documentRow).toBeDefined();
		expect(documentRow!.status).not.toBe('orphaned');
	});

	test('createBlockThread anchors a whole block with no text selection, and survives an edit elsewhere', async ({
		page
	}) => {
		// No drag: the caret is collapsed into paragraph three, which is the
		// affordance separating this from createThread.
		await page.getByTestId('create-block-thread').click();
		await expect(threadCount(page)).toHaveText('threads: 1');

		const [row] = await anchors(page);
		expect(row.quote).toBe(PARAGRAPH_THREE);
		// Worth stating precisely, because the obvious phrasing overreaches. A
		// block thread is not given a distinct anchor TYPE — but the component
		// does not type a plain text anchor either: it leaves `type` undefined for
		// both, and the `'text'` here is this page's own `?? 'text'`
		// normalisation, matching what the d.ts calls the backwards-compatible
		// reading. So "nothing distinguishes a block thread" would be false.
		expect(row.type).toBe('text');
		expect(row.rawType).toBeNull();
		// `blockId` is what actually distinguishes it, and it is set only here —
		// see the coordinate-space test, where a text anchor reports null.
		expect(row.blockId).toEqual(expect.any(String));
		expect(row.blockId).not.toBe('');
		const before = { from: row.from, to: row.to };

		// Edit paragraph three's neighbours, not the block itself.
		// Insert BEFORE the block, not into it. `edit-elsewhere` appends to paragraph
		// three, which is the very block this thread anchors — so asserting the
		// anchor was unmoved by it could never fail, and two independent drift
		// injections left it green. Inserting ahead of the block means correct
		// mapping MUST move the anchor by exactly the inserted length.
		const lengthBefore = await page.getByTestId('value-length').textContent();
		await page.getByTestId('insert-before-block').click();
		await expect(page.getByTestId('value-length')).not.toHaveText(lengthBefore ?? '');

		// All four assertions below are PINS, proven red by independent breaks:
		// `quote: newQuote.slice(1)` in the re-anchoring write-back reddens the quote
		// line, `status: 'orphaned'` reddens the status line, and `from/to + 3` at
		// `review-editor-impl.svelte:484-485` reddens both position lines.
		//
		// An earlier version of this comment called the position lines an "accepted
		// guard" that could not be falsified, on the strength of three injections
		// that "left it green". That was wrong, and both reasons are worth recording
		// because either will silently fake a negative result again:
		//
		// 1. There are TWO `handleAnchorsUpdate` implementations. The one in
		//    `review-editor-anchors.svelte.js` is exported but never imported by the
		//    rendered component — dead code. Breaking it proves nothing. The live one
		//    is `review-editor-impl.svelte:471`.
		// 2. `vite dev` serves this package from `node_modules/.vite/deps`, a
		//    pre-bundled cache invalidated by lockfile changes and NOT by edits to a
		//    dependency's own files. A warm cache silently runs the OLD code, so a
		//    break-and-restore reports "no effect" while never having been loaded.
		//    `rm -rf node_modules/.vite` first, or drive `build && preview`, which is
		//    immune and is what this suite uses.
		//
		// Only the `anchor-decorations.js:274-275` mapping injection genuinely stays
		// green, and for a real reason: quote-based re-anchoring absorbs mapping
		// drift before it reaches `threads`.
		const shift = 'Prefixed. '.length;
		await expect.poll(async () => (await anchors(page))[0]?.from).toBe(before.from! + shift);
		const [after] = await anchors(page);
		expect(after.quote).toBe(PARAGRAPH_THREE);
		expect(after.to).toBe(before.to! + shift);
		expect(after.status).toBe('anchored');
	});

	test('createBlockThread refused at document start names both remaining bail branches honestly', async ({
		page
	}) => {
		// KNOWN BUG, pinned as-is until here: createBlockThread's guard has THREE
		// bail branches (readonly, view unavailable, caret outside any block).
		// Readonly is structurally impossible on this instance, but the earlier
		// reason string named only the view branch — and this branch, "caret
		// outside any block", is reachable with the view fully mounted. Document
		// position 0 resolves to depth 0, outside every block node.
		const announcement = page.getByTestId('announcement');
		await page.getByTestId('create-block-thread-at-doc-start').click();

		await expect(lastReturn(page)).toHaveText('last return: null');
		await expect(threadCount(page)).toHaveText('threads: 0');
		await expect(announcement).toHaveText(
			/was refused: the editor view is not ready, or the caret is not inside a block/
		);
		await expect(announcement).not.toHaveText(/the editor is readonly/);
	});
});

test.describe('review-imperative: comment mutation', () => {
	test('createComment, updateComment, and deleteComment each notify and move the array', async ({
		page
	}) => {
		const id = await createAnchored(page);

		await page.getByTestId('create-comment').click();
		await expect.poll(async () => (await anchors(page))[0].comments).toBe(2);
		expect(await events(page)).toContain(`oncommentcreate:${id}`);

		await page.getByTestId('update-comment').click();
		expect(await events(page)).toContain(`oncommentupdate:${id}`);
		// Assert the CONTENT, not just that an event fired: the previous version
		// checked only the event string, so an update that changed nothing passed.
		await expect(page.getByTestId('comment-bodies')).toContainText('Edited body');

		// The default is a SOFT delete: `soft` rides on the event, and the comment
		// stays in the array with a deletedAt stamp rather than being removed.
		await page.getByTestId('delete-comment-soft').click();
		expect(await events(page)).toContain(`oncommentdelete:${id}:soft=true`);
		expect((await anchors(page))[0].comments).toBe(2);

		// The hard delete is the other half of the method's surface and was
		// previously wired to a button no test ever clicked.
		await page.getByTestId('delete-comment-hard').click();
		expect(await events(page)).toContain(`oncommentdelete:${id}:soft=false`);
		await expect.poll(async () => (await anchors(page))[0].comments).toBe(1);
	});

	test('the soft-delete reducer stamps deletedAt when it is omitted, and honours it when given', () => {
		// The COMPONENT method takes `soft?: boolean` and has no deletedAt
		// parameter at all; `deletedAt` belongs to the pure reducer, whose docblock
		// calls omitting it a deliberate exception. So this half is driven against
		// the reducer directly, the way review-comment-lifecycle already does.
		const thread: Thread = {
			id: 'thread-1',
			anchor: { from: 1, to: 5, quote: 'test', status: 'anchored' } as Thread['anchor'],
			comments: [
				{
					id: 'comment-1',
					threadId: 'thread-1',
					authorId: AUTHOR,
					body: 'body',
					createdAt: timestamp()
				}
			],
			createdAt: timestamp()
		};

		const omitted = deleteComment([thread], 'thread-1', 'comment-1', { soft: true });
		const stamped = omitted.threads[0].comments[0].deletedAt;
		expect(stamped).toBeTruthy();
		expect(Number.isNaN(Date.parse(stamped!))).toBe(false);

		const explicit = deleteComment([thread], 'thread-1', 'comment-1', {
			soft: true,
			deletedAt: '2020-01-01T00:00:00.000Z'
		});
		expect(explicit.threads[0].comments[0].deletedAt).toBe('2020-01-01T00:00:00.000Z');

		// A hard delete removes the comment rather than stamping it.
		const hard = deleteComment([thread], 'thread-1', 'comment-1', { soft: false });
		expect(hard.threads[0].comments).toHaveLength(0);
	});

	test('updateComment on an already-soft-deleted comment announces refused, not completed', async ({
		page
	}) => {
		// KNOWN BUG, pinned as-is until here: an id-presence pre-check ("does a
		// comment with this id exist") is not the same question as the guard's own
		// ("does an ELIGIBLE comment exist"). Soft-delete only stamps `deletedAt` —
		// the comment entry stays in the array — so a presence check says
		// "completed" for a call the component's own guard silently refused.
		await createAnchored(page);
		const id = (await anchors(page))[0].id;

		await page.getByTestId('delete-comment-soft').click();
		expect(await events(page)).toContain(`oncommentdelete:${id}:soft=true`);
		const eventsBeforeUpdate = await events(page);

		const announcement = page.getByTestId('announcement');
		await page.getByTestId('update-comment').click();

		// No oncommentupdate fired, and the body was never touched.
		expect(await events(page)).toEqual(eventsBeforeUpdate);
		await expect(page.getByTestId('comment-bodies')).not.toContainText('Edited body');
		await expect(announcement).toHaveText(/was refused: no eligible comment to update/);
		await expect(announcement).not.toHaveText(/completed/);
	});

	test('a second soft-delete of the same comment announces refused, not a repeat completion', async ({
		page
	}) => {
		// Same defect, corroborating instance: the guard refuses a second
		// soft-delete of an already-deleted comment. The id is still present, so
		// this fails identically to the updateComment case above unless the page
		// observes whether oncommentdelete actually fired again.
		await createAnchored(page);
		const id = (await anchors(page))[0].id;

		await page.getByTestId('delete-comment-soft').click();
		expect(await events(page)).toContain(`oncommentdelete:${id}:soft=true`);
		const eventsBeforeSecond = await events(page);

		const announcement = page.getByTestId('announcement');
		await page.getByTestId('delete-comment-soft').click();

		expect(await events(page)).toEqual(eventsBeforeSecond);
		await expect(announcement).toHaveText(/was refused: no eligible comment to delete/);
		await expect(announcement).not.toHaveText(/completed/);
	});

	test('createComment announces "a comment", never "a thread"', async ({ page }) => {
		// KNOWN BUG, pinned as-is until here: the 'created' message was shared
		// verbatim across all four create methods and said "created a thread"
		// unconditionally — including for createComment, which creates a comment
		// on an EXISTING thread. The component's own internal live region
		// correctly announces "Comment added" at the same moment, so a screen
		// reader hearing both got two contradictory descriptions of one action.
		await createAnchored(page);
		const announcement = page.getByTestId('announcement');

		await page.getByTestId('create-comment').click();
		await expect(announcement).toHaveText(/createComment created a comment\./);
		await expect(announcement).not.toHaveText(/created a thread/);
	});
});

test.describe('review-imperative: removal', () => {
	test('deleteThread and clearAllThreads fire onthreaddelete, once per thread', async ({
		page
	}) => {
		const first = await createAnchored(page);
		await page.getByTestId('create-document-thread').click();
		await expect(threadCount(page)).toHaveText('threads: 2');
		const second = (await anchors(page)).find((row) => row.id !== first)!.id;

		await page.getByTestId('delete-thread').click();
		await expect(threadCount(page)).toHaveText('threads: 1');
		expect(await events(page)).toContain(`onthreaddelete:${first}`);
		// The SURVIVOR is the other thread, not merely "one fewer". A count alone
		// would pass if deleteThread removed the wrong one.
		expect((await anchors(page)).map((row) => row.id)).toEqual([second]);

		// Rebuild to TWO threads before clearing. Clearing a single remaining
		// thread cannot distinguish "one event per thread" from "one bulk event
		// that happens to carry a threadId", which is what the previous version of
		// this test actually proved.
		await page.getByTestId('create-document-thread').click();
		await expect(threadCount(page)).toHaveText('threads: 2');
		const remaining = (await anchors(page)).map((row) => row.id);
		expect(remaining).toHaveLength(2);

		const beforeClear = await events(page);
		await page.getByTestId('clear-all-threads').click();
		await expect(threadCount(page)).toHaveText('threads: 0');

		const fired = (await events(page)).slice(beforeClear.length);
		expect(fired).toHaveLength(2);
		expect(fired.sort()).toEqual(remaining.map((id) => `onthreaddelete:${id}`).sort());
	});

	test('orphaning fires no onthreaddelete, unlike a consumer-initiated delete', async ({
		page
	}) => {
		await createAnchored(page);
		const eventsBefore = await events(page);

		// Remove the quoted text so the anchor can no longer be found. This is the
		// ORPHANING path, and RE-1 asks specifically that it be distinguished from
		// removal: the thread is still the consumer's, so nothing is deleted and
		// nothing is announced.
		await page.getByTestId('remove-quote').click();
		await expect.poll(async () => (await anchors(page))[0]?.status).toBe('orphaned');

		await expect(threadCount(page)).toHaveText('threads: 1');
		expect(await events(page)).toEqual(eventsBefore);
	});
});

test.describe('review-imperative: the readonly guard', () => {
	test('all eight mutation methods are guarded, and a removed guard would be observable', async ({
		page
	}) => {
		// The readonly instance is SEEDED with one document thread carrying one
		// comment, and its callbacks are wired to the same reducers as the editable
		// one. Both halves are load-bearing: with an empty array the void methods
		// receive '' and no-op on a missing id whether or not the guard exists, and
		// with no callbacks a fired event would leave no trace. Together they mean
		// deleting any of the eight guards turns this test red.
		await expect(page.getByTestId('ro-thread-count')).toHaveText('readonly threads: 1');
		await expect(page.getByTestId('ro-comment-bodies')).toHaveText(
			'Seeded so the readonly guards have something to refuse.'
		);

		// The three creates return null, which is the guard's whole signature.
		for (const testId of [
			'ro-create-thread',
			'ro-create-document-thread',
			'ro-create-block-thread'
		]) {
			await page.getByTestId(testId).click();
			await expect(lastReturn(page)).toHaveText('last return: null');
		}

		// The five void methods return nothing, so they are asserted by absence:
		// no callback fired, and neither the array nor the comment body moved.
		for (const testId of [
			'ro-create-comment',
			'ro-update-comment',
			'ro-delete-comment',
			'ro-delete-thread',
			'ro-clear-all-threads'
		]) {
			await page.getByTestId(testId).click();
		}

		await expect(page.getByTestId('ro-events')).toHaveText('');
		await expect(page.getByTestId('ro-thread-count')).toHaveText('readonly threads: 1');
		await expect(page.getByTestId('ro-comment-bodies')).toHaveText(
			'Seeded so the readonly guards have something to refuse.'
		);
	});

	test('every refused readonly call announces a refusal, never a completion', async ({ page }) => {
		// The previous version of this test clicked ONE button — `ro-create-thread`,
		// which returns null and got the right string by luck. The five void methods
		// return `undefined` whether refused or not, and all four were announcing
		// "completed" for a call the guard had refused: a false confirmation of a
		// destructive action, which is worse than the silence it replaced. So every
		// refusing button is asserted, not one.
		const announcement = page.getByTestId('announcement');
		await expect(announcement).toHaveCount(1);
		await expect(announcement).toHaveText('');

		const refusing = [
			'ro-create-thread',
			'ro-create-document-thread',
			'ro-create-block-thread',
			'ro-create-comment',
			'ro-update-comment',
			'ro-delete-comment',
			'ro-delete-thread',
			'ro-clear-all-threads'
		];
		for (const testId of refusing) {
			await page.getByTestId(testId).click();
			await expect(announcement).toHaveText(/was refused: the editor is readonly/);
			await expect(announcement).not.toHaveText(/completed/);
		}

		// Nothing actually moved, which is what makes "refused" the honest word.
		await expect(page.getByTestId('ro-events')).toHaveText('');
		await expect(page.getByTestId('ro-thread-count')).toHaveText('readonly threads: 1');
	});

	test('a refusal on the EDITABLE instance never blames readonly', async ({ page }) => {
		// The first fix made every refusal say "the editor is readonly" — true for
		// the readonly instance, and FALSE here: this instance's mode never changes,
		// so a null return means no selection, no view, or no target — never
		// readonly. Reproduced live: Tab to `select-quote`, Enter, Tab to
		// `create-thread`, Enter — the region announced "the editor is readonly" for
		// a selection-lag failure (cinder#1288) on the WRITABLE editor. A confident,
		// specific, and false diagnosis is worse than a vague one.
		const announcement = page.getByTestId('announcement');

		// createThread: refused because no text is selected, on a fresh page with
		// nothing highlighted.
		await page.getByTestId('create-thread-nodomselect').click();
		await expect(lastReturn(page)).toHaveText('last return: null');
		await expect(announcement).toHaveText(/was refused: no text is currently selected/);
		// The tally legitimately says "in the readonly one", so the check is for
		// the DIAGNOSIS specifically, not the bare word anywhere in the string.
		await expect(announcement).not.toHaveText(/the editor is readonly/);

		// createComment: refused because no thread exists yet to comment on.
		await page.getByTestId('create-comment').click();
		await expect(lastReturn(page)).toHaveText('last return: null');
		await expect(announcement).toHaveText(/was refused: no thread exists to comment on/);
		await expect(announcement).not.toHaveText(/the editor is readonly/);

		// The three void methods that can target a missing thread/comment: each
		// says what was actually missing, never "completed" and never a readonly
		// diagnosis. "eligible" rather than "exists" — the wording that matters is
		// tested precisely by the soft-delete regression test below, where a
		// target DOES exist but is not an eligible one.
		await page.getByTestId('update-comment').click();
		await expect(announcement).toHaveText(/was refused: no eligible comment to update/);
		await expect(announcement).not.toHaveText(/^.*completed.*$|the editor is readonly/);

		await page.getByTestId('delete-comment-soft').click();
		await expect(announcement).toHaveText(/was refused: no eligible comment to delete/);
		await expect(announcement).not.toHaveText(/^.*completed.*$|the editor is readonly/);

		await page.getByTestId('delete-thread').click();
		await expect(announcement).toHaveText(/was refused: no eligible thread to delete/);
		await expect(announcement).not.toHaveText(/^.*completed.*$|the editor is readonly/);

		// Nothing was actually mutated by any of the five calls above.
		expect(await events(page)).toEqual([]);
		await expect(threadCount(page)).toHaveText('threads: 0');
	});

	test('a repeated action announces again, and bulk actions carry a count', async ({ page }) => {
		// `aria-live` fires on CHANGE, so an announcement that is a pure function of
		// the button name is silent from the second press onward. On a page whose
		// point is buttons that may refuse, re-pressing to check is the obvious
		// response — and it was exactly what produced nothing.
		const announcement = page.getByTestId('announcement');

		await page.getByTestId('create-document-thread').click();
		await expect(threadCount(page)).toHaveText('threads: 1');
		await expect(announcement).toHaveText(/1 thread in the editable review/);

		await page.getByTestId('create-document-thread').click();
		await expect(threadCount(page)).toHaveText('threads: 2');
		await expect(announcement).toHaveText(/2 threads in the editable review/);

		await page.getByTestId('create-document-thread').click();
		await expect(threadCount(page)).toHaveText('threads: 3');
		await expect(announcement).toHaveText(/3 threads in the editable review/);

		// A refused call repeats with an unchanged tally, so the text is identical
		// twice running. It must still RE-ANNOUNCE, which `toHaveText` cannot see:
		// it polls for a final string, so it stays green with the clear-then-set
		// deleted. A log of what was WRITTEN was tried first and rejected for the
		// same reason — it records an entry whether or not the DOM actually
		// changed. Instead the page counts real MUTATIONS of the live-region node
		// via `MutationObserver` (`announce-mutations`), which can only increase
		// when a write genuinely lands. Two presses must each move the counter,
		// which is false the moment the microtask transition goes away.
		const mutations = () =>
			page
				.getByTestId('announce-mutations')
				.textContent()
				.then((raw) => Number(raw ?? '0'));

		const before = await mutations();
		await page.getByTestId('ro-delete-thread').click();
		await expect.poll(mutations).toBeGreaterThan(before);
		const afterFirst = await mutations();

		// The SECOND identical press is the one that matters. Same words, same
		// tally — so without the clear-then-set Svelte writes the same string, the
		// DOM never changes, and a screen reader hears nothing.
		await page.getByTestId('ro-delete-thread').click();
		await expect.poll(mutations).toBeGreaterThan(afterFirst);
		await expect(announcement).toHaveText(/was refused/);

		// Bulk removal reports scale rather than merely happening.
		await page.getByTestId('clear-all-threads').click();
		await expect(threadCount(page)).toHaveText('threads: 0');
		await expect(announcement).toHaveText(
			/clearAllThreads completed\. 0 threads in the editable review/
		);
	});

	test('a control that has to focus the editor puts focus back on itself', async ({ page }) => {
		// `select()` calls `view.focus()` for a real reason — ProseMirror observes a
		// selection on a focused view, and this page drives the documented consumer
		// path rather than faking it. Four buttons inherited that and silently
		// relocated focus into the contenteditable: `create-thread` is the first
		// control on the page and the editor is the twenty-third, so pressing it
		// moved a keyboard user twenty-odd stops forward with no announcement, and
		// reaching the next button meant walking back through the editor host, the
		// export menu, the sidebar toggle and every preceding control.
		//
		// Not a trap — Tab out of the editor worked — which is exactly why it went
		// unnoticed until the board drove the page by keyboard.
		const focusedTestId = () =>
			page.evaluate(
				() =>
					document.activeElement?.getAttribute('data-testid') ??
					document.activeElement?.tagName ??
					null
			);

		for (const testId of [
			'select-quote',
			'create-thread',
			'create-block-thread',
			'create-block-thread-at-doc-start'
		]) {
			const button = page.getByTestId(testId);
			await button.focus();
			await button.press('Enter');
			// Polled, not sampled: the restore happens after an awaited imperative
			// call, so reading once could catch the intermediate state where focus
			// legitimately sits in the view.
			await expect.poll(focusedTestId).toBe(testId);
		}
	});

	test('the page keeps one h1 after hydration, rather than one per editor', async ({ page }) => {
		// Each editor renders its document's first heading at the authored level, so
		// a `#` fixture adds an `h1` per instance — here that made three sibling
		// `h1`s, two of them nested inside `h2` sections.
		//
		// This is invisible to SSR and therefore to the hydration spec: the editors
		// server-render an empty shell, so the extra headings only exist after the
		// client mounts. Asserting after hydration is the point of the test.
		await expect(page.locator('h1')).toHaveCount(1);
		await expect(page.locator('h1')).toHaveText('Review Imperative');
		await expect(page.locator('#imperative-editor .ProseMirror h3')).toHaveText('Release Plan');
		await expect(page.locator('#imperative-readonly .ProseMirror h3')).toHaveText(
			'Readonly Reference'
		);
	});

	test('clearAllThreads with nothing to clear announces a refusal, not a completion', async ({
		page
	}) => {
		// It was the one void mutation method not routed through `recordVoid`, so it
		// announced "completed" unconditionally — including for a call that bailed
		// at `threads.length === 0` without firing anything. That is the same
		// defect the other four were fixed for, and it survived because the
		// existing bulk-removal test only ever presses it with threads present.
		const announcement = page.getByTestId('announcement');

		await expect(threadCount(page)).toHaveText('threads: 0');
		await page.getByTestId('clear-all-threads').click();

		await expect(announcement).toHaveText(/clearAllThreads was refused: no threads to clear/);
		await expect(announcement).not.toHaveText(/completed/);
		expect(await events(page)).toEqual([]);
	});

	test('the readonly instance is announced as readonly, not as an editable textbox', async ({
		page
	}) => {
		// REGRESSION PIN for cinder#1292, fixed in @lostgradient/editor@0.9.2.
		// `mode="readonly"` produced `contenteditable="false"` and a `data-readonly`
		// styling hook, but no ARIA state — so a screen reader announced an ordinary
		// editable text box that silently ignored typing. Measured before the fix:
		// both instances reported `readonly: false, settable: true`.
		//
		// Asserted on the ProseMirror node specifically, because that is where the
		// textbox role lives. The same attribute on the wrapping `role="application"`
		// host changes nothing — ARIA states do not inherit down to it — which is
		// what the originally-filed fix got wrong.
		const readonlySurface = page.locator('#imperative-readonly .ProseMirror');
		const editableSurface = page.locator('#imperative-editor .ProseMirror');

		await expect(readonlySurface).toHaveAttribute('aria-readonly', 'true');
		await expect(readonlySurface).toHaveAttribute('contenteditable', 'false');
		// The editable instance is the control: it must NOT pick the attribute up,
		// or the assertion above would pass against a component that sets it
		// unconditionally.
		await expect(editableSurface).not.toHaveAttribute('aria-readonly', 'true');
		await expect(editableSurface).toHaveAttribute('contenteditable', 'true');
	});

	test('deleting a thread from its own popover leaves focus somewhere reachable', async ({
		page
	}) => {
		// REGRESSION PIN for cinder#1291, fixed in @lostgradient/cinder@0.24.3 +
		// @lostgradient/editor@0.9.2. The focus trap captured the sidebar item that
		// opened the popover and restored to it on close — but deleting the thread
		// removes that item, so the restore silently did nothing and focus landed on
		// `<body>`: the next Tab restarts at the top of the document, and a screen
		// reader says nothing.
		//
		// This route is where it surfaced precisely because it APPLIES
		// `onthreaddelete`. The other review-* routes are notification-only, so
		// their sidebar item survives the delete and the original restore path
		// still found its target — which is why every one of them stayed green.
		await page.getByTestId('create-document-thread').click();
		await expect(threadCount(page)).toHaveText('threads: 1');

		const host = page.locator('[data-testid="editor-host"]');
		await host.getByRole('button', { name: /comments sidebar/ }).click();
		const item = page.locator('#imperative-editor-sidebar button.thread-item').first();
		await item.click();

		const popover = page.locator('.thread-popover');
		await expect(popover).toBeVisible();
		await popover.getByRole('button', { name: 'Delete thread' }).click();
		await expect(threadCount(page)).toHaveText('threads: 0');

		// Focus is on the comments-sidebar toggle for THIS editor instance — always
		// mounted, always focusable, adjacent to the work, and its own label
		// announces the changed comment count.
		await expect
			.poll(() =>
				page.evaluate(() => ({
					id: document.activeElement?.id ?? null,
					isBody: document.activeElement === document.body
				}))
			)
			.toEqual({ id: 'imperative-editor-sidebar-toggle', isBody: false });
	});

	test('setMarkdown is NOT guarded, so a readonly editor is programmatically mutable', async ({
		page
	}) => {
		// Documented rather than asserted-as-correct. RE-3 calls this undecided;
		// the shipped component decides it one way: all eight mutation methods
		// guard on `mode === 'readonly'` and `setMarkdown`/`reset` do not. A
		// consumer treating `readonly` as "this content cannot change" is wrong.
		//
		// This is the `setMarkdown` half only, and it predates RE-3. The `reset`
		// half is the last test in the RE-3 block below; the two are deliberately
		// not merged, so neither can be read as standing in for the other.
		const before = await page.getByTestId('ro-value-length').textContent();
		await page.getByTestId('ro-set-markdown').click();
		await expect(page.getByTestId('ro-value-length')).not.toHaveText(before ?? '');
		await expect(page.getByTestId('ro-value-length')).toHaveText('readonly value length: 36');
	});
});

test.describe('review-imperative: content replacement and reset (RE-3)', () => {
	test('setMarkdown re-anchors the quote that survives, orphans the one that does not, and drops neither', async ({
		page
	}) => {
		const seeded = await seedContent(page);
		const survivor = seeded.find((row) => row.quote === SURVIVING_QUOTE)!;
		const doomed = seeded.find((row) => row.quote === REMOVED_QUOTE)!;
		expect(survivor).toBeDefined();
		expect(doomed).toBeDefined();

		// EXACT, from the page's hand derivation: 'dashboard owner' sits at index 25
		// of a paragraph whose ProseMirror content starts at 30 and whose
		// textBetween run starts at 28, so 55/70 and 53 are three independent
		// arithmetic claims about one selection.
		expect(survivor.from).toBe(55);
		expect(survivor.to).toBe(70);
		expect(survivor.lastKnownOffset).toBe(53);
		expect(doomed.from).toBe(99);
		expect(doomed.to).toBe(117);
		expect(doomed.lastKnownOffset).toBe(96);
		expect([survivor.status, doomed.status]).toEqual(['anchored', 'anchored']);

		await page.getByTestId('content-set-markdown').click();

		// Polled past the plugin's 300ms re-anchor debounce rather than waited out.
		// That pass ALSO skips its run and reschedules if the document changed
		// during the window, so there is no duration it would be safe to sleep for.
		await expect
			.poll(async () => (await contentAnchors(page)).find((row) => row.id === doomed.id)?.status)
			.toBe('orphaned');

		const after = await contentAnchors(page);
		// NEITHER thread dropped — RE-3's third clause, and the one that a status
		// assertion alone would not cover.
		expect(after).toHaveLength(2);
		expect(after.map((row) => row.id).sort()).toEqual([survivor.id, doomed.id].sort());

		const survivorAfter = after.find((row) => row.id === survivor.id)!;
		// RE-ANCHORED, not merely left alone. `setMarkdown` reaches the editor as a
		// single step spanning the whole document, which `isFullDocumentReplacement`
		// (anchor-decorations.js) detects: position mapping is meaningless across
		// it, so every anchor is kept verbatim and handed to the deferred pass,
		// which searches by QUOTE. The replacement inserts a paragraph ahead of the
		// quote precisely so a correct search has to land somewhere new — without
		// that insertion, "re-anchored" and "never touched" produce the same
		// numbers.
		expect(survivorAfter.status).toBe('anchored');
		expect(survivorAfter.quote).toBe(SURVIVING_QUOTE);
		expect(survivorAfter.from).toBe(110);
		expect(survivorAfter.to).toBe(125);
		expect(survivorAfter.lastKnownOffset).toBe(107);

		const doomedAfter = after.find((row) => row.id === doomed.id)!;
		// ORPHANED with its quote KEPT, which is what lets the text coming back
		// restore the thread — and its comment kept with it.
		expect(doomedAfter.status).toBe('orphaned');
		expect(doomedAfter.quote).toBe(REMOVED_QUOTE);
		expect(doomedAfter.comments).toBe(1);

		// The rendered decoration follows the same split: an orphan renders
		// nothing, so exactly one anchor span survives, over the surviving quote.
		const decorations = page.locator('#imperative-content .ProseMirror span.comment-anchor');
		await expect(decorations).toHaveCount(1);
		expect(((await decorations.textContent()) ?? '').trim()).toBe(SURVIVING_QUOTE);
	});

	test('setMarkdown writes the value prop verbatim, and getMarkdown re-serialises the same document', async ({
		page
	}) => {
		await page.getByTestId('content-set-markdown').click();
		await page.getByTestId('content-get-markdown').click();

		const report = await contentMarkdown(page);

		// `setMarkdown`'s first statement is `value = content`, and the editor's own
		// change listener is suppressed for the replaceAll it triggers
		// (`isExternalUpdate`, dist/editor/editor.js) — so nothing writes a
		// normalised form back over it and the prop holds the exact string.
		expect(report.valueProp).toBe(CONTENT_REPLACEMENT);

		// `getMarkdown` is a DIFFERENT derivation: it re-serialises the live
		// ProseMirror document through Milkdown rather than echoing the prop.
		// Compared after trimming because the serializer canonicalises trailing
		// newlines and the claim here is about content, not framing — the raw
		// lengths ride along in `content-markdown-json` so a larger divergence
		// stays visible rather than being absorbed by the trim.
		expect(report.fromGetMarkdown.trim()).toBe(CONTENT_REPLACEMENT.trim());
		expect(report.fromGetMarkdown).toContain(SURVIVING_QUOTE);
		expect(report.fromGetMarkdown).not.toContain(REMOVED_QUOTE);
	});

	test('getAst still matches the DOM after setMarkdown, and reset now reaches the live document too', async ({
		page
	}) => {
		// The BASELINE matters as much as the setMarkdown mutation below. Without
		// it, a getAst that always answered with the document it was first given
		// would satisfy "the AST agrees with the DOM" only until something
		// changed — and this test is the one asking whether it tracks a change at
		// all.
		expect(await readAst(page)).toEqual(await renderedBlocks(page));

		await page.getByTestId('content-set-markdown').click();
		await expect(page.locator('#imperative-content .ProseMirror > :is(h3,p)')).toHaveCount(4);

		const afterSet = await readAst(page);
		expect(afterSet).toEqual(await renderedBlocks(page));
		// Named explicitly, because "the two agree" is satisfiable by both being
		// empty and this fixture has a shape worth stating.
		expect(afterSet.map((node) => node.type)).toEqual([
			'heading',
			'paragraph',
			'paragraph',
			'paragraph'
		]);
		expect(afterSet[0]).toEqual({ type: 'heading', depth: 3, text: CONTENT_HEADING });

		// FIXED, as of `@lostgradient/editor@0.12.0`. This was a regression
		// introduced in 0.11.0 (absent in 0.10.0 — confirmed at the time by
		// deleting the one responsible line from the installed dist and watching
		// this go green, then restoring it and watching it go red again). Filed
		// as stevekinney/cinder#1328
		// (https://github.com/stevekinney/cinder/issues/1328), fixed by guarding
		// `MarkdownEditor.setMarkdown()`'s own `value` write with a read-compare
		// (`if (value !== content) value = content;`) instead of writing it
		// unconditionally.
		//
		// Mechanism, restated now that it is fixed rather than live: that
		// unconditional `value = content;` statement, added in 0.11.0 right
		// after `editorState.setMarkdown(content)`, ran even when `value`
		// already equalled `content` — which is exactly what happens one
		// statement into `ReviewEditor.reset()`'s own `value = original` having
		// already pushed a new value down. The write-compare-write from
		// `setMarkdown` used to fire regardless and re-stamp `value`, which
		// broke `MarkdownEditor`'s bindable "sync external value changes" effect
		// for that instance permanently: `ReviewEditor` passes
		// `value={editorValue}` down ONE-WAY, not via `bind:value`, so `reset()`
		// depends entirely on that effect noticing the prop moved. Guarding the
		// write means `setMarkdown` no longer touches `value` at all once it
		// already matches, so the effect stays connected and a later `reset()`
		// keeps working.
		//
		// Checked on the block count AND the heading, unlike the old pin (which
		// needed the inserted paragraph specifically, because `CONTENT_INITIAL`
		// and `CONTENT_REPLACEMENT` share a heading and a heading-only assertion
		// couldn't distinguish "reset landed `original`" from "reset did
		// nothing"). `original`'s heading ("Content Baseline") differs from both
		// of those, so post-fix the heading alone already discriminates; the
		// block count is kept alongside it as the second, independent signal.
		await page.getByTestId('content-reset').click();
		await expect(page.locator('#imperative-content .ProseMirror > :is(h3,p)')).toHaveCount(2);
		await expect(page.locator('#imperative-content .ProseMirror')).toContainText(
			'The rollout plan is still being drafted.'
		);
		await expect(page.locator('#imperative-content .ProseMirror')).not.toContainText(
			'A late addition pushes'
		);

		// getAst still agrees with the DOM, and now BOTH have actually moved to
		// `original` — the invariant this test's name promises, restored.
		const afterReset = await readAst(page);
		expect(afterReset).toEqual(await renderedBlocks(page));
		expect(afterReset).toEqual([
			{ type: 'heading', depth: 3, text: CONTENT_ORIGINAL_HEADING },
			{ type: 'paragraph', depth: null, text: 'The rollout plan is still being drafted.' }
		]);
	});

	test('reset restores original rather than the initial value, clears the dirty state, and releases every thread', async ({
		page
	}) => {
		const seeded = await seedContent(page);
		const ids = seeded.map((row) => row.id);

		// DIRTY beforehand, by the component's own reckoning rather than this
		// page's: the diff badge in its controls bar renders only when `diffStats`
		// is nonzero, and `diffStats` is derived from `original` against `value`.
		const dirtyBadge = page.locator('#imperative-content-controls .cinder-diff-statistics');
		await expect(dirtyBadge).toHaveCount(1);

		const eventsBefore = await contentEvents(page);
		await page.getByTestId('content-reset').click();

		// ROADMAP RE-3 says reset "returns the component to its initial `value`".
		// It does not — it is `value = original`. This instance mounts with
		// `original` set to a DIFFERENT document from its initial `value`, so
		// exactly one of those two claims can hold afterwards, and the rendered
		// heading says which.
		await expect(page.locator('#imperative-content .ProseMirror h3')).toHaveText(
			CONTENT_ORIGINAL_HEADING
		);
		await expect(page.locator('#imperative-content .ProseMirror')).not.toContainText(
			SURVIVING_QUOTE
		);

		// Threads are released by NOTIFICATION, one `onthreaddelete` per thread —
		// `reset` never touches the `threads` array itself. A consumer who does not
		// wire that callback keeps every thread through a reset, which is why the
		// events are asserted and not only the resulting count.
		const fired = (await contentEvents(page)).slice(eventsBefore.length);
		expect(fired.sort()).toEqual(ids.map((id) => `onthreaddelete:${id}`).sort());
		await expect(page.getByTestId('content-thread-count')).toHaveText('content threads: 0');

		// CLEAN afterwards. There is no dirty flag for `reset` to clear: the state
		// is derived, so restoring the original clears it as a consequence.
		await expect(dirtyBadge).toHaveCount(0);
	});

	test('reset now dispatches a real transaction, and it reaches the live document even once setMarkdown has run on the same instance', async ({
		page
	}) => {
		await page.getByTestId('content-set-markdown').click();
		// Waited on the INSERTED paragraph, not on the heading: the replacement
		// keeps the same heading text, so a heading assertion here would be
		// satisfied before `setMarkdown` had done anything at all.
		await expect(page.locator('#imperative-content .ProseMirror')).toContainText(
			'A late addition pushes'
		);
		let probeCount = 1;
		const beforeReset = await probeUndoDepth(page, probeCount);
		// Anchors that setMarkdown's own transaction is history-tracked, which
		// every undo claim below depends on.
		expect(beforeReset).toBeGreaterThan(0);

		// FIXED (stevekinney/cinder#1328) — same regression, and the same fix, as
		// the `getAst` test above; see that test's comment for the full
		// mechanism. `reset()` now reaches the live document even once
		// `setMarkdown` has been called on this instance: `MarkdownEditor`'s
		// bindable `value` keeps tracking `ReviewEditor`'s one-way
		// `value={editorValue}` push, because `setMarkdown`'s own write is now
		// guarded and no longer re-stamps `value` once it already matches.
		await page.getByTestId('content-reset').click();
		await expect(page.locator('#imperative-content .ProseMirror')).toContainText(
			'The rollout plan is still being drafted.'
		);
		await expect(page.locator('#imperative-content .ProseMirror')).not.toContainText(
			'A late addition pushes'
		);

		// The undo-depth NUMBER after reset is deliberately not asserted against
		// `beforeReset` here, in either direction. Measured directly (not
		// guessed): back-to-back clicks land reset's replaceAll inside
		// prosemirror-history's `newGroupDelay` window of setMarkdown's, so the
		// two get GROUPED into one history entry and the depth reads IDENTICAL
		// before and after (confirmed deterministic over 5 runs) — forcing a
		// >500ms gap between the two clicks (confirmed separately, not kept as
		// a test — this repo does not pad waits) instead produces a second,
		// ungrouped entry and the depth reads one higher. Both are "a
		// transaction fired"; only the DOM content above tells them apart from
		// "no transaction fired at all", which is what the pre-fix bug actually
		// did. What IS asserted, and is true either way, is that the depth
		// stays positive — the undo stack was not emptied or corrupted by the
		// reset.
		probeCount += 1;
		const afterReset = await probeUndoDepth(page, probeCount);
		expect(afterReset).toBeGreaterThan(0);

		// One undo, regardless of grouping, stays inside the pre-reset lineage:
		// grouped, it jumps past both transactions straight to the document
		// setMarkdown started from; ungrouped, it lands on setMarkdown's own
		// result. Either way that document still carries the REPLACEMENT
		// heading (shared with the pre-setMarkdown document) and never the
		// `original` heading — which is the deterministic, grouping-independent
		// way to show reset's change was itself undoable at all.
		await page.getByTestId('content-undo').click();
		await expect(page.locator('#imperative-content .ProseMirror')).toContainText(CONTENT_HEADING);
		await expect(page.locator('#imperative-content .ProseMirror')).not.toContainText(
			CONTENT_ORIGINAL_HEADING
		);

		// Unwinding the rest of the stack — by POLLING the depth rather than
		// guessing how many clicks grouping needs — converges on the same place
		// either way: the document from before setMarkdown ever ran.
		probeCount += 1;
		let depth = await probeUndoDepth(page, probeCount);
		while (depth > 0) {
			await page.getByTestId('content-undo').click();
			probeCount += 1;
			depth = await probeUndoDepth(page, probeCount);
		}
		await expect(page.locator('#imperative-content .ProseMirror h3')).toHaveText(CONTENT_HEADING);
		await expect(page.locator('#imperative-content .ProseMirror')).toContainText(
			'The rollout plan names a dashboard owner and a migration owner.'
		);
		await expect(page.locator('#imperative-content .ProseMirror')).toContainText(
			'The rollback checklist is owned by the platform team.'
		);
		await expect(page.locator('#imperative-content .ProseMirror')).not.toContainText(
			'A late addition pushes'
		);
		await expect(page.locator('#imperative-content .ProseMirror')).not.toContainText(
			CONTENT_ORIGINAL_HEADING
		);
	});

	test('reset is NOT guarded either, so a readonly editor is reset programmatically', async ({
		page
	}) => {
		// The other half of RE-3's readonly criterion. `setMarkdown` was already
		// pinned as unguarded; `reset` carries no `mode === 'readonly'` check
		// either, and unlike `setMarkdown` it also destroys the review state.
		await expect(page.getByTestId('ro-thread-count')).toHaveText('readonly threads: 1');
		await expect(page.getByTestId('ro-value-length')).not.toHaveText('readonly value length: 0');

		await page.getByTestId('ro-reset').click();

		// This instance passes no `original`, and `original` defaults to `''`, so
		// `value = original` BLANKS it. That is the sharpest demonstration
		// available that reset restores the `original` PROP and not the value the
		// component started with — there is nowhere else the empty string could
		// have come from.
		await expect(page.getByTestId('ro-value-length')).toHaveText('readonly value length: 0');

		// The rendered document too, and that is a SEPARATE claim rather than a
		// restatement. `value = original` is a plain prop assignment that happens
		// before the component touches the editor at all, so the readout above
		// would report 0 even if the readonly ProseMirror view had refused the
		// replacement. Its heading is gone, so it did not.
		await expect(page.locator('#imperative-readonly .ProseMirror')).not.toContainText(
			'Readonly Reference'
		);

		// And the seeded thread is released through the same notification path, on
		// an editor a consumer was told is read-only.
		await expect(page.getByTestId('ro-events')).toHaveText('onthreaddelete:readonly-thread-1');
		await expect(page.getByTestId('ro-thread-count')).toHaveText('readonly threads: 0');
		await expect(page.getByTestId('announcement')).toHaveText(/reset\(readonly\) completed/);
	});
});

test.describe('review-imperative: scroll and editor handle (RE-4)', () => {
	// `getScrollBehavior()` returns 'instant' under reduced motion and 'smooth'
	// otherwise. Nothing below currently scrolls, so this changes no result today
	// — it is here so that a FIXED `scrollToThread` reddens these tests cleanly
	// instead of racing a 350ms animation into intermittence.
	//
	// Through `contextOptions` rather than a bare `reducedMotion` key: Playwright
	// 1.61 exposes `reducedMotion` on `BrowserContextOptions` but not as a
	// top-level test option, so the shorter spelling is a type error here. Setting
	// it on the context also means it is in force before the first navigation,
	// which `page.emulateMedia` after `goto` would not guarantee for a component
	// that reads the query once.
	test.use({ contextOptions: { reducedMotion: 'reduce' } });

	test('scrollToThread brings an off-screen thread into view, the same way the control does (cinder#1316)', async ({
		page
	}) => {
		const anchoredId = await seedTall(page);

		// Back to the top first: creating that thread needed a real selection, and
		// focusing a ProseMirror view scrolls the caret into view.
		await page.evaluate(() => window.scrollTo(0, 0));
		await pressControl(page, 'scroll-to-thread');

		// PRECONDITION, asserted rather than assumed. If the page ever stops
		// putting this anchor below the fold, every assertion under it becomes
		// vacuous, and this is the line that says so instead of going quietly
		// green.
		const before = await scrollReport(page);
		expect(before.threadId).toBe(anchoredId);
		expect(before.before.anchorTop).not.toBeNull();
		expect(before.before.anchorTop!).toBeGreaterThan(before.before.viewportHeight);
		expect(before.threw).toBeNull();

		// FIXED (cinder#1316): `scrollToThread` now delegates to
		// `scrollAnchorIntoView`, the same `anchorElement.scrollIntoView(...)`
		// mechanism `scroll-into-view-control` below already used successfully —
		// so it no longer calls `view.dom.scrollTo` at all (that call is gone
		// from the implementation entirely, not merely a guard that now passes),
		// which is why this asserts the observable RESULT — something scrolled,
		// and the anchor lands in view — rather than which private method got
		// called. Polled rather than read once: `getScrollBehavior()` still
		// returns 'instant' under this describe block's `reducedMotion: 'reduce'`
		// context option, so this should already be true on the first read, but
		// polling costs nothing and removes any cross-engine timing assumption.
		await expect.poll(async () => (await scrollReport(page)).moved).toBe(true);
		const after = await scrollReport(page);
		expect(after.after.anchorTop).not.toBeNull();
		expect(after.after.anchorTop!).toBeGreaterThan(0);
		expect(after.after.anchorTop!).toBeLessThan(after.after.viewportHeight);

		// Focus does not move. RE-4 asks for it to land "somewhere sensible and
		// assertable"; it lands nowhere, and the trigger keeps it — unchanged by
		// the fix, and not one of the two things cinder#1316/#1317 were about.
		expect(after.before.active).toBe('scroll-to-thread');
		expect(after.after.active).toBe('scroll-to-thread');

		// The CONTROL, and the reason none of the above is a fixture artefact: the
		// same anchor, scrolled by the exact same `scrollIntoView` mechanism,
		// lands in the same place `scrollToThread` now reaches on its own. With
		// the fix, the two converge instead of only the control succeeding.
		await page.getByTestId('scroll-into-view-control').click();
		const control = await scrollReport(page);
		expect(control.moved).toBe(true);
		expect(control.after.anchorTop!).toBeGreaterThan(0);
		expect(control.after.anchorTop!).toBeLessThan(control.after.viewportHeight);
	});

	test('scrollToThread on an orphaned thread issues no scroll at all, rather than scrolling to position 0', async ({
		page
	}) => {
		await seedTall(page);

		// The seeded orphan sits at from/to 0/0 — a VALID ProseMirror position,
		// which is exactly why this needs a status guard and not a bounds check.
		// Without one, `coordsAtPos(0)` answers with coordinates at the top of the
		// document and the component scrolls there as if it had found the thread.
		const orphan = (await tallAnchors(page)).find((row) => row.id === TALL_ORPHAN_ID)!;
		expect(orphan).toBeDefined();
		expect(orphan.status).toBe('orphaned');
		expect(orphan.from).toBe(0);
		expect(orphan.to).toBe(0);

		await pressControl(page, 'scroll-to-orphan');

		const report = await scrollReport(page);
		expect(report.threw).toBeNull();
		// ZERO calls, not "a call that did nothing". `anchorCoords` returns null
		// for an orphaned anchor before it computes anything, and `scrollToThread`
		// scrolls only when coords come back — so whether `view.dom.scrollTo` was
		// reached at all is the one observable that distinguishes the guard being
		// present from the guard being deleted.
		expect(report.calls).toBe(0);
		expect(report.moved).toBe(false);
	});

	test('scrollToThread with an unknown id throws, rather than failing invisibly (cinder#1317)', async ({
		page
	}) => {
		const anchoredId = await seedTall(page);

		await pressControl(page, 'scroll-to-thread');
		const succeeded = await scrollReport(page);
		expect(succeeded.threadId).toBe(anchoredId);
		expect(succeeded.threw).toBeNull();

		await pressControl(page, 'scroll-to-unknown');
		const failed = await scrollReport(page);
		expect(failed.threadId).toBe('no-such-thread');

		// FIXED (cinder#1317): a known id and an unknown one are no longer
		// indistinguishable from outside. `scrollToThread` now throws
		// `ReviewEditor.scrollToThread: no thread with id "..."` for an unknown
		// id, and the page's `runScroll` wrapper (which calls the method inside a
		// try/catch, per its own comment above `scrollReport`) surfaces that as
		// `threw` rather than swallowing it — so the thrown error is observable
		// through the same wrapper a consumer's own error boundary would see.
		expect(failed.threw).not.toBeNull();
		expect(failed.threw).toContain('no thread with id "no-such-thread"');
		expect(failed.returned).toBe('(threw)');
		// And the known-id call above is unaffected: it still throws nothing and
		// still resolves to `undefined`, the same as before the fix.
		expect(succeeded.returned).toBe('undefined');
	});

	test("getEditor hands back this instance's own live Milkdown editor", async ({ page }) => {
		await page.getByTestId('read-editor-identity').click();
		const identity = await editorIdentity(page);

		expect(identity.present).toBe(true);
		expect(identity.actionThrew).toBeNull();
		// From Milkdown's own `EditorStatus` enum. A stub, a plain object, or a
		// half-torn-down editor all report something else here.
		expect(identity.status).toBe('Created');
		expect(identity.stableAcrossCalls).toBe(true);
		// `action` runs its callback against the editor's own `Ctx` and hands back
		// the result, so this is an identity check rather than a liveness guess —
		// and it needs no ctx slice key imported into the page to make it.
		expect(identity.actionCtxIsEditorCtx).toBe(true);
		// PER INSTANCE, which a non-null assertion cannot tell from a module-level
		// singleton: the two ReviewEditors that expose this readout hand back two
		// different editors, addressing two documents of different sizes.
		expect(identity.distinctFromOtherInstance).toBe(true);
		expect(identity.viewDocSize).not.toBe(identity.otherViewDocSize);
	});
});

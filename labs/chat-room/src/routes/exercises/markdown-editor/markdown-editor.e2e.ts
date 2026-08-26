import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { gotoHydrated } from '../hydration';
import { pressNextTabStop } from '../keyboard';

// ROADMAP ME-1: the standalone MarkdownEditor at
// `@lostgradient/editor/markdown-editor` — the component ReviewEditor composes,
// and the one whose seven imperative methods this repo had never driven directly.
//
// What is worth knowing before reading the assertions, because the method names
// mislead in three places:
//
//  1. `getSelection()` returns ProseMirror positions and NOTHING else. The
//     `sourcePosition` field its own type declares is never populated by this
//     component, and there is no `doc.textBetween()` offset in the return value —
//     unlike a ReviewEditor anchor, which carries both spaces in one object. The
//     offset here is derived by the page, and the two numbers are asserted side
//     by side precisely so they cannot be conflated.
//  2. `getAst()` depends on a SECOND async path. `data-ready` reports the
//     Milkdown attachment; the mdast pipeline arrives on an unrelated dynamic
//     import and nothing sequences them, so `getAst()` can throw after the editor
//     is demonstrably ready.
//  3. The `plugins` prop is read once, under `untrack()`, when the editor
//     attachment is created. It looks reactive and is not.
//
// Two upstream fixes are pinned here on the component that actually implements
// them rather than through ReviewEditor, which is where this repo pinned them
// before: `aria-readonly` mirroring (cinder#1292) lives in
// `dist/editor/editor.js`'s `applyReadonlyAria`, and the live-selection
// notification (cinder#1289) in the same file's selection listener. Driving them
// through ReviewEditor proves the composition forwards a prop; driving them here
// proves the base component owns the behaviour.

const ROUTE = '/exercises/markdown-editor';

const MAIN_ID = 'markdown-editor-main';
const READONLY_ID = 'markdown-editor-readonly';

const HEADING = 'Release Plan';
const PARAGRAPH_ONE = 'The first release includes a dashboard, export actions, and inline review.';
const PARAGRAPH_TWO =
	'Reviewers should verify that the export dialog copy matches the product brief before we ship.';
const PARAGRAPH_THREE = 'Timeline risk: the migration script is untested.';
const INITIAL = `### ${HEADING}\n\n${PARAGRAPH_ONE}\n\n${PARAGRAPH_TWO}\n\n${PARAGRAPH_THREE}`;
const REPLACEMENT = '# Replaced Plan\n\nOnly one paragraph now.';

const MARKER = 'dashboard';
const PROBE_A = 'me-probe-a';
const PROBE_B = 'me-probe-b';

// Duplicated from the page's fixture comment on purpose: these are independent
// arithmetic claims about the same document, not readouts of a number the
// component produced. `doc.content.size` of 235 is the empirical check on all of
// them — if the markdown parser built a different node structure, no other
// position below could be right either.
const QUOTE_FROM = 44;
const QUOTE_TO = 53;
const QUOTE_OFFSET = 42;
const HEADING_FROM = 1;
const HEADING_TO = 13;
const DOC_SIZE = 235;

type SelectionReadout = {
	selection: { from: number; to: number; isCollapsed: boolean } | null;
	sourcePosition: unknown;
	derived: { offset: number; length: number; quote: string } | null;
};

type AstReadout = {
	type: string | null;
	children: { type: string; depth: number | null; text: string }[];
};

// `.trim()` on both, because a readout whose expression prettier wraps onto its
// own line carries the surrounding indentation inside the element. `JSON.parse`
// tolerates that and `split('|')` emphatically does not — an untrimmed empty
// events readout returns `['\n\t\t']` rather than `[]`, which is a green
// "cleared" assertion over a list that was never read correctly.
const json = async <T>(page: Page, testId: string): Promise<T> =>
	JSON.parse(((await page.getByTestId(testId).textContent()) ?? '').trim() || 'null');

const selectionEvents = async (page: Page): Promise<string[]> => {
	const raw = ((await page.getByTestId('selection-events').textContent()) ?? '').trim();
	return raw.length ? raw.split('|') : [];
};

/**
 * Navigate and wait until BOTH editors have mounted.
 *
 * Called per test rather than from a file-level `beforeEach`, because the SSR
 * test below reads raw bytes and must not pay for two Milkdown boots to do it.
 * The gate itself is not optional: every control on the page reaches through
 * `bind:this`, and a call made before the attachment reports in returns null
 * readouts that read exactly like component defects.
 */
async function ready(page: Page): Promise<void> {
	await gotoHydrated(page, ROUTE);
	await expect(page.locator('[data-testid="main-editor"][data-ready="true"]')).toHaveCount(1);
	await expect(page.locator('[data-testid="readonly-editor"][data-ready="true"]')).toHaveCount(1);
	await expect(page.locator(`#${MAIN_ID} .ProseMirror`)).toBeVisible();
	await expect(page.locator(`#${READONLY_ID} .ProseMirror`)).toBeVisible();
}

/**
 * Read the AST, retrying until the markdown pipeline has resolved.
 *
 * This polls an OBSERVABLE condition — the `ast-error` readout emptying — rather
 * than sleeping past a guess. It exists because pipeline readiness has no signal
 * of its own: `data-ready` (already asserted by `ready`) reports the Milkdown
 * attachment, and the pipeline is a separate dynamic import that can land after
 * it. A single click here would be legitimately flaky, and the flake would read
 * as a component defect rather than as the documented trap it is.
 *
 * Both halves of the condition are load-bearing. `ast-error` starts empty, so an
 * "error is empty" poll alone would be satisfied by a sample taken before the
 * first click's outcome reached the DOM — and the caller would then read a
 * `null` AST and fail for a reason that has nothing to do with the pipeline.
 */
async function readAstWhenReady(page: Page): Promise<void> {
	await expect
		.poll(async () => {
			await page.getByTestId('read-ast').click();
			return {
				error: await page.getByTestId('ast-error').textContent(),
				parsed: (await page.getByTestId('ast-json').textContent()) !== 'null'
			};
		})
		.toEqual({ error: '', parsed: true });
}

test.describe('markdown-editor: what the server sends', () => {
	test('the server renders the wrapper and a skeleton, and none of the editor', async ({
		request
	}) => {
		// Raw bytes, so this is the markup a crawler, a no-JS reader, and the first
		// paint all see — before any client module has run.
		const response = await request.get(ROUTE);
		expect(response.ok()).toBe(true);
		const html = await response.text();

		// Both wrappers and their state attributes ship from the server.
		expect(html).toContain('data-testid="main-editor"');
		expect(html).toContain('data-testid="readonly-editor"');
		expect(html).toContain('data-initializing');
		expect(html).toContain('data-mode="wysiwyg"');

		// The editor itself does not: the ProseMirror host, the source textarea AND
		// the toolbar all sit behind `{#if browser}` / `&& browser`, so the server
		// emits a skeleton in their place and the client renders the other branch.
		// That branch swap is a real structural difference between the two renders,
		// which is why this route belongs in `HYDRATING_ROUTES` rather than being
		// assumed clean.
		expect(html).not.toMatch(/class="[^"]*\bProseMirror\b/);
		expect(html).not.toContain('role="application"');
		expect(html).toContain('aria-label="Loading editor"');

		// The toolbar is gated on `browser` too, so the `toolbarActions` snippet —
		// this page's only content inside it — cannot have rendered.
		expect(html).not.toContain('data-testid="toolbar-context"');

		// `data-ready` is the mount gate and is emitted as `undefined`, i.e. omitted
		// entirely, until the attachment reports in. Nothing else on this page emits
		// that attribute (`data-readonly` is browser-gated and is not a substring of
		// it), so a bare substring check is both sufficient and exact.
		expect(html).not.toContain('data-ready');
	});
});

test.describe('markdown-editor: the imperative handle', () => {
	test('getView returns the live ProseMirror view, whose dom sits inside the application host', async ({
		page
	}) => {
		await ready(page);
		await page.getByTestId('read-view').click();
		const view = await json<{
			present: boolean;
			docSize: number | null;
			domIsProseMirror: boolean | null;
			domIsHost: boolean;
			domInsideHost: boolean;
			editable: boolean | null;
		}>(page, 'view-json');

		expect(view.present).toBe(true);
		expect(view.editable).toBe(true);

		// The empirical check on every position this file asserts: four block nodes
		// costing two boundary tokens each, plus 12 + 74 + 93 + 48 characters,
		// computed from the fixture rather than read back. A parser that nested the
		// document differently — the reason the fixture bans lists — fails here
		// first, before any position assertion could pass for the wrong reason.
		expect(view.docSize).toBe(DOC_SIZE);

		// `getView().dom` is the contenteditable INSIDE the `role="application"`
		// host, not the host. The host carries `tabindex="0"` and the same `id`, so
		// it looks like the editing surface and is not one.
		expect(view.domIsProseMirror).toBe(true);
		expect(view.domIsHost).toBe(false);
		expect(view.domInsideHost).toBe(true);
	});

	test('getEditor returns a live Milkdown editor whose action runs against its own ctx', async ({
		page
	}) => {
		await ready(page);
		await page.getByTestId('read-editor').click();
		const editor = await json<{
			present: boolean;
			actionResult: string | null;
			actionCtxIsEditorCtx: boolean;
		}>(page, 'editor-json');

		expect(editor.present).toBe(true);
		// `present` alone would pass against any non-null object. Running
		// `editor.action(...)` and getting the editor's OWN `ctx` back is what
		// separates a live Milkdown instance from a stub: `action` is implemented as
		// `(fn) => fn(this.#ctx)`, and `editor.ctx` is a getter over the same field.
		expect(editor.actionResult).toBe('ran');
		expect(editor.actionCtxIsEditorCtx).toBe(true);
	});

	test('focus lands on the editing surface rather than the application host', async ({ page }) => {
		await ready(page);
		const button = page.getByTestId('focus-editor');
		await button.focus();
		await button.press('Enter');

		const focus = await json<{
			tag: string | null;
			isProseMirror: boolean;
			isHost: boolean;
			insideMainEditor: boolean;
		}>(page, 'focus-json');

		expect(focus.insideMainEditor).toBe(true);
		// The distinction that matters: `focus()` delegates to `view.focus()`, which
		// focuses the contenteditable. Landing on the wrapping `role="application"`
		// div instead would still satisfy `insideMainEditor`, and would put a screen
		// reader into application mode over a node that accepts no text.
		expect(focus.isProseMirror).toBe(true);
		expect(focus.isHost).toBe(false);

		// Announced, because this is the one control on the page that moves focus on
		// purpose and a keyboard user who pressed it has no other way to know.
		await expect(page.getByTestId('announcement')).toHaveText(
			/focus: focus moved into the editing surface/
		);
	});

	test('getMarkdown and setMarkdown round-trip the document, and the binding catches up', async ({
		page
	}) => {
		await ready(page);
		await page.getByTestId('read-markdown').click();
		// `.trim()` rather than an exact byte match: the serializer owns trailing
		// whitespace, and pinning its newline policy here would make this test fail
		// for a reason that has nothing to do with either method.
		expect((await json<string>(page, 'markdown-json')).trim()).toBe(INITIAL);

		await page.getByTestId('set-markdown').click();
		expect((await json<string>(page, 'markdown-json')).trim()).toBe(REPLACEMENT);
		await expect(page.locator(`#${MAIN_ID} .ProseMirror h1`)).toHaveText('Replaced Plan');

		// The bound `value` is a SEPARATE question from what the editor holds, and it
		// arrives late by design: an imperative `setMarkdown` writes straight into
		// ProseMirror, and `value` only moves once the change comes back out through
		// Milkdown's own 200ms listener debounce and then the editor package's 300ms
		// `onchange` debounce. Polling measures that chain; a fixed wait would be a
		// guess at the sum of two debounces this test does not own.
		await expect
			.poll(async () => (await json<string>(page, 'value-json')).trim())
			.toBe(REPLACEMENT);
	});

	test('setMarkdown falls back to the bound value when no editor is mounted', async ({ page }) => {
		await ready(page);
		// Source mode is the deterministic way to reach `setMarkdown`'s OTHER branch.
		// Switching to source tears the Milkdown instance down and sets the
		// component's `editorState` to null, so `setMarkdown` takes the
		// `value = content` path — synchronously, with none of the debounce chain the
		// wysiwyg branch goes through.
		await page.getByTestId('mode-source').click();
		const textarea = page.locator(`textarea#${MAIN_ID}`);
		await expect(textarea).toBeVisible();

		await page.getByTestId('set-markdown').click();
		// Exact, not trimmed: this branch assigns the string it was given, so any
		// difference at all would be the component reformatting behind a consumer's
		// back.
		await expect(textarea).toHaveValue(REPLACEMENT);
		expect(await json<string>(page, 'value-json')).toBe(REPLACEMENT);
		// And `getMarkdown()` answers from the same fallback — it is
		// `editorState?.getMarkdown() ?? value`, so it keeps working with no editor
		// mounted at all.
		expect(await json<string>(page, 'markdown-json')).toBe(REPLACEMENT);
	});

	test('getAst parses the live document, not the value it was mounted with', async ({ page }) => {
		await ready(page);
		await readAstWhenReady(page);
		const initial = await json<AstReadout>(page, 'ast-json');
		expect(initial.type).toBe('root');
		expect(initial.children).toEqual([
			{ type: 'heading', depth: 3, text: HEADING },
			{ type: 'paragraph', depth: null, text: PARAGRAPH_ONE },
			{ type: 'paragraph', depth: null, text: PARAGRAPH_TWO },
			{ type: 'paragraph', depth: null, text: PARAGRAPH_THREE }
		]);

		// The half that makes this more than "an AST came back": replace the document
		// and the AST must follow. `getAst()` is `parseOrThrow(getMarkdown())`, so an
		// implementation that parsed the mounted `value` instead would still return a
		// perfectly valid root here — with the wrong contents, and with its heading
		// at the wrong depth.
		await page.getByTestId('set-markdown').click();
		await readAstWhenReady(page);
		const replaced = await json<AstReadout>(page, 'ast-json');
		expect(replaced.children).toEqual([
			{ type: 'heading', depth: 1, text: 'Replaced Plan' },
			{ type: 'paragraph', depth: null, text: 'Only one paragraph now.' }
		]);
	});
});

test.describe('markdown-editor: the two coordinate spaces', () => {
	test('getSelection reports ProseMirror positions, and the textBetween offset is a different number', async ({
		page
	}) => {
		await ready(page);
		await page.getByTestId('select-quote').click();
		const quoted = await json<SelectionReadout>(page, 'selection-json');

		// SPACE ONE — ProseMirror positions, which is all `getSelection()` returns.
		expect(quoted.selection).toEqual({ from: QUOTE_FROM, to: QUOTE_TO, isCollapsed: false });

		// SPACE TWO — `doc.textBetween()` offsets, derived by the page because the
		// method returns none. For this selection they are 42 and 9 against positions
		// 44 and 53: the offset trails the position by the two block boundary tokens
		// the heading and paragraph-one nodes contribute, and the length is a
		// character count rather than a difference of positions.
		expect(quoted.derived).toEqual({ offset: QUOTE_OFFSET, length: MARKER.length, quote: MARKER });

		// Stated as inequalities as well as literals, so the pair cannot both drift
		// to one value and keep passing.
		expect(quoted.selection!.from).not.toBe(quoted.derived!.offset);
		expect(quoted.selection!.from).toBeGreaterThan(quoted.derived!.offset);
		expect(quoted.selection!.to - quoted.selection!.from).toBe(quoted.derived!.length);

		// `EditorSelection` declares `sourcePosition` as "mapped to mdast position
		// via bridge (when available)". MarkdownEditor never populates it — the
		// bridge that computes one is on no path this component takes — so a consumer
		// reading it gets `undefined` with nothing to warn them. Pinned as the
		// current behaviour, not endorsed as the right one.
		expect(quoted.sourcePosition).toBeNull();

		// The heading is the weaker demonstration and is here as the control: 1
		// against 0 and 13 against 12 differ by exactly one boundary token, small
		// enough that a coordinate-space mixup could pass unnoticed. It is the
		// paragraph-one selection above that separates the two spaces by 2.
		await page.getByTestId('select-heading').click();
		const heading = await json<SelectionReadout>(page, 'selection-json');
		expect(heading.selection).toEqual({ from: HEADING_FROM, to: HEADING_TO, isCollapsed: false });
		expect(heading.derived).toEqual({ offset: 0, length: HEADING.length, quote: HEADING });

		// A collapsed caret is the third shape the method reports, and the only one
		// where `from === to` carries meaning.
		await page.getByTestId('collapse-caret').click();
		const caret = await json<SelectionReadout>(page, 'selection-json');
		expect(caret.selection).toEqual({ from: QUOTE_FROM, to: QUOTE_FROM, isCollapsed: true });
		expect(caret.derived).toEqual({ offset: QUOTE_OFFSET, length: 0, quote: '' });
	});

	test('one dispatch is enough for onselectionchange to carry the live selection', async ({
		page
	}) => {
		await ready(page);
		// REGRESSION PIN for cinder#1288/#1289, on the component that owns the code.
		// Milkdown's listener fires `selectionUpdated` from inside `state.apply(tr)`,
		// where `view.state` is still the PREVIOUS state — so a listener reading
		// `view.state.selection` reported the selection from one transaction ago.
		// `@lostgradient/editor@0.9.1` hands the listener `tr.selection` instead.
		//
		// `getSelection()` was never affected, and is asserted alongside for exactly
		// that reason: it reads `view.state` at CALL time, by which point the view
		// has been updated. The two surfaces agreeing is the fix; assuming they
		// always did is the mistake this pins.
		await page.getByTestId('clear-selection-events').click();
		await expect(page.getByTestId('selection-events')).toHaveText('');

		// ONE selection-changing dispatch, through the page's `getView()` path.
		await page.getByTestId('select-quote').click();

		await expect
			.poll(async () => (await selectionEvents(page)).at(-1))
			.toBe(`${QUOTE_FROM}:${QUOTE_TO}:false`);

		const readback = await json<SelectionReadout>(page, 'selection-json');
		expect(readback.selection).toEqual({ from: QUOTE_FROM, to: QUOTE_TO, isCollapsed: false });
	});
});

test.describe('markdown-editor: the plugin seam', () => {
	test('a plugin passed through the plugins prop decorates the live document', async ({ page }) => {
		await ready(page);
		const probe = page.locator(`#${MAIN_ID} .ProseMirror .${PROBE_A}`);
		await expect(probe).toHaveCount(1);
		await expect(probe).toHaveText(MARKER);

		// The plugin found the marker by scanning `state.doc` itself, with no
		// knowledge of this file's arithmetic; the selection below reaches the same
		// text from hand-computed positions 44..53. Two independent derivations of
		// one range agreeing is what makes either of them credible.
		await page.getByTestId('select-quote').click();
		const selection = await json<SelectionReadout>(page, 'selection-json');
		expect(selection.derived!.quote).toBe(await probe.textContent());
	});

	test('reassigning the plugins prop is inert, and only a remount applies a new array', async ({
		page
	}) => {
		await ready(page);
		// The genuinely surprising half of this seam. `plugins` is read once, inside
		// `untrack()`, when the editor attachment is created
		// (`dist/editor/attach.js`), so the prop looks reactive and is not. A consumer
		// swapping decorations at runtime gets silence.
		const original = page.locator(`#${MAIN_ID} .${PROBE_A}`);
		const replacement = page.locator(`#${MAIN_ID} .${PROBE_B}`);
		const readyCount = page.getByTestId('ready-count');

		await expect(original).toHaveCount(1);
		await expect(replacement).toHaveCount(0);
		await expect(readyCount).toHaveText('1');

		await page.getByTestId('swap-plugins').click();

		// The load-bearing assertion is that the ORIGINAL decoration survives, not
		// that the new one is missing. An implementation that re-created the editor
		// would tear the old ProseMirror DOM down synchronously and rebuild it
		// asynchronously, so "the new one is absent" is momentarily true even when
		// the swap did take effect.
		await expect(original).toHaveCount(1);
		await expect(original).toHaveText(MARKER);
		await expect(replacement).toHaveCount(0);
		// The second, independent observable: a re-created editor reports ready
		// again. This is what separates "the swap was ignored" from "the swap is
		// still in flight".
		await expect(readyCount).toHaveText('1');
		await expect(page.getByTestId('announcement')).toHaveText(
			/still shows 1 decoration from the original plugin and 0 decorations from the new one/
		);

		// A remount re-runs the attachment, which re-reads the getter — so the array
		// that was inert a moment ago now applies in full.
		await page.getByTestId('remount-editor').click();
		await expect(readyCount).toHaveText('2');
		await expect(replacement).toHaveCount(1);
		await expect(replacement).toHaveText(MARKER);
		await expect(original).toHaveCount(0);
	});
});

test.describe('markdown-editor: mode and the toolbar context', () => {
	test('bind:mode swaps the surface in both directions and the document survives', async ({
		page
	}) => {
		await ready(page);
		const wrapper = page.getByTestId('main-editor');
		await expect(wrapper).toHaveAttribute('data-mode', 'wysiwyg');

		await page.getByTestId('mode-source').click();
		await expect(wrapper).toHaveAttribute('data-mode', 'source');
		// The same `id` now belongs to a textarea rather than the application host —
		// the surface is genuinely replaced, not hidden.
		await expect(page.locator(`#${MAIN_ID} .ProseMirror`)).toHaveCount(0);
		// Trimmed: entering source mode canonicalises the document through the
		// markdown pipeline first, and the pipeline owns trailing whitespace.
		await expect
			.poll(async () => (await page.locator(`textarea#${MAIN_ID}`).inputValue()).trim())
			.toBe(INITIAL);
		await expect(page.getByTestId('mode-events')).toHaveText('source');

		await page.getByTestId('mode-wysiwyg').click();
		await expect(wrapper).toHaveAttribute('data-mode', 'wysiwyg');
		await expect(page.locator(`#${MAIN_ID} .ProseMirror h3`)).toHaveText(HEADING);
		await expect(page.getByTestId('mode-events')).toHaveText('source|wysiwyg');
		// Round-tripped through the raw-markdown surface and back unchanged.
		expect((await json<string>(page, 'value-json')).trim()).toBe(INITIAL);
	});

	test("the component's own mode toggle writes back through the binding", async ({ page }) => {
		await ready(page);
		// The other direction. The test above drives `mode` from the page and watches
		// the component follow; this one drives the component's shipped control and
		// watches the page's own `$state` follow, which is the half a one-way prop
		// would still satisfy.
		await expect(page.getByTestId('mode-readout')).toHaveText('wysiwyg');
		await page.locator(`#${MAIN_ID}-mode-toggle [aria-label="Raw Markdown"]`).click();
		await expect(page.getByTestId('mode-readout')).toHaveText('source');
		await expect(page.getByTestId('main-editor')).toHaveAttribute('data-mode', 'source');
	});

	test('the toolbarActions snippet receives a ToolbarContext that tracks the editor', async ({
		page
	}) => {
		await ready(page);
		const context = page.getByTestId('toolbar-context');
		// `editorContext` is null until the attachment reports ready and non-null
		// after, so this is the snippet seeing the real editor rather than a
		// placeholder.
		await expect(context).toHaveText('ctx=yes undo=false redo=false ro=false');

		// `canUndo` derives from ProseMirror's history depth, and the derivation reads
		// `value` — which only moves after Milkdown's 200ms listener debounce and the
		// package's 300ms `onchange` debounce. Polling measures that chain; a fixed
		// wait would be a guess at its total.
		await page.getByTestId('focus-editor').click();
		await page.keyboard.type('Draft. ');
		await expect(context).toHaveText(/undo=true/);
		await expect(context).toHaveText(/ctx=yes/);
	});
});

test.describe('markdown-editor: readonly', () => {
	test('readonly is mirrored onto the ProseMirror node as aria-readonly', async ({ page }) => {
		await ready(page);
		// REGRESSION PIN for cinder#1292, asserted on the component that implements
		// it. `editable: () => false` gives the node `contenteditable="false"`, which
		// stops edits but conveys nothing: Chromium still computes the textbox as
		// `readonly=false, settable=true`, so a screen reader announces an ordinary
		// editable field that silently ignores typing.
		//
		// It has to be on `view.dom`. The wrapping `role="application"` host carries
		// no textbox role and ARIA states do not inherit down to the node that does —
		// which is what the originally-filed version of that fix got wrong.
		const readonlySurface = page.locator(`#${READONLY_ID} .ProseMirror`);
		const editableSurface = page.locator(`#${MAIN_ID} .ProseMirror`);

		await expect(readonlySurface).toHaveAttribute('aria-readonly', 'true');
		await expect(readonlySurface).toHaveAttribute('contenteditable', 'false');
		// The editable instance is the control. Without it this would pass against a
		// component that set the attribute unconditionally.
		await expect(editableSurface).not.toHaveAttribute('aria-readonly', 'true');
		await expect(editableSurface).toHaveAttribute('contenteditable', 'true');
	});

	test('a readonly editor renders no toolbar but still reports its toolbar context', async ({
		page
	}) => {
		await ready(page);
		const readonlyWrapper = page.getByTestId('readonly-editor');
		// `toolbarVisible` is `showToolbar && !readonly && …`, so readonly removes the
		// toolbar outright rather than disabling it.
		await expect(readonlyWrapper).not.toHaveAttribute('data-has-toolbar', 'true');
		await expect(readonlyWrapper.locator('.editor-toolbar')).toHaveCount(0);
		// …and the editable instance proves that absence is the `readonly` prop's
		// doing rather than the toolbar never rendering on this page at all.
		await expect(page.getByTestId('main-editor')).toHaveAttribute('data-has-toolbar', 'true');

		// `ontoolbarcontextchange` is therefore the ONLY route to that state for a
		// readonly editor, which makes it the callback a consumer hosting its own
		// formatting controls depends on. It still fires, with a real Ctx and the
		// readonly flag set.
		await expect(page.getByTestId('ro-toolbar-context')).toHaveText(
			'ctx=yes undo=false redo=false ro=true'
		);
	});
});

test.describe('markdown-editor: keyboard and announcements', () => {
	test('Tab moves focus out of the editing surface', async ({ page, browserName }) => {
		await ready(page);
		const focusIsInsideEditor = () =>
			page.evaluate(
				(id) => document.getElementById(id)?.contains(document.activeElement) ?? false,
				MAIN_ID
			);

		await page.getByTestId('focus-editor').click();
		await expect.poll(focusIsInsideEditor).toBe(true);

		await pressNextTabStop(page, browserName);
		await expect.poll(focusIsInsideEditor).toBe(false);

		// What this does and does not prove, stated because the obvious reading is
		// wrong. Milkdown's keymap DOES bind Tab — to `sinkListItemCommand` — and
		// only declines the key, letting the browser move focus, when that command
		// cannot apply. This fixture has no lists, so the command always declines and
		// Tab always escapes. The Escape-then-Tab latch the same keymap carries
		// exists for the case this fixture deliberately avoids and is NOT exercised
		// here; testing it needs a document with a list, whose ProseMirror positions
		// would be parser-dependent and would break every coordinate assertion above.
	});

	test('a repeated identical announcement still re-announces', async ({ page }) => {
		await ready(page);
		// `aria-live` fires on CHANGE. `getMarkdown` announces a pure function of the
		// document, so pressing it twice with nothing edited in between produces the
		// same words — and without the clear-then-set transition the page performs,
		// Svelte writes an identical string, the DOM never changes, and a screen
		// reader hears nothing the second time. On a page whose controls all report
		// values, re-pressing to check is the obvious move.
		//
		// `toHaveText` cannot see this: it polls for a final string and stays green
		// with the transition deleted. Only counting real DOM mutations of the live
		// region can, which is what `announce-mutations` does via MutationObserver.
		const mutations = () =>
			page
				.getByTestId('announce-mutations')
				.textContent()
				.then((raw) => Number(raw ?? '0'));

		const before = await mutations();
		await page.getByTestId('read-markdown').click();
		await expect.poll(mutations).toBeGreaterThan(before);
		const afterFirst = await mutations();

		await page.getByTestId('read-markdown').click();
		await expect.poll(mutations).toBeGreaterThan(afterFirst);
		await expect(page.getByTestId('announcement')).toHaveText(/getMarkdown: \d+ characters/);
	});

	test('the page keeps one h1 after hydration, rather than one per editor', async ({ page }) => {
		await ready(page);
		// Each editor renders its document's first heading at the authored level, so a
		// `#` fixture would add an `h1` per instance — nested inside `h2` sections,
		// and invisible to SSR because the editors server-render a skeleton. The
		// fixtures use `###` for exactly this reason, and asserting it after
		// hydration is the only place the choice is observable.
		await expect(page.locator('h1')).toHaveCount(1);
		await expect(page.locator('h1')).toHaveText('Markdown Editor');
		await expect(page.locator(`#${MAIN_ID} .ProseMirror h3`)).toHaveText(HEADING);
		await expect(page.locator(`#${READONLY_ID} .ProseMirror h3`)).toHaveText('Published Reference');
	});
});

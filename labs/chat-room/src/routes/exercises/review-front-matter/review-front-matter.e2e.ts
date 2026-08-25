import { expect, test } from '@playwright/test';
import { applyPatchInTempRepo } from '../git-apply';
import { gotoHydrated } from '../hydration';
import type { Browser, Page } from '@playwright/test';

// Pins how `ReviewEditor` detects YAML front matter, what controls it generates
// from it, and what a single-field edit costs the rest of the document.
//
// Front matter is not a cosmetic extra here: `parseFrontMatter` splits the
// document, the inner editor is handed only the BODY, and every position the
// component publishes is therefore shifted by `bodyOffset` (the character
// length of the block plus delimiters). Recognition, the field controls, the
// rewrite-on-edit, the anchor remap, and the unified diff's handling of the
// block are the same mechanism at four distances, which is why they share a
// route.
//
// Values are read from `data-value` attributes carrying `JSON.stringify(value)`
// rather than from element text. Playwright's text matchers collapse whitespace
// runs (hiding `  owner: maya`'s indentation) and the HTML parser rewrites
// `\r\n` to `\n` inside element text (silently "fixing" the CRLF fixture);
// `toHaveAttribute` on a JSON-escaped string compares byte-for-byte.

// Eleven ReviewEditor fixtures live on the route. Waiting for every one to
// report `data-ready` matters: the front-matter controls render during SSR,
// before the inner Milkdown editor exists, so an interaction issued earlier
// could race the editor's own mount-time change handling.
const EDITOR_COUNT = 11;

const FULL_DOCUMENT = [
	'---',
	'title: Release Plan',
	'draft: true',
	'priority: 3',
	'tags:',
	'  - alpha',
	'  - beta',
	'meta:',
	'  owner: maya',
	'---',
	'',
	'# Release Plan',
	'',
	'Alpha line.'
].join('\n');

// What a SINGLE edit to `title` turns the block above into. Nothing else was
// touched, yet: keys are alphabetized, the block sequence under `tags` has
// collapsed to flow style, and the two-space indent under `meta` is the
// serializer's, not the author's. The body is untouched and reattached.
const REWRITTEN_FULL_DOCUMENT = [
	'---',
	'draft: true',
	'meta:',
	'  owner: maya',
	'priority: 3',
	'tags: [alpha, beta]',
	'title: Release Plan v2',
	'---',
	'',
	'# Release Plan',
	'',
	'Alpha line.'
].join('\n');

/**
 * `permissions` builds an explicit context instead of using `test.use`, which
 * configures the `page` FIXTURE — a describe-shared page from
 * `browser.newPage()` would not inherit it, and the clipboard read in the export
 * describe would fail on permission. Granting it per-describe rather than
 * file-wide also keeps the other nine describes free of a clipboard grant that
 * Firefox and WebKit do not both map.
 */
async function openFixture(browser: Browser, permissions?: string[]): Promise<Page> {
	const page = permissions
		? await (await browser.newContext({ permissions })).newPage()
		: await browser.newPage();
	await gotoHydrated(page, '/exercises/review-front-matter');
	await expect(page.locator('[data-testid="review-editor"][data-ready="true"]')).toHaveCount(
		EDITOR_COUNT
	);
	return page;
}

const frontMatterSection = (page: Page, editorId: string) =>
	page.locator(`section[aria-labelledby="${editorId}-front-matter-heading"]`);

test.describe('review front matter: recognition and generated controls', () => {
	// Read-only assertions share one page; the editing tests below get their own
	// so a rewrite here can never leak into an at-rest expectation there.
	let page: Page;

	test.beforeAll(async ({ browser }) => {
		page = await openFixture(browser);
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('front matter is only an exact `---` opener at byte 0 closed by a line of exactly `---`', async () => {
		// `----` is not the closer: the closing pattern is `^---[ \t]*\r?$`, so a
		// fourth dash fails the end-of-line anchor and the whole block stays body.
		await expect(
			page.getByTestId('fm-four-dash-wrapper').locator('section.review-editor-front-matter')
		).toHaveCount(0);
		// Proof it was treated as CONTENT rather than silently dropped: the YAML
		// text is rendered inside the editor (as a setext heading, since `----`
		// underlines the line above it).
		await expect(page.getByTestId('fm-four-dash-wrapper').locator('.ProseMirror')).toContainText(
			'title: x'
		);

		// YAML's own `...` document terminator is not a front-matter closer.
		await expect(
			page.getByTestId('fm-dots-wrapper').locator('section.review-editor-front-matter')
		).toHaveCount(0);
		await expect(page.getByTestId('fm-dots-wrapper').locator('.ProseMirror')).toContainText(
			'title: x'
		);

		// A single leading blank line is enough: `markdown.startsWith('---')` is
		// checked at byte 0 with no trimming.
		await expect(
			page.getByTestId('fm-leading-blank-wrapper').locator('section.review-editor-front-matter')
		).toHaveCount(0);
		await expect(
			page.getByTestId('fm-leading-blank-wrapper').locator('.ProseMirror')
		).toContainText('title: x');

		// Seven of the eleven fixtures have front matter. The three above fail on
		// DELIMITER shape (a fourth dash, a `...` closer, an opener not at byte
		// 0). A fourth fixture, `fm-bad` (exercised below, in the next describe),
		// fails on CONTENT shape instead: its YAML has a genuine syntax error.
		// cinder#1325/#1330 folded that case into the identical `hasFrontMatter:
		// false` outcome as an unrecognized delimiter, rather than the
		// "recognized but invalid, show a raw editor" state it used to produce —
		// see "malformed YAML — a genuine syntax error — is not recognized as
		// front matter at all" below for the detail.
		await expect(page.locator('section.review-editor-front-matter')).toHaveCount(EDITOR_COUNT - 4);
	});

	test('a CRLF document is recognized and its data parsed, and the CRLF survives in `value`', async () => {
		await expect(
			page.getByTestId('fm-crlf-wrapper').locator('section.review-editor-front-matter')
		).toHaveCount(1);
		await expect(page.locator('#fm-crlf-front-matter-title')).toHaveValue('x');
		await expect(page.locator('#fm-crlf-front-matter-draft')).toBeChecked();
		// The body really was split off, not just parsed alongside.
		await expect(page.getByTestId('fm-crlf-wrapper').locator('.ProseMirror')).toHaveText('Body.');
		await expect(page.getByTestId('fm-crlf-value')).toHaveAttribute(
			'data-value',
			JSON.stringify(['---', 'title: x', 'draft: true', '---', '', 'Body.'].join('\r\n'))
		);
	});

	test('the section renders above the editor, labelled by its own `h3`', async () => {
		const wrapper = page.getByTestId('fm-full-wrapper');
		const section = frontMatterSection(page, 'fm-full');
		await expect(section).toHaveCount(1);
		await expect(section).toHaveClass(/review-editor-front-matter/);

		const heading = page.locator('h3#fm-full-front-matter-heading');
		await expect(heading).toHaveText('Front matter');

		// Document order, asserted through locators rather than a pixel compare:
		// the two children match in DOM order, and the first is the section.
		const parts = wrapper.locator('section.review-editor-front-matter, .ProseMirror');
		await expect(parts).toHaveCount(2);
		await expect(parts.nth(0)).toHaveClass(/review-editor-front-matter/);
	});

	test('one control per key, id `<editor-id>-front-matter-<key>`, label equal to the raw key name', async () => {
		const section = frontMatterSection(page, 'fm-full');
		const controls = section.locator('input, textarea');

		// Source order, NOT alphabetical — the initial render walks
		// `Object.entries(data)`, which preserves the YAML document's order. The
		// alphabetizing only happens on the first edit (see the editing describe).
		await expect(controls).toHaveCount(5);
		await expect(controls.nth(0)).toHaveAttribute('id', 'fm-full-front-matter-title');
		await expect(controls.nth(1)).toHaveAttribute('id', 'fm-full-front-matter-draft');
		await expect(controls.nth(2)).toHaveAttribute('id', 'fm-full-front-matter-priority');
		await expect(controls.nth(3)).toHaveAttribute('id', 'fm-full-front-matter-tags');
		await expect(controls.nth(4)).toHaveAttribute('id', 'fm-full-front-matter-meta');

		// The label is the key verbatim — no title-casing, no humanizing.
		await expect(section.locator('label')).toHaveText([
			'title',
			'draft',
			'priority',
			'tags',
			'meta'
		]);
		// And it is a real accessible name, so role/label locators work. Scoping to
		// the wrapper is required: five fixtures each expose a `title` field.
		await expect(
			page.getByTestId('fm-full-wrapper').getByLabel('title', { exact: true })
		).toHaveAttribute('id', 'fm-full-front-matter-title');
	});

	test('controls are type-driven: boolean → checkbox, number and string → text input, array and object → textarea', async () => {
		const draft = page.locator('#fm-full-front-matter-draft');
		await expect(draft).toHaveAttribute('type', 'checkbox');
		await expect(draft).toBeChecked();

		// A number gets NO `type="number"` and no numeric affordances — it is an
		// ordinary text input whose value happens to be coerced back with
		// `Number()` on input.
		const priority = page.locator('#fm-full-front-matter-priority');
		await expect(priority).toHaveAttribute('type', 'text');
		await expect(priority).toHaveValue('3');

		const title = page.locator('#fm-full-front-matter-title');
		await expect(title).toHaveAttribute('type', 'text');
		await expect(title).toHaveValue('Release Plan');

		// The source YAML writes `tags` as a block sequence over three lines. The
		// textarea presents it in FLOW form, so what the author typed is already
		// gone from the UI before anyone edits anything.
		const tags = page.locator('textarea#fm-full-front-matter-tags');
		await expect(tags).toHaveValue('[alpha, beta]');

		// A nested mapping stays in block form, minus the parent key and its
		// indentation (`serializeYamlFieldValue` strips the synthetic `value:`).
		const meta = page.locator('textarea#fm-full-front-matter-meta');
		await expect(meta).toHaveValue('owner: maya');
	});

	test('with nothing edited the raw block round-trips byte-for-byte and `onchange` never fires', async () => {
		// Mounting the editor does not itself rewrite the document: the front
		// matter keeps its authored key order, block sequence, and spacing. This
		// is the baseline that makes the rewrite in the next describe legible as
		// damage rather than as normal churn.
		await expect(page.getByTestId('fm-full-value')).toHaveAttribute(
			'data-value',
			JSON.stringify(FULL_DOCUMENT)
		);
		await expect(page.getByTestId('fm-full-change-count')).toHaveText('0');
	});

	test('KNOWN BUG: empty front matter renders an empty raw YAML editor, never the empty-state paragraph', async () => {
		// `front-matter-fields.svelte` has a third branch that renders
		// `p.review-editor-front-matter__empty` ("No front matter fields.") when
		// there are no parsed fields AND `raw === null`. That branch is
		// unreachable: `parseReviewEditorFrontMatter` coerces a null `raw` to `''`
		// whenever `hasFrontMatter` is true (`parsed.raw ?? ''`), and the section
		// is only rendered when `hasFrontMatter` is true. So `raw` is never null
		// by the time the component sees it, `shouldShowRawYaml` is always taken
		// first, and the empty state is dead code. Pinned as-is; the paragraph
		// never appears anywhere on this route.
		await expect(page.locator('p.review-editor-front-matter__empty')).toHaveCount(0);

		const raw = page.locator('textarea#fm-empty-front-matter-raw');
		await expect(raw).toHaveValue('');
		// An empty string is valid YAML, so no error decoration accompanies it.
		await expect(raw).not.toHaveAttribute('aria-invalid', 'true');
		await expect(page.getByTestId('fm-empty-value')).toHaveAttribute(
			'data-value',
			JSON.stringify(['---', '---', '', 'Body.'].join('\n'))
		);
	});

	test('a YAML null renders as the literal four-character string `null` in a text input', async () => {
		// `empty:` (bare) and `nothing: null` (explicit) both parse to JS `null`,
		// so by the time the UI sees them the two spellings are indistinguishable
		// — and both are shown as the word "null" in a plain text box, which is
		// also exactly how the string "null" would be shown.
		const bare = page.locator('#fm-null-front-matter-empty');
		await expect(bare).toHaveAttribute('type', 'text');
		await expect(bare).toHaveValue('null');

		const explicit = page.locator('#fm-null-front-matter-nothing');
		await expect(explicit).toHaveAttribute('type', 'text');
		await expect(explicit).toHaveValue('null');
	});

	test('`mode="readonly"` disables every front-matter control', async () => {
		const controls = frontMatterSection(page, 'fm-readonly').locator('input, textarea');
		await expect(controls).toHaveCount(5);
		for (let index = 0; index < 5; index++) {
			await expect(controls.nth(index)).toBeDisabled();
		}
	});
});

test.describe('review front matter: what an edit rewrites', () => {
	// One page for the mutating tests. Order matters WITHIN a fixture: `fm-full`'s
	// two tests are a pair, and so are `fm-empty`'s two ("doubles as the way to
	// add a first field" must run before "the field controls cannot make the
	// YAML unparseable again", which relies on the `title` field the first test
	// creates). Playwright runs a file's tests serially in declaration order, so
	// the tests are ordered deliberately.
	let page: Page;

	test.beforeAll(async ({ browser }) => {
		page = await openFixture(browser);
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('editing one field rewrites the whole block: keys alphabetize and block sequences collapse to flow', async () => {
		await page.locator('#fm-full-front-matter-title').fill('Release Plan v2');

		// `title` was the only field touched. Everything else moved anyway,
		// because `stringifyFrontMatter` can only preserve the original raw text
		// when the data is byte-identical; the moment any key differs it
		// re-serializes the whole object through `serializeYaml`, which sorts keys
		// and renders simple string arrays inline.
		await expect(page.getByTestId('fm-full-value')).toHaveAttribute(
			'data-value',
			JSON.stringify(REWRITTEN_FULL_DOCUMENT)
		);

		// The controls re-order to match, so the field you just typed into jumps
		// somewhere else in the form.
		const controls = frontMatterSection(page, 'fm-full').locator('input, textarea');
		await expect(controls.nth(0)).toHaveAttribute('id', 'fm-full-front-matter-draft');
		await expect(controls.nth(1)).toHaveAttribute('id', 'fm-full-front-matter-meta');
		await expect(controls.nth(2)).toHaveAttribute('id', 'fm-full-front-matter-priority');
		await expect(controls.nth(3)).toHaveAttribute('id', 'fm-full-front-matter-tags');
		await expect(controls.nth(4)).toHaveAttribute('id', 'fm-full-front-matter-title');
	});

	test('the edited value flows back as a FULL document, and `onchange` receives it once', async () => {
		// The component recombines body and front matter before publishing, so
		// consumers never see a body-only string — `value` and the `onchange`
		// argument are the same complete document, delimiters included.
		await expect(page.getByTestId('fm-full-change-count')).toHaveText('1');
		await expect(page.getByTestId('fm-full-last-change')).toHaveAttribute(
			'data-value',
			JSON.stringify(REWRITTEN_FULL_DOCUMENT)
		);
	});

	test('malformed YAML — a genuine syntax error — is not recognized as front matter at all', async () => {
		// `title: [unclosed` opens a flow sequence that never closes: a genuine
		// YAML syntax error, not merely "valid YAML that isn't a mapping". Before
		// cinder#1325/#1330 this fixture's document still reported
		// `hasFrontMatter: true` with `data: null`, which used to select a raw
		// YAML fallback editor (and log a console warning — "Failed to parse
		// front matter: YAMLException…"). The same PR that stopped counting
		// non-object-but-valid YAML as front matter also folded a genuine parse
		// failure into the identical `hasFrontMatter: false` branch as an
		// unrecognized delimiter — `parseFrontMatter`'s `catch` block, not its
		// `!isRecord` branch. Verified directly against the installed
		// `@lostgradient/markdown`, calling `parseFrontMatter` on this fixture's
		// exact document: it now returns `{ hasFrontMatter: false, body: <the
		// whole document> }`. There is no longer a raw-editor-for-invalid-content
		// state reachable from this fixture at all, and no console warning fires
		// either — the `catch` block is silent.
		await expect(frontMatterSection(page, 'fm-bad')).toHaveCount(0);

		// Proof it's content, not silently dropped: the un-recognized `---`
		// lines vanish as thematic breaks — the same Markdown reading the
		// delimiter-matrix fixtures get above — while the YAML text inside them
		// survives as ordinary body text.
		await expect(page.getByTestId('fm-bad-wrapper').locator('.ProseMirror')).toContainText(
			'title: [unclosed'
		);

		// Nothing was edited, so the bound value round-trips byte-for-byte.
		await expect(page.getByTestId('fm-bad-value')).toHaveAttribute(
			'data-value',
			JSON.stringify(
				[
					'---',
					'title: [unclosed',
					'  - what',
					'---',
					'',
					'# Release Plan',
					'',
					'Alpha line.'
				].join('\n')
			)
		);
	});

	test('touching a null field writes a quoted string, with no way back to null', async () => {
		// Retyping the exact four characters the input already displays is not a
		// no-op: the control's value is a string, so `null` becomes the STRING
		// "null", and `needsQuoting` then double-quotes it to keep it from
		// parsing back as a null. The input still reads `null` afterwards, so the
		// UI gives no sign that the document's meaning changed.
		const bare = page.locator('#fm-null-front-matter-empty');
		await bare.fill('null');

		await expect(page.getByTestId('fm-null-value')).toHaveAttribute(
			'data-value',
			JSON.stringify(['---', 'empty: "null"', 'nothing: null', '---', '', 'Body.'].join('\n'))
		);
		await expect(bare).toHaveValue('null');
	});

	test('the empty-front-matter raw editor doubles as the way to add a first field', async () => {
		// A side effect of the dead empty-state branch above: because empty front
		// matter falls into the RAW editor rather than an empty-state paragraph,
		// there IS a UI path to a first field — type YAML into it. There is no
		// dedicated "add field" affordance anywhere in the section; this is it.
		// Also note the serializer keeps `---\n---\n` documents alive
		// (`preserveEmptyFrontMatter`), so the delimiters were never at risk.
		//
		// There is also no debounce and no "apply" step — a single `.fill()`
		// commits immediately, with no separate step to confirm it. (This used
		// to have its own dedicated test, pinned on `fm-bad`'s raw editor and
		// filling just `'title:'` to land "mid-word." That fixture no longer
		// offers a raw editor at all — see the malformed-YAML test above — but
		// the "mid-word" framing was never actually exercising keystroke
		// granularity to begin with: Playwright's `.fill()` dispatches a single
		// `input` event carrying the final value, so a partial-looking string
		// like `'title:'` proves the same thing a complete one does. No coverage
		// is lost by retiring it; this test's single `.fill()` already pins the
		// same no-debounce commit.)
		await page.locator('textarea#fm-empty-front-matter-raw').fill('title: x');

		await expect(page.getByTestId('fm-empty-value')).toHaveAttribute(
			'data-value',
			JSON.stringify(['---', 'title: x', '---', '', 'Body.'].join('\n'))
		);
		await expect(page.locator('#fm-empty-front-matter-title')).toHaveValue('x');
	});

	test('once parseable, the field controls cannot make the YAML unparseable again', async () => {
		// This used to be pinned on `fm-bad`'s raw-editor-to-field transition:
		// type `[unclosed` into the `title` field that a parseable keystroke had
		// just created, and confirm it can't reproduce the syntax error that
		// broke the document originally. `fm-bad` no longer offers a raw editor
		// at all (a genuine YAML syntax error is never recognized as front
		// matter now — see above), so there is no reachable "recognized front
		// matter, still showing a raw editor" state left to re-break on that
		// fixture. `fm-empty`, converted to field controls by the test above, is
		// the only fixture left on this page that reaches field controls by way
		// of a raw editor, so the invariant now pins here instead: recovering
		// the raw editor requires `data` to be null again, which requires
		// unparseable YAML, and the field UI cannot produce that — a string
		// field always QUOTES anything YAML-significant, so typing the same
		// `[unclosed` that would break a raw editor round-trips as a perfectly
		// valid quoted scalar instead.
		await page.locator('#fm-empty-front-matter-title').fill('[unclosed');

		await expect(page.getByTestId('fm-empty-value')).toHaveAttribute(
			'data-value',
			JSON.stringify(['---', 'title: "[unclosed"', '---', '', 'Body.'].join('\n'))
		);
		await expect(page.locator('textarea#fm-empty-front-matter-raw')).toHaveCount(0);
	});

	test('readonly ignores a programmatic input event on a front-matter control', async () => {
		// `disabled` alone is only a UI affordance; this checks the guard behind
		// it. The event genuinely lands (the DOM value changes and stays changed,
		// since no re-render reverts it) but `patchField` returns early, so
		// nothing reaches the document.
		const title = page.locator('#fm-readonly-front-matter-title');
		await title.evaluate((element) => {
			const input = element as HTMLInputElement;
			input.value = 'Tampered';
			input.dispatchEvent(new Event('input', { bubbles: true }));
		});

		await expect(title).toHaveValue('Tampered');
		await expect(page.getByTestId('fm-readonly-value')).toHaveAttribute(
			'data-value',
			JSON.stringify(FULL_DOCUMENT)
		);
	});
});

test.describe('review front matter: anchors across a front-matter edit', () => {
	let page: Page;

	// Seeded and expected anchor coordinates. `bodyOffset` is the character
	// length of the front-matter block including both delimiters: 97 for
	// FULL_DOCUMENT, 95 after the `title` edit collapses `tags` to flow style and
	// alphabetizes the keys (two lines' worth of characters shorter).
	const BODY_OFFSET_BEFORE = 97;
	const BODY_OFFSET_AFTER = 95;
	const SHIFT = BODY_OFFSET_AFTER - BODY_OFFSET_BEFORE;

	// The seeded anchor: ProseMirror 1..13 for "Release Plan" inside the BODY
	// document ("# " is markup, not text), plus `bodyOffset` because the
	// component stores anchors in document coordinates.
	const FROM_BEFORE = 1 + BODY_OFFSET_BEFORE;
	const TO_BEFORE = 13 + BODY_OFFSET_BEFORE;
	// `lastKnownOffset` and `originalPosition.offset` are `textBetween()`-style
	// offsets (0 for a quote at the start of the body), not ProseMirror
	// positions — a second coordinate space inside the same object — and they
	// get the same `bodyOffset` added to them.
	const OFFSET_BEFORE = 0 + BODY_OFFSET_BEFORE;

	test.beforeAll(async ({ browser }) => {
		page = await openFixture(browser);
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('at rest, a seeded anchor stays exactly as given and decorates only its quote', async () => {
		await expect(page.getByTestId('fm-anchors-body-offset')).toHaveText(String(BODY_OFFSET_BEFORE));
		await expect(page.getByTestId('fm-anchor-from')).toHaveText(String(FROM_BEFORE));
		await expect(page.getByTestId('fm-anchor-to')).toHaveText(String(TO_BEFORE));
		await expect(page.getByTestId('fm-anchor-last-known-offset')).toHaveText(String(OFFSET_BEFORE));
		await expect(page.getByTestId('fm-anchor-original-offset')).toHaveText(String(OFFSET_BEFORE));

		// A correct anchor decorates exactly its quoted range — one inline
		// decoration wrapping the twelve characters of the heading text, not the
		// whole document.
		const decoration = page.locator('.comment-anchor[data-thread-id="thread-fm-title"]');
		await expect(decoration).toHaveCount(1);
		await expect(decoration).toHaveText('Release Plan');
	});

	test('a front-matter edit shifts every text-anchor coordinate by exactly the body-offset delta', async () => {
		await page.locator('#fm-anchors-front-matter-title').fill('Release Plan v2');

		// The shorter serialized block is the whole cause: the body did not move
		// relative to itself, only relative to the start of the document.
		await expect(page.getByTestId('fm-anchors-body-offset')).toHaveText(String(BODY_OFFSET_AFTER));
		await expect(page.getByTestId('fm-anchor-from')).toHaveText(String(FROM_BEFORE + SHIFT));
		await expect(page.getByTestId('fm-anchor-to')).toHaveText(String(TO_BEFORE + SHIFT));
		await expect(page.getByTestId('fm-anchor-last-known-offset')).toHaveText(
			String(OFFSET_BEFORE + SHIFT)
		);
		await expect(page.getByTestId('fm-anchor-original-offset')).toHaveText(
			String(OFFSET_BEFORE + SHIFT)
		);

		// The quote and its decoration are untouched — the anchor still points at
		// the same twelve characters, just numbered differently.
		await expect(page.getByTestId('fm-anchor-quote')).toHaveText('Release Plan');
		const decoration = page.locator('.comment-anchor[data-thread-id="thread-fm-title"]');
		await expect(decoration).toHaveCount(1);
		await expect(decoration).toHaveText('Release Plan');
	});

	test('`originalPosition` line and column are recomputed from the new document text', async () => {
		// Unlike the offsets, line/column are not shifted arithmetically: they are
		// re-derived by walking the NEW document to the remapped offset. The block
		// lost two lines (`tags:` plus its two sequence items became one flow
		// line), so the body's first line moves from 11 to 9. Column is unchanged
		// because the offset still lands at the start of a line.
		await expect(page.getByTestId('fm-anchor-original-line')).toHaveText('9');
		await expect(page.getByTestId('fm-anchor-original-column')).toHaveText('1');
	});

	test('document-type anchors are returned untouched, and no thread is dropped', async () => {
		// `offsetAnchor` short-circuits on `type: 'document'`, so a document-level
		// thread keeps its 0/0 coordinates through a remap that moved everything
		// else.
		await expect(page.getByTestId('fm-document-anchor-from')).toHaveText('0');
		await expect(page.getByTestId('fm-document-anchor-to')).toHaveText('0');
		await expect(page.getByTestId('fm-anchors-thread-count')).toHaveText('2');
	});
});

test.describe('review front matter: unified diff', () => {
	let page: Page;

	// The signature of the OLD bug: a line made entirely of dashes, carrying a
	// diff marker. Markdown's setext-heading underline. It appears in NEITHER
	// input document, so any diff line matching this was invented by
	// normalization. Kept as a regression tripwire now that the bug is fixed.
	const INVENTED_UNDERLINE = /^[-+]-{8,}$/m;

	// The whole patch the fixture's one-key change should produce, byte for byte.
	// Both `---` fences survive as unchanged context lines, the YAML keeps its
	// authored spelling, and only `draft:` moves.
	const EXPECTED_DIFF = [
		'--- a/document.md',
		'+++ b/document.md',
		'@@ -1,6 +1,6 @@',
		' ---',
		'+draft: false',
		' title: Release Plan',
		'-draft: true',
		' ---',
		' ',
		' # Release Plan',
		''
	].join('\n');

	// What `git apply` actually validates, and what the old bug broke: a hunk
	// header's declared line counts have to match the lines that follow it.
	// Corrupted output still *looked* like a diff — it claimed `-1,8 +1,8` over
	// invented content — so a header-only assertion would not have caught it.
	function hunkCounts(
		diff: string
	): Array<{ declared: [number, number]; actual: [number, number] }> {
		const hunks: Array<{ declared: [number, number]; actual: [number, number] }> = [];
		for (const line of diff.split('\n')) {
			const header = /^@@ -\d+,(\d+) \+\d+,(\d+) @@/.exec(line);
			if (header) {
				hunks.push({ declared: [Number(header[1]), Number(header[2])], actual: [0, 0] });
				continue;
			}
			const hunk = hunks.at(-1);
			if (!hunk || line.startsWith('--- ') || line.startsWith('+++ ') || line === '') continue;
			if (line.startsWith('-')) hunk.actual[0] += 1;
			else if (line.startsWith('+')) hunk.actual[1] += 1;
			else if (line.startsWith(' ')) {
				hunk.actual[0] += 1;
				hunk.actual[1] += 1;
			}
		}
		return hunks;
	}

	test.beforeAll(async ({ browser }) => {
		page = await openFixture(browser);
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('the default normalization keeps the front-matter block verbatim and normalizes only the body', async () => {
		// This used to be the route's headline bug. `generateUnifiedDiff` defaults
		// to `normalizeInputs: true`, and it used to hand the WHOLE document to the
		// markdown pipeline's `normalize()`. That pipeline has no front-matter
		// step, so the opening `---` was re-read as a thematic break and the YAML
		// lines as a paragraph closed by the second `---` — i.e. a setext heading,
		// whose underline was re-emitted as a run of dashes as long as the longest
		// line it underlined. The result: 8-dash lines present in neither document,
		// a blank line injected after the opening fence, lost sequence indentation,
		// and hunk headers (`@@ -1,8 +1,8 @@`) describing a document that never
		// existed — a patch `git apply` rejects, from an API whose docs promise
		// git-appliable output.
		//
		// Fixed upstream in `@lostgradient/editor` (the "fix front-matter diffs"
		// change; no issue number was filed for it) by doing what `DiffViewer`
		// already did: parse the front matter off, normalize only the BODY, and
		// re-attach the front matter verbatim. So the fences and the YAML now pass
		// through untouched and only the body is canonicalized.
		const rendered = await page.getByTestId('fm-diff-default').getAttribute('data-value');
		expect(rendered).not.toBeNull();
		const diff = JSON.parse(rendered!) as string;

		// Nothing was invented, and no blank line was pushed in after the fence.
		expect(diff).not.toMatch(INVENTED_UNDERLINE);
		expect(diff).not.toContain('@@ -1,8 +1,8 @@');
		// Both delimiters survive as three-dash context lines, in place, with the
		// only real change between them.
		expect(diff).toContain('\n ---\n+draft: false\n title: Release Plan\n-draft: true\n ---\n');
		// And the hunk header describes the documents that actually exist.
		expect(hunkCounts(diff)).toEqual([{ declared: [6, 6], actual: [6, 6] }]);
		// Byte-for-byte, since the point is that nothing is rewritten.
		expect(diff).toBe(EXPECTED_DIFF);
	});

	test('the invented dash line exists in neither input document', async () => {
		// Cross-checked against the documents the component itself is holding,
		// not against a literal: the hidden form inputs carry the exact original
		// and current markdown that fed the diff.
		const original = await page.locator('input[name="fm-diff-original"]').getAttribute('value');
		const current = await page.locator('input[name="fm-diff-current"]').getAttribute('value');
		expect(original).not.toBeNull();
		expect(current).not.toBeNull();
		expect(original!).not.toMatch(/^-{8,}$/m);
		expect(current!).not.toMatch(/^-{8,}$/m);
		// Both documents really do contain the front matter under test.
		expect(original!).toContain('draft: true');
		expect(current!).toContain('draft: false');
	});

	test('`normalizeInputs: false` produces the same six-line diff the default now does', async () => {
		const rendered = await page.getByTestId('fm-diff-raw').getAttribute('data-value');
		expect(rendered).not.toBeNull();
		const diff = JSON.parse(rendered!) as string;
		expect(diff).not.toMatch(INVENTED_UNDERLINE);
		// The true shape of the change: one line removed, one added, delimiters
		// and body as context — and hunk counts that match the real documents.
		expect(diff).toContain('@@ -1,6 +1,6 @@');
		expect(diff).toContain('\n+draft: false\n');
		expect(diff).toContain('\n-draft: true\n');
		// This opt-out used to be the ONLY way to get that patch; it was the
		// control that proved the damage above came from normalization rather than
		// from the line differ. Now that normalization leaves front matter alone,
		// the two agree byte for byte on this fixture — which is itself the
		// clearest statement of the fix, and would break again the moment
		// `normalize()` got its hands on the block.
		expect(diff).toBe(EXPECTED_DIFF);
	});

	test('the `<name>-diff` hidden input ships an appliable diff', async () => {
		// `exportUnifiedDiff()` calls `generateUnifiedDiff(getState())` with no
		// options, so this hidden form input — the thing a surrounding form would
		// actually POST, and what `getFormData().diff` returns — inherits whatever
		// the default does. That used to make it the widest blast radius of the
		// front-matter corruption above: every consumer who submitted the form,
		// or hit the Copy Diff menu item, shipped a patch with invented dash lines
		// and hunk headers (`@@ -1,8 +1,8 @@`) that `git apply` refuses. There was
		// no opt-out here, because the export path passes no options.
		//
		// Now that normalization parses the front matter off and re-attaches it
		// verbatim, the export path inherits the correct patch for free.
		const hidden = page.locator('input[name="fm-diff-diff"]');
		await expect(hidden).toHaveCount(1);
		const value = await hidden.getAttribute('value');
		expect(value).not.toBeNull();
		expect(value!).not.toMatch(INVENTED_UNDERLINE);
		expect(value!).not.toContain('@@ -1,8 +1,8 @@');
		// The fences reach the form untouched.
		expect(value!).toContain('\n ---\n+draft: false\n title: Release Plan\n-draft: true\n ---\n');

		// ROADMAP RE-2 replaced this test's load-bearing assertion. It used to end
		// at `hunkCounts(value!)` — a hand-rolled check that a hunk header's
		// declared counts match the lines under it. That check is real but weak:
		// it is a restatement of the arithmetic the generator already did, and it
		// cannot see a wrong start line, a context line that does not match the
		// file, or a missing trailing newline. Calling a patch "appliable" on that
		// basis is the same move that let the front-matter corruption through
		// review in the first place, so the claim is now settled by git itself.
		// (`hunkCounts` survives above, where it documents the OLD bug's
		// signature — `@@ -1,8 +1,8 @@` over a document that never existed —
		// rather than standing in for appliability.)
		//
		// The document written to disk is read back out of the component's own
		// `fm-diff-original` input rather than retyped here, so a fixture edit
		// cannot leave the patch and the file describing different documents.
		const original = await page.locator('input[name="fm-diff-original"]').getAttribute('value');
		const current = await page.locator('input[name="fm-diff-current"]').getAttribute('value');
		expect(original).not.toBeNull();
		expect(current).not.toBeNull();
		// Applying for real and comparing the bytes, not just `--check`: git
		// searches for a hunk's context instead of trusting its `@@` start line,
		// so `--check` alone would accept a header pointing at the wrong line.
		// The trailing newline is the helper's, and it is there because
		// `normalizeInputs: true` makes the patch describe both sides as
		// newline-terminated while the fixture string is not.
		expect(current!.endsWith('\n')).toBe(false);
		expect(applyPatchInTempRepo(original!, value!)).toBe(`${current!}\n`);

		// The control that keeps the assertion above honest: the same patch with
		// one hunk-header count bumped by one — the exact shape of the corruption
		// this route was built around — is refused.
		expect(() =>
			applyPatchInTempRepo(original!, value!.replace('@@ -1,6 +1,6 @@', '@@ -1,7 +1,6 @@'))
		).toThrow(/corrupt patch/);

		// Still byte-identical to the standalone default-options call rendered on
		// the page — which is what attributes the behavior to
		// `generateUnifiedDiff`'s default rather than to anything the editor did.
		const rendered = await page.getByTestId('fm-diff-default').getAttribute('data-value');
		expect(JSON.parse(rendered!)).toBe(value);
		// And identical to the `normalizeInputs: false` output too: the export
		// path no longer has a hidden penalty for not being able to pass options.
		const raw = await page.getByTestId('fm-diff-raw').getAttribute('data-value');
		expect(JSON.parse(raw!)).toBe(value);
	});
});

// ROADMAP RE-2, the WITH-front-matter half of "the same check runs for a document
// with YAML front matter and one without". `review-form-and-exports` owns the
// without half and the same `applyPatchInTempRepo` helper serves both.
//
// This route is where appliability matters most. Every other export surface on
// it survived the front-matter corruption unchanged; the diff was the one that
// shipped a patch `git apply` refuses, from an API documented as producing git
// patches. Asserting that here with git rather than with arithmetic is the whole
// point of the item.
// The same tripwire the diff describe uses, redeclared here because that one is
// scoped inside its own describe: a line of eight or more dashes carrying a diff
// marker exists in neither input document, so anything matching it was invented
// by a normalization pass.
const INVENTED_UNDERLINE_IN_SUMMARY = /^[-+]-{8,}$/m;

test.describe('review front matter: every export surface ships the same patch', () => {
	// The one-key change's summary, byte for byte. Worth pinning next to the diff
	// because the two functions used NOT to agree about normalization:
	// `generateUnifiedDiff` parses the front matter off and normalizes the body,
	// while `generateMarkdownSummary` used to run `computeLineDiff` on the raw
	// strings with no normalization step at all. The literal is here so that if
	// they stop agreeing again, it stops loudly.
	//
	// ROADMAP X-2's remaining acceptance criterion — construct an input where
	// the two actually disagree — used to be met below, in the "blank-line
	// normalization" describe: a fixture whose only difference is how many
	// blank lines separate front matter from body, where `generateUnifiedDiff`
	// reported zero changes and `generateMarkdownSummary` reported a real edit.
	// Fixed in `@lostgradient/editor@0.11.0`, which gave `generateMarkdownSummary`
	// its own `normalizeInputs` option (defaulting to `true`) routed through the
	// same shared `normalizeDocument` as `generateUnifiedDiff` — both functions
	// now agree on that fixture too. Fixed and verified in
	// https://github.com/stevekinney/cinder/issues/1318.
	const EXPECTED_SUMMARY = [
		'## Changes Made',
		'',
		'The following edits were made to the document:',
		'',
		'### Lines 1-5',
		'',
		'```diff',
		' ---',
		'+draft: false',
		' title: Release Plan',
		'-draft: true',
		' ---',
		' ',
		'```',
		''
	].join('\n');

	let page: Page;

	test.beforeAll(async ({ browser }) => {
		page = await openFixture(browser, ['clipboard-read', 'clipboard-write']);
	});

	test.afterAll(async () => {
		await page.context().close();
	});

	test('the hidden input, exportUnifiedDiff(), and the Git Diff menu item are one string that git applies', async () => {
		// RE-2 names the UI path as the "Copy Diff menu item". There is no such
		// label: the item is "Git Diff" and it sits behind a trigger whose
		// accessible name is "Copy to clipboard". Correcting the criterion's
		// wording rather than inventing a selector that does not exist.
		const wrapper = page.getByTestId('fm-diff-wrapper');

		// Surface one: what a surrounding <form> would POST.
		const hidden = await page.locator('input[name="fm-diff-diff"]').inputValue();
		expect(hidden).not.toBe('');

		// Surface two: the imperative method, driven through `bind:this`. Read
		// from a `data-value` attribute holding `JSON.stringify(...)` for the same
		// reason as everything else on this route — the diff's context lines
		// include a line that is a single space, and Playwright's text matchers
		// collapse whitespace runs.
		await page.getByTestId('fm-read-imperative-exports').click();
		// Polled off its empty initial value rather than read straight after the
		// click: the button assigns to `$state` and the attribute lands on the
		// next flush. `'""'` is `JSON.stringify('')`, i.e. the "never ran" state
		// the page deliberately leaves distinguishable from an empty export.
		await expect
			.poll(() => page.getByTestId('fm-imperative-diff').getAttribute('data-value'))
			.not.toBe('""');
		const imperativeRendered = await page
			.getByTestId('fm-imperative-diff')
			.getAttribute('data-value');
		expect(imperativeRendered).not.toBeNull();
		const imperative = JSON.parse(imperativeRendered!) as string;

		// Surface three: the export menu. Gated on the copy ANNOUNCEMENT rather
		// than read straight after the click — the component awaits
		// `copyToClipboard(text)` before writing the announcement, so the
		// announcement strictly follows the clipboard write.
		await wrapper.getByRole('button', { name: 'Copy to clipboard' }).click();
		const menu = page.locator('#fm-diff-export-menu');
		await expect(menu).toBeVisible();
		await menu.getByRole('menuitem', { name: /^Git Diff/ }).click();
		await expect(wrapper.locator('.export-actions .cinder-sr-only[aria-live="polite"]')).toHaveText(
			'Copied Git Diff'
		);
		const copied = await page.evaluate(() => navigator.clipboard.readText());

		expect(imperative).toBe(hidden);
		expect(copied).toBe(hidden);

		// And the patch all three carry is one git will take, producing exactly
		// the document the component says it is holding.
		const original = await page.locator('input[name="fm-diff-original"]').inputValue();
		const current = await page.locator('input[name="fm-diff-current"]').inputValue();
		expect(current.endsWith('\n')).toBe(false);
		expect(applyPatchInTempRepo(original, copied)).toBe(`${current}\n`);
	});

	test('exportMarkdownSummary ships the same front-matter change, and prints no thread section for a fixture with no threads', async () => {
		await page.getByTestId('fm-read-imperative-exports').click();
		await expect
			.poll(() => page.getByTestId('fm-imperative-summary').getAttribute('data-value'))
			.not.toBe('""');
		const rendered = await page.getByTestId('fm-imperative-summary').getAttribute('data-value');
		expect(rendered).not.toBeNull();
		const summary = JSON.parse(rendered!) as string;

		// The imperative method and the hidden input are the same `$derived`.
		expect(summary).toBe(await page.locator('input[name="fm-diff-summary"]').inputValue());
		expect(summary).toBe(EXPECTED_SUMMARY);

		// The YAML reaches the summary intact — no setext underline, no invented
		// dash line — which is the same regression tripwire the diff tests carry.
		expect(summary).not.toMatch(INVENTED_UNDERLINE_IN_SUMMARY);
		// No threads on this fixture, so the Feedback section is absent entirely
		// rather than present and empty.
		expect(summary).not.toContain('## Feedback');
	});
});

// ROADMAP X-2's remaining criterion was an input where `generateUnifiedDiff`
// and `generateMarkdownSummary` actually disagreed, not just documenting that
// they COULD. This fixture's original and current front matter and body text
// are byte-identical — the only difference is how many blank lines separate
// the closing `---` from the body (one vs. three) — and it used to be exactly
// such a case.
//
// `generateUnifiedDiff`'s `normalizeDocument` (`normalizeInputs` defaults to
// `true`) re-attaches front matter to the body with a single hardcoded `\n`
// separator, and runs the body through the markdown pipeline's `normalize()`,
// which strips every leading blank line before re-serializing — so ANY count
// of blank lines there collapses to the same normalized document.
// `generateMarkdownSummary`'s `computeLineDiff` used to run on the raw strings
// with no normalization step at all, so it saw the extra blank lines as real
// content: one function reported zero changes, the other reported an edit.
//
// Fixed in `@lostgradient/editor@0.11.0`: `generateMarkdownSummary` gained its
// own `normalizeInputs` option, defaulting to `true`, and now goes through the
// same shared `normalizeDocument` as `generateUnifiedDiff`. Both functions
// collapse this fixture's blank-line difference the same way and now agree
// that nothing changed.
//
// This was reachable through the public surface even though no UI keystroke
// sequence could type it: ProseMirror collapses adjacent blank paragraphs, but
// `ReviewState.original` is consumer-supplied verbatim (it is never routed
// through the editor), and `setState` round-trips persisted content the same
// way — so any external tool or hand-edited save file that changed blank-line
// spacing near front matter used to produce exactly this pair.
//
// Fixed and verified in https://github.com/stevekinney/cinder/issues/1318.
test.describe('review front matter: blank-line normalization agreement (fixed)', () => {
	let page: Page;

	test.beforeAll(async ({ browser }) => {
		page = await openFixture(browser);
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('generateUnifiedDiff and generateMarkdownSummary both report no change, on a blank-line-only edit', async () => {
		// generateUnifiedDiff: front matter and body normalize to the identical
		// string regardless of how many blank lines separated them, so original
		// and current collapse to the same document and no hunk is produced.
		await expect(page.getByTestId('fm-blank-line-diff')).toHaveAttribute('data-value', '""');

		// generateMarkdownSummary: now normalizes the same way by default, so it
		// also sees the identical normalized document and reports no change —
		// agreeing with generateUnifiedDiff instead of diverging from it.
		await expect(page.getByTestId('fm-blank-line-summary')).toHaveAttribute(
			'data-value',
			JSON.stringify('No changes or feedback to report.')
		);
	});
});

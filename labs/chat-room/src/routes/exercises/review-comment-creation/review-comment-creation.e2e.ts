import { expect, test } from '@playwright/test';
import { gotoHydrated } from '../hydration';
import { pressNextTabStop } from '../keyboard';
import type { Locator, Page } from '@playwright/test';

// How a review comment actually gets created, and what the host has to do with
// the resulting event before anything shows up on screen.
//
// The through-line: every creation callback is NOTIFICATION-ONLY. Submitting the
// selection popover fires `onthreadcreate` and changes nothing else — the
// component renders the bindable `threads` array, and only the host can add to
// it. The route pairs that with a page-owned `addThread`/`addComment` reducer
// behind a checkbox so both halves are observable on one page.
//
// Every test takes its own `page` fixture rather than sharing one across a
// describe block: almost everything here mutates threads, the event log, or the
// sidebar, and a shared page would make the order of the tests load-bearing.

const ROUTE = '/exercises/review-comment-creation';

const CREATION_PARAGRAPH = 'Export actions land in the second release.';

/**
 * Pause between the keystrokes that build a selection in `keyboardSelectFirstWord`,
 * so each one gets its own debounce window. The only remaining use — a sibling
 * single-keypress pause elsewhere in this file was removed after empirical testing
 * found it unnecessary; see that call site's own comment for why a single keypress
 * is a different situation from the burst below.
 *
 * INPUT PACING, NOT A WAIT — the distinction is the whole reason this constant
 * survived a sweep that deleted every other fixed duration in this file. Nothing
 * is being waited FOR here and no assertion follows the pause; it changes the
 * SHAPE OF THE GESTURE, the way `delay` on `keyboard.type` does. A poll cannot
 * replace it, because there is no condition to poll: what it buys is that the
 * component gets three sampling opportunities instead of one, and polling harder
 * cannot make the component sample more often.
 *
 * The mechanism: the component samples ProseMirror's selection exactly once per
 * burst — 20ms after the last `selectionchange`, and never again unless another
 * one arrives. Three keypresses fired back to back at CDP speed all land inside
 * one window, so the popover's whole existence rides on that single sample
 * finding ProseMirror already caught up; under a loaded machine it sometimes has
 * not, and nothing retries. Typing at something closer to human speed is not a
 * workaround for a flaky test — it is three independent chances instead of one,
 * and if the component ignores all three the assertions below still fail.
 *
 * Tried and empirically falsified: replacing the pre-keypress sleep with a
 * post-keypress `expect.poll` on `window.getSelection()?.toString().length`
 * reaching the expected count. That looks like exactly the kind of observable
 * condition a poll should replace a guess with, and it is — for the case where the
 * keypress landed and the DOM just hasn't caught up yet. It is not sufficient for
 * the actual failure mode. Two separate reproductions, on two different engines:
 * removing the pacing outright (no poll at all) failed 2 of 10 runs on WebKIT,
 * with this function's own final assertion catching a selection that stopped one
 * character short ("Th" instead of "The") — proof the keystroke landed late, not
 * that it never landed. The poll-based variant above failed differently, on
 * CHROMIUM: one failure in a full-file `--repeat-each=10` run (roughly 1 in 150
 * executions of this test), where the poll timed out at 5000ms stuck at length 0
 * for the very first keypress — it never grew at all. In that case a keypress
 * fired immediately after the setup click was not processed, so there was nothing
 * for the poll to observe; a `toBeFocused()` check on the editor before the loop
 * did not fix it either (tried that too, same failure). The pause has to come
 * BEFORE the keypress, not be replaced by a check after it — neither reproduction
 * was covered on all three engines, but both point at the same conclusion from
 * different sides of the same race.
 *
 * Named for the interval it is, so it stops reading as a settle threshold
 * somebody guessed.
 */
const KEY_INTERVAL_MS = 60;

async function ready(page: Page): Promise<void> {
	await gotoHydrated(page, ROUTE);
	// Both live ProseMirror surfaces only exist after MarkdownEditor mounts inside
	// its `{#if browser}` guard, so SSR markup alone is not enough to interact.
	await expect(page.locator('.ProseMirror')).toHaveCount(2);
}

/**
 * Drag-select across `target`, horizontally, at its vertical midpoint.
 *
 * `settle` is clicked first and that is not incidental: ProseMirror scrolls the
 * editor into view when it takes focus, so a bounding box measured before the
 * editor is focused is stale by the time the drag runs — the mouse then lands on
 * whatever moved under those coordinates and selects the wrong range (or
 * nothing). Click somewhere harmless inside the editor, let the scroll settle,
 * and only then measure.
 *
 * The fractions default to the full width because a paragraph is a block box:
 * starting one pixel in lands before the first character and ending one pixel
 * short of the right edge lands past the last one, so the selection is exactly
 * the paragraph's text. Narrower fractions are for dragging *within* an inline
 * span, where the box is only as wide as the text itself.
 */
async function dragSelect(
	page: Page,
	settle: Locator,
	target: Locator,
	startFraction = 0,
	endFraction = 1
): Promise<void> {
	await target.scrollIntoViewIfNeeded();
	await settle.click();
	// "Let the scroll settle" above is not rhetorical: on a busy machine the focus
	// scroll is still running when the click resolves, and a box measured then sends
	// the drag across the wrong pixels — which shows up downstream as a selection
	// that stops mid-word, or as no popover at all.
	//
	// So wait for the thing the sentence actually describes. Two consecutive
	// `boundingBox()` reads agreeing means the element did not move across a full
	// polling interval, which is the literal definition of "the scroll settled" —
	// where the 60ms this used to sleep was a guess at how long that takes, and one
	// that a slower machine could outlast without anything noticing. There is
	// nothing to be padded here: the condition is the measurement itself, and if
	// the element never stops moving the poll times out rather than measuring
	// something wrong.
	let previousBox: string | null = null;
	await expect
		.poll(async () => {
			const serialized = JSON.stringify(await target.boundingBox());
			const settled = serialized !== 'null' && serialized === previousBox;
			previousBox = serialized;
			return settled;
		})
		.toBe(true);
	const box = await target.boundingBox();
	expect(box).not.toBeNull();
	const y = box!.y + box!.height / 2;
	const startX = box!.x + Math.max(1, box!.width * startFraction);
	const endX = box!.x + Math.min(box!.width - 1, box!.width * endFraction);
	await page.mouse.move(startX, y);
	await page.mouse.down();
	for (let step = 1; step <= 8; step += 1) {
		await page.mouse.move(startX + ((endX - startX) * step) / 8, y);
	}
	await page.mouse.up();
}

/** Select the creation editor's second paragraph with the mouse. */
async function selectCreationParagraph(page: Page): Promise<void> {
	const paragraph = page.locator('#creation-editor .ProseMirror p').nth(1);
	await dragSelect(page, paragraph, paragraph);
	await expect(page.locator('#creation-editor-selection-popover')).toBeVisible();
}

/**
 * Select the creation editor's first three characters ("The") with the keyboard,
 * leaving the selection's focus end after them.
 *
 * The click is setup, not an assertion: it parks a collapsed caret before the
 * first character so the Shift+ArrowRight run selects a known three characters.
 * One pixel inside the paragraph's left edge is what does it — the paragraph is a
 * block box, so that x lands left of the first glyph and the caret has nowhere to
 * go but offset 0, whatever the font metrics.
 *
 * Installing the caret with `document.createRange` instead looks equivalent and
 * is not: ProseMirror never learns about a selection written behind its back, so
 * it reverts the DOM selection out from under the arrow keys and the selection
 * stays collapsed. (Measured in Playwright — the popover never opens, which is
 * exactly how the first test below used to fail.)
 */
async function keyboardSelectFirstWord(page: Page): Promise<void> {
	const paragraph = page.locator('#creation-editor .ProseMirror p').first();
	await paragraph.scrollIntoViewIfNeeded();
	const box = await paragraph.boundingBox();
	expect(box).not.toBeNull();
	await page.mouse.click(box!.x + 1, box!.y + box!.height / 2);
	for (let keypress = 0; keypress < 3; keypress += 1) {
		await page.waitForTimeout(KEY_INTERVAL_MS);
		await page.keyboard.press('Shift+ArrowRight');
	}
	// Proof the setup landed where it says it did, so a caret that drifted can
	// never be mistaken for the component failing to notice a keyboard selection.
	expect(await page.evaluate(() => window.getSelection()?.toString())).toBe('The');
}

/** Expand the selection popover, type `body`, and submit it. */
async function submitSelectionComment(page: Page, body: string): Promise<void> {
	const popover = page.locator('#creation-editor-selection-popover');
	await popover.getByRole('button', { name: 'Add comment' }).click();
	await popover.getByRole('textbox', { name: 'Comment text' }).fill(body);
	await popover.getByRole('button', { name: 'Submit comment' }).click();
}

/**
 * Get the selection popover out of the way after a submit.
 *
 * It MAY come back after a successful submit — roughly six clicked submits in ten
 * do (the race the test below pins) — and when it does it is `position: fixed`,
 * portaled to <body>, and anchored to the very text that was just commented on,
 * so it floats over that text and can swallow a later click meant for the anchor
 * decoration underneath.
 *
 * Dismissing it with a click somewhere else would just trade one geometry
 * gamble for another (a fixed-position panel does not move when the page
 * scrolls to whatever was clicked). Collapse the selection with the keyboard
 * instead: submitting restores focus to the editor, so a single ArrowRight moves
 * the caret, and the component hides the popover on any collapsed selection.
 * That works on both sides of the race — if the popover never came back, the
 * count is already zero.
 */
async function dismissSelectionPopover(page: Page): Promise<void> {
	await expect(page.locator('#creation-editor .ProseMirror')).toBeFocused();
	await page.keyboard.press('ArrowRight');
	await expect(page.locator('#creation-editor-selection-popover')).toHaveCount(0);
}

/**
 * The shape the page logs. Deliberately all-optional and structural rather than
 * the package's own `ThreadCreateEvent`/`CommentCreateEvent`: several assertions
 * here are about a field being ABSENT, which a required type would hide.
 */
type LoggedPayload = {
	requestId?: string;
	threadId?: string;
	body?: string;
	authorId?: string;
	mentions?: string[];
	anchor?: {
		type?: string;
		quote?: string;
		originalQuote?: string;
		prefix?: string;
		suffix?: string;
		status?: string;
		from?: number;
		to?: number;
	};
};

/** Read one logged callback payload back off the page. */
async function loggedPayload(page: Page, index = 0): Promise<LoggedPayload> {
	const raw = await page.getByTestId('event-entry').nth(index).getAttribute('data-json');
	expect(raw).not.toBeNull();
	return JSON.parse(raw!) as LoggedPayload;
}

test.describe('review-comment-creation: the selection popover', () => {
	test('a mouse drag opens a popover portaled to document.body, after the editor in document order', async ({
		page
	}) => {
		await ready(page);
		await selectCreationParagraph(page);

		const popover = page.locator('#creation-editor-selection-popover');
		await expect(popover).toHaveAttribute('role', 'toolbar');
		await expect(popover).toHaveAttribute('aria-label', 'Selection actions');

		// `data-cinder-position-ready` is how floating-ui reports that the panel has
		// been measured and placed; `data-cinder-placement` is where it landed. Both
		// are hooks for positioning assertions — asserted as a shape, not a pixel.
		await expect(popover).toHaveAttribute('data-cinder-position-ready', 'true');
		await expect(popover).toHaveAttribute('data-cinder-placement', /^(top|bottom)/);

		// `data-cinder-expanded` is NOT present yet: the component writes it as
		// `expanded ? '' : undefined`, so in the icon state the attribute is absent
		// rather than "false". Only the expanded composer carries it.
		await expect(popover).not.toHaveAttribute('data-cinder-expanded');

		// The portal is the load-bearing part. The popover is a child of <body>, not
		// of the review editor — which is what keeps it out of the editor's overflow
		// and stacking context, and what puts it after the editor in document order.
		// That ordering is the whole reason a single Tab can reach it.
		const structure = await popover.evaluate((element) => ({
			parent: element.parentElement?.tagName,
			followsEditor: Boolean(
				document.querySelector('#creation-editor .ProseMirror')!.compareDocumentPosition(element) &
				Node.DOCUMENT_POSITION_FOLLOWING
			)
		}));
		expect(structure.parent).toBe('BODY');
		expect(structure.followsEditor).toBe(true);
	});

	test('a keyboard selection opens the same popover, and one Tab from the editor lands on its button', async ({
		page,
		browserName
	}) => {
		await ready(page);

		await keyboardSelectFirstWord(page);

		// Same popover, same id — the component listens to `selectionchange`, so it
		// does not care whether the selection came from a pointer or a keyboard.
		// (There is a 20ms debounce before the position is computed; the
		// auto-retrying expect absorbs it.)
		const popover = page.locator('#creation-editor-selection-popover');
		await expect(popover).toBeVisible();

		// One tab stop, straight onto the action. Tab is bound in the editor's keymap
		// (sink list item), but that command returns false in a paragraph, so the
		// keypress falls through to the browser's own focus movement — and the next
		// tabbable thing in the document is the portaled popover.
		//
		// `pressNextTabStop` rather than a literal Tab: macOS WebKit leaves buttons
		// out of the plain-Tab cycle, so there the same intent is Option+Tab. The
		// assertion below is unchanged, and it holds in all three engines once the
		// keystroke says what it means on each. See `../keyboard`.
		await pressNextTabStop(page, browserName);
		await expect(popover.getByRole('button', { name: 'Add comment' })).toBeFocused();
	});

	test('Escape closes the popover from its button; from the composer, only the focus handoff is dependable', async ({
		page,
		browserName
	}) => {
		await ready(page);

		const popover = page.locator('#creation-editor-selection-popover');
		const editor = page.locator('#creation-editor .ProseMirror');

		// A keyboard-made selection rather than a drag, because every step up to the
		// composer behaves identically on every run that way.
		await keyboardSelectFirstWord(page);
		await expect(popover).toBeVisible();

		// Record the popover leaving the DOM rather than asserting `toHaveCount(0)`
		// afterwards, for the same reason the announcement test records mutations:
		// closing hands the still-live selection back to the editor, and that can
		// re-trigger the very popover that just closed. Under load it came back inside
		// the polling interval and a count assertion never saw the zero. What is being
		// pinned is that Escape removed it, not that it stayed removed.
		await page.evaluate(() => {
			const state = { removed: false };
			(window as unknown as { __popover: { removed: boolean } }).__popover = state;
			new MutationObserver(() => {
				if (!document.getElementById('creation-editor-selection-popover')) state.removed = true;
			}).observe(document.body, { childList: true, subtree: true });
		});

		// From the icon state, Escape does exactly the right thing: the popover closes,
		// and the editor gets back both its focus and its selection. Focus sitting on a
		// BUTTON never disturbed the document selection in the first place — which is
		// the detail the composer half of this test turns on.
		//
		// Platform-accurate traversal, same reason as the sibling test above.
		await pressNextTabStop(page, browserName);
		await expect(popover.getByRole('button', { name: 'Add comment' })).toBeFocused();
		await page.keyboard.press('Escape');
		await expect
			.poll(() =>
				page.evaluate(
					() => (window as unknown as { __popover: { removed: boolean } }).__popover.removed
				)
			)
			.toBe(true);
		await expect(editor).toBeFocused();
		expect(await page.evaluate(() => window.getSelection()?.toString())).toBe('The');

		// Extend the selection by a character and expand the popover over it. The
		// expand is a click rather than Tab-then-Enter because the popover may be
		// mid-remount from the race described below, and a click waits for it.
		//
		// No pacing before this keypress, unlike `keyboardSelectFirstWord`'s loop —
		// and that is not an oversight. This is ONE keypress, not a burst of three,
		// so there is nothing for the browser to coalesce in the first place; the
		// `selectionchange` it produces is the only one in flight. And the assertion
		// that follows is `toBeVisible()`, an auto-retrying matcher — if the
		// component's popover-open sample lands late relative to this keystroke, the
		// poll just keeps checking rather than failing once. That is a materially
		// different situation from `keyboardSelectFirstWord`, where the very next
		// line is a one-shot `expect(...).toBe('The')` with no retry at all. It also
		// fires later than the loop's first keypress does relative to its own setup:
		// three assertions already ran between the Escape above and this keystroke
		// (`toBeFocused`, the removal poll, and the selection-text check), so unlike
		// the loop's very first `Shift+ArrowRight` — which follows a bare mouse click
		// with nothing to settle on first — this keystroke only fires once the
		// editor's refocus is independently confirmed, not merely assumed.
		//
		// Verified rather than assumed: this line used to carry the same
		// `KEY_INTERVAL_MS` pause as the loop below, with a comment claiming the same
		// coalescing risk. Removing it and running this test 25 times on each of
		// chromium, webkit, and firefox (75 runs) produced zero failures, and three
		// further full-file `--repeat-each=10` runs, one per engine (450 test
		// executions total, 30 of them this specific test, at the same
		// parallel-worker load that DOES reproduce `keyboardSelectFirstWord`'s race
		// below) still produced zero failures here. Contrast that with the loop
		// below, which failed for real under that exact load — see its own comment.
		// That does not prove no race exists at any rate; the loop's own race showed
		// up at roughly 1 in 150, and 105 clean executions here cannot rule out
		// something similarly rare. What the difference in mechanism above argues is
		// that if one exists here, it is not the same one.
		await page.keyboard.press('Shift+ArrowRight');
		await expect(popover).toBeVisible();
		await popover.getByRole('button', { name: 'Add comment' }).click();
		await expect(popover).toHaveAttribute('data-cinder-expanded', '');
		await expect(popover.getByRole('textbox', { name: 'Comment text' })).toBeFocused();

		// Escape out of the composer. Three things are true every single time: the
		// composer is gone, nothing was emitted, and the editor has the focus back.
		await page.keyboard.press('Escape');
		await expect(editor).toBeFocused();
		await expect(page.getByTestId('event-entry')).toHaveCount(0);
		// The 300ms that used to sit here was guarding against the composer coming
		// BACK after the matchers below had already looked. It cannot: the expanded
		// state has exactly one assignment of `true` in the whole component
		// (`handleSelectionPopoverExpand`, review-editor-impl.svelte:1294), and it is
		// wired to a single place — the selection popover's `onExpand` at :1884, i.e.
		// a user clicking "Add comment". Every one of the twelve other assignments
		// sets it false. No timer, no async path, and nothing this test does after
		// this line can re-expand it, so the auto-retrying matchers are already
		// waiting for the only transition that exists.
		await expect(popover.getByRole('textbox', { name: 'Comment text' })).toHaveCount(0);
		await expect(
			page.locator('#creation-editor-selection-popover[data-cinder-expanded]')
		).toHaveCount(0);

		// PINNED KNOWN BUG — and the bug is that there is no fourth thing to assert.
		// Escape is *supposed* to collapse the composer back to the icon state, keeping
		// the popover open over the same range so it can be re-expanded; the component
		// holds on to the captured selection precisely so it can. Whether that actually
		// happens is decided by a race it does not control. Focusing the composer's
		// textarea already collapsed the document selection; restoring focus to the
		// editor gives ProseMirror ~20ms to write its stored selection back into the
		// DOM, and if it does the popover survives, while if it does not the next
		// `selectionchange` clears the popover outright and the selection is simply
		// gone.
		//
		// Both outcomes were measured on this page, and which one you get tracks how
		// busy the machine is: run serially, the popover was gone 20 times out of 20
		// after a keyboard-made selection and 10 out of 12 after a mouse drag; run
		// four-wide in parallel, it survived 4 times out of 4. So "cancel keeps the
		// popover" and "cancel dismisses it" are both unassertable, and the instability
		// is the finding. (On a run where it does survive, a later Escape from its
		// button closes it and drops focus on `<body>` — the popover remembers a focus
		// target once, when it opens, and the cancel has already spent it.)
	});
});

test.describe('review-comment-creation: creation is notification-only', () => {
	test('submitting fires exactly one onthreadcreate and changes nothing else', async ({ page }) => {
		await ready(page);
		await selectCreationParagraph(page);
		await submitSelectionComment(page, 'Can we ship this in the first release instead?');

		// Exactly one callback, not one per keystroke and not one per selection.
		await expect(page.getByTestId('event-entry')).toHaveCount(1);
		const payload = await loggedPayload(page);

		expect(payload.authorId).toBe('steve');
		expect(payload.body).toBe('Can we ship this in the first release instead?');

		// `requestId` exists to correlate an optimistic insert with a server
		// response — it is NOT the thread id, and the host still has to mint one.
		// `generateId()` uses `crypto.randomUUID()` whenever it is available, which
		// it is on localhost (a secure context), so the shape is a real UUID rather
		// than the timestamp fallback.
		expect(payload.requestId).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
		);

		// The anchor quotes exactly what was dragged over.
		expect(payload.anchor?.quote).toBe(CREATION_PARAGRAPH);
		expect(payload.anchor?.originalQuote).toBe(CREATION_PARAGRAPH);
		expect(payload.anchor?.status).toBe('anchored');
		// `prefix` is the preceding paragraph plus the block separator; there is
		// nothing after the last paragraph, so `suffix` is empty.
		expect(payload.anchor?.prefix).toContain('The dashboard ships in the first release.');
		expect(payload.anchor?.suffix).toBe('');

		// And now the point of the route: the callback fired, and the bindable
		// `threads` array is untouched. The page's own readout still says zero, the
		// comments toggle still counts zero, and no decoration was drawn. Asserted
		// AFTER the event is known to have been logged, so it cannot pass vacuously
		// by running before anything happened.
		await expect(page.getByTestId('thread-count')).toHaveText('threads: 0');
		await expect(
			page.getByTestId('creation-host').getByRole('button', { name: /comments sidebar/ })
		).toHaveAccessibleName('Open comments sidebar (0 comments)');
		await expect(page.locator('#creation-editor .comment-anchor')).toHaveCount(0);
	});

	test('the anchor a UI-created thread ships has no `type` at all — not `text`', async ({
		page
	}) => {
		await ready(page);
		await selectCreationParagraph(page);
		await submitSelectionComment(page, 'Typed?');

		await expect(page.getByTestId('event-entry')).toHaveCount(1);

		// `buildAnchorFromSelection` never sets `type`. `isTextAnchor` treats
		// `undefined` as text for backwards compatibility, so the component itself
		// copes — but any consumer that branches on `anchor.type === 'text'`
		// misclassifies every thread its own UI created. The readout distinguishes
		// "absent" from "present and undefined", which `JSON.stringify` cannot.
		await expect(page.getByTestId('last-anchor-type')).toHaveText('last anchor.type: (absent)');
		const payload = await loggedPayload(page);
		expect(payload.anchor).toBeDefined();
		expect(Object.keys(payload.anchor!)).not.toContain('type');
	});

	test('submitting closes the composer and hands focus back to the editor', async ({ page }) => {
		await ready(page);
		await selectCreationParagraph(page);

		const popover = page.locator('#creation-editor-selection-popover');
		const editor = page.locator('#creation-editor .ProseMirror');

		await popover.getByRole('button', { name: 'Add comment' }).click();
		await popover.getByRole('textbox', { name: 'Comment text' }).fill('First thought.');
		// Cmd/Ctrl+Enter, the composer's own submit shortcut — nothing else in this file
		// exercises it on the SELECTION popover, and the comment below needs it.
		await page.keyboard.press('ControlOrMeta+Enter');

		// What holds after every submit, on every run: the event fired once with the
		// typed body, the composer is gone, and the editor has the focus back.
		await expect(page.getByTestId('event-entry')).toHaveCount(1);
		expect((await loggedPayload(page)).body).toBe('First thought.');
		await expect(editor).toBeFocused();
		// Deleted for the same reason as its twin in the Escape test above: the
		// composer's return would require `selectionPopoverExpanded` to go true
		// again, which only a click on "Add comment" can do
		// (review-editor-impl.svelte:1294, reached solely from `onExpand` at :1884).
		// Note what this does NOT claim — the collapsed POPOVER genuinely may come
		// back, which is the race the block below pins; the two assertions here are
		// about the composer and the expanded attribute specifically, and those are
		// settled.
		await expect(popover.getByRole('textbox', { name: 'Comment text' })).toHaveCount(0);
		await expect(
			page.locator('#creation-editor-selection-popover[data-cinder-expanded]')
		).toHaveCount(0);

		// PINNED RACE. What does NOT hold is anything about the selection you just
		// commented on. Submitting restores focus to the editor without touching
		// ProseMirror's stored selection, so on paper the range survives, the resulting
		// `selectionchange` re-captures it, and the popover comes straight back —
		// offering to comment again on the text you just commented on. Whether it does
		// is settled inside ProseMirror's focus handler, which re-writes its stored
		// selection into the DOM ~20ms after the editor regains focus, but only if its
		// DOM observer has not already flushed the collapsed selection first.
		//
		// Measured on this page: run serially, Cmd/Ctrl+Enter lost that race 18 times
		// out of 18 (selection collapsed, no popover) while clicking Submit won it about
		// 6 times in 10; run four-wide in parallel, the keyboard path started winning it
		// instead and the popover came back. Same gesture, opposite UI, decided by how
		// busy the machine is — so there is no honest assertion to make about it in
		// either direction, and `dismissSelectionPopover` above is written to cope with
		// both. That instability is the finding.
	});
});

test.describe('review-comment-creation: applying the events', () => {
	test('the page-owned addThread reducer is what actually makes the thread appear', async ({
		page
	}) => {
		await ready(page);
		await page.getByTestId('apply-events').check();

		await selectCreationParagraph(page);
		await submitSelectionComment(page, 'Ship this earlier.');

		// Same event as the previous group; the only difference is that the page
		// now feeds it through `addThread` from `@lostgradient/editor/comments`.
		await expect(page.getByTestId('thread-count')).toHaveText('threads: 1');
		await expect(page.getByTestId('comment-count')).toHaveText('comments: 1');

		// The decoration lands on exactly the quoted range — one span, the
		// paragraph's text, and nothing else. Count alone would pass even if the
		// span covered the whole document, so both are asserted.
		const anchors = page.locator('#creation-editor .comment-anchor');
		await expect(anchors).toHaveCount(1);
		await expect(anchors.first()).toHaveText(CREATION_PARAGRAPH);

		// The toggle's count comes from the component's own view of `threads`, so it
		// moves too.
		const creationHost = page.getByTestId('creation-host');
		const commentsToggle = creationHost.getByRole('button', { name: /comments sidebar/ });
		await expect(commentsToggle).toHaveAccessibleName('Open comments sidebar (1 comment)');

		// And the sidebar lists it, quote and body.
		await dismissSelectionPopover(page);
		await commentsToggle.click();
		const sidebar = page.locator('#creation-editor-sidebar');
		await expect(sidebar).toBeVisible();
		await expect(sidebar.locator('.thread-quote')).toHaveText(CREATION_PARAGRAPH);
		await expect(sidebar.locator('.thread-preview')).toHaveText('Ship this earlier.');
	});

	test('replying inside a thread fires oncommentcreate, and addComment appends it', async ({
		page
	}) => {
		await ready(page);
		await page.getByTestId('apply-events').check();
		await selectCreationParagraph(page);
		await submitSelectionComment(page, 'Ship this earlier.');
		await expect(page.locator('#creation-editor .comment-anchor')).toHaveCount(1);
		await dismissSelectionPopover(page);

		// Clicking an anchor decoration opens the thread popover for that thread.
		await page.locator('#creation-editor .comment-anchor').click();
		const threadPopover = page.locator('#creation-editor-thread-popover');
		await expect(threadPopover).toBeVisible();

		// The reply composer's placeholder reads "Reply...", but its ACCESSIBLE NAME
		// is "Comment" — it comes from the sr-only <label>, which is identical in
		// every CommentComposer. The submit Button's text is also "Comment", so
		// role is the only thing separating the two.
		const composer = threadPopover.getByRole('textbox', { name: 'Comment' });
		await expect(composer).toHaveAttribute('placeholder', 'Reply...');
		// `exact` is load-bearing now. Each rendered comment carries its own "Edit
		// comment" and "Delete comment" action buttons, and the default substring,
		// case-insensitive name match sweeps both of those up alongside the submit
		// button — three elements, and a strict-mode violation. The assertion is
		// unchanged; only the locator got precise enough to name one button.
		await expect(threadPopover.getByRole('button', { name: 'Comment', exact: true })).toBeVisible();

		await composer.fill('Agreed — @maya can you confirm?');
		await page.keyboard.press('ControlOrMeta+Enter');

		// Cmd/Ctrl+Enter submits, the textarea clears, and focus stays put so the
		// next reply can be typed immediately.
		await expect(composer).toHaveValue('');
		await expect(composer).toBeFocused();

		await expect(page.getByTestId('comment-count')).toHaveText('comments: 2');
		const reply = await loggedPayload(page, 1);
		expect(reply.body).toBe('Agreed — @maya can you confirm?');
		expect(reply.mentions).toEqual(['maya']);
		expect(reply.authorId).toBe('steve');
		// The reply event carries the thread it belongs to; `addComment` needs it.
		expect(typeof reply.threadId).toBe('string');
	});
});

test.describe('review-comment-creation: document-level comments', () => {
	test('the sidebar composes a document comment whose anchor is anchored to nothing', async ({
		page
	}) => {
		await ready(page);
		await page.getByTestId('apply-events').check();

		const creationHost = page.getByTestId('creation-host');
		await creationHost.getByRole('button', { name: /comments sidebar/ }).click();
		const sidebar = page.locator('#creation-editor-sidebar');
		await expect(sidebar).toBeVisible();

		// With nothing to show, the sidebar advertises both routes into creation —
		// the selection one and this button.
		await expect(sidebar.locator('.empty-state')).toContainText('No comments yet');
		await expect(sidebar.locator('.empty-state')).toContainText(
			'Select text or click + to add a comment'
		);

		// The button is a toggle: its accessible name flips while composing, which
		// is the only signal that the second press cancels rather than submits.
		const addDocumentComment = sidebar.getByRole('button', { name: 'Add document comment' });
		await addDocumentComment.click();
		await expect(sidebar.getByRole('button', { name: 'Cancel document comment' })).toBeVisible();

		const composer = sidebar.getByRole('textbox', { name: 'Comment' });
		// The composer's id is derived from the sidebar's id, which is itself
		// derived from the editor's — three levels of id concatenation.
		await expect(composer).toHaveAttribute('id', 'creation-editor-sidebar-document-composer');
		await composer.fill('Overall this reads well.');
		await page.keyboard.press('ControlOrMeta+Enter');

		await expect(page.getByTestId('event-entry')).toHaveCount(1);
		const payload = await loggedPayload(page);

		// `createDocumentAnchor()` produces a deliberately empty anchor: this is the
		// one place `anchor.type` IS set, and the positions are zeroed because there
		// is nothing to point at.
		expect(payload.anchor).toEqual({
			type: 'document',
			quote: '',
			prefix: '',
			suffix: '',
			from: 0,
			to: 0,
			status: 'anchored'
		});
		await expect(page.getByTestId('last-anchor-type')).toHaveText('last anchor.type: document');

		// Applied, it sorts ahead of text threads and renders no decoration at all —
		// `from === to === 0` is an empty range, and the decoration pass skips those.
		await expect(page.getByTestId('thread-count')).toHaveText('threads: 1');
		const item = sidebar.locator('button.thread-item');
		await expect(item).toHaveCount(1);
		await expect(item).toHaveAttribute('data-document', 'true');
		await expect(item.locator('.thread-document-label')).toHaveText('Document comment');
		await expect(page.locator('#creation-editor .comment-anchor')).toHaveCount(0);
	});

	test('a document thread sorts ahead of a text thread in the sidebar', async ({ page }) => {
		await ready(page);
		await page.getByTestId('apply-events').check();

		// Text thread first, so ordering cannot be an artifact of insertion order.
		await selectCreationParagraph(page);
		await submitSelectionComment(page, 'Text-anchored note.');
		await expect(page.getByTestId('thread-count')).toHaveText('threads: 1');
		await dismissSelectionPopover(page);

		const creationHost = page.getByTestId('creation-host');
		await creationHost.getByRole('button', { name: /comments sidebar/ }).click();
		const sidebar = page.locator('#creation-editor-sidebar');
		await sidebar.getByRole('button', { name: 'Add document comment' }).click();
		await sidebar.getByRole('textbox', { name: 'Comment' }).fill('Document-level note.');
		await page.keyboard.press('ControlOrMeta+Enter');
		await expect(page.getByTestId('thread-count')).toHaveText('threads: 2');

		const items = sidebar.locator('button.thread-item');
		await expect(items).toHaveCount(2);
		await expect(items.nth(0)).toHaveAttribute('data-document', 'true');
		await expect(items.nth(0).locator('.thread-preview')).toHaveText('Document-level note.');
		await expect(items.nth(1)).not.toHaveAttribute('data-document');
		await expect(items.nth(1).locator('.thread-quote')).toHaveText(CREATION_PARAGRAPH);
	});
});

test.describe('review-comment-creation: the composer', () => {
	test('refuses whitespace, hides its submit until focus-within, and cancels on Escape', async ({
		page
	}) => {
		await ready(page);

		const creationHost = page.getByTestId('creation-host');
		await creationHost.getByRole('button', { name: /comments sidebar/ }).click();
		const sidebar = page.locator('#creation-editor-sidebar');
		await sidebar.getByRole('button', { name: 'Add document comment' }).click();

		const form = sidebar.locator('form.comment-composer');
		const composer = form.getByRole('textbox', { name: 'Comment' });
		const inlineSubmit = form.locator('.comment-composer-inline-submit');

		// The submit button is painted invisible and click-through until something
		// inside the form has focus. A cold click on it — before touching the
		// textarea — cannot land, which is a genuine trap for a test that reaches
		// for the button first. Asserted as computed style rather than by attempting
		// a click that is designed to time out.
		await expect(inlineSubmit).toHaveCSS('opacity', '0');
		await expect(inlineSubmit).toHaveCSS('pointer-events', 'none');

		await composer.click();
		await expect(inlineSubmit).toHaveCSS('opacity', '1');
		await expect(inlineSubmit).toHaveCSS('pointer-events', 'auto');

		// Whitespace is not a comment: the button disables and the keyboard path
		// refuses too. A successful submit clears the textarea AND closes the
		// document composer, so "still mounted, still holding the spaces" is
		// positive evidence that nothing went through — not just an absence.
		await composer.fill('   ');
		await expect(form.getByRole('button', { name: 'Comment' })).toBeDisabled();
		await page.keyboard.press('ControlOrMeta+Enter');
		await expect(composer).toHaveValue('   ');
		await expect(page.getByTestId('event-entry')).toHaveCount(0);

		// Escape cancels composition entirely — the composer unmounts, the toggle
		// flips back, and nothing is emitted.
		await page.keyboard.press('Escape');
		await expect(composer).toHaveCount(0);
		await expect(sidebar.getByRole('button', { name: 'Add document comment' })).toBeVisible();
		await expect(page.getByTestId('event-entry')).toHaveCount(0);
	});
});

test.describe('review-comment-creation: mentions', () => {
	test('extractMentions dedupes, allows - and _, and skips emails and inline code', async ({
		page
	}) => {
		await ready(page);
		await page.getByTestId('apply-events').check();
		await selectCreationParagraph(page);
		await submitSelectionComment(
			page,
			'hi @alice, @bob-2 and @alice again; mail x@y.com; `@code`; @a_b'
		);

		await expect(page.getByTestId('event-entry')).toHaveCount(1);
		const payload = await loggedPayload(page);

		// Order is insertion order through a Set: first sighting wins, the repeat of
		// @alice is dropped, `x@y.com` is not a mention because the `@` is preceded
		// by a word character, and the inline-code span is stripped before matching.
		expect(payload.mentions).toEqual(['alice', 'bob-2', 'a_b']);

		// The body is stored verbatim. There is no linkification and no mention
		// autocomplete anywhere in the package — `mentions` is metadata for the
		// host to act on, not a rendering feature.
		await dismissSelectionPopover(page);
		const anchor = page.locator('#creation-editor .comment-anchor');
		await expect(anchor).toHaveCount(1);
		await anchor.click();
		const threadPopover = page.locator('#creation-editor-thread-popover');
		await expect(threadPopover.locator('.comment-body')).toHaveText(
			'hi @alice, @bob-2 and @alice again; mail x@y.com; `@code`; @a_b'
		);
		await expect(threadPopover.locator('.comment-body a')).toHaveCount(0);
	});

	test('a body with no mentions omits the field entirely rather than sending []', async ({
		page
	}) => {
		await ready(page);
		await selectCreationParagraph(page);
		await submitSelectionComment(page, 'No one to ping here.');

		await expect(page.getByTestId('event-entry')).toHaveCount(1);
		// `mentions: mentions.length > 0 ? mentions : undefined` — so a host that
		// does `event.mentions.length` crashes on the common case. The readout
		// distinguishes an absent field from an empty array; JSON alone cannot.
		await expect(page.getByTestId('last-mentions')).toHaveText('last mentions: (absent)');
		const payload = await loggedPayload(page);
		expect(Object.keys(payload)).not.toContain('mentions');
	});
});

test.describe('review-comment-creation: the anchor collision', () => {
	test('dragging inside already-commented text opens the thread popover, not the selection popover', async ({
		page
	}) => {
		await ready(page);

		// The second instance seeds one thread on the word "dashboard", so there is
		// a real decoration to drag across.
		const anchor = page.locator('#creation-collision .comment-anchor');
		await expect(anchor).toHaveCount(1);
		await expect(anchor).toHaveText('dashboard');

		// Settle on the paragraph (its center is past the end of the text, so the
		// caret lands harmlessly at the line end and no popover opens), then drag
		// across the middle of the anchor itself. Staying well inside the span is
		// what makes this deterministic: the browser dispatches `click` on the
		// nearest common ancestor of mousedown and mouseup, so a drag that spills
		// over either edge reports the paragraph instead and the collision does not
		// happen at all.
		const paragraph = page.locator('#creation-collision .ProseMirror p').first();
		await dragSelect(page, paragraph, anchor, 0.25, 0.75);

		// PINNED DEFECT, not desired behavior. The anchor plugin's `click` handler
		// fires on that mouseup, sets the popover thread, and `showSelectionPopover`
		// is derived with `popoverThreadId === null` in it — so the selection
		// popover can never appear. Commenting on already-commented text with a
		// mouse is therefore impossible: the drag that would start a new thread is
		// always read as a click on the old one.
		const threadPopover = page.locator('#creation-collision-thread-popover');
		await expect(threadPopover).toBeVisible();
		await expect(page.locator('#creation-collision-selection-popover')).toHaveCount(0);

		// It is the seeded thread that opened, and its focus trap has already taken
		// the keyboard — so even a keyboard user cannot get back to the selection.
		await expect(threadPopover).toHaveAttribute('role', 'dialog');
		await expect(threadPopover).toContainText('dashboard');
		await expect(threadPopover.getByRole('button', { name: 'Delete thread' })).toBeFocused();

		// A plain click on the anchor does the same thing, which is the intended
		// gesture — the collision is that a drag is indistinguishable from it.
		await page.keyboard.press('Escape');
		await expect(threadPopover).toHaveCount(0);
		await anchor.click();
		await expect(page.locator('#creation-collision-thread-popover')).toBeVisible();
	});
});

test.describe('review-comment-creation: announcements', () => {
	test('creating a comment announces through a visually hidden live region', async ({ page }) => {
		await ready(page);

		// The region wipes itself one second after announcing (so a repeated message
		// re-announces), which makes "read the text off the DOM afterwards" a race
		// this test would lose under load. Record mutations instead, then assert on
		// what was recorded.
		await page.evaluate(() => {
			const seen: string[] = [];
			(window as unknown as { __announced: string[] }).__announced = seen;
			for (const region of document.querySelectorAll('[role="status"][aria-live="polite"]')) {
				new MutationObserver(() => {
					const text = region.textContent?.trim();
					if (text) seen.push(text);
				}).observe(region, { childList: true, characterData: true, subtree: true });
			}
		});

		await selectCreationParagraph(page);
		await submitSelectionComment(page, 'Announce me.');

		await expect
			.poll(() => page.evaluate(() => (window as unknown as { __announced: string[] }).__announced))
			.toContain('Comment added');

		// And it is for screen readers only. The region used to render as visible
		// page text (the component reached for a bare `sr-only` class that Cinder
		// does not ship); every polite region is now clipped to a pixel. Measured
		// rather than asserted by class name, so this pins the outcome, not the fix.
		const widths = await page
			.locator('[role="status"][aria-live="polite"]')
			.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().width));
		expect(widths.length).toBeGreaterThan(0);
		expect(Math.max(...widths)).toBeLessThanOrEqual(2);
	});
});

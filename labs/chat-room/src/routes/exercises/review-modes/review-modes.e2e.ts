import { expect, test } from '@playwright/test';
import { gotoHydrated } from '../hydration';
import type { Locator, Page } from '@playwright/test';

// ReviewEditor's prop matrix: `mode`, `currentUserId`, `snapshotMode`,
// `placeholder`, and `class`. Every claim here is a DIFFERENCE between two
// instances that share a document, a seeded thread, an author, and everything
// else — so each assertion carries its own control, and an affordance that is
// missing for the wrong reason shows up as a failing control rather than as a
// passing test.
//
// Boundaries with the sibling routes: `review-views` owns the view tablist and
// the full Revert All gate (readonly appears here only as the third of its
// three conditions); `review-ssr-and-a11y` owns SSR, hydration, and live-region
// geometry; `review-comment-creation` owns the drag-selection path and the
// page-owned reducer that applies the notification-only events. This route
// never applies them — counting them at zero is the whole point.

/** Each instance is wrapped in `data-testid="modes-<name>-frame"` on the page. */
function frame(page: Page, name: string): Locator {
	return page.getByTestId(`${name}-frame`);
}

/**
 * The component's own container: `data-testid="review-editor"`, and no id.
 *
 * The `id` prop lands on the inner markdown-editor host (`#<id>`), NOT on the
 * container — so `#<id>` vanishes whenever an instance leaves the editor view,
 * because the diff and summary views unmount that host. Everything
 * container-scoped therefore goes through the frame, which never moves.
 */
function surface(scope: Locator): Locator {
	return scope.getByTestId('review-editor');
}

/** All seven instances, in page order. */
const INSTANCES = [
	'modes-edit',
	'modes-readonly',
	'modes-nouser',
	'modes-emptyuser',
	'modes-snapshot',
	'modes-plain',
	'modes-exotic'
] as const;

/**
 * `data-ready` is `editorViewReady && !pendingState`. It is the right signal
 * for the FIRST interaction and useless afterwards — it never resets, so it
 * stays `"true"` while an editor is unmounted in another view.
 */
async function openReviewModes(page: Page, names: readonly string[]): Promise<void> {
	await gotoHydrated(page, '/exercises/review-modes');
	for (const name of names) {
		await expect(surface(frame(page, name))).toHaveAttribute('data-ready', 'true');
	}
}

/**
 * Select `needle` inside an instance's ProseMirror with a real DOM Range.
 *
 * A mouse drag is the user-facing gesture, but it is unusable here: these
 * documents carry an anchor decoration whose pointerup handler steals the drag
 * and opens the thread popover instead. A programmatic Range needs no
 * coordinates and produces the same `selectionchange` the component listens
 * for — but only if the editor is focused first, because ProseMirror's DOM
 * observer ignores selection changes on an editable view it does not hold
 * focus in.
 *
 * The scroll dance in front of that is load-bearing, not hygiene. Focusing an
 * offscreen element makes the browser scroll it into view, and this page
 * inherits `scroll-behavior: smooth`, so that scroll ANIMATES for hundreds of
 * milliseconds after the call returns. SelectionPopover dismisses itself on
 * scroll (movement dismissal — "the user moved on"), and the component only
 * mounts it 20ms after the selection settles, so the popover would mount into
 * a still-running scroll and be torn down a frame or two later. Measured: the
 * popover appeared at 31ms and was removed at 35ms by a scroll event, with the
 * selection still standing. Nothing about that is specific to the popover's
 * correctness — it is an artifact of moving focus across a seven-instance page,
 * which a real user selecting text never does. So scroll the target into view
 * FIRST, wait for the scroll to stop firing, and then take focus with
 * `preventScroll` so the gesture itself moves nothing.
 *
 * Returns what the browser actually selected, so callers assert on a real
 * reading instead of on the string they passed in. That matters most for the
 * absence assertions: "no popover appeared" proves nothing unless the selection
 * it should have reacted to demonstrably existed.
 */
async function selectText(page: Page, editorId: string, needle: string): Promise<string> {
	return page.evaluate(
		async ({ editorId, needle }) => {
			const editor = document.getElementById(editorId)?.querySelector('.ProseMirror');
			if (!editor) throw new Error(`no ProseMirror inside #${editorId}`);
			const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
			let node: Node | null;
			while ((node = walker.nextNode())) {
				const offset = (node as Text).data.indexOf(needle);
				if (offset === -1) continue;
				const range = document.createRange();
				range.setStart(node, offset);
				range.setEnd(node, offset + needle.length);

				// Centre the target, then wait until the page has been quiet for
				// 100ms — `instant` overrides the inherited smooth behavior, but the
				// scroll event still lands a frame later, and a scroll landing after
				// the popover mounts is exactly what dismisses it.
				let lastScrollAt = performance.now();
				const noteScroll = () => (lastScrollAt = performance.now());
				document.addEventListener('scroll', noteScroll, true);
				window.scrollBy({
					top: range.getBoundingClientRect().top - window.innerHeight / 2,
					behavior: 'instant'
				});
				const deadline = performance.now() + 2000;
				while (performance.now() - lastScrollAt < 100 && performance.now() < deadline) {
					await new Promise((resolve) => setTimeout(resolve, 25));
				}
				document.removeEventListener('scroll', noteScroll, true);

				(editor as HTMLElement).focus({ preventScroll: true });
				const selection = document.getSelection();
				if (!selection) throw new Error('no document selection');
				selection.removeAllRanges();
				selection.addRange(range);
				return selection.toString();
			}
			throw new Error(`"${needle}" not found in #${editorId}`);
		},
		{ editorId, needle }
	);
}

/** What the browser has selected right now, across the whole document. */
function currentSelection(page: Page): Promise<string> {
	return page.evaluate(() => document.getSelection()?.toString() ?? '');
}

/** Drop the browser selection so the next instance starts from a clean slate. */
async function clearSelection(page: Page): Promise<void> {
	await page.evaluate(() => document.getSelection()?.removeAllRanges());
}

// HOW THE THREE "no popover appears" TESTS BELOW ARE TIMED, AND WHY IT IS NOT A
// POLL.
//
// They used to sleep 400ms after the gated gesture, on the grounds that the
// component debounces `selectionchange` by 20ms. Converting that to
// `expect.poll` is not possible, and the reason is worth stating rather than
// discovering: when the debounce fires and DECLINES, it writes nothing
// observable. Its callback's entire effect is assigning two private `$state`
// variables that feed `showSelectionPopover` and nothing else — no attribute, no
// class, no prop callback, no announcement. There is no condition to poll on,
// because the component's answer to "should I show this?" is only ever expressed
// by the popover existing.
//
// So the wait is a temporal CONTROL instead: perform the identical gesture on an
// UNGATED instance and wait for ITS popover with an auto-retrying matcher. That
// matcher does not resolve until the component has taken a `selectionchange`
// through the debounce and out the other side, which is the exact event the
// gated instances are being asserted not to have produced. It is a clock made of
// the mechanism under test, and it is self-calibrating: if the debounce ever
// grows, the control waits longer too, which is precisely what a fixed 400ms
// could not do.
//
// Two facts make it sound, and both are dependencies rather than decoration:
//
//   1. The gated instance has had ample opportunity to produce a popover before
//      anything is concluded from its not having done so. `selectText` burns at
//      least ~100ms of in-page time per call, in its scroll-quiescence loop (the
//      `while` above enters true and sleeps 25ms a turn until 100ms of quiet), so
//      each gated instance's own 20ms window has expired several times over by
//      the time the control gesture is even issued. Note that this is about
//      OPPORTUNITY, not about when the assertion samples: `watchForPopover` below
//      records the whole interval, so shortening that loop would not make the
//      absence assertion pass for the wrong reason — it would only narrow the
//      window in which a real popover had a chance to be recorded.
//   2. The absence is structurally gated, not merely slow: `showSelectionPopover`
//      is `$derived` with `mode === 'edit'` and `currentUserId !== undefined` in
//      it, and the readonly/exotic instances additionally never get as far as
//      scheduling the timer (the handler returns early on `mode !== 'edit'`). The
//      control proves the gesture works; the derived is why the gated instances
//      cannot produce a popover at any delay whatsoever.
//
// One thing the control DOES cost, and `watchForPopover` below is the repayment.
// Handing the clock to a second instance means the gated instance's selection has
// been replaced by the time its absence is asserted — so a bare `toHaveCount(0)`
// at the end would be satisfied by a popover that appeared and was torn down in
// between, which is precisely the failure it is supposed to catch. The old sleep
// did not have that hole (it asserted with the selection still standing) and the
// replacement must not open one. So the absence is recorded across the WHOLE
// interval rather than sampled at the end of it, which is strictly stronger than
// either shape: the sleep could only ever prove "not present at 400ms".

/**
 * Start recording whether a portaled popover is EVER inserted, from now on.
 *
 * Reads the mutation records rather than re-querying the document in the
 * callback: MutationObserver delivers at a microtask checkpoint, so a node added
 * and removed before that checkpoint is invisible to a `getElementById` inside
 * the callback and perfectly visible in `addedNodes`. A popover that flickered
 * for one task is exactly the regression worth catching.
 */
type PopoverWatch = {
	__popoverSeen?: Record<string, boolean>;
	__popoverWatchers?: MutationObserver[];
};

async function watchForPopover(page: Page, popoverId: string): Promise<void> {
	await page.evaluate((id) => {
		const win = window as unknown as PopoverWatch;
		const seen = (win.__popoverSeen ??= {});
		const watchers = (win.__popoverWatchers ??= []);
		seen[id] = document.getElementById(id) !== null;
		const observer = new MutationObserver((records) => {
			for (const record of records) {
				for (const node of record.addedNodes) {
					if (!(node instanceof Element)) continue;
					if (node.id === id || node.querySelector(`[id="${id}"]`)) seen[id] = true;
				}
			}
		});
		observer.observe(document.body, { childList: true, subtree: true });
		watchers.push(observer);
	}, popoverId);
}

/** Whether `watchForPopover` has seen that popover at any point since it started. */
function popoverEverAppeared(page: Page, popoverId: string): Promise<boolean> {
	return page.evaluate(
		(id) => (window as unknown as PopoverWatch).__popoverSeen?.[id] ?? false,
		popoverId
	);
}

/**
 * Tear the watchers down again.
 *
 * These describe blocks share one page across their tests, and a body-wide
 * `childList` observer left running would keep firing through the typing tests
 * that come later. Resetting the record as well means the ids are reusable
 * rather than sticky, so a later test cannot inherit a `true` it did not cause.
 */
async function stopWatchingPopovers(page: Page): Promise<void> {
	await page.evaluate(() => {
		const win = window as unknown as PopoverWatch;
		for (const observer of win.__popoverWatchers ?? []) observer.disconnect();
		win.__popoverWatchers = [];
		win.__popoverSeen = {};
	});
}

/**
 * Record every live-region announcement inside an instance.
 *
 * LiveRegion clears its message one second after setting it, so a polled read
 * can legitimately arrive after the text is gone. Observing from before the
 * interaction turns that race into an append-only log. The regions are
 * `cinder-sr-only`, which also makes this the only honest way to read them —
 * a visible-text locator finds nothing even when the announcement fired.
 */
async function recordAnnouncements(scope: Locator): Promise<void> {
	await scope.evaluate((element) => {
		const win = window as unknown as { __announcements?: string[] };
		const log: string[] = [];
		win.__announcements = log;
		new MutationObserver(() => {
			for (const region of element.querySelectorAll('[role="status"],[role="alert"]')) {
				const text = region.textContent?.trim();
				if (!text) continue;
				if (log[log.length - 1] !== text) log.push(text);
			}
		}).observe(element, { subtree: true, childList: true, characterData: true });
	});
}

function announcements(page: Page): Promise<string[]> {
	return page.evaluate(
		() => (window as unknown as { __announcements?: string[] }).__announcements ?? []
	);
}

/** The paragraph of body copy every instance shares, inside one instance. */
function bodyParagraph(page: Page, editorId: string): Locator {
	return page.locator(`#${editorId} .ProseMirror p`, { hasText: 'The first release includes' });
}

/**
 * Click an instance's anchor decoration and wait for its thread popover.
 *
 * The popover mounts before Floating UI has placed it, and marks that gap with
 * `inert` plus `data-position-ready`. Waiting for the ready flag rather than
 * for mere presence keeps every subsequent click aimed at a positioned,
 * non-inert dialog.
 */
async function openThreadPopover(page: Page, name: string): Promise<void> {
	await frame(page, name).locator('span.comment-anchor[data-thread-id]').click();
	const popover = page.locator(`#${name}-thread-popover`);
	await expect(popover).toHaveCount(1);
	await expect(popover).toHaveAttribute('data-position-ready', 'true');
}

test.describe('review-modes: mode is reflected everywhere and enforced in one place', () => {
	let page: Page;

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		await openReviewModes(page, INSTANCES);
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('`data-mode` echoes the passed string verbatim, including a value outside the union', async () => {
		// `data-mode={mode}` is an unfiltered reflection of the prop. The exotic
		// instance passes `'suggest'`, which the ReviewMode union does not
		// contain and the component never validates — so it reaches the
		// attribute unchanged.
		const expected: Record<string, string> = {
			'modes-edit': 'edit',
			'modes-readonly': 'readonly',
			'modes-nouser': 'edit',
			'modes-emptyuser': 'edit',
			'modes-snapshot': 'edit',
			'modes-plain': 'edit',
			'modes-exotic': 'suggest'
		};
		for (const name of INSTANCES) {
			await expect(surface(frame(page, name))).toHaveAttribute('data-mode', expected[name]);
		}
	});

	test('only the exact string `readonly` reaches the DOM as a disabled editor', async () => {
		// Enforcement reads `mode === 'readonly'`, never `data-mode`. The exotic
		// instance shows the two are independent: it reflects a non-union mode
		// and is still fully editable.
		await expect(page.locator('#modes-readonly .ProseMirror')).toHaveAttribute(
			'contenteditable',
			'false'
		);
		await expect(page.locator('#modes-readonly')).toHaveAttribute('data-readonly', 'true');

		for (const editorId of ['modes-edit', 'modes-exotic']) {
			await expect(page.locator(`#${editorId} .ProseMirror`)).toHaveAttribute(
				'contenteditable',
				'true'
			);
			// `data-readonly={readonly || undefined}` — the attribute is ABSENT
			// when editable, never `"false"`.
			await expect(page.locator(`#${editorId}`)).not.toHaveAttribute('data-readonly');
		}
	});

	test('readonly withholds the formatting toolbar while the unified control bar survives', async () => {
		const editSurface = surface(frame(page, 'modes-edit'));
		const readonlySurface = surface(frame(page, 'modes-readonly'));

		// One bar, in both modes, named "Review editor controls". It is
		// `role="group"` rather than `role="toolbar"`, because it contains a
		// `tablist` and hosts the editor's own `toolbar` — neither of which is
		// a valid child of a `toolbar`.
		for (const scope of [editSurface, readonlySurface]) {
			await expect(scope.getByRole('group', { name: 'Review editor controls' })).toHaveCount(1);
		}

		const formatting = editSurface.getByRole('toolbar', { name: 'Formatting toolbar' });
		await expect(formatting).toHaveCount(1);
		await expect(formatting).toHaveAttribute('id', 'modes-edit-toolbar');
		// The formatting controls live INSIDE the unified bar, in
		// `.controls-formatting`, rather than in a second stacked row: the
		// editor view has no `.editor-toolbar-wrapper` at all.
		await expect(editSurface.locator('#modes-edit-controls .controls-formatting')).toHaveCount(1);
		await expect(editSurface.locator('.editor-toolbar-wrapper')).toHaveCount(0);

		// `formatting={activeView === 'editor' && !isReadonly ? … : undefined}`:
		// readonly removes the snippet outright, it does not merely disable it.
		await expect(readonlySurface.getByRole('toolbar', { name: 'Formatting toolbar' })).toHaveCount(
			0
		);
		await expect(readonlySurface.locator('.controls-formatting')).toHaveCount(0);
	});

	test('readonly makes the selection popover structurally impossible', async () => {
		// The popover is portaled to `document.body`, so it is addressed by id
		// and never as a descendant of a container.
		const readonlyPopover = page.locator('#modes-readonly-selection-popover');
		const exoticPopover = page.locator('#modes-exotic-selection-popover');
		const editPopover = page.locator('#modes-edit-selection-popover');

		// Recording starts before the first gesture, so what is asserted at the end
		// is "never appeared", not "not present right now".
		await watchForPopover(page, 'modes-readonly-selection-popover');
		await watchForPopover(page, 'modes-exotic-selection-popover');

		// Readonly text is still selectable — the block lives in the component's
		// handler (`if (mode !== 'edit') { … return; }`), not in the browser.
		//
		// `currentSelection` immediately after, rather than after a delay: it is a
		// SEPARATE page evaluate in a later task, so a component (or a ProseMirror
		// observer) that stomped the selection synchronously or on a microtask
		// would show up here. What the old 400ms added on top of that was a longer
		// window for a stomp that never had a mechanism; the absence claim it was
		// really protecting is timed by the control below instead.
		expect(await selectText(page, 'modes-readonly', 'dashboard')).toBe('dashboard');
		expect(await currentSelection(page)).toBe('dashboard');

		// `showSelectionPopover` requires `mode === 'edit'` exactly, so the
		// out-of-union mode is gated out from the other side: an editable
		// document with no way to comment on it.
		await clearSelection(page);
		expect(await selectText(page, 'modes-exotic', 'dashboard')).toBe('dashboard');
		expect(await currentSelection(page)).toBe('dashboard');

		// The control does two jobs, and the second is the reason it moved up here
		// from the bottom of the test. It shows the identical gesture producing a
		// popover in an ungated instance — and, because the assertion below it is
		// auto-retrying and does not resolve until the component has carried a
		// `selectionchange` all the way through its 20ms debounce, it is also the
		// CLOCK for the two absences that follow. See the note above `test.describe`
		// for why a poll is unavailable and a control is the honest substitute.
		await clearSelection(page);
		expect(await selectText(page, 'modes-edit', 'dashboard')).toBe('dashboard');
		await expect(editPopover).toHaveCount(1);

		// Now the absences mean something. Both gated instances took the identical
		// gesture — readonly two `selectText` calls back, exotic one, so ≥200ms and
		// ≥100ms of in-page time respectively, against a 20ms debounce — and an
		// ungated instance has since carried the same gesture all the way to a
		// mounted popover. The recorded reads are the load-bearing pair: they cover
		// every instant since before the first gesture. The live counts are kept
		// underneath them because they also fail if a popover is present *now*,
		// which a record of past insertions would not report.
		expect(await popoverEverAppeared(page, 'modes-readonly-selection-popover')).toBe(false);
		expect(await popoverEverAppeared(page, 'modes-exotic-selection-popover')).toBe(false);
		await expect(readonlyPopover).toHaveCount(0);
		await expect(exoticPopover).toHaveCount(0);

		await expect(editPopover).toHaveAttribute('role', 'toolbar');
		await expect(editPopover).toHaveAttribute('aria-label', 'Selection actions');
		await expect(editPopover.getByLabel('Add comment')).toHaveCount(1);

		// Collapsing the selection tears it back down, which also leaves the
		// page clean for the next test.
		await clearSelection(page);
		await expect(editPopover).toHaveCount(0);
		await stopWatchingPopovers(page);
	});

	test('readonly strips the sidebar of every mutating affordance but keeps the thread list', async () => {
		for (const name of ['modes-edit', 'modes-readonly']) {
			// Singular/plural is computed from the visible comment count, so the
			// accessible name is "(1 comment)" and never "(1 comments)".
			await surface(frame(page, name))
				.getByRole('button', { name: 'Open comments sidebar (1 comment)' })
				.click();
			const sidebar = page.locator(`#${name}-sidebar`);
			await expect(sidebar).toHaveCount(1);
			await expect(sidebar).toHaveAttribute('aria-label', 'Comment threads');
			await expect(sidebar.locator('.thread-item')).toHaveCount(1);
		}

		const editSidebar = page.locator('#modes-edit-sidebar');
		await expect(editSidebar.getByRole('button', { name: 'Add document comment' })).toHaveCount(1);
		await expect(editSidebar.getByRole('button', { name: 'Comment actions' })).toHaveCount(1);

		const readonlySidebar = page.locator('#modes-readonly-sidebar');
		await expect(readonlySidebar.getByRole('button', { name: 'Add document comment' })).toHaveCount(
			0
		);
		await expect(readonlySidebar.getByRole('button', { name: 'Comment actions' })).toHaveCount(0);

		// Close both: an open sidebar narrows the editor column, and the later
		// click-and-type test picks its click target by layout.
		for (const name of ['modes-edit', 'modes-readonly']) {
			await surface(frame(page, name))
				.getByRole('button', { name: 'Close comments sidebar (1 comment)' })
				.click();
			await expect(page.locator(`#${name}-sidebar`)).toHaveCount(0);
		}
	});

	test('readonly strips the thread popover down to Close, with no reply composer', async () => {
		const editPopover = page.locator('#modes-edit-thread-popover');
		await openThreadPopover(page, 'modes-edit');
		await expect(editPopover).toHaveAttribute('role', 'dialog');
		// FIXED (cinder#1305): `aria-modal="true"` used to be asserted here, but
		// it was a false claim the popover never backed up — nothing outside it
		// was made `inert`, and F6 landmark navigation deliberately moves focus
		// out to `.review-editor-main` while the popover stays open, which is
		// the popover's intended non-modal workflow (an anchored comment
		// popover, not a blocking dialog). The attribute is now genuinely
		// absent rather than present-but-dishonest. Modality semantics belong
		// to review-ssr-and-a11y; this is just the control this test's
		// readonly-vs-edit comparison already needed matching the new baseline.
		await expect(editPopover).not.toHaveAttribute('aria-modal');
		await expect(editPopover.getByRole('button', { name: 'Delete thread' })).toBeEnabled();
		await expect(editPopover.getByRole('button', { name: 'Edit comment' })).toHaveCount(1);
		await expect(editPopover.getByRole('button', { name: 'Delete comment' })).toHaveCount(1);
		// The reply composer's textarea is `{popoverId}-composer`.
		await expect(page.locator('#modes-edit-thread-popover-composer')).toHaveCount(1);
		await editPopover.getByRole('button', { name: 'Close' }).click();
		await expect(editPopover).toHaveCount(0);

		const readonlyPopover = page.locator('#modes-readonly-thread-popover');
		await openThreadPopover(page, 'modes-readonly');
		// The seeded comment's author is `steve`, which is also this instance's
		// `currentUserId` — so these four are withheld by readonly and by
		// nothing else. Same seed, same identity, different mode.
		await expect(readonlyPopover.getByRole('button', { name: 'Delete thread' })).toHaveCount(0);
		await expect(readonlyPopover.getByRole('button', { name: 'Edit comment' })).toHaveCount(0);
		await expect(readonlyPopover.getByRole('button', { name: 'Delete comment' })).toHaveCount(0);
		await expect(page.locator('#modes-readonly-thread-popover-composer')).toHaveCount(0);
		// Reading is untouched: the quote and the comment body still render.
		await expect(readonlyPopover.getByText('Title reads well — keep it.')).toBeVisible();
		await readonlyPopover.getByRole('button', { name: 'Close' }).click();
		await expect(readonlyPopover).toHaveCount(0);
	});

	test('typing into a readonly editor leaves `value` byte-identical; the same gesture edits an edit instance', async () => {
		const readonlyValue = page.getByTestId('modes-readonly-value-json');
		const readonlyBefore = ((await readonlyValue.textContent()) ?? '').trim();
		expect(readonlyBefore).toContain('# Release Plan');

		// Clicking a `contenteditable="false"` ProseMirror does not focus it;
		// focus lands on the markdown-editor host, which carries `tabindex="0"`
		// for exactly this reason. Asserting that first is what makes the
		// no-op assertion below mean something: the keystrokes were delivered
		// INSIDE the editor, they just had nowhere to go.
		await page.locator('#modes-readonly .ProseMirror').click();
		await expect(page.locator('#modes-readonly')).toBeFocused();
		await page.keyboard.type('INJECTED');

		// The control does double duty. It shows the same gesture working under
		// `mode="edit"` — and, because it is asserted first, it proves a full
		// keystroke → onchange → DOM cycle has elapsed since the readonly
		// keystrokes above. That is what licenses the negative assertions after
		// it without an arbitrary sleep.
		const editValue = page.getByTestId('modes-edit-value-json');
		const editBefore = ((await editValue.textContent()) ?? '').trim();
		await bodyParagraph(page, 'modes-edit').click();
		await expect(page.locator('#modes-edit .ProseMirror')).toBeFocused();
		await page.keyboard.type('INJECTED');

		await expect(page.locator('#modes-edit .ProseMirror')).toContainText('INJECTED');
		await expect
			.poll(async () => ((await editValue.textContent()) ?? '').trim())
			.not.toBe(editBefore);
		// `onchange` carries the whole new document rather than a delta, which is
		// why the log records a length. How many events a typing burst coalesces
		// into is the editor's business and not pinned here — only that at least
		// one arrived carrying a document length.
		await expect(page.getByTestId('modes-edit-event-log').getByRole('listitem').last()).toHaveText(
			/^change:\d+$/
		);

		await expect(page.locator('#modes-readonly .ProseMirror')).not.toContainText('INJECTED');
		expect(((await readonlyValue.textContent()) ?? '').trim()).toBe(readonlyBefore);
		await expect(page.getByTestId('modes-readonly-event-count')).toHaveText('events: 0');
	});

	test('readonly keeps view switching, the sidebar, and every export action', async () => {
		const scope = surface(frame(page, 'modes-readonly'));

		await frame(page, 'modes-readonly').getByRole('tab', { name: 'Diff' }).click();
		await expect(scope).toHaveAttribute('data-view', 'diff');
		// Revert All is gated on `activeView === 'diff' && hasContentChanges &&
		// !readonly`. This instance satisfies the first two, so readonly is the
		// only thing withholding it; `review-views` owns the other two thirds.
		await expect(scope.getByLabel('Revert all changes')).toHaveCount(0);

		await frame(page, 'modes-readonly').getByRole('tab', { name: 'Summary' }).click();
		await expect(scope).toHaveAttribute('data-view', 'summary');
		await expect(page.locator('#modes-readonly-summary-panel')).toHaveCount(1);

		await frame(page, 'modes-readonly').getByRole('tab', { name: 'Editor' }).click();
		await expect(scope).toHaveAttribute('data-view', 'editor');
		// The editor comes back readonly — a view round trip does not reset
		// `mode`. (It does lose the anchor decoration, which is a separate
		// upstream problem and not this route's to pin, so nothing here depends
		// on the decoration surviving the trip.)
		await expect(page.locator('#modes-readonly .ProseMirror')).toHaveAttribute(
			'contenteditable',
			'false'
		);

		// Export is a read-only capability, so readonly withholds none of it:
		// the trigger opens `{id}-export-menu` with all five formats.
		await scope.getByRole('button', { name: 'Copy to clipboard' }).click();
		const menu = page.locator('#modes-readonly-export-menu');
		await expect(menu).toHaveAttribute('role', 'menu');
		await expect(menu.getByRole('menuitem')).toHaveText([
			'Content',
			'Summary (for LLM)',
			'Git Diff',
			'Comments',
			'JSON'
		]);
	});
});

test.describe('review-modes: currentUserId has three states, not two', () => {
	let page: Page;

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		await openReviewModes(page, ['modes-edit', 'modes-nouser', 'modes-emptyuser']);
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('an omitted currentUserId blocks the selection popover; an empty-string one does not', async () => {
		// `showSelectionPopover` tests `currentUserId !== undefined`. That single
		// check is the entire difference between these two instances.
		const nouserPopover = page.locator('#modes-nouser-selection-popover');
		const emptyuserPopover = page.locator('#modes-emptyuser-selection-popover');

		// Same recording-before-the-gesture shape as the readonly test, and needed
		// for the same reason: the control gesture replaces this instance's
		// selection, so the end-of-test count alone could not tell "never appeared"
		// from "appeared and was torn down".
		await watchForPopover(page, 'modes-nouser-selection-popover');

		expect(await selectText(page, 'modes-nouser', 'dashboard')).toBe('dashboard');
		expect(await currentSelection(page)).toBe('dashboard');

		// `modes-emptyuser` is the control, and therefore the clock — same reasoning
		// as the readonly test, and worth noting that this instance is a sharper
		// control than the edit one would be: it differs from `modes-nouser` in the
		// single prop under test and in nothing else, so the popover appearing here
		// and not there isolates `currentUserId !== undefined` exactly.
		//
		// Note also that the gate is entirely in the derived. Unlike the readonly
		// case, the debounced handler runs to completion for `modes-nouser` and
		// writes a real `selectionPopoverPosition`; only `showSelectionPopover`
		// declines to render it.
		await clearSelection(page);
		expect(await selectText(page, 'modes-emptyuser', 'dashboard')).toBe('dashboard');
		await expect(emptyuserPopover).toHaveCount(1);

		expect(await popoverEverAppeared(page, 'modes-nouser-selection-popover')).toBe(false);
		await expect(nouserPopover).toHaveCount(0);

		await clearSelection(page);
		await expect(emptyuserPopover).toHaveCount(0);
		await stopWatchingPopovers(page);
	});

	test('an omitted currentUserId renders `Delete thread` disabled and drops the reply composer', async () => {
		const popover = page.locator('#modes-nouser-thread-popover');
		await openThreadPopover(page, 'modes-nouser');

		// Three different gates, three different outcomes, in one popover.
		// `Delete thread` renders because the instance is not readonly, and is
		// DISABLED because `disabled={!currentUserId}`…
		await expect(popover.getByRole('button', { name: 'Delete thread' })).toBeDisabled();
		// …the reply composer is gated on `!isReadonly && currentUserId`, so it
		// is not rendered at all…
		await expect(page.locator('#modes-nouser-thread-popover-composer')).toHaveCount(0);
		// …and Edit/Delete comment are absent for a reason that is neither:
		// authorship. The seeded comment's `authorId` is `steve` while
		// `currentUserId` is undefined, so `comment.authorId === currentUserId`
		// fails. From outside this looks identical to the readonly case, which
		// is why the readonly test uses a matching author to tell them apart.
		await expect(popover.getByRole('button', { name: 'Edit comment' })).toHaveCount(0);
		await expect(popover.getByRole('button', { name: 'Delete comment' })).toHaveCount(0);

		await popover.getByRole('button', { name: 'Close' }).click();
		await expect(popover).toHaveCount(0);
	});

	test('the sidebar still offers `Add document comment` without a user — it accepts a body, closes, and fires nothing', async () => {
		// The sidebar button is gated on `!readonly` alone; the identity check
		// happens later, inside `handleAddDocumentComment`, which `devWarn`s and
		// returns. The affordance is therefore fully interactive and completely
		// inert — indistinguishable from a working one without the event log.
		await surface(frame(page, 'modes-nouser'))
			.getByRole('button', { name: 'Open comments sidebar (1 comment)' })
			.click();
		await page
			.locator('#modes-nouser-sidebar')
			.getByRole('button', { name: 'Add document comment' })
			.click();

		const composer = page.locator('#modes-nouser-sidebar-document-composer');
		await expect(composer).toHaveAttribute(
			'placeholder',
			'Add a comment about the entire document...'
		);
		await composer.fill('Anonymous document note');
		// The composer submits on Cmd/Ctrl+Enter; its inline submit button only
		// becomes clickable on `:focus-within`, so the keyboard path is both the
		// documented one and the stable one.
		await page.keyboard.press('Control+Enter');

		// It closes on submit exactly as a successful one would.
		await expect(composer).toHaveCount(0);
		await expect(page.getByTestId('modes-nouser-threadcreate-count')).toHaveText('threadcreate: 0');
		await expect(page.getByTestId('modes-nouser-event-count')).toHaveText('events: 0');
		await expect(page.locator('#modes-nouser-sidebar .thread-item')).toHaveCount(1);

		// Control: the identical flow with `currentUserId="steve"` fires once,
		// carrying the body and the author on the event.
		await surface(frame(page, 'modes-edit'))
			.getByRole('button', { name: 'Open comments sidebar (1 comment)' })
			.click();
		await page
			.locator('#modes-edit-sidebar')
			.getByRole('button', { name: 'Add document comment' })
			.click();
		await page.locator('#modes-edit-sidebar-document-composer').fill('Real document note');
		await page.keyboard.press('Control+Enter');

		await expect(page.getByTestId('modes-edit-threadcreate-count')).toHaveText('threadcreate: 1');
		await expect(page.getByTestId('modes-edit-event-log').getByRole('listitem')).toHaveText([
			'threadcreate:steve:Real document note'
		]);
		// The thread list is still 1: `onthreadcreate` is notification-only and
		// this page deliberately never applies it.
		await expect(page.locator('#modes-edit-sidebar .thread-item')).toHaveCount(1);
	});

	test('currentUserId="" offers the whole comment-creation flow and then refuses the submit, announcing it assertively', async () => {
		const scope = surface(frame(page, 'modes-emptyuser'));
		await recordAnnouncements(scope);

		const popover = page.locator('#modes-emptyuser-selection-popover');
		expect(await selectText(page, 'modes-emptyuser', 'dashboard')).toBe('dashboard');
		await expect(popover).toHaveCount(1);

		await popover.getByLabel('Add comment').click();
		await popover.getByLabel('Comment text').fill('Should not be accepted');
		await popover.getByLabel('Submit comment').click();

		// `handleSelectionComment` opens with `if (!currentUserId)` — a
		// TRUTHINESS test, where the visibility gate was `!== undefined`. The
		// empty string passes one and fails the other, so the flow is offered in
		// full and dropped at the last step.
		//
		// Asserting the COMPOSER is gone, not the popover. `toHaveCount(0)` on the
		// popover was pinning a transient: the refusal calls `clear()`, which drops
		// the position and the expanded flag — but `clear()` is not a close-latch,
		// and visibility is derived from a live selection that still has 'dashboard'
		// in it, so the 20ms `selectionchange` debounce re-mounts the popover in its
		// collapsed icon state. Per-frame sampling found the absent window is only
		// ~16-27ms wide in every engine (chromium 24-40ms, webkit 50-69ms, firefox
		// 63-80ms); Chromium happened to sample inside it and the other two did not.
		//
		// So this is a Chromium-specific assumption being corrected, not a WebKit
		// bug — and the replacement pins strictly more than the original did. The
		// durable, engine-independent claim is that the composer was dismissed and
		// the typed body discarded, while the affordance itself remains offered.
		await expect(popover.getByLabel('Comment text')).toHaveCount(0);
		await expect(popover.getByRole('button', { name: 'Add comment' })).toHaveCount(1);
		await expect(page.getByTestId('modes-emptyuser-threadcreate-count')).toHaveText(
			'threadcreate: 0'
		);
		await expect(page.getByTestId('modes-emptyuser-event-count')).toHaveText('events: 0');

		// The failure is announced on the assertive region — `role="alert"`,
		// `aria-live="assertive"` — and that region is `cinder-sr-only`, so the
		// text is NOT visible on the page. `review-ssr-and-a11y` owns the
		// geometry; here only the message and its priority matter.
		const alert = scope.locator('[role="alert"][aria-live="assertive"]');
		await expect(alert).toHaveClass(/cinder-sr-only/);
		await expect
			.poll(() => announcements(page))
			.toContain('Could not add comment. Please try selecting text again.');
	});
});

test.describe('review-modes: snapshotMode, placeholder, and class', () => {
	let page: Page;

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		await openReviewModes(page, ['modes-edit', 'modes-snapshot', 'modes-plain']);
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('snapshotMode stamps `data-snapshot-mode` on the container AND the inner editor wrapper', async () => {
		await expect(surface(frame(page, 'modes-snapshot'))).toHaveAttribute(
			'data-snapshot-mode',
			'true'
		);
		// ReviewEditor forwards the prop to its MarkdownEditor, which stamps its
		// own wrapper: two elements, one prop.
		await expect(frame(page, 'modes-snapshot').locator('.markdown-editor-wrapper')).toHaveAttribute(
			'data-snapshot-mode',
			'true'
		);

		// `data-snapshot-mode={snapshotMode || undefined}`: with the prop false
		// the attribute is ABSENT rather than `"false"`, so an attribute
		// selector matches nothing instead of matching a falsy value.
		await expect(surface(frame(page, 'modes-plain'))).not.toHaveAttribute('data-snapshot-mode');
		await expect(
			frame(page, 'modes-plain').locator('.markdown-editor-wrapper')
		).not.toHaveAttribute('data-snapshot-mode');
	});

	test('snapshotMode suppresses the caret and the selection highlight on the container and every descendant', async () => {
		// The authored rule is `[data-snapshot-mode], [data-snapshot-mode] *` — but
		// the descendant half does NOT reach the ProseMirror, and never has, in any
		// engine. This test used to claim it did, and passed in Chromium for an
		// unrelated reason. Firefox is what noticed.
		//
		// Inside a Svelte `<style>` the `*` compiles to `:where(.svelte-…)`, so the
		// descendant half can only match elements the component itself rendered.
		// `.milkdown` and `.ProseMirror` are created at runtime by Milkdown and
		// carry no scope class, so `element.matches(<compiled selector>)` is false
		// for them — verified in Chromium too, not just Firefox. What Chromium was
		// showing is Blink INHERITING `user-select`, which css-ui-4 defines as
		// non-inherited and which Gecko implements as such. So Firefox's `auto`
		// there is the spec-correct value.
		//
		// `caret-color` is genuinely inherited, which is why only the `user-select`
		// key diverged — and it is why the caret half of these assertions really
		// was measuring what it claimed. Those stay exactly as they were.
		//
		// What replaces the false key pins strictly more: `.markdown-editor-wrapper`
		// is the last scope-classed ancestor, i.e. the true boundary of the rule.
		// Asserting `none` there catches a regression that broke the container rule,
		// which the old `.ProseMirror` read could not distinguish from inheritance.
		//
		// `user-select` is read under BOTH spellings, and that is not defensive
		// padding: WebKit does not implement the unprefixed property at all
		// (`CSS.supports('user-select', 'none')` is false there), so the
		// unprefixed read returns `''` and only `-webkit-user-select` carries the
		// value. Reading one name and getting `''` would have looked exactly like
		// "the rule does not reach this element", which is the claim this test
		// exists to make — a false negative dressed as a finding. The expected
		// value stays exactly `'none'`: the suppression genuinely happens in
		// WebKit, it is just spelled differently.
		const readStyles = (scope: Locator) =>
			scope.evaluate((container) => {
				const editor = container.querySelector('.ProseMirror')!;
				const wrapper = container.querySelector('.markdown-editor-wrapper')!;
				const select = (element: Element) => {
					const computed = getComputedStyle(element);
					return (
						computed.getPropertyValue('user-select') ||
						computed.getPropertyValue('-webkit-user-select')
					);
				};
				return {
					containerSelect: select(container),
					containerCaret: getComputedStyle(container).caretColor,
					wrapperSelect: select(wrapper),
					editorCaret: getComputedStyle(editor).caretColor
				};
			});

		expect(await readStyles(surface(frame(page, 'modes-snapshot')))).toEqual({
			containerSelect: 'none',
			containerCaret: 'rgba(0, 0, 0, 0)',
			wrapperSelect: 'none',
			editorCaret: 'rgba(0, 0, 0, 0)'
		});

		// The control: without the attribute nothing is suppressed, and the
		// caret keeps a real, opaque color.
		//
		// A SET rather than a literal, because `auto` and `text` are the same
		// answer spelled two ways — the initial value's used value chains from the
		// parent, and the engines serialize that differently. Naming both keeps the
		// claim exact ("selectable"); `not.toBe('none')` would have been vaguer,
		// and a bare `'auto'` was asserting a Chromium spelling.
		const plain = await readStyles(surface(frame(page, 'modes-plain')));
		expect(['auto', 'text']).toContain(plain.containerSelect);
		expect(['auto', 'text']).toContain(plain.wrapperSelect);
		expect(plain.containerCaret).not.toBe('rgba(0, 0, 0, 0)');
		expect(plain.editorCaret).not.toBe('rgba(0, 0, 0, 0)');
	});

	test('snapshotMode really is purely visual: the editor still takes typed input and still creates comments', async () => {
		// The prop's own doc says it "does NOT affect editability, ProseMirror
		// state, or any prop controlled by readonly / mode". `user-select: none`
		// on a contenteditable makes that non-obvious — but a real click still
		// places a caret and the keystrokes still land.
		const value = page.getByTestId('modes-snapshot-value-json');
		const before = ((await value.textContent()) ?? '').trim();

		await bodyParagraph(page, 'modes-snapshot').click();
		await expect(page.locator('#modes-snapshot .ProseMirror')).toBeFocused();
		await page.keyboard.type('SNAPSHOT');

		await expect(page.locator('#modes-snapshot .ProseMirror')).toContainText('SNAPSHOT');
		await expect.poll(async () => ((await value.textContent()) ?? '').trim()).not.toBe(before);
		// `onchange` fired with a document length, so ProseMirror state genuinely
		// moved rather than the DOM merely repainting.
		await expect(
			page.getByTestId('modes-snapshot-event-log').getByRole('listitem').last()
		).toHaveText(/^change:\d+$/);

		// The mount-time blur is exactly that: a `$effect` whose only reactive
		// dependencies are `snapshotMode` and the container element. It runs
		// once and never again, so focus acquired afterwards is left alone.
		await expect(page.locator('#modes-snapshot .ProseMirror')).toBeFocused();

		// Comment creation is untouched too — the selection popover appears here
		// exactly as it does in a non-snapshot edit instance.
		expect(await selectText(page, 'modes-snapshot', 'Checklist')).toBe('Checklist');
		await expect(page.locator('#modes-snapshot-selection-popover')).toHaveCount(1);
		await clearSelection(page);
		await expect(page.locator('#modes-snapshot-selection-popover')).toHaveCount(0);
	});

	test('`placeholder` paints when the editor is empty, through a decoration that now actually arrives', async () => {
		const inlinePlaceholder = (editorId: string) =>
			page
				.locator(`#${editorId}`)
				.evaluate((element) =>
					(element as HTMLElement).style.getPropertyValue('--editor-placeholder')
				);

		// The prop is still written straight onto the markdown-editor host as
		// `style:--editor-placeholder="'{escaped}'"` with no emptiness check —
		// an earlier draft of the cinder#1306 fix DID gate this on `value`, but
		// that gate was itself reverted in review: `value` is this component's
		// own debounced `$bindable`, so for a few hundred ms after deleting the
		// last character the synchronous ProseMirror decoration below had
		// already cleared while `value` still reported old content, and the
		// CSS's own fallback (`var(--editor-placeholder, 'Start writing...')`)
		// painted the wrong text during that window. Unconditional-but-inert
		// beats gated-but-briefly-wrong, so the property is present on a fully
		// populated document too, arriving as a QUOTED CSS string ready for
		// `content:`, not as a bare value.
		//
		// The quote CHARACTER is engine serialization, not component behavior:
		// Chromium and Firefox hand back the author's original token text, while
		// WebKit re-serializes string tokens with double quotes. The component
		// writes `'…'` in all three. Pinning the engine's spelling keeps the real
		// claim — that it is quoted at all, and therefore usable by `content:` —
		// exact, rather than weakening it to a substring match.
		//
		// `test.info().project.name` rather than the `browserName` fixture: this
		// callback takes no arguments (the suite shares a module-level `page`), so
		// the fixture is not destructurable here. WebKit is split into bounded
		// projects so its browser process never crosses its context lifetime limit.
		const quoted = (text: string) =>
			test.info().project.name.startsWith('webkit-') ? `"${text}"` : `'${text}'`;

		expect(await inlinePlaceholder('modes-plain')).toBe(quoted('Start reviewing…'));
		expect(await inlinePlaceholder('modes-edit')).toBe(quoted('Start writing...'));

		// FIXED (cinder#1306). The stylesheet paints the placeholder through
		// `.ProseMirror p.is-editor-empty:first-child::before`, and Milkdown's
		// `placeholderPlugin` decorates the first paragraph with that class
		// whenever the document is empty — the decoration itself was never the
		// bug. What raced was its REGISTRATION: the lazy plugin that installs it
		// used to import `@milkdown/kit/core` inside an async handler, so
		// `EditorState.create()`'s one-time plugin snapshot usually ran before
		// that import resolved and silently excluded it for the editor's whole
		// life. Registering the timer synchronously (mirroring Milkdown's own
		// `$proseAsync` pattern) wins that race every time, so `modes-plain`'s
		// empty document now carries the class with no interaction needed.
		await expect(page.getByTestId('modes-plain-value-length')).toHaveText('value length: 0');
		const emptyParagraph = page.locator('#modes-plain .ProseMirror p');
		await expect(emptyParagraph).toHaveCount(1);
		await expect(emptyParagraph).toHaveClass(/is-editor-empty/);

		// Read the pseudo-element the class unlocks without forcing anything —
		// this is what a real paint pass resolves, not a simulated one. The
		// browser's CSS-OM serialization of a resolved `content` value is
		// double-quoted regardless of engine (unlike the raw custom-property
		// text above, which preserves the author's own quote character), so
		// this is a literal rather than `quoted()`.
		const painted = await emptyParagraph.evaluate((paragraph) => {
			const before = getComputedStyle(paragraph, '::before');
			return { content: before.content, color: before.color };
		});
		expect(painted.content).toBe('"Start reviewing…"');
		// A `content` string alone would still be the old bug one layer down —
		// present but invisible. `color: transparent` (or an alpha-zero rgba)
		// would mean exactly that, so pin genuine visibility, not merely a
		// populated string.
		expect(painted.color).not.toBe('rgba(0, 0, 0, 0)');
		expect(painted.color).not.toBe('transparent');

		// The decoration is a live ProseMirror computation, not a mount-time
		// snapshot, so it hides the moment the document stops being empty —
		// the same gesture a real reviewer would use.
		await emptyParagraph.click();
		await expect(page.locator('#modes-plain .ProseMirror')).toBeFocused();
		await page.keyboard.type('No longer empty');
		await expect(emptyParagraph).not.toHaveClass(/is-editor-empty/);
		const afterTyping = await emptyParagraph.evaluate(
			(paragraph) => getComputedStyle(paragraph, '::before').content
		);
		expect(afterTyping).toBe('none');

		// Either way the placeholder is decoration and not content: a
		// pseudo-element is invisible to the accessibility tree, and nothing
		// carries a `placeholder` attribute for a locator to find.
		await expect(page.getByPlaceholder('Start reviewing…')).toHaveCount(0);
	});

	test('`class` is merged onto the container after `review-editor-container`, not substituted for it', async () => {
		const classesOf = (scope: Locator) => scope.evaluate((element) => [...element.classList]);

		const merged = await classesOf(surface(frame(page, 'modes-plain')));
		// `classNames('review-editor-container', className)` puts the
		// component's own class first; the Svelte compiler then appends its
		// scoping hash. That trailing hash is why this is a membership plus
		// index check rather than a string comparison.
		expect(merged[0]).toBe('review-editor-container');
		expect(merged).toContain('exercise-frame');
		expect(merged.some((name) => name.startsWith('svelte-'))).toBe(true);

		// An instance that passes no `class` still gets the base class, so the
		// merge added `exercise-frame` rather than replacing anything.
		const bare = await classesOf(surface(frame(page, 'modes-edit')));
		expect(bare[0]).toBe('review-editor-container');
		expect(bare).not.toContain('exercise-frame');
	});
});

import { expect, test } from '@playwright/test';
import { gotoHydrated } from '../hydration';
import { pressNextTabStop } from '../keyboard';
import type { Page } from '@playwright/test';

// What the server renders, what hydration adds, and how the composed
// ReviewEditor surface behaves for a keyboard or screen-reader user.
//
// These belong together because they need machinery the behaviour-focused
// `review-*` routes deliberately avoid: a raw HTTP read of the server HTML, a
// `javaScriptEnabled: false` context, computed-geometry reads, and full Tab
// walks. Concentrating them here keeps the other routes free of that
// infrastructure and gives one place where PRE-hydration state is asserted at
// all — every other spec starts from `gotoHydrated`, which by definition can
// only see the world after hydration has already happened.
//
// Hydration *cleanliness* is deliberately NOT asserted here. Svelte strips
// `hydration_mismatch` from production output and this suite runs against
// `build && preview`, so any such assertion would be permanently vacuous. The
// dev-server harness in `src/routes/hydration.e2e.ts` is the only build that
// can see it. Worth recording while the reader is here: the mismatch the review
// routes emit in dev traces to `@lostgradient/cinder/icons`, whose export
// conditions hand SSR a prebuilt server bundle and the client the raw sources —
// the same lucide components compiled twice, by two Svelte versions. That is a
// packaging artefact, not an `@lostgradient/editor` defect.

const ROUTE = '/exercises/review-ssr-and-a11y';
const EDITOR_ID = 'a11y-editor';

// The seeded comment body. It appears in the page's data and NOWHERE in its own
// markup, so searching the rendered text for it is a genuine test of whether
// the component leaked review content into the pre-hydration DOM.
const SENTINEL = 'SENTINEL comment body';

/** Navigate, wait for hydration, and wait for the editor to actually mount. */
async function ready(page: Page): Promise<void> {
	await gotoHydrated(page, ROUTE);
	// `data-ready` is the component's own mount gate — see the SSR tests below
	// for what it does and does not promise. `.ProseMirror` only exists once
	// MarkdownEditor runs inside its `{#if browser}` guard.
	await expect(page.locator(`[data-testid="review-editor"][data-ready="true"]`)).toBeVisible();
	await expect(page.locator('.ProseMirror')).toBeVisible();
}

type ActiveDescriptor = {
	tag: string;
	role: string | null;
	label: string | null;
	id: string;
	className: string;
	text: string;
	inControls: boolean;
	inEditorMain: boolean;
	inPopover: boolean;
};

/**
 * Read `document.activeElement` as a legible record rather than asserting
 * through a `:focus` locator. A failure message that says
 * `{ tag: 'BUTTON', label: 'Copy to clipboard' }` names the element that
 * actually had focus; a failed `:focus` locator only says it found nothing.
 */
function activeDescriptor(page: Page): Promise<ActiveDescriptor> {
	return page.evaluate(() => {
		const element = document.activeElement;
		if (!(element instanceof HTMLElement)) {
			return {
				tag: 'NONE',
				role: null,
				label: null,
				id: '',
				className: '',
				text: '',
				inControls: false,
				inEditorMain: false,
				inPopover: false
			};
		}
		return {
			tag: element.tagName,
			role: element.getAttribute('role'),
			label: element.getAttribute('aria-label'),
			id: element.id,
			className: typeof element.className === 'string' ? element.className : '',
			text: (element.textContent ?? '').trim().slice(0, 40),
			inControls: element.closest('.review-editor-controls') !== null,
			inEditorMain: element.closest('.review-editor-main') !== null,
			inPopover: element.closest('.thread-popover') !== null
		};
	});
}

/** Press Tab once, then poll until focus settles on something matching. */
async function tabTo(page: Page, expected: Partial<ActiveDescriptor>): Promise<void> {
	await page.keyboard.press('Tab');
	await expect.poll(() => activeDescriptor(page)).toMatchObject(expected);
}

/**
 * Tab forward until the editable ProseMirror surface has focus.
 *
 * For tests whose subject is what happens ONCE THE CARET IS IN THE EDITOR, where
 * the stops on the way are scaffolding rather than the claim. Naming those stops
 * made such tests engine-dependent for no benefit: WebKit omits buttons from the
 * Tab order (see `../keyboard`), so a hard-coded six-press walk never arrived and
 * the test failed for a reason unrelated to what it pins.
 *
 * The stop sequence itself is still pinned, in the two tab-order tests that exist
 * to assert it. This helper deliberately does not.
 *
 * Bounded: a surface that never accepts focus fails with a named error rather
 * than looping. The cap is a loop guard, not a timing guess — every press is
 * followed by a settled read, so a slow engine takes longer rather than fewer
 * stops.
 */
async function tabToEditableSurface(page: Page, browserName: string): Promise<void> {
	for (let press = 0; press < 12; press += 1) {
		const active = await activeDescriptor(page);
		if (active.role === 'textbox' && active.label === 'Markdown editor') return;
		await pressNextTabStop(page, browserName);
	}
	throw new Error(
		'Tabbed 12 times without reaching the editable surface (role=textbox, label="Markdown editor")'
	);
}

/**
 * Press Tab and poll until focus has actually moved off `from`, then report
 * where it landed. Used where the walk collects stops rather than asserting a
 * known sequence: reading `document.activeElement` immediately after a keypress
 * is a separate round trip and would be a race, so wait for the value to change
 * instead. Every consecutive pair of stops on this page is distinct, which is
 * what makes "changed" a usable settle condition.
 */
async function tabAndSettle(page: Page, from: ActiveDescriptor): Promise<ActiveDescriptor> {
	const before = JSON.stringify(from);
	await page.keyboard.press('Tab');
	await expect.poll(async () => JSON.stringify(await activeDescriptor(page))).not.toBe(before);
	return activeDescriptor(page);
}

/**
 * The block element ProseMirror's caret currently sits in.
 *
 * Load-bearing for the Tab tests: what Tab does in this editor depends entirely
 * on the caret's block, because it is bound to sink-list-item, which applies
 * only inside a list. `activeDescriptor` cannot answer that — every position in
 * the document reports the same focused `.ProseMirror`.
 */
function caretBlock(page: Page): Promise<{ tag: string; text: string }> {
	return page.evaluate(() => {
		const selection = window.getSelection();
		const node = selection?.anchorNode ?? null;
		const element = node instanceof Text ? node.parentElement : (node as Element | null);
		return {
			tag: element?.tagName ?? 'NONE',
			text: (element?.textContent ?? '').trim().slice(0, 40)
		};
	});
}

/**
 * The markdown the component is exporting right now, through the hidden form
 * input the SSR tests above enumerate. Reading the document through it rather
 * than through `.ProseMirror`'s rendered text is what makes list INDENTATION
 * observable — the rendered text of an indented bullet is identical to the
 * rendered text of an unindented one.
 */
function currentMarkdown(page: Page) {
	return page.locator('input[type="hidden"][name="review-current"]');
}

/**
 * Install a MutationObserver over the editor's announcer regions BEFORE an
 * action, so the spec can assert on messages that only exist for ~1s.
 *
 * Polling the region's text directly would be a race with its own self-clearing
 * timeout; recording every value it ever held is not. The comments-count
 * announcer is excluded because it is a different region with a different job,
 * and ExportActions' region is excluded automatically — it carries `aria-live`
 * but no `role` at all.
 */
async function recordAnnouncements(page: Page): Promise<void> {
	await page.evaluate(() => {
		const container = document.querySelector('[data-testid="review-editor"]');
		if (!container) throw new Error('review editor container not found');
		const log: string[] = [];
		(window as unknown as { __announcements: string[] }).__announcements = log;
		const read = () => {
			const regions = container.querySelectorAll(
				'[role="status"][aria-atomic="true"], [role="alert"][aria-atomic="true"]'
			);
			for (const region of regions) {
				if (region.classList.contains('comments-count-announcer')) continue;
				const text = (region.textContent ?? '').trim();
				if (text && log[log.length - 1] !== text) log.push(text);
			}
		};
		new MutationObserver(read).observe(container, {
			subtree: true,
			childList: true,
			characterData: true
		});
	});
}

function announcements(page: Page): Promise<string[]> {
	return page.evaluate(
		() => (window as unknown as { __announcements?: string[] }).__announcements ?? []
	);
}

/**
 * The impl's own announcer: the single `[role="status"][aria-atomic="true"]`
 * inside the container that is not the comments-count announcer. Both halves of
 * that filter are load-bearing — `aria-atomic` excludes the editor skeleton,
 * which is also a `role="status"` region and is present in the pre-hydration
 * DOM, and the `:not()` excludes the controls bar's own announcer.
 *
 * An ASSERTIVE announcement swaps this node for a `[role="alert"]` one —
 * LiveRegion renders one branch or the other, never both — so this locator is
 * scoped to the polite messages every test below produces.
 */
function liveRegion(page: Page) {
	return page
		.getByTestId('review-editor')
		.locator('[role="status"][aria-atomic="true"]:not(.comments-count-announcer)');
}

/** Open the comments sidebar through its toggle. */
async function openSidebar(page: Page): Promise<void> {
	await page.getByRole('button', { name: /Open comments sidebar/ }).click();
	await expect(page.locator(`#${EDITOR_ID}-sidebar`)).toBeVisible();
}

/**
 * Open the thread popover the keyboard-reachable way — through the sidebar
 * list — and wait for its focus trap to finish taking focus.
 *
 * That last wait is load-bearing for every caller. The popover renders before
 * it is positioned, and the trap only activates once `data-position-ready`
 * flips; its initial focus then lands on a microtask. Anything that touches
 * focus before that would be silently undone a tick later.
 */
async function openThreadPopover(page: Page): Promise<void> {
	await openSidebar(page);
	// Located by class rather than by role+name on purpose: the thread item's
	// accessible name is its quote and preview concatenated ("Release Plan
	// SENTINEL comment body"), which is content, not a label.
	await page.locator('button.thread-item').click();
	await expect(page.locator('.thread-popover')).toBeVisible();
	await expect
		.poll(() => activeDescriptor(page))
		.toMatchObject({ label: 'Delete thread', inPopover: true });
}

test.describe('review-ssr-and-a11y: what the server sends', () => {
	test('the server renders the whole shell and none of the editor', async ({ request }) => {
		// Read the raw bytes rather than a rendered page: this is the only way to
		// see the markup a client gets BEFORE any client module has run, which is
		// what a crawler, a no-JS reader, and the first paint all see.
		const response = await request.get(ROUTE);
		expect(response.ok()).toBe(true);
		const html = await response.text();

		// The container, its state attributes, and the tabpanel for the active
		// view are all server-rendered.
		expect(html).toContain('data-testid="review-editor"');
		expect(html).toContain('data-mode="edit"');
		expect(html).toContain('data-view="editor"');
		expect(html).toContain(`id="${EDITOR_ID}-controls"`);
		expect(html).toContain(`id="${EDITOR_ID}-editor-panel"`);
		expect(html).toContain(`id="${EDITOR_ID}-export"`);

		// …but the editor itself is not. MarkdownEditor's ProseMirror host sits
		// behind an `{#if browser}` guard; the server emits a skeleton in its
		// place. Matched on the class attribute specifically so an unrelated
		// asset name containing the word could not satisfy it.
		expect(html).not.toMatch(/class="[^"]*\bProseMirror\b/);
		expect(html).toContain('class="editor-skeleton');
		expect(html).toContain('aria-label="Loading editor"');

		// `data-ready` is the mount gate and is rendered as `undefined` — i.e.
		// omitted entirely — until the inner editor reports itself ready.
		expect(html).not.toContain('data-ready');

		// Neither the comment sidebar nor a thread popover is ever server
		// rendered: both are behind `{#if}` blocks whose state starts closed.
		expect(html).not.toContain('comment-sidebar');
		expect(html).not.toContain('thread-popover');
	});

	test('the view tablist ships keyboard-unreachable', async ({ request }) => {
		// Every tab is `tabindex="-1"` in the server markup. SegmentedControl
		// registers its Segments through a client-only attachment, so before
		// hydration no segment has been elected to hold the roving tab stop and
		// the whole tablist is skipped by Tab. Not a bug so much as the honest
		// consequence of a JS-driven roving-tabindex implementation — but it does
		// mean the control bar is inert for keyboard users until hydration lands.
		const html = await (await request.get(ROUTE)).text();
		const tabs = html.match(/<[a-z]+[^>]*\brole="tab"[^>]*>/g) ?? [];
		expect(tabs).toHaveLength(3);
		for (const tab of tabs) {
			expect(tab).toContain('tabindex="-1"');
		}
	});

	test('all five hidden form inputs are fully populated server-side', async ({ request }) => {
		// The counterpart to everything above: the *form* participation story is
		// complete without JavaScript. A plain POST from the server-rendered page
		// carries the whole review — baseline, current text, comments, diff, and
		// summary — even though no editor ever mounted.
		const html = await (await request.get(ROUTE)).text();
		for (const field of ['original', 'current', 'comments', 'diff', 'summary']) {
			expect(html).toContain(`name="review-${field}"`);
		}
		// The comment body reaches the server-rendered form, HTML-escaped, in the
		// comments payload — proof these are populated rather than empty
		// placeholders waiting on hydration.
		expect(html).toContain(SENTINEL);
	});
});

test.describe('review-ssr-and-a11y: with JavaScript disabled', () => {
	test('the document text and every review thread are absent from the visible DOM', async ({
		browser
	}) => {
		const context = await browser.newContext({ javaScriptEnabled: false });
		const page = await context.newPage();
		// `gotoHydrated` cannot be used here: the hydration beacon it waits for is
		// set by client JS that will never run.
		await page.goto(ROUTE);

		await expect(page.locator('.ProseMirror')).toHaveCount(0);
		await expect(page.locator('aside.comment-sidebar')).toHaveCount(0);
		await expect(page.getByRole('tab')).toHaveCount(3);

		// The whole review is in the DOM as form data and NONE of it as text: a
		// no-JS reader sees a loading placeholder where the document should be.
		const visibleText = await page.locator('body').innerText();
		expect(visibleText).not.toContain(SENTINEL);
		expect(visibleText).not.toContain('Finalize the component API');

		const hiddenInputs = page.locator('[data-testid="review-editor"] input[type="hidden"]');
		await expect(hiddenInputs).toHaveCount(5);
		await expect(page.locator('input[type="hidden"][name="review-comments"]')).toHaveAttribute(
			'value',
			new RegExp(SENTINEL)
		);

		await context.close();
	});

	test('the loading placeholder is screen-reader-only, permanently', async ({ browser }) => {
		// HISTORY. This used to be a pinned bug. EditorSkeleton labelled its
		// `role="status"` region with `<span class="sr-only">Loading editor...</span>`,
		// and a bare `.sr-only` is defined NOWHERE in reach: Cinder's base
		// stylesheet ships `.cinder-sr-only`, and EditorSkeleton's own scoped
		// styles declared no `.sr-only` rule either. A class no stylesheet defines
		// hides nothing, so the span laid out in normal flow as a full-width line
		// of visible body copy — for every user during load, and PERMANENTLY for a
		// no-JS reader, since the skeleton is what SSR emits and nothing ever
		// replaces it. The old test pinned that by asserting `position: static`
		// and a box bigger than 1px.
		//
		// The skeleton now uses `cinder-sr-only`, the same utility
		// `review-editor/live-region.svelte` already used (see the live-region
		// tests below) — so the surface no longer has any instance of this defect.
		// Upstream carries its own unit guard for it in
		// `@lostgradient/editor` → `markdown-editor/editor-skeleton.sr-only.test.ts`,
		// which checks the class is one some stylesheet actually declares rather
		// than that it is spelled a particular way.
		//
		// Asserted here as GEOMETRY, not as a class name, for two reasons. It is
		// what a user actually experiences, and it survives a refactor of how the
		// hiding is implemented (a `clip-path` recipe, a `<VisuallyHidden>`
		// wrapper) while still failing loudly on a regression to a class that
		// resolves to nothing — that one reverts to `position: static` and a
		// full-width box.
		const context = await browser.newContext({ javaScriptEnabled: false });
		const page = await context.newPage();
		await page.goto(ROUTE);

		const loadingLine = page.locator('[role="status"][aria-label="Loading editor"] span');
		await expect(loadingLine).toHaveText('Loading editor...');

		const geometry = await loadingLine.evaluate((element) => {
			const styles = getComputedStyle(element);
			const rect = element.getBoundingClientRect();
			return {
				position: styles.position,
				overflow: styles.overflow,
				display: styles.display,
				visibility: styles.visibility,
				ariaHidden: element.getAttribute('aria-hidden'),
				width: rect.width,
				height: rect.height
			};
		});
		// Visually hidden: lifted out of flow and clipped to a 1x1 box, so it
		// occupies no line of its own and shoves nothing down the page.
		expect(geometry.position).toBe('absolute');
		expect(geometry.overflow).toBe('hidden');
		expect(Math.round(geometry.width)).toBe(1);
		expect(Math.round(geometry.height)).toBe(1);
		// …but still ANNOUNCED. The half of the contract a naive "hide it" fix
		// breaks: `display: none`, `visibility: hidden`, or `aria-hidden` would all
		// satisfy the geometry above and take the only loading signal a no-JS
		// reader gets away from assistive tech entirely.
		expect(geometry.display).not.toBe('none');
		expect(geometry.visibility).toBe('visible');
		expect(geometry.ariaHidden).toBeNull();

		// The two hidden regions in this document now agree. ReviewEditor's own
		// announcer was the reference implementation the skeleton was measured
		// against while the bug stood; asserting they match keeps that comparison
		// meaningful rather than deleting it along with the pin.
		const announcer = await liveRegion(page).evaluate((element) => {
			const rect = element.getBoundingClientRect();
			return {
				position: getComputedStyle(element).position,
				width: Math.round(rect.width),
				height: Math.round(rect.height)
			};
		});
		expect(announcer).toEqual({
			position: geometry.position,
			width: Math.round(geometry.width),
			height: Math.round(geometry.height)
		});

		await context.close();
	});
});

test.describe('review-ssr-and-a11y: what hydration adds', () => {
	test('every derived id exists once the editor mounts', async ({ page }) => {
		await ready(page);

		// The component derives its whole id namespace from the single `id` prop.
		// Pinning the shape is what lets every other assertion on this page (and
		// in the neighbouring review routes) address parts of the component by id
		// instead of by DOM position.
		await expect(page.locator(`#${EDITOR_ID}-controls`)).toBeVisible();
		await expect(page.locator(`#${EDITOR_ID}-editor-panel`)).toHaveAttribute('role', 'tabpanel');
		await expect(page.locator(`#${EDITOR_ID}-editor-panel`)).toHaveAttribute(
			'aria-label',
			'Editor view'
		);
		await expect(page.locator(`#${EDITOR_ID}-export`)).toBeAttached();

		// The bare id is the ProseMirror HOST — a non-editable wrapper that takes
		// focus itself — and the editable surface is its child.
		const host = page.locator(`#${EDITOR_ID}`);
		await expect(host).toHaveAttribute('role', 'application');
		await expect(host).toHaveAttribute('aria-label', 'Markdown editor');
		await expect(host).toHaveAttribute('tabindex', '0');

		const surface = page.locator(`#${EDITOR_ID} .ProseMirror`);
		await expect(surface).toHaveAttribute('role', 'textbox');
		await expect(surface).toHaveAttribute('contenteditable', 'true');
		await expect(surface).toHaveAttribute('aria-label', 'Markdown editor');
	});

	test('the roving tab stop appears at hydration and follows selection', async ({ page }) => {
		await ready(page);

		// Server-side all three tabs were `tabindex="-1"`. After hydration exactly
		// one is `0`, and it is the selected one.
		const tabs = page.getByRole('tab');
		await expect(tabs).toHaveCount(3);
		await expect(page.getByRole('tab', { selected: true })).toHaveAttribute('tabindex', '0');
		await expect(page.locator('[role="tab"][tabindex="0"]')).toHaveCount(1);

		await page.getByRole('tab', { name: 'Diff' }).click();
		await expect(page.getByRole('tab', { name: 'Diff' })).toHaveAttribute('aria-selected', 'true');
		await expect(page.getByRole('tab', { name: 'Diff' })).toHaveAttribute('tabindex', '0');
		await expect(page.getByRole('tab', { name: 'Editor' })).toHaveAttribute('tabindex', '-1');
		await expect(page.locator('[role="tab"][tabindex="0"]')).toHaveCount(1);
	});

	test('the editor view renders ONE control row with the formatting controls inside it', async ({
		page
	}) => {
		await ready(page);

		// The editor view used to stack MarkdownEditor's formatting toolbar as a
		// second full-height bar under the review controls. The formatting group
		// now lives INSIDE the unified bar. Asserted structurally (containment and
		// row count) rather than by pixel height, so it survives spacing changes.
		await expect(page.locator('.review-editor-controls')).toHaveCount(1);
		await expect(page.locator('.editor-toolbar-wrapper')).toHaveCount(0);

		const bar = page.locator(`#${EDITOR_ID}-controls`);
		// The bar is `role="group"`, not `role="toolbar"`: it contains a
		// `tablist` and, in the editor view, the editor's own `toolbar`, and
		// neither is a valid child of `toolbar`. Pinned by attribute so a
		// regression to the nested-toolbar shape says so directly.
		await expect(bar).toHaveAttribute('role', 'group');
		await expect(bar).toHaveAttribute('aria-label', 'Review editor controls');

		// The nested formatting toolbar is a DESCENDANT of the unified bar, not a
		// sibling row below it, and points `aria-controls` at the editor it drives.
		const formatting = page.locator(`#${EDITOR_ID}-toolbar`);
		await expect(bar.locator('.controls-formatting')).toHaveCount(1);
		await expect(bar.locator(`#${EDITOR_ID}-toolbar`)).toHaveCount(1);
		await expect(formatting).toHaveAttribute('role', 'toolbar');
		await expect(formatting).toHaveAttribute('aria-label', 'Formatting toolbar');
		await expect(formatting).toHaveAttribute('aria-controls', EDITOR_ID);
	});

	test('data-ready correctly reflects unmount, not just first paint', async ({ page }) => {
		await ready(page);

		// Switching away from the editor view DESTROYS the MarkdownEditor: the
		// view panel is an `{#if}` chain, so the ProseMirror host is gone.
		await page.getByRole('tab', { name: 'Diff' }).click();
		await expect(page.locator(`#${EDITOR_ID}`)).toHaveCount(0);
		await expect(page.locator('.ProseMirror')).toHaveCount(0);

		// FIXED, cinder#1301: `data-ready` used to be derived from a latch
		// (`editorViewReady`) that was set once and never cleared, so it kept
		// claiming "true" while nothing was mounted. It is now derived from an
		// `$effect` that watches `editorRef` itself — Svelte's own `bind:this`
		// contract unbinds that reference back to `undefined` on teardown — so
		// the attribute correctly goes ABSENT (not `"false"`; the component
		// renders `undefined` for "not ready") the moment the inner editor
		// unmounts, covering the view-switch teardown path and, by construction,
		// any other reason the inner editor goes away.
		await expect(page.getByTestId('review-editor')).not.toHaveAttribute('data-ready');

		// …and it correctly reports "ready" again once the remount actually
		// completes, rather than just staying silent forever. This is the other
		// half of "reflects", not just "resets": a reader waiting on this
		// attribute across a view round trip sees false, then true again, in
		// step with a real editor existing or not.
		await page.getByRole('tab', { name: 'Editor' }).click();
		await expect(page.locator('.ProseMirror')).toBeVisible();
		await expect(page.getByTestId('review-editor')).toHaveAttribute('data-ready', 'true');
	});
});

test.describe('review-ssr-and-a11y: live regions', () => {
	test('one editor ships exactly three aria-live regions, and only two carry a role', async ({
		page
	}) => {
		await ready(page);

		// Scoped to the container, which also excludes SvelteKit's own
		// `#svelte-announcer` without having to name it.
		const container = page.getByTestId('review-editor');
		await expect(container.locator('[aria-live]')).toHaveCount(3);

		const regions = await container.locator('[aria-live]').evaluateAll((elements) =>
			elements.map((element) => ({
				role: element.getAttribute('role'),
				live: element.getAttribute('aria-live'),
				className: element.className,
				parent: element.parentElement?.className ?? ''
			}))
		);

		// 1. LiveRegion — the impl's announcer, a direct child of the container.
		expect(regions[0]).toMatchObject({ role: 'status', live: 'polite' });
		expect(regions[0]?.className).toContain('cinder-sr-only');

		// 2. ExportActions' copy announcer. It is the odd one out: `aria-live`
		//    with NO `role`. That still works (aria-live alone establishes a live
		//    region) but it means a `[role="status"]` sweep — the natural way to
		//    enumerate announcers — silently misses it.
		expect(regions[1]).toMatchObject({ role: null, live: 'polite' });
		expect(regions[1]?.parent).toContain('export-actions');

		// 3. The controls bar's comment-count announcer, deliberately empty on
		//    first paint: its effect seeds a baseline on the first run and only
		//    speaks on subsequent CHANGES, so mounting does not announce "1
		//    comment" at every reader.
		expect(regions[2]).toMatchObject({ role: 'status', live: 'polite' });
		expect(regions[2]?.className).toContain('comments-count-announcer');
		await expect(container.locator('.comments-count-announcer')).toHaveText('');
	});

	test('the announcer is genuinely screen-reader-only', async ({ page }) => {
		await ready(page);

		// This announcer used to be classed with a bare `sr-only` that resolved to
		// nothing, so every announcement printed itself into the page and shoved
		// the layout down for a second. It now uses Cinder's real utility. Pinned
		// as geometry rather than as a class name so a future rename that breaks
		// the hiding is caught rather than renamed past.
		const geometry = await liveRegion(page).evaluate((element) => {
			const rect = element.getBoundingClientRect();
			return {
				position: getComputedStyle(element).position,
				overflow: getComputedStyle(element).overflow,
				width: rect.width,
				height: rect.height
			};
		});
		expect(geometry.position).toBe('absolute');
		expect(geometry.overflow).toBe('hidden');
		expect(Math.round(geometry.width)).toBe(1);
		expect(Math.round(geometry.height)).toBe(1);
	});

	test('every view switch is announced, and the announcement self-clears', async ({ page }) => {
		await ready(page);
		await recordAnnouncements(page);

		await page.getByRole('tab', { name: 'Diff' }).click();
		await expect.poll(() => announcements(page)).toContain('Switched to diff view');

		// LiveRegion wipes its message ~1s after setting it, so a reader that
		// arrives late is not read a stale state. This is why the tests above
		// record announcements through a MutationObserver instead of polling the
		// region's text: the text is gone by the time a naive poll could see it.
		await expect(liveRegion(page)).toHaveText('', { timeout: 5000 });

		await page.getByRole('tab', { name: 'Summary' }).click();
		await expect.poll(() => announcements(page)).toContain('Switched to summary view');

		await page.getByRole('tab', { name: 'Editor' }).click();
		await expect.poll(() => announcements(page)).toContain('Switched to editor view');
	});

	test('reverting all changes is announced', async ({ page }) => {
		await ready(page);
		await recordAnnouncements(page);

		// "Revert all changes" only renders in the diff view, and only while the
		// document actually differs from its baseline — which is why the fixture
		// seeds a `value` that differs from `original`.
		await page.getByRole('tab', { name: 'Diff' }).click();
		const revert = page.getByRole('button', { name: 'Revert all changes' });
		await expect(revert).toBeVisible();
		await revert.click();

		await expect.poll(() => announcements(page)).toContain('All changes reverted');

		// The control removes itself once there is nothing left to revert — the
		// visible confirmation that `value` was reset to `original`.
		await expect(revert).toHaveCount(0);
	});

	test('adding a document comment and clearing all comments are both announced', async ({
		page
	}) => {
		await ready(page);
		await openSidebar(page);
		await recordAnnouncements(page);

		await page.getByRole('button', { name: 'Add document comment' }).click();
		const composer = page.locator(`#${EDITOR_ID}-sidebar-document-composer`);
		await composer.fill('A document-level note');
		await page
			.locator('.document-comment-composer')
			.getByRole('button', { name: 'Comment', exact: true })
			.click();
		await expect.poll(() => announcements(page)).toContain('Document comment added');
		// The props are notification-only: the component announces and emits, and
		// the host page owns the actual mutation. The event log is the evidence.
		await expect(page.getByTestId('event-log')).toContainText('threadcreate:steve');

		// Clearing goes through a confirmation banner inside the sidebar rather
		// than a `window.confirm`, so it is drivable without a dialog handler.
		await page.getByRole('button', { name: 'Comment actions' }).click();
		await page.getByRole('menuitem', { name: 'Clear all comments' }).click();
		await expect(page.getByRole('alertdialog')).toContainText('Delete all 1 comment threads?');
		await page.getByRole('button', { name: 'Delete All' }).click();

		await expect.poll(() => announcements(page)).toContain('All comments cleared');
		await expect(page.getByTestId('event-log')).toContainText('threaddelete:thread-a11y-title');
	});
});

test.describe('review-ssr-and-a11y: keyboard reachability', () => {
	test('the Tab order through the composed surface is short and predictable', async ({
		page,
		browserName
	}) => {
		test.skip(
			browserName === 'webkit',
			"WebKit's macOS port leaves <button> and <a> out of the sequential focus order unless " +
				'Full Keyboard Access is on, and adds <body> as a stop under Option+Tab — so the ORDER ' +
				'this test names cannot exist there. Measured component-free on a static page: see ' +
				'`../keyboard`. Sibling tests that assert only WHERE one Tab lands are not skipped; ' +
				'they translate the keystroke instead, because that keeps the assertion intact.'
		);

		await ready(page);

		// The walk starts from a button OUTSIDE the component so the first Tab is
		// unambiguously the component's first stop.
		await page.getByTestId('tab-order-start').focus();

		// 1. The selected view tab — the tablist's single roving stop.
		await tabTo(page, { role: 'tab', text: 'Editor' });
		// 2. The formatting toolbar's single roving stop. Undo and Redo come
		//    first in the DOM but are disabled on a fresh document, and Cinder's
		//    Toolbar primitive skips disabled items when electing the stop, so the
		//    block-type dropdown inherits it.
		await tabTo(page, { tag: 'BUTTON', label: 'Block type: Paragraph', inControls: true });
		// 3-4. The trailing actions.
		await tabTo(page, { tag: 'BUTTON', label: 'Open comments sidebar (1 comment)' });
		await tabTo(page, { tag: 'BUTTON', label: 'Copy to clipboard' });
		// 5. The ProseMirror HOST — a `role="application"` div that is itself a
		//    tab stop…
		await tabTo(page, { id: EDITOR_ID, role: 'application', label: 'Markdown editor' });
		// 6. …and then the editable surface inside it. Two stops for one editor:
		//    the wrapper's `tabindex="0"` buys nothing a keyboard user can use,
		//    since the very next Tab lands on the contenteditable that does the
		//    work.
		await tabTo(page, { role: 'textbox', label: 'Markdown editor' });
	});

	test('the control bar is a role="group" of four tab stops, and the editor is two', async ({
		page
	}) => {
		await ready(page);

		// HISTORY. This used to be pinned as a bug titled "claims role='toolbar'
		// but exposes four tab stops". The complaint was sound while it held: a
		// `role="toolbar"` promises ONE tab stop with arrow-key navigation inside
		// it, this bar was a plain container that happened to carry the role, and
		// it owned both a `tablist` and a nested `toolbar` — neither a valid child
		// of `toolbar`.
		//
		// Since `@lostgradient/editor@0.8.1` the bar is `role="group"`, and both
		// halves of the complaint dissolve with it: a group makes no tab-stop
		// promise at all, so four stops inside it is correct ARIA, and a group is a
		// perfectly valid owner of a tablist and a toolbar. The pin outlived the
		// fix because it only ever COUNTED stops — a regression back to
		// `role="toolbar"` would not have changed the count, so the pin would have
		// passed while re-asserting the bug in its own title.
		//
		// Rewritten as the structural invariant the counting was always circling:
		// the container's role and the number of stops it owns are the same claim,
		// so they are asserted together. The role check is what makes a revert to
		// `toolbar` fail HERE, at the walk that would otherwise excuse it. (The
		// same role is pinned by attribute in "the editor view renders ONE control
		// row" above; that one guards the bar's composition, this one guards what
		// the role implies for the keyboard.)
		const bar = page.locator(`#${EDITOR_ID}-controls`);
		await expect(bar).toHaveAttribute('role', 'group');
		// The one real toolbar in the composition is the nested formatting group,
		// and it behaves like one: a single roving stop, which is why four stops
		// and not seven come out of a bar holding this many buttons.
		await expect(page.locator(`#${EDITOR_ID}-toolbar`)).toHaveAttribute('role', 'toolbar');
	});

	test('…and that group is four tab stops, with two more in the editor', async ({
		page,
		browserName
	}) => {
		// SPLIT from the role assertions above, deliberately, rather than skipping
		// them together in WebKit. The roles are engine-independent and they are the
		// half that catches a revert to `role="toolbar"` — the very regression the
		// original pin was too weak to see. Losing that in an engine to protect the
		// count would repeat the mistake this test was rewritten to fix.
		test.skip(
			browserName === 'webkit',
			"WebKit's macOS port leaves <button> out of the sequential focus order unless Full " +
				'Keyboard Access is on, so a six-press walk cannot collect these stops there. ' +
				'Measured component-free on a static page: see `../keyboard`. The role assertions ' +
				'this test was split from still run in WebKit.'
		);

		await ready(page);
		await page.getByTestId('tab-order-start').focus();

		const stops: ActiveDescriptor[] = [];
		let current = await activeDescriptor(page);
		for (let step = 0; step < 6; step += 1) {
			current = await tabAndSettle(page, current);
			stops.push(current);
		}

		// Four stops in the bar — the tablist's roving stop, the formatting
		// toolbar's roving stop, and the two trailing action buttons — then two in
		// the editor region, for the ProseMirror host and the surface inside it.
		expect(stops.filter((stop) => stop.inControls)).toHaveLength(4);
		expect(stops.filter((stop) => stop.inEditorMain)).toHaveLength(2);
	});

	test('Escape then Tab escapes a list without editing it, and Mod-]/Mod-[ indent and outdent directly', async ({
		page,
		browserName
	}) => {
		await ready(page);

		/**
		 * Walk to the editable surface (the webkit-aware helper above) and poll
		 * until the caret is genuinely sitting in the checklist's LAST bullet —
		 * where Tab tabs in by default in this fixture. Re-used below because the
		 * first assertion in this test walks focus back out of the component.
		 */
		async function settleOnLastBullet(): Promise<void> {
			await page.getByTestId('tab-order-start').focus();
			await tabToEditableSurface(page, browserName);
			await expect
				.poll(() => caretBlock(page))
				.toMatchObject({
					tag: 'P',
					text: expect.stringContaining('Document review export behavior')
				});
		}

		// The debounced markdown export — component-level `debounceMs: 300`,
		// stacked on `@milkdown/plugin-listener`'s own ~200ms internal debounce
		// (see `markdown-editor.svelte`'s own comment on this exact stacking) —
		// means a read straight after a keypress can pass by racing ahead of a
		// real, slightly-delayed mutation rather than by there being none. Every
		// "did this edit the document" check below is an auto-retrying
		// `toHaveAttribute`/`.not.toHaveAttribute()` match, which polls out that
		// window on its own rather than needing a fixed wait in front of it.

		await settleOnLastBullet();
		const markdownBefore = await currentMarkdown(page).getAttribute('value');
		expect(markdownBefore).not.toBeNull();

		// FIXED, cinder#1302 — this was a WCAG 2.1.2 keyboard trap. Bare
		// Tab/Shift-Tab are STILL bound to sink/lift-list-item at this position
		// by design (commonmark's own list keymap; that binding is not itself
		// the bug) — what was missing was an escape route. Pressing Escape now
		// arms a one-shot latch (`keymap-plugin.ts`'s `createTabEscapeLatch`)
		// that the very next Tab consumes instead of sinking, provided nothing
		// else changed the document or selection in between. This is the
		// keyboard route the toolbar's own shortcut list documents ('Move focus
		// out of the editor (then Tab)': Esc), and it is reachable at all only
		// because the fix stripped Tab/Shift-Tab from the commonmark list keymap
		// and the GFM table keymap — both bound the identical trap and both used
		// to run AHEAD of this latch in Milkdown's keymap chain, so the
		// Escape-armed release could never be reached before.
		await page.keyboard.press('Escape');
		await page.keyboard.press('Tab');
		// No waitForTimeout: toHaveAttribute is an auto-retrying matcher, so
		// polling it toward markdownBefore's captured value already waits out
		// the debounce chain (see the comment above) while proving the SAME
		// thing a fixed-then-check pair would, on a concrete condition instead
		// of a guessed duration -- matching the fix already applied to the two
		// Mod-]/Mod-[ checks below.
		await expect(currentMarkdown(page)).toHaveAttribute('value', markdownBefore!);
		// The exact element differs by engine (a trailing button in Chromium and
		// Firefox; WebKit's native Tab can't reach that button at all — see
		// `../keyboard`'s own doc comment — so it lands on `<body>` instead) but
		// "no longer anywhere inside the editor" is true everywhere.
		await expect.poll(() => activeDescriptor(page)).toMatchObject({ inEditorMain: false });

		// Mod-]/Mod-[ are the shortcut this fix freed up (from the commonmark
		// list keymap, which used to bind them to Tab/Shift-Tab too) to
		// indent/outdent directly — no Escape ceremony, and useable from
		// anywhere in the list, not just the position Tab happens to hand you.
		// "Mod" is platform-, not engine-, dependent — the same mac detection
		// the package's own `getShortcutDisplay` uses (`keymap-plugin.ts`).
		const isMac = await page.evaluate(() => /Mac|iPod|iPhone|iPad/.test(navigator.platform));
		await settleOnLastBullet();
		// No waitForTimeout before either check below: toHaveAttribute/
		// .not.toHaveAttribute() are auto-retrying matchers, so they already
		// poll out the debounce window themselves -- a fixed wait in front of
		// one would be pure padding, proving nothing a poll doesn't already
		// give for free.
		await page.keyboard.press(isMac ? 'Meta+]' : 'Control+]');
		await expect(currentMarkdown(page)).toHaveAttribute(
			'value',
			/\n {2}[*-] Document review export behavior/
		);

		await page.keyboard.press(isMac ? 'Meta+[' : 'Control+[');
		await expect(currentMarkdown(page)).not.toHaveAttribute(
			'value',
			/\n {2}[*-] Document review export behavior/
		);
	});

	test('only the active tab carries aria-controls, and it follows the selection', async ({
		page
	}) => {
		await ready(page);

		// FIXED. Each Segment used to be given the id of the panel it controls
		// unconditionally, but only the ACTIVE view's panel is ever rendered (the
		// view area is an `{#if}` chain, not three panels with two hidden) — so
		// two of the three tabs always referenced an element that was not in the
		// document. The fix sets `aria-controls` on the ACTIVE tab only; an
		// inactive tab now carries no `aria-controls` attribute at all, rather
		// than a dangling reference to a nonexistent id.
		const resolution = () =>
			page.evaluate(() =>
				[...document.querySelectorAll('[role="tab"]')].map((tab) => ({
					selected: tab.getAttribute('aria-selected'),
					controls: tab.getAttribute('aria-controls'),
					resolves: !!document.getElementById(tab.getAttribute('aria-controls') ?? '')
				}))
			);
		expect(await resolution()).toEqual([
			{ selected: 'true', controls: `${EDITOR_ID}-editor-panel`, resolves: true },
			{ selected: 'false', controls: null, resolves: false },
			{ selected: 'false', controls: null, resolves: false }
		]);

		// …and it MOVES with the selection rather than being a static snapshot of
		// the initial view: switching tabs hands `aria-controls` to whichever
		// panel is now actually rendered, and takes it away from the one that was
		// active a moment ago.
		await page.getByRole('tab', { name: 'Diff' }).click();
		await expect.poll(resolution).toEqual([
			{ selected: 'false', controls: null, resolves: false },
			{ selected: 'true', controls: `${EDITOR_ID}-diff-panel`, resolves: true },
			{ selected: 'false', controls: null, resolves: false }
		]);

		await page.getByRole('tab', { name: 'Summary' }).click();
		await expect.poll(resolution).toEqual([
			{ selected: 'false', controls: null, resolves: false },
			{ selected: 'false', controls: null, resolves: false },
			{ selected: 'true', controls: `${EDITOR_ID}-summary-panel`, resolves: true }
		]);
	});

	test("the comments toggle's aria-controls resolves when open and dangles when closed", async ({
		page
	}) => {
		await ready(page);
		const toggle = page.getByRole('button', { name: /comments sidebar/ });

		// The controls component is instantiated as `{editorId}-controls`, so
		// deriving the sidebar id from its own id would produce
		// `a11y-editor-controls-sidebar` — an element that never exists. The
		// sidebar id is now passed in explicitly, and the reference is correct.
		await expect(toggle).toHaveAttribute('aria-controls', `${EDITOR_ID}-sidebar`);
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');
		expect(await page.locator(`#${EDITOR_ID}-controls-sidebar`).count()).toBe(0);

		// While collapsed the target still does not exist — the sidebar is behind
		// an `{#if sidebarOpen}`, so `aria-controls` dangles in the closed state.
		// That is much milder than pointing at a permanently-wrong id (nothing is
		// mislabelled, the relationship is just unavailable until it is true), but
		// it is worth knowing before writing `aria-controls`-based assertions.
		expect(await page.locator(`#${EDITOR_ID}-sidebar`).count()).toBe(0);

		await openSidebar(page);
		await expect(toggle).toHaveAttribute('aria-expanded', 'true');
		const target = page.locator(`#${EDITOR_ID}-sidebar`);
		await expect(target).toHaveJSProperty('tagName', 'ASIDE');
		await expect(target).toHaveAttribute('aria-label', 'Comment threads');
	});

	test('anchored-comment decorations announce themselves and have a keyboard route', async ({
		page
	}) => {
		await ready(page);

		const anchor = page.locator('span.comment-anchor');
		await expect(anchor).toHaveCount(1);
		await expect(anchor).toHaveText('Release Plan');

		// FIXED, cinder#1304. The decoration used to be built with exactly two
		// attributes — `class` and `data-thread-id`, both invisible to assistive
		// tech. It now also carries `role="mark"` and `aria-description`, the
		// same job a native `<mark>` would do, without a `<mark>` element
		// ProseMirror does not render here.
		const attributes = await anchor.evaluate((element) =>
			[...element.attributes].map((attribute) => attribute.name).sort()
		);
		expect(attributes).toEqual(['aria-description', 'class', 'data-thread-id', 'role']);
		await expect(anchor).toHaveAttribute('role', 'mark');
		await expect(anchor).toHaveAttribute('aria-description', 'Commented text');

		// `role="mark"` deliberately carries no tab stop — an inline decoration
		// inside a contenteditable fighting ProseMirror's own selection handling
		// was rejected upstream as fragile — so the fix's keyboard route is a
		// container-level chord instead: Ctrl+Alt+ArrowDown/Up
		// (Cmd+Option+ArrowDown/Up on macOS, since Control+Option is VoiceOver's
		// own modifier prefix there) moves the caret to the next/previous anchor
		// in document order and opens its thread, the same as clicking the
		// decoration does. Exercised as a real keypress, not just an attribute
		// check: click inside the prose (never on the anchor itself, so the
		// popover below is provably the CHORD's doing) and fire the chord.
		await page.locator('.ProseMirror').getByText('The first release includes').click();
		const isMac = await page.evaluate(() => /Mac|iPod|iPhone|iPad/.test(navigator.platform));
		await page.keyboard.press(isMac ? 'Meta+Alt+ArrowDown' : 'Control+Alt+ArrowDown');

		await expect(page.locator('.thread-popover')).toBeVisible();
		await expect
			.poll(() => activeDescriptor(page))
			.toMatchObject({ tag: 'BUTTON', label: 'Delete thread', inPopover: true });
		expect(await page.evaluate(() => window.getSelection()?.toString())).toBe('Release Plan');
	});
});

test.describe('review-ssr-and-a11y: the thread popover', () => {
	test('opening traps focus, and Tab cycles the three controls inside it', async ({
		page,
		browserName
	}) => {
		test.skip(
			browserName === 'webkit',
			"WebKit's macOS port omits <button> from sequential focus navigation unless Full " +
				"Keyboard Access is on, so native Tab skips the popover's Close button and the cycle " +
				'this test names cannot be walked there. Measured component-free on a static page: ' +
				'see `../keyboard`. The trap itself is fine in WebKit — the initial focus lands on ' +
				'Delete thread exactly as asserted below, and Option+Tab cycles all three controls ' +
				'in DOM order. What is unavailable is the NATIVE Tab cycle, which is the claim.'
		);

		await ready(page);
		await openThreadPopover(page);

		// Restated rather than left implicit in the helper: the trap taking focus
		// to the popover's FIRST tabbable element — the destructive one — is the
		// behaviour under test here, not just a precondition for the walk below.
		await expect
			.poll(() => activeDescriptor(page))
			.toMatchObject({
				tag: 'BUTTON',
				label: 'Delete thread',
				inPopover: true
			});

		// Three stops, then a wrap. The seeded comment is authored by `maya`
		// rather than by `currentUserId`, so CommentList renders no per-comment
		// Edit/Delete buttons; the composer's submit button is `disabled` while
		// the textarea is empty, which takes it out of the cycle too.
		await tabTo(page, { tag: 'BUTTON', label: 'Close', inPopover: true });
		await tabTo(page, { tag: 'TEXTAREA', id: `${EDITOR_ID}-thread-popover-composer` });
		await tabTo(page, { tag: 'BUTTON', label: 'Delete thread', inPopover: true });

		// …and Shift+Tab reverses it without escaping.
		await page.keyboard.press('Shift+Tab');
		await expect
			.poll(() => activeDescriptor(page))
			.toMatchObject({ tag: 'TEXTAREA', inPopover: true });
	});

	test('the popover is non-modal, and aria-modal no longer claims otherwise', async ({ page }) => {
		await ready(page);
		await openThreadPopover(page);

		const popover = page.locator('.thread-popover');
		await expect(popover).toHaveAttribute('role', 'dialog');

		// FIXED, cinder#1305. `aria-modal="true"` is a promise to assistive tech
		// that everything outside the dialog is unavailable, and nothing backed
		// it: neither the editor region nor the comment sidebar was ever `inert`
		// or `aria-hidden` while the popover was open, and F6 landmark
		// navigation (pinned by 'F6 alternates between the editor and an open
		// popover' below) has always been able to move focus out regardless —
		// deliberately, since this popover is non-modal by design. The fix
		// removes the attribute rather than trying to earn it: it does not make
		// the popover modal, it stops the popover claiming to be.
		await expect(popover).not.toHaveAttribute('aria-modal');

		// Still true, and now consistent with what the popover actually claims:
		// nothing outside it is inert or hidden.
		const outside = await page.evaluate(() => {
			const main = document.querySelector('.review-editor-main');
			const sidebar = document.querySelector('aside.comment-sidebar');
			return {
				mainInert: main?.hasAttribute('inert') ?? null,
				mainHidden: main?.getAttribute('aria-hidden') ?? null,
				sidebarInert: sidebar?.hasAttribute('inert') ?? null,
				sidebarHidden: sidebar?.getAttribute('aria-hidden') ?? null
			};
		});
		expect(outside).toEqual({
			mainInert: false,
			mainHidden: null,
			sidebarInert: false,
			sidebarHidden: null
		});
	});

	test('Escape closes the popover and restores focus to the sidebar item that opened it', async ({
		page
	}) => {
		await ready(page);
		await openSidebar(page);

		// Opened by KEYBOARD rather than through the shared click helper, and that
		// is the whole point of the test rather than a detail. Restoration works by
		// snapshotting `document.activeElement` at activation — so it can only
		// restore to the sidebar item if that item had focus when the popover
		// opened. A click gives it focus in Chromium and Firefox but NOT in WebKit,
		// which does not focus a button on mousedown, so the click path was
		// quietly testing a precondition that only two engines provide.
		//
		// Focusing and pressing Enter is both the engine-independent path and the
		// one a keyboard user actually takes — which is the user this test is about.
		await page.locator('button.thread-item').focus();
		await expect
			.poll(() => activeDescriptor(page))
			.toMatchObject({ tag: 'BUTTON', className: expect.stringContaining('thread-item') });
		await page.keyboard.press('Enter');

		await expect(page.locator('.thread-popover')).toBeVisible();
		await expect.poll(() => activeDescriptor(page)).toMatchObject({ label: 'Delete thread' });

		await page.keyboard.press('Escape');
		await expect(page.locator('.thread-popover')).toHaveCount(0);

		// Back to the item that opened it.
		await expect
			.poll(() => activeDescriptor(page))
			.toMatchObject({ tag: 'BUTTON', className: expect.stringContaining('thread-item') });
	});

	test('replying through the popover announces the new comment', async ({ page }) => {
		await ready(page);
		await openThreadPopover(page);
		await recordAnnouncements(page);

		await page.locator(`#${EDITOR_ID}-thread-popover-composer`).fill('A reply from steve');
		await page
			.locator('.thread-popover')
			.getByRole('button', { name: 'Comment', exact: true })
			.click();

		await expect.poll(() => announcements(page)).toContain('Comment added');
		await expect(page.getByTestId('event-log')).toContainText('commentcreate:thread-a11y-title');
	});
});

test.describe('review-ssr-and-a11y: F6 landmark navigation', () => {
	test('F6 does nothing in the default state', async ({ page }) => {
		await ready(page);

		// A paragraph, not the surface's centre: clicking the anchored-comment
		// decoration would open the thread popover and activate the second region.
		await page
			.locator(`#${EDITOR_ID} .ProseMirror`)
			.getByText('The first release includes')
			.click();
		await expect.poll(() => activeDescriptor(page)).toMatchObject({ role: 'textbox' });

		// The component registers exactly two regions — the editor and the thread
		// popover — and marks the popover inactive unless one is open. With a
		// single active region, "next region" resolves back to the editor and the
		// custom focus handler re-focuses the ProseMirror view: F6 and Shift+F6
		// are both no-ops.
		//
		// The utility's own documentation shows a three-region example including a
		// `sidebar` region, and ReviewEditor never registers one — so the comment
		// sidebar is unreachable by F6 in either state.
		await page.keyboard.press('F6');
		await expect.poll(() => activeDescriptor(page)).toMatchObject({ role: 'textbox' });

		await page.keyboard.press('Shift+F6');
		await expect.poll(() => activeDescriptor(page)).toMatchObject({ role: 'textbox' });
	});

	test('F6 alternates between the editor and an open popover', async ({ page }) => {
		await ready(page);
		// The helper waits for the popover's focus trap to settle. Without that
		// wait, the `.focus()` below would race the trap's deferred initial focus
		// and be quietly undone a microtask later.
		await openThreadPopover(page);

		// Focus is moved back to the editor PROGRAMMATICALLY rather than by
		// clicking: the popover closes on any click outside itself, so a click
		// into the document would destroy the very state under test.
		await page.evaluate((editorId) => {
			const surface = document.querySelector(`#${editorId} .ProseMirror`);
			if (surface instanceof HTMLElement) surface.focus();
		}, EDITOR_ID);
		await expect.poll(() => activeDescriptor(page)).toMatchObject({ role: 'textbox' });

		// Two active regions now, so F6 crosses into the popover's first focusable
		// element and Shift+F6 crosses back. Note the sidebar is skipped in both
		// directions even though it is open and full of controls.
		await page.keyboard.press('F6');
		await expect
			.poll(() => activeDescriptor(page))
			.toMatchObject({ label: 'Delete thread', inPopover: true });

		await page.keyboard.press('Shift+F6');
		await expect.poll(() => activeDescriptor(page)).toMatchObject({ role: 'textbox' });

		await page.keyboard.press('F6');
		await expect
			.poll(() => activeDescriptor(page))
			.toMatchObject({ label: 'Delete thread', inPopover: true });
	});
});

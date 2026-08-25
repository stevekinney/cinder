import { expect, test } from '@playwright/test';
import type { ElementHandle, Locator, Page } from '@playwright/test';
import {
	deleteComment,
	deleteThread,
	updateComment,
	type Thread
} from '@lostgradient/editor/comments';
import { gotoHydrated } from '../hydration';

// Pins the READ and MUTATE halves of ReviewEditor's comment surface: the
// sidebar, the thread popover, and the four notification-only callbacks
// (`oncommentcreate` / `oncommentupdate` / `oncommentdelete` / `onthreaddelete`)
// against the page-owned reducer that actually moves `threads`.
//
// Thread creation lives in `review-comment-creation`, and the anchor-decoration
// story in `review-anchoring`; both need fixtures this route cannot have.
//
// Every test starts from a fresh page: the fixture is mutated by most of these
// flows, and a shared page would make each test depend on the ones before it.

const ROUTE = '/exercises/review-comment-lifecycle';

// Literals, not recomputations. The component's truncation budgets are 60 for
// the sidebar quote, 80 for the sidebar preview, and 30 for the popover title —
// re-deriving them here with a slice would assert the spec against itself
// instead of against the component. Note the two different ellipses: `truncate`
// uses the single character '…', the popover title hand-rolls three dots.
const FULL_QUOTE = 'Reviewers should verify that the export dialog copy matches the product brief';
const SIDEBAR_QUOTE_60 = 'Reviewers should verify that the export dialog copy matches…';
const SIDEBAR_PREVIEW_80 =
	'This paragraph is the sentence legal asked us to re-read line by line before th…';
const POPOVER_TITLE_30 = '"Reviewers should verify that t..."';

const sidebar = (page: Page) => page.locator('#lifecycle-editor-sidebar');
const popover = (page: Page) => page.locator('#lifecycle-editor-thread-popover');
const commentsToggle = (page: Page) => page.getByRole('button', { name: /comments sidebar/ });
const threadRows = (page: Page) => sidebar(page).locator('button.thread-item');
const badge = (page: Page) => page.locator('.comments-toggle-wrapper .cinder-badge');
const announcer = (page: Page) => page.locator('.comments-count-announcer');

// Row lookups go by content, never by index: rows disappear from under you as
// threads turn into ghosts, and the surviving rows shift up.
const rowQuoted = (page: Page, quote: string) =>
	threadRows(page).filter({ has: page.locator('blockquote.thread-quote', { hasText: quote }) });

const docRow = (page: Page) => threadRows(page).filter({ hasText: 'Document comment' });

async function openSidebar(page: Page): Promise<void> {
	await commentsToggle(page).click();
	await expect(sidebar(page)).toBeVisible();
}

/**
 * Select a thread from the sidebar and wait for its popover.
 *
 * Selection opens the popover on a ~350ms timer (POSITION_DELAY_MS) and then
 * floating-ui positions it on a later frame, so the popover exists before it is
 * usable. `data-position-ready` is the settled signal — until it flips, the
 * dialog carries `inert` and swallows every click.
 *
 * A plain default-centre click. This used to be offset to the row's top-left
 * to dodge the `Observed state` section painting over the longest-quote row —
 * a real defect for a mouse user, not just this spec, since it happened in
 * every browser. `+page.svelte`'s editor wrapper now scrolls its own overflow
 * instead of spilling into the next section, so nothing covers this row and a
 * default click exercises the same path a real reviewer's pointer would.
 */
async function selectThread(page: Page, row: Locator): Promise<Locator> {
	await row.click();
	const dialog = popover(page);
	await expect(dialog).toHaveAttribute('data-position-ready', 'true');
	await expect(dialog).toHaveJSProperty('inert', false);
	return dialog;
}

/** Every logged payload for one callback name, parsed. */
async function payloadsFor(page: Page, name: string): Promise<Record<string, unknown>[]> {
	const rows = await page.getByTestId('event-log').locator('li').allTextContents();
	return rows
		.filter((row) => row.startsWith(`${name} `))
		.map((row) => JSON.parse(row.slice(name.length + 1)) as Record<string, unknown>);
}

test.describe('review comment lifecycle: the sidebar', () => {
	test.beforeEach(async ({ page }) => {
		await gotoHydrated(page, ROUTE);
	});

	test('the sidebar has no `open` prop — it exists only once the toolbar toggle is clicked', async ({
		page
	}) => {
		// Not "hidden": absent. There is no way to render the ReviewEditor with
		// its comment sidebar already open, which means `aria-controls` on the
		// toggle points at an element that does not exist yet.
		await expect(sidebar(page)).toHaveCount(0);
		await expect(commentsToggle(page)).toHaveAttribute('aria-expanded', 'false');
		await expect(commentsToggle(page)).toHaveAttribute('aria-controls', 'lifecycle-editor-sidebar');

		await openSidebar(page);

		// `aria-controls` resolving is the fix from cinder PR #1266: the controls
		// bar is instantiated as `{editorId}-controls`, so deriving the sidebar id
		// from its own id used to produce `lifecycle-editor-controls-sidebar`.
		await expect(sidebar(page)).toHaveAttribute('aria-label', 'Comment threads');
		await expect(commentsToggle(page)).toHaveAttribute('aria-expanded', 'true');
		await expect(sidebar(page).locator('.sidebar-header h2.sidebar-title')).toHaveText('Comments');
	});

	test('threads sort document-first, then by anchor.from, and the all-deleted ghost is omitted', async ({
		page
	}) => {
		await openSidebar(page);

		// Four threads are seeded; `t-empty` has no visible comment, so the
		// sidebar drops it entirely. The count badge counts what it renders.
		await expect(page.getByTestId('thread-count')).toHaveText('threads: 4');
		await expect(threadRows(page)).toHaveCount(3);
		await expect(sidebar(page).locator('.thread-count')).toHaveText('3');

		// Document threads come first regardless of position; text threads follow
		// in ascending `anchor.from` order (1, then 91).
		await expect(sidebar(page).locator('button.thread-item[data-document="true"]')).toHaveCount(1);
		await expect(threadRows(page).nth(0)).toHaveAttribute('data-document', 'true');
		await expect(threadRows(page).nth(0).locator('.thread-document-label')).toHaveText(
			'Document comment'
		);
		await expect(threadRows(page).nth(0).locator('blockquote.thread-quote')).toHaveCount(0);
		await expect(threadRows(page).nth(1).locator('blockquote.thread-quote')).toHaveText(
			'Release Plan'
		);
		await expect(threadRows(page).nth(2).locator('blockquote.thread-quote')).toHaveText(
			SIDEBAR_QUOTE_60
		);

		// The ghost's quote is nowhere in the list even though its anchor is still
		// decorating the document.
		await expect(sidebar(page)).not.toContainText('Timeline risk');
	});

	test('the preview is the first VISIBLE comment, truncated at 80', async ({ page }) => {
		await openSidebar(page);

		await expect(threadRows(page).nth(2).locator('p.thread-preview')).toHaveText(
			SIDEBAR_PREVIEW_80
		);

		// `t-text`'s first comment is by `steve`; soft-deleting it promotes the
		// NEXT visible comment into the preview rather than blanking the row.
		const textRow = rowQuoted(page, 'Release Plan');
		await expect(textRow.locator('p.thread-preview')).toHaveText(
			'Should this say "Launch Plan" instead?'
		);
		const dialog = await selectThread(page, textRow);
		await dialog
			.locator('article.comment[data-comment-id="c-text-steve"]')
			.getByRole('button', { name: 'Delete comment' })
			.click();
		await expect(textRow.locator('p.thread-preview')).toHaveText(
			'Marketing signed off on "Release Plan" last week.'
		);
	});
});

test.describe('review comment lifecycle: the thread popover', () => {
	test.beforeEach(async ({ page }) => {
		await gotoHydrated(page, ROUTE);
		await openSidebar(page);
	});

	test('selecting a thread marks exactly one row active and opens a non-modal dialog inside the container', async ({
		page
	}) => {
		const dialog = await selectThread(page, rowQuoted(page, 'Release Plan'));

		await expect(rowQuoted(page, 'Release Plan')).toHaveAttribute('data-active', 'true');
		await expect(rowQuoted(page, 'Release Plan')).toHaveAttribute('aria-current', 'true');
		// Exactly one at a time — selection is not additive.
		await expect(sidebar(page).locator('[data-active]')).toHaveCount(1);
		await expect(sidebar(page).locator('[aria-current="true"]')).toHaveCount(1);

		await expect(dialog).toHaveAttribute('role', 'dialog');
		// cinder#1305 removed `aria-modal` entirely rather than setting it
		// `"false"`: this is a deliberately non-modal, anchored dialog — the same
		// pattern as a comment popover in Google Docs or a GitHub PR review
		// thread — and `aria-modal="true"` was a promise the component never
		// kept. F6 landmark navigation moves focus out to `.review-editor-main`
		// while this popover stays open, and nothing here makes the rest of the
		// editor `inert`, so an unbacked `aria-modal="true"` was actively wrong
		// rather than merely redundant.
		await expect(dialog).not.toHaveAttribute('aria-modal');
		await expect(dialog).toHaveAttribute(
			'aria-labelledby',
			'lifecycle-editor-thread-popover-title'
		);

		// NOT portaled — unlike the selection popover, which cinder does portal to
		// `document.body`. This one is a child of the review-editor container, so
		// it inherits the container's stacking context and CSS scope.
		//
		// That container is NOT `#lifecycle-editor`, which is what this used to
		// assert and what never held: the `id` prop lands on the markdown
		// editor's own content div, buried inside `.review-editor-main >
		// .markdown-editor-layout`, and the container merely hangs the DERIVED
		// ids off it (`-controls`, `-sidebar`, `-thread-popover`) while carrying
		// no id of its own. The popover is a direct child of that unlabelled
		// `.review-editor-container`, a sibling of the subtree holding the
		// editor — so pin it by the element that contains both.
		const container = page
			.locator('div.review-editor-container')
			.filter({ has: page.locator('#lifecycle-editor') });
		await expect(container).toHaveCount(1);
		await expect(page.locator('body > #lifecycle-editor-thread-popover')).toHaveCount(0);
		await expect(container.locator('> #lifecycle-editor-thread-popover')).toHaveCount(1);
	});

	test('Escape closes the popover and clears the active row', async ({ page }) => {
		await selectThread(page, rowQuoted(page, 'Release Plan'));

		// The popover traps focus, so a bare page-level Escape lands inside it.
		await page.keyboard.press('Escape');

		await expect(popover(page)).toHaveCount(0);
		await expect(sidebar(page).locator('[data-active]')).toHaveCount(0);
		await expect(sidebar(page)).toBeVisible();
	});

	test('the title truncates the quote at 30 characters and keeps the full quote in `title`', async ({
		page
	}) => {
		const dialog = await selectThread(page, rowQuoted(page, 'Reviewers should verify'));

		await expect(dialog.locator('.thread-popover-quote')).toHaveText(POPOVER_TITLE_30);
		// The only place the untruncated quote survives in the DOM.
		await expect(dialog.locator('.thread-popover-quote')).toHaveAttribute('title', FULL_QUOTE);
	});

	test('a document thread shows a `Document comment` label instead of a quote', async ({
		page
	}) => {
		const dialog = await selectThread(page, docRow(page));

		await expect(dialog.locator('.thread-popover-document-label')).toHaveText('Document comment');
		await expect(dialog.locator('.thread-popover-quote')).toHaveCount(0);
	});
});

test.describe('review comment lifecycle: replying', () => {
	test.beforeEach(async ({ page }) => {
		await gotoHydrated(page, ROUTE);
		await openSidebar(page);
	});

	test('a reply fires oncommentcreate and changes nothing until the reducer applies it', async ({
		page
	}) => {
		const dialog = await selectThread(page, rowQuoted(page, 'Release Plan'));

		// The reply composer's accessible name is `Comment` (from an sr-only
		// label) while its placeholder is `Reply...` — and the inline submit
		// Button is ALSO named `Comment`. Locate the textarea by id to sidestep
		// the collision entirely. The inline submit is `opacity: 0;
		// pointer-events: none` until `:focus-within`, so Cmd/Ctrl+Enter is the
		// reliable path: `fill` focuses first, then the shortcut submits.
		const composer = dialog.locator('#lifecycle-editor-thread-popover-composer');
		await expect(composer).toHaveAttribute('placeholder', 'Reply...');
		await composer.fill('Renaming it now would break the changelog.');
		await composer.press('ControlOrMeta+Enter');

		await expect(page.getByTestId('event-log').locator('li')).toHaveCount(1);
		const [created] = await payloadsFor(page, 'commentcreate');
		expect(created.threadId).toBe('t-text');
		expect(created.authorId).toBe('steve');
		expect(created.body).toBe('Renaming it now would break the changelog.');
		expect(typeof created.requestId).toBe('string');
		expect(created.requestId).not.toBe('');
		// No `@` in the body, so `extractMentions` found nothing and the field is
		// omitted rather than set to an empty array.
		expect('mentions' in created).toBe(false);

		// The point of the whole route: at the moment the callback fired, the
		// bindable `threads` array was untouched. It moved only because the page's
		// reducer called `addComment` on it.
		await expect(page.getByTestId('counts-at-last-event')).toHaveText(
			'at event time: threads:4 visible:4 stored:6'
		);
		await expect(page.getByTestId('visible-comment-count')).toHaveText('visible comments: 5');
		await expect(page.getByTestId('last-changed')).toHaveText('last reducer changed: true');

		// The composer clears itself on submit and keeps focus.
		await expect(composer).toHaveValue('');
		await expect(composer).toBeFocused();
		await expect(dialog.locator('article.comment')).toHaveCount(3);
	});
});

test.describe('review comment lifecycle: editing', () => {
	test.beforeEach(async ({ page }) => {
		await gotoHydrated(page, ROUTE);
		await openSidebar(page);
	});

	test('editing swaps the body for a prefilled textarea labelled `Edit comment`', async ({
		page
	}) => {
		const dialog = await selectThread(page, docRow(page));
		const comment = dialog.locator('article.comment[data-comment-id="c-doc-1"]');
		await comment.getByRole('button', { name: 'Edit comment' }).click();

		// The textarea's id is derived from the COMMENT id, not the editor id, so
		// it is stable across popovers. Its label is sr-only, which is why
		// `getByLabel('Edit comment')` also matches the pencil button — locate by
		// id when you mean the field.
		const draft = dialog.locator('#c-doc-1-edit');
		await expect(draft).toHaveValue('Overall this reads well. One pass for tone and it ships.');
		await expect(dialog.locator('label[for="c-doc-1-edit"]')).toHaveText('Edit comment');
		await expect(comment.locator('.comment-body')).toHaveCount(0);
		// While a comment is being edited its action row is withdrawn entirely.
		await expect(comment.getByRole('button', { name: 'Edit comment' })).toHaveCount(0);

		// Save refuses a whitespace-only body; Cancel never does.
		await expect(
			comment.locator('.comment-edit-actions').getByRole('button', { name: 'Save' })
		).toBeEnabled();
		await draft.fill('   ');
		await expect(
			comment.locator('.comment-edit-actions').getByRole('button', { name: 'Save' })
		).toBeDisabled();
		await expect(
			comment.locator('.comment-edit-actions').getByRole('button', { name: 'Cancel' })
		).toBeEnabled();
	});

	test('Cmd/Ctrl+Enter saves; oncommentupdate carries no timestamp and the consumer supplies it', async ({
		page
	}) => {
		const dialog = await selectThread(page, docRow(page));
		const comment = dialog.locator('article.comment[data-comment-id="c-doc-1"]');
		await comment.getByRole('button', { name: 'Edit comment' }).click();
		await dialog
			.locator('#c-doc-1-edit')
			.fill('Overall this reads well. Ship it after a tone pass.');
		await dialog.locator('#c-doc-1-edit').press('ControlOrMeta+Enter');

		await expect(page.getByTestId('event-log').locator('li')).toHaveCount(1);
		const [updated] = await payloadsFor(page, 'commentupdate');
		expect(updated).toEqual({
			threadId: 't-doc',
			commentId: 'c-doc-1',
			body: 'Overall this reads well. Ship it after a tone pass.'
		});
		// Explicitly: no `editedAt`. `updateComment` from
		// `@lostgradient/editor/comments` REQUIRES one, so the consumer has to
		// mint it — the component has no opinion about the clock.
		expect('editedAt' in updated).toBe(false);

		await expect(comment.locator('.comment-body')).toHaveText(
			'Overall this reads well. Ship it after a tone pass.'
		);
		// `(edited)` is a consequence of the timestamp the PAGE supplied.
		await expect(comment.locator('.comment-edited')).toHaveText('(edited)');
		const editedTitle = await comment.locator('.comment-edited').getAttribute('title');
		expect(editedTitle).toMatch(/^Edited \d{4}-\d{2}-\d{2}T/);

		// Editing does not consume the actions: the comment stays editable.
		await expect(comment.getByRole('button', { name: 'Edit comment' })).toHaveCount(1);
		await expect(comment.getByRole('button', { name: 'Delete comment' })).toHaveCount(1);
	});

	test('PINNED KNOWN BUG: Escape cancels the edit AND closes the whole thread popover', async ({
		page
	}) => {
		const dialog = await selectThread(page, docRow(page));
		const comment = dialog.locator('article.comment[data-comment-id="c-doc-1"]');
		await comment.getByRole('button', { name: 'Edit comment' }).click();
		await dialog.locator('#c-doc-1-edit').fill('Draft I intend to abandon.');

		await dialog.locator('#c-doc-1-edit').press('Escape');

		// The cancel half is correct: no `oncommentupdate` is emitted, so the draft
		// really was abandoned rather than quietly saved.
		await expect(page.getByTestId('event-log').locator('li')).toHaveCount(0);

		// The wrong half, pinned as-is because it is what the component does
		// today. `comment-list.svelte`'s Escape branch calls `cancelEdit()` and
		// then lets the event bubble — it never calls `preventDefault()` (its
		// Cmd+Enter branch does, which is exactly why SAVING keeps the popover
		// open). `thread-popover.svelte`'s keydown handler guards only on
		// `!event.defaultPrevented`, so the same keystroke closes the dialog. One
		// Escape should back out of the edit; it backs out of the thread.
		await expect(popover(page)).toHaveCount(0);

		// Reopening proves the body really was restored rather than lost with the
		// popover.
		const reopened = await selectThread(page, docRow(page));
		await expect(
			reopened.locator('article.comment[data-comment-id="c-doc-1"] .comment-body')
		).toHaveText('Overall this reads well. One pass for tone and it ships.');
	});
});

test.describe('review comment lifecycle: permissions', () => {
	test.beforeEach(async ({ page }) => {
		await gotoHydrated(page, ROUTE);
		await openSidebar(page);
	});

	test('per-comment actions are author-scoped while `Delete thread` only needs a current user', async ({
		page
	}) => {
		// `t-text` mixes authors: one comment by `steve` (the current user) and
		// one by `maya`.
		const mixed = await selectThread(page, rowQuoted(page, 'Release Plan'));
		const mine = mixed.locator('article.comment[data-comment-id="c-text-steve"]');
		const theirs = mixed.locator('article.comment[data-comment-id="c-text-maya"]');

		await expect(mine.locator('.comment-author-name')).toHaveText('steve');
		await expect(mine.getByRole('button', { name: 'Edit comment' })).toHaveCount(1);
		await expect(mine.getByRole('button', { name: 'Delete comment' })).toHaveCount(1);

		await expect(theirs.locator('.comment-author-name')).toHaveText('maya');
		await expect(theirs.getByRole('button', { name: 'Edit comment' })).toHaveCount(0);
		await expect(theirs.getByRole('button', { name: 'Delete comment' })).toHaveCount(0);

		await mixed.getByRole('button', { name: 'Close', exact: true }).click();
		await expect(popover(page)).toHaveCount(0);

		// The asymmetry: `t-long` is authored ENTIRELY by `maya`, so there is not
		// one per-comment action on it — yet `Delete thread` is enabled, because
		// its only guard is `disabled={!currentUserId}`. Any signed-in reviewer
		// can delete someone else's whole thread but cannot delete a single
		// comment inside it.
		const theirThread = await selectThread(page, rowQuoted(page, 'Reviewers should verify'));
		await expect(theirThread.getByRole('button', { name: 'Edit comment' })).toHaveCount(0);
		await expect(theirThread.getByRole('button', { name: 'Delete comment' })).toHaveCount(0);
		await expect(theirThread.getByRole('button', { name: 'Delete thread' })).toBeEnabled();
	});
});

test.describe('review comment lifecycle: deletion is always soft', () => {
	test.beforeEach(async ({ page }) => {
		await gotoHydrated(page, ROUTE);
		await openSidebar(page);
	});

	test('a UI delete carries `soft: true` and leaves the comment in `threads` with a `deletedAt`', async ({
		page
	}) => {
		const dialog = await selectThread(page, rowQuoted(page, 'Release Plan'));
		await expect(badge(page)).toHaveText('4');

		await dialog
			.locator('article.comment[data-comment-id="c-text-steve"]')
			.getByRole('button', { name: 'Delete comment' })
			.click();

		await expect(page.getByTestId('event-log').locator('li')).toHaveCount(1);
		const [deleted] = await payloadsFor(page, 'commentdelete');
		// Hard delete is reachable only through the imperative
		// `deleteComment(threadId, commentId, false)`; nothing in the rendered UI
		// can produce `soft: false`.
		expect(deleted).toEqual({ threadId: 't-text', commentId: 'c-text-steve', soft: true });

		// The comment stops rendering and stops counting…
		await expect(dialog.locator('article.comment[data-comment-id="c-text-steve"]')).toHaveCount(0);
		await expect(badge(page)).toHaveText('3');
		await expect(page.getByTestId('visible-comment-count')).toHaveText('visible comments: 3');
		// …but it is still in `threads`, carrying a timestamp. Soft delete is an
		// audit trail, not an erasure — `stored comments` never drops.
		await expect(page.getByTestId('stored-comment-count')).toHaveText('stored comments: 6');
		await expect(page.getByTestId('soft-deleted-ids')).toContainText('c-text-steve');
		// The thread itself survives: it still has a visible comment.
		await expect(page.getByTestId('thread-count')).toHaveText('threads: 4');
	});

	test('the same reducer call WITHOUT `deletedAt` applies, stamping the time itself', async ({
		page
	}) => {
		// This test used to pin the opposite, and the pin was the point: what it
		// documented was the likeliest consumer mistake in the whole API.
		// `deleteComment(threads, t, c, { soft: true })` — no `deletedAt` — used to
		// return `{ changed: false }` and the identical array. No throw, no warn,
		// no partial application; the only way to notice was to read `changed`.
		//
		// Why that bailout was indefensible rather than merely strict: the delete
		// the component actually emits is `CommentDeleteEvent`, which carries only
		// `{ threadId, commentId, soft }`. There is no timestamp on it to forward,
		// so the obvious wiring — hand the event straight to the reducer —
		// typechecked, ran, and did nothing, AFTER ReviewEditor had already
		// announced "Comment deleted" to screen readers. The default path was the
		// broken one.
		//
		// Fixed: a soft delete that omits `deletedAt` now defaults it to
		// `timestamp()` inside the reducer, which is the only place that can see
		// the omission. An explicitly supplied `deletedAt` still wins verbatim and
		// hard delete is untouched — both pinned in the reducer-level test below,
		// because the page exposes ids but never the stamp values.
		await expect(page.getByTestId('visible-comment-count')).toHaveText('visible comments: 4');
		await expect(docRow(page).locator('p.thread-preview')).toHaveText(
			'Overall this reads well. One pass for tone and it ships.'
		);

		await page.getByTestId('delete-without-deletedat').click();

		await expect(page.getByTestId('last-changed')).toHaveText('last reducer changed: true');
		await expect(page.getByTestId('visible-comment-count')).toHaveText('visible comments: 3');
		await expect(badge(page)).toHaveText('3');
		// The stamp itself is observable, if indirectly: `soft-deleted-ids` is
		// derived by filtering on `comment.deletedAt`, so `c-doc-1` can only appear
		// there if the reducer wrote a truthy timestamp onto it — nobody passed one
		// in.
		await expect(page.getByTestId('soft-deleted-ids')).toContainText('c-doc-1');
		// Still soft, not an erasure: the comment is gone from the counts but not
		// from `threads`.
		await expect(page.getByTestId('stored-comment-count')).toHaveText('stored comments: 6');
		await expect(page.getByTestId('thread-count')).toHaveText('threads: 4');

		// `c-doc-1` was `t-doc`'s only comment, so applying the delete turns the
		// document thread into a ghost: it leaves the sidebar and the visible-thread
		// count while staying in `threads`. Under the old no-op the row simply
		// stayed put with its preview intact.
		await expect(docRow(page)).toHaveCount(0);
		await expect(page.getByTestId('visible-thread-count')).toHaveText('visible threads: 2');

		// Unchanged by the fix: this is a page-side reducer call, so the component
		// never hears about it and emits nothing.
		await expect(page.getByTestId('event-log').locator('li')).toHaveCount(0);
	});
});

// The reducer, called directly rather than through the page. The route renders
// which comments carry a `deletedAt` but never the stamp VALUES, and the whole
// contract at issue here is about values: what gets defaulted, and what must be
// left alone. These import the same installed `@lostgradient/editor` build the
// route runs against, so they pin the shipping behavior, not a reimplementation.
test.describe('review comment lifecycle: the delete reducer directly', () => {
	const EXPLICIT_STAMP = '2019-03-04T05:06:07.008Z';

	/** One thread, one live comment. Fresh per call — the helpers are pure, but the fixtures are not shared. */
	const oneLiveComment = (): Thread[] => [
		{
			id: 't-solo',
			createdAt: '2026-08-01T09:00:00.000Z',
			anchor: {
				type: 'document',
				from: 0,
				to: 0,
				quote: '',
				prefix: '',
				suffix: '',
				status: 'anchored'
			},
			comments: [
				{
					id: 'c-solo',
					threadId: 't-solo',
					authorId: 'steve',
					body: 'Only comment.',
					createdAt: '2026-08-01T09:00:00.000Z'
				}
			]
		}
	];

	test('an omitted `deletedAt` is defaulted to now; an explicit one is kept verbatim', () => {
		// The default half. `Date.now()` brackets the call, so this fails both if
		// the stamp goes missing (the old no-op) and if it is some fixed or
		// borrowed value rather than the current time.
		const before = Date.now();
		const defaulted = deleteComment(oneLiveComment(), 't-solo', 'c-solo', { soft: true });
		const after = Date.now();

		expect(defaulted.changed).toBe(true);
		const stamped = defaulted.threads[0].comments[0].deletedAt;
		expect(stamped).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
		expect(Date.parse(stamped as string)).toBeGreaterThanOrEqual(before);
		expect(Date.parse(stamped as string)).toBeLessThanOrEqual(after);

		// The half the default must not clobber, and the reason it is asserted
		// alongside: a consumer with a server clock, a backdated import, or an
		// undo/redo stack passes its own `deletedAt` and needs it stored
		// unmodified — not silently re-stamped with the local time.
		const explicit = deleteComment(oneLiveComment(), 't-solo', 'c-solo', {
			soft: true,
			deletedAt: EXPLICIT_STAMP
		});
		expect(explicit.changed).toBe(true);
		expect(explicit.threads[0].comments[0].deletedAt).toBe(EXPLICIT_STAMP);
	});

	test('the surviving no-ops still no-op, and hard delete still erases without stamping', () => {
		// Defaulting the timestamp did not turn every soft delete into a change.
		// An already-soft-deleted comment is still refused — identity-equal array,
		// `changed: false` — which is what keeps a double delete from overwriting
		// the original audit timestamp with a later one.
		const alreadyDeleted = deleteComment(oneLiveComment(), 't-solo', 'c-solo', {
			soft: true,
			deletedAt: EXPLICIT_STAMP
		}).threads;
		const again = deleteComment(alreadyDeleted, 't-solo', 'c-solo', { soft: true });
		expect(again.changed).toBe(false);
		expect(again.threads).toBe(alreadyDeleted);
		expect(again.threads[0].comments[0].deletedAt).toBe(EXPLICIT_STAMP);

		// Unknown ids are still no-ops rather than defaulted-into-existence.
		expect(deleteComment(oneLiveComment(), 't-nope', 'c-solo', { soft: true }).changed).toBe(false);
		expect(deleteComment(oneLiveComment(), 't-solo', 'c-nope', { soft: true }).changed).toBe(false);

		// Hard delete is untouched by the fix: it removes the comment outright, so
		// there is nothing left to carry a timestamp.
		const hard = deleteComment(oneLiveComment(), 't-solo', 'c-solo', { soft: false });
		expect(hard.changed).toBe(true);
		expect(hard.threads[0].comments).toEqual([]);
	});

	test('`updateComment` and `deleteThread` no-op on unknown ids too, array identity included', () => {
		// `deleteComment` was the only helper with unknown-id coverage anywhere in
		// this repo, at any layer. That gap mattered because the UI-path test below
		// leans on all three behaving the same way, and "the other two presumably
		// do the same thing" is exactly the assumption this file exists to refuse.
		//
		// Identity (`toBe`, not `toEqual`) is asserted alongside `changed` because
		// the two are separable: a helper that fell through to `threads.map(...)`
		// on an unknown id would still report `changed: false` and still produce a
		// contents-equal array, while handing every consumer a new reference and
		// invalidating whatever they keyed off the old one.
		const threads = oneLiveComment();

		const updateUnknownThread = updateComment(threads, 't-nope', 'c-solo', {
			body: 'Never applied.',
			editedAt: EXPLICIT_STAMP
		});
		expect(updateUnknownThread.changed).toBe(false);
		expect(updateUnknownThread.threads).toBe(threads);

		const updateUnknownComment = updateComment(threads, 't-solo', 'c-nope', {
			body: 'Never applied.',
			editedAt: EXPLICIT_STAMP
		});
		expect(updateUnknownComment.changed).toBe(false);
		expect(updateUnknownComment.threads).toBe(threads);

		const deleteUnknownThread = deleteThread(threads, 't-nope');
		expect(deleteUnknownThread.changed).toBe(false);
		expect(deleteUnknownThread.threads).toBe(threads);

		// The corresponding positive case, so the assertions above cannot be
		// passing because these helpers no-op on everything.
		expect(deleteThread(threads, 't-solo').changed).toBe(true);
		expect(
			updateComment(threads, 't-solo', 'c-solo', { body: 'Applied.', editedAt: EXPLICIT_STAMP })
				.changed
		).toBe(true);
	});
});

test.describe('review comment lifecycle: ghost threads', () => {
	test.beforeEach(async ({ page }) => {
		await gotoHydrated(page, ROUTE);
	});

	test('a seeded thread whose only comment is soft-deleted stays anchored and opens an empty popover', async ({
		page
	}) => {
		// `t-empty` is invisible to both counters but fully alive in the document.
		await expect(page.getByTestId('thread-count')).toHaveText('threads: 4');
		await expect(page.getByTestId('visible-thread-count')).toHaveText('visible threads: 3');
		await expect(badge(page)).toHaveText('4');

		// Exactly one decoration span, covering exactly the quoted range. Before
		// the fix in cinder PR #1266 a seeded thread decorated the entire
		// document, and this locator resolved to several spans. (The decoration
		// contract itself belongs to `review-anchoring`; it matters here only
		// because clicking the decoration is the ONLY way to reach a ghost.)
		const ghostAnchor = page.locator('span.comment-anchor[data-thread-id="t-empty"]');
		await expect(ghostAnchor).toHaveCount(1);
		await expect(ghostAnchor).toHaveText('Timeline risk');

		await ghostAnchor.click();
		const dialog = popover(page);
		await expect(dialog).toHaveAttribute('data-position-ready', 'true');

		await expect(dialog.locator('article.comment')).toHaveCount(0);
		await expect(dialog.locator('.comment-list-empty')).toHaveText('No comments yet.');
		// Still deletable, and still able to take a new reply — a ghost is a
		// thread with nothing to show, not a tombstone.
		await expect(dialog.getByRole('button', { name: 'Delete thread' })).toBeEnabled();
		await expect(dialog.locator('#lifecycle-editor-thread-popover-composer')).toBeVisible();
	});

	test('soft-deleting the last visible comment turns a live thread into a ghost in place', async ({
		page
	}) => {
		await openSidebar(page);
		const dialog = await selectThread(page, docRow(page));
		await dialog
			.locator('article.comment[data-comment-id="c-doc-1"]')
			.getByRole('button', { name: 'Delete comment' })
			.click();

		// The row leaves the sidebar and the count drops…
		await expect(docRow(page)).toHaveCount(0);
		await expect(sidebar(page).locator('.thread-count')).toHaveText('2');
		// …while `threads` keeps all four, and the popover stays open on a thread
		// that no longer has anything to list.
		await expect(page.getByTestId('thread-count')).toHaveText('threads: 4');
		await expect(dialog.locator('.comment-list-empty')).toHaveText('No comments yet.');
	});
});

test.describe('review comment lifecycle: clear all', () => {
	test('the confirmation counts VISIBLE threads but `Delete All` deletes every thread', async ({
		page
	}) => {
		await gotoHydrated(page, ROUTE);
		await openSidebar(page);

		await sidebar(page).getByRole('button', { name: 'Comment actions' }).click();
		// Scoped to the sidebar's own menu: the toolbar's export dropdown also
		// renders `[role="menuitem"]` children (Content / Summary / Git Diff /
		// Comments / JSON), and one of them is literally named `Comments`.
		const menu = page.locator('#lifecycle-editor-sidebar-actions-menu');
		await menu.getByRole('menuitem', { name: 'Clear all comments' }).click();

		const confirm = sidebar(page).locator('.confirm-clear');
		await expect(confirm).toHaveAttribute('role', 'alertdialog');
		await expect(confirm).toHaveAttribute(
			'aria-labelledby',
			'lifecycle-editor-sidebar-confirm-title'
		);
		// The banner interpolates the VISIBLE thread count — it says three.
		await expect(confirm.locator('.confirm-message')).toHaveText('Delete all 3 comment threads?');
		await expect(confirm.locator('.confirm-message')).toHaveAttribute(
			'id',
			'lifecycle-editor-sidebar-confirm-title'
		);

		await confirm.getByRole('button', { name: 'Delete All' }).click();

		// …and then emits FOUR. `clearAllThreads` iterates `threads`, not the
		// filtered list the banner was counting, so the invisible ghost is deleted
		// by a dialog that never mentioned it. A consumer sizing an undo buffer or
		// a confirmation from that number is off by every ghost in the document.
		await expect(page.getByTestId('event-log').locator('li')).toHaveCount(4);
		const removed = await payloadsFor(page, 'threaddelete');
		expect(removed).toEqual([
			{ threadId: 't-doc' },
			{ threadId: 't-text' },
			{ threadId: 't-long' },
			{ threadId: 't-empty' }
		]);

		await expect(page.getByTestId('thread-count')).toHaveText('threads: 0');
		await expect(page.locator('span.comment-anchor')).toHaveCount(0);
		await expect(sidebar(page).locator('.empty-message')).toHaveText('No comments yet');
		// With nothing left to act on, the actions trigger withdraws itself.
		await expect(sidebar(page).getByRole('button', { name: 'Comment actions' })).toHaveCount(0);
	});
});

test.describe('review comment lifecycle: counts and announcements', () => {
	test.beforeEach(async ({ page }) => {
		await gotoHydrated(page, ROUTE);
	});

	test('the toolbar badge counts COMMENTS while the sidebar count counts THREADS', async ({
		page
	}) => {
		// Two numbers, both sitting next to the word "Comments", both correct,
		// and never equal for this fixture: four visible comments across three
		// visible threads.
		await expect(badge(page)).toHaveText('4');
		await openSidebar(page);
		await expect(sidebar(page).locator('.thread-count')).toHaveText('3');

		// Only one of them reaches assistive tech as a number: the badge is
		// `aria-hidden`, and the count it carries is restated inside the toggle's
		// accessible name.
		await expect(badge(page)).toHaveAttribute('aria-hidden', 'true');
		await expect(
			page.getByRole('button', { name: 'Close comments sidebar (4 comments)' })
		).toHaveCount(1);

		// The sidebar's count is a bare `<span>` — no role, no label, no name.
		const countAttributes = await sidebar(page)
			.locator('.thread-count')
			.evaluate((element) => element.getAttributeNames());
		expect(countAttributes.filter((name) => name !== 'class')).toEqual([]);
	});

	test('the live announcer is empty on first paint and then mirrors the toggle, singular included', async ({
		page
	}) => {
		// `[role="status"]` alone is ambiguous — the editor also mounts a generic
		// LiveRegion with the same role. Both are `cinder-sr-only` as of cinder PR
		// #1266, so neither is reachable by visible text; scope by class.
		await expect(announcer(page)).toHaveClass(/cinder-sr-only/);
		await expect(announcer(page)).toHaveAttribute('aria-live', 'polite');
		await expect(announcer(page)).toHaveAttribute('aria-atomic', 'true');
		// Deliberate do-not-announce-on-mount guard: the count is 4, and the
		// region says nothing.
		await expect(announcer(page)).toBeEmpty();

		await openSidebar(page);

		// Walk the count down to one. `t-long` is authored by `maya`, so the only
		// way to remove its comment is to delete the whole thread; the remaining
		// two deletions are per-comment on `steve`'s own.
		const theirThread = await selectThread(page, rowQuoted(page, 'Reviewers should verify'));
		await theirThread.getByRole('button', { name: 'Delete thread' }).click();
		// Deleting a thread closes its popover; wait for that before selecting the
		// next one, so `selectThread` cannot latch onto the outgoing dialog.
		await expect(popover(page)).toHaveCount(0);
		await expect(announcer(page)).toHaveText('3 comments');

		const mixed = await selectThread(page, rowQuoted(page, 'Release Plan'));
		await mixed
			.locator('article.comment[data-comment-id="c-text-steve"]')
			.getByRole('button', { name: 'Delete comment' })
			.click();
		await expect(announcer(page)).toHaveText('2 comments');
		await mixed.getByRole('button', { name: 'Close', exact: true }).click();
		await expect(popover(page)).toHaveCount(0);

		const documentThread = await selectThread(page, docRow(page));
		await documentThread
			.locator('article.comment[data-comment-id="c-doc-1"]')
			.getByRole('button', { name: 'Delete comment' })
			.click();

		// Singular, and the toggle's accessible name uses the identical rule.
		await expect(announcer(page)).toHaveText('1 comment');
		await expect(
			page.getByRole('button', { name: 'Close comments sidebar (1 comment)' })
		).toHaveCount(1);
		await expect(badge(page)).toHaveText('1');
	});
});

// ROADMAP TI-2, and the item's premise did not survive contact with the package.
//
// TI-2 asked for a UI-driven test in which a stale `threadId`/`commentId` reaches
// the reducer, on the theory that a real user action could produce one the way a
// bare `deleteComment(threads, 't-nope', …)` call does. It cannot, and that is
// worth recording rather than quietly redefining, because the reason is a design
// decision the package states out loud: every mutation method documents "silent
// no-op behavior supports declarative UI patterns where callers don't need to
// pre-check conditions."
//
// Re-verified against the installed `@lostgradient/editor@0.11.0`, in
// `dist/components/review-editor/review-editor-impl.svelte` (line numbers moved
// from the 0.10.0 build this comment originally cited; the behavior did not):
//
//   - `updateComment` (:1713) and `deleteComment` (:1743) both re-look-up the id
//     in the CURRENT `threads` and `return` before touching the callback.
//   - `deleteThread` (:1630) does the same, and `clearAllThreads` (:1648) emits
//     each thread's id while that thread is still in the array.
//   - The popover delegates straight to those three (`handlePopoverDelete` /
//     `handlePopoverCommentUpdate` / `handlePopoverCommentDelete`, :405-424), so
//     the rendered UI has no path around them.
//   - `popoverThread` is `$derived` from `threads` and the popover renders under
//     `{#if popoverThread && popoverPosition}`, with an `$effect` (:306) that
//     nulls `popoverThreadId` as well — so a popover cannot be held open over a
//     thread that has left the array and re-fired against it.
//
// So the first test below is the honest empirical version of "click Delete
// twice": the control is gone the second time. What remains of TI-2 is its own
// other half — the DELAYED CALLBACK — and that gap is by definition on the
// consumer, so the page models it: `arm-deferral` queues the next comment event
// instead of applying it, a real `Delete thread` click removes the thread in
// between, and `flush-deferred` applies the queued payload afterwards. The id
// that reaches the reducer is still the component's own, minted from a real
// click; only the moment of application moved.
test.describe('review comment lifecycle: a stale id reaching the reducer', () => {
	const EDITED_BODY = 'Renaming it now would break the changelog.';
	const ORIGINAL_BODY = 'Should this say "Launch Plan" instead?';

	/**
	 * The observed-state readouts as one object, for a before/after comparison.
	 *
	 * Deliberately excludes `last-changed`, `counts-at-last-event`, and the
	 * deferral readouts: those are the ones the flush is SUPPOSED to move, and
	 * folding them in would make the comparison assert nothing.
	 */
	async function observedState(page: Page): Promise<Record<string, string | null>> {
		const testIds = [
			'thread-count',
			'visible-thread-count',
			'visible-comment-count',
			'stored-comment-count',
			'soft-deleted-ids',
			'thread-ids',
			'seeded-anchors'
		];
		const entries = await Promise.all(
			testIds.map(async (id) => [id, await page.getByTestId(id).textContent()] as const)
		);
		return Object.fromEntries(entries);
	}

	test.beforeEach(async ({ page }) => {
		await gotoHydrated(page, ROUTE);
	});

	test('the direct path is closed: the UI withdraws each control before it can fire twice', async ({
		page
	}) => {
		await openSidebar(page);
		const dialog = await selectThread(page, rowQuoted(page, 'Release Plan'));
		const mine = dialog.locator('article.comment[data-comment-id="c-text-steve"]');

		await mine.getByRole('button', { name: 'Delete comment' }).click();

		// The comment-level half, and the one with a real break lever:
		// `comment-list.svelte` filters soft-deleted comments out of its `{#each}`,
		// so the article carrying the Delete button is unmounted along with it.
		// There is no second click to make, which is why "click Delete twice" is
		// not a test that can exist here.
		await expect(mine).toHaveCount(0);
		// One comment left — `maya`'s — and it is not `steve`'s to delete, so the
		// popover now offers no Delete comment button at all. The counts are stated
		// rather than just asserting "zero buttons", which a blank popover would
		// also satisfy.
		await expect(dialog.locator('article.comment')).toHaveCount(1);
		await expect(dialog.locator('article.comment')).toHaveAttribute(
			'data-comment-id',
			'c-text-maya'
		);
		await expect(dialog.getByRole('button', { name: 'Delete comment' })).toHaveCount(0);

		// The thread-level half. Weaker as a pin, and said so plainly: the popover
		// is guarded twice over — `handlePopoverDelete` closes it explicitly AND
		// `popoverThread` derives to null once the thread leaves `threads` — so no
		// single-line edit upstream can make this assertion fail. It is recorded
		// because it is the other half of why the direct path is closed, not
		// because it independently pins anything.
		await dialog.getByRole('button', { name: 'Delete thread' }).click();
		await expect(popover(page)).toHaveCount(0);
		await expect(rowQuoted(page, 'Release Plan')).toHaveCount(0);

		// Two emissions, two distinct live ids. Neither is stale: at the instant
		// each fired, its subject was still in `threads`.
		await expect(page.getByTestId('event-log').locator('li')).toHaveCount(2);
		expect(await payloadsFor(page, 'commentdelete')).toEqual([
			{ threadId: 't-text', commentId: 'c-text-steve', soft: true }
		]);
		expect(await payloadsFor(page, 'threaddelete')).toEqual([{ threadId: 't-text' }]);
	});

	test('a deferred `commentdelete` flushed after its thread is gone no-ops and keeps the array', async ({
		page
	}) => {
		// Arm before opening the sidebar, not after. The popover traps focus (it
		// is non-modal per cinder#1305, but Tab still cycles only its own
		// controls while open), and these controls sit outside it — reaching for
		// them mid-flow would be a click the real scenario never makes.
		await page.getByTestId('arm-deferral').click();
		await expect(page.getByTestId('deferral-armed')).toHaveText('deferral armed: true');

		await openSidebar(page);
		const dialog = await selectThread(page, rowQuoted(page, 'Release Plan'));
		await dialog
			.locator('article.comment[data-comment-id="c-text-steve"]')
			.getByRole('button', { name: 'Delete comment' })
			.click();

		// The queued payload, verbatim as the component emitted it. This assertion
		// is what makes the stale id component-authored: nothing in this spec ever
		// hands `t-text` to the reducer, and if the component minted a different
		// id here the test would say so.
		await expect(page.getByTestId('deferred-queue')).toHaveText(
			'deferred: commentdelete {"threadId":"t-text","commentId":"c-text-steve","soft":true}'
		);
		// The arm is one-shot and spent, so the `onthreaddelete` coming next is
		// applied normally rather than swallowed by the same queue.
		await expect(page.getByTestId('deferral-armed')).toHaveText('deferral armed: false');
		// Intercepted, not applied: the comment is still rendered and still counted.
		await expect(dialog.locator('article.comment[data-comment-id="c-text-steve"]')).toHaveCount(1);
		await expect(page.getByTestId('visible-comment-count')).toHaveText('visible comments: 4');

		// The removal in between, through the component's own UI rather than a
		// page-side splice — this is the step that makes the queued id stale.
		await dialog.getByRole('button', { name: 'Delete thread' }).click();
		await expect(popover(page)).toHaveCount(0);
		await expect(page.getByTestId('thread-ids')).toHaveText('thread ids: t-doc,t-long,t-empty');
		// Corroborates the interception from the component's side: when
		// `onthreaddelete` fired, `threads` still held all four threads and all six
		// stored comments, so the queued delete really had not been applied.
		await expect(page.getByTestId('counts-at-last-event')).toHaveText(
			'at event time: threads:4 visible:4 stored:6'
		);
		// `true` first is what gives the flip below its meaning: the readout can
		// move, and the flush is what moves it back.
		await expect(page.getByTestId('last-changed')).toHaveText('last reducer changed: true');

		const before = await observedState(page);

		await page.getByTestId('flush-deferred').click();

		// Three separable facts, and each has its own way of going wrong. The
		// reducer ran at all (only `apply*` writes `last-changed`); it reported no
		// change; and it handed back the IDENTICAL array rather than a fresh one
		// with the same contents — the second and third are independent, since a
		// helper that fell through to `threads.map(...)` on an unknown id would
		// still say `changed: false` while invalidating every consumer reference.
		await expect(page.getByTestId('last-changed')).toHaveText('last reducer changed: false');
		await expect(page.getByTestId('flush-identity')).toHaveText('flush kept array identity: true');
		await expect(page.getByTestId('deferred-queue')).toHaveText('deferred: —');

		expect(await observedState(page)).toEqual(before);

		// Still two events. The flush is consumer-side, so the component neither
		// hears about it nor re-emits — a stale id cannot bounce back into the UI.
		await expect(page.getByTestId('event-log').locator('li')).toHaveCount(2);
	});

	test('a deferred `commentupdate` flushed after its thread is gone no-ops the same way', async ({
		page
	}) => {
		// `updateComment` had no unknown-id coverage anywhere in this repo before
		// this test and its reducer-direct sibling above — only `deleteComment`
		// did. TI-2 names both.
		await page.getByTestId('arm-deferral').click();
		await openSidebar(page);
		const dialog = await selectThread(page, rowQuoted(page, 'Release Plan'));
		const comment = dialog.locator('article.comment[data-comment-id="c-text-steve"]');

		await comment.getByRole('button', { name: 'Edit comment' }).click();
		// No surrounding whitespace: `saveEdit` trims before emitting, and the
		// queued payload is compared byte-for-byte below.
		await dialog.locator('#c-text-steve-edit').fill(EDITED_BODY);
		await dialog.locator('#c-text-steve-edit').press('ControlOrMeta+Enter');

		await expect(page.getByTestId('deferred-queue')).toHaveText(
			`deferred: commentupdate {"threadId":"t-text","commentId":"c-text-steve","body":"${EDITED_BODY}"}`
		);
		await expect(page.getByTestId('deferral-armed')).toHaveText('deferral armed: false');

		// `saveEdit` calls `cancelEdit()` straight after `onupdate` regardless of
		// what the consumer does, so the edit form closing proves nothing on its
		// own. The body reverting to the ORIGINAL text is the proof: the component
		// renders `threads`, and `threads` never moved.
		await expect(comment.locator('.comment-body')).toHaveText(ORIGINAL_BODY);
		await expect(comment.locator('.comment-edited')).toHaveCount(0);

		await dialog.getByRole('button', { name: 'Delete thread' }).click();
		await expect(popover(page)).toHaveCount(0);
		await expect(page.getByTestId('thread-ids')).toHaveText('thread ids: t-doc,t-long,t-empty');
		await expect(page.getByTestId('last-changed')).toHaveText('last reducer changed: true');

		const before = await observedState(page);

		await page.getByTestId('flush-deferred').click();

		await expect(page.getByTestId('last-changed')).toHaveText('last reducer changed: false');
		await expect(page.getByTestId('flush-identity')).toHaveText('flush kept array identity: true');
		await expect(page.getByTestId('deferred-queue')).toHaveText('deferred: —');

		expect(await observedState(page)).toEqual(before);
		await expect(page.getByTestId('event-log').locator('li')).toHaveCount(2);
	});
});

/**
 * Record every distinct value of `.thread-popover-quote`'s text, from now on.
 *
 * Attached to the popover's own root, not a page-wide ancestor: this
 * component's `{#if popoverThread && popoverPosition}` block has no `{#key}`,
 * so the SAME `ThreadPopover` instance survives a `popoverThreadId` change —
 * its `thread` prop just updates in place, and the quote's text node mutates
 * rather than getting replaced by a new element. That makes the popover
 * `dialog` already resolves to at test start the right `MutationObserver`
 * target for every quote it will ever show, including one that appears and
 * reverts before any polled read could land on either edge.
 */
async function watchPopoverQuote(dialog: Locator): Promise<void> {
	await dialog.evaluate((element) => {
		const win = window as unknown as { __quoteTrace?: string[] };
		const trace: string[] = [];
		win.__quoteTrace = trace;
		const record = () => {
			const quote = element.querySelector('.thread-popover-quote');
			const text = quote ? quote.textContent : null;
			if (text !== null && trace[trace.length - 1] !== text) trace.push(text);
		};
		record();
		new MutationObserver(record).observe(element, {
			childList: true,
			subtree: true,
			characterData: true
		});
	});
}

/** Every distinct quote `watchPopoverQuote` has recorded so far, in order. */
function popoverQuoteTrace(page: Page): Promise<string[]> {
	return page.evaluate(() => (window as unknown as { __quoteTrace?: string[] }).__quoteTrace ?? []);
}

/**
 * Sample one DOM node's connectivity and one descendant's `.value` every
 * animation frame, for `ms` of real time — entirely inside the page, so the
 * sampling rate is a frame (~16ms at 60Hz) rather than however long a Node
 * round trip takes, and nothing can slip between two samples unnoticed.
 *
 * Pre-cinder#1320, a destroy-and-recreate round trip disconnected THIS exact
 * node and started a fresh composer at `''`. A `toBeAttached()` followed by
 * `toHaveValue()` after a fixed delay cannot pin "never happened": both
 * matchers auto-retry toward whatever is true WHEN THEY RUN, and a
 * freshly-recreated popover sharing the same id satisfies `toBeAttached()`
 * exactly as happily as the original — so the only way that shape of
 * assertion could ever have failed is landing mid-round-trip by chance.
 * Sampling the identical node handle throughout is what actually pins it.
 */
async function sampleNodeStability(
	handle: ElementHandle<Element>,
	composerId: string,
	ms: number
): Promise<{ connected: boolean; composerValue: string | null }[]> {
	return handle.evaluate(
		(element, { composerId, ms }) => {
			return new Promise<{ connected: boolean; composerValue: string | null }[]>((resolve) => {
				const samples: { connected: boolean; composerValue: string | null }[] = [];
				const start = performance.now();
				const tick = () => {
					const composer = element.querySelector(`#${composerId}`) as HTMLTextAreaElement | null;
					samples.push({
						connected: element.isConnected,
						composerValue: composer ? composer.value : null
					});
					if (performance.now() - start < ms) {
						requestAnimationFrame(tick);
					} else {
						resolve(samples);
					}
				};
				requestAnimationFrame(tick);
			});
		},
		{ composerId, ms }
	);
}

// ROADMAP X-3: sidebar quiet-failure paths. The orphaned-thread popover
// fallback (`handleSidebarThreadSelect` opening against the editor's own box
// rather than dropping an orphan's click silently — see `anchorCoords` and its
// caller in `review-editor-impl.svelte`) was the instance already found and
// already handled; these three pin the rest of what a sidebar click can do.
// Two of the three used to be confirmed-broken races — a stale sidebar timer
// overwriting a newer anchor-selected popover (cinder#1319), and a re-click on
// the active row destroying the popover and its unsent draft (cinder#1320) —
// both fixed in `@lostgradient/editor@0.11.0`. The third, Escape's draft loss,
// was and remains a confirmed-correct control.
test.describe('review comment lifecycle: sidebar selection is a delayed but cancellable timer', () => {
	test.beforeEach(async ({ page }) => {
		await gotoHydrated(page, ROUTE);
		await openSidebar(page);
	});

	test('a later anchor click cancels a stale sidebar-select timer, so its popover survives past the original window (cinder#1319, fixed)', async ({
		page
	}) => {
		// `review-editor-impl.svelte` declares `selectTimeoutId` at the component
		// level with its own comment: "Stored at component level so we can cancel
		// it when switching threads." `handleAnchorClick` (a document-anchor click)
		// honours that contract — its first act is clearing the stored id. Before
		// cinder#1319, `handleSidebarThreadSelect`, the sidebar's OWN selection
		// handler, never assigned its `setTimeout(…, POSITION_DELAY_MS)` return
		// value to that variable at all, so the cancellation the comment promises
		// never reached the path most likely to need it: switching away from a
		// sidebar selection before its 350ms delay elapsed.
		//
		// Fixed: `handleSidebarThreadSelect` now stores its timer in that same
		// `selectTimeoutId`, so `handleAnchorClick`'s cancellation actually reaches
		// it. Click a sidebar row — this schedules the (now cancellable) timer —
		// then, inside that window, select a DIFFERENT thread via its document
		// anchor, which opens synchronously with no delay of its own. The popover
		// shows the anchor-selected thread at first, and — the fix — still shows
		// it ~350ms after the ORIGINAL sidebar click, with no further user action:
		// the stale timer was actually cancelled rather than merely outraced, so
		// it never fires to overwrite `popoverThreadId`/`popoverPosition` back to
		// the thread the user already left.
		await rowQuoted(page, 'Release Plan').click();

		const ghostAnchor = page.locator('span.comment-anchor[data-thread-id="t-empty"]');
		await ghostAnchor.click();

		const dialog = popover(page);
		await expect(dialog).toHaveAttribute('data-position-ready', 'true');

		// GUARD: prove the anchor click actually won the race and opened the
		// thread it targeted, so what follows is a genuine test of survival past
		// the window rather than a mis-timed test that never entered it. If THIS
		// assertion is what fails, read it as "the window was missed" (a loaded
		// machine spent too long on the two clicks) and rerun — it says nothing
		// about whether the fix holds.
		await expect(dialog.locator('.thread-popover-quote')).toHaveText('"Timeline risk"');
		await expect(rowQuoted(page, 'Timeline risk')).toHaveCount(0); // it's a ghost — no sidebar row exists to have gone active
		await expect(sidebar(page).locator('[aria-current="true"]')).toHaveCount(0);

		// A single point-in-time snapshot after a fixed delay is not enough
		// here, because broken this state SELF-HEALS. A second, independent
		// `$effect` in `review-editor-impl.svelte` watches `activeThreadId` vs
		// `popoverThreadId` and reschedules its own repositioning timer on the
		// same 350ms `POSITION_DELAY_MS` whenever they diverge, so the
		// orphaned sidebar timer's corruption gets silently repaired roughly
		// one more `POSITION_DELAY_MS` window after it happens — with no
		// further user action.
		//
		// Measured empirically, against a deliberately reverted fix
		// (`handleSidebarThreadSelect`'s `setTimeout` unassigned again), 8 runs
		// at 4-way parallel load: the wrong quote ("Release Plan") appeared at
		// t≈250-280ms after this point and the popover self-healed back to
		// "Timeline risk" at t≈600-635ms, every time. A single
		// `waitForTimeout(500)` snapshot landed inside that dead zone — after
		// the corruption, after the heal — and passed whether or not the fix
		// was present. `watchPopoverQuote` instead captures every quote the
		// popover ever shows from here on, so the corrupted state cannot hide
		// between two polls; 1200ms leaves close to double the observed
		// self-heal time as margin.
		await watchPopoverQuote(dialog);
		await page.waitForTimeout(1200);

		const trace = await popoverQuoteTrace(page);
		expect(trace).not.toContain('"Release Plan"');
		expect(trace).toContain('"Timeline risk"');
		expect(trace[trace.length - 1]).toBe('"Timeline risk"');
		await expect(sidebar(page).locator('[aria-current="true"]')).toHaveCount(0);
	});

	test('re-selecting the sidebar row that is already active leaves the open popover, and any unsent reply, untouched (cinder#1320, fixed)', async ({
		page
	}) => {
		// `thread-popover.svelte` attaches
		// `createClickOutside({ handler: () => onclose?.() })` with that helper's
		// defaults: `eventType: 'click'`, `capture: true`, listening on
		// `document`. A capture-phase `document` listener runs before the
		// target's own bubble-phase `onclick`, so before cinder#1320 EVERY click
		// on a sidebar row — including a re-click on the row whose thread is
		// already open — first tore the popover down via `onclose`
		// (`handlePopoverClose`, which nulls `popoverThreadId`/`popoverPosition`)
		// and only then ran the row's own `onclick`, which scheduled a fresh
		// ~350ms-delayed reopen for the same thread. `CommentComposer` keeps its
		// reply draft in its own `value = $bindable('')` state, but neither
		// `ThreadPopover` nor `review-editor-impl.svelte` ever passes
		// `bind:value` through — nothing here is a controlled input a consumer
		// could rehydrate even if it wanted to — so the destroy-then-recreate
		// round trip dropped it.
		//
		// Fixed two ways, both exercised here: `review-editor-impl.svelte` now
		// passes `ignoreClickOutsideRef`, resolving the currently-active sidebar
		// row, so a click on THAT row no longer counts as "outside" the popover
		// and `onclose` never fires; and `handleSidebarThreadSelect` itself now
		// short-circuits when the clicked thread is already both
		// `activeThreadId` and `popoverThreadId`, so even the row's own
		// `onclick` schedules nothing. Re-clicking a row that is ALREADY the
		// active selection was never observably a "switch to a different
		// thread" — nothing about the gesture reads as "discard my draft",
		// unlike Escape or the close button (the control test below) — and now
		// nothing about it does.
		const dialog = await selectThread(page, rowQuoted(page, 'Release Plan'));
		const composer = dialog.locator('#lifecycle-editor-thread-popover-composer');
		const DRAFT = 'Renaming it now would break the changelog.';
		await composer.fill(DRAFT);

		// Captured as a handle, not just a locator: a locator re-resolves by
		// selector on every call, so it would read "attached" just as happily
		// against a freshly recreated element sharing the same id. The handle
		// pins THIS node — if the popover were torn down and rebuilt, this
		// specific element would report `isConnected: false` even though a
		// lookalike replaced it in the DOM.
		const dialogHandle = await dialog.elementHandle();
		if (!dialogHandle) throw new Error('popover was not attached before the re-click');

		await rowQuoted(page, 'Release Plan').click();

		// A fixed-delay-then-snapshot cannot pin "never destroyed": both
		// `toBeAttached()`-style checks and `toHaveValue()` auto-retry toward
		// whatever is true WHEN THEY RUN, and a freshly recreated popover
		// sharing the same id satisfies an attachment check exactly as happily
		// as the original — so a stale-handle `isConnected` read taken once,
		// after the fact, is the only thing standing between this test and
		// that hole, and it only catches the destroy if the sample happens to
		// land after the tear-down and before a same-shaped replacement fools
		// a locator-based check elsewhere. `sampleNodeStability` instead polls
		// this exact node and its composer's live `.value` every animation
		// frame for 600ms — comfortably past both the click-outside dispatch
		// and the ~350ms timer a genuine reselection would have scheduled —
		// so a destroy-and-recreate round trip cannot land between samples.
		const samples = await sampleNodeStability(
			dialogHandle,
			'lifecycle-editor-thread-popover-composer',
			600
		);
		expect(samples.length).toBeGreaterThan(0);
		expect(samples.every((sample) => sample.connected)).toBe(true);
		expect(samples.every((sample) => sample.composerValue === DRAFT)).toBe(true);

		await expect(dialog).toHaveAttribute('data-position-ready', 'true');
		await expect(composer).toHaveValue(DRAFT);
	});

	test('dismissing the popover with Escape also discards an unsent reply — correctly, since no draft persistence exists to preserve it', async ({
		page
	}) => {
		// The control for the two pinned tests above: Escape is an unambiguous,
		// universally-understood "cancel this" gesture, and `CommentComposer`'s
		// reply draft is deliberately transient state scoped to the popover's own
		// lifetime — recorded here as CORRECT rather than assumed, since silence
		// is only a non-bug when something asserts it explicitly. Losing a draft
		// on an explicit dismissal is the component doing exactly what its (lack
		// of a) draft-persistence contract promises; the bug above is that the
		// SAME loss also happens on a gesture that promises nothing of the sort.
		const dialog = await selectThread(page, rowQuoted(page, 'Release Plan'));
		const composer = dialog.locator('#lifecycle-editor-thread-popover-composer');
		await composer.fill('Renaming it now would break the changelog.');

		await page.keyboard.press('Escape');
		await expect(popover(page)).toHaveCount(0);

		const reopened = await selectThread(page, rowQuoted(page, 'Release Plan'));
		await expect(reopened.locator('#lifecycle-editor-thread-popover-composer')).toHaveValue('');
	});
});

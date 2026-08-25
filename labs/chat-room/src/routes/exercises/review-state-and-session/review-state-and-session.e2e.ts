import { expect, test } from '@playwright/test';
import { gotoHydrated } from '../hydration';
import type { Locator, Page } from '@playwright/test';

// Pins the state / session / persistence surface of `@lostgradient/editor`:
// the imperative `getState`/`setState` round-trip on a live `ReviewEditor`,
// the exported-but-unconsumed `createReviewEditorState`, and the whole of
// `@lostgradient/editor/session` (pure updates plus sessionStorage).
//
// Two facts frame everything below.
//
// First, this route is written against cinder PR #1266 (merged, pending
// release), which is what the `@lostgradient/editor` build installed here
// carries. Before that fix the public `<ReviewEditor>` wrapper rendered its
// implementation WITHOUT `bind:this` and re-exported nothing, so every
// imperative method was unreachable and the persisted round-trip was dead
// from the published entry point. Half of this spec would have been
// unwritable.
//
// Second, nothing in `ReviewEditorProps` accepts a session, a review outcome,
// or a draft comment, and there is no `onreviewsubmit`. The session module is
// reachable only by importing it; the component neither consumes nor emits
// any of it. That gap is the reason a module harness and a live editor share
// one page here — so the seam is observable rather than merely asserted.

const ROUTE = '/exercises/review-state-and-session';

/**
 * The container element for one editor. `id` lands on the inner
 * MarkdownEditor, not on the ReviewEditor root, so the root has to be reached
 * by filtering the `review-editor` containers on which one owns that id. The
 * derived ids (`{id}-controls`, `{id}-sidebar`, `{id}-editor-panel`) are the
 * only stable handles the component gives a consumer.
 */
function editorContainer(page: Page, editorId: string): Locator {
	return page
		.locator('[data-testid="review-editor"]')
		.filter({ has: page.locator(`#${editorId}`) });
}

/** The anchor decorations the ProseMirror plugin renders inside one editor. */
function anchorDecorations(page: Page, editorId: string): Locator {
	return editorContainer(page, editorId).locator('span.comment-anchor');
}

test.describe.serial('review-state-and-session: imperative state round-trip', () => {
	// One page for the whole block: every test here mutates the editor through
	// `setState`, so the order is load-bearing and each test builds on the last.
	let page: Page;

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		await gotoHydrated(page, ROUTE);
		await expect(editorContainer(page, 'state-editor')).toHaveAttribute('data-ready', 'true');
	});

	test.afterAll(async () => {
		await page.close();
	});

	test("bind:this exposes all 22 of the implementation's imperative methods", async () => {
		await page.getByTestId('probe-instance').click();

		// Probed by `typeof`, not by enumeration: what makes a method reachable
		// is that it is callable. The count is the load-bearing assertion —
		// before cinder#1266 the wrapper forwarded none of them.
		await expect(page.getByTestId('instance-callable-count')).toHaveText('callable methods: 22/22');
		await expect(page.getByTestId('instance-callable-methods')).toContainText('getState,getView');
		await expect(page.getByTestId('instance-callable-methods')).toContainText(
			'setMarkdown,setState'
		);

		// CORRECTED EXPECTATION: this used to assert that `Object.keys()` on the
		// instance also carried Svelte's legacy `$destroy`/`$on`/`$set`
		// accessors. It does not, and never did here — those are a Svelte 4 /
		// legacy-mode artifact, and a runes-mode component reached through
		// `bind:this` exposes only its `export`ed members. So enumeration and the
		// `typeof` probe agree exactly: 22 keys, all of them callable, nothing
		// else. Asserted as exact text rather than a substring so a future
		// addition to (or removal from) the imperative surface fails here.
		await expect(page.getByTestId('instance-own-keys')).toHaveText(
			'instance own keys: clearAllThreads,createBlockThread,createComment,createDocumentThread,' +
				'createThread,deleteComment,deleteThread,exportMarkdownSummary,exportUnifiedDiff,focus,' +
				'getAst,getEditor,getFormData,getMarkdown,getSelection,getState,getView,reset,' +
				'scrollToThread,setMarkdown,setState,updateComment'
		);
		// Stated explicitly, because it is the platform fact the old assertion
		// got backwards: no legacy component accessors are present at all.
		await expect(page.getByTestId('instance-own-keys')).not.toContainText('$');
	});

	test('getState() always reports schema version 4 and hard-codes reviewSession to undefined', async () => {
		await page.getByTestId('capture-state').click();

		await expect(page.getByTestId('state-schema-version')).toHaveText('schemaVersion: 4');
		await expect(page.getByTestId('state-keys')).toHaveText(
			'state keys: content,frontMatter,frontMatterRaw,original,reviewSession,schemaVersion,threads,updatedAt'
		);

		// `reviewSession` is present as a KEY set to `undefined`, so it exists on
		// the object and disappears the moment the state is serialized. A
		// consumer copying the JSON out of the editor therefore never sees the
		// field at all — there is no way to put a review session INTO the
		// component, and no way to get one back out of it.
		await expect(page.getByTestId('state-review-session')).toHaveText(
			'reviewSession: in-memory-key=true value=undefined after-json-key=false'
		);
		await expect(page.getByTestId('state-json-keys')).toHaveText(
			'state keys after JSON: content,frontMatter,frontMatterRaw,original,schemaVersion,threads,updatedAt'
		);

		// A document with no front matter reports null (not undefined) for both
		// front-matter fields, which is why they survive JSON while
		// `reviewSession` does not.
		await expect(page.getByTestId('state-front-matter')).toHaveText(
			'frontMatter=null frontMatterRaw=null'
		);
	});

	test('the persisted anchor drops from/to, and drops blockId/originalPosition only once serialized', async () => {
		// getState() names nine anchor fields explicitly, `blockId` and
		// `originalPosition` included even when undefined — so they are present
		// as keys in memory and vanish only when JSON.stringify discards
		// undefined-valued properties. `from`/`to` are absent in BOTH: runtime
		// positions are never persisted, which is what forces a restore to
		// recover position from the quote.
		//
		// `type` joined the in-memory list in cinder#1274 and behaves like
		// `blockId`/`originalPosition`: named explicitly, `undefined` for a text
		// anchor, and therefore dropped by JSON.stringify. getState() used to omit
		// it entirely, so anything persisted before that release cannot
		// distinguish a document-level anchor from a text one — which is why
		// `isDocumentAnchor` now also treats a quote-less anchor with no `type` as
		// document-level.
		await expect(page.getByTestId('state-anchor-keys')).toHaveText(
			'anchor keys: blockId,lastKnownOffset,originalPosition,originalQuote,prefix,quote,status,suffix,type'
		);
		await expect(page.getByTestId('state-json-anchor-keys')).toHaveText(
			'anchor keys after JSON: lastKnownOffset,originalQuote,prefix,quote,status,suffix'
		);

		// `toPersistedThreads` is the same projection, exported for callers doing
		// their own persistence — same nine keys, same missing positions.
		await page.getByTestId('probe-to-persisted-threads').click();
		await expect(page.getByTestId('to-persisted-anchor-keys')).toHaveText(
			'toPersistedThreads anchor keys: blockId,lastKnownOffset,originalPosition,originalQuote,prefix,quote,status,suffix,type'
		);
	});

	test('restoring into a document that no longer contains the quote ORPHANS the thread', async () => {
		await expect(page.getByTestId('live-thread-count')).toHaveText('threads: 1');

		await page.getByTestId('restore-quote-gone').click();

		// This used to delete the thread, and `comments/types.ts` cited that as
		// the reason `AnchorStatus` had no "orphaned" member. cinder#1284
		// reversed it: restoring a saved review against a document whose text has
		// since changed must not silently destroy the comments. The thread stays
		// in the BINDABLE array, so the count holds at 1.
		await expect(page.getByTestId('live-thread-count')).toHaveText('threads: 1');
		// Removing a thread is the consumer's decision now, so nothing is
		// reported — the component no longer acts on the user's behalf.
		await expect(page.getByTestId('event-log').getByRole('listitem')).toHaveCount(0);
		// Kept, but not placed: an orphaned anchor has no text to highlight, so
		// it paints no decoration. That is the visible half of the contract.
		await expect(anchorDecorations(page, 'state-editor')).toHaveCount(0);
	});

	test('restoring the captured state brings the thread back, re-anchored by quote alone', async () => {
		await page.getByTestId('restore-state').click();

		await expect(page.getByTestId('live-thread-count')).toHaveText('threads: 1');
		await expect(page.getByTestId('live-anchor-quote')).toHaveText('anchor quote: Release Plan');
		// The decoration lands on exactly the quoted text — the persisted state
		// carried no positions, so this can only have come from re-anchoring.
		await expect(anchorDecorations(page, 'state-editor')).toHaveText(['Release Plan']);

		// PINNED KNOWN BUG (wrong but real, no upstream issue filed for it here):
		// the recovered range is one ProseMirror position WIDER than the quote.
		// The hand-authored anchor on this page uses 1..13 for the 12-character
		// quote "Release Plan"; re-anchoring hands back 1..14. The quote ends at
		// a block boundary, and the trailing `textBetween` offset — which is the
		// "\n" block separator in that coordinate space — maps to the position
		// AFTER the heading closes. Decorations are clipped to text nodes, so
		// the highlight still covers exactly the quote and nothing warns; the
		// discrepancy is only visible by reading `anchor.to`. Compare with the
		// mid-paragraph case in the seeded-PersistedThread block below, which
		// comes back exact.
		await expect(page.getByTestId('live-anchor-width')).toHaveText('anchor width: 13/quote=12');

		// NOT ASSERTED, deliberately: `setState(getState())` is not a fixed point
		// on `value` — the restored document usually comes back with a trailing
		// newline the captured one did not have (90 characters in, 91 out). The
		// page renders that as `live-value-trailing-newlines`, but whether the
		// editor re-serializes at all depends on how quickly the previous restore
		// settled, so the observable flips between 0 and 1 across otherwise
		// identical runs. Pinning it would buy a flaky test; it is called out
		// here so a reader knows the round-trip is not byte-stable.
	});

	test('restoring the same threads into a shifted document moves the anchor with the quote', async () => {
		const anchorRange = page.getByTestId('live-anchor-range');
		await expect(anchorRange).toHaveText('anchor range: 1-14');

		await page.getByTestId('restore-shifted').click();

		// Same persisted threads, a document that grew a preface ahead of them.
		// Nothing in the state says where the quote now lives, so the only way
		// the anchor can follow it is by searching for the quote.
		await expect(page.getByTestId('live-value-has-preface')).toHaveText('contains "Preface": true');
		await expect(anchorRange).not.toHaveText('anchor range: 1-14');
		await expect(page.getByTestId('live-anchor-quote')).toHaveText('anchor quote: Release Plan');
		await expect(anchorDecorations(page, 'state-editor')).toHaveText(['Release Plan']);
		// Width is unchanged, so the anchor translated rather than stretched.
		await expect(page.getByTestId('live-anchor-width')).toHaveText('anchor width: 13/quote=12');
	});

	test('setState is the only reachable writer for the bindable `original`', async () => {
		// Put the document back first, so the only variable in this test is the
		// baseline.
		await page.getByTestId('restore-state').click();
		await expect(page.getByTestId('live-value-has-preface')).toHaveText(
			'contains "Preface": false'
		);

		const originalLength = page.getByTestId('live-original-length');
		await expect(originalLength).toHaveText('original length: 74');

		await page.getByTestId('restore-new-original').click();

		// `original` is declared `$bindable` and the published wrapper type lists
		// it among the bindable props, but no user interaction changes it: the
		// editor edits `value`, never the baseline. `setState({ original })` is
		// the single code path that writes it, and it only writes when the
		// incoming state's `original` is not undefined.
		await expect(originalLength).toHaveText('original length: 104');
	});

	test('getState() stamps schemaVersion 4 over whatever setState was handed', async () => {
		await page.getByTestId('restore-v1').click();

		// The ReviewState type declares `1 | 2 | 3 | 4` and the doc comment lists
		// what each version added, but nothing in the package reads the field:
		// there is no migration, and getState() writes 4 unconditionally. Feeding
		// a v1 state in and reading a v4 state straight back out is the whole
		// lifecycle of that field.
		await expect(page.getByTestId('schema-version-after-restore')).toHaveText(
			'schemaVersion after restoring a v1 state: 4'
		);
		// The restore also put `original` back, confirming the previous test's
		// write was a real prop change and not a one-way readout.
		await expect(page.getByTestId('live-original-length')).toHaveText('original length: 74');
	});
});

test.describe.serial('review-state-and-session: modules the component does not consume', () => {
	// A separate page from the block above, which mutates the editor's threads
	// and content — `createReviewEditorState`'s derived values read the same
	// props, so they would be dragged along with it.
	let page: Page;

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		await gotoHydrated(page, ROUTE);
		await expect(editorContainer(page, 'state-editor')).toHaveAttribute('data-ready', 'true');
		await expect(editorContainer(page, 'state-persisted')).toHaveAttribute('data-ready', 'true');
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('createReviewEditorState derives the same numbers the editor shows', async () => {
		// The read-only half agrees, because both the standalone instance and
		// the one the editor builds internally are pure functions of
		// original/value/threads.
		await expect(page.getByTestId('module-comment-count')).toHaveText('commentCount: 1');
		await expect(page.getByTestId('module-has-changes')).toHaveText('hasContentChanges: true');
		await expect(
			editorContainer(page, 'state-editor').getByRole('button', { name: /comments sidebar/ })
		).toHaveAccessibleName('Open comments sidebar (1 comment)');
	});

	test("createReviewEditorState's setters control nothing in a rendered ReviewEditor", async () => {
		const container = editorContainer(page, 'state-editor');
		const editorTab = container.getByRole('tab', { name: 'Editor' });
		const diffTab = container.getByRole('tab', { name: 'Diff' });

		await expect(editorTab).toHaveAttribute('aria-selected', 'true');
		await expect(container).toHaveAttribute('data-view', 'editor');

		await page.getByTestId('module-set-diff-view').click();
		await page.getByTestId('module-set-diff-mode').click();

		// The module's own state moves…
		await expect(page.getByTestId('module-active-view')).toHaveText('activeView: diff');
		await expect(page.getByTestId('module-diff-view-mode')).toHaveText('diffViewMode: original');

		// …and the editor does not. `createReviewEditorState` is exported from
		// `@lostgradient/editor/review-editor`, is fully reactive, and is wired
		// to nothing: the component constructs its own instance internally and
		// takes no prop, callback, or context through which an external one
		// could be injected. Driving it is a no-op on the rendered surface.
		await expect(editorTab).toHaveAttribute('aria-selected', 'true');
		await expect(diffTab).toHaveAttribute('aria-selected', 'false');
		await expect(container).toHaveAttribute('data-view', 'editor');
	});

	test('a PersistedThread[] seeded through bind:threads is re-anchored and written back', async () => {
		const container = editorContainer(page, 'state-persisted');

		// The fixture is `PersistedThread[]` converted through `toRuntimeThreads`:
		// anchors with quote/prefix/suffix/status and a neutral 0/0 from/to
		// sentinel — the exported converter for restoring threads from storage.
		//
		// The plugin verifies a seeded anchor against the document instead of
		// trusting its numbers, so a missing range triggers re-anchoring: both
		// threads get a decoration on exactly their quote, and the recovered
		// positions are written back into the bindable array.
		await expect(anchorDecorations(page, 'state-persisted')).toHaveText([
			'Release Plan',
			'export actions'
		]);
		await expect(page.getByTestId('persisted-thread-count')).toHaveText('threads: 2');
		await expect(container.getByRole('button', { name: /comments sidebar/ })).toHaveAccessibleName(
			'Open comments sidebar (2 comments)'
		);

		// from/to now exist on the seeded anchors — they did not when the array
		// was handed in. `originalQuote` is NOT synthesized, so a restored thread
		// permanently loses the record of what was first selected.
		await expect(page.getByTestId('persisted-anchor-keys')).toHaveText(
			'seeded anchor keys: from,lastKnownOffset,prefix,quote,status,suffix,to'
		);
	});

	test('the recovered range is exact mid-paragraph and one position wide at a block boundary', async () => {
		// PINNED KNOWN BUG (wrong but real; described here rather than tagged,
		// since no upstream issue tracks it and `check:upstream` scans for real
		// issue numbers): re-anchoring should hand back a range exactly as wide
		// as the quote. It does for "export actions", which sits inside a
		// paragraph — 14 positions for 14 characters. It does not for "Release
		// Plan", which ends where the heading block ends: 13 positions for 12
		// characters, because the quote's trailing `textBetween` offset is the
		// block separator and maps to the position after the block closes.
		//
		// This is invisible in the UI — ProseMirror clips inline decorations to
		// text nodes, so both highlights cover exactly their quote — and it is
		// invisible to the anchor plugin too, which re-verifies with the same
		// `textBetween` call that produced the range. It surfaces only when a
		// consumer reads `anchor.to` and expects `from + quote.length`.
		await expect(page.getByTestId('persisted-anchor-widths')).toHaveText(
			'Release Plan:width=13/quote=12 export actions:width=14/quote=14'
		);
	});

	test('the session module is pure: no generated ids, no generated timestamps, clamped updatedAt', async () => {
		// Every mutator takes the timestamp from the caller and returns
		// `{ session, changed }`. `getDraftCounts` splits drafts by shape —
		// anchor-and-no-threadId creates a thread, threadId-and-no-anchor is a
		// reply.
		await expect(page.getByTestId('session-counts')).toHaveText('threads=1 replies=1 total=2');

		// `addDraftComment` clamps: a comment created BEFORE the session started
		// must not drag the session's `updatedAt` backwards. Both timestamps here
		// are page inputs — the behavior under test is which of the two wins.
		await expect(page.getByTestId('session-clamp')).toHaveText(
			'session-updatedAt=2026-08-11T09:00:00.000Z comment-createdAt=2026-08-11T08:00:00.000Z'
		);
	});

	test('no-op session updates return changed:false AND the identical object reference', async () => {
		// The identity half matters more than the flag: because the same object
		// comes back, assigning the result into `$state` will not even wake a
		// reactive read. A consumer can ignore `changed` and still not thrash.
		await expect(page.getByTestId('session-same-outcome')).toHaveText(
			'changed=false same-reference=true'
		);
		await expect(page.getByTestId('session-missing-draft')).toHaveText(
			'changed=false same-reference=true'
		);
		await expect(page.getByTestId('session-missing-update')).toHaveText(
			'changed=false same-reference=true'
		);
		// Re-submitting keeps the FIRST outcome — `submitSession` bails on an
		// already-submitted session, so the second call's 'approve' is discarded
		// rather than overwriting 'request_changes'.
		await expect(page.getByTestId('session-resubmitted')).toHaveText(
			'changed=false outcome=request_changes same-reference=true'
		);
	});

	test('clearing an outcome removes the key rather than setting it to undefined', async () => {
		// Both `clearReviewOutcome` and `clearSession` destructure `outcome` away,
		// so the key is gone from the object — which is what keeps it out of the
		// persisted JSON later, and why `'outcome' in session` is a meaningful
		// test on a cleared session.
		await expect(page.getByTestId('session-cleared-outcome')).toHaveText(
			'changed=true keys=draftComments,id,startedAt,status,updatedAt'
		);
		await expect(page.getByTestId('session-cleared')).toHaveText(
			'changed=true drafts=0 keys=draftComments,id,startedAt,status,updatedAt'
		);
		await expect(page.getByTestId('session-submitted')).toHaveText(
			'changed=true status=submitted outcome=request_changes submittedAt=2026-08-11T11:00:00.000Z'
		);
	});

	test('validateSessionSchema rejects null outcomes and unknown enums, but waves through extra keys', async () => {
		// `outcome: null` fails where `outcome: undefined` passes — a distinction
		// that bites anyone whose serializer writes nulls for absent optionals.
		// Unknown keys (including `schemaVersion`) are accepted for forward
		// compatibility, and then dropped: `fromPersistedSession` copies a fixed
		// field list, so anything extra is silently discarded on the way back in.
		await expect(page.getByTestId('validate-matrix')).toHaveText(
			'base=true outcome-undefined=true outcome-null=false outcome-unknown=false outcome-approve=true status-archived=false status-submitted=true no-draftComments=false extra-keys=true not-an-object=false'
		);
		// `schemaVersion: 99` survives validation and then vanishes: the restored
		// session's keys do not include it.
		await expect(page.getByTestId('versioned-accepted')).toHaveText(
			'validates=true restored-keys=draftComments,id,startedAt,status,updatedAt'
		);
	});

	test('schemaVersion is write-only: 1, 4 and an out-of-range 99 export byte-identically', async () => {
		// Nothing in the published package reads the field and no migration
		// exists, so the three exports that take a ReviewState produce identical
		// bytes at every version, with no warning about the out-of-range one.
		await expect(page.getByTestId('schema-version-matrix')).toHaveText(
			'summary=identical diff=identical comments=identical'
		);
	});
});

test.describe.serial('review-state-and-session: sessionStorage persistence', () => {
	// Serial and single-page: sessionStorage is shared across the whole
	// document, so ordering is part of what is under test. Every case owns a
	// distinct document key, and the first test resets the store.
	let page: Page;
	const consoleMessages: string[] = [];

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		// Attached before navigation: `loadSession`'s three destructive paths log
		// on the way out, and the messages are gone by the time a post-load hook
		// could subscribe.
		page.on('console', (message) => consoleMessages.push(`${message.type()}: ${message.text()}`));
		await gotoHydrated(page, ROUTE);
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('the storage key is the exported prefix plus the document id', async () => {
		await expect(page.getByTestId('storage-prefix')).toHaveText(
			'STORAGE_KEY_PREFIX: review-session-'
		);
		await expect(page.getByTestId('storage-key')).toHaveText(
			'getStorageKey: review-session-sess-basic'
		);
	});

	test('saving strips runtime anchor positions and omits absent optionals entirely', async () => {
		await page.getByTestId('clear-all-storage').click();
		await page.getByTestId('save-basic').click();

		await expect(page.getByTestId('save-result')).toHaveText('saveSession returned: true');

		// No `outcome`, no `submittedAt`: `toPersistedSession` copies optionals
		// only when defined, so they are absent keys rather than serialized
		// nulls — which is exactly what `validateSessionSchema` requires on the
		// way back in, since it rejects an explicit null outcome.
		await expect(page.getByTestId('stored-top-level-keys')).toHaveText(
			'stored keys: draftComments,id,startedAt,status,updatedAt'
		);
		// The draft's anchor keeps its quote context and loses its positions.
		await expect(page.getByTestId('stored-anchor-keys')).toHaveText(
			'stored anchor keys: lastKnownOffset,originalQuote,prefix,quote,status,suffix'
		);
		await expect(page.getByTestId('stored-anchor-from-to')).toHaveText(
			'from-key=false to-key=false'
		);
	});

	test('loading restores anchors at 0/0 placeholders and leaves the stored bytes in place', async () => {
		await page.getByTestId('load-basic').click();

		// `fromPersistedDraftComment` writes literal zeroes and documents them as
		// placeholders: "caller must re-anchor". Nothing in the module does it
		// for you, and nothing in `ReviewEditor` accepts a session to do it with
		// — a consumer has to call `reanchorQuote` themselves.
		await expect(page.getByTestId('loaded-anchor-from-to')).toHaveText('from=0 to=0');
		// Everything else round-trips verbatim.
		await expect(page.getByTestId('loaded-round-trip')).toHaveText(
			'id=session-basic status=drafting drafts=1 quote=Release Plan authorId=maya createdAt=2026-08-11T10:00:00.000Z'
		);
		// A successful load is non-destructive — only the three failure paths
		// below delete.
		await expect(page.getByTestId('has-after-load')).toHaveText('hasPersistedSession: true');
	});

	test('loadSession destroys the stored bytes on all three failure paths', async () => {
		// The load-bearing assertion is the destruction, not the log line: each
		// case stores something, loads null, and finds the key gone afterwards.
		await page.getByTestId('load-submitted').click();
		await expect(page.getByTestId('load-submitted-result')).toHaveText(
			'stored-before=true loaded=null stored-after=false'
		);

		await page.getByTestId('load-bad-json').click();
		await expect(page.getByTestId('load-bad-json-result')).toHaveText(
			'stored-before=true loaded=null stored-after=false'
		);

		await page.getByTestId('load-bad-shape').click();
		await expect(page.getByTestId('load-bad-shape-result')).toHaveText(
			'stored-before=true loaded=null stored-after=false'
		);

		// The three paths are distinguishable only by their console output — the
		// return value is `null` for all of them, so a consumer cannot tell "no
		// session" from "your session was just deleted". Polled rather than read
		// straight, because console events arrive on their own schedule.
		const sawMessage = (fragment: string) =>
			expect.poll(() => consoleMessages.some((entry) => entry.includes(fragment))).toBe(true);

		await sawMessage('Clearing stale submitted review session');
		await sawMessage('Failed to load review session:');
		await sawMessage('Review session schema validation failed, clearing corrupted data');
	});

	test('listPersistedSessions strips the prefix, and clearAll empties the store', async () => {
		await page.getByTestId('list-sessions').click();

		// Document identifiers, not storage keys. `sess-basic` is still listed
		// because the successful load above did not delete it; the three failure
		// keys are absent because their loads did.
		await expect(page.getByTestId('session-list')).toHaveText(
			'listPersistedSessions: sess-a,sess-b,sess-basic'
		);

		await page.getByTestId('clear-all-sessions').click();
		// Checked twice over: through the module, and by counting prefixed keys
		// straight out of sessionStorage.
		await expect(page.getByTestId('list-after-clear-all')).toHaveText('count=0 raw-keys=0');
	});

	test('the persistence module reads sessionStorage once mounted in a browser', async () => {
		// The post-hydration counterpart to the SSR assertion below: the same
		// calls that short-circuit on the server do reach storage in the browser.
		await expect(page.getByTestId('browser-storage-probe')).toHaveText(
			'saveSession=true listed=true'
		);
	});
});

test('review-state-and-session: the session modules run during SSR without throwing', async ({
	request
}) => {
	// `review-ssr-and-a11y` owns SSR generally; this is the one assertion this
	// route needs — that importing and CALLING the persistence module on the
	// server neither throws nor 500s, and that its browser guard returns the
	// documented defaults rather than reaching for sessionStorage.
	const response = await request.get(ROUTE);
	expect(response.status()).toBe(200);
	const html = await response.text();

	expect(html).toContain(
		'threw=false loadSession=null hasPersistedSession=false listed-is-array=true'
	);

	// The pure half of the session module renders its real results server-side,
	// which is what proves the module evaluated rather than merely imported.
	expect(html).toContain('threads=1 replies=1 total=2');
	expect(html).toContain('summary=identical diff=identical comments=identical');
	expect(html).toContain('outcome-null=false');
	expect(html).toContain('review-session-sess-basic');

	// The browser-only probe renders its placeholder on the server. It is
	// deliberately deferred to a post-hydration effect rather than computed at
	// init: `saveSession` returns false on the server and true in the browser,
	// so rendering it from init would manufacture a hydration divergence on
	// this route just to assert it.
	expect(html).toContain('(not yet run)');
});

<script lang="ts">
	import { ReviewEditor, type Thread } from '@lostgradient/editor/review-editor';

	// The SSR / hydration / accessibility surface of ReviewEditor, deliberately
	// reduced to ONE editor instance. The assertions this page exists to support
	// — "how many aria-live regions ship per editor", "what does a full Tab walk
	// through the composed surface look like", "which ids exist after
	// hydration" — are only meaningful when nothing else on the page contributes
	// live regions, tab stops, or `-editor`-suffixed ids. Adding a second
	// instance here would silently invalidate half the spec.
	//
	// Everything on this page is also chosen so the *no-JavaScript* rendering is
	// assertable: the seeded comment body is a sentinel string that appears
	// NOWHERE in the page's own markup, so a search of `body.innerText` for it
	// is a true test of whether the component leaked review content into the
	// pre-hydration DOM.

	const original = `# Release Plan

The first release includes a dashboard and export actions.

## Checklist

- Finalize the component API
- Add playground coverage`;

	// Deliberately different from `original`: several assertions need
	// `hasContentChanges` to be true, because the "Revert all changes" control
	// (and therefore the `All changes reverted` announcement) only renders in
	// the diff view when the document actually differs from its baseline.
	let value = $state(`# Release Plan

The first release includes a dashboard, export actions, and inline review.

## Checklist

- Finalize the component API
- Add playground coverage
- Document review export behavior`);

	// `from`/`to` are PROSEMIRROR POSITIONS, not raw-markdown indices and not
	// `doc.textBetween()` offsets. The heading's "# " is markup rather than
	// text, so the first text position is 1 and the 12-character quote
	// "Release Plan" occupies 1..13. Getting this wrong no longer produces a
	// bogus whole-document highlight — the editor now treats a quote that isn't
	// actually at its stated range as a re-anchoring request — but it would
	// still move the anchor out from under the popover tests below.
	//
	// `lastKnownOffset` lives in the OTHER coordinate space (a
	// `textBetween()` offset) inside the same object; 0 is correct for a quote
	// that starts at the very beginning of the document text.
	const SENTINEL_COMMENT_BODY = 'SENTINEL comment body';

	// The single seeded comment is authored by `maya`, NOT by `currentUserId`
	// ("steve"). That is load-bearing, not decoration: CommentList only renders
	// its "Edit comment" / "Delete comment" buttons for comments the current
	// user wrote, so an author of `steve` would add two more tabbable controls
	// inside the thread popover and change the focus-trap cycle the spec pins.
	let threads = $state<Thread[]>([
		{
			id: 'thread-a11y-title',
			createdAt: '2026-08-11T12:00:00.000Z',
			anchor: {
				from: 1,
				to: 13,
				quote: 'Release Plan',
				prefix: '# ',
				suffix: '\n\nThe first release',
				status: 'anchored',
				originalQuote: 'Release Plan',
				lastKnownOffset: 0
			},
			comments: [
				{
					id: 'comment-a11y-title',
					threadId: 'thread-a11y-title',
					authorId: 'maya',
					body: SENTINEL_COMMENT_BODY,
					createdAt: '2026-08-11T12:00:00.000Z'
				}
			]
		}
	]);

	// Notification-only, exactly like the baseline route: the component owns
	// mutation through the bindable props, so the log is the only evidence a
	// callback fired. Entries record IDS AND COUNTS, never comment bodies — the
	// no-JS assertion searches the rendered text for the sentinel, and echoing
	// it here would make that assertion pass for the wrong reason.
	let events = $state<string[]>([]);
	const record = (entry: string) => {
		events = [...events, entry];
	};
</script>

<div style="max-width: 72rem; margin: 0 auto; padding: 1rem; display: grid; gap: 1.5rem;">
	<section style="display: grid; gap: 0.5rem;">
		<h2 style="margin: 0;">SSR, hydration, and accessibility</h2>

		<!--
			A deterministic starting point for the Tab-order walk. Playwright's
			`page.keyboard.press('Tab')` starts from whatever currently holds focus,
			and a fresh page's `document.activeElement` is `<body>` — from there the
			first Tab lands on the first focusable element in the document, which
			would already be inside the editor. Focusing this button first gives the
			walk a named origin that is unambiguously OUTSIDE the component.
		-->
		<div>
			<button type="button" data-testid="tab-order-start">Start of tab order</button>
		</div>

		<div style="min-height: 34rem;">
			<ReviewEditor
				id="a11y-editor"
				{original}
				bind:value
				bind:threads
				currentUserId="steve"
				name="review"
				placeholder="Start reviewing…"
				onchange={(next) => record(`change:${next.length}`)}
				onthreadcreate={(event) => record(`threadcreate:${event.authorId}`)}
				onthreaddelete={(event) => record(`threaddelete:${event.threadId}`)}
				oncommentcreate={(event) => record(`commentcreate:${event.threadId}`)}
				oncommentupdate={(event) => record(`commentupdate:${event.commentId}`)}
				oncommentdelete={(event) => record(`commentdelete:${event.commentId}:soft=${event.soft}`)}
			/>
		</div>

		<!--
			The mirror of `tab-order-start`, and it earns its place for the same
			reason. Tabbing forward out of the editor used to run off the end of the
			document, where engines disagree: Chromium parks on `<body>` and wraps on
			the next press, while Firefox hands focus to the browser chrome and the
			test can no longer see it. Giving the exit somewhere real to land makes
			the assertion NAME the element focus reached instead of asserting the
			absence of one — stricter, and the same in every engine.
		-->
		<div>
			<button type="button" data-testid="tab-order-end">End of tab order</button>
		</div>
	</section>

	<section style="display: grid; gap: 0.5rem;">
		<h2 style="margin: 0; font-size: 1rem;">Observed state</h2>
		<p data-testid="value-length" style="margin: 0;">value length: {value.length}</p>
		<p data-testid="thread-count" style="margin: 0;">threads: {threads.length}</p>
		<p data-testid="comment-count" style="margin: 0;">
			comments: {threads.reduce((total, thread) => total + thread.comments.length, 0)}
		</p>
		<ul data-testid="event-log" style="margin: 0; padding-left: 1.25rem;">
			{#each events as entry, index (`${index}-${entry}`)}
				<li>{entry}</li>
			{/each}
		</ul>
	</section>
</div>

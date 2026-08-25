<script lang="ts">
	import { ReviewEditor, type Thread } from '@lostgradient/editor/review-editor';

	// The baseline ReviewEditor surface: a document with a baseline `original`,
	// an edited `value`, and one seeded anchored thread. Everything else in the
	// review-editor exercises builds on this shape, so it deliberately stays
	// small — the point is to pin that the composed surface (toolbar, editor,
	// sidebar) mounts, hydrates, and round-trips its two bindable props.

	const original = `# Release Plan

The first release includes a dashboard and export actions.

## Checklist

- Finalize the component API
- Add playground coverage`;

	let value = $state(`# Release Plan

The first release includes a dashboard, export actions, and inline review.

## Checklist

- Finalize the component API
- Add playground coverage
- Document review export behavior`);

	// `from`/`to` are PROSEMIRROR POSITIONS, not raw-markdown indices and not
	// `doc.textBetween()` offsets — an undocumented distinction worth stating
	// here because nothing warns when you get it wrong. The heading's "# " is
	// markup rather than text, so the document's first text position is 1 and
	// the 12-character quote "Release Plan" occupies 1..13.
	//
	// `prefix`/`suffix` are what re-anchoring uses when the surrounding text
	// shifts, so they have to match the document rather than be plausible.
	let threads = $state<Thread[]>([
		{
			id: 'thread-release-plan-title',
			createdAt: '2026-08-11T12:00:00.000Z',
			anchor: {
				from: 1,
				to: 13,
				quote: 'Release Plan',
				prefix: '# ',
				suffix: '\n\nThe first release',
				status: 'anchored',
				originalQuote: 'Release Plan',
				// A textBetween() offset, NOT a ProseMirror position — the two
				// coordinate spaces sit side by side in the same object.
				lastKnownOffset: 0
			},
			comments: [
				{
					id: 'comment-release-plan-title',
					threadId: 'thread-release-plan-title',
					authorId: 'maya',
					body: 'Title reads well — keep it.',
					createdAt: '2026-08-11T12:00:00.000Z'
				}
			]
		}
	]);

	// Callback log: the props are notification-only (the component owns the
	// mutation through the bindable props), so the log is the only way to
	// observe that they fire at all and in what order.
	let events = $state<string[]>([]);
	const record = (entry: string) => {
		events = [...events, entry];
	};
</script>

<div style="max-width: 72rem; margin: 0 auto; padding: 1rem; display: grid; gap: 1.5rem;">
	<section style="display: grid; gap: 0.5rem;">
		<h2 style="margin: 0;">Baseline review editor</h2>
		<div style="min-height: 34rem;">
			<ReviewEditor
				id="review-basics-editor"
				{original}
				bind:value
				bind:threads
				currentUserId="steve"
				name="review"
				placeholder="Start reviewing…"
				onchange={(next) => record(`change:${next.length}`)}
				onthreadcreate={(event) => record(`threadcreate:${event.authorId}:${event.body}`)}
				onthreaddelete={(event) => record(`threaddelete:${event.threadId}`)}
				oncommentcreate={(event) => record(`commentcreate:${event.threadId}:${event.body}`)}
				oncommentupdate={(event) => record(`commentupdate:${event.commentId}:${event.body}`)}
				oncommentdelete={(event) => record(`commentdelete:${event.commentId}:soft=${event.soft}`)}
			/>
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

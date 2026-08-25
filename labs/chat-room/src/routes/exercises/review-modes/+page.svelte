<script lang="ts">
	import { ReviewEditor, type ReviewMode, type Thread } from '@lostgradient/editor/review-editor';

	// Review modes and identity gating.
	//
	// Everything on this page is a PROP MATRIX: the same document and the same
	// seeded thread rendered seven times, varying only `mode`, `currentUserId`,
	// `snapshotMode`, `placeholder`, and `class`. Side-by-side instances are the
	// point — most of these behaviors are only legible as a difference ("readonly
	// withholds X while edit renders it"), and a single instance whose props flip
	// mid-test would confound the two.
	//
	// Two props gate almost everything:
	//
	//   `mode`          — enforcement. Only the exact string `readonly` disables
	//                     the editor. `data-mode` echoes whatever you pass, so it
	//                     is a REFLECTION hook, not the enforcement mechanism.
	//   `currentUserId` — identity, with THREE meaningful states rather than two:
	//                     set, empty string, and omitted. The component tests
	//                     `!== undefined` in one place and truthiness in another,
	//                     so `""` lands between them: the UI offers the
	//                     affordance and the submit path then refuses it.
	//
	// Nothing here needs the diff internals, the anchoring machinery, or the
	// export payloads — those live in sibling review-* exercises. `review-views`
	// owns the full Revert All gate; this route only shows that readonly is one
	// third of it.

	const original = `# Release Plan

The first release includes a dashboard and export actions.

## Checklist

- Finalize the component API
- Add playground coverage`;

	const edited = `# Release Plan

The first release includes a dashboard, export actions, and inline review.

## Checklist

- Finalize the component API
- Add playground coverage
- Document review export behavior`;

	// One seeded thread, cloned per instance so the bindable arrays never alias.
	//
	// `from`/`to` are PROSEMIRROR POSITIONS: "# " is markup rather than text, so
	// the document's first text position is 1 and the 12-character quote
	// "Release Plan" occupies 1..13. `lastKnownOffset` is a `textBetween()`
	// offset — a DIFFERENT coordinate space living in the same object, which is
	// why it is 0 for that same quote. Getting these wrong is not cosmetic: an
	// anchor whose quote is not actually at its stated range triggers
	// re-anchoring instead of decorating, so the thread would silently move or
	// vanish before any assertion ran.
	//
	// `authorId` matches the `currentUserId` handed to the edit and readonly
	// instances on purpose: `Edit comment` and `Delete comment` render only for
	// a comment's own author, so an author mismatch would make readonly's
	// "those buttons are gone" assertions vacuous.
	function seedThreads(): Thread[] {
		return [
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
					lastKnownOffset: 0
				},
				comments: [
					{
						id: 'comment-release-plan-title',
						threadId: 'thread-release-plan-title',
						authorId: 'steve',
						body: 'Title reads well — keep it.',
						createdAt: '2026-08-11T12:00:00.000Z'
					}
				]
			}
		];
	}

	// `mode` is typed `'edit' | 'readonly'`, but the component never validates it
	// — it only compares against the two strings it knows about. Passing a third
	// value is the cleanest way to show that `data-mode` reflects rather than
	// enforces, and that the two comparisons are independent: `readonly` is what
	// disables editing, `edit` is what enables comment creation, and a value that
	// is neither gets an editable document with no way to comment on it. The
	// widening cast is required because TypeScript refuses a direct assertion
	// between two non-overlapping string literal types.
	const exoticMode = 'suggest' as string as ReviewMode;

	let editValue = $state(edited);
	let editThreads = $state<Thread[]>(seedThreads());

	let readonlyValue = $state(edited);
	let readonlyThreads = $state<Thread[]>(seedThreads());

	let nouserValue = $state(edited);
	let nouserThreads = $state<Thread[]>(seedThreads());

	let emptyuserValue = $state(edited);
	let emptyuserThreads = $state<Thread[]>(seedThreads());

	let snapshotValue = $state(edited);
	let plainValue = $state('');
	let exoticValue = $state(edited);

	// The thread and comment callbacks are notification-only — the component owns
	// the bindable props and never applies these itself. Counting them is the
	// only way to prove that a gated path fired ZERO events rather than merely
	// looking inert, which is what most of the `currentUserId` assertions turn
	// on: an affordance that renders, accepts input, and then quietly drops the
	// submission is indistinguishable from a working one without this log.
	const eventLog = $state<Record<string, string[]>>({
		'modes-edit': [],
		'modes-readonly': [],
		'modes-nouser': [],
		'modes-emptyuser': [],
		'modes-snapshot': [],
		'modes-plain': [],
		'modes-exotic': []
	});

	function record(key: string, entry: string) {
		eventLog[key] = [...eventLog[key], entry];
	}

	function countOf(key: string, prefix: string): number {
		return eventLog[key].filter((entry) => entry.startsWith(prefix)).length;
	}
</script>

<!--
	The document is mirrored as JSON rather than as raw markdown on purpose:
	Playwright's `toHaveText` collapses whitespace, so a multi-line document
	compared as visible text could not tell "unchanged" from "re-wrapped".
	`JSON.stringify` flattens every newline to a literal `\n`, producing one line
	with no whitespace runs — which survives that normalization byte for byte.
-->
{#snippet observed(key: string, current: string)}
	<div style="display: grid; gap: 0.25rem; font-size: 0.8rem;">
		<p data-testid="{key}-value-length" style="margin: 0;">value length: {current.length}</p>
		<p
			data-testid="{key}-value-json"
			style="margin: 0; overflow-wrap: anywhere; font-family: monospace;"
		>
			{JSON.stringify(current)}
		</p>
		<p data-testid="{key}-threadcreate-count" style="margin: 0;">
			threadcreate: {countOf(key, 'threadcreate')}
		</p>
		<p data-testid="{key}-event-count" style="margin: 0;">events: {eventLog[key].length}</p>
		<ul data-testid="{key}-event-log" style="margin: 0; padding-left: 1.25rem;">
			{#each eventLog[key] as entry, index (`${index}-${entry}`)}
				<li>{entry}</li>
			{/each}
		</ul>
	</div>
{/snippet}

<div style="max-width: 72rem; margin: 0 auto; padding: 1rem; display: grid; gap: 2rem;">
	<!--
		Every instance is wrapped in its own `*-frame` testid because the
		component's container carries `data-testid="review-editor"` and NO id —
		the `id` prop lands on the inner markdown editor host instead. Scoping
		through `#<id>` therefore breaks the moment a test leaves the editor view:
		the diff and summary views unmount that host entirely, taking the id with
		them, while the frame stays put.
	-->
	<section style="display: grid; gap: 0.5rem;" data-testid="modes-edit-frame">
		<h2 style="margin: 0;">
			edit + currentUserId (the baseline every other instance differs from)
		</h2>
		<div style="min-height: 30rem;">
			<ReviewEditor
				id="modes-edit"
				{original}
				bind:value={editValue}
				bind:threads={editThreads}
				mode="edit"
				currentUserId="steve"
				onchange={(next) => record('modes-edit', `change:${next.length}`)}
				onthreadcreate={(event) =>
					record('modes-edit', `threadcreate:${event.authorId}:${event.body}`)}
				onthreaddelete={(event) => record('modes-edit', `threaddelete:${event.threadId}`)}
				oncommentcreate={(event) => record('modes-edit', `commentcreate:${event.threadId}`)}
			/>
		</div>
		{@render observed('modes-edit', editValue)}
	</section>

	<section style="display: grid; gap: 0.5rem;" data-testid="modes-readonly-frame">
		<h2 style="margin: 0;">mode="readonly" — same document, same user, same seeded thread</h2>
		<div style="min-height: 30rem;">
			<ReviewEditor
				id="modes-readonly"
				{original}
				bind:value={readonlyValue}
				bind:threads={readonlyThreads}
				mode="readonly"
				currentUserId="steve"
				onchange={(next) => record('modes-readonly', `change:${next.length}`)}
				onthreadcreate={(event) =>
					record('modes-readonly', `threadcreate:${event.authorId}:${event.body}`)}
				onthreaddelete={(event) => record('modes-readonly', `threaddelete:${event.threadId}`)}
				oncommentcreate={(event) => record('modes-readonly', `commentcreate:${event.threadId}`)}
			/>
		</div>
		{@render observed('modes-readonly', readonlyValue)}
	</section>

	<section style="display: grid; gap: 0.5rem;" data-testid="modes-nouser-frame">
		<h2 style="margin: 0;">edit, currentUserId OMITTED — an anonymous reviewer</h2>
		<div style="min-height: 30rem;">
			<ReviewEditor
				id="modes-nouser"
				{original}
				bind:value={nouserValue}
				bind:threads={nouserThreads}
				mode="edit"
				onchange={(next) => record('modes-nouser', `change:${next.length}`)}
				onthreadcreate={(event) =>
					record('modes-nouser', `threadcreate:${event.authorId}:${event.body}`)}
				onthreaddelete={(event) => record('modes-nouser', `threaddelete:${event.threadId}`)}
				oncommentcreate={(event) => record('modes-nouser', `commentcreate:${event.threadId}`)}
			/>
		</div>
		{@render observed('modes-nouser', nouserValue)}
	</section>

	<section style="display: grid; gap: 0.5rem;" data-testid="modes-emptyuser-frame">
		<h2 style="margin: 0;">edit, currentUserId="" — the third state between set and omitted</h2>
		<div style="min-height: 30rem;">
			<ReviewEditor
				id="modes-emptyuser"
				{original}
				bind:value={emptyuserValue}
				bind:threads={emptyuserThreads}
				mode="edit"
				currentUserId=""
				onchange={(next) => record('modes-emptyuser', `change:${next.length}`)}
				onthreadcreate={(event) =>
					record('modes-emptyuser', `threadcreate:${event.authorId}:${event.body}`)}
				onthreaddelete={(event) => record('modes-emptyuser', `threaddelete:${event.threadId}`)}
				oncommentcreate={(event) => record('modes-emptyuser', `commentcreate:${event.threadId}`)}
			/>
		</div>
		{@render observed('modes-emptyuser', emptyuserValue)}
	</section>

	<section style="display: grid; gap: 0.5rem;" data-testid="modes-snapshot-frame">
		<h2 style="margin: 0;">snapshotMode={true} — documented as "purely visual"</h2>
		<div style="min-height: 24rem;">
			<ReviewEditor
				id="modes-snapshot"
				bind:value={snapshotValue}
				currentUserId="steve"
				snapshotMode={true}
				onchange={(next) => record('modes-snapshot', `change:${next.length}`)}
				onthreadcreate={(event) =>
					record('modes-snapshot', `threadcreate:${event.authorId}:${event.body}`)}
			/>
		</div>
		{@render observed('modes-snapshot', snapshotValue)}
	</section>

	<section style="display: grid; gap: 0.5rem;" data-testid="modes-plain-frame">
		<h2 style="margin: 0;">
			snapshotMode={false}, empty document, custom placeholder, custom class
		</h2>
		<!--
			`exercise-frame` is a marker class with no styling of its own: the only
			thing under test is that ReviewEditor MERGES it onto the container
			rather than replacing `review-editor-container`. This page deliberately
			has no <style> block, so the only scoping hash on that container is the
			editor package's own.
		-->
		<div style="min-height: 24rem;">
			<ReviewEditor
				id="modes-plain"
				bind:value={plainValue}
				currentUserId="steve"
				snapshotMode={false}
				class="exercise-frame"
				placeholder="Start reviewing…"
				onchange={(next) => record('modes-plain', `change:${next.length}`)}
			/>
		</div>
		{@render observed('modes-plain', plainValue)}
	</section>

	<section style="display: grid; gap: 0.5rem;" data-testid="modes-exotic-frame">
		<h2 style="margin: 0;">mode="{exoticMode}" — a value outside the ReviewMode union</h2>
		<div style="min-height: 24rem;">
			<ReviewEditor
				id="modes-exotic"
				bind:value={exoticValue}
				mode={exoticMode}
				currentUserId="steve"
				onchange={(next) => record('modes-exotic', `change:${next.length}`)}
				onthreadcreate={(event) =>
					record('modes-exotic', `threadcreate:${event.authorId}:${event.body}`)}
			/>
		</div>
		{@render observed('modes-exotic', exoticValue)}
	</section>
</div>

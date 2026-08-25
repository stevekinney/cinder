<script lang="ts">
	import { ReviewEditor, type Thread } from '@lostgradient/editor/review-editor';
	import {
		addComment,
		addThread,
		generateId,
		timestamp,
		type CommentCreateEvent,
		type ThreadCreateEvent
	} from '@lostgradient/editor/comments';

	// Comment CREATION, end to end: how a thread gets made from a selection and
	// from the sidebar, and what a host application has to do with the resulting
	// event before anything appears on screen.
	//
	// The whole point of this route is that ReviewEditor's creation callbacks are
	// NOTIFICATION-ONLY. `onthreadcreate` does not add a thread — it hands you a
	// `ThreadCreateEvent` and leaves `threads` exactly as it was. The component
	// renders whatever is in the bindable `threads` array, so unless the host
	// applies the event, submitting a comment produces a fired callback, an empty
	// sidebar, and a very confused engineer. The `apply-events` checkbox below
	// toggles the host-side reducer so both halves of that contract are visible
	// on one page.
	//
	// Why the primary instance starts with ZERO threads: clicking anchored text
	// opens the THREAD popover, and a mouse drag that both starts and ends inside
	// an anchor decoration counts as a click on it — so a drag over commented text
	// can never produce a new thread. That collision gets its own second instance.

	// Two short paragraphs, deliberately: drag coordinates stay stable, and every
	// ProseMirror position in this file can be counted by hand.
	//
	// ProseMirror positions for this document, measured against a live editor by
	// selecting each paragraph and reading the resulting anchor:
	//   0        paragraph 1 opens
	//   1..42    "The dashboard ships in the first release." (41 characters)
	//   42       paragraph 1 closes
	//   43       paragraph 2 opens
	//   44..86   "Export actions land in the second release." (42 characters)
	//
	// Note the gap: paragraph 2's text starts at 44, not 43. Every node boundary
	// costs a position, which is exactly why these numbers cannot be derived from
	// the raw markdown string.
	const DOCUMENT = `The dashboard ships in the first release.

Export actions land in the second release.`;

	// ── Instance A: creation ────────────────────────────────────────────────
	let creationValue = $state(DOCUMENT);
	let creationThreads = $state<Thread[]>([]);

	// ── Instance B: the anchor/selection collision ──────────────────────────
	let collisionValue = $state(DOCUMENT);

	// `from`/`to` are PROSEMIRROR POSITIONS, not `textBetween()` offsets and not
	// raw-markdown indices. "The " occupies positions 1..5, so the 9-character
	// quote "dashboard" is 5..14. `lastKnownOffset` in the SAME object is a
	// `textBetween()` offset (4) — two coordinate spaces side by side, with
	// nothing to warn you when you conflate them.
	//
	// This has to be right: a seeded anchor whose quote is not actually at its
	// stated range is treated as drifted and sent through re-anchoring instead of
	// being decorated where you asked. (review-anchoring owns that contract in
	// detail; here the anchor only has to be correct enough to produce a real
	// decoration to collide with.)
	let collisionThreads = $state<Thread[]>([
		{
			id: 'collision-thread-dashboard',
			createdAt: '2026-08-11T12:00:00.000Z',
			anchor: {
				from: 5,
				to: 14,
				quote: 'dashboard',
				prefix: 'The ',
				suffix: ' ships in the first release.',
				status: 'anchored',
				originalQuote: 'dashboard',
				lastKnownOffset: 4
			},
			comments: [
				{
					id: 'collision-comment-dashboard',
					threadId: 'collision-thread-dashboard',
					authorId: 'maya',
					body: 'Is "dashboard" the shipping name?',
					createdAt: '2026-08-11T12:00:00.000Z'
				}
			]
		}
	]);

	// ── The host-side reducer ───────────────────────────────────────────────
	// `addThread` / `addComment` come from `@lostgradient/editor/comments`. They
	// are PURE: they take the current array plus a fully-formed Thread/Comment
	// and return `{ threads, changed }`. They generate no IDs and no timestamps —
	// that is what `generateId()` (a `crypto.randomUUID` when available) and
	// `timestamp()` are for. The event's `requestId` is NOT the thread id; it
	// exists to correlate an optimistic insert with a server response, so the
	// host mints its own id here.
	let applyEvents = $state(false);

	type LoggedEvent = { name: string; json: string };
	let events = $state<LoggedEvent[]>([]);
	const record = (name: string, payload: unknown) => {
		events = [...events, { name, json: JSON.stringify(payload) }];
	};

	// Rendered as text so the "is it `'text'` or is it missing?" question is
	// answerable from the page rather than from a debugger. `JSON.stringify`
	// silently drops `undefined` values, so the log alone cannot distinguish
	// "absent" from "present and undefined" — these readouts can.
	let lastAnchorType = $state('(none yet)');
	let lastMentions = $state('(none yet)');

	function describeMentions(event: ThreadCreateEvent | CommentCreateEvent): string {
		if (!('mentions' in event) || event.mentions === undefined) return '(absent)';
		return event.mentions.length === 0 ? '(empty array)' : event.mentions.join(',');
	}

	function handleThreadCreate(event: ThreadCreateEvent) {
		record('onthreadcreate', event);
		lastAnchorType = 'type' in event.anchor ? String(event.anchor.type) : '(absent)';
		lastMentions = describeMentions(event);

		if (!applyEvents) return;

		const threadId = generateId();
		const createdAt = timestamp();
		creationThreads = addThread(creationThreads, {
			id: threadId,
			createdAt,
			anchor: event.anchor,
			comments: [
				{
					id: generateId(),
					threadId,
					authorId: event.authorId,
					body: event.body,
					createdAt,
					mentions: event.mentions
				}
			]
		}).threads;
	}

	function handleCommentCreate(event: CommentCreateEvent) {
		record('oncommentcreate', event);
		lastMentions = describeMentions(event);
		if (!applyEvents) return;

		creationThreads = addComment(creationThreads, event.threadId, {
			id: generateId(),
			threadId: event.threadId,
			authorId: event.authorId,
			body: event.body,
			createdAt: timestamp(),
			mentions: event.mentions
		}).threads;
	}
</script>

<div style="max-width: 72rem; margin: 0 auto; padding: 1rem; display: grid; gap: 1.5rem;">
	<section style="display: grid; gap: 0.5rem;">
		<h2 style="margin: 0;">Review comment creation</h2>
		<p style="margin: 0; max-width: 60ch;">
			Every creation callback below is notification-only. Leave the checkbox unchecked to watch
			<code>onthreadcreate</code> fire while <code>threads</code> stays empty; check it to let the
			page's own <code>addThread</code>/<code>addComment</code> reducer apply the same events.
		</p>
		<label style="display: flex; gap: 0.5rem; align-items: center;">
			<input type="checkbox" data-testid="apply-events" bind:checked={applyEvents} />
			Apply creation events with addThread / addComment
		</label>
	</section>

	<section style="display: grid; gap: 0.5rem;">
		<h3 style="margin: 0; font-size: 1rem;">
			Anchor collision — a drag that stays inside a comment
		</h3>
		<p style="margin: 0; max-width: 60ch;">
			This instance seeds one thread on the word <em>dashboard</em>. Drag across it and the
			<em>thread</em> popover opens rather than the selection popover, because the drag also counts as
			a click on the anchor decoration.
		</p>
		<div data-testid="collision-host" style="min-height: 22rem;">
			<ReviewEditor
				id="creation-collision"
				bind:value={collisionValue}
				bind:threads={collisionThreads}
				mode="edit"
				currentUserId="steve"
				onthreadcreate={(event) => record('collision:onthreadcreate', event)}
			/>
		</div>
	</section>

	<section style="display: grid; gap: 0.5rem;">
		<h3 style="margin: 0; font-size: 1rem;">Observed state</h3>
		<p data-testid="thread-count" style="margin: 0;">threads: {creationThreads.length}</p>
		<p data-testid="comment-count" style="margin: 0;">
			comments: {creationThreads.reduce((total, thread) => total + thread.comments.length, 0)}
		</p>
		<p data-testid="last-anchor-type" style="margin: 0;">last anchor.type: {lastAnchorType}</p>
		<p data-testid="last-mentions" style="margin: 0;">last mentions: {lastMentions}</p>
		<ul data-testid="event-log" style="margin: 0; padding-left: 1.25rem;">
			{#each events as entry, index (index)}
				<li
					data-testid="event-entry"
					data-event={entry.name}
					data-json={entry.json}
					style="overflow-wrap: anywhere;"
				>
					<strong>{entry.name}</strong>
					<code>{entry.json}</code>
				</li>
			{/each}
		</ul>
	</section>

	<!--
		The creation instance is LAST on the page on purpose. The selection popover
		portals itself to the end of `document.body`, so it is the next tab stop
		after the editor only when nothing else focusable follows the editor in the
		document. Put another editor (or any button) below this one and a single Tab
		out of the editor lands there instead — the popover's keyboard reachability
		is a property of the PAGE, not of the component.
	-->
	<section style="display: grid; gap: 0.5rem;">
		<h3 style="margin: 0; font-size: 1rem;">Creation — no threads seeded</h3>
		<!--
			`id="creation-editor"` lands on the INNER markdown editor, not on the
			outer `[data-testid="review-editor"]` container, so `#creation-editor`
			does not scope the sidebar, the live region, or the controls bar. Each
			instance gets its own host wrapper to scope by.
		-->
		<div data-testid="creation-host" style="min-height: 26rem;">
			<ReviewEditor
				id="creation-editor"
				bind:value={creationValue}
				bind:threads={creationThreads}
				mode="edit"
				currentUserId="steve"
				onthreadcreate={handleThreadCreate}
				oncommentcreate={handleCommentCreate}
				onthreaddelete={(event) => record('onthreaddelete', event)}
				oncommentupdate={(event) => record('oncommentupdate', event)}
				oncommentdelete={(event) => record('oncommentdelete', event)}
			/>
		</div>
	</section>
</div>

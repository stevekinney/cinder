<script lang="ts">
	import { ReviewEditor, type Thread } from '@lostgradient/editor/review-editor';
	import { findAllOccurrences, reanchorQuote } from '@lostgradient/editor/comments';
	import { anchorPluginKey } from '@lostgradient/editor/anchor-decorations';

	// ANCHORING AND RE-ANCHORING
	//
	// A ReviewEditor thread carries an anchor that mixes TWO coordinate systems
	// in one flat object, and labels neither:
	//
	//   from / to        PROSEMIRROR POSITIONS. Markup occupies no position, so
	//                    in `# Release Plan` the 12-character quote
	//                    "Release Plan" is 1..13 — the leading "# " does not
	//                    exist as far as the document is concerned.
	//   lastKnownOffset  `doc.textBetween(0, size, '\n')` OFFSETS. In the same
	//   originalPosition document "Release Plan" starts at 0, and each block
	//     .offset        boundary collapses to exactly one "\n" no matter how
	//                    many blank lines the markdown source had.
	//
	// For this page's five-block fixture the two spaces diverge like so:
	//
	//   text  "Release Plan\nThe first release includes a dashboard and export…"
	//   PM     1..13 "Release Plan"      text offset  0..12
	//   PM    44..53 "dashboard"         text offset 42..51
	//
	// Everything below exists to make that split — and the deferred re-anchoring
	// pass that is supposed to repair it — observable from a test.
	//
	// The instances that need to be edited are driven by dispatching PRECISE
	// ProseMirror transactions through `bind:this` → `getView()` rather than by
	// typing. That is deliberate: these behaviors are about exact positions and
	// about a 300ms debounce, and a keyboard-driven repro can pin neither.

	// =====================================================================
	// Fixtures
	// =====================================================================

	// Five text blocks: h1, paragraph, h2, and two list items. The block count
	// is load-bearing history rather than decoration. Before cinder PR #1266 a
	// thread present in the INITIAL `threads` prop decorated the WHOLE document,
	// because mapping an anchor through Milkdown's wholesale content-set step
	// collapses `from` to 0 and expands `to` to docSize; ProseMirror then splits
	// that one decoration into one span per text block, so the signature of the
	// bug was "span count === text-block count" — five spans here. The fixed
	// build recognises a whole-document replacement, refuses to map through it,
	// and locates anchors by quote instead. This document is now the control
	// case for "one span per anchor, no matter when the thread arrives".
	const releasePlan = `# Release Plan

The first release includes a dashboard and export actions.

## Checklist

- Finalize the component API
- Add playground coverage`;

	// Two blocks, so the ProseMirror positions the buttons below hard-code stay
	// checkable by hand:
	//
	//   PM  0        heading opens
	//   PM  1..13    "Release Plan"
	//   PM 14        paragraph opens
	//   PM 15..73    "The first release includes a dashboard and export actions."
	//   PM 44..53    "dashboard"  (15 + the 29 characters that precede it)
	const shortPlan = `# Release Plan

The first release includes a dashboard and export actions.`;

	// Two paragraphs, one repeated word — the ambiguity fixture.
	//
	//   PM  1..19    "Alpha widget beta."   ("widget" at  7..13)
	//   PM 21..40    "Gamma widget delta."  ("widget" at 27..33)
	//
	// As text: "Alpha widget beta.\nGamma widget delta.", first "widget" at
	// offset 6, second at 25.
	const widgets = `Alpha widget beta.

Gamma widget delta.`;

	function comment(threadId: string, body: string) {
		return [
			{
				id: `${threadId}-comment`,
				threadId,
				authorId: 'maya',
				body,
				createdAt: '2026-08-11T12:00:00.000Z'
			}
		];
	}

	// =====================================================================
	// Instance 1 — anchors seeded at mount
	// =====================================================================

	let mountValue = $state(releasePlan);
	let mountThreads = $state<Thread[]>([
		{
			id: 'mount-title',
			createdAt: '2026-08-11T12:00:00.000Z',
			anchor: {
				from: 1,
				to: 13,
				quote: 'Release Plan',
				// `prefix` here is markdown SOURCE context, which is exactly what
				// it must not be: re-anchoring scores against `textBetween`
				// output, where "# " does not appear. Seeded wrong on purpose —
				// it survives untouched precisely because this anchor is correct
				// and therefore never re-anchored. The instances further down
				// show what the component writes in its place when it does run.
				prefix: '# ',
				suffix: '\n\nThe first release',
				status: 'anchored',
				originalQuote: 'Release Plan',
				lastKnownOffset: 0
			},
			comments: comment('mount-title', 'Title reads well.')
		},
		{
			id: 'mount-dashboard',
			createdAt: '2026-08-11T12:01:00.000Z',
			anchor: {
				from: 44,
				to: 53,
				quote: 'dashboard',
				prefix: 'The first release includes a ',
				suffix: ' and export actions.',
				status: 'anchored',
				originalQuote: 'dashboard',
				lastKnownOffset: 42
			},
			comments: comment('mount-dashboard', 'Which dashboard?')
		},
		{
			// A document-level anchor: empty quote, zero-width range. There is no
			// text to decorate, so the plugin's `from >= to` guard skips it and
			// it produces no span at all — the sidebar is the only surface it
			// appears on.
			id: 'mount-document',
			createdAt: '2026-08-11T12:02:00.000Z',
			anchor: {
				from: 0,
				to: 0,
				quote: '',
				prefix: '',
				suffix: '',
				type: 'document',
				status: 'anchored'
			},
			comments: comment('mount-document', 'Overall: ship it.')
		}
	]);

	// =====================================================================
	// Instance 2 — two anchors seeded one position too far right
	// =====================================================================

	// Both anchors below name the right quote at the wrong range. The fixed
	// build verifies a seeded range against the document
	// (`doc.textBetween(from, to) === quote`) and, when it does not check out,
	// flags the anchor for the deferred re-anchoring pass, which searches by
	// QUOTE. Only one of these two actually gets repaired — see the page notes
	// under the instance, and the spec, for why.
	let offByOneValue = $state(releasePlan);
	let offByOneThreads = $state<Thread[]>([
		{
			id: 'offbyone-title',
			createdAt: '2026-08-11T12:00:00.000Z',
			anchor: {
				from: 2,
				to: 14,
				quote: 'Release Plan',
				prefix: '# ',
				suffix: '\n\nThe first release',
				status: 'anchored',
				originalQuote: 'Release Plan',
				lastKnownOffset: 0
			},
			comments: comment('offbyone-title', 'Anchored one position right, in a heading.')
		},
		{
			id: 'offbyone-dashboard',
			createdAt: '2026-08-11T12:01:00.000Z',
			anchor: {
				from: 45,
				to: 54,
				quote: 'dashboard',
				prefix: 'The first release includes a ',
				suffix: ' and export actions.',
				status: 'anchored',
				originalQuote: 'dashboard',
				lastKnownOffset: 42
			},
			comments: comment('offbyone-dashboard', 'Anchored one position right, in a paragraph.')
		}
	]);
	let offByOneEditor: ReviewEditor | undefined = $state();

	// =====================================================================
	// Instance 3 — the same anchor assigned AFTER mount
	// =====================================================================

	let lateValue = $state(releasePlan);
	let lateThreads = $state<Thread[]>([]);

	function seedLateThread() {
		lateThreads = [
			{
				id: 'late-title',
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
				comments: comment('late-title', 'Assigned after the editor mounted.')
			}
		];
	}

	// =====================================================================
	// Instance 4 — drift, deletion, and the 300ms debounce
	// =====================================================================

	let driftValue = $state(shortPlan);
	let driftThreads = $state<Thread[]>([
		{
			id: 'drift-dashboard',
			createdAt: '2026-08-11T12:00:00.000Z',
			anchor: {
				from: 44,
				to: 53,
				quote: 'dashboard',
				prefix: 'The first release includes a ',
				suffix: ' and export actions.',
				status: 'anchored',
				originalQuote: 'dashboard',
				lastKnownOffset: 42
			},
			comments: comment('drift-dashboard', 'Name the dashboard.')
		}
	]);
	let driftEditor: ReviewEditor | undefined = $state();

	// =====================================================================
	// Instance 5 — two exact matches
	// =====================================================================

	let ambiguousValue = $state(widgets);
	let ambiguousThreads = $state<Thread[]>([
		{
			id: 'ambiguous-widget',
			createdAt: '2026-08-11T12:00:00.000Z',
			anchor: {
				from: 27,
				to: 33,
				quote: 'widget',
				// The real context the component captures for the SECOND
				// occurrence: up to 50 characters of `textBetween` output on each
				// side. Note that the prefix CONTAINS the first occurrence, which
				// is exactly why context scoring cannot cleanly separate the two.
				prefix: 'Alpha widget beta.\nGamma ',
				suffix: ' delta.',
				status: 'anchored',
				originalQuote: 'widget',
				lastKnownOffset: 25
			},
			comments: comment('ambiguous-widget', 'This one, not the first one.')
		}
	]);
	let ambiguousEditor: ReviewEditor | undefined = $state();

	// =====================================================================
	// Page-owned observation
	// =====================================================================

	// The callbacks are notification-only. `onthreaddelete` fires only when an
	// app or the user removes a thread — the component no longer removes one on
	// its own. A comment whose anchored text disappears is marked `orphaned` and
	// kept, because deletion and a slow cut-and-paste are indistinguishable
	// inside the 300ms re-anchoring window (cinder#1284).
	let events = $state<string[]>([]);
	const record = (entry: string) => {
		events = [...events, entry];
	};

	// The component's screen-reader announcements land in a `role="status"`
	// region that is correctly hidden (`cinder-sr-only`) and, worse for a test,
	// TRANSIENT: `LiveRegion.announce` clears the text again 1000ms later. A
	// test that reads the region directly is racing that timer, so mirror the
	// announcements into an append-only page-owned log instead. The region under
	// observation is the drift instance's first `role="status"` — the component
	// renders the LiveRegion before the separate comment-count announcer.
	let announcements = $state<string[]>([]);
	$effect(() => {
		const region = document.querySelector('[data-testid="instance-drift"] [role="status"]');
		if (!region) return;
		const observer = new MutationObserver(() => {
			const text = region.textContent?.trim();
			if (text) announcements = [...announcements, text];
		});
		observer.observe(region, { childList: true, characterData: true, subtree: true });
		return () => observer.disconnect();
	});

	// The one variable that decides whether the deferred re-anchoring pass runs
	// at all, read straight off the live plugin.
	//
	// `view.update` returns before it touches `setTimeout` unless the plugin's
	// `needsReanchor` is true, so `needsReanchor === false` says something no
	// amount of waiting can: not "the pass has finished", but "no pass was ever
	// scheduled". That is the difference between a test that outlasts a debounce
	// and a test that pins the debounce never started — the second one fails the
	// instant a regression begins scheduling work, instead of failing only once
	// the regression also happens to be slower than the sleep.
	//
	// Nothing upstream had to change to expose it: `anchorPluginKey` is a public
	// export on the `@lostgradient/editor/anchor-decorations` subpath, ReviewEditor
	// hands out its live `EditorView` through `getView()`, and the read is
	// pure — no meta is dispatched, no transaction applied. The key is a module
	// singleton shared by every instance, but `getState` is scoped to the view's
	// own `EditorState`, so each name below reports only its own instance.
	//
	// Only the two instances the spec probes are wired up; `ambiguousEditor` has a
	// `bind:this` for its move button rather than for this, and adding it here
	// would be a one-line change if a test ever needs it.
	type AnchorProbe = { needsReanchor: boolean; statuses: Record<string, string> };

	function anchorProbe(name: string): AnchorProbe | null {
		const editor =
			name === 'drift' ? driftEditor : name === 'offbyone' ? offByOneEditor : undefined;
		const view = editor?.getView();
		if (!view) return null;
		const state = anchorPluginKey.getState(view.state);
		if (!state) return null;
		return {
			needsReanchor: state.needsReanchor,
			// Per-anchor status alongside the flag, because "no pass is pending"
			// and "the anchor is placed" are separate claims and a test that
			// wants both should not have to infer one from the other.
			statuses: Object.fromEntries([...state.anchors].map(([id, anchor]) => [id, anchor.status]))
		};
	}

	// Published from an effect, which puts it in the browser only and takes it
	// away again on teardown. The teardown is the point: a probe left behind
	// after the page unmounts would keep answering `null` — indistinguishable
	// from "the view is not ready yet", and quiet enough that a test could read
	// it forever without noticing. Removed, the same call is a TypeError, which
	// is the loud answer.
	$effect(() => {
		(window as unknown as { __anchorState?: typeof anchorProbe }).__anchorState = anchorProbe;
		return () => {
			delete (window as unknown as { __anchorState?: typeof anchorProbe }).__anchorState;
		};
	});

	// =====================================================================
	// Driving the editor by transaction
	// =====================================================================

	type LiveView = NonNullable<ReturnType<ReviewEditor['getView']>>;

	/**
	 * Run something against an instance's live ProseMirror view.
	 *
	 * `getView()` is part of the imperative surface `bind:this` exposes. Each
	 * call re-reads `view.state`, so two calls in a row compose: the second sees
	 * the document the first produced. That is what makes "delete and reinsert
	 * in one synchronous burst" expressible at all.
	 */
	function edit(editor: ReviewEditor | undefined, apply: (view: LiveView) => void) {
		const view = editor?.getView();
		if (!view) return;
		apply(view);
	}

	/** Insert literal text at a ProseMirror position. */
	function insertAt(editor: ReviewEditor | undefined, text: string, position: number) {
		edit(editor, (view) => view.dispatch(view.state.tr.insertText(text, position)));
	}

	/** Delete a ProseMirror range. */
	function deleteRange(editor: ReviewEditor | undefined, from: number, to: number) {
		edit(editor, (view) => view.dispatch(view.state.tr.delete(from, to)));
	}

	// --- drift instance actions ------------------------------------------

	// Anchors are greedy at BOTH edges: the plugin maps `from` with bias -1 and
	// `to` with bias +1, so a character inserted at either boundary lands INSIDE
	// the decorated range, and the plugin rewrites its own copy of the quote to
	// include it. The bindable `threads` prop hears nothing about any of this.
	const insertBeforeAnchor = () => insertAt(driftEditor, 'X', 44);
	const insertAfterAnchor = () => insertAt(driftEditor, '!', 53);

	// Delete the anchored word and leave it deleted. 300ms later the deferred
	// pass runs and `reanchorQuote` finds no occurrence of "dashboard" anywhere,
	// so the anchor is marked `orphaned` — and the thread STAYS in the bindable
	// array. It used to be removed outright, which is what cinder#1284 reversed:
	// at the moment text disappears a deletion and the first half of a
	// cut-and-paste are indistinguishable, and 300ms is faster than any human
	// paste. Removing a thread is the consumer's decision now, so
	// `onthreaddelete` does not fire here at all.
	const deleteAnchoredWord = () => deleteRange(driftEditor, 44, 53);

	// Delete and reinsert in ONE synchronous burst, well inside the 300ms
	// debounce. This is the only path that writes fresh coordinates back into
	// the bindable `threads` prop. No human cuts and pastes this fast; a person
	// performing the same two operations by hand always lands in the case below.
	function moveAnchoredWordInOneBurst() {
		deleteRange(driftEditor, 44, 53);
		insertAt(driftEditor, 'dashboard ', 15);
	}

	// The same two operations with ~450ms between them, so the debounce expires
	// in the gap. The anchor is orphaned mid-move and the thread survives; the
	// late paste triggers a fresh re-anchoring pass that finds the quote again
	// and restores the decoration. Before cinder#1284 the thread was deleted at
	// the halfway point and the restored text had nothing left to re-anchor.
	function moveAnchoredWordSlowly() {
		deleteRange(driftEditor, 44, 53);
		setTimeout(() => insertAt(driftEditor, 'dashboard ', 15), 450);
	}

	// Assigning a whole new string to `value` replaces the document in a single
	// step spanning everything. Position mapping across such a step is
	// meaningless, so the fixed build refuses to map, keeps the anchor's quote
	// and context intact, and re-anchors by search instead.
	const replaceWholeValue = () => {
		driftValue = `# Release Plan

Export actions ship first; the dashboard follows in a later release.`;
	};

	// --- ambiguous instance actions --------------------------------------

	// Cut the SECOND "widget" and paste it at the end of its own paragraph, in
	// one burst. Two exact matches now exist and re-anchoring has to choose.
	function moveSecondWidget() {
		deleteRange(ambiguousEditor, 27, 33);
		insertAt(ambiguousEditor, ' widget', 34);
	}

	// =====================================================================
	// The re-anchoring functions, driven directly
	// =====================================================================

	// `reanchorQuote` and `findAllOccurrences` are plain exports from
	// `@lostgradient/editor/comments`, so the score the component computes and
	// then throws away can be observed here. The component reads only `found`;
	// `confidence` never reaches an application.
	const pureDocument = 'Release Plan\nThe first release includes a dashboard and export actions.';

	// Context that matches the document exactly around "dashboard" (offsets
	// 42..51): the 11 characters before it and the 11 after.
	const perfectMatch = reanchorQuote(pureDocument, {
		quote: 'dashboard',
		prefix: 'includes a ',
		suffix: ' and export'
	});

	// The same quote, with context drawn from an alphabet the document does not
	// contain at all. Nothing about the decision to return `found: true`
	// consults the score: an exact substring exists, so the answer is yes.
	const garbageContextMatch = reanchorQuote(pureDocument, {
		quote: 'dashboard',
		prefix: 'ZZZZZZZZZZZ',
		suffix: 'QQQQQQQQQQQ'
	});

	// No occurrence at all: falls through to `fuzzyReanchor`, which hunts for
	// the junction where the text used to be and reports how confident it is
	// about THAT — a number that has nothing to do with the quote being found.
	const absentMatch = reanchorQuote(pureDocument, {
		quote: 'sparkline',
		prefix: 'includes a ',
		suffix: ' and export'
	});

	// A document-level anchor round-tripped through the same function. The empty
	// quote short-circuits `findAllOccurrences`, and `fuzzyReanchor` skips its
	// junction search because there is no prefix, so every document-level thread
	// reports `found: false` — which is what would drop them all on a restore.
	const emptyQuoteMatch = reanchorQuote(pureDocument, {
		quote: '',
		prefix: '',
		suffix: ''
	});

	// The live ambiguity case run as pure arithmetic: the document as it stands
	// AFTER the second "widget" has been moved to the end of its paragraph,
	// scored against the anchor that was on that second occurrence.
	const movedWidgetDocument = 'Alpha widget beta.\nGamma  delta. widget';
	const ambiguousMatch = reanchorQuote(movedWidgetDocument, {
		quote: 'widget',
		prefix: 'Alpha widget beta.\nGamma ',
		suffix: ' delta.',
		lastKnownOffset: 25
	});

	// Overlapping matches count: the search restarts one character past each
	// hit, not past the whole match.
	const overlappingOccurrences = findAllOccurrences('aa', 'aaaa');
	const emptyQuoteOccurrences = findAllOccurrences('', 'aaaa');

	const showResult = (result: { found: boolean; from: number; confidence: number }) =>
		`found=${result.found} from=${result.from} confidence=${result.confidence.toFixed(3)}`;
</script>

<div style="max-width: 72rem; margin: 0 auto; padding: 1rem; display: grid; gap: 2.5rem;">
	<section style="display: grid; gap: 0.5rem;">
		<h2 style="margin: 0;">Seeded at mount</h2>
		<p style="margin: 0; font-size: 0.85rem;">
			Two correctly-positioned text anchors, plus one document-level anchor that decorates nothing.
		</p>
		<div data-testid="instance-mount" style="min-height: 30rem;">
			<ReviewEditor
				id="anchor-mount"
				original={releasePlan}
				bind:value={mountValue}
				bind:threads={mountThreads}
				currentUserId="steve"
				onthreaddelete={(event) => record(`mount:threaddelete:${event.threadId}`)}
			/>
		</div>
		<pre
			data-testid="mount-title-json"
			style="margin: 0; white-space: pre-wrap; word-break: break-all; font-size: 0.75rem;">{JSON.stringify(
				mountThreads.find((thread) => thread.id === 'mount-title')?.anchor ?? null
			)}</pre>
		<p data-testid="mount-thread-count" style="margin: 0;">threads: {mountThreads.length}</p>
	</section>

	<section style="display: grid; gap: 0.5rem;">
		<h2 style="margin: 0;">Seeded one position too far right</h2>
		<p style="margin: 0; font-size: 0.85rem;">
			Both anchors name the right quote at the wrong range. The paragraph anchor is repaired by the
			deferred pass; the heading anchor is not.
		</p>
		<div data-testid="instance-offbyone" style="min-height: 30rem;">
			<ReviewEditor
				id="anchor-offbyone"
				bind:this={offByOneEditor}
				original={releasePlan}
				bind:value={offByOneValue}
				bind:threads={offByOneThreads}
				currentUserId="steve"
				onthreaddelete={(event) => record(`offbyone:threaddelete:${event.threadId}`)}
			/>
		</div>
		<pre
			data-testid="offbyone-title-json"
			style="margin: 0; white-space: pre-wrap; word-break: break-all; font-size: 0.75rem;">{JSON.stringify(
				offByOneThreads.find((thread) => thread.id === 'offbyone-title')?.anchor ?? null
			)}</pre>
		<pre
			data-testid="offbyone-dashboard-json"
			style="margin: 0; white-space: pre-wrap; word-break: break-all; font-size: 0.75rem;">{JSON.stringify(
				offByOneThreads.find((thread) => thread.id === 'offbyone-dashboard')?.anchor ?? null
			)}</pre>
	</section>

	<section style="display: grid; gap: 0.5rem;">
		<h2 style="margin: 0;">Assigned after mount</h2>
		<button
			data-testid="seed-late"
			type="button"
			onclick={seedLateThread}
			style="justify-self: start;">Seed the thread</button
		>
		<div data-testid="instance-late" style="min-height: 30rem;">
			<ReviewEditor
				id="anchor-late"
				original={releasePlan}
				bind:value={lateValue}
				bind:threads={lateThreads}
				currentUserId="steve"
				onthreaddelete={(event) => record(`late:threaddelete:${event.threadId}`)}
			/>
		</div>
		<pre
			data-testid="late-json"
			style="margin: 0; white-space: pre-wrap; word-break: break-all; font-size: 0.75rem;">{JSON.stringify(
				lateThreads[0]?.anchor ?? null
			)}</pre>
	</section>

	<section style="display: grid; gap: 0.5rem;">
		<h2 style="margin: 0;">Drift, deletion, and the debounce</h2>
		<div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
			<button data-testid="drift-insert-before" type="button" onclick={insertBeforeAnchor}
				>Insert "X" at the anchor's left edge</button
			>
			<button data-testid="drift-insert-after" type="button" onclick={insertAfterAnchor}
				>Insert "!" at the anchor's right edge</button
			>
			<button data-testid="drift-delete" type="button" onclick={deleteAnchoredWord}
				>Delete the anchored word</button
			>
			<button data-testid="drift-move-burst" type="button" onclick={moveAnchoredWordInOneBurst}
				>Move it (one burst)</button
			>
			<button data-testid="drift-move-slow" type="button" onclick={moveAnchoredWordSlowly}
				>Move it (450ms gap)</button
			>
			<button data-testid="drift-replace-value" type="button" onclick={replaceWholeValue}
				>Replace `value` wholesale</button
			>
		</div>
		<div data-testid="instance-drift" style="min-height: 26rem;">
			<ReviewEditor
				id="anchor-drift"
				bind:this={driftEditor}
				original={shortPlan}
				bind:value={driftValue}
				bind:threads={driftThreads}
				currentUserId="steve"
				onthreaddelete={(event) => record(`drift:threaddelete:${event.threadId}`)}
			/>
		</div>
		<pre
			data-testid="drift-json"
			style="margin: 0; white-space: pre-wrap; word-break: break-all; font-size: 0.75rem;">{JSON.stringify(
				driftThreads[0]?.anchor ?? null
			)}</pre>
		<p data-testid="drift-thread-count" style="margin: 0;">threads: {driftThreads.length}</p>
		<ul data-testid="announcements" style="margin: 0; padding-left: 1.25rem;">
			{#each announcements as entry, index (`${index}-${entry}`)}
				<li>{entry}</li>
			{/each}
		</ul>
	</section>

	<section style="display: grid; gap: 0.5rem;">
		<h2 style="margin: 0;">Two exact matches</h2>
		<button
			data-testid="ambiguous-move"
			type="button"
			onclick={moveSecondWidget}
			style="justify-self: start;">Move the second "widget" to the end of its paragraph</button
		>
		<div data-testid="instance-ambiguous" style="min-height: 24rem;">
			<ReviewEditor
				id="anchor-ambiguous"
				bind:this={ambiguousEditor}
				original={widgets}
				bind:value={ambiguousValue}
				bind:threads={ambiguousThreads}
				currentUserId="steve"
				onthreaddelete={(event) => record(`ambiguous:threaddelete:${event.threadId}`)}
			/>
		</div>
		<pre
			data-testid="ambiguous-json"
			style="margin: 0; white-space: pre-wrap; word-break: break-all; font-size: 0.75rem;">{JSON.stringify(
				ambiguousThreads[0]?.anchor ?? null
			)}</pre>
		<p data-testid="ambiguous-thread-count" style="margin: 0;">
			threads: {ambiguousThreads.length}
		</p>
	</section>

	<section style="display: grid; gap: 0.5rem;">
		<h2 style="margin: 0;">The re-anchoring functions, driven directly</h2>
		<dl
			style="margin: 0; display: grid; grid-template-columns: max-content 1fr; gap: 0.25rem 1rem;"
		>
			<dt>perfect context</dt>
			<dd data-testid="reanchor-perfect" style="margin: 0;">{showResult(perfectMatch)}</dd>
			<dt>garbage context</dt>
			<dd data-testid="reanchor-garbage" style="margin: 0;">{showResult(garbageContextMatch)}</dd>
			<dt>quote absent</dt>
			<dd data-testid="reanchor-absent" style="margin: 0;">{showResult(absentMatch)}</dd>
			<dt>empty quote</dt>
			<dd data-testid="reanchor-empty" style="margin: 0;">{showResult(emptyQuoteMatch)}</dd>
			<dt>two matches</dt>
			<dd data-testid="reanchor-ambiguous" style="margin: 0;">{showResult(ambiguousMatch)}</dd>
			<dt>occurrences of "aa" in "aaaa"</dt>
			<dd data-testid="occurrences-overlapping" style="margin: 0;">
				{overlappingOccurrences.length}: {JSON.stringify(overlappingOccurrences)}
			</dd>
			<dt>occurrences of "" in "aaaa"</dt>
			<dd data-testid="occurrences-empty" style="margin: 0;">{emptyQuoteOccurrences.length}</dd>
		</dl>
	</section>

	<section style="display: grid; gap: 0.5rem;">
		<h2 style="margin: 0; font-size: 1rem;">Observed callbacks</h2>
		<ul data-testid="event-log" style="margin: 0; padding-left: 1.25rem;">
			{#each events as entry, index (`${index}-${entry}`)}
				<li>{entry}</li>
			{/each}
		</ul>
	</section>
</div>

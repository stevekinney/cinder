<script lang="ts">
	import {
		buildFormData,
		buildFormDataFromValues,
		exportCommentsMarkdown,
		exportMarkdownSummary,
		exportUnifiedDiff,
		getSummaryContentWithoutHeading,
		ReviewEditor,
		type ReviewState,
		type Thread
	} from '@lostgradient/editor/review-editor';
	import {
		generateCommentsExport,
		generateCommentsJSON,
		generateMarkdownSummary,
		generateUnifiedDiff
	} from '@lostgradient/editor/export';

	// ReviewEditor's form participation and its export menu are two renderings of
	// the SAME five derivations. The hidden inputs are
	// `original / value / JSON.stringify(threads) / exportUnifiedDiff().diff /
	// exportMarkdownSummary().markdown`; the export menu copies four of those
	// five plus `JSON.stringify(getState())`. So they share one fixture here: a
	// real `original` that differs from `value`, one seeded thread carrying a
	// live comment and a soft-deleted one, and a wrapping <form>.
	//
	// The pure export functions belong on this page for the same reason. The
	// exercise is to prove the module output is byte-identical to what the
	// component put in the DOM or on the clipboard, and that needs both sides
	// rendered together.
	//
	// FRONT MATTER IS DELIBERATELY ABSENT. `normalize()` rewrites front matter
	// into a setext heading on its way through the diff, which would add phantom
	// lines to every hunk counted here. That belongs to the `review-front-matter`
	// exercise, which owns a front-matter fixture; this route keeps its diff
	// numbers clean.

	// One modified line ("…and export actions." → "…, export actions, and inline
	// review.") and one added line (the third checklist bullet). Two edits, one
	// hunk apart, so the summary's change-range grouping produces two `### Lines`
	// blocks while the unified diff (contextLines: 3) merges them into one hunk.
	const ORIGINAL = `# Release Plan

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

	// `from`/`to` are PROSEMIRROR POSITIONS (the heading's "# " is markup, not
	// text, so "Release Plan" occupies 1..13); `lastKnownOffset` is a
	// `textBetween()` offset for the same span, which is 0. Two coordinate
	// spaces in one object — get either wrong and the seeded anchor re-anchors
	// instead of decorating its quote.
	//
	// The second comment carries `deletedAt`, which is what makes the
	// soft-delete filtering in the comments export observable: `**Total
	// comments:** 1` for a thread that literally holds two.
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
				lastKnownOffset: 0
			},
			comments: [
				{
					id: 'comment-visible',
					threadId: 'thread-release-plan-title',
					authorId: 'maya',
					body: 'Title reads well — keep it.',
					createdAt: '2026-08-11T12:00:00.000Z'
				},
				{
					id: 'comment-soft-deleted',
					threadId: 'thread-release-plan-title',
					authorId: 'dev',
					body: 'Retracted: ignore this one.',
					createdAt: '2026-08-11T12:05:00.000Z',
					deletedAt: '2026-08-11T12:06:00.000Z'
				}
			]
		}
	]);

	// ── Form participation ──────────────────────────────────────────────────
	//
	// `new FormData(form)` is the only way to see what the component actually
	// contributes to a submit: the hidden inputs are the component's public form
	// surface and nothing else about it is submittable.

	type FormReadout = { keys: string[]; values: Record<string, string> };

	const emptyReadout: FormReadout = { keys: [], values: {} };

	function readForm(form: HTMLFormElement): FormReadout {
		const entries = [...new FormData(form).entries()];
		return {
			keys: entries.map(([key]) => key),
			values: Object.fromEntries(
				entries.map(([key, entry]) => [key, typeof entry === 'string' ? entry : entry.name])
			)
		};
	}

	let namedSubmit = $state<FormReadout>(emptyReadout);
	let namedSubmitCount = $state(0);
	let unnamedSubmit = $state<FormReadout>(emptyReadout);
	let unnamedSubmitCount = $state(0);
	let bareSubmit = $state<FormReadout>(emptyReadout);
	let bareSubmitCount = $state(0);

	// ── Imperative surface (`bind:this`) ────────────────────────────────────
	//
	// The published wrapper forwards the implementation's imperative methods, so
	// `bind:this` on <ReviewEditor> yields the full surface: getState, setState,
	// getFormData, getMarkdown, setMarkdown, scrollToThread, createThread,
	// createDocumentThread, createBlockThread, deleteThread, clearAllThreads,
	// createComment, updateComment, deleteComment, exportUnifiedDiff,
	// exportMarkdownSummary, reset, focus, getSelection, getAst, getView,
	// getEditor.
	//
	// An earlier build swallowed all of it — `bind:this` handed back an object
	// with no methods and the entire persistence round-trip was unreachable from
	// the package entry point. `instance-keys` below is the regression guard for
	// that: it must NOT be empty.
	let editor = $state<ReturnType<typeof ReviewEditor> | undefined>(undefined);
	const instanceKeys = $derived(
		Object.keys((editor ?? {}) as Record<string, unknown>)
			.sort()
			.join(',')
	);

	let imperativeFormData = $state('');
	let imperativeStateKeys = $state('');

	function readImperativeFormData() {
		const data = editor?.getFormData();
		imperativeFormData = data ? JSON.stringify(data, null, 2) : '';
	}

	function readImperativeStateKeys() {
		const state = editor?.getState();
		imperativeStateKeys = state ? Object.keys(state).join(',') : '';
	}

	// ── The pure functions behind the same five values ──────────────────────
	//
	// Built from the LIVE props rather than from frozen literals: the claim
	// under test is that the module functions, fed what the component was fed,
	// reproduce what the component rendered — not that two copies of the same
	// literal are equal.
	const liveState = $derived<ReviewState>({
		schemaVersion: 4,
		content: value,
		original: ORIGINAL,
		threads,
		frontMatter: null,
		frontMatterRaw: null,
		updatedAt: '2026-08-11T12:00:00.000Z'
	});

	// `buildFormData` serializes `state.threads` verbatim, so a runtime thread
	// keeps its `from`/`to`. `buildFormDataFromValues` rebuilds each anchor field
	// by field and drops them — the two differ in exactly that one field, which
	// is why both are rendered here.
	const fromState = $derived(buildFormData(liveState));
	const fromValues = $derived(buildFormDataFromValues(ORIGINAL, value, threads));

	const liveThreadsJson = $derived(JSON.stringify(threads));
	const moduleDiff = $derived(exportUnifiedDiff(liveState).diff);
	const moduleSummary = $derived(exportMarkdownSummary(liveState).markdown);
	const moduleComments = $derived(exportCommentsMarkdown(liveState));
	const moduleCommentsJson = $derived(generateCommentsJSON(liveState).json);

	// `@lostgradient/editor/review-editor` re-exports `exportMarkdownSummary` /
	// `exportUnifiedDiff` / `exportCommentsMarkdown` as stateless wrappers around
	// `@lostgradient/editor/export`. Rendering the underlying function's output
	// too lets the spec prove the wrapper adds nothing rather than assume it —
	// the two entry points are genuinely different modules.
	const coreSummary = $derived(generateMarkdownSummary(liveState).markdown);

	// `getSummaryContentWithoutHeading` strips a leading `# Review Summary`
	// heading. `generateMarkdownSummary` never emits one — its sections start at
	// `## Changes Made` — so the regex matches nothing and the function is an
	// identity function for every constructible state. Rendered side by side so
	// the spec can assert byte equality rather than take the claim on faith.
	const summaryWithoutHeading = $derived(getSummaryContentWithoutHeading(liveState));

	// ── normalizeInputs A/B ─────────────────────────────────────────────────
	//
	// `generateUnifiedDiff` normalizes BOTH sides through the markdown pipeline
	// by default, so a formatting-only edit is invisible: `- item one` and
	// `* item one` normalize to the same bullet and the diff comes back empty
	// with zeroed stats. Opting out surfaces the literal one-line change.
	const formattingOnlyState: ReviewState = {
		schemaVersion: 4,
		content: '* item one\n',
		original: '- item one\n',
		threads: [],
		updatedAt: '2026-08-11T12:00:00.000Z'
	};
	const normalizedFormattingOnly = generateUnifiedDiff(formattingOnlyState);
	const rawFormattingOnly = generateUnifiedDiff(formattingOnlyState, { normalizeInputs: false });

	// The SAME state through `generateMarkdownSummary`, which is where the two
	// exports stop agreeing. `generateUnifiedDiff` normalizes both sides;
	// `generateMarkdownSummary` runs `computeLineDiff` on the RAW strings and has
	// no normalization step and no option to add one. So one export says the
	// document is unchanged while the other reports an edit — from a single
	// `ReviewState`. Rendered here because it is what makes any byte-exact
	// summary expectation fragile in a way the diff's is not.
	const formattingOnlySummary = generateMarkdownSummary(formattingOnlyState);

	// ── generateCommentsExport location fallbacks ───────────────────────────
	//
	// The `### …` line falls through three formats depending on which anchor
	// fields survive, and the `(YYYY-MM-DD)` parenthetical is dropped entirely
	// when `createdAt` cannot be parsed — `formatTimestamp` calls
	// `toISOString()` on an Invalid Date, which throws, and swallows it.
	function commentState(anchor: Thread['anchor'], createdAt = '2026-08-11T12:00:00.000Z') {
		return {
			schemaVersion: 4,
			content: 'x',
			threads: [
				{
					id: 'thread-fallback',
					createdAt,
					anchor,
					comments: [
						{
							id: 'comment-fallback',
							threadId: 'thread-fallback',
							authorId: 'maya',
							body: 'note',
							createdAt
						}
					]
				}
			],
			updatedAt: createdAt
		} satisfies ReviewState;
	}

	const baseAnchor = {
		from: 0,
		to: 4,
		quote: 'Plan',
		prefix: '',
		suffix: '',
		status: 'anchored'
	} as const;

	const locationWithPosition = generateCommentsExport(
		commentState({
			...baseAnchor,
			lastKnownOffset: 4,
			originalPosition: { offset: 4, line: 3, column: 1 }
		})
	).markdown;
	const locationWithOffset = generateCommentsExport(
		commentState({ ...baseAnchor, lastKnownOffset: 4 })
	).markdown;
	const locationUnknown = generateCommentsExport(commentState({ ...baseAnchor })).markdown;
	const unparseableTimestamp = generateCommentsExport(
		commentState({ ...baseAnchor, lastKnownOffset: 4 }, 'not-a-date')
	).markdown;

	const emptyCommentsExport = generateCommentsExport({
		schemaVersion: 4,
		content: 'x',
		threads: [],
		updatedAt: '2026-08-11T12:00:00.000Z'
	}).markdown;

	// Every comment soft-deleted is treated identically to no threads at all:
	// the thread survives in `state.threads`, but the export filters it out
	// before deciding which heading to print.
	const allSoftDeletedExport = generateCommentsExport({
		schemaVersion: 4,
		content: 'x',
		threads: [
			{
				id: 'thread-all-deleted',
				createdAt: '2026-08-11T12:00:00.000Z',
				anchor: { ...baseAnchor, lastKnownOffset: 4 },
				comments: [
					{
						id: 'comment-gone',
						threadId: 'thread-all-deleted',
						authorId: 'maya',
						body: 'gone',
						createdAt: '2026-08-11T12:00:00.000Z',
						deletedAt: '2026-08-11T12:01:00.000Z'
					}
				]
			}
		],
		updatedAt: '2026-08-11T12:00:00.000Z'
	}).markdown;

	// ── Third instance: no `original` ───────────────────────────────────────
	//
	// The toolbar derives "are there changes?" from `original` (empty ⇒ no diff
	// tabs, no diff-statistics group) while the hidden `bare-diff` input runs
	// the same content through `generateUnifiedDiff`, where a missing original
	// is an empty left-hand side and therefore a whole-document insertion.
	let bareValue = $state(`# Notes

Just one paragraph.`);
	// Derived, not computed once: the spec compares this against the number of
	// `+` lines in `bare-diff`, and both sides have to move together if the
	// editor ever re-serializes the document.
	const bareLineCount = $derived(bareValue.split('\n').length);

	let unnamedValue = $state(`# Unnamed

This editor omits the \`name\` prop entirely.`);

	// ── Fourth instance: orphaned, anchored, and document-level threads ─────
	//
	// `exportMarkdownSummary` prints one `###` heading per thread and chooses
	// between three shapes: `On "<quote>" (no longer in the document)` when the
	// anchor is orphaned, `On "<quote>"` when it is anchored, and
	// `Document-level feedback` when there is no quote at all. Exercising the
	// orphan branch needs a thread whose anchor status is `orphaned`, and the
	// only honest way to get one is the way a reviewer does: delete the text the
	// comment was anchored to.
	//
	// `original` deliberately EQUALS the initial `value`. Two things fall out of
	// that, both wanted. At rest the summary has no `## Changes Made` section at
	// all, so the whole document reduces to the Feedback section the RE-2
	// criterion is about — and it contains no digit anywhere, which is a much
	// stronger statement of "prints no coordinate it does not have" than checking
	// for the absence of specific words. And the `orphan-diff` hidden input is
	// the EMPTY STRING, which is `generateUnifiedDiff`'s answer for two identical
	// documents and the input `git apply` refuses outright.
	const ORPHAN_DOCUMENT = `# Beta Notes

The beta rollout ships to ten teams.

Everything else is unchanged.`;

	let orphanValue = $state(ORPHAN_DOCUMENT);

	// PROSEMIRROR POSITIONS again, and the arithmetic is worth showing because
	// the delete button below depends on it. The heading node spans 0..12
	// ("Beta Notes" is 10 characters at 1..11); the first paragraph's content
	// starts at 13, so "The " puts "beta rollout" at 17..29. `lastKnownOffset` is
	// the `textBetween(…, '\n')` offset for the same span — 10 for the heading,
	// one separator, four for "The " — which is 15, a different number for the
	// same word.
	let orphanThreads = $state<Thread[]>([
		{
			id: 'thread-rollout',
			createdAt: '2026-08-11T12:00:00.000Z',
			anchor: {
				type: 'text',
				from: 17,
				to: 29,
				quote: 'beta rollout',
				prefix: 'The ',
				suffix: ' ships to ten teams.',
				status: 'anchored',
				originalQuote: 'beta rollout',
				lastKnownOffset: 15
			},
			comments: [
				{
					id: 'comment-rollout',
					threadId: 'thread-rollout',
					authorId: 'maya',
					body: 'Which teams, exactly?',
					createdAt: '2026-08-11T12:00:00.000Z'
				}
			]
		},
		{
			// The control group: this quote survives the deletion below, so its
			// heading must stay in the un-parenthesized form throughout.
			id: 'thread-heading',
			createdAt: '2026-08-11T12:01:00.000Z',
			anchor: {
				type: 'text',
				from: 1,
				to: 11,
				quote: 'Beta Notes',
				prefix: '# ',
				suffix: '\n\nThe beta rollout',
				status: 'anchored',
				originalQuote: 'Beta Notes',
				lastKnownOffset: 0
			},
			comments: [
				{
					id: 'comment-heading',
					threadId: 'thread-heading',
					authorId: 'steve',
					body: 'Heading reads fine.',
					createdAt: '2026-08-11T12:01:00.000Z'
				}
			]
		},
		{
			// No quote at all. The summary has a third heading shape for this and
			// it is the one that could most easily be mistaken for an orphan.
			id: 'thread-whole-document',
			createdAt: '2026-08-11T12:02:00.000Z',
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
					id: 'comment-whole-document',
					threadId: 'thread-whole-document',
					authorId: 'maya',
					body: 'Overall: ready to ship.',
					createdAt: '2026-08-11T12:02:00.000Z'
				}
			]
		}
	]);

	let orphanEditor = $state<ReturnType<typeof ReviewEditor> | undefined>(undefined);

	// A precise ProseMirror transaction rather than a keyboard-driven selection,
	// borrowed from `review-anchoring`: the point of this button is to remove
	// EXACTLY the anchored quote, and a click-and-drag selection cannot promise
	// that. `getView()` is part of the imperative surface `bind:this` exposes.
	function deleteAnchoredPhrase() {
		const view = orphanEditor?.getView();
		if (!view) return;
		view.dispatch(view.state.tr.delete(17, 29));
	}

	// `anchor.status` is what the summary branches on, so the statuses are
	// rendered as their own line: a spec can poll THIS rather than sleep through
	// the ~300ms re-anchoring debounce.
	//
	// Sorted by id rather than left in array order. The claim being made is about
	// which thread orphans, not about where the component keeps it, and a
	// re-anchoring pass that reordered the array would otherwise redden a test
	// that has no opinion about ordering.
	const orphanStatuses = $derived(
		orphanThreads
			.map((thread) => `${thread.id}:${thread.anchor.status}`)
			.sort()
			.join(',')
	);

	// Built from the live props, so it keeps agreeing with the component after
	// the deletion rather than only at rest.
	const orphanState = $derived<ReviewState>({
		schemaVersion: 4,
		content: orphanValue,
		original: ORPHAN_DOCUMENT,
		threads: orphanThreads,
		frontMatter: null,
		frontMatterRaw: null,
		updatedAt: '2026-08-11T12:00:00.000Z'
	});
	const orphanModuleSummary = $derived(generateMarkdownSummary(orphanState));

	const paneStyle = 'min-height: 30rem;';
	const outputStyle =
		'width: 100%; min-height: 6rem; font-family: var(--cinder-font-mono, monospace); font-size: 0.75rem;';
</script>

<div style="max-width: 72rem; margin: 0 auto; padding: 1rem; display: grid; gap: 2rem;">
	<section style="display: grid; gap: 0.75rem;">
		<h2 style="margin: 0;">Form participation — <code>name="review"</code></h2>

		<form
			id="exports-form"
			onsubmit={(event) => {
				event.preventDefault();
				namedSubmit = readForm(event.currentTarget);
				namedSubmitCount += 1;
			}}
			style="display: grid; gap: 0.75rem;"
		>
			<div data-testid="named-editor" style={paneStyle}>
				<ReviewEditor
					bind:this={editor}
					id="exports-editor"
					original={ORIGINAL}
					bind:value
					bind:threads
					currentUserId="steve"
					name="review"
					placeholder="Start reviewing…"
				/>
			</div>
			<div>
				<button type="submit" data-testid="submit-named">Submit review</button>
			</div>
		</form>

		<h3 style="margin: 0; font-size: 0.9rem;">Observed state — submitted FormData</h3>
		<p data-testid="named-submit-count" style="margin: 0;">submits: {namedSubmitCount}</p>
		<p data-testid="named-form-keys" style="margin: 0;">{namedSubmit.keys.join(',')}</p>
		<textarea
			readonly
			aria-label="submitted review-original"
			data-testid="submitted-original"
			style={outputStyle}
			value={namedSubmit.values['review-original'] ?? ''}></textarea>
		<textarea
			readonly
			aria-label="submitted review-current"
			data-testid="submitted-current"
			style={outputStyle}
			value={namedSubmit.values['review-current'] ?? ''}></textarea>
		<textarea
			readonly
			aria-label="submitted review-comments"
			data-testid="submitted-comments"
			style={outputStyle}
			value={namedSubmit.values['review-comments'] ?? ''}></textarea>
		<textarea
			readonly
			aria-label="submitted review-diff"
			data-testid="submitted-diff"
			style={outputStyle}
			value={namedSubmit.values['review-diff'] ?? ''}></textarea>
		<textarea
			readonly
			aria-label="submitted review-summary"
			data-testid="submitted-summary"
			style={outputStyle}
			value={namedSubmit.values['review-summary'] ?? ''}></textarea>

		<h3 style="margin: 0; font-size: 0.9rem;">Observed state — the live bindable props</h3>
		<textarea readonly aria-label="live value" data-testid="live-value" style={outputStyle} {value}
		></textarea>
		<textarea
			readonly
			aria-label="live threads JSON"
			data-testid="live-threads-json"
			style={outputStyle}
			value={liveThreadsJson}></textarea>
	</section>

	<section style="display: grid; gap: 0.75rem;">
		<h2 style="margin: 0;">
			The imperative surface behind <code>bind:this</code>
		</h2>
		<p data-testid="instance-keys" style="margin: 0; word-break: break-all;">{instanceKeys}</p>
		<div style="display: flex; gap: 0.5rem;">
			<button type="button" data-testid="read-form-data" onclick={readImperativeFormData}>
				Read getFormData()
			</button>
			<button type="button" data-testid="read-state-keys" onclick={readImperativeStateKeys}>
				Read getState() keys
			</button>
		</div>
		<p data-testid="imperative-state-keys" style="margin: 0;">{imperativeStateKeys}</p>
		<textarea
			readonly
			aria-label="getFormData() result"
			data-testid="imperative-form-data"
			style={outputStyle}
			value={imperativeFormData}></textarea>
	</section>

	<section style="display: grid; gap: 0.75rem;">
		<h2 style="margin: 0;">The same five values, from the pure module functions</h2>
		<textarea
			readonly
			aria-label="buildFormDataFromValues original"
			data-testid="module-original"
			style={outputStyle}
			value={fromValues.original}></textarea>
		<textarea
			readonly
			aria-label="buildFormDataFromValues current"
			data-testid="module-current"
			style={outputStyle}
			value={fromValues.current}></textarea>
		<textarea
			readonly
			aria-label="buildFormDataFromValues comments"
			data-testid="module-comments-from-values"
			style={outputStyle}
			value={fromValues.comments}></textarea>
		<textarea
			readonly
			aria-label="buildFormData comments"
			data-testid="module-comments-from-state"
			style={outputStyle}
			value={fromState.comments}></textarea>
		<textarea
			readonly
			aria-label="exportUnifiedDiff diff"
			data-testid="module-diff"
			style={outputStyle}
			value={moduleDiff}></textarea>
		<textarea
			readonly
			aria-label="exportMarkdownSummary markdown"
			data-testid="module-summary"
			style={outputStyle}
			value={moduleSummary}></textarea>
		<textarea
			readonly
			aria-label="getSummaryContentWithoutHeading"
			data-testid="module-summary-without-heading"
			style={outputStyle}
			value={summaryWithoutHeading}></textarea>
		<textarea
			readonly
			aria-label="generateMarkdownSummary markdown"
			data-testid="core-summary"
			style={outputStyle}
			value={coreSummary}></textarea>
		<textarea
			readonly
			aria-label="exportCommentsMarkdown"
			data-testid="module-comments-markdown"
			style={outputStyle}
			value={moduleComments}></textarea>
		<textarea
			readonly
			aria-label="generateCommentsJSON"
			data-testid="module-comments-json"
			style={outputStyle}
			value={moduleCommentsJson}></textarea>
	</section>

	<section style="display: grid; gap: 0.75rem;">
		<h2 style="margin: 0;"><code>normalizeInputs</code>, on and off</h2>
		<p data-testid="normalized-stats" style="margin: 0;">
			additions:{normalizedFormattingOnly.stats.additions} deletions:{normalizedFormattingOnly.stats
				.deletions} hunks:{normalizedFormattingOnly.stats.hunks}
		</p>
		<textarea
			readonly
			aria-label="normalized formatting-only diff"
			data-testid="normalized-diff"
			style={outputStyle}
			value={normalizedFormattingOnly.diff}></textarea>
		<p data-testid="raw-stats" style="margin: 0;">
			additions:{rawFormattingOnly.stats.additions} deletions:{rawFormattingOnly.stats.deletions}
			hunks:{rawFormattingOnly.stats.hunks}
		</p>
		<textarea
			readonly
			aria-label="un-normalized formatting-only diff"
			data-testid="raw-diff"
			style={outputStyle}
			value={rawFormattingOnly.diff}></textarea>
		<p data-testid="formatting-only-summary-stats" style="margin: 0;">
			changeCount:{formattingOnlySummary.stats.changeCount} threadCount:{formattingOnlySummary.stats
				.threadCount}
		</p>
		<textarea
			readonly
			aria-label="formatting-only markdown summary"
			data-testid="formatting-only-summary"
			style={outputStyle}
			value={formattingOnlySummary.markdown}></textarea>
	</section>

	<section style="display: grid; gap: 0.75rem;">
		<h2 style="margin: 0;"><code>generateCommentsExport</code> fallbacks</h2>
		<textarea
			readonly
			aria-label="location from originalPosition"
			data-testid="location-position"
			style={outputStyle}
			value={locationWithPosition}></textarea>
		<textarea
			readonly
			aria-label="location from lastKnownOffset"
			data-testid="location-offset"
			style={outputStyle}
			value={locationWithOffset}></textarea>
		<textarea
			readonly
			aria-label="location unknown"
			data-testid="location-unknown"
			style={outputStyle}
			value={locationUnknown}></textarea>
		<textarea
			readonly
			aria-label="unparseable createdAt"
			data-testid="unparseable-timestamp"
			style={outputStyle}
			value={unparseableTimestamp}></textarea>
		<textarea
			readonly
			aria-label="empty comments export"
			data-testid="empty-comments-export"
			style={outputStyle}
			value={emptyCommentsExport}></textarea>
		<textarea
			readonly
			aria-label="all soft-deleted comments export"
			data-testid="all-soft-deleted-export"
			style={outputStyle}
			value={allSoftDeletedExport}></textarea>
	</section>

	<section style="display: grid; gap: 0.75rem;">
		<h2 style="margin: 0;">No <code>name</code> prop at all</h2>
		<form
			id="exports-unnamed-form"
			onsubmit={(event) => {
				event.preventDefault();
				unnamedSubmit = readForm(event.currentTarget);
				unnamedSubmitCount += 1;
			}}
			style="display: grid; gap: 0.75rem;"
		>
			<div data-testid="unnamed-editor" style={paneStyle}>
				<ReviewEditor
					id="exports-unnamed"
					original={ORIGINAL}
					bind:value={unnamedValue}
					currentUserId="steve"
				/>
			</div>
			<div>
				<button type="submit" data-testid="submit-unnamed">Submit unnamed</button>
			</div>
		</form>
		<p data-testid="unnamed-submit-count" style="margin: 0;">submits: {unnamedSubmitCount}</p>
		<p data-testid="unnamed-form-keys" style="margin: 0;">{unnamedSubmit.keys.join(',')}</p>
	</section>

	<section style="display: grid; gap: 0.75rem;">
		<h2 style="margin: 0;">
			No <code>original</code>, but <code>name="bare"</code>
		</h2>
		<form
			id="exports-no-original-form"
			onsubmit={(event) => {
				event.preventDefault();
				bareSubmit = readForm(event.currentTarget);
				bareSubmitCount += 1;
			}}
			style="display: grid; gap: 0.75rem;"
		>
			<div data-testid="bare-editor" style={paneStyle}>
				<ReviewEditor
					id="exports-no-original"
					bind:value={bareValue}
					currentUserId="steve"
					name="bare"
				/>
			</div>
			<div>
				<button type="submit" data-testid="submit-bare">Submit bare</button>
			</div>
		</form>
		<p data-testid="bare-submit-count" style="margin: 0;">submits: {bareSubmitCount}</p>
		<p data-testid="bare-form-keys" style="margin: 0;">{bareSubmit.keys.join(',')}</p>
		<p data-testid="bare-line-count" style="margin: 0;">lines: {bareLineCount}</p>
		<textarea
			readonly
			aria-label="submitted bare-original"
			data-testid="bare-submitted-original"
			style={outputStyle}
			value={bareSubmit.values['bare-original'] ?? ''}></textarea>
		<textarea
			readonly
			aria-label="submitted bare-diff"
			data-testid="bare-submitted-diff"
			style={outputStyle}
			value={bareSubmit.values['bare-diff'] ?? ''}></textarea>
	</section>

	<section style="display: grid; gap: 0.75rem;">
		<h2 style="margin: 0;">
			Orphaned, anchored, and document-level threads — <code>name="orphan"</code>
		</h2>
		<p style="margin: 0;">
			No wrapping form: the five hidden inputs render wherever <code>name</code> is set, and reading one
			directly is the same string a submit would carry.
		</p>
		<button type="button" data-testid="orphan-delete" onclick={deleteAnchoredPhrase}>
			Delete the anchored phrase
		</button>
		<div data-testid="orphan-editor" style={paneStyle}>
			<ReviewEditor
				bind:this={orphanEditor}
				id="exports-orphan"
				original={ORPHAN_DOCUMENT}
				bind:value={orphanValue}
				bind:threads={orphanThreads}
				currentUserId="steve"
				name="orphan"
			/>
		</div>
		<p data-testid="orphan-thread-statuses" style="margin: 0;">{orphanStatuses}</p>
		<p data-testid="orphan-thread-count" style="margin: 0;">threads: {orphanThreads.length}</p>
		<p data-testid="orphan-module-stats" style="margin: 0;">
			changeCount:{orphanModuleSummary.stats.changeCount} threadCount:{orphanModuleSummary.stats
				.threadCount}
		</p>
		<textarea
			readonly
			aria-label="orphan fixture live value"
			data-testid="orphan-live-value"
			style={outputStyle}
			value={orphanValue}></textarea>
		<textarea
			readonly
			aria-label="orphan fixture module summary"
			data-testid="orphan-module-summary"
			style={outputStyle}
			value={orphanModuleSummary.markdown}></textarea>
	</section>
</div>

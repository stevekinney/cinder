<script lang="ts">
	import { ReviewEditor, type Thread } from '@lostgradient/editor/review-editor';

	// ReviewEditor's *view* layer: the editor/diff/summary tablist, the diff
	// view-mode radiogroup, DiffStatistics, and Revert All. All of them want the
	// same fixture — a document whose `original` differs from `value` by exactly
	// one modified line and one added line — plus companion instances that vary
	// only in `original`, so the whole set lives on one route rather than
	// spread across several.
	//
	// Deliberately NOT exercised here: live-region announcement text ("Switched
	// to diff view") and pre-hydration / SSR roving-tabindex state.
	// `review-ssr-and-a11y` owns every live region and every SSR assertion; the
	// live region is `cinder-sr-only`, so it is not visible text and has to be
	// read through `[role="status"]` there rather than a text locator here.
	// Readonly mechanics belong to `review-modes`; the readonly instance below
	// exists only to show the `!readonly` half of Revert All's gate.

	const original = `# Release Plan

The first release includes a dashboard and export actions.

## Checklist

- Finalize the component API
- Add playground coverage`;

	// One modified line (the paragraph gains ", and inline review") and one added
	// line (the third checklist item). That is what makes the toolbar read
	// "2 lines changed" with a `1 line added` chip and a `1 line modified` chip
	// and no `removed` chip at all — DiffStatistics is mounted with
	// `zeroVisible={false}`, so a zero category is omitted rather than rendered
	// as "0 removed".
	const edited = `# Release Plan

The first release includes a dashboard, export actions, and inline review.

## Checklist

- Finalize the component API
- Add playground coverage
- Document review export behavior`;

	// Only the main instance is bindable. Revert All rewrites `value`, and the
	// companion instances below take the frozen `edited` constant instead, so a
	// revert in one instance cannot silently re-shape another instance's diff.
	let value = $state(edited);

	// The summary view stitches thread commentary into a `## Feedback` section
	// keyed by the anchor's quote, so the fixture needs a real anchored thread
	// to make that section reachable.
	//
	// `from`/`to` are PROSEMIRROR POSITIONS. "# " is markup rather than text, so
	// the document's first text position is 1 and the 12-character quote
	// "Release Plan" occupies 1..13. `lastKnownOffset` is a `textBetween()`
	// offset — a different coordinate space living in the same object. An anchor
	// whose quote is not actually at its stated range triggers re-anchoring
	// rather than painting a bogus whole-document highlight.
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
					id: 'comment-release-plan-title',
					threadId: 'thread-release-plan-title',
					authorId: 'maya',
					body: 'Title reads well — keep it.',
					createdAt: '2026-08-11T12:00:00.000Z'
				}
			]
		}
	]);

	// `onchange` is notification-only — the component owns the mutation through
	// the bindable `value`. Revert All is the only control on this route that
	// fires it, so this log is how the spec proves it fired exactly once and
	// with `original` as its payload.
	let changePayloads = $state<string[]>([]);
	const recordChange = (next: string) => {
		changePayloads = [...changePayloads, next];
	};

	// A pair that differs ONLY in bold syntax. This is the load-bearing fixture
	// for a real inconsistency: the toolbar's stats run both sides through
	// `normalize()` from the markdown pipeline, which canonicalises `__x__` to
	// `**x**` — so the two documents become identical and every count is zero —
	// while the rendered DiffViewer runs its own regex `normalizeForDiff()`,
	// which leaves bold syntax alone and reads the line as modified. The result
	// is a panel full of modified rows above a toolbar that believes nothing
	// changed: no statistics chip and, because Revert All is gated on the same
	// zero stats, no way to revert the difference the panel is showing.
	const formattingOnlyOriginal = `# Release Plan

The __first__ release includes a dashboard.`;

	const formattingOnlyValue = `# Release Plan

The **first** release includes a dashboard.`;

	// `original === value` and no threads: the only combination that reaches the
	// summary view's empty state instead of a generated summary document.
	const unchanged = `# Release Plan

Nothing has been edited yet.`;
</script>

<div style="max-width: 72rem; margin: 0 auto; padding: 1rem; display: grid; gap: 1.5rem;">
	<section style="display: grid; gap: 0.5rem;">
		<h2 style="margin: 0;">Views and diff</h2>
		<div data-testid="views-main" style="min-height: 22rem;">
			<ReviewEditor
				id="views-editor"
				{original}
				bind:value
				bind:threads
				currentUserId="steve"
				placeholder="Start reviewing…"
				onchange={recordChange}
			/>
		</div>
	</section>

	<section style="display: grid; gap: 0.5rem;">
		<h2 style="margin: 0; font-size: 1rem;">No baseline (<code>original</code> omitted)</h2>
		<!-- `showDiffTabs={!!original}`, and the wrapper defaults `original` to
		     `''`, so an omitted baseline collapses the tablist to the Editor tab
		     alone. There is nothing to diff, so no statistics and no Revert All. -->
		<div data-testid="views-no-original" style="min-height: 16rem;">
			<ReviewEditor id="views-no-original-editor" value={edited} currentUserId="steve" />
		</div>
	</section>

	<section style="display: grid; gap: 0.5rem;">
		<h2 style="margin: 0; font-size: 1rem;">Empty baseline (<code>original=""</code>)</h2>
		<!-- The same gate reached explicitly rather than by omission: `!!''` is
		     false, so an empty-string baseline is indistinguishable from none. -->
		<div data-testid="views-empty-original" style="min-height: 16rem;">
			<ReviewEditor
				id="views-empty-original-editor"
				original=""
				value={edited}
				currentUserId="steve"
			/>
		</div>
	</section>

	<section style="display: grid; gap: 0.5rem;">
		<h2 style="margin: 0; font-size: 1rem;">Readonly with a baseline</h2>
		<!-- Here only for the `!readonly` half of Revert All's gate. The rest of
		     readonly's behaviour belongs to `review-modes`. -->
		<div data-testid="views-readonly" style="min-height: 16rem;">
			<ReviewEditor id="views-readonly-editor" {original} value={edited} mode="readonly" />
		</div>
	</section>

	<section style="display: grid; gap: 0.5rem;">
		<h2 style="margin: 0; font-size: 1rem;">Nothing to summarize</h2>
		<!-- `original === value` and `threads: []` — the summary view falls back
		     to its empty region instead of rendering a generated document. This
		     needs its own instance because the fixture contradicts the main one. -->
		<div data-testid="views-summary-empty" style="min-height: 16rem;">
			<ReviewEditor
				id="views-summary-empty-editor"
				original={unchanged}
				value={unchanged}
				threads={[]}
				currentUserId="steve"
			/>
		</div>
	</section>

	<section style="display: grid; gap: 0.5rem;">
		<h2 style="margin: 0; font-size: 1rem;">Formatting-only difference</h2>
		<!-- Two normalisers, one surface: see the comment on the fixture above. -->
		<div data-testid="views-formatting-only" style="min-height: 16rem;">
			<ReviewEditor
				id="views-formatting-only-editor"
				original={formattingOnlyOriginal}
				value={formattingOnlyValue}
				currentUserId="steve"
			/>
		</div>
	</section>

	<section style="display: grid; gap: 0.5rem;">
		<h2 style="margin: 0; font-size: 1rem;">Observed state</h2>
		<p data-testid="original-length" style="margin: 0;">original length: {original.length}</p>
		<p data-testid="value-length" style="margin: 0;">value length: {value.length}</p>
		<p data-testid="value-equals-original" style="margin: 0;">
			value equals original: {value === original}
		</p>
		<p data-testid="change-count" style="margin: 0;">changes: {changePayloads.length}</p>
		<p data-testid="last-change-is-original" style="margin: 0;">
			last change is original: {changePayloads.length > 0 &&
				changePayloads[changePayloads.length - 1] === original}
		</p>
	</section>
</div>

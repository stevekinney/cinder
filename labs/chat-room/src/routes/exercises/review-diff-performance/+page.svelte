<script lang="ts">
	import { ReviewEditor, createReviewEditorState } from '@lostgradient/editor/review-editor';

	// ROADMAP X-1: per-keystroke diff cost.
	//
	// `review-editor-impl.svelte` (the component actually shipped, not the
	// experimental DEP-422 parity module) computes its toolbar badge with:
	//
	//   const diffStats = $derived.by(() => computeReviewEditorDiffStats(original, value));
	//
	// `computeReviewEditorDiffStats` is NOT part of the package's public export
	// surface, but `createReviewEditorState` — which wraps the exact same
	// function, imported from the exact same module — is (`./review-editor`
	// subpath, re-exported from `dist/components/review-editor/index.js`). Using
	// it here means every sample below times the literal shipped function, not a
	// hand-rolled approximation of it.
	//
	// One thing this page's own instrumentation found, worth stating before the
	// numbers: `value` is NOT updated on every physical keydown. `MarkdownEditor`
	// only writes its bindable `value` from `@milkdown/plugin-listener`'s onchange
	// callback, which stacks a 300ms `changeDebounceMs` (`DEFAULT_DEBOUNCE_MS` in
	// `editor/types.js`) on top of that plugin's own ~200ms internal debounce —
	// documented in `markdown-editor.svelte`'s placeholder comment. So during a
	// fast, continuous typing burst, `computeReviewEditorDiffStats` fires far less
	// often than once per keydown. The e2e spec paces keystrokes to wait for each
	// debounced settle before sending the next one specifically so it can still
	// report one real recompute per keystroke — the literal reading of the
	// ROADMAP item — while this comment records the mechanism that makes "per
	// keystroke" not quite mean what it sounds like for a fast typist.

	// ── A large, structured document ─────────────────────────────────────────
	// Front matter, 14 `##` sections of 9 paragraphs each (5 sentences/paragraph,
	// drawn from a rotating pool so no two paragraphs are byte-identical), and a
	// bullet list every third section — headings, prose, and lists, the shape
	// `CLAUDE.md` asks for. Exact line/word/char counts are computed below and
	// exposed to the spec rather than asserted from this comment, so "large
	// enough to matter" is a checked fact, not a claim.
	const SENTENCES = [
		'The migration script has not been exercised against a production-sized dataset yet.',
		'Rollout is staged behind a feature flag so a bad batch can be disabled without a deploy.',
		'The review board asked for a rollback plan before this ships to the first cohort.',
		'Latency regressed by a small but measurable amount in the canary environment.',
		'Ownership of the on-call rotation moves to the platform team once this lands.',
		'The client library still needs a changelog entry describing the breaking change.',
		'Three teams depend on the old response shape and have not migrated yet.',
		'The index rebuild takes roughly four hours on the current hardware tier.',
		'Nobody has confirmed whether the staging environment mirrors production traffic patterns.',
		'The design doc under-specified what happens when the queue backs up.',
		'A follow-up spike will measure whether the cache hit rate holds under load.',
		'The security review flagged one dependency with a known, unpatched advisory.',
		'Support has not been briefed on the new error messages this introduces.',
		'The dashboard needs a new panel before anyone can watch this rollout live.',
		'Two of the five acceptance criteria are still open pending a design decision.',
		'The previous attempt at this migration was rolled back after a week in production.',
		'Nothing in the current test suite exercises the retry path under partial failure.',
		'The on-call runbook has not been updated to reflect the new failure modes.',
		'A capacity review is scheduled for next week, before the wider rollout begins.',
		'The API contract change is backward compatible for every consumer except one.'
	];

	const SECTION_TITLES = [
		'Background',
		'Goals and non-goals',
		'Current architecture',
		'Proposed architecture',
		'Data migration',
		'Rollout plan',
		'Risks and mitigations',
		'Monitoring and alerting',
		'Rollback plan',
		'Client impact',
		'Security review',
		'Open questions',
		'Timeline',
		'Appendix'
	];

	function buildLargeDocument(): string {
		const frontMatter = [
			'---',
			'title: Platform Migration Design Doc',
			'status: draft',
			'owners:',
			'  - maya',
			'  - steve',
			'---',
			''
		].join('\n');

		const lines: string[] = [];
		for (let section = 0; section < SECTION_TITLES.length; section++) {
			lines.push(`## ${section + 1}. ${SECTION_TITLES[section]}`);
			lines.push('');
			for (let para = 0; para < 9; para++) {
				const sentences = Array.from(
					{ length: 5 },
					(_, i) => SENTENCES[(section * 11 + para * 5 + i) % SENTENCES.length]
				);
				lines.push(sentences.join(' '));
				lines.push('');
			}
			if (section % 3 === 2) {
				lines.push('- Risk: the rollout window is tighter than the team would like.');
				lines.push('- Risk: the migration script is still untested at production scale.');
				lines.push('- Mitigation: stage behind a feature flag and watch the canary cohort.');
				lines.push('');
			}
		}
		// A short, unique, unwrapped trailing line the spec clicks on and presses
		// `End` against, so it can reach an exact, deterministic typing position
		// without needing a document-wide "go to end" keybinding this editor
		// doesn't have.
		lines.push('Open questions are tracked separately.');

		return frontMatter + lines.join('\n');
	}

	const LARGE_DOCUMENT = buildLargeDocument();

	const documentStats = {
		lines: LARGE_DOCUMENT.split('\n').length,
		words: LARGE_DOCUMENT.split(/\s+/).filter(Boolean).length,
		chars: LARGE_DOCUMENT.length
	};

	// `original` is a plain, non-reactive constant — mirroring how a real review
	// session holds the baseline fixed for its whole lifetime while `value`
	// moves under editing. This is also the exact shape cinder#1336 was filed
	// against: `original` never changes here, so a correct implementation should
	// normalize it once and reuse the result on every later recompute rather than
	// re-normalizing it alongside `current` each time. As of the installed
	// `@lostgradient/editor@0.12.1`, `computeReviewEditorDiffStats` does exactly
	// that (a bounded, value-keyed cache — see `ROADMAP.md`'s `X-1` entry), so
	// this exercise now measures the FIXED, cached function, not the bug that
	// motivated it. The numbers below reflect that fix, not the ~30ms/recompute
	// finding that got #1336 filed in the first place.
	const original = LARGE_DOCUMENT;

	let value = $state(LARGE_DOCUMENT);

	const diffState = createReviewEditorState({
		getOriginal: () => original,
		getValue: () => value,
		getThreads: () => []
	});

	// One performance.now() sample per real recompute of `diffState.diffStats` —
	// i.e. per debounced settle of `value`, not per raw keydown (see the comment
	// above). `diffState` here is a standalone instance the page owns; nothing
	// else reads `.diffStats`, so this effect is the sole trigger for (and sole
	// observer of) each recompute, and the timing bracket is exact.
	//
	// `sampleLog` is a deliberately PLAIN (non-reactive) array, not `$state`.
	// Pushing onto a `$state` array from inside the very effect that reads it
	// (even indirectly — `Array.prototype.push` reads `.length` before writing
	// it) makes that effect both read and write the same signal in one run,
	// which is Svelte 5's canonical `effect_update_depth_exceeded` loop. Only
	// `sampleCount`, a plain write with no self-read, is reactive; `samplesJson`
	// re-derives off it and reads the current `sampleLog` each time.
	let sampleLog: number[] = [];
	let sampleCount = $state(0);
	const samplesJson = $derived.by(() => {
		void sampleCount;
		return JSON.stringify(sampleLog);
	});

	$effect(() => {
		void value;
		const start = performance.now();
		const stats = diffState.diffStats;
		const elapsed = performance.now() - start;
		// Touch every field so a future optimization that makes `diffStats` lazier
		// than a plain object literal can't skip real work unnoticed.
		const touched = stats.added + stats.removed + stats.modified;
		void touched;
		sampleLog.push(elapsed);
		sampleCount = sampleLog.length;
	});
</script>

<div style="max-width: 72rem; margin: 0 auto; padding: 1rem; display: grid; gap: 1.5rem;">
	<h1 style="margin: 0; font-size: 1.25rem;">Review diff performance</h1>
	<p style="margin: 0;">
		ROADMAP X-1: per-keystroke cost of the toolbar's live diff recompute, measured against a large
		document via <code>createReviewEditorState</code>'s exported <code>diffStats</code>
		getter — the same <code>computeReviewEditorDiffStats</code> the shipped component's own toolbar badge
		uses.
	</p>

	<section style="display: grid; gap: 0.25rem;">
		<p data-testid="diff-perf-doc-lines" style="margin: 0;">{documentStats.lines}</p>
		<p data-testid="diff-perf-doc-words" style="margin: 0;">{documentStats.words}</p>
		<p data-testid="diff-perf-doc-chars" style="margin: 0;">{documentStats.chars}</p>
	</section>

	<div data-testid="diff-perf-wrapper" style="min-height: 34rem;">
		<ReviewEditor id="diff-perf" bind:value {original} currentUserId="steve" />
	</div>

	<p data-testid="diff-perf-sample-count" style="margin: 0;">{sampleCount}</p>
	<pre data-testid="diff-perf-samples" data-value={samplesJson} style="margin: 0;"></pre>
</div>

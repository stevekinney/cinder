<script lang="ts">
	import { ReviewEditor, type Thread } from '@lostgradient/editor/review-editor';
	import { generateMarkdownSummary, generateUnifiedDiff } from '@lostgradient/editor/export';

	// YAML front matter is the one document feature that changes what every
	// OTHER review-editor surface means. `parseFrontMatter` splits the document
	// into a front-matter block and a body; the editor only ever holds the body,
	// so every ProseMirror position the component publishes is shifted by
	// `bodyOffset` (the character length of the block plus its delimiters).
	// Recognition, the generated field controls, what an edit rewrites, and the
	// downstream damage to anchors and diffs therefore all belong on one page —
	// they are the same mechanism observed at four distances.
	//
	// Every fixture renders its bound `value` twice: readably in a `<pre>`, and
	// exactly in a `data-value` attribute holding `JSON.stringify(value)`. The
	// attribute is the assertion surface on purpose — Playwright's text matchers
	// collapse whitespace runs (which would hide `  owner: maya`'s indentation)
	// and the HTML parser normalizes `\r\n` to `\n` inside element text, which
	// would silently "fix" the CRLF fixture. A JSON-escaped attribute has no
	// literal whitespace at all, so `toHaveAttribute` compares byte-for-byte.

	const json = (value: unknown) => JSON.stringify(value);

	// ── Recognized, fully-typed front matter ────────────────────────────────
	// One key per control type the component knows how to render: string,
	// boolean, number, a block sequence, and a nested mapping.
	const FULL_DOCUMENT = [
		'---',
		'title: Release Plan',
		'draft: true',
		'priority: 3',
		'tags:',
		'  - alpha',
		'  - beta',
		'meta:',
		'  owner: maya',
		'---',
		'',
		'# Release Plan',
		'',
		'Alpha line.'
	].join('\n');

	let fullValue = $state(FULL_DOCUMENT);

	// `onchange` is notification-only (the bindable `value` is what actually
	// mutates), so recording its argument is the only way to see whether the
	// component hands back the recombined FULL document or just the body.
	let fullChanges = $state<string[]>([]);

	// ── Malformed YAML ──────────────────────────────────────────────────────
	// `[unclosed` opens a flow sequence that never closes — a genuine YAML
	// syntax error. Before cinder#1325/#1330, `parseFrontMatter` still reported
	// `hasFrontMatter: true` (the delimiters are well formed) with `data: null`,
	// which is what used to drop the component into a raw YAML fallback editor
	// (and `console.warn` "Failed to parse front matter:"). #1330 folded a
	// genuine parse failure into the same `hasFrontMatter: false` branch as an
	// unrecognized delimiter, so this document is no longer treated as front
	// matter at all: the whole thing, `---` lines included, is now ordinary
	// body content, and neither the raw editor nor the console warning appear
	// anymore. See `review-front-matter.e2e.ts`'s "malformed YAML" test.
	const BAD_DOCUMENT = [
		'---',
		'title: [unclosed',
		'  - what',
		'---',
		'',
		'# Release Plan',
		'',
		'Alpha line.'
	].join('\n');

	let badValue = $state(BAD_DOCUMENT);

	// ── Empty front matter ──────────────────────────────────────────────────
	const EMPTY_DOCUMENT = ['---', '---', '', 'Body.'].join('\n');
	let emptyValue = $state(EMPTY_DOCUMENT);

	// ── Null-valued keys ────────────────────────────────────────────────────
	// `empty:` (bare) and `nothing: null` (explicit) both parse to JS `null`,
	// so the two spellings are indistinguishable by the time the UI sees them.
	const NULL_DOCUMENT = ['---', 'empty:', 'nothing: null', '---', '', 'Body.'].join('\n');
	let nullValue = $state(NULL_DOCUMENT);

	// ── Readonly ────────────────────────────────────────────────────────────
	let readonlyValue = $state(FULL_DOCUMENT);

	// ── Anchors across a front-matter edit ──────────────────────────────────
	// The thread anchors below are in DOCUMENT coordinates, which for this
	// component means "body ProseMirror position + bodyOffset". That is a
	// genuinely mixed coordinate space: `from`/`to` are ProseMirror positions
	// inside the body document, and `bodyOffset` is a raw character count of
	// the front-matter block. The component adds them together anyway
	// (`review-editor-front-matter.ts` → `bodyAnchorToDocumentAnchor`).
	//
	// For FULL_DOCUMENT the front-matter block is 97 characters (`---\n` +
	// 89 characters of YAML + `---\n`), so bodyOffset = 97. The body is
	// `\n# Release Plan\n\nAlpha line.`; inside it the 12-character quote
	// "Release Plan" is ProseMirror 1..13 ("# " is markup, not text). Hence
	// from = 98, to = 110. `lastKnownOffset` is a `textBetween()` offset (0)
	// in the same object — a different coordinate space again — so it lands at
	// 97. `originalPosition.offset` follows the same +bodyOffset rule, and its
	// line/column describe character offset 97 in the whole document, which is
	// the start of line 11 (the blank line after the closing `---`).
	let anchorsValue = $state(FULL_DOCUMENT);
	let anchorThreads = $state<Thread[]>([
		{
			id: 'thread-fm-title',
			createdAt: '2026-08-11T12:00:00.000Z',
			anchor: {
				type: 'text',
				from: 98,
				to: 110,
				quote: 'Release Plan',
				prefix: '# ',
				suffix: '\n\nAlpha line.',
				status: 'anchored',
				originalQuote: 'Release Plan',
				lastKnownOffset: 97,
				originalPosition: { offset: 97, line: 11, column: 1 }
			},
			comments: [
				{
					id: 'comment-fm-title',
					threadId: 'thread-fm-title',
					authorId: 'maya',
					body: 'Heading anchored in the body, below the front matter.',
					createdAt: '2026-08-11T12:00:00.000Z'
				}
			]
		},
		{
			// A document-level anchor: `offsetAnchor` returns these untouched, so
			// this thread is the control group for the remap below.
			id: 'thread-fm-document',
			createdAt: '2026-08-11T12:00:00.000Z',
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
					id: 'comment-fm-document',
					threadId: 'thread-fm-document',
					authorId: 'steve',
					body: 'Document-level note.',
					createdAt: '2026-08-11T12:00:00.000Z'
				}
			]
		}
	]);

	const textAnchor = $derived(
		anchorThreads.find((thread) => thread.id === 'thread-fm-title')?.anchor
	);
	const documentAnchor = $derived(
		anchorThreads.find((thread) => thread.id === 'thread-fm-document')?.anchor
	);

	// Independently computed body offset, mirroring `parseFrontMatter`'s rule
	// (open at byte 0, close on a line that is exactly `---`, then swallow one
	// newline). Rendering it lets the spec check the anchor shift against a
	// number that did NOT come out of the component.
	function bodyOffsetOf(markdown: string): number {
		if (!markdown.startsWith('---')) return 0;
		const firstLineEnd = markdown.indexOf('\n');
		if (firstLineEnd === -1) return 0;
		const rest = markdown.slice(firstLineEnd + 1);
		const closing = rest.match(/^---[ \t]*\r?$/m);
		if (!closing || closing.index === undefined) return 0;
		const closingEnd = firstLineEnd + 1 + closing.index + closing[0].length;
		const afterClosing = markdown.slice(closingEnd);
		const body = afterClosing.startsWith('\r\n')
			? afterClosing.slice(2)
			: /^[\n\r]/.test(afterClosing)
				? afterClosing.slice(1)
				: afterClosing;
		return markdown.length - body.length;
	}

	// ── Non-recognition matrix ──────────────────────────────────────────────
	// Four near-misses. Only the CRLF variant is recognized; `---` must be an
	// exact opener at byte 0 and the closer must be a line of exactly `---`.
	const FOUR_DASH_DOCUMENT = ['----', 'title: x', '----', '', 'Body.'].join('\n');
	const DOTS_DOCUMENT = ['---', 'title: x', '...', '', 'Body.'].join('\n');
	const LEADING_BLANK_DOCUMENT = ['', '---', 'title: x', '---', '', 'Body.'].join('\n');
	const CRLF_DOCUMENT = ['---', 'title: x', 'draft: true', '---', '', 'Body.'].join('\r\n');

	let fourDashValue = $state(FOUR_DASH_DOCUMENT);
	let dotsValue = $state(DOTS_DOCUMENT);
	let leadingBlankValue = $state(LEADING_BLANK_DOCUMENT);
	let crlfValue = $state(CRLF_DOCUMENT);

	// ── Diff corruption ─────────────────────────────────────────────────────
	// A pair whose ONLY difference is `draft: true` → `draft: false` (with the
	// keys alphabetized, i.e. exactly what a front-matter edit produces).
	// `generateUnifiedDiff` defaults to `normalizeInputs: true`, which runs the
	// whole document through the markdown pipeline's `normalize()`. That
	// pipeline has no front-matter step here, so `---` at the top becomes a
	// thematic break and the YAML lines become a paragraph terminated by the
	// second `---`, i.e. a SETEXT HEADING. Re-serializing writes the setext
	// underline as a run of dashes as long as the longest line, inventing a
	// line that exists in neither input document.
	const DIFF_ORIGINAL = [
		'---',
		'title: Release Plan',
		'draft: true',
		'---',
		'',
		'# Release Plan',
		'',
		'Alpha line.'
	].join('\n');
	const DIFF_CURRENT = [
		'---',
		'draft: false',
		'title: Release Plan',
		'---',
		'',
		'# Release Plan',
		'',
		'Alpha line.'
	].join('\n');

	const diffState = {
		schemaVersion: 4 as const,
		content: DIFF_CURRENT,
		original: DIFF_ORIGINAL,
		threads: [],
		updatedAt: '2026-08-11T12:00:00.000Z'
	};

	const defaultDiff = generateUnifiedDiff(diffState);
	const rawDiff = generateUnifiedDiff(diffState, { normalizeInputs: false });

	let diffValue = $state(DIFF_CURRENT);

	// ── Blank-line normalization agreement (ROADMAP X-2, fixed) ──────────────
	// The pair above shows generateUnifiedDiff and generateMarkdownSummary
	// AGREEING: same front matter, same body, one YAML value changed, both
	// functions report the same edit. This pair used to make them DISAGREE.
	// Front matter and body text are byte-identical between original and
	// current; the ONLY difference is how many blank lines separate the
	// closing `---` from the body (one vs. three).
	//
	// generateUnifiedDiff's normalizeDocument (normalizeInputs defaults to
	// true) re-attaches front matter to the body with a single hardcoded `\n`
	// separator and runs the body through the markdown pipeline's normalize(),
	// which strips every leading blank line before re-serializing — so ANY
	// number of blank lines there (1, 3, 12) collapses to the identical
	// normalized document. generateMarkdownSummary's computeLineDiff used to
	// run on the RAW strings with no normalization step at all, so it saw the
	// extra blank lines as real content — one function reported zero changes,
	// the other reported an edit. Fixed in `@lostgradient/editor@0.11.0`:
	// generateMarkdownSummary gained its own normalizeInputs option, defaulting
	// to true, routed through the same shared normalizeDocument as
	// generateUnifiedDiff, so both functions now collapse this fixture's
	// blank-line difference the same way and agree that nothing changed. Fixed
	// and verified in https://github.com/stevekinney/cinder/issues/1318.
	const BLANK_LINE_FRONT_MATTER = ['---', 'title: Release Plan', 'draft: true', '---'].join('\n');
	const BLANK_LINE_ORIGINAL = `${BLANK_LINE_FRONT_MATTER}\n\nAlpha line.`;
	const BLANK_LINE_CURRENT = `${BLANK_LINE_FRONT_MATTER}\n\n\n\nAlpha line.`;

	const blankLineState = {
		schemaVersion: 4 as const,
		content: BLANK_LINE_CURRENT,
		original: BLANK_LINE_ORIGINAL,
		threads: [],
		updatedAt: '2026-08-14T12:00:00.000Z'
	};

	const blankLineDiff = generateUnifiedDiff(blankLineState);
	const blankLineSummary = generateMarkdownSummary(blankLineState);

	// ROADMAP RE-2. The two `<pre>` blocks above are MODULE output — they prove
	// what `generateUnifiedDiff` does, not what the component ships. The
	// component has three export surfaces for the same string (the `fm-diff-diff`
	// hidden input, `exportUnifiedDiff()` through `bind:this`, and the "Git Diff"
	// item in the export menu), and the criterion asks for them to be asserted to
	// agree on a front-matter document. Reading the imperative one needs a bound
	// instance, so the fixture below grows one.
	//
	// Captured on click rather than `$derived`: `exportUnifiedDiff()` is a method
	// call that snapshots `getState()`, and driving it from a button is what makes
	// it the imperative path rather than a second rendering of the same
	// reactivity.
	let diffEditor = $state<ReturnType<typeof ReviewEditor> | undefined>(undefined);
	let imperativeDiff = $state('');
	let imperativeSummary = $state('');

	function readImperativeExports() {
		const editor = diffEditor;
		// No `?? ''` fallback: leaving these empty when the instance is missing
		// keeps "the editor never mounted" distinguishable from "the export is an
		// empty string", which is a real value `generateUnifiedDiff` returns.
		if (!editor) return;
		imperativeDiff = editor.exportUnifiedDiff().diff;
		imperativeSummary = editor.exportMarkdownSummary().markdown;
	}
</script>

<div style="max-width: 72rem; margin: 0 auto; padding: 1rem; display: grid; gap: 2.5rem;">
	<h1 style="margin: 0; font-size: 1.25rem;">Review front matter</h1>

	<section style="display: grid; gap: 0.5rem;">
		<h2 style="margin: 0; font-size: 1rem;">Recognized front matter — typed field controls</h2>
		<div data-testid="fm-full-wrapper" style="min-height: 34rem;">
			<ReviewEditor
				id="fm-full"
				bind:value={fullValue}
				currentUserId="steve"
				onchange={(next) => (fullChanges = [...fullChanges, next])}
			/>
		</div>
		<pre
			data-testid="fm-full-value"
			data-value={json(fullValue)}
			style="margin: 0; white-space: pre-wrap;">{fullValue}</pre>
		<p data-testid="fm-full-change-count" style="margin: 0;">{fullChanges.length}</p>
		<pre
			data-testid="fm-full-last-change"
			data-value={json(fullChanges.at(-1) ?? '')}
			style="margin: 0; white-space: pre-wrap;">{fullChanges.at(-1) ?? ''}</pre>
	</section>

	<section style="display: grid; gap: 0.5rem;">
		<h2 style="margin: 0; font-size: 1rem;">Malformed YAML — not recognized as front matter</h2>
		<div data-testid="fm-bad-wrapper" style="min-height: 34rem;">
			<ReviewEditor id="fm-bad" bind:value={badValue} currentUserId="steve" />
		</div>
		<pre
			data-testid="fm-bad-value"
			data-value={json(badValue)}
			style="margin: 0; white-space: pre-wrap;">{badValue}</pre>
	</section>

	<section style="display: grid; gap: 0.5rem;">
		<h2 style="margin: 0; font-size: 1rem;">
			Empty front matter (<code>---</code> then <code>---</code>)
		</h2>
		<div data-testid="fm-empty-wrapper" style="min-height: 24rem;">
			<ReviewEditor id="fm-empty" bind:value={emptyValue} currentUserId="steve" />
		</div>
		<pre
			data-testid="fm-empty-value"
			data-value={json(emptyValue)}
			style="margin: 0; white-space: pre-wrap;">{emptyValue}</pre>
	</section>

	<section style="display: grid; gap: 0.5rem;">
		<h2 style="margin: 0; font-size: 1rem;">Null values</h2>
		<div data-testid="fm-null-wrapper" style="min-height: 24rem;">
			<ReviewEditor id="fm-null" bind:value={nullValue} currentUserId="steve" />
		</div>
		<pre
			data-testid="fm-null-value"
			data-value={json(nullValue)}
			style="margin: 0; white-space: pre-wrap;">{nullValue}</pre>
	</section>

	<section style="display: grid; gap: 0.5rem;">
		<h2 style="margin: 0; font-size: 1rem;">Readonly mode</h2>
		<div data-testid="fm-readonly-wrapper" style="min-height: 34rem;">
			<ReviewEditor
				id="fm-readonly"
				mode="readonly"
				bind:value={readonlyValue}
				currentUserId="steve"
			/>
		</div>
		<pre
			data-testid="fm-readonly-value"
			data-value={json(readonlyValue)}
			style="margin: 0; white-space: pre-wrap;">{readonlyValue}</pre>
	</section>

	<section style="display: grid; gap: 0.5rem;">
		<h2 style="margin: 0; font-size: 1rem;">Anchors across a front-matter edit</h2>
		<div data-testid="fm-anchors-wrapper" style="min-height: 34rem;">
			<ReviewEditor
				id="fm-anchors"
				bind:value={anchorsValue}
				bind:threads={anchorThreads}
				currentUserId="steve"
			/>
		</div>
		<p data-testid="fm-anchors-body-offset" style="margin: 0;">{bodyOffsetOf(anchorsValue)}</p>
		<p data-testid="fm-anchor-from" style="margin: 0;">{textAnchor?.from}</p>
		<p data-testid="fm-anchor-to" style="margin: 0;">{textAnchor?.to}</p>
		<p data-testid="fm-anchor-last-known-offset" style="margin: 0;">
			{textAnchor?.lastKnownOffset}
		</p>
		<p data-testid="fm-anchor-original-offset" style="margin: 0;">
			{textAnchor?.originalPosition?.offset}
		</p>
		<p data-testid="fm-anchor-original-line" style="margin: 0;">
			{textAnchor?.originalPosition?.line}
		</p>
		<p data-testid="fm-anchor-original-column" style="margin: 0;">
			{textAnchor?.originalPosition?.column}
		</p>
		<p data-testid="fm-anchor-quote" style="margin: 0;">{textAnchor?.quote}</p>
		<p data-testid="fm-document-anchor-from" style="margin: 0;">{documentAnchor?.from}</p>
		<p data-testid="fm-document-anchor-to" style="margin: 0;">{documentAnchor?.to}</p>
		<p data-testid="fm-anchors-thread-count" style="margin: 0;">{anchorThreads.length}</p>
		<pre
			data-testid="fm-anchors-value"
			data-value={json(anchorsValue)}
			style="margin: 0; white-space: pre-wrap;">{anchorsValue}</pre>
	</section>

	<section style="display: grid; gap: 0.5rem;">
		<h2 style="margin: 0; font-size: 1rem;">Non-recognition matrix</h2>

		<h3 style="margin: 0; font-size: 0.9rem;">Four dashes — not a delimiter</h3>
		<div data-testid="fm-four-dash-wrapper" style="min-height: 18rem;">
			<ReviewEditor id="fm-four-dash" bind:value={fourDashValue} currentUserId="steve" />
		</div>

		<h3 style="margin: 0; font-size: 0.9rem;">YAML <code>...</code> terminator — not a closer</h3>
		<div data-testid="fm-dots-wrapper" style="min-height: 18rem;">
			<ReviewEditor id="fm-dots" bind:value={dotsValue} currentUserId="steve" />
		</div>

		<h3 style="margin: 0; font-size: 0.9rem;">Leading blank line — opener is not at byte 0</h3>
		<div data-testid="fm-leading-blank-wrapper" style="min-height: 18rem;">
			<ReviewEditor id="fm-leading-blank" bind:value={leadingBlankValue} currentUserId="steve" />
		</div>

		<h3 style="margin: 0; font-size: 0.9rem;">CRLF line endings — recognized</h3>
		<div data-testid="fm-crlf-wrapper" style="min-height: 18rem;">
			<ReviewEditor id="fm-crlf" bind:value={crlfValue} currentUserId="steve" />
		</div>
		<pre
			data-testid="fm-crlf-value"
			data-value={json(crlfValue)}
			style="margin: 0; white-space: pre-wrap;">{crlfValue}</pre>
	</section>

	<section style="display: grid; gap: 0.5rem;">
		<h2 style="margin: 0; font-size: 1rem;">Unified diff vs. front matter</h2>
		<p style="margin: 0;">
			Both diffs describe the same one-key change; only the normalization differs.
		</p>
		<pre
			data-testid="fm-diff-default"
			data-value={json(defaultDiff.diff)}
			style="margin: 0;">{defaultDiff.diff}</pre>
		<pre
			data-testid="fm-diff-raw"
			data-value={json(rawDiff.diff)}
			style="margin: 0;">{rawDiff.diff}</pre>
		<div data-testid="fm-diff-wrapper" style="min-height: 34rem;">
			<ReviewEditor
				bind:this={diffEditor}
				id="fm-diff"
				name="fm-diff"
				original={DIFF_ORIGINAL}
				bind:value={diffValue}
				currentUserId="steve"
			/>
		</div>
		<button
			type="button"
			data-testid="fm-read-imperative-exports"
			onclick={readImperativeExports}
			style="justify-self: start;">Read exportUnifiedDiff() / exportMarkdownSummary()</button
		>
		<pre
			data-testid="fm-imperative-diff"
			data-value={json(imperativeDiff)}
			style="margin: 0;">{imperativeDiff}</pre>
		<pre
			data-testid="fm-imperative-summary"
			data-value={json(imperativeSummary)}
			style="margin: 0;">{imperativeSummary}</pre>
	</section>

	<section style="display: grid; gap: 0.5rem;">
		<h2 style="margin: 0; font-size: 1rem;">Blank-line normalization agreement (fixed)</h2>
		<p style="margin: 0;">
			Same front matter, same body text — the only difference between original and current is how
			many blank lines separate them. generateUnifiedDiff and generateMarkdownSummary now agree that
			nothing changed.
		</p>
		<pre
			data-testid="fm-blank-line-diff"
			data-value={json(blankLineDiff.diff)}
			style="margin: 0;">{blankLineDiff.diff}</pre>
		<pre
			data-testid="fm-blank-line-summary"
			data-value={json(blankLineSummary.markdown)}
			style="margin: 0;">{blankLineSummary.markdown}</pre>
	</section>
</div>

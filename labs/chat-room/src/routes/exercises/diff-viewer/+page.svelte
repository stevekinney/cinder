<script lang="ts">
	import { DiffViewer, type DiffViewerMode } from '@lostgradient/editor/diff-viewer';
	import type { DiffHunk } from '@lostgradient/markdown/diff/line-diff';
	import { appendAssistantMessage, Chat, createConversationHistory } from '@lostgradient/chat';

	// ROADMAP DV-1 / DV-2 / DV-3 — the standalone DiffViewer from
	// `@lostgradient/editor/diff-viewer`, which until now this repo only ever
	// reached through ReviewEditor's diff view, and whose single imperative
	// method (`getHunks`) nothing ever called.
	//
	// Five instances, because each of the three roadmap items needs a different
	// shape and two of them need MORE THAN ONE viewer to say anything at all:
	//
	//   A  the subject of DV-1: front matter, four swappable `current` fixtures,
	//      `bind:hunks` + `bind:viewMode` + `bind:this`, and both revert callbacks.
	//   B  a second, independent viewer with a DIFFERENT document. Its whole job
	//      is DV-3: one keystroke with focus on neither of them, two components
	//      reacting, is the only way to state a window-level binding as a fact
	//      rather than as a reading of `<svelte:window>`.
	//   C  DV-2: a `toolbar` snippet on an ordinary document. Total replacement,
	//      so everything the default toolbar owns disappears at once.
	//   D  DV-2's sharpest consequence: a >100KB document (the "manual" tier)
	//      WITH a toolbar override, where the only control that can ever compute
	//      the diff is the one the override just deleted.
	//   E  the control for D — the same document, default toolbar. Without it,
	//      D's "no Compute Diff button" would also pass against a component that
	//      never renders one, which would make the assertion prove nothing.
	//
	// Plus one `Chat`, which is not a stray: DV-2 is a claim about TWO components
	// diverging, and Chat's half — that its snippet overrides receive a
	// `renderDefault` so a consumer can WRAP the default rather than replace it —
	// is not exercised anywhere else in this repo. Pinning only DiffViewer's half
	// would leave the divergence exactly as unverified as it was.

	// ---------------------------------------------------------------------------
	// Instance A's document
	// ---------------------------------------------------------------------------

	// Front matter is here rather than on a separate fixture because DV-1 asks for
	// it on the instance whose hunks are asserted, and because the interesting
	// finding needs both halves of one document at once: `getHunks()` is BODY-ONLY
	// (`groupIntoHunks(lineDiffs)`), while the stat badges sum body + front matter.
	// A front-matter-only edit therefore reports changes in the toolbar and an
	// empty hunk list — which you cannot observe on a document that has no front
	// matter, or on one whose front matter never changes.
	//
	// A block sequence with two-space indentation is deliberate. The export
	// pipeline shipped a corruption bug here: `normalize()` handed a whole
	// document re-read the opening `---` as a thematic break and the YAML as a
	// setext heading, injecting blank lines and flattening sequence indentation.
	// `  - dana` is the line that goes wrong first when that regresses.
	const FRONT_MATTER_LINES = [
		'title: Release Plan',
		'owner: platform',
		'reviewers:',
		'  - dana',
		'  - kit'
	];

	const frontMatter = (status: string) =>
		['---', ...FRONT_MATTER_LINES, `status: ${status}`, '---'].join('\n');

	// The body is written as an explicit line array, not as a prose blob, because
	// every number the spec asserts is a LINE INDEX. Two changed regions, seven
	// unchanged lines between them: `groupIntoHunks` merges two change ranges when
	// they sit within `2 * CONTEXT_LINES` (6) of each other, so a shorter gap
	// silently collapses this into one hunk and the "exactly two hunks" assertion
	// starts asserting something weaker than it claims. The realised gap here is
	// 12 line indices.
	const BODY_LINES = [
		'# Release Plan',
		'',
		'The dashboard ships in the first wave.',
		'Exports follow one week later.',
		'',
		'Context line one.',
		'Context line two.',
		'Context line three.',
		'Context line four.',
		'Context line five.',
		'Context line six.',
		'Context line seven.',
		'',
		'The migration script is untested.',
		'Timeline risk is high.'
	];

	const FIRST_WAVE = 'The dashboard ships in the first wave.';
	const SECOND_WAVE = 'The dashboard ships in the second wave.';
	const RISK_HIGH = 'Timeline risk is high.';
	const RISK_MITIGATED = 'Timeline risk is now mitigated.';

	const buildDocument = (status: string, lines: string[]) =>
		`${frontMatter(status)}\n\n${lines.join('\n')}\n`;

	const A_ORIGINAL = buildDocument('draft', BODY_LINES);

	const TWO_HUNK = buildDocument(
		'draft',
		BODY_LINES.map((line) =>
			line === FIRST_WAVE ? SECOND_WAVE : line === RISK_HIGH ? RISK_MITIGATED : line
		)
	);

	// Every non-blank body line replaced. The blank lines stay blank so the
	// document keeps its shape — what makes this "all changed" is that every
	// change index lands inside one merge window, which collapses the whole
	// document into a single hunk with `index === 0`.
	const ALL_CHANGED = buildDocument(
		'draft',
		BODY_LINES.map((line, index) => (line === '' ? '' : `Rewritten line ${index}.`))
	);

	// Body byte-identical to the original; only `status:` moves.
	const FRONT_MATTER_ONLY = buildDocument('ready', BODY_LINES);

	// One inserted line and one deleted line, far enough apart that the diff
	// cannot pair them into a single `modified` entry.
	//
	// This fixture exists because the other four cannot exercise the view modes'
	// central job. `computeLineDiff` pairs a deletion immediately followed by an
	// insertion into ONE `modified` line, and every change in the fixtures above
	// is a one-for-one line swap — so all four produce `modified` lines and
	// nothing else. `DiffLine`'s visibility gate hides `removed` in `final` and
	// `added` in `original`, and `modified` in neither. Testing the modes against
	// a document with no `added` or `removed` line would leave that gate
	// completely unvisited while looking like mode coverage.
	const ADDED_AND_REMOVED = buildDocument(
		'draft',
		BODY_LINES.flatMap((line) =>
			line === 'Exports follow one week later.'
				? [line, 'Exports gained a CSV target.']
				: line === 'The migration script is untested.'
					? []
					: [line]
		)
	);

	type FixtureName =
		'identical' | 'two-hunk' | 'all-changed' | 'front-matter-only' | 'added-and-removed';

	const A_FIXTURES: Record<FixtureName, string> = {
		identical: A_ORIGINAL,
		'two-hunk': TWO_HUNK,
		'all-changed': ALL_CHANGED,
		'front-matter-only': FRONT_MATTER_ONLY,
		'added-and-removed': ADDED_AND_REMOVED
	};

	const FIXTURE_NAMES: FixtureName[] = [
		'identical',
		'two-hunk',
		'all-changed',
		'front-matter-only',
		'added-and-removed'
	];

	// Three, not two. `ROADMAP.md`'s DV-1 criterion says "both view modes"; the
	// component's own `VIEW_MODES` array — the one `Ctrl+Shift+D` cycles through —
	// has three entries, and `final` and `original` hide different line types, so
	// exercising two of them would leave a third rendering path unvisited.
	const MODES: DiffViewerMode[] = ['unified', 'final', 'original'];

	// `currentA` is plain state rather than `$derived(A_FIXTURES[fixture])` because
	// the revert callbacks below move it to documents that are not any named
	// fixture. `fixture` survives only to drive `aria-pressed` on the switcher.
	let fixture = $state<FixtureName>('two-hunk');
	let currentA = $state(A_FIXTURES['two-hunk']);

	function useFixture(name: FixtureName) {
		fixture = name;
		currentA = A_FIXTURES[name];
		announce(`Loaded the ${name} fixture.`);
	}

	let hunksA = $state<DiffHunk[]>([]);
	let modeA = $state<DiffViewerMode>('unified');
	let viewerA = $state<ReturnType<typeof DiffViewer>>();

	// ---------------------------------------------------------------------------
	// Instance B's document
	// ---------------------------------------------------------------------------

	// Deliberately a DIFFERENT document with a DIFFERENT change count (three, to
	// A's two). If both viewers held the same fixture, "both counters advanced"
	// would be satisfied by a single shared piece of state rendered twice, which
	// is the one alternative explanation DV-3 has to rule out. Different counts
	// mean the two readouts can never be mistaken for one value.
	//
	// No front matter, which also pins the `hasFrontMatter` gate: the front-matter
	// block is absent here and present in A on the same page.
	const B_ORIGINAL =
		[
			'Sprint notes',
			'',
			'Alpha ships Monday.',
			'Beta ships Tuesday.',
			'Gamma ships Wednesday.'
		].join('\n') + '\n';
	const B_CURRENT =
		[
			'Sprint notes',
			'',
			'Alpha ships Tuesday.',
			'Beta ships Wednesday.',
			'Gamma ships Thursday.'
		].join('\n') + '\n';

	let hunksB = $state<DiffHunk[]>([]);
	let modeB = $state<DiffViewerMode>('unified');

	// ---------------------------------------------------------------------------
	// Instance C's document — DV-2, ordinary size
	// ---------------------------------------------------------------------------

	const C_ORIGINAL =
		['Toolbar override probe', '', 'One unchanged line.', 'Original detail line.'].join('\n') +
		'\n';
	const C_CURRENT =
		['Toolbar override probe', '', 'One unchanged line.', 'Replacement detail line.'].join('\n') +
		'\n';

	// ---------------------------------------------------------------------------
	// Instances D and E — DV-2 at the manual tier
	// ---------------------------------------------------------------------------

	// The controller's tiers are measured on `max(original.length, current.length)`
	// AFTER the body is normalised: under 20,000 it diffs synchronously, at 20,000
	// it debounces, and at 100,000 it refuses to compute at all until something
	// calls `triggerCompute()`.
	//
	// Twelve very long lines rather than a thousand short ones, on purpose. Both
	// reach the threshold; only this one keeps the rendered diff to twelve rows
	// once E's Compute Diff button finally fires, so the page does not pay for a
	// four-figure DOM to make a point about a button. Measured at 102,362
	// characters per side by running the real `computeLineDiff` over it.
	function manualDocument(marker: string): string {
		const filler = 'lorem ipsum dolor sit amet '.repeat(315);
		return (
			Array.from(
				{ length: 12 },
				(_, index) =>
					`Section ${index}: ${(index === 3 ? marker : 'baseline').padEnd(12, '.')} ${filler}`
			).join('\n') + '\n'
		);
	}

	const MANUAL_ORIGINAL = manualDocument('baseline');
	const MANUAL_CURRENT = manualDocument('rewritten');

	// ---------------------------------------------------------------------------
	// Readouts
	// ---------------------------------------------------------------------------

	// Only the fields a test asserts, and `lines`/`originalLines`/`currentLines`
	// as counts rather than contents — a hunk carries up to three context lines on
	// each side, so its `lines` length is the cheapest way to state "this hunk
	// spans the region we think it spans" without pasting the document into the
	// expectation.
	const summarize = (hunks: DiffHunk[]) =>
		JSON.stringify(
			hunks.map((hunk) => ({
				index: hunk.index,
				originalStart: hunk.originalStart,
				originalCount: hunk.originalCount,
				currentStart: hunk.currentStart,
				currentCount: hunk.currentCount,
				lines: hunk.lines.length,
				originalLines: hunk.originalLines.length,
				currentLines: hunk.currentLines.length
			}))
		);

	const hunksAJson = $derived(summarize(hunksA));
	const hunksBJson = $derived(summarize(hunksB));

	// Written only by the button below, never derived. `getHunks()` returns
	// `bindableHunks` — a field an `$effect` copies out of the `computedHunks`
	// `$derived` — so it is a SEPARATE observation from `bind:hunks`, taken at the
	// moment of the call. Deriving this would erase exactly the lag that makes the
	// method worth testing.
	let imperativeAJson = $state('(not read)');

	function readImperativeHunks() {
		const hunks = viewerA?.getHunks() ?? [];
		imperativeAJson = summarize(hunks);
		announce(`getHunks returned ${hunks.length} ${hunks.length === 1 ? 'hunk' : 'hunks'}.`);
	}

	// `onreverthunk` and `onrevertall` are REQUESTS, exactly like ReviewEditor's
	// mutation methods: DiffViewer fires them and changes neither `original` nor
	// `current` itself. Nothing on this page moves unless this page moves it, and
	// a test that only asserted the callback fired would pass against a component
	// that had quietly started reverting the document on its own.
	let revertLog = $state<string[]>([]);

	function revertHunk(hunkIndex: number, hunk: DiffHunk) {
		revertLog = [...revertLog, `reverthunk:${hunkIndex}`];
		// Enough of a revert for these fixtures and no more: each hunk here changes
		// exactly one line, so swapping its `currentLines[i]` back to
		// `originalLines[i]` restores it. A real consumer would apply the hunk by
		// line number — `originalStart`/`originalCount` are on the hunk for that —
		// rather than by string replacement, which would misfire on a document
		// where the same text appears twice.
		let next = currentA;
		hunk.currentLines.forEach((line, index) => {
			const restored = hunk.originalLines[index];
			if (restored !== undefined) next = next.replace(line, restored);
		});
		currentA = next;
		announce(`Reverted hunk ${hunkIndex}.`);
	}

	function revertAll() {
		revertLog = [...revertLog, 'revertall'];
		currentA = A_ORIGINAL;
		fixture = 'identical';
		announce('Reverted every change.');
	}

	// Announced politely, because most of the controls on this page change a
	// readout somewhere else on the page rather than the thing under the pointer —
	// pressing "read getHunks" with nothing announced is an action with no
	// outcome for anyone not watching the readout column.
	//
	// Cleared before it is set: `aria-live` fires on CHANGE, and re-pressing the
	// same button is the obvious way to check whether it did anything, so
	// assigning an identical string would announce nothing precisely when a user
	// is asking again.
	let announcement = $state('');

	function announce(text: string) {
		announcement = '';
		queueMicrotask(() => {
			announcement = text;
		});
	}

	// ---------------------------------------------------------------------------
	// DV-2's other half: Chat's snippet overrides
	// ---------------------------------------------------------------------------

	const CHAT_REPLY =
		'The default renderer produced this paragraph, and the override chose to keep it.';

	const chatConversation = appendAssistantMessage(
		createConversationHistory({ id: 'diff-viewer-dv2' }),
		CHAT_REPLY
	);
</script>

<div style="max-width: 60rem; margin: 0 auto; padding: 2rem 1rem; display: grid; gap: 2rem;">
	<header>
		<h1>Diff Viewer</h1>
		<p>
			The standalone <code>DiffViewer</code>, mounted directly rather than through
			<code>ReviewEditor</code>.
		</p>
		<!-- Its own element with no children, so a click cannot land on a nested
		     node whose focus behaviour differs. Nothing here is focusable, so a
		     click parks the active element on `<body>` — which is the state DV-3's
		     "focus is outside the component entirely" claim is measured in, and the
		     spec asserts that rather than assuming it. -->
		<p data-testid="neutral-region">
			Neutral region: clicking here leaves focus on the document body.
		</p>
	</header>

	<section aria-labelledby="primary-heading" style="display: grid; gap: 0.75rem;">
		<h2 id="primary-heading">Instance A — primary</h2>

		<div
			role="group"
			aria-label="Document fixture"
			style="display: flex; flex-wrap: wrap; gap: 0.5rem;"
		>
			{#each FIXTURE_NAMES as name (name)}
				<button
					data-testid={`doc-a-${name}`}
					aria-pressed={fixture === name}
					onclick={() => useFixture(name)}>{name}</button
				>
			{/each}
		</div>

		<div role="group" aria-label="View mode" style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
			{#each MODES as mode (mode)}
				<button
					data-testid={`set-mode-a-${mode}`}
					aria-pressed={modeA === mode}
					onclick={() => {
						modeA = mode;
						announce(`View mode set to ${mode}.`);
					}}>set {mode}</button
				>
			{/each}
			<button data-testid="read-hunks-a" onclick={readImperativeHunks}>read getHunks()</button>
		</div>

		<div data-testid="viewer-a">
			<DiffViewer
				bind:this={viewerA}
				class="viewer-a"
				original={A_ORIGINAL}
				current={currentA}
				bind:hunks={hunksA}
				bind:viewMode={modeA}
				onreverthunk={revertHunk}
				onrevertall={revertAll}
			>
				<!-- The positive control for instance C's `toolbarActions`. C passes the
				     same prop alongside a `toolbar` override and loses it; without a
				     viewer that renders it, "C's action is absent" would also be
				     satisfied by a `toolbarActions` that never renders anywhere, and the
				     "silently dropped" claim would be resting on nothing. -->
				{#snippet toolbarActions()}
					<span data-testid="a-toolbar-action">action</span>
				{/snippet}
			</DiffViewer>
		</div>
	</section>

	<section aria-labelledby="secondary-heading" style="display: grid; gap: 0.75rem;">
		<h2 id="secondary-heading">Instance B — secondary</h2>
		<p>
			A second viewer holding an unrelated document. Nothing on this page ever writes to both at
			once.
		</p>

		<div data-testid="viewer-b">
			<DiffViewer
				class="viewer-b"
				original={B_ORIGINAL}
				current={B_CURRENT}
				bind:hunks={hunksB}
				bind:viewMode={modeB}
			/>
		</div>

		<p>
			<label for="decoy">Decoy field — the one thing the key handler's guard excludes</label>
			<input id="decoy" data-testid="decoy-input" />
		</p>
	</section>

	<section aria-labelledby="override-heading" style="display: grid; gap: 0.75rem;">
		<h2 id="override-heading">Instance C — toolbar override</h2>
		<p>
			<code>toolbar</code> is a total replacement, not a wrapper: the snippet below receives a
			context of four read-only fields and no <code>renderDefault</code>, so everything the default
			toolbar owned is gone. <code>toolbarActions</code> is passed as well, and is rendered inside the
			branch this override replaced — so it disappears too, without a warning.
		</p>

		<div data-testid="viewer-c">
			<DiffViewer class="viewer-c" original={C_ORIGINAL} current={C_CURRENT}>
				{#snippet toolbar(context)}
					<div data-testid="c-toolbar-replacement">
						Replacement toolbar. hasChanges={String(context.hasChanges)}, hunks={context.hunks
							.length}
					</div>
					<!-- The context's own key list, enumerated at runtime rather than
					     read off the `.d.ts`. This is the direct statement of DV-2's
					     divergence: if `renderDefault` is ever added to
					     `DiffToolbarContext`, this readout gains a key and the spec goes
					     red — which is the notification we want when the two components
					     are reconciled, rather than discovering it by re-reading types. -->
					<div data-testid="c-toolbar-context-keys">{Object.keys(context).sort().join(',')}</div>
				{/snippet}
				{#snippet toolbarActions()}
					<span data-testid="c-toolbar-action">action</span>
				{/snippet}
			</DiffViewer>
		</div>
	</section>

	<section aria-labelledby="manual-heading" style="display: grid; gap: 0.75rem;">
		<h2 id="manual-heading">Instances D and E — the manual tier</h2>
		<p>
			Both hold the same 100KB-plus document, which the controller refuses to diff until something
			calls <code>triggerCompute()</code>. Its only caller is the Compute Diff button, which lives
			inside the default toolbar — so D, which replaced that toolbar, has no reachable way to
			compute anything. <code>getHunks()</code> does not help: it reads the result, it does not ask for
			one.
		</p>

		<h3>D — override</h3>
		<div data-testid="viewer-d">
			<DiffViewer class="viewer-d" original={MANUAL_ORIGINAL} current={MANUAL_CURRENT}>
				{#snippet toolbar()}
					<div data-testid="d-toolbar-replacement">Replacement toolbar.</div>
				{/snippet}
			</DiffViewer>
		</div>

		<h3>E — default toolbar (the control)</h3>
		<div data-testid="viewer-e">
			<DiffViewer class="viewer-e" original={MANUAL_ORIGINAL} current={MANUAL_CURRENT} />
		</div>
	</section>

	<section aria-labelledby="chat-heading" style="display: grid; gap: 0.75rem;">
		<h2 id="chat-heading">Chat — the other side of the divergence</h2>
		<p>
			Chat's <code>messagePart</code> override receives the part AND a <code>renderDefault</code>
			snippet, so the consumer can wrap the built-in rendering instead of replacing it. The wrapper below
			renders its own marker and then delegates. That is the same customisation slot DiffViewer's
			<code>toolbar</code> denies.
		</p>

		<div style="height: 18rem;">
			<Chat id="dv2-chat" conversation={chatConversation}>
				{#snippet messagePart(part, renderDefault)}
					<div data-testid="chat-wrapped-part">
						<span data-testid="chat-wrapper-marker">wrapped by the consumer</span>
						{@render renderDefault(part)}
					</div>
				{/snippet}
			</Chat>
		</div>
	</section>

	<p
		aria-live="polite"
		aria-atomic="true"
		data-testid="announcement"
		style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap;"
	>
		{announcement}
	</p>

	<section
		aria-labelledby="readouts-heading"
		style="font-family: ui-monospace, monospace; font-size: 0.8rem; display: grid; gap: 0.25rem;"
	>
		<h2 id="readouts-heading" style="font-family: inherit;">Readouts</h2>
		<p data-testid="mode-a" style="margin: 0;">{modeA}</p>
		<p data-testid="mode-b" style="margin: 0;">{modeB}</p>
		<p data-testid="hunks-a" style="margin: 0; word-break: break-all;">{hunksAJson}</p>
		<p data-testid="hunks-b" style="margin: 0; word-break: break-all;">{hunksBJson}</p>
		<p data-testid="imperative-a" style="margin: 0; word-break: break-all;">{imperativeAJson}</p>
		<p data-testid="revert-log" style="margin: 0; word-break: break-all;">{revertLog.join('|')}</p>
		<p data-testid="current-a-length" style="margin: 0;">{currentA.length}</p>
	</section>
</div>

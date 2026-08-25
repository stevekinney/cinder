<script lang="ts">
	import { ReviewEditor } from '@lostgradient/editor/review-editor';
	import {
		addComment,
		addThread,
		deleteComment as deleteCommentReducer,
		deleteThread as deleteThreadReducer,
		generateId,
		timestamp,
		updateComment as updateCommentReducer,
		type Comment,
		type Thread,
		type ThreadCreateEvent
	} from '@lostgradient/editor/comments';
	import { TextSelection } from 'prosemirror-state';
	// `@milkdown/kit/prose/history` rather than `prosemirror-history`: the latter
	// is not one of chatroom's declared dependencies (only `-inputrules`,
	// `-model`, `-state` and `-view` are), while `@milkdown/kit` is, and this is
	// the exact specifier the component itself lazy-imports for its own undo
	// affordances (markdown-editor.svelte:169). Both resolve to the single hoisted
	// `prosemirror-history`, so the history plugin this reads is the one Milkdown
	// installed rather than a second copy.
	//
	// Imported statically, unlike the component's dynamic import, because the
	// module is pure ProseMirror with no DOM access at module scope — verified,
	// not assumed — so it is safe in the SSR pass this route also goes through.
	import { undo, undoDepth } from '@milkdown/kit/prose/history';
	import { tick } from 'svelte';

	// ROADMAP RE-1: the eight THREAD AND COMMENT MUTATION methods on
	// ReviewEditor's imperative surface, driven through `bind:this` rather than
	// through the UI. `CLAUDE.md` tells consumers to reach for this surface for
	// anything past the props, and until now this repo exercised the persistence
	// half (`getState`/`setState`) and almost none of the mutation half.
	//
	// Every method is driven against BOTH a normal editor and a `readonly` one,
	// because all eight guard on `mode === 'readonly'` and return null (or return
	// early) rather than throwing. A guard that silently no-ops is exactly the
	// kind of thing that reads as working until someone depends on it.
	//
	// ROADMAP RE-3 and RE-4 landed here too, on two FURTHER instances rather than
	// on the two above:
	//
	//  - `#imperative-content` (RE-3) drives `setMarkdown`, `reset`, `getMarkdown`
	//    and `getAst`. It needs an `original`, and `original` is what switches on
	//    the diff/summary tabs and the Revert All control
	//    (`showDiffTabs={!!original}`, review-editor-impl.svelte:1747) — adding it
	//    to `#imperative-editor` would move the controls bar under every RE-1 test
	//    that walks it, for reasons unrelated to what those tests assert.
	//  - `#imperative-tall` (RE-4) drives `scrollToThread` and `getEditor`. Its
	//    document is deliberately long enough that the thread at its foot starts
	//    below the fold, which is the only fixture in which "brings an off-screen
	//    thread into view" means anything.
	//
	// RE-3's readonly half reuses `#imperative-readonly` rather than adding a
	// third readonly instance: `reset` on a readonly editor is one button and one
	// assertion, and it needs the seeded thread that instance already carries.
	// The `ro-set-markdown` control and its test predate RE-3 and are left where
	// they are — the deliberate overlap is noted so the two are not read as
	// double-pinning the same fact.

	// ---------------------------------------------------------------------------
	// Document + the two coordinate spaces
	// ---------------------------------------------------------------------------

	// Headings and paragraphs only, no lists: ProseMirror positions inside a list
	// depend on how tightly the markdown parser nests `list_item > paragraph`,
	// and the whole point of this fixture is that the positions are exact.
	const HEADING = 'Release Plan';
	const PARAGRAPH_ONE =
		'The first release includes a dashboard, export actions, and inline review.';
	const PARAGRAPH_TWO =
		'Reviewers should verify that the export dialog copy matches the product brief before we ship.';
	const PARAGRAPH_THREE = 'Timeline risk: the migration script is untested.';

	// `###`, not `#`. Each editor renders its document's first heading at the
	// authored level, so two `#` fixtures put two more `h1`s on a page that
	// already has one — an outline of three sibling `h1`s, nested inside `h2`
	// sections, which only appears after hydration because the editors
	// server-render an empty shell. `###` makes it h1 → h2 → h3.
	//
	// Safe for the arithmetic below: a ProseMirror heading node costs 1 on each
	// side regardless of its level, so content still starts at 1 and paragraph
	// one still starts at 15. Only the markdown STRING length changes, which the
	// `value length` readouts report and no test asserts a literal for.
	const INITIAL = `### ${HEADING}\n\n${PARAGRAPH_ONE}\n\n${PARAGRAPH_TWO}\n\n${PARAGRAPH_THREE}`;

	// `anchor.from`/`anchor.to` are PROSEMIRROR POSITIONS; `anchor.lastKnownOffset`
	// and `anchor.originalPosition.offset` are `doc.textBetween()` offsets. Two
	// coordinate spaces living in the same object, and nothing warns when they get
	// mixed up — the trap `CLAUDE.md` documents.
	//
	// ProseMirror positions (each block node costs 1 on each side):
	//   heading  node 0..14    content 1..13
	//   para 1   node 14..90   content 15..89
	//   para 2   node 90..185  content 91..184
	//   para 3   node 185..235 content 186..234
	//
	// textBetween offsets (blocks joined by a single "\n"):
	//   heading 0..12   para 1 13..87   para 2 88..181   para 3 182..230
	//
	// "dashboard" sits at index 29 of PARAGRAPH_ONE, so its ProseMirror range is
	// 15+29=44 .. 44+9=53, and its textBetween offset is 13+29=42. Those are two
	// different numbers for one selection, which is the point.
	// 'dashboard' — QUOTE_FROM/QUOTE_TO are its ProseMirror range, 42 its
	// textBetween offset.
	const AUTHOR_SEED = 'author-1';
	// A known-length insertion, so a position shift can be asserted exactly rather
	// than merely as "changed".
	const BLOCK_SHIFT_TEXT = 'Prefixed. ';
	const QUOTE_FROM = 44;
	const QUOTE_TO = 53;

	let value = $state(INITIAL);
	let threads = $state<Thread[]>([]);

	// A DIFFERENT document from the editable instance, deliberately. Both editors
	// derive their heading's `id` from its text, so mounting the same fixture
	// twice produced two `id="release-plan"` nodes and `getElementById` resolved
	// to the editable one — an in-document anchor inside the readonly copy jumped
	// to the other editor.
	const READONLY_INITIAL = `### Readonly Reference\n\n${PARAGRAPH_ONE}\n\n${PARAGRAPH_TWO}`;

	let readonlyValue = $state(READONLY_INITIAL);

	// SEEDED, deliberately. An empty readonly instance makes the guard assertions
	// unfalsifiable: `firstThreadId`/`firstCommentId` hand the methods '', so the
	// five void methods no-op on a missing id whether or not the readonly guard
	// exists, and the test stays green with every guard deleted. Seeding real ids
	// — and wiring the callbacks below — is what makes a removed guard observable.
	const SEEDED_READONLY_THREAD: Thread = {
		id: 'readonly-thread-1',
		// Document-typed on purpose: a document anchor carries no from/to, so this
		// seed cannot drift if the readonly fixture's text ever changes.
		anchor: {
			from: 0,
			to: 0,
			quote: '',
			prefix: '',
			suffix: '',
			type: 'document',
			status: 'anchored'
		} as Thread['anchor'],
		comments: [
			{
				id: 'readonly-comment-1',
				threadId: 'readonly-thread-1',
				authorId: AUTHOR_SEED,
				body: 'Seeded so the readonly guards have something to refuse.',
				createdAt: '2026-01-01T00:00:00.000Z'
			}
		],
		createdAt: '2026-01-01T00:00:00.000Z'
	};

	let readonlyThreads = $state<Thread[]>([structuredClone(SEEDED_READONLY_THREAD)]);

	// Fires only if a readonly guard is missing. The reducer applications mirror
	// the editable instance's, so a removed guard shows up as both an event and a
	// changed array rather than as silence.
	let readonlyEvents = $state<string[]>([]);

	let editor = $state<ReturnType<typeof ReviewEditor>>();
	let readonlyEditor = $state<ReturnType<typeof ReviewEditor>>();

	const AUTHOR = AUTHOR_SEED;

	// ---------------------------------------------------------------------------
	// The consumer-owned reducer
	// ---------------------------------------------------------------------------

	// Every mutation method on ReviewEditor is a REQUEST, not a mutation: it fires
	// a callback describing what the user asked for and changes nothing itself.
	// `threads` only moves because this page moves it, over the pure helpers
	// exported from `@lostgradient/editor/comments`. Building the exercise without
	// this reducer is what made every early probe report `threads: 0` while the
	// imperative calls were returning perfectly good request ids.

	function threadFromCreateEvent(event: ThreadCreateEvent): Thread {
		const now = timestamp();
		// The thread id is the event's `requestId`, which is also what the method
		// returned to the caller — that correlation is the whole point of handing
		// back a requestId rather than a boolean.
		const comment: Comment = {
			id: generateId(),
			threadId: event.requestId,
			authorId: event.authorId,
			body: event.body,
			createdAt: now,
			mentions: event.mentions
		};
		return {
			id: event.requestId,
			anchor: event.anchor,
			comments: [comment],
			createdAt: now
		};
	}

	function applyThreadCreate(event: ThreadCreateEvent) {
		threads = addThread(threads, threadFromCreateEvent(event)).threads;
	}

	// ---------------------------------------------------------------------------
	// Readouts
	// ---------------------------------------------------------------------------

	// The last value an imperative call handed back. `createThread` and friends
	// return `string | null`, and the null is the readonly guard's whole
	// observable signature — asserting it is how we tell "guarded" from "threw".
	let lastReturn = $state('(none)');
	let lastCall = $state('(none)');

	// `onthreaddelete` fires for CONSUMER-INITIATED removal only. The orphaning
	// path — an anchor whose quote left the document — fires nothing, and RE-1
	// asks us to distinguish the two rather than assume they are the same event.
	let events = $state<string[]>([]);

	// Announced politely so an action taken without sight has an outcome.
	//
	// Two things this got wrong before, both caught in review, both worse than the
	// silence they replaced:
	//
	// 1. The outcome was INFERRED from the return value. The five void mutation
	//    methods return `undefined` whether or not the readonly guard refused them,
	//    so a refused `deleteThread` announced "completed" — a false confirmation of
	//    a destructive action, which is worse than saying nothing. The call sites
	//    now pass the outcome explicitly; nothing is inferred.
	// 2. Identical text does not re-announce. `aria-live` fires on CHANGE, so
	//    pressing the same button three times produced one announcement and a
	//    screen-reader user could not tell whether presses 2 and 3 did anything —
	//    on a page whose whole point is buttons that may silently refuse, and where
	//    re-pressing to check is the obvious response. Clearing before setting
	//    forces a change even when the words are the same.
	let announcement = $state('');

	// Counts ACTUAL DOM MUTATIONS of the live region, via MutationObserver.
	//
	// This has to observe the DOM rather than the assignment, and the distinction
	// is the whole point. A log of what `announce()` was asked to say records an
	// entry whether or not the region changed — so it stays green with the
	// clear-then-set deleted, which is a second unfalsifiable assertion papering
	// over the first. What actually breaks when the transition goes away is that
	// Svelte writes an identical string, the DOM does not change, and `aria-live`
	// fires nothing. Only a mutation count sees that.
	let announceMutations = $state(0);
	let regionNode = $state<HTMLElement | null>(null);

	$effect(() => {
		if (!regionNode) return;
		const observer = new MutationObserver((records) => {
			announceMutations += records.length;
		});
		observer.observe(regionNode, { childList: true, characterData: true, subtree: true });
		return () => observer.disconnect();
	});

	function announce(text: string) {
		announcement = '';
		// Next microtask, so the region genuinely transitions rather than being
		// assigned the same string it already held. `aria-live` fires on CHANGE;
		// assigning an identical string is not a change and announces nothing.
		queueMicrotask(() => {
			announcement = text;
		});
	}

	type Outcome = 'refused' | 'completed' | 'created';

	// This function has been wrong three times running, and each fix narrowed
	// what it GUESSES rather than eliminating the guessing. Read all three before
	// touching it again:
	//
	// 1. First version hardcoded "the editor is readonly" for every refusal —
	//    true on the readonly instance, false on the editable one, where a null
	//    return means no selection, no view, or no target, never readonly.
	// 2. Second version added a specific reason per call site — but three of
	//    those reasons were themselves guesses at WHICH of a guard's several bail
	//    branches had fired, and two were wrong: `createComment`'s "created"
	//    message said "created a thread" (wrong noun — it creates a comment);
	//    `createBlockThread`'s reason named only its VIEW-unavailable branch when
	//    the guard has a third, "cursor is not inside a block" branch that is
	//    reachable with the view fully mounted; and the four void methods
	//    (`updateComment`, `deleteComment` ×2, `deleteThread`) pre-checked "does
	//    an id exist" without checking `deletedAt`, so re-targeting an
	//    already-soft-deleted comment — a real guard branch — announced
	//    "completed" for a call that provably did nothing (confirmed via the
	//    `events` log staying empty).
	//
	// The fix is structural, not another special case. `reason` is used for
	// void methods whose STRUCTURALLY POSSIBLE bail conditions are covered
	// honestly (see the void call sites below, which now observe the wired
	// callback rather than pre-guessing), and `noun` names what a 'created'
	// outcome actually made.
	function record(
		name: string,
		outcome: Outcome,
		result: unknown,
		detail?: { reason?: string; noun?: string; tally?: string }
	) {
		lastCall = name;
		lastReturn = result === null ? 'null' : result === undefined ? 'undefined' : String(result);

		// The counts ride along so a bulk action reports scale rather than just
		// happening, and so repeated presses differ audibly when they differ in fact.
		//
		// `detail.tally` overrides it, and the RE-3/RE-4 call sites all pass one.
		// The default names the editable and readonly reviews specifically, which
		// is accurate for the eight mutation methods and WRONG for a call against
		// the content or scroll instance — announcing counts from two reviews the
		// user did not touch is the same class of confidently-false diagnosis this
		// function has already been fixed for twice.
		const editable = threads.length;
		const readonlyCount = readonlyThreads.length;
		const tally =
			detail?.tally ??
			`${editable} ${editable === 1 ? 'thread' : 'threads'} in the editable review, ${readonlyCount} in the readonly one`;

		announce(
			outcome === 'refused'
				? `${name} was refused: ${detail?.reason ?? 'no target was available'}. Nothing changed. ${tally}.`
				: outcome === 'created'
					? `${name} created ${detail?.noun ?? 'a thread'}. ${tally}.`
					: `${name} completed. ${tally}.`
		);
	}

	/** For the readonly instance only: every one of these is refused by the guard. */
	function recordRefused(name: string, result?: unknown) {
		record(name, 'refused', result, { reason: 'the editor is readonly' });
	}

	/**
	 * Ground truth for a void method, observed rather than guessed. `threadId`/
	 * `commentId` existing is not sufficient — the component's guards also refuse
	 * an already-soft-deleted comment (`deletedAt` set), which an id-presence
	 * check cannot see. Reproduced live: soft-delete a comment, then press
	 * updateComment — the id is still present, so a presence check says
	 * "completed" for a call whose own `oncommentupdate` never fires.
	 *
	 * `events` only grows when the component's own wired callback fires, which
	 * happens exactly when a guard passes — so comparing its length before and
	 * after the call is correct regardless of how many bail branches the guard
	 * has, without this page needing to replicate any of them.
	 *
	 * `observe` names WHICH event log to watch, defaulting to the editable
	 * instance's. RE-3 drives the same discipline against the content and
	 * readonly instances, and a hardcoded `events.length` there would report
	 * "refused" for every call — a log that never moves is indistinguishable from
	 * a guard that always refuses.
	 */
	function recordVoid(
		name: string,
		call: () => void,
		reason: string,
		observe: () => number = () => events.length
	) {
		const before = observe();
		call();
		const happened = observe() > before;
		record(name, happened ? 'completed' : 'refused', undefined, { reason });
	}

	/**
	 * Run an imperative call that has to focus the editor, then put focus back on
	 * the control that triggered it.
	 *
	 * `select()` genuinely needs `view.focus()` — ProseMirror observes a selection
	 * on a focused view, and driving the documented consumer path rather than
	 * faking it is the point of this page. But a button that silently relocates
	 * focus into a rich-text surface is its own defect: `create-thread` is the
	 * first control on this page and the editor is the twenty-third, so a
	 * keyboard user who presses it is moved twenty-odd stops forward with no
	 * announcement, and has to walk back through the editor host, the export
	 * menu, the sidebar toggle, the view tabs and every preceding button to reach
	 * the next one.
	 *
	 * Restoring is conditional on the trigger still being connected, because some
	 * of these calls can remove the very control that fired them.
	 */
	async function keepingFocus(run: () => Promise<void> | void): Promise<void> {
		const trigger = document.activeElement;
		await run();
		if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
	}

	// Serialised for the spec. Includes BOTH coordinate spaces per thread so a
	// test can assert them against each other rather than against a literal.
	//
	// Shared by all three instances that publish an anchor readout. Extracted
	// rather than copied so the RE-3 and RE-4 readouts cannot drift into a
	// different shape from the RE-1 one the spec's `AnchorRow` type describes.
	function anchorRows(list: Thread[]) {
		return list.map((thread) => ({
			id: thread.id,
			// `type` lives on the ANCHOR, not the thread, and is undefined for the
			// default text case — the d.ts says undefined is "treated as 'text' for
			// backwards compatibility", so normalise it rather than leak undefined.
			// NOTE the normalisation is this page's, not the component's: the
			// component leaves `type` undefined for BOTH text and block anchors, so
			// the `'text'` a test reads back for a block thread is ours. `rawType`
			// and `blockId` are carried alongside so a test can tell the two apart
			// rather than concluding from `type` alone that nothing distinguishes a
			// block thread — `blockId` is the component's real distinguishing field,
			// and omitting it is what made that claim look true.
			type: thread.anchor?.type ?? 'text',
			rawType: thread.anchor?.type ?? null,
			blockId: (thread.anchor as { blockId?: string } | undefined)?.blockId ?? null,
			quote: thread.anchor?.quote ?? '',
			from: thread.anchor?.from ?? null,
			to: thread.anchor?.to ?? null,
			lastKnownOffset: thread.anchor?.lastKnownOffset ?? null,
			status: thread.anchor?.status ?? null,
			comments: thread.comments.length
		}));
	}

	const anchorsJson = $derived(JSON.stringify(anchorRows(threads)));

	const readonlyAnchorsJson = $derived(
		JSON.stringify(
			readonlyThreads.map((thread) => ({ id: thread.id, type: thread.anchor?.type ?? 'text' }))
		)
	);

	// An INDEPENDENT derivation of the textBetween offset for each thread's
	// `from`, taken straight from ProseMirror rather than from the component's own
	// anchor helper. Comparing the component's `lastKnownOffset` against this is a
	// real cross-check; comparing it against another value the component computed
	// would only prove it agrees with itself.
	let probeJson = $state('[]');

	// A readout of what `getSelection()` reports, which is still NOT the same field
	// `createThread` gates on — the two merely agree now.
	//
	// `ReviewEditor.getSelection()` delegates to the inner MarkdownEditor's
	// `getSelection()` (view-derived) and adds `currentDocument.bodyOffset`.
	// `createThread` guards on `currentSelection`, a separate `$state` fed only by
	// the inner editor's `onselectionchange`. `getSelection()` never touches it.
	//
	// That separation was cinder#1288: the listener re-read `view.state` from
	// inside `EditorState.apply`, so this readout could show a perfectly valid,
	// non-collapsed selection at the exact moment `createThread` returned null.
	// `@lostgradient/editor@0.9.1` hands the listener Milkdown's live selection
	// instead, so one dispatch now reaches `currentSelection` — but the two fields
	// remain distinct, which is why this readout stays.
	//
	// Note the two fields below cannot disagree with each other on this page:
	// `bodyOffset` is 0 for a fixture with no front matter, so `viaGetSelection` is
	// `fromView` plus zero. They are kept side by side to make that identity
	// visible rather than to imply a divergence.
	let selectionJson = $state('null');
	let selectionAtCall = $state('null');

	function readSelection() {
		const viaGetSelection = editor?.getSelection() ?? null;
		const view = editor?.getView();
		const fromView = view ? { from: view.state.selection.from, to: view.state.selection.to } : null;
		selectionJson = JSON.stringify({ viaGetSelection, view: fromView });
	}

	function probeOffsets() {
		const view = editor?.getView();
		if (!view) {
			probeJson = '[]';
			return;
		}
		probeJson = JSON.stringify(
			threads.map((thread) => {
				const from = thread.anchor?.from;
				if (typeof from !== 'number') return null;
				return view.state.doc.textBetween(0, from, '\n').length;
			})
		);
	}

	// ---------------------------------------------------------------------------
	// Driving a selection so `createThread` has something to anchor to
	// ---------------------------------------------------------------------------

	// `createThread` reads the editor's CURRENT SELECTION and returns null when it
	// is collapsed — there is no overload that takes a range. So driving it
	// imperatively means putting a real selection in the view first, through the
	// public `getView()`, exactly as a consumer would have to.
	async function select(
		target: ReturnType<typeof ReviewEditor> | undefined,
		from: number,
		to: number
	) {
		const view = target?.getView();
		if (!view) return false;
		view.focus();
		view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to)));
		// A ProseMirror transaction alone moves the view's selection but does not
		// necessarily reach the component's own `currentSelection`, which is fed by
		// the inner MarkdownEditor's `onselectionchange`. `createThread` reads the
		// latter, so syncing the DOM selection — the thing a real user's drag
		// produces, and what ProseMirror observes — is what actually gets there.
		await tick();
		return true;
	}

	async function createAnchoredThread() {
		await select(editor, QUOTE_FROM, QUOTE_TO);
		const created = editor?.createThread('Is this the right surface?', AUTHOR) ?? null;
		record('createThread', created ? 'created' : 'refused', created, {
			reason: 'no text is currently selected',
			noun: 'a thread'
		});
		probeOffsets();
	}

	async function createAnchoredThreadReadonly() {
		// The selection step is load-bearing, not ceremony. `createThread`'s bail
		// order is selection → readonly → view, so a call with nothing selected
		// bails at the SELECTION guard with "no text selected" and never reaches the
		// readonly guard at all — which is how this arm once passed against a
		// createThread carrying no readonly guard whatsoever.
		//
		// It used to take TWO dispatches to get past that first guard, because
		// `currentSelection` lagged by one transaction (cinder#1288). One is enough
		// as of `@lostgradient/editor@0.9.1`; the readonly-guard test below is what
		// proves the call still reaches the second guard.
		await select(readonlyEditor, QUOTE_FROM, QUOTE_TO);
		recordRefused(
			'createThread(readonly)',
			readonlyEditor?.createThread('Should not exist', AUTHOR) ?? null
		);
	}

	// ---------------------------------------------------------------------------
	// The remaining seven, on both instances
	// ---------------------------------------------------------------------------

	function firstThreadId(list: Thread[]): string {
		return list[0]?.id ?? '';
	}

	function firstCommentId(list: Thread[]): string {
		return list[0]?.comments[0]?.id ?? '';
	}

	// ---------------------------------------------------------------------------
	// ROADMAP RE-3 — setMarkdown, reset, getMarkdown, getAst
	// ---------------------------------------------------------------------------

	// `original` is DELIBERATELY a different document from the initial `value`,
	// and that is the whole point of this fixture. ROADMAP.md says "`reset`
	// returns the component to its initial `value`"; the component says
	// `value = original` (review-editor-impl.svelte:1181-1184). Those two claims
	// are indistinguishable while `original` and the initial `value` are the same
	// string, which is how the wrong one survives. Here they differ, so exactly
	// one of them can be true after a reset.
	//
	// A second consequence rides along: this instance mounts DIRTY, because
	// `diffStats` is derived from `original` vs `value` and they differ from the
	// first frame. That is what makes "reset clears the dirty state" observable —
	// the component's own diff badge is present before the reset and gone after.
	const CONTENT_ORIGINAL = '### Content Baseline\n\nThe rollout plan is still being drafted.';

	const CONTENT_HEADING = 'Content Replacement Fixture';
	const CONTENT_PARAGRAPH_ONE = 'The rollout plan names a dashboard owner and a migration owner.';
	const CONTENT_PARAGRAPH_TWO = 'The rollback checklist is owned by the platform team.';
	const CONTENT_INITIAL = `### ${CONTENT_HEADING}\n\n${CONTENT_PARAGRAPH_ONE}\n\n${CONTENT_PARAGRAPH_TWO}`;

	// The replacement keeps paragraph one VERBATIM and drops paragraph two, and
	// inserts a paragraph ahead of both. All three properties are load-bearing:
	//
	//  - keeping paragraph one gives the surviving thread a quote to re-anchor to;
	//  - dropping paragraph two gives the other thread nothing to find;
	//  - INSERTING ahead of paragraph one is what moves the surviving quote. Without
	//    the insertion the re-anchored position equals the original one, and
	//    "re-anchored" would be indistinguishable from "never touched".
	const CONTENT_INSERTED = 'A late addition pushes the rest of the document down.';
	const CONTENT_CLOSING = 'The deployment window is now agreed.';
	const CONTENT_REPLACEMENT = `### ${CONTENT_HEADING}\n\n${CONTENT_INSERTED}\n\n${CONTENT_PARAGRAPH_ONE}\n\n${CONTENT_CLOSING}`;

	// Same two coordinate spaces as the RE-1 fixture above, derived the same way
	// by hand. `from`/`to` are ProseMirror positions; `lastKnownOffset` is a
	// `doc.textBetween()` offset. A block node costs 1 on each side, and
	// textBetween joins blocks with a single "\n".
	//
	// CONTENT_INITIAL:
	//   h3 'Content Replacement Fixture' (27)  node 0..29    content 1..28
	//   para 1 (63)                            node 29..94   content 30..93
	//   para 2 (53)                            node 94..149  content 95..148
	//   textBetween: heading 0..27   para 1 28..91   para 2 92..145
	//
	// 'dashboard owner' sits at index 25 of paragraph one: ProseMirror
	// 30+25 = 55..70, textBetween offset 28+25 = 53.
	// 'rollback checklist' sits at index 4 of paragraph two: ProseMirror
	// 95+4 = 99..117, textBetween offset 92+4 = 96.
	//
	// CONTENT_REPLACEMENT, where paragraph one has moved down one block:
	//   h3 (27)         node 0..29     content 1..28
	//   inserted (53)   node 29..84    content 30..83
	//   para 1 (63)     node 84..149   content 85..148
	//   closing (36)    node 149..187  content 150..186
	//   textBetween: heading 0..27   inserted 28..81   para 1 82..145
	//
	// so 'dashboard owner' lands at ProseMirror 85+25 = 110..125, textBetween
	// offset 82+25 = 107. Those are the numbers the spec asserts, and they are
	// three independent arithmetic claims rather than three readouts of one.
	const SURVIVING_QUOTE = 'dashboard owner';
	const SURVIVING_FROM = 55;
	const SURVIVING_TO = 70;
	const REMOVED_QUOTE = 'rollback checklist';
	const REMOVED_FROM = 99;
	const REMOVED_TO = 117;

	let contentValue = $state(CONTENT_INITIAL);
	let contentThreads = $state<Thread[]>([]);
	let contentEvents = $state<string[]>([]);
	let contentEditor = $state<ReturnType<typeof ReviewEditor>>();

	const contentAnchorsJson = $derived(JSON.stringify(anchorRows(contentThreads)));

	const contentTally = () =>
		`${contentThreads.length} ${contentThreads.length === 1 ? 'thread' : 'threads'} in the content review`;

	let contentMarkdownJson = $state('null');
	let contentAstJson = $state('[]');
	// `getAst` THROWS 'Markdown pipeline is not ready yet.' until a dynamic
	// `import('@lostgradient/markdown/pipeline')` resolves, and that import lives
	// in an effect SEPARATE from editor creation — so `data-ready`, which is
	// `editorViewReady && !pendingState`, does not gate it. Surfacing the throw as
	// a readout rather than letting it escape is what lets the spec poll for
	// readiness by re-asking, instead of sleeping past it.
	let contentAstError = $state('');
	let contentUndoDepth = $state(-1);
	// Monotonic, and the reason this readout is not just the depth: the spec
	// compares the depth before and after a reset, and those two numbers can
	// legitimately be equal. Polling on the depth alone could not tell a fresh
	// answer from a stale render.
	let contentUndoProbes = $state(0);

	/** An mdast node's text, flattened — used only to compare against the DOM. */
	function nodeText(node: unknown): string {
		if (typeof node !== 'object' || node === null) return '';
		const candidate = node as { value?: unknown; children?: unknown[] };
		if (typeof candidate.value === 'string') return candidate.value;
		if (Array.isArray(candidate.children)) return candidate.children.map(nodeText).join('');
		return '';
	}

	function readContentAst() {
		try {
			const root = contentEditor?.getAst();
			contentAstError = '';
			contentAstJson = JSON.stringify(
				(root?.children ?? []).map((node) => ({
					type: node.type,
					depth: 'depth' in node ? node.depth : null,
					text: nodeText(node)
				}))
			);
		} catch (error) {
			contentAstError = error instanceof Error ? error.message : String(error);
			contentAstJson = '[]';
		}
	}

	function readContentMarkdown() {
		const fromGetMarkdown = contentEditor?.getMarkdown() ?? '';
		// Both strings, and both lengths. `ReviewEditor.getMarkdown()` re-serialises
		// through Milkdown and recombines front matter, while `value` is whatever
		// was last assigned to it — so they are two different derivations of "the
		// document" and any normalisation between them belongs in a readout rather
		// than in a comment claiming there is none.
		contentMarkdownJson = JSON.stringify({
			fromGetMarkdown,
			valueProp: contentValue,
			getMarkdownLength: fromGetMarkdown.length,
			valuePropLength: contentValue.length
		});
	}

	function readContentUndoDepth() {
		const view = contentEditor?.getView();
		contentUndoDepth = view ? undoDepth(view.state) : -1;
		contentUndoProbes += 1;
	}

	function undoContent() {
		const view = contentEditor?.getView();
		if (!view) return;
		// `view.dispatch` is a prototype method that uses `this`, so it is wrapped
		// rather than passed bare — handing prosemirror-history the unbound
		// reference throws on the first dispatch.
		undo(view.state, (transaction) => view.dispatch(transaction));
		// Deliberately does NOT refresh the depth readout. `contentUndoProbes` is
		// the counter the spec polls on, and a button that advanced it as a side
		// effect would make "the Nth probe has landed" mean something different
		// depending on what was pressed before it.
	}

	async function seedContentThreads() {
		await select(contentEditor, SURVIVING_FROM, SURVIVING_TO);
		const survivor =
			contentEditor?.createThread(
				`Anchored to "${SURVIVING_QUOTE}", which the replacement keeps.`,
				AUTHOR
			) ?? null;
		await select(contentEditor, REMOVED_FROM, REMOVED_TO);
		const doomed =
			contentEditor?.createThread(
				`Anchored to "${REMOVED_QUOTE}", which the replacement drops.`,
				AUTHOR
			) ?? null;
		record(
			'createThread(content) twice',
			survivor && doomed ? 'created' : 'refused',
			`${survivor ?? 'null'},${doomed ?? 'null'}`,
			{
				reason: 'no text is currently selected',
				noun: 'two threads',
				tally: contentTally()
			}
		);
	}

	function setContentMarkdown() {
		// Observed, not assumed. `setMarkdown` returns nothing and carries no
		// guard, but "returns nothing" is exactly the shape that let four other
		// controls on this page announce a completion for a call that did nothing.
		// `value = content` is its first statement, so the bound prop moving is the
		// honest signal that the call landed.
		const before = contentValue;
		contentEditor?.setMarkdown(CONTENT_REPLACEMENT);
		record('setMarkdown(content)', contentValue === before ? 'refused' : 'completed', undefined, {
			reason: 'the value prop did not move',
			tally: contentTally()
		});
		readContentMarkdown();
	}

	function resetContent() {
		// `reset` does two separable things and either can fail on its own, so both
		// are observed rather than one standing in for the other: it assigns
		// `value = original`, and it fires `onthreaddelete` once per thread while
		// leaving the actual removal to this page's reducer. A page that never
		// wires `onthreaddelete` keeps every thread through a reset.
		const beforeValue = contentValue;
		const beforeEvents = contentEvents.length;
		contentEditor?.reset();
		const released = contentEvents.length - beforeEvents;
		const restored = contentValue !== beforeValue;
		record('reset(content)', restored || released > 0 ? 'completed' : 'refused', undefined, {
			reason: 'the value was already the original and no thread was released',
			tally: `${contentTally()}, ${released} released by this reset`
		});
		readContentMarkdown();
	}

	function resetReadonly() {
		// RE-3's readonly half for `reset`. Same observation as above; the wording
		// differs because a refusal HERE would mean a readonly guard exists, which
		// is the question being asked.
		const beforeValue = readonlyValue;
		const beforeEvents = readonlyEvents.length;
		readonlyEditor?.reset();
		const released = readonlyEvents.length - beforeEvents;
		const restored = readonlyValue !== beforeValue;
		record('reset(readonly)', restored || released > 0 ? 'completed' : 'refused', undefined, {
			reason: 'the editor is readonly'
		});
	}

	// ---------------------------------------------------------------------------
	// ROADMAP RE-4 — scrollToThread, getEditor
	// ---------------------------------------------------------------------------

	const TALL_ID = 'imperative-tall';
	const TALL_HEADING = 'Scroll Target Document';
	const TALL_FILLER_COUNT = 24;
	const tallFiller = (index: number) =>
		`Filler paragraph ${String(index).padStart(2, '0')} keeps the scroll target below the fold.`;
	const TALL_TARGET = 'The migration script is untested and needs a decision.';
	const TALL_INITIAL = [
		`### ${TALL_HEADING}`,
		...Array.from({ length: TALL_FILLER_COUNT }, (_, index) => tallFiller(index + 1)),
		TALL_TARGET
	].join('\n\n');

	// Same hand derivation, made cheap by giving every filler paragraph the same
	// length: `Filler paragraph NN keeps the scroll target below the fold.` is 59
	// characters for every two-digit NN, so each filler block costs 59+2 = 61.
	//
	//   heading 'Scroll Target Document' (22)  node 0..24
	//   24 fillers                             24 * 61 = 1464, ending at 1488
	//   target paragraph                       node 1488..1544, content 1489..1543
	//
	// 'migration script' sits at index 4 of the target paragraph, so its
	// ProseMirror range is 1489+4 = 1493..1509.
	const TALL_QUOTE = 'migration script';
	const TALL_FROM = 1493;
	const TALL_TO = 1509;

	// The ORPHAN, seeded rather than produced by an edit, because RE-4 asks what
	// `scrollToThread` does with one and an edit-produced orphan would carry
	// whatever range the edit left behind. `from: 0, to: 0` is the shape
	// `toRuntimeThreads` writes for a restored-but-unplaced anchor, and it is
	// precisely the case ROADMAP RE-4 names: 0/0 is a VALID ProseMirror position,
	// so a missing status guard does not error — it resolves coordinates at the
	// top of the document and scrolls there.
	//
	// The 0/0 sentinel is also what keeps this seed quiet: `warnOnMisSeededAnchor`
	// returns early on it (anchor-decorations.js:113-114), and an already-orphaned
	// anchor is skipped when the plugin decides whether to re-raise re-anchoring
	// (:161-166), so seeding it neither warns nor spins the deferred pass.
	const TALL_ORPHAN_ID = 'tall-orphan-1';
	const TALL_ORPHAN_QUOTE = 'a paragraph that was cut from an earlier draft';
	const SEEDED_TALL_ORPHAN: Thread = {
		id: TALL_ORPHAN_ID,
		anchor: {
			from: 0,
			to: 0,
			quote: TALL_ORPHAN_QUOTE,
			prefix: '',
			suffix: '',
			status: 'orphaned'
		} as Thread['anchor'],
		comments: [
			{
				id: 'tall-orphan-comment-1',
				threadId: TALL_ORPHAN_ID,
				authorId: AUTHOR_SEED,
				body: 'Anchored to text that is not in this document.',
				createdAt: '2026-01-01T00:00:00.000Z'
			}
		],
		createdAt: '2026-01-01T00:00:00.000Z'
	};

	let tallValue = $state(TALL_INITIAL);
	let tallThreads = $state<Thread[]>([structuredClone(SEEDED_TALL_ORPHAN)]);
	let tallEvents = $state<string[]>([]);
	let tallEditor = $state<ReturnType<typeof ReviewEditor>>();
	let tallAnchoredId = $state('');

	const tallAnchorsJson = $derived(JSON.stringify(anchorRows(tallThreads)));

	const tallTally = () =>
		`${tallThreads.length} ${tallThreads.length === 1 ? 'thread' : 'threads'} in the scroll review`;

	let scrollJson = $state('null');

	// The ONLY observable of a scroll the component ASKED for.
	//
	// `scrollToThread` returns nothing, announces nothing, and — as the readouts
	// below record — moves nothing, so from outside there is no way to tell "a
	// guard refused this call" from "the call went through and had no effect".
	// Those are different facts and RE-4 asks about both, so the page wraps
	// `view.dom.scrollTo` and records what it was handed. The wrapper calls
	// straight through to the original, so nothing about the component's behaviour
	// changes; it only stops being invisible.
	//
	// This is the same discipline `recordVoid` uses for the five void mutation
	// methods: observe the thing the component actually does, rather than
	// pre-guessing which branch of its guard fired.
	let scrollCalls = $state<string[]>([]);
	let scrollInstrumented = false;

	function instrumentScrollTarget() {
		const dom = tallEditor?.getView()?.dom;
		if (!dom || scrollInstrumented) return;
		scrollInstrumented = true;
		const passThrough = dom.scrollTo.bind(dom) as (...args: unknown[]) => void;
		Object.defineProperty(dom, 'scrollTo', {
			configurable: true,
			value: (...args: unknown[]) => {
				scrollCalls = [...scrollCalls, JSON.stringify(args[0] ?? null)];
				passThrough(...args);
			}
		});
	}

	type ScrollSample = {
		winY: number;
		domTop: number;
		scrollerTop: number;
		anchorTop: number | null;
		viewportHeight: number;
		active: string;
	};

	function sampleScroll(): ScrollSample {
		const dom = tallEditor?.getView()?.dom ?? null;
		// `view.dom` is the `.ProseMirror` contenteditable — the element
		// `scrollToThread` calls `scrollTo` on. The element that actually carries
		// `overflow: auto` in the shipped CSS is its ancestor `.markdown-editor`
		// (markdown-editor.svelte's style block), so BOTH are sampled: a scroll
		// that landed anywhere at all shows up in one of the three numbers here.
		const scroller = dom?.closest('.markdown-editor') ?? null;
		const anchor = document.querySelector(`#${TALL_ID} .ProseMirror span.comment-anchor`);
		const active = document.activeElement;
		return {
			winY: Math.round(window.scrollY),
			domTop: Math.round(dom?.scrollTop ?? -1),
			scrollerTop: Math.round(scroller?.scrollTop ?? -1),
			anchorTop: anchor ? Math.round(anchor.getBoundingClientRect().top) : null,
			viewportHeight: window.innerHeight,
			active:
				active === document.body
					? 'BODY'
					: (active?.getAttribute('data-testid') ?? active?.tagName ?? 'null')
		};
	}

	function runScroll(name: string, threadId: string) {
		instrumentScrollTarget();
		const before = sampleScroll();
		const callsBefore = scrollCalls.length;
		let threw: string | null = null;
		let returned: string;
		try {
			returned = String(tallEditor?.scrollToThread(threadId));
		} catch (error) {
			threw = error instanceof Error ? error.message : String(error);
			returned = '(threw)';
		}
		const after = sampleScroll();
		const moved =
			after.winY !== before.winY ||
			after.domTop !== before.domTop ||
			after.scrollerTop !== before.scrollerTop;
		scrollJson = JSON.stringify({
			threadId,
			before,
			after,
			moved,
			threw,
			returned,
			calls: scrollCalls.length - callsBefore,
			lastCallArgument: scrollCalls.at(-1) ?? null
		});
		record(name, moved ? 'completed' : 'refused', undefined, {
			reason: 'nothing on this page scrolled',
			tally: tallTally()
		});
	}

	/**
	 * The CONTROL for the scroll measurement, and the reason the assertions above
	 * it mean anything.
	 *
	 * Without it, "the anchor did not move" is equally well explained by a fixture
	 * that was never scrollable and by a component that failed to scroll it. This
	 * does what `scrollToThread` is trying to do, by the mechanism the component's
	 * OTHER scroll path already uses (`scrollAnchorIntoView`, review-editor-impl
	 * .svelte:344-353, calls `scrollIntoView` on the anchor element). If this moves
	 * the anchor and `scrollToThread` does not, the difference is the method.
	 */
	function scrollAnchorControl() {
		const before = sampleScroll();
		document
			.querySelector(`#${TALL_ID} .ProseMirror span.comment-anchor`)
			?.scrollIntoView({ behavior: 'instant', block: 'center' });
		const after = sampleScroll();
		scrollJson = JSON.stringify({
			threadId: '(scrollIntoView control)',
			before,
			after,
			moved:
				after.winY !== before.winY ||
				after.domTop !== before.domTop ||
				after.scrollerTop !== before.scrollerTop,
			threw: null,
			returned: 'undefined',
			calls: 0,
			lastCallArgument: null
		});
	}

	let editorIdentityJson = $state('null');

	function readEditorIdentity() {
		const tall = tallEditor?.getEditor() ?? null;
		const content = contentEditor?.getEditor() ?? null;
		let actionCtxIsEditorCtx: boolean | null = null;
		let actionThrew: string | null = null;
		try {
			// Proves the handle is a LIVE Milkdown `Editor` rather than a stub or a
			// plain object, without importing a ctx slice key: `action` runs its
			// callback against the editor's own `Ctx` synchronously and hands back
			// the result, so the ctx the callback receives must BE `editor.ctx`.
			// A `!== null` assertion passes against any object; this does not.
			actionCtxIsEditorCtx = tall ? tall.action((ctx) => ctx) === tall.ctx : null;
		} catch (error) {
			actionThrew = error instanceof Error ? error.message : String(error);
		}
		editorIdentityJson = JSON.stringify({
			present: tall !== null,
			status: tall?.status ?? null,
			stableAcrossCalls: tall !== null && tall === (tallEditor?.getEditor() ?? null),
			// Two ReviewEditors on one page must hand back two DIFFERENT editors.
			// A non-null check passes against a module-level singleton; this does not.
			distinctFromOtherInstance: tall !== null && content !== null && tall !== content,
			actionCtxIsEditorCtx,
			actionThrew,
			viewDocSize: tallEditor?.getView()?.state.doc.content.size ?? null,
			otherViewDocSize: contentEditor?.getView()?.state.doc.content.size ?? null
		});
	}

	async function seedTallThread() {
		await select(tallEditor, TALL_FROM, TALL_TO);
		const created =
			tallEditor?.createThread(`The scroll target, anchored to "${TALL_QUOTE}".`, AUTHOR) ?? null;
		tallAnchoredId = created ?? '';
		record('createThread(scroll)', created ? 'created' : 'refused', created, {
			reason: 'no text is currently selected',
			noun: 'the scroll target thread',
			tally: tallTally()
		});
	}
</script>

<div style="max-width: 60rem; margin: 0 auto; padding: 2rem 1rem; display: grid; gap: 1.5rem;">
	<header>
		<h1>Review Imperative</h1>
		<p>
			Drives the eight thread and comment mutation methods through <code>bind:this</code>, against
			an editable and a <code>readonly</code> instance, plus
			<code>setMarkdown</code>/<code>reset</code>/<code>getMarkdown</code>/<code>getAst</code> on a
			third instance and <code>scrollToThread</code>/<code>getEditor</code> on a fourth.
		</p>
	</header>

	<section aria-labelledby="editable-heading">
		<h2 id="editable-heading">Editable</h2>
		<div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.75rem;">
			<button data-testid="create-thread" onclick={() => keepingFocus(createAnchoredThread)}
				>createThread</button
			>
			<button
				data-testid="create-thread-nodomselect"
				onclick={() => {
					// Captured BEFORE the call: this is the range the user actually has
					// selected, which is what the resulting anchor ought to match.
					const view = editor?.getView();
					selectionAtCall = view
						? JSON.stringify({ from: view.state.selection.from, to: view.state.selection.to })
						: 'null';
					// No selection step: uses whatever the user has already selected. This
					// is the plain consumer path for createThread.
					const dragged = editor?.createThread('From a real drag', AUTHOR) ?? null;
					record('createThread(existing selection)', dragged ? 'created' : 'refused', dragged, {
						reason: 'no text is currently selected',
						noun: 'a thread'
					});
					probeOffsets();
				}}>createThread (existing selection)</button
			>
			<button
				data-testid="create-document-thread"
				onclick={() => {
					const documentId = editor?.createDocumentThread('Document-level note', AUTHOR) ?? null;
					// createDocumentThread's ONLY guard is readonly (verified against the
					// component source: no view check, no other branch), which is
					// structurally impossible on this instance. A refusal here would be
					// genuinely unexpected, so the reason says that rather than naming a
					// branch that cannot fire.
					record('createDocumentThread', documentId ? 'created' : 'refused', documentId, {
						reason: 'unexpected — this method has no other guard on an editable instance',
						noun: 'a document-level thread'
					});
					probeOffsets();
				}}>createDocumentThread</button
			>
			<button
				data-testid="create-block-thread"
				onclick={() =>
					keepingFocus(async () => {
						// No text selection: a block thread anchors to the block the caret
						// sits in, which is the affordance that distinguishes it from
						// createThread. Collapse into paragraph three first.
						await select(editor, 200, 200);
						const blockId = editor?.createBlockThread('Whole-block note', AUTHOR) ?? null;
						// Two REAL bail branches remain possible on this instance (readonly is
						// not): the view is unavailable, or the caret sits outside any block
						// node. The earlier version named only the view branch and was
						// reproducibly wrong — verified live that this reason fired at document
						// position 0 (depth 0, outside every block) with the view fully mounted.
						record('createBlockThread', blockId ? 'created' : 'refused', blockId, {
							reason: 'the editor view is not ready, or the caret is not inside a block',
							noun: 'a block-level thread'
						});
						probeOffsets();
					})}>createBlockThread</button
			>
			<button
				data-testid="create-block-thread-at-doc-start"
				onclick={() =>
					keepingFocus(async () => {
						// Document position 0 resolves to depth 0 — outside every block node.
						// This is the REACHABLE-with-a-mounted-view branch of createBlockThread's
						// guard, distinct from "view unavailable", and it is what the reason
						// string above has to cover honestly rather than blaming only the view.
						await select(editor, 0, 0);
						const blockId = editor?.createBlockThread('Should not exist', AUTHOR) ?? null;
						record('createBlockThread', blockId ? 'created' : 'refused', blockId, {
							reason: 'the editor view is not ready, or the caret is not inside a block',
							noun: 'a block-level thread'
						});
					})}>createBlockThread (at doc start)</button
			>
			<button
				data-testid="create-comment"
				onclick={() => {
					const id = editor?.createComment(firstThreadId(threads), 'A reply', AUTHOR) ?? null;
					record('createComment', id ? 'created' : 'refused', id, {
						reason: 'no thread exists to comment on',
						noun: 'a comment'
					});
				}}>createComment</button
			>
			<button
				data-testid="update-comment"
				onclick={() => {
					// These five void methods return nothing, so "did it actually do
					// something" has to be checked BEFORE the call rather than inferred
					// from the return value. The original version announced "completed"
					// unconditionally — reproduced live on a fresh page load with no
					// threads: `updateComment` said "completed" though nothing was edited.
					recordVoid(
						'updateComment',
						() =>
							editor?.updateComment(firstThreadId(threads), firstCommentId(threads), 'Edited body'),
						'no eligible comment to update'
					);
				}}>updateComment</button
			>
			<button
				data-testid="delete-comment-soft"
				onclick={() => {
					recordVoid(
						'deleteComment(soft default)',
						() => editor?.deleteComment(firstThreadId(threads), firstCommentId(threads)),
						'no eligible comment to delete'
					);
				}}>deleteComment (soft)</button
			>
			<button
				data-testid="delete-comment-hard"
				onclick={() => {
					recordVoid(
						'deleteComment(hard)',
						() => editor?.deleteComment(firstThreadId(threads), firstCommentId(threads), false),
						'no eligible comment to delete'
					);
				}}>deleteComment (hard)</button
			>
			<button
				data-testid="delete-thread"
				onclick={() => {
					recordVoid(
						'deleteThread',
						() => editor?.deleteThread(firstThreadId(threads)),
						'no eligible thread to delete'
					);
					probeOffsets();
				}}>deleteThread</button
			>
			<button
				data-testid="clear-all-threads"
				onclick={() => {
					// Routed through `recordVoid` like the other four void methods. It was
					// the one exception, announcing "completed" unconditionally — so
					// pressing it with nothing to clear reported success for a call that
					// bailed at `threads.length === 0`, which is exactly the defect the
					// other four were fixed for.
					recordVoid('clearAllThreads', () => editor?.clearAllThreads(), 'no threads to clear');
					probeOffsets();
				}}>clearAllThreads</button
			>
			<button
				data-testid="insert-before-block"
				onclick={() => {
					// Inserts BEFORE the block a block thread anchors, so its ProseMirror
					// positions must shift by exactly the inserted length if mapping works.
					// `edit-elsewhere` below appends to paragraph three, which IS that
					// block — so it could never distinguish "survived the edit" from
					// "nothing happened at all".
					value = value.replace(PARAGRAPH_ONE, `${BLOCK_SHIFT_TEXT}${PARAGRAPH_ONE}`);
				}}>insert before block</button
			>
			<button
				data-testid="edit-elsewhere"
				onclick={() => {
					// Edits paragraph three, far from the anchored quote in paragraph
					// one. RE-1 asks whether a block thread survives an edit elsewhere.
					value = value.replace(PARAGRAPH_THREE, `${PARAGRAPH_THREE} Mitigation is drafted.`);
				}}>edit elsewhere</button
			>
			<button
				data-testid="remove-quote"
				onclick={() => {
					// Removes the quoted word entirely, which is the ORPHANING path —
					// distinct from a consumer-initiated delete, and it fires no
					// onthreaddelete.
					value = value.replace('a dashboard, ', 'a ');
				}}>remove quoted text</button
			>
			<button data-testid="probe-offsets" onclick={probeOffsets}>probe offsets</button>
			<button data-testid="read-selection" onclick={readSelection}>read selection</button>
			<button
				data-testid="select-quote"
				onclick={() =>
					keepingFocus(async () => {
						await select(editor, QUOTE_FROM, QUOTE_TO);
						readSelection();
					})}>select quote</button
			>
		</div>

		<div data-testid="editor-host">
			<ReviewEditor
				bind:this={editor}
				id="imperative-editor"
				name="imperative"
				bind:value
				bind:threads
				currentUserId={AUTHOR}
				onthreadcreate={(event) => {
					events = [...events, `onthreadcreate:${event.requestId}`];
					applyThreadCreate(event);
					probeOffsets();
				}}
				onthreaddelete={(event) => {
					events = [...events, `onthreaddelete:${event.threadId}`];
					threads = deleteThreadReducer(threads, event.threadId).threads;
					probeOffsets();
				}}
				oncommentcreate={(event) => {
					events = [...events, `oncommentcreate:${event.threadId}`];
					threads = addComment(threads, event.threadId, {
						id: event.requestId,
						threadId: event.threadId,
						authorId: event.authorId,
						body: event.body,
						createdAt: timestamp(),
						mentions: event.mentions
					}).threads;
				}}
				oncommentupdate={(event) => {
					events = [...events, `oncommentupdate:${event.threadId}`];
					threads = updateCommentReducer(threads, event.threadId, event.commentId, {
						body: event.body,
						editedAt: timestamp()
					}).threads;
				}}
				oncommentdelete={(event) => {
					// `soft` is on the event, so the spec can tell the two delete shapes
					// apart without inspecting the resulting thread. Note the reducer is
					// called WITHOUT an explicit `deletedAt` here — the documented
					// exception where omitting it stamps a timestamp rather than no-opping.
					events = [...events, `oncommentdelete:${event.threadId}:soft=${event.soft}`];
					threads = deleteCommentReducer(threads, event.threadId, event.commentId, {
						soft: event.soft
					}).threads;
				}}
			/>
		</div>
	</section>

	<section aria-labelledby="readonly-heading">
		<h2 id="readonly-heading">Readonly</h2>
		<div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.75rem;">
			<button data-testid="ro-create-thread" onclick={createAnchoredThreadReadonly}
				>createThread</button
			>
			<button
				data-testid="ro-create-document-thread"
				onclick={() =>
					recordRefused(
						'createDocumentThread(readonly)',
						readonlyEditor?.createDocumentThread('Nope', AUTHOR) ?? null
					)}>createDocumentThread</button
			>
			<button
				data-testid="ro-create-block-thread"
				onclick={() =>
					recordRefused(
						'createBlockThread(readonly)',
						readonlyEditor?.createBlockThread('Nope', AUTHOR) ?? null
					)}>createBlockThread</button
			>
			<button
				data-testid="ro-create-comment"
				onclick={() =>
					recordRefused(
						'createComment(readonly)',
						readonlyEditor?.createComment(firstThreadId(readonlyThreads), 'Nope', AUTHOR) ?? null
					)}>createComment</button
			>
			<button
				data-testid="ro-update-comment"
				onclick={() => {
					readonlyEditor?.updateComment(
						firstThreadId(readonlyThreads),
						firstCommentId(readonlyThreads),
						'Nope'
					);
					recordRefused('updateComment(readonly)');
				}}>updateComment</button
			>
			<button
				data-testid="ro-delete-comment"
				onclick={() => {
					readonlyEditor?.deleteComment(
						firstThreadId(readonlyThreads),
						firstCommentId(readonlyThreads)
					);
					recordRefused('deleteComment(readonly)');
				}}>deleteComment</button
			>
			<button
				data-testid="ro-delete-thread"
				onclick={() => {
					readonlyEditor?.deleteThread(firstThreadId(readonlyThreads));
					recordRefused('deleteThread(readonly)');
				}}>deleteThread</button
			>
			<button
				data-testid="ro-clear-all-threads"
				onclick={() => {
					readonlyEditor?.clearAllThreads();
					recordRefused('clearAllThreads(readonly)');
				}}>clearAllThreads</button
			>
			<button
				data-testid="ro-set-markdown"
				onclick={() => {
					// setMarkdown and reset do NOT carry the readonly guard the eight
					// mutation methods do. RE-3 calls that undecided; this pins what
					// the shipped component actually does.
					readonlyEditor?.setMarkdown('# Replaced through a readonly editor');
					record('setMarkdown(readonly)', 'completed', undefined);
				}}>setMarkdown</button
			>
			<button data-testid="ro-reset" onclick={resetReadonly}>reset</button>
		</div>

		<ReviewEditor
			bind:this={readonlyEditor}
			id="imperative-readonly"
			name="imperative-readonly"
			mode="readonly"
			bind:value={readonlyValue}
			bind:threads={readonlyThreads}
			currentUserId={AUTHOR}
			onthreadcreate={(event) => {
				readonlyEvents = [...readonlyEvents, `onthreadcreate:${event.requestId}`];
			}}
			onthreaddelete={(event) => {
				readonlyEvents = [...readonlyEvents, `onthreaddelete:${event.threadId}`];
				readonlyThreads = deleteThreadReducer(readonlyThreads, event.threadId).threads;
			}}
			oncommentcreate={(event) => {
				readonlyEvents = [...readonlyEvents, `oncommentcreate:${event.threadId}`];
				readonlyThreads = addComment(readonlyThreads, event.threadId, {
					id: event.requestId,
					threadId: event.threadId,
					authorId: event.authorId,
					body: event.body,
					createdAt: timestamp()
				}).threads;
			}}
			oncommentupdate={(event) => {
				readonlyEvents = [...readonlyEvents, `oncommentupdate:${event.threadId}`];
				readonlyThreads = updateCommentReducer(readonlyThreads, event.threadId, event.commentId, {
					body: event.body,
					editedAt: timestamp()
				}).threads;
			}}
			oncommentdelete={(event) => {
				readonlyEvents = [...readonlyEvents, `oncommentdelete:${event.threadId}`];
				readonlyThreads = deleteCommentReducer(readonlyThreads, event.threadId, event.commentId, {
					soft: event.soft
				}).threads;
			}}
		/>
	</section>

	<section aria-labelledby="content-heading">
		<h2 id="content-heading">Content replacement and reset</h2>
		<div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.75rem;">
			<button data-testid="content-seed" onclick={() => keepingFocus(seedContentThreads)}
				>seed two threads</button
			>
			<button data-testid="content-set-markdown" onclick={setContentMarkdown}>setMarkdown</button>
			<button data-testid="content-reset" onclick={resetContent}>reset</button>
			<button data-testid="content-get-markdown" onclick={readContentMarkdown}>getMarkdown</button>
			<button data-testid="content-get-ast" onclick={readContentAst}>getAst</button>
			<button data-testid="content-probe-undo" onclick={readContentUndoDepth}
				>probe undo depth</button
			>
			<button data-testid="content-undo" onclick={undoContent}>undo</button>
		</div>

		<ReviewEditor
			bind:this={contentEditor}
			id="imperative-content"
			original={CONTENT_ORIGINAL}
			bind:value={contentValue}
			bind:threads={contentThreads}
			currentUserId={AUTHOR}
			onthreadcreate={(event) => {
				contentEvents = [...contentEvents, `onthreadcreate:${event.requestId}`];
				contentThreads = addThread(contentThreads, threadFromCreateEvent(event)).threads;
			}}
			onthreaddelete={(event) => {
				contentEvents = [...contentEvents, `onthreaddelete:${event.threadId}`];
				contentThreads = deleteThreadReducer(contentThreads, event.threadId).threads;
			}}
		/>
	</section>

	<section aria-labelledby="scroll-heading">
		<h2 id="scroll-heading">Scroll and editor handle</h2>
		<div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.75rem;">
			<button data-testid="tall-seed" onclick={() => keepingFocus(seedTallThread)}
				>createThread at the foot</button
			>
			<button
				data-testid="scroll-to-thread"
				onclick={() => runScroll('scrollToThread(anchored)', tallAnchoredId)}
				>scrollToThread (anchored)</button
			>
			<button
				data-testid="scroll-to-orphan"
				onclick={() => runScroll('scrollToThread(orphaned)', TALL_ORPHAN_ID)}
				>scrollToThread (orphaned)</button
			>
			<button
				data-testid="scroll-to-unknown"
				onclick={() => runScroll('scrollToThread(unknown id)', 'no-such-thread')}
				>scrollToThread (unknown id)</button
			>
			<button data-testid="scroll-into-view-control" onclick={scrollAnchorControl}
				>scrollIntoView control</button
			>
			<button data-testid="read-editor-identity" onclick={readEditorIdentity}>getEditor</button>
		</div>

		<ReviewEditor
			bind:this={tallEditor}
			id={TALL_ID}
			bind:value={tallValue}
			bind:threads={tallThreads}
			currentUserId={AUTHOR}
			onthreadcreate={(event) => {
				tallEvents = [...tallEvents, `onthreadcreate:${event.requestId}`];
				tallThreads = addThread(tallThreads, threadFromCreateEvent(event)).threads;
			}}
			onthreaddelete={(event) => {
				tallEvents = [...tallEvents, `onthreaddelete:${event.threadId}`];
				tallThreads = deleteThreadReducer(tallThreads, event.threadId).threads;
			}}
		/>
	</section>

	<p
		aria-live="polite"
		aria-atomic="true"
		bind:this={regionNode}
		data-testid="announcement"
		style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap;"
	>
		{announcement}
	</p>

	<p data-testid="announce-mutations" style="display: none;">{announceMutations}</p>

	<section
		aria-labelledby="readouts-heading"
		style="font-family: ui-monospace, monospace; font-size: 0.8rem; display: grid; gap: 0.25rem;"
	>
		<h2 id="readouts-heading" style="font-family: inherit;">Readouts</h2>
		<p data-testid="thread-count" style="margin: 0;">threads: {threads.length}</p>
		<p data-testid="last-call" style="margin: 0;">last call: {lastCall}</p>
		<p data-testid="last-return" style="margin: 0;">last return: {lastReturn}</p>
		<p data-testid="anchors-json" style="margin: 0; word-break: break-all;">{anchorsJson}</p>
		<p data-testid="probe-json" style="margin: 0; word-break: break-all;">{probeJson}</p>
		<p data-testid="selection-json" style="margin: 0; word-break: break-all;">{selectionJson}</p>
		<p data-testid="selection-at-call" style="margin: 0; word-break: break-all;">
			{selectionAtCall}
		</p>
		<p data-testid="events" style="margin: 0; word-break: break-all;">{events.join('|')}</p>
		<p data-testid="ro-thread-count" style="margin: 0;">
			readonly threads: {readonlyThreads.length}
		</p>
		<p data-testid="ro-anchors-json" style="margin: 0; word-break: break-all;">
			{readonlyAnchorsJson}
		</p>
		<p data-testid="ro-events" style="margin: 0; word-break: break-all;">
			{readonlyEvents.join('|')}
		</p>
		<p data-testid="ro-comment-bodies" style="margin: 0; word-break: break-all;">
			{readonlyThreads.flatMap((t) => t.comments.map((c) => c.body)).join('|')}
		</p>
		<p data-testid="comment-bodies" style="margin: 0; word-break: break-all;">
			{threads.flatMap((t) => t.comments.map((c) => c.body)).join('|')}
		</p>
		<p data-testid="ro-value-length" style="margin: 0;">
			readonly value length: {readonlyValue.length}
		</p>
		<p data-testid="value-length" style="margin: 0;">value length: {value.length}</p>
		<p data-testid="content-thread-count" style="margin: 0;">
			content threads: {contentThreads.length}
		</p>
		<p data-testid="content-anchors-json" style="margin: 0; word-break: break-all;">
			{contentAnchorsJson}
		</p>
		<p data-testid="content-events" style="margin: 0; word-break: break-all;">
			{contentEvents.join('|')}
		</p>
		<p data-testid="content-markdown-json" style="margin: 0; word-break: break-all;">
			{contentMarkdownJson}
		</p>
		<p data-testid="content-ast-json" style="margin: 0; word-break: break-all;">{contentAstJson}</p>
		<p data-testid="content-ast-error" style="margin: 0; word-break: break-all;">
			{contentAstError}
		</p>
		<p data-testid="content-undo-json" style="margin: 0;">
			{JSON.stringify({ probe: contentUndoProbes, depth: contentUndoDepth })}
		</p>
		<p data-testid="tall-thread-count" style="margin: 0;">scroll threads: {tallThreads.length}</p>
		<p data-testid="tall-anchors-json" style="margin: 0; word-break: break-all;">
			{tallAnchorsJson}
		</p>
		<p data-testid="tall-events" style="margin: 0; word-break: break-all;">
			{tallEvents.join('|')}
		</p>
		<p data-testid="scroll-json" style="margin: 0; word-break: break-all;">{scrollJson}</p>
		<p data-testid="editor-identity-json" style="margin: 0; word-break: break-all;">
			{editorIdentityJson}
		</p>
	</section>
</div>

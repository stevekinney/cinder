<script lang="ts">
	import {
		ReviewEditor,
		createReviewEditorState,
		toPersistedThreads,
		toRuntimeThreads,
		type PersistedThread,
		type ReviewState,
		type Thread
	} from '@lostgradient/editor/review-editor';
	import {
		STORAGE_KEY_PREFIX,
		addDraftComment,
		clearAllPersistedSessions,
		clearReviewOutcome,
		clearSession,
		createSession,
		deleteDraftComment,
		fromPersistedSession,
		getDraftCounts,
		getStorageKey,
		hasPersistedSession,
		listPersistedSessions,
		loadSession,
		saveSession,
		setReviewOutcome,
		submitSession,
		updateDraftComment,
		validateSessionSchema,
		type DraftComment,
		type PersistedReviewSession,
		type ReviewSession
	} from '@lostgradient/editor/session';
	import {
		generateCommentsExport,
		generateMarkdownSummary,
		generateUnifiedDiff
	} from '@lostgradient/editor/export';

	// =========================================================================
	// Review state and session persistence
	//
	// The state/session/persistence modules of `@lostgradient/editor` are only
	// reachable by importing them directly — nothing in `ReviewEditorProps`
	// accepts a session, an outcome, or a draft comment, and there is no
	// `onreviewsubmit`. This route drives those modules as a harness and parks
	// them next to a LIVE editor so the seam between "module says X" and
	// "component does Y" is observable rather than merely asserted.
	//
	// Two things this route exercises are NEW as of cinder PR #1266 (merged,
	// pending release; the installed `@lostgradient/editor` here is overlaid
	// with that build):
	//
	//   * `bind:this` on `<ReviewEditor>` now forwards the implementation's
	//     imperative surface. Before the fix the public wrapper rendered the
	//     implementation WITHOUT `bind:this` and re-exported nothing, so all 22
	//     methods were unreachable and the entire persisted round-trip was dead
	//     from the published entry point. Every `editor?.…` call below would
	//     have been a no-op.
	//   * A seeded anchor whose quote is not actually at its stated
	//     `from`/`to` now triggers re-anchoring instead of decorating whatever
	//     happens to sit there.
	// =========================================================================

	const keysOf = (value: object): string => Object.keys(value).sort().join(',');
	const allIdentical = (values: string[]): string =>
		values.every((entry) => entry === values[0]) ? 'identical' : 'differs';

	// -------------------------------------------------------------------------
	// The reviewed document. `original` is the baseline, `value` the edited
	// copy, and one thread is anchored to the heading text.
	// -------------------------------------------------------------------------
	const ORIGINAL_DOCUMENT = `# Release Plan

The first release includes a dashboard and export actions.`;

	const EDITED_DOCUMENT = `# Release Plan

The first release includes a dashboard, export actions, and inline review.`;

	// `from`/`to` are PROSEMIRROR POSITIONS. "# " is Markdown markup rather than
	// document text, so the doc's first text position is 1 and the 12-character
	// quote "Release Plan" occupies 1..13. `lastKnownOffset` in the same object
	// is a `textBetween()` offset — 0 for that same quote. Two coordinate
	// spaces, one object, nothing that warns when you mix them up.
	function seededThread(): Thread {
		return {
			id: 'thread-release-plan',
			createdAt: '2026-08-11T09:00:00.000Z',
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
					id: 'comment-release-plan',
					threadId: 'thread-release-plan',
					authorId: 'maya',
					body: 'Confirm this title matches the changelog.',
					createdAt: '2026-08-11T09:00:00.000Z'
				}
			]
		};
	}

	let original = $state(ORIGINAL_DOCUMENT);
	let value = $state(EDITED_DOCUMENT);
	let threads = $state<Thread[]>([seededThread()]);

	// `bind:this` is deliberately a plain `let`, not `$state`: every readout it
	// feeds is written by a click handler, so nothing needs to re-render when
	// the instance itself is assigned.
	let editor: ReturnType<typeof ReviewEditor> | undefined;

	// Notification-only callbacks — the component owns the mutation through the
	// bindable props, so the log is the only way to see that they fired.
	let events = $state<string[]>([]);
	const record = (entry: string) => {
		events = [...events, entry];
	};

	// -------------------------------------------------------------------------
	// The imperative surface, probed by name.
	//
	// `Object.keys()` on a Svelte 5 component instance is reported separately
	// from a `typeof` probe because the two can disagree: what makes a method
	// *reachable* is that it is callable, not that it enumerates.
	// -------------------------------------------------------------------------
	const IMPERATIVE_METHODS = [
		'clearAllThreads',
		'createBlockThread',
		'createComment',
		'createDocumentThread',
		'createThread',
		'deleteComment',
		'deleteThread',
		'exportMarkdownSummary',
		'exportUnifiedDiff',
		'focus',
		'getAst',
		'getEditor',
		'getFormData',
		'getMarkdown',
		'getSelection',
		'getState',
		'getView',
		'reset',
		'scrollToThread',
		'setMarkdown',
		'setState',
		'updateComment'
	] as const;

	let instanceOwnKeys = $state('(not probed)');
	let instanceCallableMethods = $state('(not probed)');
	let instanceCallableCount = $state('(not probed)');

	function probeInstance(): void {
		const instance = editor as unknown as Record<string, unknown> | undefined;
		if (!instance) {
			instanceOwnKeys = '(no instance)';
			instanceCallableMethods = '(no instance)';
			instanceCallableCount = '(no instance)';
			return;
		}
		instanceOwnKeys = Object.keys(instance).sort().join(',');
		const callable = IMPERATIVE_METHODS.filter((name) => typeof instance[name] === 'function');
		instanceCallableMethods = callable.join(',');
		instanceCallableCount = `${callable.length}/${IMPERATIVE_METHODS.length}`;
	}

	// -------------------------------------------------------------------------
	// getState() / setState() — the persisted round-trip.
	// -------------------------------------------------------------------------
	let capturedJson = $state('');
	let stateSchemaVersion = $state('(not captured)');
	let stateKeys = $state('(not captured)');
	let stateJsonKeys = $state('(not captured)');
	let stateAnchorKeys = $state('(not captured)');
	let stateJsonAnchorKeys = $state('(not captured)');
	let stateReviewSession = $state('(not captured)');
	let stateFrontMatter = $state('(not captured)');
	let stateOriginalLength = $state('(not captured)');

	function captureState(): void {
		const state = editor?.getState();
		if (!state) return;
		const json = JSON.stringify(state);
		const parsed = JSON.parse(json) as ReviewState;

		capturedJson = json;
		stateSchemaVersion = String(state.schemaVersion);
		stateKeys = keysOf(state);
		stateJsonKeys = keysOf(parsed);
		// getState() builds each persisted anchor by naming eight fields
		// explicitly — `blockId` and `originalPosition` included, even when
		// undefined — so they are present as KEYS in memory and vanish only
		// once JSON.stringify drops undefined-valued properties.
		stateAnchorKeys = state.threads[0] ? keysOf(state.threads[0].anchor) : '(no threads)';
		stateJsonAnchorKeys = parsed.threads[0] ? keysOf(parsed.threads[0].anchor) : '(no threads)';
		stateReviewSession = `in-memory-key=${'reviewSession' in state} value=${String(
			state.reviewSession
		)} after-json-key=${'reviewSession' in parsed}`;
		stateFrontMatter = `frontMatter=${JSON.stringify(state.frontMatter ?? null)} frontMatterRaw=${JSON.stringify(state.frontMatterRaw ?? null)}`;
		stateOriginalLength = String(state.original?.length ?? 0);
	}

	function parseCaptured(): ReviewState | null {
		if (!capturedJson) return null;
		return JSON.parse(capturedJson) as ReviewState;
	}

	/** Round-trip the captured state verbatim. */
	function restoreCaptured(): void {
		const state = parseCaptured();
		if (state) editor?.setState(state);
	}

	/**
	 * Restore the same threads against a document that has grown a preface.
	 * The persisted anchor carries no `from`/`to`, so the only way the thread
	 * can land correctly is for setState to re-anchor by quote.
	 */
	function restoreIntoShiftedDocument(): void {
		const state = parseCaptured();
		if (!state) return;
		editor?.setState({
			...state,
			content: `# Preface\n\nA section inserted ahead of the reviewed heading.\n\n${state.content}`
		});
	}

	/** Restore into a document where the anchored quote no longer exists. */
	function restoreWithQuoteRemoved(): void {
		const state = parseCaptured();
		if (!state) return;
		editor?.setState({
			...state,
			content: '# Retitled\n\nThe quoted heading text is gone from this revision.'
		});
	}

	/** setState is the only reachable writer for the bindable `original`. */
	function restoreWithDifferentOriginal(): void {
		const state = parseCaptured();
		if (!state) return;
		editor?.setState({
			...state,
			original: `${state.original ?? ''}\n\nAn extra baseline paragraph.`
		});
	}

	/** Feed a v1 state back in and see what version comes out. */
	let schemaVersionAfterRestore = $state('(not restored)');
	function restoreAsSchemaVersionOne(): void {
		const state = parseCaptured();
		if (!state) return;
		editor?.setState({ ...state, schemaVersion: 1 });
		schemaVersionAfterRestore = String(editor?.getState().schemaVersion ?? '(no instance)');
	}

	/**
	 * `toPersistedThreads` is the same lossy projection getState() applies, but
	 * exported for callers doing their own persistence.
	 */
	let toPersistedAnchorKeys = $state('(not probed)');
	function probeToPersistedThreads(): void {
		const persisted = toPersistedThreads(threads);
		toPersistedAnchorKeys = persisted[0] ? keysOf(persisted[0].anchor) : '(no threads)';
	}

	// -------------------------------------------------------------------------
	// createReviewEditorState(): exported, reactive — and consumed by nothing.
	//
	// The live editor above builds its OWN instance internally. This one reads
	// the same three inputs, so its DERIVED values track the editor exactly,
	// while its two SETTERS (`setActiveView`, `setDiffViewMode`) drive nothing
	// at all. That asymmetry is the whole point of putting it here.
	// -------------------------------------------------------------------------
	const moduleState = createReviewEditorState({
		getOriginal: () => original,
		getValue: () => value,
		getThreads: () => threads
	});

	// -------------------------------------------------------------------------
	// A second editor seeded with PersistedThread[] — anchors with no from/to.
	//
	// `toRuntimeThreads` is the exported converter for exactly this: it seeds
	// the missing `from`/`to` to the neutral 0/0 sentinel, and the anchor
	// plugin re-anchors each thread by quote against the live document on
	// mount, writing the real positions back through the two-way binding.
	// -------------------------------------------------------------------------
	//
	// Two threads, because the recovered range depends on where the quote sits:
	// one quoting the heading (whose text ends at a block boundary) and one
	// quoting inside the paragraph.
	function persistedFixture(): PersistedThread[] {
		return [
			{
				id: 'thread-persisted-heading',
				createdAt: '2026-08-11T09:00:00.000Z',
				anchor: {
					quote: 'Release Plan',
					prefix: '# ',
					suffix: '\n\nThe first release',
					status: 'anchored'
				},
				comments: [
					{
						id: 'comment-persisted-heading',
						threadId: 'thread-persisted-heading',
						authorId: 'maya',
						body: 'Restored from storage with no runtime positions.',
						createdAt: '2026-08-11T09:00:00.000Z'
					}
				]
			},
			{
				id: 'thread-persisted-inline',
				createdAt: '2026-08-11T09:00:00.000Z',
				anchor: {
					quote: 'export actions',
					prefix: 'a dashboard, ',
					suffix: ', and inline review.',
					status: 'anchored'
				},
				comments: [
					{
						id: 'comment-persisted-inline',
						threadId: 'thread-persisted-inline',
						authorId: 'maya',
						body: 'Same restore path, but the quote sits mid-paragraph.',
						createdAt: '2026-08-11T09:00:00.000Z'
					}
				]
			}
		];
	}

	let persistedSeededThreads = $state<Thread[]>(toRuntimeThreads(persistedFixture()));
	const persistedSeededAnchor = $derived(persistedSeededThreads[0]?.anchor);
	// `to - from` versus the quote's own length: the two agree for a quote that
	// sits inside a paragraph and disagree by one for a quote that ends at a
	// block boundary (see the assertions in the spec).
	const persistedAnchorWidths = $derived(
		persistedSeededThreads
			.map(
				(thread) =>
					`${thread.anchor.quote}:width=${thread.anchor.to - thread.anchor.from}/quote=${thread.anchor.quote.length}`
			)
			.join(' ')
	);

	// -------------------------------------------------------------------------
	// The session module: pure, caller-supplies-time. None of these generate an
	// id or a timestamp; every mutator returns `{ session, changed }`.
	// Evaluated at component init, so these readouts render identically on the
	// server and in the browser.
	// -------------------------------------------------------------------------
	const T_START = '2026-08-11T09:00:00.000Z';
	const T_EARLIER = '2026-08-11T08:00:00.000Z';
	const T_LATER = '2026-08-11T10:00:00.000Z';
	const T_LATEST = '2026-08-11T11:00:00.000Z';

	function draftThreadComment(id: string, createdAt: string): DraftComment {
		return {
			id,
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
			body: 'Draft comment that would open a new thread.',
			authorId: 'maya',
			createdAt,
			updatedAt: createdAt
		};
	}

	function draftReplyComment(id: string, threadId: string, createdAt: string): DraftComment {
		return {
			id,
			threadId,
			body: 'Draft reply to an existing thread.',
			authorId: 'maya',
			createdAt,
			updatedAt: createdAt
		};
	}

	const emptySession = createSession('session-1', T_START);
	const withThreadDraft = addDraftComment(emptySession, draftThreadComment('draft-1', T_LATER));
	const withReplyDraft = addDraftComment(
		withThreadDraft.session,
		draftReplyComment('draft-2', 'thread-release-plan', T_LATER)
	);
	const draftCounts = getDraftCounts(withReplyDraft.session);
	const sessionCounts = `threads=${draftCounts.threads} replies=${draftCounts.replies} total=${draftCounts.total}`;

	// `createSession` stamps `updatedAt` from the caller's `startedAt` and
	// `addDraftComment` clamps: a comment created BEFORE the session started
	// must not drag `updatedAt` backwards. Both timestamps below are inputs —
	// the behavior under test is which of the two wins.
	const backdated = addDraftComment(emptySession, draftThreadComment('draft-old', T_EARLIER));
	const sessionClamp = `session-updatedAt=${backdated.session.updatedAt} comment-createdAt=${T_EARLIER}`;

	// Setting the same outcome twice is a no-op that returns the SAME object
	// reference, not a fresh copy — so a `$state` assignment from it will not
	// even wake a reactive read.
	const outcomeFirst = setReviewOutcome(withReplyDraft.session, 'approve', T_LATER);
	const outcomeAgain = setReviewOutcome(outcomeFirst.session, 'approve', T_LATEST);
	const sameOutcome = `changed=${outcomeAgain.changed} same-reference=${outcomeAgain.session === outcomeFirst.session}`;

	const missingDelete = deleteDraftComment(outcomeFirst.session, 'no-such-draft', T_LATEST);
	const missingDraft = `changed=${missingDelete.changed} same-reference=${missingDelete.session === outcomeFirst.session}`;

	const missingUpdate = updateDraftComment(outcomeFirst.session, 'no-such-draft', {
		body: 'ignored',
		updatedAt: T_LATEST
	});
	const missingUpdateResult = `changed=${missingUpdate.changed} same-reference=${missingUpdate.session === outcomeFirst.session}`;

	// `clearReviewOutcome` and `clearSession` DESTRUCTURE the outcome away
	// rather than assigning undefined, so the key is gone from the object.
	const outcomeCleared = clearReviewOutcome(outcomeFirst.session, T_LATEST);
	const clearedOutcomeKeys = `changed=${outcomeCleared.changed} keys=${keysOf(outcomeCleared.session)}`;

	const sessionCleared = clearSession(outcomeFirst.session, T_LATEST);
	const clearedSessionSummary = `changed=${sessionCleared.changed} drafts=${sessionCleared.session.draftComments.length} keys=${keysOf(sessionCleared.session)}`;

	const submitted = submitSession(outcomeFirst.session, 'request_changes', T_LATEST);
	const submittedAgain = submitSession(submitted.session, 'approve', T_LATEST);
	const submitSummary = `changed=${submitted.changed} status=${submitted.session.status} outcome=${submitted.session.outcome} submittedAt=${submitted.session.submittedAt}`;
	const resubmitSummary = `changed=${submittedAgain.changed} outcome=${submittedAgain.session.outcome} same-reference=${submittedAgain.session === submitted.session}`;

	// -------------------------------------------------------------------------
	// validateSessionSchema — the acceptance matrix.
	// -------------------------------------------------------------------------
	const validationBase: Record<string, unknown> = {
		id: 'session-1',
		status: 'drafting',
		startedAt: T_START,
		updatedAt: T_START,
		draftComments: []
	};

	function validationCase(patch: Record<string, unknown>, dropKey?: string): boolean {
		const candidate = { ...validationBase, ...patch };
		if (dropKey) delete candidate[dropKey];
		return validateSessionSchema(candidate);
	}

	const validationMatrix = [
		`base=${validateSessionSchema(validationBase)}`,
		`outcome-undefined=${validationCase({ outcome: undefined })}`,
		`outcome-null=${validationCase({ outcome: null })}`,
		`outcome-unknown=${validationCase({ outcome: 'merge' })}`,
		`outcome-approve=${validationCase({ outcome: 'approve' })}`,
		`status-archived=${validationCase({ status: 'archived' })}`,
		`status-submitted=${validationCase({ status: 'submitted' })}`,
		`no-draftComments=${validationCase({}, 'draftComments')}`,
		`extra-keys=${validationCase({ somethingElse: 'kept', schemaVersion: 99 })}`,
		`not-an-object=${validateSessionSchema('nope')}`
	].join(' ');

	// A payload carrying a `schemaVersion` passes validation — extra keys are
	// allowed for forward compatibility — and is then silently DROPPED on the
	// way back in: `fromPersistedSession` copies a fixed field list, so the
	// version never reaches the restored session. The persisted session format
	// has no version field of its own and no migration hook to hang one on.
	const versionedPersisted = {
		...validationBase,
		schemaVersion: 99,
		draftComments: []
	} as unknown as PersistedReviewSession;
	const versionedAccepted = `validates=${validateSessionSchema(versionedPersisted)} restored-keys=${keysOf(
		fromPersistedSession(versionedPersisted)
	)}`;

	// -------------------------------------------------------------------------
	// schemaVersion is write-only: nothing in the published package reads it,
	// and no migration exists. Three wildly different values, byte-identical
	// exports, no warning.
	// -------------------------------------------------------------------------
	const exportBaseState: ReviewState = {
		schemaVersion: 4,
		content: EDITED_DOCUMENT,
		original: ORIGINAL_DOCUMENT,
		threads: toPersistedThreads([seededThread()]),
		updatedAt: T_START
	};
	const versionedStates = [1, 4, 99].map(
		(version) =>
			({
				...exportBaseState,
				schemaVersion: version
			}) as unknown as ReviewState
	);
	const schemaVersionMatrix = [
		`summary=${allIdentical(versionedStates.map((state) => generateMarkdownSummary(state).markdown))}`,
		`diff=${allIdentical(versionedStates.map((state) => generateUnifiedDiff(state).diff))}`,
		`comments=${allIdentical(versionedStates.map((state) => generateCommentsExport(state).markdown))}`
	].join(' ');

	// -------------------------------------------------------------------------
	// sessionStorage persistence. Every case gets its OWN document key because
	// sessionStorage is shared across the whole page, and each is driven by a
	// button so the spec controls ordering.
	// -------------------------------------------------------------------------
	const BASIC_KEY = 'sess-basic';
	const SUBMITTED_KEY = 'sess-submitted';
	const BAD_JSON_KEY = 'sess-badjson';
	const BAD_SHAPE_KEY = 'sess-badshape';
	const LIST_KEY_A = 'sess-a';
	const LIST_KEY_B = 'sess-b';

	const storagePrefix = STORAGE_KEY_PREFIX;
	const basicStorageKey = getStorageKey(BASIC_KEY);

	function basicSession(): ReviewSession {
		return addDraftComment(
			createSession('session-basic', T_START),
			draftThreadComment('draft-1', T_LATER)
		).session;
	}

	let saveResult = $state('(not saved)');
	let storedTopLevelKeys = $state('(not saved)');
	let storedAnchorKeys = $state('(not saved)');
	let storedAnchorFromTo = $state('(not saved)');
	let loadedAnchorFromTo = $state('(not loaded)');
	let loadedRoundTrip = $state('(not loaded)');
	let hasAfterLoad = $state('(not loaded)');
	let loadSubmitted = $state('(not run)');
	let loadBadJson = $state('(not run)');
	let loadBadShape = $state('(not run)');
	let sessionList = $state('(not listed)');
	let listAfterClearAll = $state('(not cleared)');

	function clearAllStorage(): void {
		clearAllPersistedSessions();
		saveResult = '(not saved)';
		storedTopLevelKeys = '(not saved)';
		storedAnchorKeys = '(not saved)';
		storedAnchorFromTo = '(not saved)';
		loadedAnchorFromTo = '(not loaded)';
		loadedRoundTrip = '(not loaded)';
		hasAfterLoad = '(not loaded)';
		loadSubmitted = '(not run)';
		loadBadJson = '(not run)';
		loadBadShape = '(not run)';
		sessionList = '(not listed)';
		listAfterClearAll = '(not cleared)';
	}

	function saveBasicSession(): void {
		saveResult = String(saveSession(BASIC_KEY, basicSession()));
		const raw = sessionStorage.getItem(basicStorageKey);
		if (!raw) {
			storedTopLevelKeys = '(nothing stored)';
			storedAnchorKeys = '(nothing stored)';
			storedAnchorFromTo = '(nothing stored)';
			return;
		}
		const stored = JSON.parse(raw) as Record<string, unknown> & {
			draftComments: Array<{ anchor?: Record<string, unknown> }>;
		};
		storedTopLevelKeys = keysOf(stored);
		const anchor = stored.draftComments[0]?.anchor;
		storedAnchorKeys = anchor ? keysOf(anchor) : '(no anchor)';
		storedAnchorFromTo = anchor
			? `from-key=${'from' in anchor} to-key=${'to' in anchor}`
			: '(no anchor)';
	}

	function loadBasicSession(): void {
		const restored = loadSession(BASIC_KEY);
		if (!restored) {
			loadedAnchorFromTo = '(null)';
			loadedRoundTrip = '(null)';
			hasAfterLoad = String(hasPersistedSession(BASIC_KEY));
			return;
		}
		const anchor = restored.draftComments[0]?.anchor;
		loadedAnchorFromTo = anchor ? `from=${anchor.from} to=${anchor.to}` : '(no anchor)';
		loadedRoundTrip = `id=${restored.id} status=${restored.status} drafts=${restored.draftComments.length} quote=${anchor?.quote} authorId=${restored.draftComments[0]?.authorId} createdAt=${restored.draftComments[0]?.createdAt}`;
		hasAfterLoad = String(hasPersistedSession(BASIC_KEY));
	}

	function runSubmittedLoad(): void {
		const session = submitSession(basicSession(), 'approve', T_LATEST).session;
		saveSession(SUBMITTED_KEY, session);
		const before = hasPersistedSession(SUBMITTED_KEY);
		const restored = loadSession(SUBMITTED_KEY);
		loadSubmitted = `stored-before=${before} loaded=${String(restored)} stored-after=${hasPersistedSession(SUBMITTED_KEY)}`;
	}

	function runBadJsonLoad(): void {
		sessionStorage.setItem(getStorageKey(BAD_JSON_KEY), '{ this is not json');
		const before = hasPersistedSession(BAD_JSON_KEY);
		const restored = loadSession(BAD_JSON_KEY);
		loadBadJson = `stored-before=${before} loaded=${String(restored)} stored-after=${hasPersistedSession(BAD_JSON_KEY)}`;
	}

	function runBadShapeLoad(): void {
		// Parses fine, fails `validateSessionSchema`: `status` is not one of
		// 'drafting' | 'submitted'.
		sessionStorage.setItem(
			getStorageKey(BAD_SHAPE_KEY),
			JSON.stringify({ ...validationBase, status: 'archived' })
		);
		const before = hasPersistedSession(BAD_SHAPE_KEY);
		const restored = loadSession(BAD_SHAPE_KEY);
		loadBadShape = `stored-before=${before} loaded=${String(restored)} stored-after=${hasPersistedSession(BAD_SHAPE_KEY)}`;
	}

	function runListSessions(): void {
		saveSession(LIST_KEY_A, createSession('session-a', T_START));
		saveSession(LIST_KEY_B, createSession('session-b', T_START));
		sessionList = listPersistedSessions().sort().join(',');
	}

	function runClearAllSessions(): void {
		clearAllPersistedSessions();
		listAfterClearAll = `count=${listPersistedSessions().length} raw-keys=${Object.keys(sessionStorage).filter((key) => key.startsWith(STORAGE_KEY_PREFIX)).length}`;
	}

	// -------------------------------------------------------------------------
	// SSR safety.
	//
	// Runs at component init, so it executes on the SERVER during SSR and again
	// in the browser during hydration. Only the two readouts that are IDENTICAL
	// in both environments are rendered here: on a document key that has never
	// been written, `loadSession` returns null and `hasPersistedSession`
	// returns false — on the server because the `isBrowser()` guard short-
	// circuits, in the browser because the key is genuinely absent.
	//
	// `saveSession`'s SSR return of `false` and `listPersistedSessions`'s empty
	// array are NOT rendered from init: their browser values differ, and
	// rendering them would manufacture a hydration mismatch on this route. The
	// browser values are pinned through the buttons above instead; the
	// post-hydration effect below reads them without divergence, since both
	// server and client render the placeholder first.
	// -------------------------------------------------------------------------
	const SSR_PROBE_KEY = 'ssr-probe-never-written';
	const ssrProbe = ((): string => {
		try {
			const loaded = loadSession(SSR_PROBE_KEY);
			const present = hasPersistedSession(SSR_PROBE_KEY);
			const listed = listPersistedSessions();
			return `threw=false loadSession=${String(loaded)} hasPersistedSession=${present} listed-is-array=${Array.isArray(listed)}`;
		} catch (error) {
			return `threw=true ${String(error)}`;
		}
	})();

	let browserStorageProbe = $state('(not yet run)');
	let browserProbeHasRun = false;
	$effect(() => {
		// Reads nothing reactive, so it runs exactly once, after hydration —
		// which is what keeps the two environments from disagreeing at hydration
		// time. The explicit guard is belt-and-braces: this probe writes to and
		// then wipes sessionStorage, so a second run mid-test would clobber the
		// persistence cases above.
		if (browserProbeHasRun) return;
		browserProbeHasRun = true;
		browserStorageProbe = `saveSession=${saveSession(SSR_PROBE_KEY, createSession('probe', T_START))} listed=${listPersistedSessions().includes(SSR_PROBE_KEY)}`;
		clearAllPersistedSessions();
	});
</script>

<div style="max-width: 72rem; margin: 0 auto; padding: 1rem; display: grid; gap: 2rem;">
	<section style="display: grid; gap: 0.5rem;">
		<h2 style="margin: 0;">Live editor (imperative state round-trip)</h2>
		<div style="min-height: 30rem;">
			<ReviewEditor
				bind:this={editor}
				id="state-editor"
				bind:original
				bind:value
				bind:threads
				currentUserId="steve"
				onthreaddelete={(event) => record(`threaddelete:${event.threadId}`)}
				onchange={(next) => record(`change:${next.length}`)}
			/>
		</div>

		<div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
			<button type="button" data-testid="probe-instance" onclick={probeInstance}>
				probe bind:this
			</button>
			<button type="button" data-testid="capture-state" onclick={captureState}>getState()</button>
			<button type="button" data-testid="restore-state" onclick={restoreCaptured}>
				setState(captured)
			</button>
			<button type="button" data-testid="restore-shifted" onclick={restoreIntoShiftedDocument}>
				setState(captured + preface)
			</button>
			<button type="button" data-testid="restore-quote-gone" onclick={restoreWithQuoteRemoved}>
				setState(quote removed)
			</button>
			<button
				type="button"
				data-testid="restore-new-original"
				onclick={restoreWithDifferentOriginal}
			>
				setState(new original)
			</button>
			<button type="button" data-testid="restore-v1" onclick={restoreAsSchemaVersionOne}>
				setState(schemaVersion 1)
			</button>
			<button
				type="button"
				data-testid="probe-to-persisted-threads"
				onclick={probeToPersistedThreads}
			>
				toPersistedThreads(threads)
			</button>
		</div>

		<h3 style="margin: 0.5rem 0 0; font-size: 0.9rem;">Observed state</h3>
		<p data-testid="instance-own-keys" style="margin: 0;">instance own keys: {instanceOwnKeys}</p>
		<p data-testid="instance-callable-count" style="margin: 0;">
			callable methods: {instanceCallableCount}
		</p>
		<p data-testid="instance-callable-methods" style="margin: 0; overflow-wrap: anywhere;">
			{instanceCallableMethods}
		</p>
		<p data-testid="state-schema-version" style="margin: 0;">
			schemaVersion: {stateSchemaVersion}
		</p>
		<p data-testid="state-keys" style="margin: 0; overflow-wrap: anywhere;">
			state keys: {stateKeys}
		</p>
		<p data-testid="state-json-keys" style="margin: 0; overflow-wrap: anywhere;">
			state keys after JSON: {stateJsonKeys}
		</p>
		<p data-testid="state-anchor-keys" style="margin: 0; overflow-wrap: anywhere;">
			anchor keys: {stateAnchorKeys}
		</p>
		<p data-testid="state-json-anchor-keys" style="margin: 0; overflow-wrap: anywhere;">
			anchor keys after JSON: {stateJsonAnchorKeys}
		</p>
		<p data-testid="state-review-session" style="margin: 0;">reviewSession: {stateReviewSession}</p>
		<p data-testid="state-front-matter" style="margin: 0;">{stateFrontMatter}</p>
		<p data-testid="state-original-length" style="margin: 0;">
			state.original length: {stateOriginalLength}
		</p>
		<p data-testid="schema-version-after-restore" style="margin: 0;">
			schemaVersion after restoring a v1 state: {schemaVersionAfterRestore}
		</p>
		<p data-testid="to-persisted-anchor-keys" style="margin: 0; overflow-wrap: anywhere;">
			toPersistedThreads anchor keys: {toPersistedAnchorKeys}
		</p>

		<h3 style="margin: 0.5rem 0 0; font-size: 0.9rem;">Live bindable props</h3>
		<p data-testid="live-value-length" style="margin: 0;">value length: {value.length}</p>
		<!--
			`setState(getState())` is not a fixed point on `value`: the authored
			document has no trailing newline, and the content the editor
			re-serializes after a restore usually does. "Usually" is the problem —
			whether the editor re-serializes at all depends on how quickly the
			previous restore settled, so this readout flips between 0 and 1 across
			otherwise identical runs. It is rendered here to be seen, not pinned.
		-->
		<p data-testid="live-value-trailing-newlines" style="margin: 0;">
			trailing newlines: {value.length - value.replace(/\n+$/, '').length}
		</p>
		<p data-testid="live-value-has-preface" style="margin: 0;">
			contains "Preface": {value.includes('# Preface')}
		</p>
		<p data-testid="live-original-length" style="margin: 0;">original length: {original.length}</p>
		<p data-testid="live-thread-count" style="margin: 0;">threads: {threads.length}</p>
		<p data-testid="live-anchor-range" style="margin: 0;">
			anchor range: {threads[0] ? `${threads[0].anchor.from}-${threads[0].anchor.to}` : '(none)'}
		</p>
		<p data-testid="live-anchor-width" style="margin: 0;">
			anchor width: {threads[0]
				? `${threads[0].anchor.to - threads[0].anchor.from}/quote=${threads[0].anchor.quote.length}`
				: '(none)'}
		</p>
		<p data-testid="live-anchor-quote" style="margin: 0;">
			anchor quote: {threads[0]?.anchor.quote ?? '(none)'}
		</p>
		<ul data-testid="event-log" style="margin: 0; padding-left: 1.25rem;">
			{#each events as entry, index (`${index}-${entry}`)}
				<li>{entry}</li>
			{/each}
		</ul>
	</section>

	<section style="display: grid; gap: 0.5rem;">
		<h2 style="margin: 0;">createReviewEditorState() — exported, consumed by nothing</h2>
		<div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
			<button
				type="button"
				data-testid="module-set-diff-view"
				onclick={() => moduleState.setActiveView('diff')}
			>
				setActiveView('diff')
			</button>
			<button
				type="button"
				data-testid="module-set-diff-mode"
				onclick={() => moduleState.setDiffViewMode('original')}
			>
				setDiffViewMode('original')
			</button>
		</div>
		<p data-testid="module-active-view" style="margin: 0;">activeView: {moduleState.activeView}</p>
		<p data-testid="module-diff-view-mode" style="margin: 0;">
			diffViewMode: {moduleState.diffViewMode}
		</p>
		<p data-testid="module-comment-count" style="margin: 0;">
			commentCount: {moduleState.commentCount}
		</p>
		<p data-testid="module-has-changes" style="margin: 0;">
			hasContentChanges: {moduleState.hasContentChanges}
		</p>
	</section>

	<section style="display: grid; gap: 0.5rem;">
		<h2 style="margin: 0;">Editor seeded with PersistedThread[] (no runtime positions)</h2>
		<div style="min-height: 26rem;">
			<ReviewEditor
				id="state-persisted"
				original={ORIGINAL_DOCUMENT}
				value={EDITED_DOCUMENT}
				bind:threads={persistedSeededThreads}
				currentUserId="steve"
			/>
		</div>
		<p data-testid="persisted-anchor-keys" style="margin: 0; overflow-wrap: anywhere;">
			seeded anchor keys: {persistedSeededAnchor ? keysOf(persistedSeededAnchor) : '(no thread)'}
		</p>
		<p data-testid="persisted-anchor-range" style="margin: 0;">
			seeded anchor range: {persistedSeededAnchor
				? `from=${persistedSeededAnchor.from} to=${persistedSeededAnchor.to}`
				: '(no thread)'}
		</p>
		<p data-testid="persisted-anchor-widths" style="margin: 0; overflow-wrap: anywhere;">
			{persistedAnchorWidths}
		</p>
		<p data-testid="persisted-thread-count" style="margin: 0;">
			threads: {persistedSeededThreads.length}
		</p>
	</section>

	<section style="display: grid; gap: 0.5rem;">
		<h2 style="margin: 0;">Session module (pure, caller-supplies-time)</h2>
		<p data-testid="session-counts" style="margin: 0;">{sessionCounts}</p>
		<p data-testid="session-clamp" style="margin: 0;">{sessionClamp}</p>
		<p data-testid="session-same-outcome" style="margin: 0;">{sameOutcome}</p>
		<p data-testid="session-missing-draft" style="margin: 0;">{missingDraft}</p>
		<p data-testid="session-missing-update" style="margin: 0;">{missingUpdateResult}</p>
		<p data-testid="session-cleared-outcome" style="margin: 0; overflow-wrap: anywhere;">
			{clearedOutcomeKeys}
		</p>
		<p data-testid="session-cleared" style="margin: 0; overflow-wrap: anywhere;">
			{clearedSessionSummary}
		</p>
		<p data-testid="session-submitted" style="margin: 0;">{submitSummary}</p>
		<p data-testid="session-resubmitted" style="margin: 0;">{resubmitSummary}</p>
	</section>

	<section style="display: grid; gap: 0.5rem;">
		<h2 style="margin: 0;">Persistence (sessionStorage)</h2>
		<div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
			<button type="button" data-testid="clear-all-storage" onclick={clearAllStorage}>
				reset storage
			</button>
			<button type="button" data-testid="save-basic" onclick={saveBasicSession}>
				saveSession(basic)
			</button>
			<button type="button" data-testid="load-basic" onclick={loadBasicSession}>
				loadSession(basic)
			</button>
			<button type="button" data-testid="load-submitted" onclick={runSubmittedLoad}>
				loadSession(submitted)
			</button>
			<button type="button" data-testid="load-bad-json" onclick={runBadJsonLoad}>
				loadSession(bad JSON)
			</button>
			<button type="button" data-testid="load-bad-shape" onclick={runBadShapeLoad}>
				loadSession(bad shape)
			</button>
			<button type="button" data-testid="list-sessions" onclick={runListSessions}>
				listPersistedSessions()
			</button>
			<button type="button" data-testid="clear-all-sessions" onclick={runClearAllSessions}>
				clearAllPersistedSessions()
			</button>
		</div>
		<p data-testid="storage-prefix" style="margin: 0;">STORAGE_KEY_PREFIX: {storagePrefix}</p>
		<p data-testid="storage-key" style="margin: 0;">getStorageKey: {basicStorageKey}</p>
		<p data-testid="save-result" style="margin: 0;">saveSession returned: {saveResult}</p>
		<p data-testid="stored-top-level-keys" style="margin: 0; overflow-wrap: anywhere;">
			stored keys: {storedTopLevelKeys}
		</p>
		<p data-testid="stored-anchor-keys" style="margin: 0; overflow-wrap: anywhere;">
			stored anchor keys: {storedAnchorKeys}
		</p>
		<p data-testid="stored-anchor-from-to" style="margin: 0;">{storedAnchorFromTo}</p>
		<p data-testid="loaded-anchor-from-to" style="margin: 0;">{loadedAnchorFromTo}</p>
		<p data-testid="loaded-round-trip" style="margin: 0; overflow-wrap: anywhere;">
			{loadedRoundTrip}
		</p>
		<p data-testid="has-after-load" style="margin: 0;">hasPersistedSession: {hasAfterLoad}</p>
		<p data-testid="load-submitted-result" style="margin: 0;">{loadSubmitted}</p>
		<p data-testid="load-bad-json-result" style="margin: 0;">{loadBadJson}</p>
		<p data-testid="load-bad-shape-result" style="margin: 0;">{loadBadShape}</p>
		<p data-testid="session-list" style="margin: 0;">listPersistedSessions: {sessionList}</p>
		<p data-testid="list-after-clear-all" style="margin: 0;">{listAfterClearAll}</p>
	</section>

	<section style="display: grid; gap: 0.5rem;">
		<h2 style="margin: 0;">Schema validation and schemaVersion</h2>
		<p data-testid="validate-matrix" style="margin: 0; overflow-wrap: anywhere;">
			{validationMatrix}
		</p>
		<p data-testid="versioned-accepted" style="margin: 0; overflow-wrap: anywhere;">
			{versionedAccepted}
		</p>
		<p data-testid="schema-version-matrix" style="margin: 0; overflow-wrap: anywhere;">
			{schemaVersionMatrix}
		</p>
	</section>

	<section style="display: grid; gap: 0.5rem;">
		<h2 style="margin: 0;">SSR safety</h2>
		<p data-testid="ssr-probe" style="margin: 0; overflow-wrap: anywhere;">{ssrProbe}</p>
		<p data-testid="browser-storage-probe" style="margin: 0; overflow-wrap: anywhere;">
			{browserStorageProbe}
		</p>
	</section>
</div>

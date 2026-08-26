<script lang="ts">
	import { MarkdownEditor } from '@lostgradient/editor/markdown-editor';
	import type { EditorMode, ToolbarContext } from '@lostgradient/editor/markdown-editor';
	import type { MilkdownPlugin } from '@milkdown/ctx';
	// Milkdown's documented plugin idiom is `import { $prose } from '@milkdown/kit/utils'`,
	// and that exact line is a compile error in a `.svelte` file and nowhere else:
	// Svelte reserves the `$` prefix for runes and rejects `$`-prefixed imports and
	// identifiers outright. A namespace import sidesteps it, because the restriction
	// is on binding names rather than on property access. Worth spelling out — the
	// failure is a Svelte parse error pointing at an upstream package's public API,
	// which reads like the package is broken.
	import * as milkdownUtilities from '@milkdown/kit/utils';
	// `prosemirror-state` / `prosemirror-view` rather than `@milkdown/kit/prose/*`:
	// both resolve to the SAME hoisted packages (`@milkdown/prose/state` is a bare
	// `export * from 'prosemirror-state'`, and there is one copy of each in
	// `node_modules`), so the plugin instances Milkdown builds and the ones this page
	// builds are the same classes either way. These are the specifiers chatroom
	// declares itself, as `@lostgradient/editor`'s peers, and the ones
	// `review-imperative` already uses.
	import { Plugin, PluginKey, TextSelection } from 'prosemirror-state';
	import { Decoration, DecorationSet } from 'prosemirror-view';
	import { tick } from 'svelte';

	// ROADMAP ME-1: the STANDALONE MarkdownEditor, from
	// `@lostgradient/editor/markdown-editor` — the component ReviewEditor is built
	// on top of, and until now reached only through it. All seven of its imperative
	// methods (`focus`, `getAst`, `getEditor`, `getMarkdown`, `getSelection`,
	// `getView`, `setMarkdown`) are driven here against a `bind:this` handle.
	//
	// Three things this page exists to make observable, none of which the type
	// signatures tell you:
	//
	//  1. `getSelection()` returns PROSEMIRROR POSITIONS ONLY — `{from, to,
	//     isCollapsed}`. Its declared `sourcePosition` field is never populated by
	//     this component. The `doc.textBetween()` offset that ReviewEditor's anchors
	//     carry as `lastKnownOffset` has to be DERIVED here, and both numbers are
	//     rendered side by side so the two coordinate spaces stay distinguishable.
	//  2. `getAst()` throws until a SECOND, independent async path resolves. The
	//     editor's own readiness (`onready`, `data-ready`) comes from the Milkdown
	//     attachment; the mdast pipeline arrives on its own dynamic import, and
	//     nothing sequences the two. So a `getAst()` immediately after `data-ready`
	//     can legitimately throw.
	//  3. The plugin seam is a plain `plugins` PROP — but it is read once, inside
	//     `untrack()`, when the editor attachment is created. Reassigning the array
	//     is inert; only a remount picks up a new one.
	//
	// The import path is the SUBPATH, never the package root. Only the subpath
	// exports carry a `node` condition; `exports['.']` has none, so a root import
	// would hand SvelteKit's SSR the browser build.

	// ---------------------------------------------------------------------------
	// Document + the two coordinate spaces
	// ---------------------------------------------------------------------------

	// Headings and paragraphs only, no lists — the same rule (and the same fixture)
	// `review-imperative` uses. ProseMirror positions inside a list depend on how
	// tightly the markdown parser nests `list_item > paragraph`, and every number
	// below is asserted exactly.
	const HEADING = 'Release Plan';
	const PARAGRAPH_ONE =
		'The first release includes a dashboard, export actions, and inline review.';
	const PARAGRAPH_TWO =
		'Reviewers should verify that the export dialog copy matches the product brief before we ship.';
	const PARAGRAPH_THREE = 'Timeline risk: the migration script is untested.';

	// `###`, not `#`. Each editor renders its document's first heading at the
	// authored level, so a `#` fixture would put an extra `h1` on a page that
	// already has one — an outline of sibling `h1`s nested inside `h2` sections,
	// visible only after hydration because the editor server-renders a skeleton.
	// Safe for the arithmetic: a ProseMirror heading node costs 1 on each side
	// regardless of its level, so content still starts at 1.
	const INITIAL = `### ${HEADING}\n\n${PARAGRAPH_ONE}\n\n${PARAGRAPH_TWO}\n\n${PARAGRAPH_THREE}`;

	// TWO COORDINATE SPACES, worked out here rather than read back from the
	// component, so the assertions are arithmetic claims and not readouts of a
	// number the component computed for itself.
	//
	// ProseMirror positions (each block node costs 1 on each side):
	//   heading  node 0..14    content 1..13
	//   para 1   node 14..90   content 15..89
	//   para 2   node 90..185  content 91..184
	//   para 3   node 185..235 content 186..234    → doc.content.size = 235
	//
	// doc.textBetween() offsets (blocks joined by a single "\n"):
	//   heading 0..12   para 1 13..87   para 2 88..181   para 3 182..230
	//
	// 'dashboard' sits at index 29 of paragraph one, so its ProseMirror range is
	// 15+29=44 .. 44+9=53 and its textBetween offset is 13+29=42. Two different
	// numbers for one selection — which is the whole point, and why the heading
	// alone (1..13 against 0..12) would be a weak demonstration.
	const MARKER = 'dashboard';
	const QUOTE_FROM = 44;
	const QUOTE_TO = 53;
	const HEADING_FROM = 1;
	const HEADING_TO = 13;

	const MAIN_ID = 'markdown-editor-main';
	const READONLY_ID = 'markdown-editor-readonly';

	// A document with a different shape AND a different heading level, so the AST
	// assertions after `setMarkdown` cannot be satisfied by the initial document.
	const REPLACEMENT = '# Replaced Plan\n\nOnly one paragraph now.';

	// A different heading text from the main editor's on purpose: both editors slug
	// their document's first heading into an `id`, and two `id="release-plan"` nodes
	// on one page make in-document anchors resolve to whichever came first.
	const READONLY_INITIAL = `### Published Reference\n\n${PARAGRAPH_TWO}`;

	// ---------------------------------------------------------------------------
	// The plugin seam
	// ---------------------------------------------------------------------------

	// `plugins?: MilkdownPlugin[]` is the entire seam — not a context, not a Ctx
	// callback. The array is applied LAST, after commonmark, gfm, the link input
	// rule, clipboard, history, the keymap, the listener, and the placeholder
	// plugin, via `builder.use(plugins)`.
	//
	// The probe decorates every occurrence of a marker word rather than a fixed
	// range, so it demonstrates that the plugin sees the LIVE document (it survives
	// edits and re-runs on every state) instead of a range that happens to be right
	// once. `decorations` is a prop rather than plugin state deliberately: it is
	// recomputed from `state.doc` on every render, so there is no mapping code of
	// our own that could mask a plugin that never loaded.
	const PROBE_A = 'me-probe-a';
	const PROBE_B = 'me-probe-b';

	function probeDecorationPlugin(className: string): MilkdownPlugin {
		return milkdownUtilities.$prose(
			() =>
				new Plugin({
					key: new PluginKey(`markdown-editor-probe-${className}`),
					props: {
						decorations(state) {
							const decorations: Decoration[] = [];
							state.doc.descendants((node, position) => {
								const text = node.isText ? node.text : undefined;
								if (!text) return;
								// `position` is the position BEFORE a text node, and text
								// offsets add to it directly — the one place in ProseMirror
								// where a character index and a document position line up.
								let index = text.indexOf(MARKER);
								while (index !== -1) {
									decorations.push(
										Decoration.inline(position + index, position + index + MARKER.length, {
											class: className
										})
									);
									index = text.indexOf(MARKER, index + MARKER.length);
								}
							});
							return DecorationSet.create(state.doc, decorations);
						}
					}
				})
		);
	}

	// `$state.raw`, not `$state`. A deep `$state` array hands Milkdown a Proxy of
	// itself, and this array is only ever REPLACED, never mutated — so the deep
	// proxy would buy nothing while putting a reactivity wrapper between the
	// plugin objects and the library that consumes them.
	let activePlugins = $state.raw<MilkdownPlugin[]>([probeDecorationPlugin(PROBE_A)]);

	// Bumping this re-keys the editor, which is the ONLY thing that makes a new
	// `plugins` array take effect through this page's controls. (A wysiwyg → source
	// → wysiwyg round trip is a second remount path, since the `{#if mode ===
	// 'wysiwyg'}` branch tears the host element down and the attachment re-reads its
	// getters on the way back — so `{#key}` is the explicit path, not the only one.)
	let remountToken = $state(0);

	// How many times the editor has reported itself ready. It stays at 1 through a
	// plugin swap and goes to 2 on a remount, which is the second, independent
	// observable for "was this editor re-created" — the first being whether the old
	// decoration is still in the DOM.
	let readyCount = $state(0);

	// ---------------------------------------------------------------------------
	// State
	// ---------------------------------------------------------------------------

	let value = $state(INITIAL);
	let mode = $state<EditorMode>('wysiwyg');
	let readonlyValue = $state(READONLY_INITIAL);

	let handle = $state<ReturnType<typeof MarkdownEditor>>();

	let lastCall = $state('(none)');

	// Every `onselectionchange` notification, in order. This is a DIFFERENT surface
	// from `getSelection()` and the difference is the point — see the readouts
	// section below.
	let selectionEvents = $state<string[]>([]);
	let modeEvents = $state<string[]>([]);
	let changeEvents = $state(0);

	// ---------------------------------------------------------------------------
	// Announcements
	// ---------------------------------------------------------------------------

	// Every control on this page reports a value that is otherwise only visible as
	// text somewhere further down the page, so an action taken without sight needs
	// an outcome. Two rules carried over from `review-imperative`, both of which
	// were learned there the hard way:
	//
	//  1. Nothing is INFERRED. Each summary is derived from something observed
	//     after the call — the actual `document.activeElement`, the actual markdown,
	//     the actual thrown error — never from "the method returned, so it worked".
	//  2. Identical text still re-announces. `aria-live` fires on CHANGE, so
	//     pressing the same button twice would otherwise be silent from the second
	//     press onward, on a page where re-pressing to check is the obvious move.
	let announcement = $state('');
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
		// assigned the string it already holds. Counting real DOM mutations
		// (`announceMutations`) is what makes deleting this observable — a log of
		// what we asked to say would record an entry either way.
		queueMicrotask(() => {
			announcement = text;
		});
	}

	function record(name: string, summary: string) {
		lastCall = name;
		announce(`${name}: ${summary}`);
	}

	/** Announcements are read aloud, so a count that says "1 characters" is a defect. */
	function plural(count: number, word: string): string {
		return `${count} ${word}${count === 1 ? '' : 's'}`;
	}

	// ---------------------------------------------------------------------------
	// Readouts
	// ---------------------------------------------------------------------------

	let markdownJson = $state('null');
	let astJson = $state('null');
	let astError = $state('');
	let selectionJson = $state('null');
	let viewJson = $state('null');
	let editorJson = $state('null');
	let focusJson = $state('null');
	let readonlyToolbarContextText = $state('(not reported)');

	// Derived rather than inlined into the markup, so each readout fits on one
	// line and its `<p>` holds nothing but the payload. A wrapped expression puts
	// indentation whitespace inside the element, which `JSON.parse` tolerates and
	// a `.split('|')` on the raw text does not.
	const valueJson = $derived(JSON.stringify(value));
	const selectionEventsText = $derived(selectionEvents.join('|'));

	type MdastLike = { type: string; depth?: number; value?: string; children?: MdastLike[] };

	function flattenText(node: MdastLike): string {
		if (typeof node.value === 'string') return node.value;
		return (node.children ?? []).map(flattenText).join('');
	}

	function describeToolbarContext(context: ToolbarContext): string {
		return [
			`ctx=${context.editorContext === null ? 'no' : 'yes'}`,
			`undo=${context.canUndo}`,
			`redo=${context.canRedo}`,
			`ro=${context.readonly}`
		].join(' ');
	}

	// ---------------------------------------------------------------------------
	// The seven methods
	// ---------------------------------------------------------------------------

	function readMarkdown() {
		const markdown = handle?.getMarkdown() ?? '';
		markdownJson = JSON.stringify(markdown);
		record('getMarkdown', plural(markdown.length, 'character'));
	}

	function applySetMarkdown(content: string) {
		handle?.setMarkdown(content);
		// Observed, not assumed. `setMarkdown` has two branches — it drives the live
		// editor when one exists and falls back to assigning `value` when it does not
		// — and neither returns anything, so reading the document back is the only
		// honest way to say what happened.
		const after = handle?.getMarkdown() ?? '';
		markdownJson = JSON.stringify(after);
		record(
			'setMarkdown',
			after.trim() === content.trim()
				? 'the document now matches what was set'
				: 'the document does not match what was set'
		);
	}

	function readAst() {
		try {
			const root = handle?.getAst();
			const children = ((root?.children ?? []) as unknown as MdastLike[]).map((child) => ({
				type: child.type,
				depth: child.depth ?? null,
				text: flattenText(child)
			}));
			astError = '';
			astJson = JSON.stringify({ type: root?.type ?? null, children });
			record('getAst', plural(children.length, 'top-level node'));
		} catch (error) {
			// The readiness trap. `getAst()` calls into the markdown pipeline, which
			// arrives on its own dynamic import with no readiness signal of its own —
			// `onready` and `data-ready` come from the Milkdown attachment and say
			// nothing about it. Surfacing the error rather than swallowing it is what
			// lets a test poll for the second path to land.
			astJson = 'null';
			astError = error instanceof Error ? error.message : String(error);
			record('getAst', `threw: ${astError}`);
		}
	}

	function readSelection() {
		const selection = handle?.getSelection() ?? null;
		const view = handle?.getView() ?? null;
		if (!selection || !view) {
			selectionJson = JSON.stringify({ selection: null, derived: null });
			record('getSelection', 'there is no selection to report');
			return;
		}

		// THE SECOND COORDINATE SPACE, derived here because `getSelection()` does not
		// return one. `from`/`to` are ProseMirror positions; `offset` and `length`
		// are `doc.textBetween()` offsets, which count characters and ignore node
		// boundaries. For the same selection they are different numbers, and mixing
		// them up is the trap `CLAUDE.md` documents for anchors.
		const offset = view.state.doc.textBetween(0, selection.from, '\n').length;
		const quote = view.state.doc.textBetween(selection.from, selection.to, '\n');

		selectionJson = JSON.stringify({
			selection: { from: selection.from, to: selection.to, isCollapsed: selection.isCollapsed },
			// Declared on `EditorSelection` as "mapped to mdast position via bridge
			// (when available)" and never populated by this component — the bridge
			// that computes it is not on any path MarkdownEditor takes. Rendered so a
			// test can pin that rather than leaving a consumer to discover it.
			sourcePosition: selection.sourcePosition ?? null,
			derived: { offset, length: quote.length, quote }
		});
		record(
			'getSelection',
			selection.isCollapsed
				? `a collapsed caret at ProseMirror position ${selection.from}`
				: `ProseMirror ${selection.from} to ${selection.to}, text offset ${offset}`
		);
	}

	function readView() {
		const view = handle?.getView() ?? null;
		const host = document.getElementById(MAIN_ID);
		viewJson = JSON.stringify({
			present: view !== null,
			docSize: view?.state.doc.content.size ?? null,
			// `getView()` hands back the ProseMirror EditorView, whose `dom` is the
			// contenteditable INSIDE the `role="application"` host, not the host
			// itself. Worth pinning: the host carries `tabindex="0"` and looks like
			// the editing surface.
			domIsProseMirror: view?.dom.classList.contains('ProseMirror') ?? null,
			domIsHost: view !== null && host !== null && view.dom === host,
			domInsideHost: view !== null && host !== null && host.contains(view.dom),
			editable: view?.editable ?? null
		});
		record(
			'getView',
			view === null ? 'no view is mounted' : `document size ${view.state.doc.content.size}`
		);
	}

	function readEditor() {
		const editor = handle?.getEditor() ?? null;
		// Proving the handle is a live Milkdown Editor rather than a stub, without
		// importing anything from `@milkdown/kit/core`: `action` runs a callback
		// against the editor's own Ctx synchronously and returns its result, so a
		// working editor is one where the ctx handed to the callback IS `editor.ctx`.
		const probe = editor ? editor.action((ctx) => ({ ctx, result: 'ran' })) : null;
		editorJson = JSON.stringify({
			present: editor !== null,
			actionResult: probe?.result ?? null,
			actionCtxIsEditorCtx: probe !== null && editor !== null && probe.ctx === editor.ctx
		});
		record('getEditor', editor === null ? 'no editor is mounted' : 'the editor handle answered');
	}

	function readFocus() {
		const active = document.activeElement;
		const host = document.getElementById(MAIN_ID);
		focusJson = JSON.stringify({
			tag: active?.tagName ?? null,
			isProseMirror: active instanceof HTMLElement && active.classList.contains('ProseMirror'),
			isHost: active !== null && active === host,
			insideMainEditor: host !== null && active !== null && host.contains(active)
		});
	}

	function focusEditor() {
		handle?.focus();
		readFocus();
		const landed = JSON.parse(focusJson).insideMainEditor === true;
		// This is the ONE control on the page that moves focus deliberately —
		// it is the method under test. Every other control that touches the editor
		// leaves focus alone (see `select` below), because a button that silently
		// relocates focus into a rich-text surface is the defect `review-imperative`
		// found the hard way. Announcing the move is what keeps this one honest.
		record(
			'focus',
			landed ? 'focus moved into the editing surface' : 'focus did not reach the editor'
		);
	}

	// ---------------------------------------------------------------------------
	// Driving a selection
	// ---------------------------------------------------------------------------

	/**
	 * Put an exact selection in the view through the public `getView()`.
	 *
	 * Deliberately does NOT call `view.focus()`. ProseMirror applies a transaction
	 * to an unfocused view perfectly well, `getSelection()` reads `view.state`
	 * whatever the focus is, and Milkdown's listener fires from `state.apply` — so
	 * focusing would buy nothing and would cost a keyboard user twenty-odd tab
	 * stops per press.
	 *
	 * ONE selection-changing dispatch, which is the thing that used to be
	 * insufficient: before `@lostgradient/editor@0.9.1` the selection listener
	 * re-read `view.state` from inside `EditorState.apply`, where it is still the
	 * PREVIOUS state, so every notification lagged by exactly one transaction. The
	 * fix hands the listener Milkdown's live `tr.selection` instead.
	 */
	async function select(from: number, to: number) {
		const view = handle?.getView();
		if (!view) return;
		view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to)));
		await tick();
		readSelection();
	}

	async function swapPlugins() {
		activePlugins = [probeDecorationPlugin(PROBE_B)];
		await tick();
		// Observed rather than asserted from the contract: count what is actually in
		// the DOM after the reassignment settles.
		const host = document.getElementById(MAIN_ID);
		const stale = host?.querySelectorAll(`.${PROBE_A}`).length ?? 0;
		const fresh = host?.querySelectorAll(`.${PROBE_B}`).length ?? 0;
		record(
			'plugins reassigned',
			`the mounted editor still shows ${plural(stale, 'decoration')} from the original plugin and ${plural(fresh, 'decoration')} from the new one`
		);
	}

	function remountEditor() {
		remountToken += 1;
		// Phrased as a request rather than a result on purpose. The new editor boots
		// asynchronously, so anything this function could measure now would describe
		// the OLD one; `ready-count` is where the outcome shows up when it lands.
		record('remount', `remount ${remountToken} requested; a new editor re-reads the plugins prop`);
	}
</script>

<div style="max-width: 60rem; margin: 0 auto; padding: 2rem 1rem; display: grid; gap: 1.5rem;">
	<header>
		<h1>Markdown Editor</h1>
		<p>
			Drives all seven imperative methods on the standalone <code>MarkdownEditor</code> through
			<code>bind:this</code>, alongside the <code>plugins</code> seam ReviewEditor is built on.
		</p>
	</header>

	<section aria-labelledby="controls-heading">
		<h2 id="controls-heading">Imperative surface</h2>
		<div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.75rem;">
			<button data-testid="focus-editor" onclick={focusEditor}>focus</button>
			<button data-testid="read-markdown" onclick={readMarkdown}>getMarkdown</button>
			<button data-testid="set-markdown" onclick={() => applySetMarkdown(REPLACEMENT)}>
				setMarkdown
			</button>
			<button data-testid="read-ast" onclick={readAst}>getAst</button>
			<button data-testid="read-selection" onclick={readSelection}>getSelection</button>
			<button data-testid="read-view" onclick={readView}>getView</button>
			<button data-testid="read-editor" onclick={readEditor}>getEditor</button>
			<button data-testid="select-quote" onclick={() => select(QUOTE_FROM, QUOTE_TO)}>
				select "{MARKER}"
			</button>
			<button data-testid="select-heading" onclick={() => select(HEADING_FROM, HEADING_TO)}>
				select the heading
			</button>
			<button data-testid="collapse-caret" onclick={() => select(QUOTE_FROM, QUOTE_FROM)}>
				collapse the caret
			</button>
			<button data-testid="clear-selection-events" onclick={() => (selectionEvents = [])}>
				clear selection events
			</button>
		</div>
	</section>

	<section aria-labelledby="plugins-heading">
		<h2 id="plugins-heading">Plugin seam</h2>
		<div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.75rem;">
			<button data-testid="swap-plugins" onclick={swapPlugins}>reassign plugins</button>
			<button data-testid="remount-editor" onclick={remountEditor}>remount the editor</button>
		</div>
	</section>

	<section aria-labelledby="mode-heading">
		<h2 id="mode-heading">Mode</h2>
		<div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.75rem;">
			<button data-testid="mode-source" onclick={() => (mode = 'source')}>bind mode: source</button>
			<button data-testid="mode-wysiwyg" onclick={() => (mode = 'wysiwyg')}>
				bind mode: wysiwyg
			</button>
		</div>
	</section>

	<section aria-labelledby="editor-heading">
		<h2 id="editor-heading">Editable</h2>
		{#key remountToken}
			<MarkdownEditor
				bind:this={handle}
				data-testid="main-editor"
				id={MAIN_ID}
				label="Release plan draft"
				bind:value
				bind:mode
				showModeToggle
				plugins={activePlugins}
				onready={() => {
					readyCount += 1;
				}}
				onchange={() => {
					changeEvents += 1;
				}}
				onmodechange={(next) => {
					modeEvents = [...modeEvents, next];
				}}
				onselectionchange={(selection) => {
					// The notification surface, kept separate from `getSelection()` on
					// purpose: `getSelection()` reads `view.state` at CALL time and was
					// always correct, while this callback fires from inside
					// `EditorState.apply` and was one transaction behind until
					// `@lostgradient/editor@0.9.1`. Recording every notification is what
					// makes that difference measurable rather than folklore.
					selectionEvents = [
						...selectionEvents,
						selection ? `${selection.from}:${selection.to}:${selection.isCollapsed}` : 'null'
					];
				}}
			>
				{#snippet toolbarActions(context)}
					<span data-testid="toolbar-context" style="font-size: 0.7rem; white-space: nowrap;">
						{describeToolbarContext(context)}
					</span>
				{/snippet}
			</MarkdownEditor>
		{/key}
	</section>

	<section aria-labelledby="readonly-heading">
		<h2 id="readonly-heading">Readonly</h2>
		<MarkdownEditor
			data-testid="readonly-editor"
			id={READONLY_ID}
			label="Published release plan"
			readonly
			bind:value={readonlyValue}
			ontoolbarcontextchange={(context) => {
				// `readonly` suppresses the toolbar entirely, so this callback is the
				// only way a consumer hosting its own formatting controls can learn the
				// editor's state. Recording it pins that the context still flows.
				readonlyToolbarContextText = describeToolbarContext(context);
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

	<section
		aria-labelledby="readouts-heading"
		style="font-family: ui-monospace, monospace; font-size: 0.8rem; display: grid; gap: 0.25rem;"
	>
		<h2 id="readouts-heading" style="font-family: inherit;">Readouts</h2>
		<p data-testid="last-call" style="margin: 0;">last call: {lastCall}</p>
		<p data-testid="ready-count" style="margin: 0;">{readyCount}</p>
		<p data-testid="mode-readout" style="margin: 0;">{mode}</p>
		<p data-testid="markdown-json" style="margin: 0; word-break: break-all;">{markdownJson}</p>
		<p data-testid="value-json" style="margin: 0; word-break: break-all;">{valueJson}</p>
		<p data-testid="ast-json" style="margin: 0; word-break: break-all;">{astJson}</p>
		<p data-testid="ast-error" style="margin: 0; word-break: break-all;">{astError}</p>
		<p data-testid="selection-json" style="margin: 0; word-break: break-all;">{selectionJson}</p>
		<p data-testid="view-json" style="margin: 0; word-break: break-all;">{viewJson}</p>
		<p data-testid="editor-json" style="margin: 0; word-break: break-all;">{editorJson}</p>
		<p data-testid="focus-json" style="margin: 0; word-break: break-all;">{focusJson}</p>
		<p data-testid="selection-events" style="margin: 0;">{selectionEventsText}</p>
		<p data-testid="mode-events" style="margin: 0;">{modeEvents.join('|')}</p>
		<p data-testid="change-count" style="margin: 0;">{changeEvents}</p>
		<p data-testid="ro-toolbar-context" style="margin: 0;">{readonlyToolbarContextText}</p>
		<p data-testid="announce-mutations" style="margin: 0;">{announceMutations}</p>
	</section>
</div>

<script lang="ts" module>
  /**
   * @cinder
   * @category domain
   * @status domain-suite
   * @purpose Rich Markdown editing surface bundling a Milkdown-powered ProseMirror editor, toolbar, and mark or block introspection helpers.
   * @tag markdown
   * @tag editor
   * @tag domain-suite
   * @useWhen Composing or editing Markdown documents and wanting the bundled toolbar, link-aware selection, and source or WYSIWYG mode toggle.
   * @useWhen Building writing surfaces that need an editor handle for programmatic mark or block manipulation as part of the heavyweight suite.
   * @avoidWhen Authoring a simple plain-text note — a textarea is dramatically lighter than the Milkdown bundle.
   * @avoidWhen The surface needs inline review threads on top of the editor — use review-editor for that composition.
   * @related review-editor, code-block
   */
  export type {
    EditorHandle,
    EditorMode,
    MarkdownEditorProps,
    ToolbarContext,
  } from './markdown-editor.types.ts';
</script>

<script lang="ts">
  import { BROWSER as browser } from 'esm-env';
  import { onDestroy } from 'svelte';
  import { devWarn } from '../../utilities/dev-warn.ts';
  import type { Ctx } from '@milkdown/kit/ctx';
  import type {
    ActiveBlockType,
    ActiveMarks,
    EditorSelection,
  } from '../../editor/component-runtime.ts';

  import './prosemirror.css';
  import { classNames } from '../../utilities/class-names.ts';
  import {
    createEditorAttachment,
    setEditorReadonly,
    type EditorState,
    // ActiveMarks and ActiveBlockType are imported in module script
    getActiveMarks,
    getActiveBlockType,
    getLinkAtCursor,
    getLinkTextAtCursor,
    isSelectionCollapsed,
    insertLinkAtCursor,
    applyLinkToSelection,
    updateLinkAtCursor,
    removeLink,
    getLinkRangeAtCursor,
    undo as undoCommand,
    redo as redoCommand,
    DEFAULT_DEBOUNCE_MS,
  } from '../../editor/component-runtime.ts';
  import Segment from '@lostgradient/cinder/segment';
  import SegmentedControl from '@lostgradient/cinder/segmented-control';
  import { FileCode, Pencil } from '@lostgradient/cinder/icons';
  import EditorSkeleton from './editor-skeleton.svelte';
  import { EditorToolbar, LinkPopover } from './editor-toolbar/index.ts';
  import type { LinkPopoverMode } from './editor-toolbar/link-popover.svelte';
  import type { EditorMode, MarkdownEditorProps, ToolbarContext } from './markdown-editor.types.ts';

  type HistoryUtilities = Pick<
    typeof import('@milkdown/kit/prose/history'),
    'undoDepth' | 'redoDepth'
  >;

  type MarkdownPipelineUtilities = Pick<
    typeof import('@lostgradient/markdown/pipeline'),
    'normalize' | 'parseOrThrow'
  >;

  let {
    id,
    label = 'Markdown editor',
    value = $bindable(''),
    mode = $bindable<EditorMode>('wysiwyg'),
    showModeToggle = false,
    modeLabel = 'Editor mode',
    readonly = false,
    placeholder = 'Start writing...',
    showToolbar = true,
    ontoolbarcontextchange,
    class: className,
    onchange,
    onready,
    onmodechange,
    onselectionchange,
    oncommentshortcut,
    plugins = [],
    placeholderCompletion,
    placeholderDecoration,
    toolbar,
    toolbarActions,
    toolbarLeading,
    snapshotMode = false,
    'aria-describedby': ariaDescribedby,
    ...rest
  }: MarkdownEditorProps = $props();

  // Blur any focused element inside this component on mount when snapshotMode
  // is active. This prevents the initial screenshot from capturing a focused
  // ring or blinking caret at an arbitrary position. We target the wrapper
  // element via a reactive reference set during rendering.
  let wrapperElement = $state<HTMLDivElement | null>(null);

  $effect(() => {
    if (!snapshotMode) return;
    if (!wrapperElement) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && wrapperElement.contains(active)) {
      active.blur();
    }
  });

  // Escape single quotes in placeholder for CSS content property
  const escapedPlaceholder = $derived(placeholder.replace(/'/g, "\\'"));
  /**
   * cinder#1306's actual bug was never about this property's presence — it
   * was that `is-editor-empty` (`.markdown-editor :global(.ProseMirror
   * p.is-editor-empty:first-child::before)` below) never reached the DOM at
   * all, because `createLazyProsePlugin` raced `EditorState.create()`'s
   * one-time plugin snapshot (fixed in milkdown-plugin-runtime.ts). The
   * `::before` rule only ever paints when that class is present, so writing
   * `--editor-placeholder` unconditionally was always cosmetically inert on
   * a populated document, never visibly wrong.
   *
   * An earlier version of this fix ALSO gated this property on
   * `value.trim().length === 0`, reasoning that a populated document
   * shouldn't carry a dead custom property. That gate was itself a
   * regression, caught in review: `value` is this component's own
   * `$bindable` state, kept in sync with the live document through
   * `onchange`'s debounced callback (`changeDebounceMs`, stacked on top of
   * `@milkdown/plugin-listener`'s own ~200ms internal debounce) — so for a
   * few hundred ms after a user deletes the last character, `is-editor-empty`
   * is already present (ProseMirror's own decoration recompute is
   * synchronous, not debounced) while `value` still reports the old,
   * non-empty content. Gated on `value`, `--editor-placeholder` was
   * genuinely ABSENT during that window, and the CSS's own fallback
   * (`var(--editor-placeholder, 'Start writing...')`, below) painted the
   * generic string instead of the consumer's real placeholder — a visible
   * wrong-text flash on every deletion-to-empty, on every document. Visibly
   * wrong beats cosmetically inert; the gate is gone.
   */
  const placeholderStyleValue = $derived(`'${escapedPlaceholder}'`);
  const accessibleEditorLabel = $derived(
    label.trim().length > 0 ? label.trim() : 'Markdown editor',
  );

  // Internal state
  let editorState = $state<EditorState | null>(null);
  let isInitializing = $state(true);
  let pipelineUtilities = $state<MarkdownPipelineUtilities | null>(null);

  // Guard to prevent effect loops on two-way binding
  let isInternalUpdate = false;

  /**
   * Normalize Markdown to the DEP-35 canonical form.
   *
   * We fail open (return the original string) to avoid losing user input if
   * normalization ever throws for unexpected content.
   */
  function normalizeSafely(markdown: string): string {
    try {
      return pipelineUtilities?.normalize(markdown) ?? normalizeForEditor(markdown);
    } catch (error) {
      devWarn('Failed to normalize markdown, using raw value:', error);
      return markdown;
    }
  }

  function normalizeForEditor(markdown: string): string {
    if (!markdown.trim()) return '\n';

    return markdown
      .replace(/\r\n?/g, '\n')
      .replace(/^(\s*)[*+] /gm, '$1- ')
      .replace(/^([-*+] .*)$\n\n(?=[-*+] )/gm, '$1\n')
      .replace(/^(\d+\. .*)$\n\n(?=\d+\. )/gm, '$1\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^\n+/, '')
      .replace(/\n+$/, '\n');
  }

  // Toolbar state: track a version counter that increments on selection change
  // This forces re-derivation of active marks/block type
  let selectionVersion = $state(0);
  let historyUtilities = $state<HistoryUtilities | null>(null);

  $effect(() => {
    if (!browser) return;

    let cancelled = false;
    // Milkdown/ProseMirror runtime graph is browser-bound; keep this import inside the browser-only effect.
    void import('@milkdown/kit/prose/history').then((module) => {
      if (!cancelled) {
        historyUtilities = {
          undoDepth: module.undoDepth,
          redoDepth: module.redoDepth,
        };
      }
    });

    return () => {
      cancelled = true;
    };
  });

  $effect(() => {
    if (!browser) return;

    let cancelled = false;
    // cinder/markdown/pipeline is SSR-safe (pure remark/unified), but kept dynamic for code-splitting:
    // the parser/serializer should not load before the user actually interacts with the editor.
    void import('@lostgradient/markdown/pipeline').then((module) => {
      if (!cancelled) {
        pipelineUtilities = {
          normalize: module.normalize,
          parseOrThrow: module.parseOrThrow,
        };
      }
    });

    return () => {
      cancelled = true;
    };
  });

  // Derive editor context for toolbar (SSR safe - null until editor ready)
  const editorContext = $derived<Ctx | null>(editorState?.editor?.ctx ?? null);

  // Derive active marks (updates when selectionVersion changes)
  const activeMarks = $derived.by((): ActiveMarks => {
    // Force dependency on selectionVersion
    void selectionVersion;

    if (!editorContext) {
      return { bold: false, italic: false, code: false, strikethrough: false, link: false };
    }
    return getActiveMarks(editorContext);
  });

  // Derive active block type (updates when selectionVersion changes)
  const activeBlockType = $derived.by((): ActiveBlockType => {
    // Force dependency on selectionVersion
    void selectionVersion;

    if (!editorContext) {
      return { type: 'paragraph' };
    }
    return getActiveBlockType(editorContext);
  });

  // Derive undo/redo availability from ProseMirror history
  const canUndo = $derived.by(() => {
    void value;
    const view = editorState?.view;
    if (!view || historyUtilities === null) return false;
    return historyUtilities.undoDepth(view.state) > 0;
  });

  const canRedo = $derived.by(() => {
    void value;
    const view = editorState?.view;
    if (!view || historyUtilities === null) return false;
    return historyUtilities.redoDepth(view.state) > 0;
  });

  // Should toolbar be visible?
  // Show toolbar in wysiwyg mode, or always when mode toggle is enabled (so users can switch modes)
  const toolbarVisible = $derived(
    showToolbar && !readonly && browser && (mode === 'wysiwyg' || showModeToggle),
  );

  // Link popover state
  let linkPopoverOpen = $state(false);
  let linkPopoverAnchorElement = $state<
    HTMLElement | import('@floating-ui/dom').VirtualElement | null
  >(null);

  // Toolbar context for snippets. Declared after the link-popover state it
  // reads; the handlers below are function declarations, so they hoist.
  const toolbarContext: ToolbarContext = $derived({
    editorContext,
    activeMarks,
    activeBlockType,
    canUndo,
    canRedo,
    readonly,
    onUndo: handleUndo,
    onRedo: handleRedo,
    onLinkClick: handleLinkClick,
    linkPopoverOpen,
  });

  // Publish the context so a parent can host the formatting controls itself.
  $effect(() => {
    ontoolbarcontextchange?.(toolbarContext);
  });

  // Derive link popover props based on current selection
  const linkPopoverMode = $derived.by((): LinkPopoverMode => {
    // Force dependency on selectionVersion for reactivity
    void selectionVersion;

    if (!editorContext) return 'insert';
    const existingUrl = getLinkAtCursor(editorContext);
    return existingUrl ? 'edit' : 'insert';
  });

  const linkPopoverInitialUrl = $derived.by(() => {
    // Force dependency on selectionVersion for reactivity
    void selectionVersion;

    if (!editorContext) return '';
    return getLinkAtCursor(editorContext) ?? '';
  });

  const linkPopoverHasSelection = $derived.by(() => {
    // Force dependency on selectionVersion for reactivity
    void selectionVersion;

    if (!editorContext) return false;
    return !isSelectionCollapsed(editorContext);
  });

  const linkPopoverInitialText = $derived.by(() => {
    // Force dependency on selectionVersion for reactivity
    void selectionVersion;

    if (!editorContext) return '';
    // If there's a selection, the text input is hidden (selected text becomes link text)
    if (!isSelectionCollapsed(editorContext)) return '';
    // When cursor is inside a link, get the full link text for editing
    return getLinkTextAtCursor(editorContext) ?? '';
  });

  // Captured link range for removal - updated on every selection change while cursor is inside a link.
  // This ensures we have the link range available even after the popover steals focus.
  const lastKnownLinkRange = $derived.by((): [number, number] | null => {
    // Force dependency on selectionVersion for reactivity
    void selectionVersion;

    if (!editorContext) return null;
    // Only capture range when cursor is inside a link
    const url = getLinkAtCursor(editorContext);
    if (!url) return null;
    return getLinkRangeAtCursor(editorContext);
  });

  // Store the link range when popover opens (captured from the last known value)
  let capturedLinkRange = $state<[number, number] | null>(null);

  /**
   * Resolve the best available anchor for the link popover when opened via keyboard shortcut.
   * Priority:
   * 1. Floating UI VirtualElement built from ProseMirror coordsAtPos (WYSIWYG mode)
   * 2. editor view.dom bounding rect fallback
   * 3. source textarea bounding rect fallback
   * 4. markdown-editor wrapper bounding rect fallback
   */
  function resolveLinkPopoverAnchor():
    | import('@floating-ui/dom').VirtualElement
    | HTMLElement
    | null {
    if (editorState?.view) {
      try {
        const view = editorState.view;
        const from = view.state.selection.from;
        // Probe once up front so an unusable position falls through to the
        // view.dom fallback below.
        const probe = view.coordsAtPos(from);
        if (probe && probe.top > 0) {
          // Recompute coords live inside getBoundingClientRect so Floating UI's
          // autoUpdate tracks the selection through scroll/layout changes rather
          // than freezing the open-time rectangle. contextElement lets Floating
          // UI resolve the correct scroll ancestors. Only needs a rect-shaped
          // object — no DOMRect instance or toJSON.
          return {
            ...(view.dom instanceof HTMLElement ? { contextElement: view.dom } : {}),
            getBoundingClientRect: () => {
              // autoUpdate calls this on every scroll/resize. coordsAtPos can
              // throw if the position is no longer resolvable after a state
              // change — fall back to the editor's own rect so Floating UI keeps
              // a valid anchor instead of rejecting the position update.
              try {
                const coords = view.coordsAtPos(view.state.selection.from);
                return {
                  x: coords.left,
                  y: coords.top,
                  width: coords.right - coords.left,
                  height: coords.bottom - coords.top,
                  top: coords.top,
                  right: coords.right,
                  bottom: coords.bottom,
                  left: coords.left,
                };
              } catch {
                return view.dom.getBoundingClientRect();
              }
            },
          };
        }
      } catch {
        // Fall through to view.dom fallback
      }
      const viewDom = editorState.view.dom;
      if (viewDom instanceof HTMLElement) return viewDom;
    }

    if (wrapperElement) return wrapperElement;
    return null;
  }

  function handleLinkClick(triggerElement: HTMLElement) {
    // Use the last known link range (updated reactively before focus changes)
    capturedLinkRange = lastKnownLinkRange;
    // The formatting overflow closes as this callback runs, which detaches its
    // Link button. Preserve that button's open-time rectangle as a Floating UI
    // virtual anchor so the link popover remains aligned with its trigger.
    const triggerRectangle = triggerElement.getBoundingClientRect();
    linkPopoverAnchorElement = {
      getBoundingClientRect: () => triggerRectangle,
    };
    linkPopoverOpen = true;
  }

  function handleLinkPopoverClose() {
    linkPopoverOpen = false;
    linkPopoverAnchorElement = null;
    // Refocus the editor after closing
    editorState?.focus();
  }

  function handleLinkInsert(url: string, text: string | undefined = undefined) {
    if (!editorContext) return;

    if (text) {
      // Check if we're editing an existing link (cursor inside link)
      const existingLinkUrl = getLinkAtCursor(editorContext);
      if (existingLinkUrl) {
        // Update the existing link instead of inserting a new one
        updateLinkAtCursor(editorContext, text, url);
      } else {
        // Insert new link with text (no selection case)
        insertLinkAtCursor(editorContext, text, url);
      }
    } else {
      // Apply link to selection
      applyLinkToSelection(editorContext, url);
    }

    linkPopoverOpen = false;
    linkPopoverAnchorElement = null;
    editorState?.focus();
  }

  function handleLinkRemove() {
    if (!editorContext) return;
    // Use the captured link range (from when popover opened) - editor selection may have changed
    removeLink(editorContext, capturedLinkRange ?? undefined);
    linkPopoverOpen = false;
    capturedLinkRange = null;
    linkPopoverAnchorElement = null;
    editorState?.focus();
  }

  function handleUndo(): void {
    if (!editorContext || !canUndo) return;
    undoCommand(editorContext);
  }

  function handleRedo(): void {
    if (!editorContext || !canRedo) return;
    redoCommand(editorContext);
  }

  // Create the editor attachment
  const editorAttachment = createEditorAttachment({
    // Initialize Milkdown with canonical markdown for consistent parsing/serialization (DEP-35).
    getInitialValue: () => normalizeSafely(value),
    getReadonly: () => readonly,
    getAriaLabel: () => accessibleEditorLabel,
    debounceMs: DEFAULT_DEBOUNCE_MS,
    getPlugins: () => plugins,
    getPlaceholderCompletion: () => placeholderCompletion,
    getPlaceholderDecoration: () => placeholderDecoration,
    onready: (state) => {
      editorState = state;
      isInitializing = false;
      onready?.();
    },
    onchange: (markdown) => {
      isInternalUpdate = true;
      value = markdown;
      onchange?.(markdown);
      // Increment version to trigger toolbar state re-derivation
      // (block type may have changed even if selection didn't move)
      selectionVersion++;
      // Reset flag after microtask
      queueMicrotask(() => {
        isInternalUpdate = false;
      });
    },
    onselectionchange: (selection) => {
      // Increment version to trigger toolbar state re-derivation
      selectionVersion++;
      onselectionchange?.(selection);
    },
    onlinkshortcut: () => {
      // Mod-k pressed - open link popover with a virtual element anchor
      // derived from the current ProseMirror selection position. Capture the
      // current link range (as handleLinkClick does) so a subsequent Remove
      // acts on the right link rather than a stale/null range.
      capturedLinkRange = lastKnownLinkRange;
      linkPopoverAnchorElement = resolveLinkPopoverAnchor();
      linkPopoverOpen = true;
    },
    // DEP-47: Comment shortcut (Ctrl-Alt-c)
    oncommentshortcut: () => oncommentshortcut?.(),
  });

  // Track mode transitions to normalize content on switch (DEP-45).
  let previousMode: EditorMode = mode;

  $effect(() => {
    if (mode === previousMode) return;

    const nextMode = mode;
    const priorMode = previousMode;
    previousMode = nextMode;

    onmodechange?.(nextMode);

    // Prevent stale editor context when switching modes.
    linkPopoverOpen = false;
    linkPopoverAnchorElement = null;

    if (nextMode === 'source') {
      // Flush pending WYSIWYG edits and canonicalize before showing raw markdown.
      let latestMarkdown = value;
      if (editorState) {
        try {
          latestMarkdown = editorState.getMarkdown();
        } catch (error) {
          devWarn('Failed to read markdown from editor during mode switch:', error);
        }
        editorState.clearPendingTimers();
      }

      const normalized = normalizeSafely(latestMarkdown);
      if (normalized !== value) {
        isInternalUpdate = true;
        value = normalized;
        onchange?.(normalized);
        queueMicrotask(() => {
          isInternalUpdate = false;
        });
      }

      // Avoid keeping references to a destroyed Milkdown instance.
      editorState = null;
      isInitializing = false;
      return;
    }

    if (nextMode === 'wysiwyg' && priorMode === 'source') {
      // Canonicalize the textarea content before initializing Milkdown.
      const normalized = normalizeSafely(value);
      if (normalized !== value) {
        isInternalUpdate = true;
        value = normalized;
        onchange?.(normalized);
        queueMicrotask(() => {
          isInternalUpdate = false;
        });
      }

      isInitializing = true;
    }
  });

  // Sync external value changes to editor
  $effect(() => {
    const externalValue = value;

    if (editorState && !isInternalUpdate) {
      let currentMarkdown: string;
      try {
        currentMarkdown = editorState.getMarkdown();
      } catch {
        // Editor may be in the middle of teardown; fail open to avoid crashing.
        return;
      }
      // Only update if actually different
      if (externalValue !== currentMarkdown) {
        try {
          editorState.setMarkdown(externalValue);
        } catch {
          // Ignore errors during teardown or transient editor state.
        }
      }
    }
  });

  // Sync readonly prop changes to editor (action's update() is never called without parameters)
  $effect(() => {
    if (editorState) {
      setEditorReadonly(editorState, readonly);
    }
    // Close link popover when editor becomes readonly (toolbar disappears but popover might stay)
    if (readonly) {
      linkPopoverOpen = false;
      linkPopoverAnchorElement = null;
    }
  });

  // Forward naming and description attributes to the actual ProseMirror textbox.
  // The textarea binding handles the source mode surface via the template.
  $effect(() => {
    const viewDom = editorState?.view?.dom;
    if (!viewDom) return;

    viewDom.setAttribute('aria-label', accessibleEditorLabel);

    if (ariaDescribedby) {
      viewDom.setAttribute('aria-describedby', ariaDescribedby);
    } else {
      viewDom.removeAttribute('aria-describedby');
    }
  });

  // Expose imperative handle via exported functions
  export function focus(): void {
    editorState?.focus();
  }

  export function getMarkdown(): string {
    return editorState?.getMarkdown() ?? value;
  }

  export function setMarkdown(content: string): void {
    if (editorState) {
      // Push the content into the live document synchronously — a caller
      // reading getMarkdown()/getAst() right after this call must see it.
      editorState.setMarkdown(content);
    }

    // `value` is $bindable — a consumer that binds it (`bind:value`) expects
    // it to reflect an imperative content change the same way it reflects a
    // typed one, not go stale until the next debounced `onchange` fires (or
    // never, if `onchange` is suppressed for this external update).
    //
    // cinder#1328: an UNCONDITIONAL `value = content;` here permanently
    // broke a LATER, unrelated parent-driven value change (e.g.
    // `ReviewEditor.reset()`, called any amount of time afterward) from
    // ever reaching the live document again. Empirically: not a debounce
    // race — it reproduced with zero delay between the two calls (and with
    // an added `await tick()` between them) and stayed broken indefinitely
    // afterward, across a full 0-1200ms sweep of delay in both shapes,
    // against a harness mirroring `ReviewEditor.setMarkdown()`'s actual
    // dual write (review-editor-impl.svelte, ~932-934: it writes ITS OWN
    // `value` immediately before calling this function — a one-way
    // `value={editorValue}` consumer, not `bind:value`, writing the same
    // prop from two places in one synchronous pass).
    //
    // Guarding the write with a read-compare (`value !== content`) fixes
    // it. The read resolves whatever the parent already wrote through the
    // ordinary path BEFORE this line runs — since the parent's write always
    // lands first (it happens earlier in the same script, before
    // `editorRef.setMarkdown()` is even called) — so by the time this
    // comparison runs, `value` already reflects it, and the follow-up write
    // is skipped as a no-op. There is then no unconditional force-write left
    // to interfere with. A `tick()`-deferred version of this fix was tried
    // first and rejected: deferring the SAME forced write just relocated it
    // to a later point where it could still race a still-not-fully-settled
    // parent write and reproduce the identical class of bug one microtask
    // later — confirmed by the deferred version actually failing that way
    // under a slightly different call sequence during review.
    //
    // Working theory for WHY an unconditional write breaks this, pinned to
    // svelte@5.56.4 and not independently verified against the engine
    // itself (worth a look if this class of bug resurfaces after a Svelte
    // upgrade): `value`'s backing node here is a writable `derived` — the
    // "prop written to, no `bind:`" branch of `prop()` in
    // `svelte/src/internal/client/reactivity/props.js`. The parent's write
    // (moments earlier, in the caller) leaves that derived MAYBE_DIRTY,
    // pending a real re-execution. Force-writing it while still in that
    // state (`set()` in sources.js) calls `update_derived_status`, which
    // marks it CLEAN outright without re-executing it — never clearing its
    // `WAS_MARKED` propagation flag (status.js / the `mark_reactions`
    // early-return on `WAS_MARKED` in sources.js). A later, unrelated
    // parent-driven change then finds that flag already set and
    // `mark_reactions` never propagates to this prop again, so the "sync
    // external value changes" effect below never re-fires.
    if (value !== content) {
      value = content;
    }
  }

  export function getAst() {
    const markdown = getMarkdown();
    if (pipelineUtilities === null) {
      throw new Error('Markdown pipeline is not ready yet.');
    }
    return pipelineUtilities.parseOrThrow(markdown);
  }

  export function getSelection(): EditorSelection | null {
    if (!editorState?.view) return null;
    const { from, to } = editorState.view.state.selection;
    return { from, to, isCollapsed: from === to };
  }

  // Expose direct access for advanced use (DEP-39/43)
  export function getView() {
    return editorState?.view ?? null;
  }

  export function getEditor() {
    return editorState?.editor ?? null;
  }

  onDestroy(() => {
    // Avoid leaving timers running and prevent stale references to destroyed Milkdown state.
    editorState?.clearPendingTimers();
    editorState = null;
  });
</script>

<div
  bind:this={wrapperElement}
  class={classNames('markdown-editor-wrapper', className)}
  data-initializing={isInitializing || undefined}
  data-ready={!isInitializing ? true : undefined}
  data-mode={mode}
  data-has-toolbar={toolbarVisible || undefined}
  data-snapshot-mode={snapshotMode || undefined}
  {...rest}
>
  <div class="markdown-editor-layout">
    {#if toolbarVisible}
      {#if toolbar}
        <!-- Full custom toolbar override -->
        {@render toolbar(toolbarContext)}
      {:else}
        <!-- Default toolbar with optional extension points -->
        <div class="editor-toolbar-wrapper">
          {#if toolbarLeading}
            <div class="toolbar-leading">
              {@render toolbarLeading(toolbarContext)}
            </div>
          {/if}

          <EditorToolbar
            id={`${id}-toolbar`}
            editorId={id}
            {editorContext}
            {activeMarks}
            {activeBlockType}
            {canUndo}
            {canRedo}
            {linkPopoverOpen}
            disabled={!editorContext}
            onLinkClick={handleLinkClick}
            onUndo={handleUndo}
            onRedo={handleRedo}
          />

          {#if toolbarActions}
            <div class="toolbar-actions">
              {@render toolbarActions(toolbarContext)}
            </div>
          {/if}

          {#if showModeToggle}
            <div class="toolbar-mode-toggle">
              <SegmentedControl
                id={`${id}-mode-toggle`}
                selectionMode="single"
                size="sm"
                bind:value={mode}
                label={modeLabel}
                labelVisible={false}
              >
                <Segment value="wysiwyg" aria-label="Rich editor"
                  ><Pencil aria-hidden="true" /><span class="cinder-sr-only">Rich</span></Segment
                >
                <Segment value="source" aria-label="Raw Markdown"
                  ><FileCode aria-hidden="true" /><span class="cinder-sr-only">Raw</span></Segment
                >
              </SegmentedControl>
            </div>
          {/if}
        </div>
      {/if}
    {/if}

    {#if browser}
      {#if mode === 'wysiwyg'}
        <!-- eslint-disable-next-line svelte/no-unused-svelte-ignore -- ESLint doesn't see Svelte's a11y warning -->
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <div
          {id}
          class="cinder-markdown-content markdown-editor surface"
          data-readonly={readonly || undefined}
          style:--editor-placeholder={placeholderStyleValue}
          role="application"
          aria-label={accessibleEditorLabel}
          tabindex="0"
          {@attach editorAttachment}
        ></div>
      {:else}
        <textarea
          {id}
          class="markdown-editor surface source-mode"
          bind:value
          oninput={(e) => onchange?.(e.currentTarget.value)}
          {placeholder}
          readonly={readonly || undefined}
          aria-label={accessibleEditorLabel}
          aria-describedby={ariaDescribedby}
          aria-multiline="true"
        ></textarea>
      {/if}
    {:else}
      <EditorSkeleton class="markdown-editor" />
    {/if}
  </div>

  {#if linkPopoverOpen && mode === 'wysiwyg'}
    <LinkPopover
      id={`${id}-link-popover`}
      mode={linkPopoverMode}
      initialUrl={linkPopoverInitialUrl}
      initialText={linkPopoverInitialText}
      hasSelection={linkPopoverHasSelection}
      anchorElement={linkPopoverAnchorElement}
      onclose={handleLinkPopoverClose}
      oninsert={handleLinkInsert}
      onremove={handleLinkRemove}
    />
  {/if}
</div>

<style>
  .markdown-editor-wrapper {
    /* Configurable minimum height for the editor content area */
    --editor-min-height: 200px;
    --editor-source-min-height: max(var(--editor-min-height), 16rem);

    display: flex;
    flex-direction: column;
    min-height: var(--editor-min-height);
    /* Single outer border for the whole editor card */
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-md);
    overflow: hidden;
    /* Card root carries the SINGLE background. Per the surface nesting rule
       (see tokens-base.css), every region inside (toolbar wrapper, editor
       body) inherits — they must not redeclare `background:`. */
    background: var(--cinder-surface-raised);
  }

  .markdown-editor-layout {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: var(--cinder-space-2);
    container-name: cinder-markdown-editor;
    container-type: inline-size;
  }

  /* Toolbar wrapper for extension points */
  .editor-toolbar-wrapper {
    display: flex;
    align-items: flex-start;
    gap: var(--cinder-space-2);
    /* The wrapper owns nested toolbar padding; EditorToolbar keeps standalone chrome. */
    padding: var(--cinder-space-2) var(--cinder-space-3);
    border-bottom: 1px solid var(--cinder-border);
    /* Background inherited from .markdown-editor-wrapper per surface nesting rule. */
    flex-wrap: nowrap;
  }

  .editor-toolbar-wrapper :global(.editor-toolbar) {
    flex: 1 1 0;
    min-width: 0;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: thin;
  }

  .toolbar-mode-toggle {
    display: flex;
    justify-content: flex-end;
    flex: 0 0 auto;
    margin-inline-start: auto;
  }

  /* SegmentedControl uses size="sm" — no height override needed */

  .toolbar-leading,
  .toolbar-actions {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-1);
    flex-shrink: 0;
  }

  .markdown-editor {
    flex: 1;
    overflow: auto;
    position: relative;
    min-height: var(--editor-min-height);
  }

  /* When toolbar is present, collapse the gap so toolbar and editor are flush */
  .markdown-editor-wrapper[data-has-toolbar] .markdown-editor-layout {
    gap: 0;
  }

  /*
   * When the wrapper provides the outer border, the toolbar only needs
   * a bottom separator — no own border, no own radius.
   */
  .markdown-editor-wrapper[data-has-toolbar] :global(.editor-toolbar) {
    border: none;
    border-radius: 0;
  }

  /*
   * The editor content area sits inside the wrapper's border, so it
   * needs no own border or radius.
   */
  .markdown-editor-wrapper .markdown-editor {
    border: none;
    border-radius: 0;
  }

  .markdown-editor[data-readonly] {
    background: var(--cinder-surface-raised);
  }

  /* Source mode (raw markdown textarea) */
  textarea.markdown-editor.source-mode {
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-sm);
    line-height: 1.6;
    padding: var(--cinder-space-4);
    resize: none;
    width: 100%;
    /* Use flex: 1 instead of height: 100% for consistent sizing with WYSIWYG mode */
    flex: 1;
    color: var(--cinder-text);
    min-height: var(--editor-source-min-height);
  }

  @container cinder-markdown-editor (max-width: 42rem) {
    .editor-toolbar-wrapper :global(.toolbar-separator) {
      display: none;
    }

    .toolbar-mode-toggle {
      margin-inline-start: 0;
    }
  }

  textarea.markdown-editor.source-mode::placeholder {
    color: var(--cinder-text-muted);
  }

  textarea.markdown-editor.source-mode:focus {
    outline: none;
    /* Border is on the wrapper; no own border to update */
  }

  /* ProseMirror content area */
  .markdown-editor :global(.ProseMirror) {
    padding: var(--cinder-space-5);
    outline: none;
    min-height: 100%;
  }

  /* Placeholder for empty editor - uses CSS custom property that cascades from parent */
  .markdown-editor :global(.ProseMirror p.is-editor-empty:first-child::before) {
    content: var(--editor-placeholder, 'Start writing...');
    color: var(--cinder-text-muted);
    pointer-events: none;
    float: left;
    height: 0;
  }

  /* Focus indicator — move to the wrapper since it now owns the outer border.
     Rich text editors already show a blinking cursor for focus,
     so a prominent ring around the entire container is redundant. */
  .markdown-editor-wrapper:focus-within {
    border-color: var(--cinder-accent);
  }

  /* When the ProseMirror surface itself receives keyboard focus (tabindex=0),
     render an explicit focus ring. The blinking caret only appears after the
     user starts typing — without this, keyboard users can't see where focus
     landed. Inset offset keeps the ring inside the wrapper's border and uses
     the shared ring-width token so weight matches sibling controls. */
  .markdown-editor.surface:focus-visible {
    outline: var(--cinder-ring-width) solid transparent;
    box-shadow: inset 0 0 0 var(--cinder-ring-width)
      var(--_cinder-markdown-editor-surface-ring, var(--cinder-ring-color));
  }

  @media (forced-colors: active) {
    .markdown-editor.surface:focus-visible {
      outline: var(--cinder-ring-width) solid ButtonText;
      outline-offset: calc(var(--cinder-ring-width) * -1);
    }
  }

  /*
   * Typography styles for ProseMirror content come from the Cinder-owned
   * .cinder-markdown-content utility, so consumers do not need a global
   * .prose stylesheet for MarkdownEditor to render correctly.
   */

  /* Template placeholder invalid token decoration (DEP-583) */
  .markdown-editor :global(.template-placeholder-invalid) {
    text-decoration: wavy underline var(--cinder-warning, #e5a200);
    text-decoration-skip-ink: none;
    text-underline-offset: 2px;
  }

  /*
   * Snapshot mode: suppress the blinking caret and text selection highlights
   * so visual regression screenshots are pixel-stable across runs.
   * Scoped to [data-snapshot-mode] so normal editing is completely unaffected.
   */
  /*
   * `:global(*)` and a transparent `::selection`, and both halves are load-bearing.
   *
   * Svelte scopes a bare `*` to `:where(.svelte-…)`, so the descendant half only
   * ever reached elements this component rendered — never `.milkdown` /
   * `.ProseMirror`, which Milkdown creates at runtime with no scope class. That
   * was true in every engine; Chromium merely LOOKED correct because Blink
   * inherits `user-select`, which css-ui-4 defines as non-inherited and Gecko
   * implements as such. Firefox reporting `auto` there is the spec-correct value
   * and is what surfaced this.
   *
   * `user-select` alone would still not deliver the promise: a real drag inside a
   * snapshot-mode editor selected and repainted in BOTH Chromium and Firefox even
   * where the property computed to `none`, because ProseMirror's contenteditable
   * stays selectable regardless. Painting the selection transparent is what
   * actually makes the surface pixel-stable, which is what the prop documents.
   */
  .markdown-editor-wrapper[data-snapshot-mode],
  .markdown-editor-wrapper[data-snapshot-mode] :global(*) {
    caret-color: transparent;
    user-select: none;
  }

  .markdown-editor-wrapper[data-snapshot-mode] :global(::selection) {
    background: transparent;
    color: inherit;
  }

  /* Template completion popup (DEP-583) */
  .markdown-editor :global(.template-completion-popup) {
    background: var(--cinder-surface-raised, #fff);
    border: 1px solid var(--cinder-border, #d0d5dd);
    border-radius: var(--cinder-radius-md, 6px);
    box-shadow: var(--cinder-shadow-md, 0 4px 6px -1px rgb(0 0 0 / 0.1));
    max-height: 240px;
    overflow-y: auto;
    min-width: 200px;
    max-width: 360px;
    padding: var(--cinder-space-1, 4px);
  }

  .markdown-editor :global(.template-completion-item) {
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: var(--cinder-space-1, 4px) var(--cinder-space-2, 8px);
    border-radius: var(--cinder-radius-sm, 4px);
    cursor: pointer;
    font-size: var(--cinder-text-sm, 0.875rem);
    line-height: 1.4;
  }

  .markdown-editor :global(.template-completion-item--active) {
    background: var(--cinder-surface-active, #f0f4ff);
  }

  @media (hover: hover) {
    .markdown-editor :global(.template-completion-item:hover) {
      background: var(--cinder-surface-active, #f0f4ff);
    }
  }

  .markdown-editor :global(.template-completion-item-path) {
    font-family: var(--cinder-font-mono);
    font-weight: var(--cinder-font-medium);
    color: var(--cinder-text, #1a1a1a);
  }

  .markdown-editor :global(.template-completion-item-description) {
    font-size: var(--cinder-text-xs, 0.75rem);
    color: var(--cinder-text-muted, #6b7280);
  }
</style>

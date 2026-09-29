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
  export type { EditorMode, MarkdownEditorProps, ToolbarContext } from './markdown-editor.types.ts';
</script>

<script lang="ts">
  import { BROWSER as browser } from 'esm-env';
  import { onDestroy, untrack } from 'svelte';
  import { devWarn } from '../../utilities/dev-warn.ts';
  import type { Ctx } from '@milkdown/kit/ctx';
  import {
    type ActiveBlockType,
    type ActiveMarks,
    type EditorSelection,
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
  } from '../../editor/index.ts';

  import './prosemirror.css';
  import { classNames } from '../../utilities/class-names.ts';
  import { Textarea } from '@lostgradient/cinder';
  import EditorSkeleton from './editor-skeleton.svelte';
  import MarkdownEditorModeControl from './markdown-editor-mode-control.svelte';
  import MarkdownEditorPlaceholderRegions from './markdown-editor-placeholder-regions.svelte';
  import MarkdownEditorPreview from './markdown-editor-preview.svelte';
  import { modeOptionDiagnostics } from './markdown-editor-mode.ts';
  import { createMarkdownEditorModeController } from './markdown-editor-mode-controller.svelte.ts';
  import { createMarkdownEditorPlaceholders } from './markdown-editor-placeholders.svelte.ts';
  import {
    createMarkdownEditorPreview,
    planPreviewFill,
  } from './markdown-editor-preview.svelte.ts';
  import { buildToolbarContext } from './markdown-editor-toolbar-context.ts';
  import { resolveLinkPopoverAnchor } from './link-popover-anchor.ts';
  import { createSourceEditingAttachment } from './source-placeholder-completion.ts';
  import { EditorToolbar, LinkPopover } from './editor-toolbar/index.ts';
  import type { LinkPopoverMode } from './editor-toolbar/link-popover.svelte';
  import type { EditorMode, MarkdownEditorProps, ToolbarContext } from './markdown-editor.types.ts';

  type HistoryUtilities = Pick<
    typeof import('@milkdown/kit/prose/history'),
    'undoDepth' | 'redoDepth'
  >;

  type MarkdownPipelineUtilities = Pick<
    typeof import('@lostgradient/markdown'),
    'normalize' | 'parseOrThrow'
  >;

  let {
    id,
    label = 'Markdown editor',
    value = $bindable(''),
    mode = $bindable<EditorMode>('wysiwyg'),
    modeToggleVisible = false,
    modeLabel = 'Editor mode',
    readonly = false,
    placeholder = 'Start writing...',
    toolbarEnabled = true,
    onToolbarContextChange,
    class: className,
    onValueChange,
    onReady,
    onModeChange,
    onSelectionChange,
    onCommentShortcut,
    plugins = [],
    placeholderCompletion,
    placeholderDecoration,
    placeholderDefinitions,
    placeholderValues,
    placeholderValueMode,
    onPlaceholderDiagnosticsChange,
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
  let previewComponent = $state<MarkdownEditorPreview | null>(null);
  let lastObservedExternalValue: string | undefined;
  // The value the component last saw, from the parent or its own writes. A
  // different `value` at a mode change is a parent update in the same flush.
  let lastSeenValue = untrack(() => value);

  // Registered before the value sync below, so a mode change sees a parent
  // value from the same flush before that sync applies it.
  const modes = createMarkdownEditorModeController({
    mode: () => mode,
    setMode: (next) => {
      mode = next;
    },
    value: () => value,
    lastSeenValue: () => lastSeenValue,
    editorState: () => editorState,
    releaseEditorState: () => {
      // Avoid keeping references to a destroyed Milkdown instance.
      editorState = null;
    },
    setInitializing: (initializing) => {
      isInitializing = initializing;
    },
    normalize: (markdown) => normalizeSafely(markdown),
    publishValue: publishInternalValue,
    closeTransientUi: () => {
      // Prevent stale editor context when switching modes.
      linkPopoverOpen = false;
      linkPopoverAnchorElement = null;
    },
    onModeChange: () => onModeChange,
    focusMode,
    warn: devWarn,
  });
  const currentMode = $derived(modes.mode);

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
   * `onValueChange`'s debounced callback (`changeDebounceMs`, stacked on top of
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

  const placeholders = createMarkdownEditorPlaceholders({
    id: () => id,
    value: () => value,
    readonly: () => readonly,
    definitions: () => placeholderDefinitions,
    values: () => placeholderValues,
    completion: () => placeholderCompletion,
    decoration: () => placeholderDecoration,
    onDiagnosticsChange: () => onPlaceholderDiagnosticsChange,
    optionDiagnostics: () => modeOptionDiagnostics(mode, placeholderValueMode),
    previewDiagnostics: () => preview.diagnostics,
  });

  const preview = createMarkdownEditorPreview({
    active: () => currentMode === 'preview',
    source: () => value,
    fill: () =>
      planPreviewFill({
        definitions: placeholderDefinitions,
        values: placeholderValues,
        valueMode: placeholderValueMode,
        catalogEnabled: placeholders.resolved.validationCandidates !== undefined,
      }),
    configurationIssues: () => placeholders.resolved.issues,
  });

  // Internal state
  let editorState = $state<EditorState | null>(null);
  let isInitializing = $state(untrack(() => currentMode !== 'preview'));
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
    // Load only once a rich editor exists, so a preview-only mount never does.
    if (editorState === null || untrack(() => historyUtilities) !== null) return;

    let cancelled = false;
    // Milkdown/ProseMirror runtime graph is browser-bound; keep this import inside the browser-only effect.
    void import('@milkdown/kit/prose/history').then((module) => {
      if (!cancelled) {
        historyUtilities = {
          undoDepth: module.undoDepth,
          redoDepth: module.redoDepth,
        };
      }
      return undefined;
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
    void import('@lostgradient/markdown').then((module) => {
      if (!cancelled) {
        pipelineUtilities = {
          normalize: module.normalize,
          parseOrThrow: module.parseOrThrow,
        };
      }
      return undefined;
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
    toolbarEnabled && !readonly && browser && (currentMode === 'wysiwyg' || modeToggleVisible),
  );
  // The one built-in mode control sits in the default toolbar when that
  // renders, and in its own bar otherwise: custom toolbar, toolbar disabled
  // or readonly never hide it.
  const modeControlInToolbar = $derived(toolbarVisible && !toolbar);
  const modeBarVisible = $derived(browser && modeToggleVisible && !modeControlInToolbar);

  // Link popover state
  let linkPopoverOpen = $state(false);
  let linkPopoverAnchorElement = $state<
    HTMLElement | import('@floating-ui/dom').VirtualElement | null
  >(null);

  // Toolbar context for snippets. Declared after the link-popover state it
  // reads; the handlers below are function declarations, so they hoist.
  const toolbarContext: ToolbarContext = $derived(
    buildToolbarContext({
      mode: currentMode,
      readonly,
      rich: {
        editorContext,
        activeMarks,
        activeBlockType,
        canUndo,
        canRedo,
        linkPopoverOpen,
        onUndo: handleUndo,
        onRedo: handleRedo,
        onLinkClick: handleLinkClick,
      },
      onModeChange: modes.request,
    }),
  );

  // Publish the context so a parent can host the formatting controls itself.
  $effect(() => {
    onToolbarContextChange?.(toolbarContext);
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

  // Outside interaction targets some OTHER control — a different toolbar
  // button, a click into the raw-source textarea, a click on the page. That
  // control's own focus assignment must win, so this closes the popover
  // WITHOUT the editorState.focus() call handleLinkPopoverClose makes for
  // every explicit close (Escape/Cancel/Close/Insert/Update/Remove). Forcing
  // focus back into the editor here would steal it from whatever was
  // actually clicked immediately after this handler runs.
  function handleLinkPopoverOutsideDismiss() {
    linkPopoverOpen = false;
    linkPopoverAnchorElement = null;
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
    getPlaceholderConfiguration: () => placeholders.configuration,
    placeholderListboxId: placeholders.listboxId,
    onPlaceholderStatusChange: (message) => placeholders.setStatusMessage(message),
    onready: (state) => {
      editorState = state;
      isInitializing = false;
      onReady?.();
    },
    onchange: (markdown) => {
      isInternalUpdate = true;
      value = markdown;
      onValueChange?.(markdown);
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
      onSelectionChange?.(selection);
    },
    onlinkshortcut: () => {
      // Mod-k pressed - open link popover with a virtual element anchor
      // derived from the current ProseMirror selection position. Capture the
      // current link range (as handleLinkClick does) so a subsequent Remove
      // acts on the right link rather than a stale/null range.
      capturedLinkRange = lastKnownLinkRange;
      linkPopoverAnchorElement = resolveLinkPopoverAnchor(editorState?.view, wrapperElement);
      linkPopoverOpen = true;
    },
    // DEP-47: Comment shortcut (Ctrl-Alt-c)
    onCommentShortcut: () => onCommentShortcut?.(),
  });

  // Source mode's explicit history and placeholder completion (COR-521).
  const sourceEditingAttachment = createSourceEditingAttachment({
    value: () => value,
    readonly: () => readonly || currentMode === 'preview',
    configuration: () => placeholders.resolved,
    listboxId: () => placeholders.sourceListboxId,
    popupContainer: () => wrapperElement,
    onStatusChange: (message) => placeholders.setStatusMessage(message),
    commitValue: (next) => {
      value = next;
      onValueChange?.(next);
    },
  });

  /**
   * Publish a value the component derived itself, once, if it changed. It
   * never needs the `isInternalUpdate` guard: it is either the live rich
   * document (so the value sync finds nothing to apply) or published after
   * the rich editor is released. Leaving the guard off keeps a parent value
   * that follows in the same task from being mistaken for this one.
   */
  function publishInternalValue(next: string): void {
    if (next === value) return;
    value = next;
    onValueChange?.(next);
  }

  function focusMode(nextMode: EditorMode): void {
    if (nextMode === 'preview') previewComponent?.focus();
    else if (nextMode === 'wysiwyg') editorState?.focus();
    else wrapperElement?.querySelector<HTMLElement>('textarea.source-mode')?.focus();
  }

  // Sync external value changes to editor
  $effect(() => {
    const externalValue = value;
    lastSeenValue = externalValue;

    if (editorState && !isInternalUpdate) {
      if (editorState.hasPendingInternalChange() && externalValue === lastObservedExternalValue) {
        return;
      }
      lastObservedExternalValue = externalValue;
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
          // Behind preview, a replacement becomes the retained editor's new baseline.
          if (untrack(() => currentMode) === 'preview') editorState.resetDocument(externalValue);
          else editorState.setMarkdown(externalValue);
        } catch {
          // Ignore errors during teardown or transient editor state.
        }
      }
    }
  });

  // Sync readonly prop changes to editor (action's update() is never called without parameters)
  $effect(() => {
    if (editorState) {
      setEditorReadonly(editorState, readonly || currentMode === 'preview');
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

    const describedBy = placeholders.describedBy(ariaDescribedby);
    if (describedBy) {
      viewDom.setAttribute('aria-describedby', describedBy);
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
      // Behind preview it becomes the retained editor's new baseline.
      if (currentMode === 'preview') editorState.resetDocument(content);
      else editorState.setMarkdown(content);
    }

    // `value` is $bindable — a consumer that binds it (`bind:value`) expects
    // it to reflect an imperative content change the same way it reflects a
    // typed one, not go stale until the next debounced `onValueChange` fires (or
    // never, if `onValueChange` is suppressed for this external update).
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

{#snippet modeControl()}
  <MarkdownEditorModeControl
    id={`${id}-mode-toggle`}
    label={modeLabel}
    mode={currentMode}
    onSelect={modes.request}
  />
{/snippet}

<div
  bind:this={wrapperElement}
  class={classNames('markdown-editor-wrapper', className)}
  data-initializing={isInitializing || undefined}
  data-ready={!isInitializing ? true : undefined}
  data-mode={currentMode}
  data-has-toolbar={toolbarVisible || modeBarVisible || undefined}
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
            editorContext={toolbarContext.editorContext}
            activeMarks={toolbarContext.activeMarks}
            activeBlockType={toolbarContext.activeBlockType}
            canUndo={toolbarContext.canUndo}
            canRedo={toolbarContext.canRedo}
            linkPopoverOpen={toolbarContext.linkPopoverOpen}
            disabled={!toolbarContext.editorContext}
            onLinkClick={toolbarContext.onLinkClick}
            onUndo={toolbarContext.onUndo}
            onRedo={toolbarContext.onRedo}
          />

          {#if toolbarActions}
            <div class="toolbar-actions">
              {@render toolbarActions(toolbarContext)}
            </div>
          {/if}

          {#if modeToggleVisible}
            <div class="toolbar-mode-toggle">{@render modeControl()}</div>
          {/if}
        </div>
      {/if}
    {/if}

    {#if modeBarVisible}
      <div class="markdown-editor-mode-bar">
        <div class="toolbar-mode-toggle">{@render modeControl()}</div>
      </div>
    {/if}

    {#if browser}
      <div
        class="markdown-editor-surface"
        hidden={currentMode === 'preview' || undefined}
        inert={currentMode === 'preview' || undefined}
      >
        {#if modes.editingMode === 'wysiwyg'}
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
        {:else if modes.editingMode === 'source'}
          <Textarea
            {id}
            bind:value
            variant="code"
            class="markdown-editor surface source-mode"
            oninput={(e) => onValueChange?.(e.currentTarget.value)}
            {placeholder}
            readonly={readonly || undefined}
            aria-label={accessibleEditorLabel}
            aria-describedby={placeholders.describedBy(ariaDescribedby)}
            aria-multiline="true"
            {@attach sourceEditingAttachment}
          />
        {/if}
      </div>
    {:else if currentMode !== 'preview'}
      <EditorSkeleton class="markdown-editor" />
    {/if}

    {#if currentMode === 'preview'}
      <MarkdownEditorPreview bind:this={previewComponent} {id} view={preview.view} />
    {/if}
  </div>

  {#if linkPopoverOpen && currentMode === 'wysiwyg'}
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
      onOutsideDismiss={handleLinkPopoverOutsideDismiss}
    />
  {/if}

  <MarkdownEditorPlaceholderRegions
    {id}
    instructionsVisible={placeholders.instructionsVisible}
    statusMessage={placeholders.statusMessage}
    diagnostics={placeholders.diagnostics}
  />
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

  /* The mode control's own row when the default toolbar does not render. */
  .markdown-editor-mode-bar {
    display: flex;
    justify-content: flex-end;
    padding: var(--cinder-space-2) var(--cinder-space-3);
    border-bottom: 1px solid var(--cinder-border);
  }

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

  /*
   * Source mode composes Textarea's `variant="code"` for font-family,
   * font-size, line-height, tab-size, background, text color, focus ring
   * color, and the disabled/read-only surface (CIN-340) — only layout and
   * chrome stay local here. `textarea.markdown-editor.source-mode` is now
   * rendered by the Textarea component, so it no longer carries this file's
   * Svelte scoping class and needs :global() to keep reaching it.
   * `.cinder-textarea-field` is Textarea's own field wrapper (rendered
   * because no ambient FormFieldContext exists here); it has no consumer
   * `class` hook, so it's targeted by its fixed class name. Scoped to a
   * DIRECT child of `.markdown-editor-surface` (the `display: contents`
   * wrapper that holds only the editing surface) — not just to source mode —
   * so it can only ever match this one Textarea, never a consumer-rendered
   * Textarea nested inside `toolbarActions`/`toolbarLeading` while source
   * mode happens to also be active.
   */
  .markdown-editor-surface {
    display: contents;
  }

  /* Behind preview the retained editing surface keeps its state, hidden. */
  .markdown-editor-surface[hidden] {
    display: none;
  }

  .markdown-editor-surface > :global(.cinder-textarea-field) {
    flex: 1;
    min-height: 0;
  }

  .markdown-editor-wrapper :global(textarea.markdown-editor.source-mode) {
    /* Use flex: 1 instead of height: 100% for consistent sizing with WYSIWYG mode */
    flex: 1;
    overflow: auto;
    position: relative;
    padding: var(--cinder-space-4);
    resize: none;
    min-height: var(--editor-source-min-height);
    border: none;
    border-radius: 0;
    /* Textarea's code variant opts into `field-sizing: content` where
       supported, which auto-grows the control to fit its value and fights
       the flex-fill sizing this embedded surface relies on. */
    field-sizing: fixed;
  }

  @container cinder-markdown-editor (max-width: 42rem) {
    .editor-toolbar-wrapper :global(.toolbar-separator) {
      display: none;
    }

    .toolbar-mode-toggle {
      margin-inline-start: 0;
    }
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
    border-color: var(--cinder-accent-solid);
  }

  /* When the ProseMirror surface itself receives keyboard focus (tabindex=0),
     render an explicit focus ring. The blinking caret only appears after the
     user starts typing — without this, keyboard users can't see where focus
     landed. Inset offset keeps the ring inside the wrapper's border and uses
     the shared ring-width token so weight matches sibling controls.

     Source mode's textarea shares this same inset treatment rather than
     Textarea's own default `variant="code"` focus ring (an outer box-shadow
     with `border-color: transparent`) — deliberately: this control is
     embedded inside a card that already turns its own border accent-colored
     on `:focus-within` (above), so the outer ring would double up with it.
     Recorded as a deliberate embedding difference in markdown-editor.a11y.md. */
  .markdown-editor.surface:focus-visible,
  .markdown-editor-wrapper :global(textarea.markdown-editor.source-mode:focus-visible) {
    outline: var(--cinder-ring-width) solid transparent;
    box-shadow: inset 0 0 0 var(--cinder-ring-width)
      var(--_cinder-markdown-editor-surface-ring, var(--cinder-ring-color));
  }

  @media (forced-colors: active) {
    .markdown-editor.surface:focus-visible,
    .markdown-editor-wrapper :global(textarea.markdown-editor.source-mode:focus-visible) {
      outline: var(--cinder-ring-width) solid ButtonText;
      outline-offset: calc(var(--cinder-ring-width) * -1);
    }
  }

  /*
   * Typography styles for ProseMirror content come from the Cinder-owned
   * .cinder-markdown-content utility, so consumers do not need a global
   * .prose stylesheet for MarkdownEditor to render correctly.
   */

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
</style>

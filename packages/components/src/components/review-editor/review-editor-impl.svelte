<script lang="ts" module>
  import type { EditorSelection } from '@lostgradient/cinder/editor';
  import type {
    Thread,
    PersistedThread,
    ThreadCreateEvent,
    ReviewState,
    AnchorUpdate,
  } from '@lostgradient/cinder/commentary/comments';
  import type { ReviewEditorProps, ReviewFormData } from './review-editor.types.ts';

  export type { ReviewMode, ReviewEditorProps, ReviewFormData } from './review-editor.types.ts';

  /** Type alias for thread ID to improve readability in state declarations */
  type ThreadId = string;
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import { devWarn } from '../../utilities/dev-warn.ts';
  import { useReducedMotion } from '../../utilities/use-reduced-motion.svelte.ts';
  import { createFocusRegionNavigator, type FocusRegion } from './focus-navigation.ts';
  import { createChangeTracker } from '../../utilities/change-tracker.svelte.ts';
  import { stringifyOrNull } from '../../utilities/stringify.ts';
  import MarkdownEditor from '../markdown-editor/markdown-editor.svelte';
  import { contentEquals, normalize } from '@lostgradient/cinder/markdown/pipeline';
  import { textOffsetToProseMirrorPosition } from '@lostgradient/cinder/editor';
  import {
    createAnchorPlugin,
    anchorPluginKey,
  } from '@lostgradient/cinder/commentary/anchor-decorations';
  import {
    reanchorQuote,
    ANCHOR_CONTEXT_LENGTH,
    generateId,
    extractMentions,
    createDocumentAnchor,
  } from '@lostgradient/cinder/commentary/comments';
  import { buildAnchorFromSelection } from '@lostgradient/cinder/commentary/anchoring';
  import ThreadPopover from './thread-popover.svelte';
  import LiveRegion from './live-region.svelte';
  import ExportActions from './export-actions.svelte';
  import CommentSidebar from './comment-sidebar.svelte';
  import FrontMatterFields from './front-matter-fields.svelte';
  import ReviewEditorControls from './review-editor-controls.svelte';
  import {
    bodyAnchorToDocumentAnchor,
    bodyAnchorUpdateToDocumentAnchorUpdate,
    combineFrontMatterAndBody,
    documentAnchorToBodyAnchor,
    documentPersistedAnchorToBodyAnchor,
    documentPositionToBodyPosition,
    parseReviewEditorFrontMatter,
    replaceFrontMatterData,
    remapDocumentAnchorBodyOffset,
    reviewStateToMarkdown,
  } from './review-editor-front-matter.ts';
  import type {
    ReviewEditorDiffViewMode as DiffViewMode,
    ReviewEditorViewType as ViewType,
  } from './review-editor.types.ts';
  import {
    getSelectionAnchorPosition,
    type SelectionAnchorPosition,
  } from './review-editor-selection-geometry.ts';
  import DiffViewer from '../diff-viewer/diff-viewer.svelte';
  import SelectionPopover from '../selection-popover/selection-popover.svelte';
  import { computeLineDiff, getDiffStats } from '@lostgradient/cinder/markdown/diff/line-diff';
  import {
    generateMarkdownSummary,
    generateUnifiedDiff,
    generateCommentsExport,
    type MarkdownSummaryOptions,
    type MarkdownSummaryResult,
    type UnifiedDiffOptions,
    type UnifiedDiffResult,
  } from '@lostgradient/cinder/commentary/export';

  // Shared reduced-motion preference (OVERLAY-POLICY: use the shared hook, not inline matchMedia).
  const reducedMotion = useReducedMotion();

  let {
    id,
    original = $bindable(''),
    value = $bindable(''),
    threads = $bindable<Thread[]>([]),
    mode = 'edit',
    currentUserId,
    placeholder = 'Start writing...',
    name,
    class: className,
    onchange,
    onthreadcreate,
    onthreaddelete,
    oncommentcreate,
    oncommentupdate,
    oncommentdelete,
    snapshotMode = false,
  }: ReviewEditorProps = $props();

  // Blur any focused element inside this component on mount when snapshotMode
  // is active. This prevents the initial screenshot from capturing a focused
  // ring or blinking caret. We track the container element via bind:this.
  let containerElement = $state<HTMLDivElement | null>(null);

  $effect(() => {
    if (!snapshotMode) return;
    if (!containerElement) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && containerElement.contains(active)) {
      active.blur();
    }
  });

  // Reference to the underlying MarkdownEditor. Using the imported component
  // as a type is the Svelte ambient pattern — `*.svelte` declares the import
  // as a constructable type with the component's `export function` methods.
  let editorRef: MarkdownEditor | undefined = $state();

  // Reference to LiveRegion for screen reader announcements (DEP-47)
  let liveRegionRef: LiveRegion | undefined = $state();

  // Track when editor view is ready (for effects that need to wait for async editor creation)
  let editorViewReady = $state(false);

  // Track current selection for thread creation
  let currentSelection = $state<EditorSelection | null>(null);

  // =========================================================================
  // Thread Popover State
  // =========================================================================

  // Thread popover state
  let popoverThreadId = $state<ThreadId | null>(null);
  let popoverPosition = $state<{ x: number; y: number } | null>(null);

  // Timer handle for panel selection scroll-then-position delay.
  // Stored at component level so we can cancel it when switching threads.
  let selectTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // Cleanup: cancel pending panel selection timeout on component unmount.
  // This prevents the callback from executing on a destroyed component.
  $effect(() => {
    return () => {
      if (selectTimeoutId !== null) {
        clearTimeout(selectTimeoutId);
        selectTimeoutId = null;
      }
    };
  });

  // Internal active thread tracking (not exposed as bindable prop)
  let activeThreadId = $state<string | null>(null);

  // Comment sidebar toggle state
  let sidebarOpen = $state(false);

  const currentDocument = $derived(parseReviewEditorFrontMatter(value));
  const editorValue = $derived(currentDocument.body);
  const viewPanelIds = $derived({
    editor: `${id}-editor-panel`,
    diff: `${id}-diff-panel`,
    summary: `${id}-summary-panel`,
  });

  // =========================================================================
  // View Switching State (DEP-47)
  // =========================================================================

  /** Active view: editor for editing, diff for comparing, summary for review */
  let activeView = $state<ViewType>('editor');

  /** Diff view mode: unified shows all changes, final shows current state, original shows baseline */
  let diffViewMode = $state<DiffViewMode>('unified');

  // =========================================================================
  // Diff Statistics (DEP-47)
  // =========================================================================

  /**
   * Compute diff statistics from original vs current content.
   * Uses the same line-diff algorithm as DiffViewer for consistency.
   */
  const diffStats = $derived.by(() => {
    if (!original) {
      return { added: 0, removed: 0, modified: 0 };
    }
    // Normalize both inputs to avoid false positives from formatting differences
    const normalizedOriginal = normalize(original);
    const normalizedCurrent = normalize(value);
    const lineDiffs = computeLineDiff(normalizedOriginal, normalizedCurrent);
    return getDiffStats(lineDiffs);
  });

  /** Whether there are any content changes */
  const hasContentChanges = $derived(
    diffStats.added > 0 || diffStats.removed > 0 || diffStats.modified > 0,
  );

  /** Total comment count (excluding soft-deleted comments) */
  const commentCount = $derived(
    threads.reduce((count, thread) => {
      return count + thread.comments.filter((c) => !c.deletedAt).length;
    }, 0),
  );

  /**
   * Summary content for the Summary view (without the "# Review Summary" heading).
   * The heading is useful for clipboard exports but redundant in the UI preview
   * since the view tab already indicates this is a summary.
   */
  const summaryContent = $derived.by(() => {
    const result = exportMarkdownSummary();
    // Strip the "# Review Summary\n" heading from the beginning
    return result.markdown.replace(/^# Review Summary\n+/, '');
  });

  // =========================================================================
  // Selection Popover State (DEP-47)
  // =========================================================================

  /** Position for the selection popover (viewport-relative) */
  let selectionPopoverPosition = $state<SelectionAnchorPosition | null>(null);

  /**
   * Captured selection range for thread creation.
   * We capture this when the popover appears because clicking the popover button
   * will collapse the browser selection before handleSelectionComment runs.
   */
  let capturedSelectionForPopover = $state<{ from: number; to: number } | null>(null);

  /** Whether the selection popover is in expanded form state (user clicked to add comment) */
  let selectionPopoverExpanded = $state(false);

  /** Whether the selection popover should be visible */
  const showSelectionPopover = $derived(
    activeView === 'editor' &&
      mode === 'edit' &&
      // Must have a user ID to create comments
      currentUserId !== undefined &&
      // Position is only set when browser selection is non-collapsed
      // (checked via window.getSelection() in the debounced handler)
      // OR the popover is already expanded (user is composing a comment)
      (selectionPopoverPosition !== null || selectionPopoverExpanded) &&
      // Don't show if a thread popover is already open
      popoverThreadId === null,
  );

  /** Delay for scroll-then-position pattern (matches smooth scroll duration) */
  const POSITION_DELAY_MS = 350;

  /**
   * Get the preferred scroll behavior respecting prefers-reduced-motion.
   * @returns 'instant' if user prefers reduced motion, 'smooth' otherwise
   */
  function getScrollBehavior(): ScrollBehavior {
    return reducedMotion.current ? 'instant' : 'smooth';
  }

  // =========================================================================
  // Screen Reader Announcements (DEP-47)
  // =========================================================================

  /**
   * Announce a message to screen readers via the LiveRegion component.
   * Safe to call before the ref is available (no-op in that case).
   *
   * @param message - The message to announce
   * @param priority - 'polite' (default) or 'assertive'
   */
  function announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    liveRegionRef?.announce(message, priority);
  }

  // Get the popover thread
  const popoverThread = $derived.by(() => {
    if (!popoverThreadId) return null;
    return threads.find((t) => t.id === popoverThreadId) ?? null;
  });

  // Clear popover if thread is deleted
  $effect(() => {
    if (popoverThreadId && !popoverThread) {
      popoverThreadId = null;
      popoverPosition = null;
    }
  });

  // Clear internal active thread if it no longer exists
  $effect(() => {
    if (activeThreadId && !threads.some((t) => t.id === activeThreadId)) {
      activeThreadId = null;
    }
  });

  // Deep linking: open popover when activeThreadId is set externally (e.g., URL navigation).
  $effect(() => {
    let positionTimeoutId: ReturnType<typeof setTimeout> | null = null;

    if (activeThreadId && popoverThreadId !== activeThreadId) {
      const thread = threads.find((t) => t.id === activeThreadId);
      if (thread) {
        const threadIdToOpen = activeThreadId;

        // First, scroll the anchor into view. We defer popover positioning until
        // after the scroll completes to avoid the popover appearing off-screen.
        scrollAnchorIntoView(threadIdToOpen);

        // After scrolling, calculate position and open the popover.
        // We re-fetch the thread inside the callback to avoid using stale data
        // if the threads array changes during the scroll delay.
        positionTimeoutId = setTimeout(() => {
          // Re-fetch thread to ensure we have current data (thread may have been deleted/modified)
          const currentThread = threads.find((t) => t.id === threadIdToOpen);
          if (!currentThread) return;

          const pos = calculateViewportPosition(currentThread.anchor.from);
          if (pos) {
            popoverPosition = { x: pos.left + 16, y: pos.top };
            popoverThreadId = threadIdToOpen;
          }
        }, POSITION_DELAY_MS);
      }
    }

    // Cleanup: cancel pending timeout if effect re-runs or component unmounts
    return () => {
      if (positionTimeoutId !== null) {
        clearTimeout(positionTimeoutId);
      }
    };
  });

  /**
   * Scroll the editor to bring an anchor position into view.
   * @param threadId - The thread ID to scroll to (passed explicitly to avoid stale closure)
   */
  function scrollAnchorIntoView(threadId: ThreadId): void {
    // Query using the passed threadId, not the reactive activeThreadId,
    // to avoid race conditions when called from setTimeout.
    // Scope query to editor DOM to handle multiple ReviewEditor instances on page.
    const editorDom = editorRef?.getView()?.dom;
    const anchorElement = editorDom?.querySelector(`[data-thread-id="${threadId}"]`);
    if (anchorElement) {
      anchorElement.scrollIntoView({ behavior: getScrollBehavior(), block: 'center' });
    }
  }

  // =========================================================================
  // Thread Popover Handlers
  // =========================================================================

  /**
   * Handle closing the thread popover.
   * Also clears activeThreadId to prevent the deep-linking effect from
   * immediately reopening the popover, and cancels any pending panel selection timeout.
   */
  function handlePopoverClose(): void {
    // Cancel any pending panel selection timeout
    if (selectTimeoutId !== null) {
      clearTimeout(selectTimeoutId);
      selectTimeoutId = null;
    }

    popoverThreadId = null;
    popoverPosition = null;
    activeThreadId = null;
  }

  /**
   * Handle thread delete from popover.
   */
  function handlePopoverDelete(threadId: string): void {
    if (currentUserId) {
      deleteThread(threadId);
      handlePopoverClose();
    }
  }

  /**
   * Handle comment update from popover.
   */
  function handlePopoverCommentUpdate(threadId: string, commentId: string, body: string): void {
    updateComment(threadId, commentId, body);
  }

  /**
   * Handle comment delete from popover.
   */
  function handlePopoverCommentDelete(threadId: string, commentId: string): void {
    deleteComment(threadId, commentId);
  }

  /**
   * Handle comment create from popover.
   */
  function handlePopoverCommentCreate(threadId: string, body: string): void {
    if (currentUserId) {
      createComment(threadId, body, currentUserId);
    }
  }

  /**
   * Calculate position for fixed-position popovers near an anchor.
   * Returns viewport-relative coordinates for use with position: fixed elements
   * (ThreadPopover).
   */
  function calculateViewportPosition(from: number): { top: number; left: number } | null {
    const view = editorRef?.getView();
    if (!view) return null;

    try {
      const coords = view.coordsAtPos(
        documentPositionToBodyPosition(from, currentDocument.bodyOffset),
      );
      if (coords) {
        // coords are already viewport-relative from ProseMirror
        return {
          top: coords.top + 24, // Below the anchor
          left: Math.max(16, coords.left), // Minimum 16px from viewport edge
        };
      }
    } catch {
      // Position may be invalid
    }
    return null;
  }

  // =========================================================================
  // Anchor Plugin Integration (DEP-39)
  // =========================================================================

  // Track last synced state to prevent thrashing
  let lastSyncedFingerprint: string | null = null;

  // Pending state for deferred re-anchoring (setState flow)
  let pendingState: ReviewState | null = $state(null);

  /**
   * Create fingerprint including all mutable anchor fields.
   * This prevents sync thrashing when quote/prefix/suffix change.
   */
  function createSyncFingerprint(threadsToSync: Thread[]): string {
    return threadsToSync
      .map((t) => {
        const a = t.anchor;
        // Include lastKnownOffset to propagate disambiguation updates
        return `${t.id}:${a.from}:${a.to}:${a.quote}:${a.prefix}:${a.suffix}:${a.lastKnownOffset ?? ''}`;
      })
      .join('|');
  }

  function createPluginSyncFingerprint(threadsToSync: Thread[]): string {
    return `${currentDocument.bodyOffset}|${createSyncFingerprint(threadsToSync)}`;
  }

  /**
   * Handle anchor position updates from the plugin.
   * Called when the plugin detects position changes.
   */
  function handleAnchorsUpdate(updates: AnchorUpdate[]): void {
    // Update published threads
    threads = threads.map((thread) => {
      const update = updates.find((u) => u.threadId === thread.id);
      if (update) {
        const documentUpdate = bodyAnchorUpdateToDocumentAnchorUpdate(
          update,
          currentDocument.bodyOffset,
        );
        return {
          ...thread,
          anchor: {
            ...thread.anchor,
            from: documentUpdate.from,
            to: documentUpdate.to,
            quote: documentUpdate.quote,
            prefix: documentUpdate.prefix,
            suffix: documentUpdate.suffix,
            lastKnownOffset: documentUpdate.lastKnownOffset,
          },
        };
      }
      return thread;
    });

    // Update fingerprint to skip re-sync
    lastSyncedFingerprint = createPluginSyncFingerprint(threads);
  }

  // Create anchor plugin in instance script (per-instance, before mount)
  // This runs once per ReviewEditor instance during initialization
  const anchorPlugin = createAnchorPlugin({
    onAnchorsUpdate: handleAnchorsUpdate,
    onAnchorClick: handleAnchorClick,
  });

  /**
   * Handle click on an anchor decoration.
   * Opens the thread popover at the click location.
   */
  function handleAnchorClick(threadId: string, event: MouseEvent): void {
    // Cancel any pending panel selection timer to prevent race conditions
    // where the timer callback would unexpectedly switch to a different thread
    if (selectTimeoutId !== null) {
      clearTimeout(selectTimeoutId);
      selectTimeoutId = null;
    }

    // Clear selection popover state when opening a thread popover
    // Otherwise stale state persists and the popover may reappear at an invalid position
    selectionPopoverPosition = null;
    capturedSelectionForPopover = null;
    selectionPopoverExpanded = false;

    // Set active thread and open popover
    activeThreadId = threadId;

    // Find the thread to show the popover
    const thread = threads.find((t) => t.id === threadId);
    if (thread) {
      // Position popover near the click location
      popoverPosition = { x: event.clientX + 16, y: event.clientY };
      popoverThreadId = threadId;
    }
  }

  /**
   * Sync threads to the anchor plugin via meta-transaction.
   */
  function syncThreadsToPlugin(threadsToSync: Thread[]): void {
    const view = editorRef?.getView();
    if (!view) return;

    const fingerprint = createPluginSyncFingerprint(threadsToSync);

    // Skip if already synced
    if (fingerprint === lastSyncedFingerprint) return;
    lastSyncedFingerprint = fingerprint;

    view.dispatch(
      view.state.tr.setMeta(anchorPluginKey, {
        type: 'sync',
        threads: threadsToSync.map((thread) => ({
          ...thread,
          anchor: documentAnchorToBodyAnchor(thread.anchor, currentDocument.bodyOffset),
        })),
        source: 'external',
      }),
    );
  }

  /**
   * Attempt re-anchoring for pending state.
   * Called when setState is invoked and when editor content changes.
   *
   * Threads whose anchor text cannot be found are removed (auto-delete behavior).
   */
  function attemptReanchoring(): void {
    if (!pendingState) return;

    const view = editorRef?.getView();
    if (!view) return;

    // Compare markdown using contentEquals (handles normalization)
    const currentMarkdown = editorRef?.getMarkdown() ?? '';
    const pendingDocument = parseReviewEditorFrontMatter(pendingState.content);
    const expectedMarkdown = pendingDocument.body;

    if (!contentEquals(currentMarkdown, expectedMarkdown)) {
      // Content not synced yet - will retry when editor updates
      return;
    }

    const state = pendingState;
    pendingState = null;

    const { doc } = view.state;
    const documentText = doc.textBetween(0, doc.content.size, '\n');

    // Re-anchor threads, filtering out those that can't be found
    const reanchoredThreads: Thread[] = [];

    for (const persistedThread of state.threads) {
      const bodyPersistedAnchor = documentPersistedAnchorToBodyAnchor(
        persistedThread.anchor,
        pendingDocument.bodyOffset,
      );
      const result = reanchorQuote(documentText, bodyPersistedAnchor);

      // If anchor text not found, skip this thread (auto-delete)
      if (!result.found) {
        onthreaddelete?.({ threadId: persistedThread.id });
        continue;
      }

      const from = textOffsetToProseMirrorPosition(doc, result.from);
      const to = textOffsetToProseMirrorPosition(doc, result.to);

      if (from !== null && to !== null) {
        // Extract the matched quote and context from the current document
        // This prevents the plugin from detecting false drift on subsequent transactions
        const matchedQuote = documentText.slice(result.from, result.to);
        const newPrefix = documentText.slice(
          Math.max(0, result.from - ANCHOR_CONTEXT_LENGTH),
          result.from,
        );
        const newSuffix = documentText.slice(
          result.to,
          Math.min(documentText.length, result.to + ANCHOR_CONTEXT_LENGTH),
        );

        reanchoredThreads.push({
          ...persistedThread,
          anchor: {
            ...persistedThread.anchor,
            from: from + pendingDocument.bodyOffset,
            to: to + pendingDocument.bodyOffset,
            quote: matchedQuote,
            prefix: newPrefix,
            suffix: newSuffix,
            status: 'anchored',
            lastKnownOffset: result.from + pendingDocument.bodyOffset,
          },
        });
      }
    }

    threads = reanchoredThreads;

    // Sync threads to plugin
    syncThreadsToPlugin(threads);
  }

  // Retry re-anchoring when editor content changes (handles async content sync)
  // We read `value` to create a dependency so this effect re-runs when content changes.
  // This is critical for setState flow where pendingState exists but content isn't synced yet.
  $effect(() => {
    void value; // Create dependency on value
    if (pendingState && editorRef?.getView()) {
      attemptReanchoring();
    }
  });

  // Sync threads to plugin when they change externally
  // Runs for empty arrays too - needed to clear stale decorations when all threads removed
  $effect(() => {
    // Only sync if editor is ready and we don't have pending state
    if (editorRef?.getView() && !pendingState) {
      syncThreadsToPlugin(threads);
    }
  });

  // Determine if editor is readonly based on mode
  const isReadonly = $derived(mode === 'readonly');

  // Clear selection popover state when mode changes to readonly
  // This prevents stale popover state from persisting across mode transitions
  $effect(() => {
    if (mode === 'readonly') {
      selectionPopoverPosition = null;
      capturedSelectionForPopover = null;
      selectionPopoverExpanded = false;
    }
  });

  // =========================================================================
  // Optimized Change Detection (DEP-47)
  // =========================================================================

  /**
   * Change tracker with lazy dirty flag and debounced semantic verification.
   * Avoids per-keystroke normalize() calls which are expensive for large documents.
   */
  const changeTracker = createChangeTracker({
    debounceMs: 300,
    includeFrontMatter: true,
  });

  // Wire baseline and current values to the tracker
  $effect(() => {
    changeTracker.setBaseline(original);
  });

  $effect(() => {
    changeTracker.setCurrent(value);
  });

  /** Timeout ID for debounced selection position calculation */
  let selectionTimeoutId: ReturnType<typeof setTimeout> | null = null;

  /** Debounce delay for selection position calculation (ms) */
  const SELECTION_DEBOUNCE_MS = 20;

  // Listen to browser's native selectionchange event
  // This is more reliable than ProseMirror's selection events for detecting visual selection
  $effect(() => {
    if (typeof document === 'undefined') return;

    function handleBrowserSelectionChange() {
      // Clear any pending calculation
      if (selectionTimeoutId !== null) {
        clearTimeout(selectionTimeoutId);
        selectionTimeoutId = null;
      }

      // Only process in edit mode
      if (mode !== 'edit') {
        selectionPopoverPosition = null;
        capturedSelectionForPopover = null;
        return;
      }

      // Don't clear the popover if focus is within it (user is interacting with the form)
      const selectionPopoverElement = document.getElementById(`${id}-selection-popover`);
      if (selectionPopoverElement?.contains(document.activeElement)) {
        return;
      }

      // Don't clear the popover if it's expanded (user is composing a comment)
      // This is especially important for Safari where clicking a button doesn't focus it,
      // which would otherwise cause the popover to close unexpectedly
      if (selectionPopoverExpanded) {
        return;
      }

      const browserSelection = window.getSelection();

      // If selection is collapsed, hide popover immediately and reset all popover state
      if (!browserSelection || browserSelection.isCollapsed) {
        selectionPopoverPosition = null;
        capturedSelectionForPopover = null;
        selectionPopoverExpanded = false;
        return;
      }

      // Check if selection is within the actual editor DOM (not front matter controls,
      // sidebar, or toolbar content).
      const anchorNode = browserSelection.anchorNode;
      const editorDom = editorRef?.getView()?.dom;
      if (!editorDom || !anchorNode || !editorDom.contains(anchorNode)) {
        selectionPopoverPosition = null;
        capturedSelectionForPopover = null;
        selectionPopoverExpanded = false;
        return;
      }

      // Debounce position calculation to let rapid selection events settle
      selectionTimeoutId = setTimeout(() => {
        selectionTimeoutId = null;

        // Re-check selection after debounce
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) {
          selectionPopoverPosition = null;
          capturedSelectionForPopover = null;
          return;
        }

        // Get the selection range and compute position from the browser's DOM
        const range = sel.getRangeAt(0);
        const anchorPosition = getSelectionAnchorPosition(range);

        if (anchorPosition) {
          // Capture the ProseMirror selection range for thread creation
          // We need this because clicking the popover will collapse the selection
          // Get selection directly from the view since currentSelection state
          // may not be updated yet when the native selectionchange fires
          const view = editorRef?.getView();
          if (view) {
            const { from, to } = view.state.selection;
            if (from !== to) {
              capturedSelectionForPopover = { from, to };
              // Only show popover when we have a valid captured selection
              // This prevents showing a popover that can't submit due to timing mismatches
              selectionPopoverPosition = anchorPosition;
            }
          }
        }
      }, SELECTION_DEBOUNCE_MS);
    }

    document.addEventListener('selectionchange', handleBrowserSelectionChange);

    return () => {
      document.removeEventListener('selectionchange', handleBrowserSelectionChange);
      if (selectionTimeoutId !== null) {
        clearTimeout(selectionTimeoutId);
        selectionTimeoutId = null;
      }
    };
  });

  // Handle selection changes from ProseMirror (for currentSelection state)
  function handleSelectionChange(selection: EditorSelection | null) {
    // Mark editor as ready on first selection change (fired when editor initializes)
    if (!editorViewReady) {
      editorViewReady = true;
    }
    currentSelection = selection;
  }

  // Handle content changes
  function handleChange(newValue: string) {
    value = newValue;
    onchange?.(newValue);
  }

  function handleEditorBodyChange(newBody: string) {
    handleChange(combineFrontMatterAndBody(currentDocument, newBody));
  }

  function handleFrontMatterChange(data: Record<string, unknown> | null) {
    const previousBodyOffset = currentDocument.bodyOffset;
    const nextValue = replaceFrontMatterData(value, data);
    const nextDocument = parseReviewEditorFrontMatter(nextValue);

    if (previousBodyOffset !== nextDocument.bodyOffset) {
      threads = threads.map((thread) => ({
        ...thread,
        anchor: remapDocumentAnchorBodyOffset(
          thread.anchor,
          previousBodyOffset,
          nextDocument.bodyOffset,
          nextValue,
        ),
      }));
    }

    handleChange(nextValue);
  }

  // =========================================================================
  // Imperative Methods
  // =========================================================================

  /** Focus the editor */
  export function focus(): void {
    editorRef?.focus();
  }

  /** Get current markdown content */
  export function getMarkdown(): string {
    const body = editorRef?.getMarkdown() ?? currentDocument.body;
    return combineFrontMatterAndBody(currentDocument, body);
  }

  /** Set markdown content */
  export function setMarkdown(content: string): void {
    value = content;
    editorRef?.setMarkdown(parseReviewEditorFrontMatter(content).body);
  }

  /** Get current AST */
  export function getAst() {
    return editorRef?.getAst();
  }

  /** Get current selection */
  export function getSelection(): EditorSelection | null {
    const selection = editorRef?.getSelection();
    if (!selection) return null;
    return {
      ...selection,
      from: selection.from + currentDocument.bodyOffset,
      to: selection.to + currentDocument.bodyOffset,
    };
  }

  /** Scroll to a specific thread's anchor position in the editor */
  export function scrollToThread(threadId: string): void {
    const thread = threads.find((t) => t.id === threadId);
    if (!thread) return;

    const view = editorRef?.getView();
    if (view && thread.anchor.from !== undefined) {
      // Scroll the anchor position into view
      const coords = view.coordsAtPos(
        documentPositionToBodyPosition(thread.anchor.from, currentDocument.bodyOffset),
      );
      if (coords) {
        view.dom.scrollTo({
          top: coords.top - 100, // Offset from top
          behavior: getScrollBehavior(),
        });
      }
    }
  }

  /**
   * Handle thread selection from the comment sidebar.
   * Scrolls to the thread and opens its popover.
   */
  function handleSidebarThreadSelect(threadId: string): void {
    const thread = threads.find((t) => t.id === threadId);
    if (!thread) return;

    // Set active thread
    activeThreadId = threadId;

    // Scroll to the thread
    scrollToThread(threadId);

    // Open popover at anchor position after scroll completes
    setTimeout(() => {
      const view = editorRef?.getView();
      if (view && thread.anchor.from !== undefined) {
        const coords = view.coordsAtPos(
          documentPositionToBodyPosition(thread.anchor.from, currentDocument.bodyOffset),
        );
        if (coords) {
          popoverPosition = { x: coords.left + 16, y: coords.top };
          popoverThreadId = threadId;
        }
      }
    }, POSITION_DELAY_MS);
  }

  /**
   * Handle request to add a document-level comment from the sidebar.
   * The body is provided by the inline CommentComposer in the sidebar.
   */
  function handleAddDocumentComment(body: string): void {
    if (!currentUserId) {
      devWarn('Cannot add document comment: no currentUserId');
      return;
    }

    createDocumentThread(body, currentUserId);
  }

  /**
   * Get serializable review state.
   * Threads are converted to persisted format for re-anchoring.
   *
   * Content is preserved as the complete Markdown document, including front matter.
   */
  export function getState(): ReviewState {
    const persistedThreads: PersistedThread[] = threads.map((thread) => ({
      ...thread,
      anchor: {
        quote: thread.anchor.quote,
        prefix: thread.anchor.prefix,
        suffix: thread.anchor.suffix,
        status: thread.anchor.status,
        blockId: thread.anchor.blockId,
        originalPosition: thread.anchor.originalPosition,
        originalQuote: thread.anchor.originalQuote, // Preserve for history
        lastKnownOffset: thread.anchor.lastKnownOffset, // For disambiguation
      },
    }));

    return {
      schemaVersion: 4,
      content: value,
      original: original || undefined,
      threads: persistedThreads,
      reviewSession: undefined,
      frontMatter: currentDocument.data,
      frontMatterRaw: currentDocument.raw,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Restore review state from serialized data.
   * Thread anchors are re-anchored using the quote/prefix/suffix context.
   *
   * Note: This updates both content and original baseline from the incoming state,
   * ensuring subsequent diffs and exports use the correct baseline.
   */
  export function setState(state: ReviewState): void {
    const nextValue = reviewStateToMarkdown(state);
    value = nextValue;
    // Update original baseline if provided in state, so diffs work correctly
    if (state.original !== undefined) {
      original = state.original;
    }
    pendingState = { ...state, content: nextValue };

    // Attempt re-anchoring immediately if editor is ready
    attemptReanchoring();
  }

  /** Get direct access to ProseMirror view (advanced use) */
  export function getView() {
    return editorRef?.getView() ?? null;
  }

  /** Get direct access to Milkdown editor (advanced use) */
  export function getEditor() {
    return editorRef?.getEditor() ?? null;
  }

  // =========================================================================
  // Export Operations
  // =========================================================================

  /**
   * Export an LLM-optimized Markdown summary of the review.
   * Includes document changes and comment threads
   * in a structured format suitable for LLM analysis.
   */
  export function exportMarkdownSummary(options?: MarkdownSummaryOptions): MarkdownSummaryResult {
    return generateMarkdownSummary(getState(), options);
  }

  /**
   * Export a Git-compatible unified diff.
   * The output can be applied with `git apply` or `patch` command.
   */
  export function exportUnifiedDiff(options?: UnifiedDiffOptions): UnifiedDiffResult {
    return generateUnifiedDiff(getState(), options);
  }

  // =========================================================================
  // Export Action Callbacks (for ExportActions component)
  // =========================================================================

  /** Get plain markdown content for clipboard export */
  function handleExportContent(): string {
    return value;
  }

  /** Get LLM-optimized summary for clipboard export */
  function handleExportSummary(): string {
    return exportMarkdownSummary().markdown;
  }

  /** Get JSON state for clipboard export */
  function handleExportJSON(): string {
    const json = stringifyOrNull(getState());
    // Return error message if serialization fails (circular refs, BigInt, etc.)
    // This prevents copying invalid JSON like "[object Object]" to clipboard
    if (json === null) {
      return '{"error": "Failed to serialize editor state"}';
    }
    return json;
  }

  /** Get unified diff for clipboard export */
  function handleExportDiff(): string {
    return exportUnifiedDiff().diff;
  }

  /** Get comments export for clipboard export */
  function handleExportComments(): string {
    return generateCommentsExport(getState()).markdown;
  }

  // =========================================================================
  // Form Participation (FormData integration)
  // =========================================================================

  /**
   * Derive field name with optional prefix.
   * Used for hidden inputs when participating in a parent form.
   */
  function getFieldName(field: string): string {
    return name ? `${name}-${field}` : field;
  }

  /**
   * Derived values for hidden inputs (computed reactively).
   * These power both the hidden form inputs and the getFormData() method.
   */
  const formOriginal = $derived(original);
  const formCurrent = $derived(value);
  const formComments = $derived(JSON.stringify(threads));
  const formDiff = $derived(exportUnifiedDiff().diff);
  const formSummary = $derived(exportMarkdownSummary().markdown);

  /**
   * Get form data as a structured object.
   * Use this for programmatic access when not using native form submission.
   *
   * @example
   * ```ts
   * const data = editor.getFormData();
   * await fetch('/api/review', {
   *   method: 'POST',
   *   body: JSON.stringify(data)
   * });
   * ```
   */
  export function getFormData(): ReviewFormData {
    return {
      original: formOriginal,
      current: formCurrent,
      comments: formComments,
      diff: formDiff,
      summary: formSummary,
    };
  }

  /**
   * Reset the editor to its initial state.
   * Reverts content to original and clears all threads.
   */
  export function reset(): void {
    // Revert content
    value = original;
    onchange?.(original);

    // Clear all threads
    for (const thread of threads) {
      onthreaddelete?.({ threadId: thread.id });
    }

    // Clear UI state
    popoverThreadId = null;
    popoverPosition = null;
    activeThreadId = null;
    activeView = 'editor';
    selectionPopoverPosition = null;
    capturedSelectionForPopover = null;
    selectionPopoverExpanded = false;

    announce('Review reset');
  }

  // =========================================================================
  // Selection Popover Handlers
  // =========================================================================

  /**
   * Handle the comment submission from the selection popover.
   * Creates a new thread at the captured selection using currentUserId as author.
   *
   * We use capturedSelectionForPopover instead of currentSelection because
   * clicking the popover button collapses the browser selection before this runs.
   *
   * @param body - The comment body from the selection popover form
   */
  function handleSelectionComment(body: string): void {
    // Helper to clear popover state and announce failure
    function failWithMessage(message: string): void {
      devWarn(message);
      selectionPopoverPosition = null;
      capturedSelectionForPopover = null;
      selectionPopoverExpanded = false;
      announce('Could not add comment. Please try selecting text again.', 'assertive');
    }

    if (!currentUserId) {
      failWithMessage('Cannot create comment: no currentUserId set');
      return;
    }

    // Use captured selection - clicking the popover collapses browser selection
    if (!capturedSelectionForPopover) {
      failWithMessage('Cannot create comment: no captured selection');
      return;
    }

    if (mode === 'readonly') {
      failWithMessage('Cannot create thread: editor is readonly');
      return;
    }

    const view = editorRef?.getView();
    if (!view) {
      failWithMessage('Cannot create thread: editor view not available');
      return;
    }

    const { from, to } = capturedSelectionForPopover;

    // Validate positions are still within document bounds
    // User may have edited the document while popover was expanded
    const docSize = view.state.doc.content.size;
    if (from < 0 || to > docSize || from > to) {
      failWithMessage('Cannot create thread: captured selection is out of bounds');
      return;
    }

    // Build anchor using shared helper
    const anchor = bodyAnchorToDocumentAnchor(
      buildAnchorFromSelection(view, from, to),
      currentDocument.bodyOffset,
      value,
    );

    // Generate requestId for correlating optimistic updates
    const requestId = generateId();

    // Extract @mentions from the comment body
    const mentions = extractMentions(body);

    // Fire the create event with the comment body
    const event: ThreadCreateEvent = {
      requestId,
      anchor,
      body,
      authorId: currentUserId,
      mentions: mentions.length > 0 ? mentions : undefined,
    };
    onthreadcreate?.(event);

    // Clear state
    capturedSelectionForPopover = null;
    selectionPopoverPosition = null;
    selectionPopoverExpanded = false;

    announce('Comment added');
  }

  /**
   * Handle the selection popover expanding to show the comment form.
   * This keeps the popover visible even when the browser selection collapses.
   */
  function handleSelectionPopoverExpand(): void {
    selectionPopoverExpanded = true;
  }

  /**
   * Handle the selection popover cancel action.
   * Resets expanded state so new selections can be processed.
   */
  function handleSelectionPopoverCancel(): void {
    selectionPopoverExpanded = false;
    // Keep position and captured selection so user can re-expand if they want
  }

  /**
   * Close the selection popover.
   */
  function handleSelectionPopoverClose(): void {
    selectionPopoverPosition = null;
    capturedSelectionForPopover = null;
    selectionPopoverExpanded = false;
  }

  // =========================================================================
  // Thread Operations
  // =========================================================================

  /**
   * Create a new thread at the current selection.
   * Requires non-collapsed selection in edit or comment mode.
   *
   * Returns requestId for correlating with backend response, or null if creation failed.
   *
   * No-op (returns null) if:
   * - No text is selected (collapsed selection)
   * - Editor is in readonly mode
   * - Editor view is not available
   */
  export function createThread(body: string, authorId: string): string | null {
    if (!currentSelection || currentSelection.isCollapsed) {
      devWarn('Cannot create thread: no text selected');
      return null;
    }

    if (mode === 'readonly') {
      devWarn('Cannot create thread: editor is readonly');
      return null;
    }

    const view = editorRef?.getView();
    if (!view) {
      devWarn('Cannot create thread: editor view not available');
      return null;
    }

    const { from, to } = currentSelection;

    // Build anchor using shared helper
    const anchor = bodyAnchorToDocumentAnchor(
      buildAnchorFromSelection(view, from, to),
      currentDocument.bodyOffset,
      value,
    );

    // Extract mentions from comment body
    const mentions = extractMentions(body);

    // Generate requestId for correlating optimistic updates
    const requestId = generateId();

    // Fire the create event (parent handles actual thread creation)
    const event: ThreadCreateEvent = {
      requestId,
      anchor,
      body,
      authorId,
      mentions: mentions.length > 0 ? mentions : undefined,
    };
    onthreadcreate?.(event);

    announce('Comment added');
    return requestId;
  }

  /**
   * Create a document-level comment thread.
   *
   * Document-level comments are not anchored to specific text but apply to
   * the entire document. They appear at the top of the comment sidebar.
   *
   * Returns requestId for correlating with backend response, or null if creation failed.
   */
  export function createDocumentThread(body: string, authorId: string): string | null {
    if (mode === 'readonly') {
      devWarn('Cannot create thread: editor is readonly');
      return null;
    }

    // Create document-level anchor
    const anchor = createDocumentAnchor();

    // Extract mentions from comment body
    const mentions = extractMentions(body);

    // Generate requestId for correlating optimistic updates
    const requestId = generateId();

    // Fire the create event (parent handles actual thread creation)
    const event: ThreadCreateEvent = {
      requestId,
      anchor,
      body,
      authorId,
      mentions: mentions.length > 0 ? mentions : undefined,
    };
    onthreadcreate?.(event);

    announce('Document comment added');
    return requestId;
  }

  /**
   * Delete a thread.
   *
   * Silently returns without emitting an event if:
   * - Editor is in readonly mode (mode === 'readonly')
   * - Thread does not exist
   *
   * This silent no-op behavior supports declarative UI patterns where callers
   * don't need to pre-check conditions before calling mutation methods.
   */
  export function deleteThread(threadId: string): void {
    if (mode === 'readonly') return;

    const thread = threads.find((t) => t.id === threadId);
    if (!thread) return;

    onthreaddelete?.({ threadId });
  }

  /**
   * Delete all threads (clear all comments).
   *
   * Silently does nothing if:
   * - Editor is in readonly mode (mode === 'readonly')
   * - No threads exist
   *
   * Fires onthreaddelete for each thread.
   */
  export function clearAllThreads(): void {
    if (mode === 'readonly') return;
    if (threads.length === 0) return;

    // Fire delete event for each thread
    for (const thread of threads) {
      onthreaddelete?.({ threadId: thread.id });
    }

    // Clear any active selection state
    popoverThreadId = null;
    popoverPosition = null;
    activeThreadId = null;

    announce('All comments cleared');
  }

  // =========================================================================
  // Comment Operations
  // =========================================================================

  /**
   * Create a new comment in an existing thread.
   *
   * @returns requestId for correlating with backend response, or null if creation was blocked
   *
   * Silently returns null without emitting an event if:
   * - Editor is in readonly mode (mode === 'readonly')
   * - Thread does not exist
   *
   * This silent no-op behavior supports declarative UI patterns where callers
   * don't need to pre-check conditions before calling mutation methods.
   */
  export function createComment(threadId: string, body: string, authorId: string): string | null {
    if (mode === 'readonly') return null;

    const thread = threads.find((t) => t.id === threadId);
    if (!thread) return null;

    const mentions = extractMentions(body);
    const requestId = generateId();

    oncommentcreate?.({
      requestId,
      threadId,
      body,
      authorId,
      mentions: mentions.length > 0 ? mentions : undefined,
    });

    announce('Comment added');
    return requestId;
  }

  /**
   * Update an existing comment.
   *
   * Silently returns without emitting an event if:
   * - Editor is in readonly mode (mode === 'readonly')
   * - Thread or comment does not exist
   * - Comment is soft-deleted
   *
   * This silent no-op behavior supports declarative UI patterns where callers
   * don't need to pre-check conditions before calling mutation methods.
   */
  export function updateComment(threadId: string, commentId: string, body: string): void {
    if (mode === 'readonly') return;

    const thread = threads.find((t) => t.id === threadId);
    const comment = thread?.comments.find((c) => c.id === commentId);
    if (!comment || comment.deletedAt) return;

    const mentions = extractMentions(body);

    oncommentupdate?.({
      threadId,
      commentId,
      body,
      mentions: mentions.length > 0 ? mentions : undefined,
    });
  }

  /**
   * Delete a comment.
   *
   * Silently returns without emitting an event if:
   * - Editor is in readonly mode (mode === 'readonly')
   * - Thread or comment does not exist
   * - Soft delete is requested but comment is already soft-deleted
   *
   * This silent no-op behavior supports declarative UI patterns where callers
   * don't need to pre-check conditions before calling mutation methods.
   *
   * @param soft - If true (default), sets deletedAt for soft delete. If false, requests hard delete.
   */
  export function deleteComment(threadId: string, commentId: string, soft: boolean = true): void {
    if (mode === 'readonly') return;

    const thread = threads.find((t) => t.id === threadId);
    const comment = thread?.comments.find((c) => c.id === commentId);
    if (!comment || (soft && comment.deletedAt)) return;

    oncommentdelete?.({ threadId, commentId, soft });
    announce('Comment deleted');
  }

  // =========================================================================
  // Block-Level Thread Creation
  // =========================================================================

  /**
   * Create a thread anchored to the block containing the cursor.
   * Works even with a collapsed selection (no text selected).
   *
   * Returns requestId for correlating with backend response, or null if creation failed.
   *
   * No-op (returns null) if:
   * - Editor is in readonly mode
   * - Editor view is not available
   * - Cursor is not inside a block
   */
  export function createBlockThread(body: string, authorId: string): string | null {
    if (mode === 'readonly') {
      devWarn('Cannot create block thread: editor is readonly');
      return null;
    }

    const view = editorRef?.getView();
    if (!view) {
      devWarn('Cannot create block thread: editor view not available');
      return null;
    }

    const { from } = view.state.selection;
    const resolvedPos = view.state.doc.resolve(from);

    // Find the nearest block-level node
    for (let depth = resolvedPos.depth; depth > 0; depth--) {
      const node = resolvedPos.node(depth);
      if (!node.isBlock) continue;

      // Get the block's inner positions (content bounds)
      const blockFrom = resolvedPos.start(depth);
      const blockTo = resolvedPos.end(depth);

      // Build anchor for the entire block
      const anchor = bodyAnchorToDocumentAnchor(
        buildAnchorFromSelection(view, blockFrom, blockTo),
        currentDocument.bodyOffset,
        value,
      );

      // Extract mentions and generate requestId
      const mentions = extractMentions(body);
      const requestId = generateId();

      // Fire the create event
      onthreadcreate?.({
        requestId,
        anchor,
        body,
        authorId,
        mentions: mentions.length > 0 ? mentions : undefined,
      });

      return requestId;
    }

    devWarn('Cannot create block thread: cursor not inside a block');
    return null;
  }

  // =========================================================================
  // Keyboard Navigation (F6 Landmark Navigation)
  // =========================================================================

  /**
   * Focus regions for F6 navigation.
   * The 'popover' region is conditionally included when a thread popover is open.
   */
  const focusRegions: FocusRegion[] = [
    { id: 'editor', selector: '.review-editor-main', label: 'Editor' },
    { id: 'popover', selector: '.thread-popover', label: 'Thread' },
  ];

  /**
   * Focus region navigator with conditional popover inclusion and custom editor focus.
   */
  const focusNavigator = createFocusRegionNavigator(focusRegions, {
    // Only include popover region when a thread popover is actually open
    isRegionActive: (region) => {
      if (region.id === 'popover') {
        return popoverThread !== null;
      }
      return true;
    },
    // Custom focus handler for the editor region (ProseMirror needs special handling)
    customFocusHandler: (region) => {
      if (region.id === 'editor') {
        editorRef?.getView()?.focus();
        return true; // Handled
      }
      return false; // Use default behavior
    },
  });

  /**
   * Handle F6 keyboard navigation between regions.
   * Uses event.currentTarget to scope navigation to this specific editor instance,
   * supporting multiple ReviewEditor instances on the same page.
   */
  function handleContainerKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'F6') return;

    // Use currentTarget (the element with the listener) to get this specific editor container
    const container = event.currentTarget;
    if (!(container instanceof HTMLElement)) return;

    event.preventDefault();
    const current = focusNavigator.getCurrentRegion(container);
    const next = focusNavigator.getNextRegion(current, event.shiftKey);
    focusNavigator.focusRegion(container, next);
  }
</script>

<!-- Export actions snippet for passing to controls -->
{#snippet exportActionsSnippet()}
  <ExportActions
    id="{id}-export"
    onexportcontent={handleExportContent}
    onexportsummary={handleExportSummary}
    onexportjson={handleExportJSON}
    onexportdiff={handleExportDiff}
    onexportcomments={handleExportComments}
  />
{/snippet}

<!--
  The a11y_no_static_element_interactions ignore is intentional:
  F6 landmark navigation requires a container-level keydown listener to cycle
  focus between editor/popover regions. The container itself is not
  interactive; it only captures keyboard events for region-level focus management.
-->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  bind:this={containerElement}
  data-testid="review-editor"
  class={classNames('review-editor-container', className)}
  data-mode={mode}
  data-view={activeView}
  data-ready={editorViewReady && !pendingState ? true : undefined}
  data-snapshot-mode={snapshotMode || undefined}
  onkeydown={handleContainerKeyDown}
>
  <!-- Screen reader announcements (DEP-47) -->
  <LiveRegion bind:this={liveRegionRef} />

  <!-- Hidden form inputs for FormData participation -->
  {#if name}
    <input type="hidden" name={getFieldName('original')} value={formOriginal} />
    <input type="hidden" name={getFieldName('current')} value={formCurrent} />
    <input type="hidden" name={getFieldName('comments')} value={formComments} />
    <input type="hidden" name={getFieldName('diff')} value={formDiff} />
    <input type="hidden" name={getFieldName('summary')} value={formSummary} />
  {/if}

  <!-- Unified controls bar - consistent across all views -->
  <ReviewEditorControls
    id="{id}-controls"
    {activeView}
    {viewPanelIds}
    onViewChange={(view) => {
      // Clear selection popover state when leaving editor view
      // Otherwise stale expanded state blocks new selections when returning
      if (view !== 'editor') {
        selectionPopoverPosition = null;
        capturedSelectionForPopover = null;
        selectionPopoverExpanded = false;
      }
      activeView = view;
      announce(`Switched to ${view} view`);
    }}
    showDiffTabs={!!original}
    {diffStats}
    bind:diffViewMode
    {hasContentChanges}
    readonly={isReadonly}
    onRevertAll={() => {
      value = original;
      onchange?.(original);
      announce('All changes reverted');
    }}
    {commentCount}
    {sidebarOpen}
    onSidebarToggle={() => (sidebarOpen = !sidebarOpen)}
    trailing={exportActionsSnippet}
  />

  <!-- Main content area -->
  <div class="review-editor-main">
    {#if activeView === 'editor'}
      <!-- Editor view: formatting toolbar + editor content -->
      <div
        id={viewPanelIds.editor}
        class="review-editor-view-panel"
        role="tabpanel"
        aria-label="Editor view"
      >
        {#if currentDocument.hasFrontMatter}
          <FrontMatterFields
            id={`${id}-front-matter`}
            data={currentDocument.data}
            raw={currentDocument.raw}
            readonly={isReadonly}
            onchange={handleFrontMatterChange}
          />
        {/if}
        <MarkdownEditor
          {id}
          bind:this={editorRef}
          value={editorValue}
          mode="wysiwyg"
          readonly={isReadonly}
          {placeholder}
          plugins={[anchorPlugin]}
          {snapshotMode}
          onchange={handleEditorBodyChange}
          onready={() => {
            if (!editorViewReady) {
              editorViewReady = true;
            }
          }}
          onselectionchange={handleSelectionChange}
        />
      </div>
    {:else if activeView === 'diff'}
      <!-- Diff view content -->
      <div
        id={viewPanelIds.diff}
        class="review-editor-view-panel"
        role="tabpanel"
        aria-label="Diff view"
      >
        <DiffViewer {original} current={value} bind:viewMode={diffViewMode} readonly={isReadonly}>
          {#snippet toolbar()}
            <!-- Empty toolbar - controls are in the unified bar above -->
          {/snippet}
        </DiffViewer>
      </div>
    {:else}
      <!-- Summary view (auto-generated, readonly preview) -->
      <div
        id={viewPanelIds.summary}
        class="review-editor-view-panel"
        role="tabpanel"
        aria-label="Summary view"
      >
        {#if hasContentChanges || threads.length > 0}
          <MarkdownEditor
            id="{id}-summary"
            value={summaryContent}
            mode="wysiwyg"
            readonly
            showToolbar={false}
            placeholder=""
          />
        {:else}
          <div class="summary-view" role="region" aria-label="Review summary">
            <div class="summary-empty">
              <p>No changes or comments to summarize.</p>
              <p class="summary-hint">Edit the document or add comments to generate a summary.</p>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Comment sidebar -->
  {#if sidebarOpen}
    <CommentSidebar
      id="{id}-sidebar"
      {threads}
      {activeThreadId}
      readonly={isReadonly}
      onthreadselect={handleSidebarThreadSelect}
      onclearall={clearAllThreads}
      onadddocumentcomment={handleAddDocumentComment}
    />
  {/if}

  <!-- Thread popover -->
  {#if popoverThread && popoverPosition}
    <ThreadPopover
      id="{id}-thread-popover"
      thread={popoverThread}
      {currentUserId}
      {mode}
      position={popoverPosition}
      onclose={handlePopoverClose}
      ondelete={handlePopoverDelete}
      oncommentcreate={handlePopoverCommentCreate}
      oncommentupdate={handlePopoverCommentUpdate}
      oncommentdelete={handlePopoverCommentDelete}
    />
  {/if}

  <!-- Selection popover for quick comment creation -->
  {#if showSelectionPopover}
    <SelectionPopover
      id="{id}-selection-popover"
      position={selectionPopoverPosition}
      open={showSelectionPopover}
      oncommentsubmit={handleSelectionComment}
      onexpand={handleSelectionPopoverExpand}
      oncancel={handleSelectionPopoverCancel}
      onclose={handleSelectionPopoverClose}
    />
  {/if}
</div>

<style>
  /*
   * Reset outer border/radius/overflow on the markdown-editor-wrapper when
   * nested inside review-editor-main (.review-editor-main provides the outer shape).
   *
   * :global() is required because .markdown-editor-wrapper is rendered by
   * MarkdownEditor (a child component) and would not match a scoped selector.
   */
  :global(.review-editor-container .review-editor-main .markdown-editor-wrapper) {
    border: none;
    border-radius: 0;
    overflow: visible;
  }

  .review-editor-view-panel {
    min-width: 0;
  }

  /*
   * Snapshot mode: suppress the blinking caret and text selection highlights
   * so visual regression screenshots are pixel-stable across runs.
   * Scoped to [data-snapshot-mode] so normal editing is completely unaffected.
   */
  .review-editor-container[data-snapshot-mode],
  .review-editor-container[data-snapshot-mode] * {
    caret-color: transparent;
    user-select: none;
  }
</style>

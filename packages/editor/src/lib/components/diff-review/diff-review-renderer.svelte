<script lang="ts" module>
  export type {
    DiffReviewRendererFocusResult,
    DiffReviewRendererProps,
    DiffReviewRendererRef,
  } from './diff-review-renderer.types.ts';
</script>

<script lang="ts">
  import { SourceDiffViewer } from '@lostgradient/cinder';
  import type {
    SourceDiffAnnotationSelection,
    SourceDiffFileAnnotationContext,
    SourceDiffLineAnnotationContext,
    SourceDiffViewerRef,
  } from '@lostgradient/cinder';

  import type { DiffReviewRangeAnchor } from '../../diff-review-state/index.ts';
  import DiffViewer from '../diff-viewer/diff-viewer.svelte';
  import type {
    DiffViewerAnnotationSelection,
    DiffViewerFrontMatterAnnotationContext,
    DiffViewerLineAnnotationContext,
    DiffViewerRef,
  } from '../diff-viewer/diff-viewer.types.ts';
  import {
    diffViewerSelectionToAnchor,
    sourceDiffSelectionToAnchor,
  } from './diff-review-annotation-bridge.ts';
  import { getDiffReviewFileChangedLineCount } from './diff-review-file-entries.ts';
  import {
    buildDiffReviewCurrentLineMarkerKeys,
    hasDiffReviewCurrentFileMarker,
    hasDiffReviewCurrentLineMarker,
  } from './diff-review-inline-markers.ts';
  import type {
    DiffReviewRendererFocusResult,
    DiffReviewRendererProps,
    DiffReviewRendererRef,
  } from './diff-review-renderer.types.ts';

  // Destructured as `reviewState` (not `state`): Svelte's `$state` rune is
  // parsed as the legacy `$identifier` auto-subscription form whenever a
  // variable literally named `state` is in scope, which breaks every
  // `$state(...)` call below (see `DiffReviewComments`' identical note).
  let {
    target,
    state: reviewState,
    selectedFileOccurrence,
    readonly = false,
    resetToken,
    onSelectionChange,
    onRendererFailedChange,
    ref = $bindable<DiffReviewRendererRef | undefined>(),
  }: DiffReviewRendererProps = $props();

  let markdownSelection = $state<DiffViewerAnnotationSelection | null>(null);
  let sourceSelection = $state<SourceDiffAnnotationSelection | null>(null);
  let diffViewerRef = $state<DiffViewerRef | undefined>(undefined);
  let sourceDiffViewerRef = $state<SourceDiffViewerRef | undefined>(undefined);
  /**
   * The targetId a render failure was reported for, or `null`. Compared
   * against the CURRENT target (below) rather than reset by a target-change
   * effect: `<svelte:boundary>` never re-attempts its children once failed,
   * so switching back to a working target only recovers because the
   * `{#key target?.targetId}` around it below remounts a fresh boundary --
   * an effect racing that remount to clear a flag would be redundant at
   * best and, ordered the other way, would clobber a same-tick failure back
   * to `false`.
   */
  let failedTargetId = $state<string | null>(null);
  const rendererFailed = $derived(target !== undefined && failedTargetId === target.targetId);

  $effect(() => {
    // Referencing resetToken makes this effect re-run whenever the parent
    // asks the renderer to drop its in-progress selection.
    void resetToken;
    markdownSelection = null;
    sourceSelection = null;
  });

  $effect(() => {
    onRendererFailedChange?.(rendererFailed);
  });

  function handleMarkdownSelectionChange(selection: DiffViewerAnnotationSelection | null): void {
    markdownSelection = selection;
    onSelectionChange(selection ? diffViewerSelectionToAnchor(selection) : null);
  }

  function handleSourceSelectionChange(selection: SourceDiffAnnotationSelection | null): void {
    sourceSelection = selection;
    onSelectionChange(selection ? sourceDiffSelectionToAnchor(selection) : null);
  }

  const currentLineMarkerKeys = $derived(buildDiffReviewCurrentLineMarkerKeys(reviewState));

  function isLineCommentCurrent(
    fileOccurrence: number,
    side: 'old' | 'new',
    line: number,
  ): boolean {
    if (!target) return false;
    return hasDiffReviewCurrentLineMarker(
      currentLineMarkerKeys,
      target.targetId,
      fileOccurrence,
      side,
      line,
    );
  }

  function isFileCommentCurrent(fileOccurrence: number): boolean {
    if (!target) return false;
    return hasDiffReviewCurrentFileMarker(reviewState, target.targetId, fileOccurrence);
  }

  /**
   * "No commentable patch lines" (COR-509 / DR-6) applies once a specific
   * file is targeted (a Markdown target always is; a source target only
   * once a file is selected out of a multi-file patch) and that file has no
   * added/removed/modified lines at all. Wrapped defensively: a target
   * whose shape survived `set-targets`' shallow validation can still fail
   * to parse (the same class of problem the render boundary below guards
   * against), and this must never throw outside of it.
   */
  const changedLineCount = $derived.by((): number | null => {
    if (!target) return null;
    const fileOccurrence = target.kind === 'markdown' ? 0 : selectedFileOccurrence;
    if (fileOccurrence === null) return null;
    try {
      return getDiffReviewFileChangedLineCount(target, fileOccurrence);
    } catch {
      return null;
    }
  });
  const noCommentableLines = $derived(changedLineCount === 0);

  function focusAnchor(
    anchor: Pick<DiffReviewRangeAnchor, 'fileOccurrence' | 'hunkOccurrence' | 'side' | 'startLine'>,
  ): DiffReviewRendererFocusResult {
    if (target?.kind === 'markdown') {
      return (
        diffViewerRef?.focusAnchor({ side: anchor.side, startLine: anchor.startLine }) ?? {
          status: 'unavailable',
        }
      );
    }
    if (target?.kind === 'source') {
      return sourceDiffViewerRef?.focusAnchor(anchor) ?? { status: 'unavailable' };
    }
    return { status: 'unavailable' };
  }

  function focusFile(fileOccurrence: number): DiffReviewRendererFocusResult {
    // A Markdown target is one continuous document with no per-file header
    // through `DiffViewer`'s public surface -- there is nothing to focus.
    if (target?.kind !== 'source') return { status: 'unavailable' };
    return sourceDiffViewerRef?.focusFile(fileOccurrence) ?? { status: 'unavailable' };
  }

  const rendererRef: DiffReviewRendererRef = { focusAnchor, focusFile };

  $effect(() => {
    ref = rendererRef;
    return () => {
      ref = undefined;
    };
  });
</script>

{#snippet markdownLineAnnotation({ side, line }: DiffViewerLineAnnotationContext)}
  {#if isLineCommentCurrent(0, side, line)}
    <span
      class="diff-review-inline-marker"
      data-diff-review-inline-marker
      data-side={side}
      data-line={line}
      data-file="0"
      title="Has a saved comment"
    >
      &#128172;
    </span>
  {/if}
{/snippet}

{#snippet markdownFileAnnotation(_context: DiffViewerFrontMatterAnnotationContext)}
  {#if isFileCommentCurrent(0)}
    <span
      class="diff-review-inline-marker"
      data-diff-review-inline-marker
      data-file="0"
      title="Has a saved comment"
    >
      &#128172;
    </span>
  {/if}
{/snippet}

{#snippet sourceLineAnnotation({ fileOccurrence, side, line }: SourceDiffLineAnnotationContext)}
  {@const lineNumber = side === 'old' ? line.oldLineNumber : line.newLineNumber}
  {#if lineNumber !== null && isLineCommentCurrent(fileOccurrence, side, lineNumber)}
    <span
      class="diff-review-inline-marker"
      data-diff-review-inline-marker
      data-side={side}
      data-line={lineNumber}
      data-file={fileOccurrence}
      title="Has a saved comment"
    >
      &#128172;
    </span>
  {/if}
{/snippet}

{#snippet sourceFileAnnotation({ descriptor }: SourceDiffFileAnnotationContext)}
  {#if isFileCommentCurrent(descriptor.fileOccurrence)}
    <span
      class="diff-review-inline-marker"
      data-diff-review-inline-marker
      data-file={descriptor.fileOccurrence}
      title="Has a saved comment"
    >
      &#128172;
    </span>
  {/if}
{/snippet}

{#snippet renderFailed()}
  <p class="diff-review-renderer-error" role="alert">
    This diff couldn't be rendered. Its own file comment and other files remain available; export is
    unaffected.
  </p>
{/snippet}

{#if target === undefined}
  <p class="diff-review-renderer-empty">No file selected.</p>
{:else if noCommentableLines}
  <p class="diff-review-renderer-empty">No commentable patch lines.</p>
{:else}
  {#key target.targetId}
    <!--
      `<svelte:boundary>` never re-attempts its children once one throws --
      only remounting it (this `{#key}`, keyed by targetId) gives a
      *different* target's viewer a fresh chance to render after a prior
      target failed. A boundary without this key would keep showing the
      first target's error forever, breaking "other targets still work."
    -->
    <svelte:boundary onerror={() => (failedTargetId = target.targetId)}>
      {#if target.kind === 'markdown'}
        <DiffViewer
          original={target.original}
          current={target.current}
          normalizeInputs={target.normalizeInputs}
          readonly
          annotationSelection={markdownSelection}
          lineAnnotation={markdownLineAnnotation}
          fileAnnotation={markdownFileAnnotation}
          bind:ref={diffViewerRef}
          {...readonly ? {} : { onAnnotationSelectionChange: handleMarkdownSelectionChange }}
        />
      {:else}
        <SourceDiffViewer
          patch={target.patch}
          activeFileOccurrence={selectedFileOccurrence}
          annotationSelection={sourceSelection}
          lineAnnotation={sourceLineAnnotation}
          fileAnnotation={sourceFileAnnotation}
          bind:ref={sourceDiffViewerRef}
          {...readonly ? {} : { onAnnotationSelectionChange: handleSourceSelectionChange }}
        />
      {/if}
      {#snippet failed()}
        {@render renderFailed()}
      {/snippet}
    </svelte:boundary>
  {/key}
{/if}

<style>
  .diff-review-inline-marker {
    display: inline-block;
    font-size: var(--cinder-text-xs, 0.75rem);
  }

  .diff-review-renderer-error {
    color: var(--cinder-status-danger-solid, #b42318);
  }
</style>

<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status beta
   * @purpose Lightweight unified-patch viewer for source-code and operational diffs with file headers, hunk headers, line state styling, and bounded rendering.
   * @tag diff
   * @tag source
   * @tag code
   * @useWhen Rendering source-code unified patches from agent output, Git operations, workspace changes, or review systems.
   * @useWhen Showing operational patch output where file and hunk structure matters more than Markdown front matter or word-level prose review.
   * @avoidWhen Comparing two Markdown documents with normalization, front-matter, and revert affordances — use `DiffViewer` from `@lostgradient/editor`.
   * @avoidWhen Showing syntax-highlighted code samples rather than patch output. | code-block
   * @related diff-statistics, code-block
   */
  export type {
    SourceDiffAnnotationSelection,
    SourceDiffAnnotationSide,
    SourceDiffFile,
    SourceDiffFileAnnotationContext,
    SourceDiffFileDescriptor,
    SourceDiffHunk,
    SourceDiffLine,
    SourceDiffLineAnnotationContext,
    SourceDiffLineKind,
    SourceDiffParseResult,
    SourceDiffViewerFocusResult,
    SourceDiffViewerProps,
    SourceDiffViewerRef,
  } from './source-diff-viewer.types.ts';
  export { getSourceDiffFileLabel, getSourceDiffLineLabel } from './source-diff-viewer.labels.ts';
  export { parseUnifiedPatch } from './source-diff-viewer.utilities.ts';
</script>

<script lang="ts">
  import { flushSync, untrack } from 'svelte';

  import { classNames } from '../../utilities/class-names.ts';
  import {
    buildLineSelection,
    commentableSidesForLine,
    extendLineSelection,
    type SourceDiffAnnotationPoint,
  } from './source-diff-viewer.annotation.ts';
  import { getSourceDiffFileLabel, getSourceDiffLineLabel } from './source-diff-viewer.labels.ts';
  import { parseUnifiedPatch } from './source-diff-viewer.utilities.ts';
  import type {
    SourceDiffAnnotationSelection,
    SourceDiffAnnotationSide,
    SourceDiffFile,
    SourceDiffHunk,
    SourceDiffLine,
    SourceDiffViewerFocusResult,
    SourceDiffViewerProps,
    SourceDiffViewerRef,
  } from './source-diff-viewer.types.ts';

  let {
    patch,
    ariaLabel,
    'aria-label': nativeAriaLabel,
    'aria-labelledby': nativeAriaLabelledBy,
    maxLines = 1000,
    lineNumbers = true,
    empty,
    class: className,
    onFilesChange,
    activeFileOccurrence,
    fileAnnotation,
    lineAnnotation,
    annotationSelection,
    onAnnotationSelectionChange,
    ref = $bindable<SourceDiffViewerRef | undefined>(),
    ...rest
  }: SourceDiffViewerProps = $props();

  const baseId = $props.id();
  const annotationEnabled = $derived(Boolean(onAnnotationSelectionChange));

  let rootElement: HTMLDivElement | undefined = $state();
  let annotationOrigin: SourceDiffAnnotationPoint | null = $state(null);
  let annotationPendingEnd: SourceDiffAnnotationPoint | null = $state(null);
  let annotationRejectionMessage: string | null = $state(null);
  // Compared by VALUE (via `selectionsEqual` below), not reactively and never
  // by reference: lets the controlled-prop sync effect tell "the host echoed
  // exactly what we just emitted" (ignore — our own `annotationOrigin` is
  // already correct, including for a backward shift-click range whose
  // `startLine` is not the true origin) apart from "the host supplied a
  // genuinely different selection" (e.g. DiffReview navigating to another
  // comment — resync origin to it). Reference equality would fail here even
  // for a true echo: a host that stores the emitted selection in `$state`
  // (the ordinary Svelte 5 controlled-prop pattern) gets back a new reactive
  // proxy wrapping the same values, never the exact object this component
  // passed to `onAnnotationSelectionChange`.
  let lastEmittedSelection: SourceDiffAnnotationSelection | null = null;

  const parsedPatch = $derived(parseUnifiedPatch(patch, { maxLines }));
  const hasPatchContent = $derived(parsedPatch.files.length > 0 || parsedPatch.totalLineCount > 0);
  const normalizedAriaLabelledBy = $derived(normalizeAriaLabel(nativeAriaLabelledBy));
  const normalizedAriaLabel = $derived(
    normalizedAriaLabelledBy
      ? undefined
      : (normalizeAriaLabel(ariaLabel) ?? normalizeAriaLabel(nativeAriaLabel) ?? 'Source diff'),
  );
  const visibleFiles = $derived(
    activeFileOccurrence == null
      ? parsedPatch.files
      : parsedPatch.files.filter((file) => file.fileOccurrence === activeFileOccurrence),
  );
  const activeDescriptor = $derived(
    activeFileOccurrence == null
      ? null
      : (parsedPatch.descriptors.find((d) => d.fileOccurrence === activeFileOccurrence) ?? null),
  );
  const showTruncatedActiveFile = $derived(
    activeFileOccurrence != null && visibleFiles.length === 0 && activeDescriptor !== null,
  );

  $effect(() => {
    const descriptors = parsedPatch.descriptors;
    untrack(() => {
      onFilesChange?.(descriptors);
    });
  });

  $effect(() => {
    if (
      annotationSelection === undefined ||
      selectionsEqual(annotationSelection, lastEmittedSelection)
    )
      return;

    if (annotationSelection === null) {
      annotationOrigin = null;
      annotationPendingEnd = null;
      annotationRejectionMessage = null;
      return;
    }

    // A genuinely external selection (not our own echoed emission): treat it
    // as the new origin, so the next shift-click/keyboard-extend continues
    // from what the host is now controlling rather than a stale one.
    annotationOrigin = {
      fileOccurrence: annotationSelection.fileOccurrence,
      hunkOccurrence: annotationSelection.hunkOccurrence,
      side: annotationSelection.side,
      line: annotationSelection.startLine,
    };
    annotationPendingEnd = null;
    annotationRejectionMessage = null;
    lastEmittedSelection = annotationSelection;
  });

  function getSourceDiffLineText(line: SourceDiffLine): string {
    if (line.kind === 'metadata')
      return line.metadataPrefix ? `${line.metadataPrefix} ${line.content}` : line.content;
    const prefix = line.kind === 'addition' ? '+' : line.kind === 'removal' ? '-' : ' ';
    return `${prefix}${line.content}`;
  }

  function normalizeAriaLabel(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  function contextLinesEqual(a: readonly string[], b: readonly string[]): boolean {
    return a.length === b.length && a.every((value, index) => value === b[index]);
  }

  /**
   * Structural equality for two annotation selections. Used instead of `===`
   * to recognize a controlled-prop echo of our own emission even when the
   * host round-tripped it through `$state` (see `lastEmittedSelection`
   * above), which wraps the value in a new reactive proxy.
   */
  function selectionsEqual(
    a: SourceDiffAnnotationSelection | null | undefined,
    b: SourceDiffAnnotationSelection | null | undefined,
  ): boolean {
    // Never compare `a === b` directly: one side may be a `$state` proxy and
    // the other the plain object it wraps (see `lastEmittedSelection` above).
    // Svelte's dev build warns on exactly that comparison
    // (`state_proxy_equality_mismatch`), so every field is compared instead.
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;
    return (
      a.fileOccurrence === b.fileOccurrence &&
      a.hunkOccurrence === b.hunkOccurrence &&
      a.side === b.side &&
      a.startLine === b.startLine &&
      a.endLine === b.endLine &&
      a.coordinateSpace === b.coordinateSpace &&
      a.selectedText === b.selectedText &&
      a.oldPath === b.oldPath &&
      a.newPath === b.newPath &&
      contextLinesEqual(a.contextBefore, b.contextBefore) &&
      contextLinesEqual(a.contextAfter, b.contextAfter)
    );
  }

  function controlId(point: SourceDiffAnnotationPoint): string {
    return `${baseId}-annotation-${point.fileOccurrence}-${point.hunkOccurrence}-${point.side}-${point.line}`;
  }

  function focusControl(point: SourceDiffAnnotationPoint): void {
    rootElement?.querySelector<HTMLElement>(`#${CSS.escape(controlId(point))}`)?.focus();
  }

  function emitSelection(selection: SourceDiffAnnotationSelection): void {
    lastEmittedSelection = selection;
    onAnnotationSelectionChange?.(selection);
  }

  function commitSelection(
    file: SourceDiffFile,
    hunk: SourceDiffHunk,
    origin: SourceDiffAnnotationPoint,
    target: SourceDiffAnnotationPoint,
  ): void {
    const result = extendLineSelection(file, hunk, origin, target);
    if (!result.ok) {
      annotationRejectionMessage = result.message;
      return;
    }
    annotationRejectionMessage = null;
    emitSelection(result.selection);
  }

  function handleControlClick(
    file: SourceDiffFile,
    hunk: SourceDiffHunk,
    point: SourceDiffAnnotationPoint,
    event: MouseEvent,
  ): void {
    if (event.shiftKey && annotationOrigin) {
      commitSelection(file, hunk, annotationOrigin, point);
      annotationPendingEnd = null;
      return;
    }

    const selection = buildLineSelection(file, hunk, point.side, point.line);
    if (!selection) return;
    annotationOrigin = point;
    annotationPendingEnd = null;
    annotationRejectionMessage = null;
    emitSelection(selection);
  }

  function handleControlKeydown(
    file: SourceDiffFile,
    hunk: SourceDiffHunk,
    point: SourceDiffAnnotationPoint,
    event: KeyboardEvent,
  ): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (annotationOrigin && annotationPendingEnd) {
        commitSelection(file, hunk, annotationOrigin, annotationPendingEnd);
        annotationPendingEnd = null;
        return;
      }
      annotationOrigin = point;
      annotationPendingEnd = point;
      annotationRejectionMessage = null;
      return;
    }

    if (event.key === 'Escape' && annotationPendingEnd && annotationOrigin) {
      event.preventDefault();
      annotationPendingEnd = null;
      annotationRejectionMessage = null;
      focusControl(annotationOrigin);
      return;
    }

    if (
      event.shiftKey &&
      annotationOrigin &&
      annotationPendingEnd &&
      (event.key === 'ArrowDown' || event.key === 'ArrowUp')
    ) {
      event.preventDefault();
      const candidate: SourceDiffAnnotationPoint = {
        ...annotationPendingEnd,
        line: annotationPendingEnd.line + (event.key === 'ArrowDown' ? 1 : -1),
      };
      const result = extendLineSelection(file, hunk, annotationOrigin, candidate);
      if (!result.ok) {
        annotationRejectionMessage = result.message;
        return;
      }
      annotationRejectionMessage = null;
      annotationPendingEnd = candidate;
      focusControl(candidate);
    }
  }

  /**
   * Forces any pending reactive update (e.g. a controlled `activeFileOccurrence`
   * change made in the same host event handler as this call) to apply before
   * `focusFile`/`focusAnchor` query the DOM. Both methods are synchronous and
   * return their result immediately, so a host cannot `await tick()` between
   * "change what's rendered" and "focus it" — without this, the query below
   * would still see the pre-update DOM.
   */
  function flushPendingUpdates(): void {
    try {
      flushSync();
    } catch {
      // Already inside a synchronous flush (e.g. called from an `$effect`):
      // the DOM is already current, so there is nothing to force.
    }
  }

  function focusFile(fileOccurrence: number): SourceDiffViewerFocusResult {
    flushPendingUpdates();
    const header = rootElement?.querySelector<HTMLElement>(
      `[data-cinder-file-header][data-cinder-file-occurrence="${fileOccurrence}"]`,
    );
    if (!header) return { status: 'unavailable' };
    header.focus();
    return { status: 'focused' };
  }

  function focusAnchor(
    anchor: Pick<SourceDiffAnnotationPoint, 'fileOccurrence' | 'hunkOccurrence' | 'side'> & {
      startLine: number;
    },
  ): SourceDiffViewerFocusResult {
    flushPendingUpdates();
    const control = rootElement?.querySelector<HTMLElement>(
      `#${CSS.escape(
        controlId({
          fileOccurrence: anchor.fileOccurrence,
          hunkOccurrence: anchor.hunkOccurrence,
          side: anchor.side,
          line: anchor.startLine,
        }),
      )}`,
    );
    if (!control) return { status: 'unavailable' };
    control.focus();
    return { status: 'focused' };
  }

  const viewerRef: SourceDiffViewerRef = { focusFile, focusAnchor };

  $effect(() => {
    ref = viewerRef;
    return () => {
      ref = undefined;
    };
  });

  function annotationControlLabel(side: SourceDiffAnnotationSide, lineNumber: number): string {
    return `Add comment on ${side === 'old' ? 'removed' : 'added or unchanged'} line ${lineNumber}`;
  }
</script>

<div
  bind:this={rootElement}
  {...rest}
  class={classNames('cinder-source-diff-viewer', className)}
  role="region"
  aria-label={normalizedAriaLabel}
  aria-labelledby={normalizedAriaLabelledBy}
>
  {#if !hasPatchContent}
    {#if empty}
      <div class="cinder-source-diff-viewer__empty">{@render empty()}</div>
    {:else}
      <p class="cinder-source-diff-viewer__empty">No patch lines to display.</p>
    {/if}
  {:else}
    {#if parsedPatch.truncated}
      <div class="cinder-source-diff-viewer__notice" role="status">
        Showing first {parsedPatch.renderedLineCount} of {parsedPatch.totalLineCount} diff lines.
      </div>
    {/if}

    {#if annotationEnabled}
      <div class="cinder-source-diff-viewer__annotation-status" role="status">
        {annotationRejectionMessage ?? ''}
      </div>
    {/if}

    {#if showTruncatedActiveFile && activeDescriptor}
      <section class="cinder-source-diff-viewer__file" aria-label={activeDescriptor.label}>
        <header
          class="cinder-source-diff-viewer__file-header"
          data-cinder-file-header
          data-cinder-file-occurrence={activeDescriptor.fileOccurrence}
          tabindex="-1"
        >
          <span class="cinder-source-diff-viewer__file-path">{activeDescriptor.label}</span>
        </header>
        {#if fileAnnotation}
          {@render fileAnnotation({ descriptor: activeDescriptor })}
        {/if}
        <p class="cinder-source-diff-viewer__empty">
          Lines unavailable at the current display limit.
        </p>
      </section>
    {:else}
      {#each visibleFiles as file (file.fileOccurrence)}
        {@const fileLabel = getSourceDiffFileLabel(file)}
        {@const descriptor = parsedPatch.descriptors.find(
          (d) => d.fileOccurrence === file.fileOccurrence,
        )}
        <section class="cinder-source-diff-viewer__file" aria-label={fileLabel}>
          <header
            class="cinder-source-diff-viewer__file-header"
            data-cinder-file-header
            data-cinder-file-occurrence={file.fileOccurrence}
            tabindex="-1"
          >
            <span class="cinder-source-diff-viewer__file-path">{fileLabel}</span>
          </header>

          {#if fileAnnotation && descriptor}
            {@render fileAnnotation({ descriptor })}
          {/if}

          {#if file.metadata.length > 0}
            <div
              class="cinder-source-diff-viewer__metadata"
              role="group"
              aria-label="File metadata"
            >
              {#each file.metadata as metadataLine, metadataIndex (`${metadataIndex}:${metadataLine}`)}
                <code>{metadataLine}</code>
              {/each}
            </div>
          {/if}

          {#each file.hunks as hunk (hunk.hunkOccurrence)}
            {#if hunk.lines.length > 0}
              <div class="cinder-source-diff-viewer__hunk">
                <div class="cinder-source-diff-viewer__hunk-header">{hunk.header}</div>
                <section
                  class="cinder-source-diff-viewer__lines"
                  aria-label={`${fileLabel} ${hunk.header} lines`}
                >
                  {#each hunk.lines as line, lineIndex (`${lineIndex}:${line.kind}:${line.oldLineNumber ?? ''}:${line.newLineNumber ?? ''}`)}
                    <div class="cinder-source-diff-viewer__line" data-cinder-line-kind={line.kind}>
                      {#if lineNumbers}
                        <span class="cinder-source-diff-viewer__line-number" aria-hidden="true">
                          {line.oldLineNumber ?? ''}
                        </span>
                        <span class="cinder-source-diff-viewer__line-number" aria-hidden="true">
                          {line.newLineNumber ?? ''}
                        </span>
                      {/if}
                      <span class="cinder-sr-only">{getSourceDiffLineLabel(line)}</span>
                      <code class="cinder-source-diff-viewer__line-code" aria-hidden="true">
                        {getSourceDiffLineText(line)}
                      </code>
                      {#if annotationEnabled}
                        {#each commentableSidesForLine(line) as side (side)}
                          {@const lineNumber =
                            side === 'old' ? line.oldLineNumber : line.newLineNumber}
                          {#if lineNumber !== null}
                            {@const point = {
                              fileOccurrence: file.fileOccurrence,
                              hunkOccurrence: hunk.hunkOccurrence,
                              side,
                              line: lineNumber,
                            }}
                            <button
                              type="button"
                              id={controlId(point)}
                              class="cinder-source-diff-viewer__annotation-control"
                              data-cinder-annotation-control
                              data-cinder-file-occurrence={point.fileOccurrence}
                              data-cinder-hunk-occurrence={point.hunkOccurrence}
                              data-cinder-side={point.side}
                              data-cinder-line={point.line}
                              aria-label={annotationControlLabel(side, lineNumber)}
                              onclick={(event) => handleControlClick(file, hunk, point, event)}
                              onkeydown={(event) => handleControlKeydown(file, hunk, point, event)}
                            >
                              +
                            </button>
                            {#if lineAnnotation}
                              {@render lineAnnotation({
                                fileOccurrence: file.fileOccurrence,
                                hunkOccurrence: hunk.hunkOccurrence,
                                line,
                                side,
                              })}
                            {/if}
                          {/if}
                        {/each}
                      {/if}
                    </div>
                  {/each}
                </section>
              </div>
            {/if}
          {/each}
        </section>
      {/each}
    {/if}
  {/if}
</div>

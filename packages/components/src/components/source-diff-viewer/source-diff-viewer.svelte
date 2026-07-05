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
   * @avoidWhen Comparing two Markdown documents with normalization, front-matter handling, and revert affordances. | diff-viewer
   * @avoidWhen Showing syntax-highlighted code samples rather than patch output. | code-block
   * @related diff-viewer, diff-statistics, code-block
   */
  export type {
    SourceDiffFile,
    SourceDiffHunk,
    SourceDiffLine,
    SourceDiffLineKind,
    SourceDiffParseResult,
    SourceDiffViewerProps,
  } from './source-diff-viewer.types.ts';
  export {
    getSourceDiffFileLabel,
    getSourceDiffLineLabel,
    parseUnifiedPatch,
  } from './source-diff-viewer.utilities.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import {
    getSourceDiffFileLabel,
    getSourceDiffLineLabel,
    parseUnifiedPatch,
  } from './source-diff-viewer.utilities.ts';
  import type { SourceDiffLine, SourceDiffViewerProps } from './source-diff-viewer.types.ts';

  let {
    patch,
    ariaLabel,
    'aria-label': nativeAriaLabel,
    maxLines = 1000,
    lineNumbers = true,
    emptyMessage = 'No patch lines to display.',
    class: className,
    ...rest
  }: SourceDiffViewerProps = $props();

  const parsedPatch = $derived(parseUnifiedPatch(patch, { maxLines }));
  const hasPatchContent = $derived(parsedPatch.files.length > 0 || parsedPatch.totalLineCount > 0);
  const normalizedAriaLabel = $derived(
    normalizeAriaLabel(ariaLabel) ?? normalizeAriaLabel(nativeAriaLabel) ?? 'Source diff',
  );

  function getSourceDiffLineText(line: SourceDiffLine): string {
    if (line.kind === 'metadata')
      return line.metadataPrefix ? `${line.metadataPrefix} ${line.content}` : line.content;
    const prefix = line.kind === 'addition' ? '+' : line.kind === 'removal' ? '-' : ' ';
    return `${prefix}${line.content}`;
  }

  function normalizeAriaLabel(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }
</script>

<div
  {...rest}
  class={classNames('cinder-source-diff-viewer', className)}
  role="region"
  aria-label={normalizedAriaLabel}
>
  {#if !hasPatchContent}
    <p class="cinder-source-diff-viewer__empty">{emptyMessage}</p>
  {:else}
    {#if parsedPatch.truncated}
      <div class="cinder-source-diff-viewer__notice" role="status">
        Showing first {parsedPatch.renderedLineCount} of {parsedPatch.totalLineCount} diff lines.
      </div>
    {/if}

    {#each parsedPatch.files as file, fileIndex (`${fileIndex}:${file.header ?? `${file.oldPath ?? ''}:${file.newPath ?? ''}`}`)}
      {@const fileLabel = getSourceDiffFileLabel(file)}
      <section class="cinder-source-diff-viewer__file" aria-label={fileLabel}>
        <header class="cinder-source-diff-viewer__file-header">
          <span class="cinder-source-diff-viewer__file-path">{fileLabel}</span>
        </header>

        {#if file.metadata.length > 0}
          <div class="cinder-source-diff-viewer__metadata" role="group" aria-label="File metadata">
            {#each file.metadata as metadataLine, metadataIndex (`${metadataIndex}:${metadataLine}`)}
              <code>{metadataLine}</code>
            {/each}
          </div>
        {/if}

        {#each file.hunks as hunk, hunkIndex (`${hunkIndex}:${hunk.header}`)}
          {#if hunk.lines.length > 0}
            <div class="cinder-source-diff-viewer__hunk">
              <div class="cinder-source-diff-viewer__hunk-header">{hunk.header}</div>
              <svelte:element
                this={'div'}
                class="cinder-source-diff-viewer__lines"
                role="group"
                aria-label={`${fileLabel} ${hunk.header} lines`}
                tabindex={0}
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
                  </div>
                {/each}
              </svelte:element>
            </div>
          {/if}
        {/each}
      </section>
    {/each}
  {/if}
</div>

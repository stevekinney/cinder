<script lang="ts" module>
  import type { DiffReviewFileEntry } from './diff-review-file-entries.ts';

  export interface DiffReviewFileListProps {
    entries: DiffReviewFileEntry[];
    selectedTargetId: string | null;
    selectedFileOccurrence: number | null;
    readonly?: boolean;
    onselect: (targetId: string, fileOccurrence: number) => void;
    onreviewedchange: (targetId: string, fileOccurrence: number, reviewed: boolean) => void;
  }
</script>

<script lang="ts">
  import { Checkbox } from '@lostgradient/cinder';

  let {
    entries,
    selectedTargetId,
    selectedFileOccurrence,
    readonly = false,
    onselect,
    onreviewedchange,
  }: DiffReviewFileListProps = $props();

  function isSelected(entry: DiffReviewFileEntry): boolean {
    return entry.targetId === selectedTargetId && entry.fileOccurrence === selectedFileOccurrence;
  }
</script>

<ul class="diff-review-file-list" aria-label="Files">
  {#each entries as entry (entry.targetId + ':' + entry.fileOccurrence)}
    <li class="diff-review-file-list-item" data-selected={isSelected(entry)}>
      <button
        type="button"
        class="diff-review-file-list-button"
        aria-current={isSelected(entry) ? 'true' : undefined}
        onclick={() => onselect(entry.targetId, entry.fileOccurrence)}
      >
        <span class="diff-review-file-list-path">{entry.path}</span>
        <span class="diff-review-file-list-counts">
          {entry.changedLineCount} changed
          {#if entry.commentCount > 0}· {entry.commentCount} comment{entry.commentCount === 1
              ? ''
              : 's'}{/if}
          {#if entry.draftCount > 0}· {entry.draftCount} draft{entry.draftCount === 1
              ? ''
              : 's'}{/if}
        </span>
      </button>
      <Checkbox
        label="Reviewed"
        checked={entry.reviewed}
        disabled={readonly}
        onValueChange={(next) => onreviewedchange(entry.targetId, entry.fileOccurrence, next)}
      />
    </li>
  {/each}
</ul>

<script lang="ts" module>
  import type { DiffReviewResult } from '../../diff-review-state/index.ts';
  import type { DiffReviewExportGate } from './diff-review-export-gate.ts';

  export type DiffReviewExportScope = 'all' | 'unresolved';

  export interface DiffReviewToolbarProps {
    filterQuery: string;
    onfilterchange: (query: string) => void;
    gate: DiffReviewExportGate;
    /** Builds the export string for the requested format/scope, without side effects. */
    ongetcontent: (
      format: 'markdown' | 'json',
      scope: DiffReviewExportScope,
    ) => DiffReviewResult<string>;
    onopendrafts: () => void;
  }
</script>

<script lang="ts">
  import { copyToClipboard } from '../../utilities/clipboard.ts';
  import { buildDiffReviewDownload, triggerDiffReviewDownload } from './diff-review-download.ts';

  let { filterQuery, onfilterchange, gate, ongetcontent, onopendrafts }: DiffReviewToolbarProps =
    $props();

  let scope = $state<DiffReviewExportScope>('all');
  let announcement = $state('');
  let copyError = $state<string | null>(null);

  async function copyReview(): Promise<void> {
    copyError = null;
    const result = ongetcontent('markdown', scope);
    if (!result.ok) {
      copyError = result.error.message;
      return;
    }
    const succeeded = await copyToClipboard(result.value);
    if (succeeded) {
      announcement = 'Copied review to clipboard.';
    } else {
      copyError =
        'Unable to copy the review to the clipboard. Your review and any unsaved work are unaffected.';
    }
  }

  function download(format: 'markdown' | 'json'): void {
    const result = ongetcontent(format, scope);
    if (!result.ok) {
      copyError = result.error.message;
      return;
    }
    triggerDiffReviewDownload(buildDiffReviewDownload(format, result.value));
  }
</script>

<div class="diff-review-toolbar">
  <input
    type="search"
    class="diff-review-toolbar-filter"
    aria-label="Filter files by path"
    placeholder="Filter files"
    value={filterQuery}
    oninput={(event) => onfilterchange(event.currentTarget.value)}
  />

  <label class="diff-review-toolbar-scope">
    <span class="cinder-sr-only">Export scope</span>
    <select bind:value={scope}>
      <option value="all">All comments</option>
      <option value="unresolved">Unresolved only</option>
    </select>
  </label>

  {#if gate.blocked}
    <p class="diff-review-toolbar-gate" role="status">
      {gate.pendingCount} unsaved draft{gate.pendingCount === 1 ? '' : 's'} must be saved or discarded
      before export.
      <button type="button" onclick={onopendrafts}>Review drafts</button>
    </p>
  {:else}
    <button type="button" onclick={copyReview}>Copy review</button>
    <button type="button" onclick={() => download('markdown')}>Download Markdown</button>
    <button type="button" onclick={() => download('json')}>Download JSON</button>
  {/if}

  <div class="cinder-sr-only" role="status" aria-live="polite" aria-atomic="true">
    {announcement}
  </div>
  {#if copyError}
    <p class="diff-review-toolbar-error" role="alert">{copyError}</p>
  {/if}
</div>

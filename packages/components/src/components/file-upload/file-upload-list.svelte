<script lang="ts">
  import { tick } from 'svelte';
  import RotateCcwIcon from 'lucide-svelte/icons/rotate-ccw';
  import XIcon from 'lucide-svelte/icons/x';

  import { formatBytes } from '../../utilities/format-bytes.ts';
  import { fileTypeIcon } from './file-upload-utilities.ts';
  import type { FileUploadEntry } from './file-upload.types.ts';

  let {
    entries,
    resolvedId,
    disabled,
    removable,
    onFileRetry,
    onRemove,
    onQueueEmptyFocus,
  }: {
    entries: FileUploadEntry[];
    resolvedId: string;
    disabled: boolean;
    removable: boolean;
    onFileRetry: ((entry: FileUploadEntry) => void) | undefined;
    onRemove: (entry: FileUploadEntry) => void;
    onQueueEmptyFocus: () => void;
  } = $props();

  let listElement = $state<HTMLUListElement>();

  function progressValue(progress: number | undefined): number {
    if (progress === undefined) return 0;
    return Math.max(0, Math.min(100, progress));
  }

  async function handleRemove(entry: FileUploadEntry, index: number) {
    const removeButtons = listElement?.querySelectorAll<HTMLButtonElement>(
      '.cinder-file-upload__remove',
    );
    const nextButton = removeButtons?.[index + 1] ?? removeButtons?.[index - 1];
    onRemove(entry);
    await tick();
    if (nextButton?.isConnected) nextButton.focus();
    else onQueueEmptyFocus();
  }

  async function handleRetry(entry: FileUploadEntry, retryButton: HTMLButtonElement) {
    onFileRetry?.(entry);
    await tick();
    if (!retryButton.isConnected) onQueueEmptyFocus();
  }
</script>

<ul bind:this={listElement} class="cinder-file-upload__list">
  {#each entries as entry, index (entry.id)}
    {@const errorId = entry.error ? `${resolvedId}-${entry.id}-error` : undefined}
    {@const FileTypeIcon = fileTypeIcon(entry.file.type)}
    <li class="cinder-file-upload__row" aria-describedby={errorId}>
      <div class="cinder-file-upload__row-main">
        <div class="cinder-file-upload__file-details">
          <FileTypeIcon class="cinder-file-upload__file-icon" aria-hidden="true" />
          <div class="cinder-file-upload__file-meta">
            <span class="cinder-file-upload__file-name cinder-_truncate">{entry.file.name}</span>
            <span class="cinder-file-upload__file-size">{formatBytes(entry.file.size)}</span>
          </div>
        </div>

        <div class="cinder-file-upload__row-actions">
          {#if entry.status === 'uploading'}
            <span class="cinder-file-upload__status" data-status="uploading">Uploading</span>
          {:else if entry.status === 'success'}
            <span class="cinder-file-upload__status" data-status="success">
              <svg
                class="cinder-file-upload__status-icon"
                aria-hidden="true"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M3.5 8.5L6.25 11.25L12.5 5"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              Complete
            </span>
          {:else if entry.status === 'error'}
            <span class="cinder-file-upload__status" data-status="error">
              <svg
                class="cinder-file-upload__status-icon"
                aria-hidden="true"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M8 4.5V8.25M8 11H8.00667M14 8C14 11.3137 11.3137 14 8 14C4.68629 14 2 11.3137 2 8C2 4.68629 4.68629 2 8 2C11.3137 2 14 4.68629 14 8Z"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              Failed
            </span>
          {:else}
            <span class="cinder-file-upload__status" data-status="pending">Pending</span>
          {/if}
          {#if removable}
            <button
              type="button"
              class="cinder-file-upload__remove"
              {disabled}
              aria-label={`Remove ${entry.file.name}`}
              onclick={() => handleRemove(entry, index)}
            >
              <XIcon aria-hidden="true" />
            </button>
          {/if}
        </div>
      </div>

      {#if entry.status === 'uploading'}
        {@const value = progressValue(entry.progress)}
        <div
          class="cinder-file-upload__progress"
          role="progressbar"
          aria-label={`Uploading ${entry.file.name}`}
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={value}
        >
          <div
            class="cinder-file-upload__progress-fill"
            style={`--cinder-file-upload-progress: ${value}`}
          ></div>
        </div>
      {/if}

      {#if entry.error || (entry.status === 'error' && entry.rejectionReason === undefined && onFileRetry)}
        <div class="cinder-file-upload__error-row">
          {#if entry.error}
            <p id={errorId} class="cinder-file-upload__error">{entry.error}</p>
          {/if}
          {#if entry.status === 'error' && entry.rejectionReason === undefined && onFileRetry}
            <button
              type="button"
              class="cinder-file-upload__retry"
              {disabled}
              aria-label={`Retry ${entry.file.name}`}
              aria-describedby={errorId}
              onclick={(event) => handleRetry(entry, event.currentTarget)}
            >
              <RotateCcwIcon class="cinder-file-upload__retry-icon" aria-hidden="true" />
              Retry
            </button>
          {/if}
        </div>
      {/if}
    </li>
  {/each}
</ul>

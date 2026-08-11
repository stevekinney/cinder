<script lang="ts">
  import FileUpload from '../../components/file-upload/file-upload.svelte';
  import type { FileUploadEntry } from '../../components/file-upload/file-upload.types.ts';

  let {
    onFilesChange,
    customFileList = false,
  }: {
    onFilesChange?: (entries: FileUploadEntry[]) => void;
    customFileList?: boolean;
  } = $props();
</script>

{#snippet fileList(
  entries: FileUploadEntry[],
  onRemove: ((entry: FileUploadEntry) => void) | undefined,
)}
  <ul data-testid="custom-file-list">
    {#each entries as entry (entry.id)}
      <li>
        {entry.file.name}
        {#if onRemove}
          <button
            type="button"
            aria-label={`Remove ${entry.file.name}`}
            onclick={() => onRemove(entry)}
          >
            Remove {entry.file.name}
          </button>
        {/if}
      </li>
    {/each}
  </ul>
{/snippet}

<form>
  <FileUpload
    id="upload"
    name="attachment"
    multiple
    maxFiles={customFileList ? 1 : undefined}
    {...onFilesChange ? { onFilesChange } : {}}
    {...customFileList ? { fileList } : {}}
  />
</form>

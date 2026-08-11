<script lang="ts">
  import FileUpload from '../../components/file-upload/file-upload.svelte';
  import type { FileUploadEntry } from '../../components/file-upload/file-upload.types.ts';

  let {
    onFilesChange,
    customFileList = false,
    controlledFiles,
    nextControlledFiles,
  }: {
    onFilesChange?: (entries: FileUploadEntry[]) => void;
    customFileList?: boolean;
    controlledFiles?: FileUploadEntry[];
    nextControlledFiles?: FileUploadEntry[];
  } = $props();

  let formElement = $state<HTMLFormElement>();
  let currentControlledFiles = $state<FileUploadEntry[]>();

  $effect(() => {
    currentControlledFiles = controlledFiles;
  });

  function updateControlledFilesAndReset() {
    currentControlledFiles = nextControlledFiles;
    formElement?.reset();
  }

  function releaseControl() {
    currentControlledFiles = undefined;
  }
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

<form bind:this={formElement}>
  <FileUpload
    id="upload"
    name="attachment"
    multiple
    {...onFilesChange ? { onFilesChange } : {}}
    {...customFileList ? { maxFiles: 1, fileList } : {}}
    {...currentControlledFiles ? { files: currentControlledFiles } : {}}
  />
  {#if nextControlledFiles}
    <button
      type="button"
      data-testid="update-files-and-reset"
      onclick={updateControlledFilesAndReset}
    >
      Update files and reset
    </button>
  {/if}
  <button type="button" data-testid="release-control" onclick={releaseControl}
    >Release control</button
  >
</form>

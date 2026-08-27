<script lang="ts" module>
  export const title = 'Basic file upload';
  export const description = 'Drag-and-drop file picker with acceptance and rejection feedback.';
</script>

<script lang="ts">
  import { FileUpload } from '@lostgradient/cinder/file-upload';
  import type { FileUploadEntry } from '@lostgradient/cinder/file-upload';
  import { FormField } from '@lostgradient/cinder/form-field';

  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();
  const uid = $props.id();
  let fieldId = $derived(`${mountIdPrefix ?? uid}-attachment`);

  let acceptedNames = $state<string[]>([]);
  let rejectedMessages = $state<string[]>([]);

  function handleFilesChange(entries: FileUploadEntry[]) {
    acceptedNames = entries
      .filter((entry) => entry.rejectionReason === undefined)
      .map((entry) => entry.file.name);
    rejectedMessages = entries.flatMap((entry) =>
      entry.rejectionReason !== undefined && entry.error ? [entry.error] : [],
    );
  }
</script>

<!-- Compose with FormField so the file input has an associated <label>. -->
<FormField id={fieldId} label="Attachment" description="Images or PDF, up to 5 MB.">
  <FileUpload
    id={fieldId}
    accept="image/*,.pdf"
    multiple
    maxSize={5 * 1024 * 1024}
    onFilesChange={handleFilesChange}
  />
</FormField>

{#if acceptedNames.length > 0}
  <p style="margin-top: 0.5rem; color: var(--cinder-status-success-text);">
    Accepted: {acceptedNames.join(', ')}
  </p>
{/if}

{#if rejectedMessages.length > 0}
  <p style="margin-top: 0.5rem; color: var(--cinder-status-danger-text);">
    {rejectedMessages.join('; ')}
  </p>
{/if}

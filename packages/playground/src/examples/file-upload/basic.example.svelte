<script lang="ts" module>
  export const title = 'Basic file upload';
  export const description = 'Drag-and-drop file picker with acceptance and rejection feedback.';
</script>

<script lang="ts">
  import { FileUpload } from '@lostgradient/cinder/file-upload';
  import type { RejectedFile } from '@lostgradient/cinder/file-upload';
  import { FormField } from '@lostgradient/cinder/form-field';

  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();
  const uid = $props.id();
  let fieldId = $derived(`${mountIdPrefix ?? uid}-attachment`);

  let acceptedNames = $state<string[]>([]);
  let rejectedMessages = $state<string[]>([]);

  function handleChange(files: File[]) {
    acceptedNames = files.map((file) => file.name);
    rejectedMessages = [];
  }

  function handleReject(rejected: RejectedFile[]) {
    rejectedMessages = rejected.map((entry) => entry.message);
    acceptedNames = [];
  }
</script>

<!-- Compose with FormField so the file input has an associated <label>. -->
<FormField id={fieldId} label="Attachment" description="Images or PDF, up to 5 MB.">
  <FileUpload
    id={fieldId}
    accept="image/*,.pdf"
    multiple
    maxSize={5 * 1024 * 1024}
    onchange={handleChange}
    onreject={handleReject}
  />
</FormField>

{#if acceptedNames.length > 0}
  <p style="margin-top: 0.5rem; color: var(--cinder-color-success-fg);">
    Accepted: {acceptedNames.join(', ')}
  </p>
{/if}

{#if rejectedMessages.length > 0}
  <p style="margin-top: 0.5rem; color: var(--cinder-color-danger-fg);">
    {rejectedMessages.join('; ')}
  </p>
{/if}

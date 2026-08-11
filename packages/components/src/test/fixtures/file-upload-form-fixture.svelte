<script lang="ts">
  import FileUpload from '../../components/file-upload/file-upload.svelte';
  import type { FileUploadEntry } from '../../components/file-upload/file-upload.types.ts';

  let { onFilesChange }: { onFilesChange?: (entries: FileUploadEntry[]) => void } = $props();
</script>

<form>
  <FileUpload id="upload" name="attachment" multiple {...onFilesChange ? { onFilesChange } : {}} />
</form>

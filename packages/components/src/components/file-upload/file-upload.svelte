<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status stable
   * @purpose File picker and drag-and-drop surface that validates files locally and can render upload progress rows.
   * @tag form
   * @tag upload
   * @useWhen Collecting one or more files while keeping the native picker available for keyboard and assistive-technology users.
   * @useWhen Showing per-file upload progress or rejection errors below a prominent dropzone surface.
   * @avoidWhen You only need a hidden native file input with no custom UI.
   * @related form-field, progress, input
   */
  export type {
    FileUploadEntry,
    FileUploadProps,
    FileUploadRejectionReason,
    FileUploadStatus,
    RejectedFile,
  } from './file-upload.types.ts';
</script>

<script lang="ts">
  import { resolveFieldControl } from '../../_internal/field-control.ts';
  import { getFormFieldContext } from '../../_internal/form-field-context.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { devWarn } from '../../utilities/dev-warn.ts';
  import { formatBytes } from '../../utilities/format-bytes.ts';
  import { useAnnouncer } from '../../utilities/use-announcer.svelte.ts';
  import type { FileUploadEntry, FileUploadProps, RejectedFile } from './file-upload.types.ts';

  let {
    id,
    accept,
    multiple = false,
    maxSize,
    disabled,
    required,
    name,
    class: className,
    triggerLabel = 'Choose files',
    files,
    idle,
    dragActive,
    fileList,
    onchange,
    onreject,
    'aria-describedby': consumerDescribedBy,
    'aria-invalid': consumerInvalid,
    ...rest
  }: FileUploadProps = $props();

  const context = getFormFieldContext();
  const announcer = useAnnouncer({ clearDelay: 5000 });

  const generatedId = $props.id();
  const field = $derived(
    resolveFieldControl({
      ...(id !== undefined ? { id } : {}),
      generatedId,
      context,
      hasDescription: false,
      hasError: false,
      consumerDescribedBy,
      consumerInvalid,
      disabled: disabled ?? undefined,
      required: required ?? undefined,
    }),
  );
  const resolvedId = $derived(field.id);
  const dropzoneLabelledBy = $derived(context?.labelId);
  const dropzoneLabel = $derived(dropzoneLabelledBy === undefined ? 'File upload' : undefined);

  let inputElement = $state<HTMLInputElement | null>(null);
  let dragDepth = $state(0);
  let internalEntries = $state<FileUploadEntry[]>([]);
  let internalEntryCounter = $state(0);

  const isDragActive = $derived(dragDepth > 0);
  const renderedEntries = $derived(files ?? internalEntries);

  $effect(() => {
    if (context && id && context.controlId !== id) {
      devWarn(
        `[cinder/FileUpload] id mismatch: FileUpload id="${id}" but wrapping FormField expects controlId="${context.controlId}". Set the same id on both.`,
      );
    }
  });

  function nextEntryId(status: FileUploadEntry['status']): string {
    internalEntryCounter += 1;
    return `${resolvedId}-entry-${internalEntryCounter}-${status}`;
  }

  function hasFilesPayload(dataTransfer: DataTransfer | null | undefined): boolean {
    const fileTypes = dataTransfer?.types;
    if (!fileTypes) return false;
    return Array.from(fileTypes as ArrayLike<string>).includes('Files');
  }

  function matchesAcceptToken(file: File, token: string): boolean {
    const normalizedToken = token.trim().toLowerCase();
    if (!normalizedToken) return true;

    if (normalizedToken.startsWith('.')) {
      return file.name.toLowerCase().endsWith(normalizedToken);
    }

    const fileType = file.type.toLowerCase();
    if (normalizedToken.endsWith('/*')) {
      const prefix = normalizedToken.slice(0, -1);
      return fileType.startsWith(prefix);
    }

    return fileType === normalizedToken;
  }

  function acceptsFile(file: File): boolean {
    if (!accept?.trim()) return true;
    const tokens = accept
      .split(',')
      .map((token) => token.trim())
      .filter(Boolean);
    if (tokens.length === 0) return true;
    return tokens.some((token) => matchesAcceptToken(file, token));
  }

  function validateFiles(sourceFiles: File[]): { accepted: File[]; rejected: RejectedFile[] } {
    const accepted: File[] = [];
    const rejected: RejectedFile[] = [];

    for (const file of sourceFiles) {
      if (maxSize !== undefined && file.size > maxSize) {
        rejected.push({
          file,
          reason: 'too-large',
          message: `${file.name} is ${formatBytes(file.size)}; maximum is ${formatBytes(maxSize)}`,
        });
        continue;
      }

      if (!acceptsFile(file)) {
        rejected.push({
          file,
          reason: 'wrong-type',
          message: `${file.name} is not an accepted file type`,
        });
        continue;
      }

      accepted.push(file);
    }

    if (!multiple && accepted.length > 1) {
      const extras = accepted.splice(1);
      for (const file of extras) {
        rejected.push({
          file,
          reason: 'too-many',
          message: `Only one file is allowed; ${file.name} was ignored`,
        });
      }
    }

    return { accepted, rejected };
  }

  function updateInternalEntries(accepted: File[], rejected: RejectedFile[]) {
    internalEntries = [
      ...accepted.map((file) => ({
        id: nextEntryId('success'),
        file,
        status: 'success' as const,
      })),
      ...rejected.map((entry) => ({
        id: nextEntryId('error'),
        file: entry.file,
        status: 'error' as const,
        error: entry.message,
      })),
    ];
  }

  function announceResult(accepted: File[], rejected: RejectedFile[]) {
    if (accepted.length === 0 && rejected.length === 0) return;
    if (accepted.length > 0 && rejected.length === 0) {
      announcer.announce(`${accepted.length} file${accepted.length === 1 ? '' : 's'} accepted`);
      return;
    }
    if (accepted.length === 0 && rejected.length === 1) {
      announcer.announce(rejected[0]!.message);
      return;
    }
    announcer.announce(
      `${accepted.length} file${accepted.length === 1 ? '' : 's'} accepted, ${rejected.length} rejected`,
    );
  }

  function processFiles(sourceFiles: File[]) {
    const { accepted, rejected } = validateFiles(sourceFiles);
    updateInternalEntries(accepted, rejected);
    if (accepted.length > 0) onchange?.(accepted);
    if (rejected.length > 0) onreject?.(rejected);
    announceResult(accepted, rejected);
  }

  function handleInputChange() {
    if (field.disabled || !inputElement?.files) return;
    processFiles(Array.from(inputElement.files));
  }

  function handleDragEnter(event: DragEvent) {
    if (field.disabled || !hasFilesPayload(event.dataTransfer)) return;
    dragDepth += 1;
  }

  function handleDragLeave(event: DragEvent) {
    if (event.dataTransfer && !hasFilesPayload(event.dataTransfer)) return;
    dragDepth = Math.max(0, dragDepth - 1);
  }

  function handleDragOver(event: DragEvent) {
    if (!hasFilesPayload(event.dataTransfer)) return;
    event.preventDefault();
    if (field.disabled) return;
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  function handleDrop(event: DragEvent) {
    if (!hasFilesPayload(event.dataTransfer)) return;
    event.preventDefault();
    dragDepth = 0;
    if (field.disabled) return;
    const droppedFiles = Array.from(event.dataTransfer?.files ?? []);
    if (droppedFiles.length === 0) return;
    processFiles(droppedFiles);
  }

  function openPicker() {
    if (field.disabled) return;
    clearInputValue();
    inputElement?.click();
  }

  function clearInputValue() {
    if (inputElement) {
      inputElement.value = '';
    }
  }

  function handleInputClick() {
    if (field.disabled) return;
    clearInputValue();
  }

  function progressValue(progress: number | undefined): number {
    if (progress === undefined) return 0;
    return Math.max(0, Math.min(100, progress));
  }
</script>

{#snippet defaultIdle()}
  <div class="cinder-file-upload__body">
    <span class="cinder-file-upload__eyebrow">
      <svg
        class="cinder-file-upload__eyebrow-icon"
        aria-hidden="true"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M8 10.75V3.75M8 3.75L5.25 6.5M8 3.75L10.75 6.5M3 10.5V11.75C3 12.4404 3.55964 13 4.25 13H11.75C12.4404 13 13 12.4404 13 11.75V10.5"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      Drag files here or choose files
    </span>
    <p class="cinder-file-upload__hint">Drop files on this area or use the native file picker.</p>
  </div>
{/snippet}

{#snippet defaultDragActive()}
  <div class="cinder-file-upload__body">
    <span class="cinder-file-upload__eyebrow">Drop files to add them</span>
    <p class="cinder-file-upload__hint">Release now to validate and queue the selected files.</p>
  </div>
{/snippet}

<div class={classNames('cinder-file-upload', className)}>
  <div
    class="cinder-file-upload__dropzone"
    role="group"
    aria-label={dropzoneLabel}
    aria-labelledby={dropzoneLabelledBy}
    data-drag-active={isDragActive || undefined}
    data-disabled={field.disabled || undefined}
    ondragenter={handleDragEnter}
    ondragleave={handleDragLeave}
    ondragover={handleDragOver}
    ondrop={handleDrop}
  >
    <input
      bind:this={inputElement}
      id={resolvedId}
      class="cinder-file-upload__input"
      type="file"
      {accept}
      {multiple}
      {name}
      disabled={field.disabled}
      required={field.required}
      {...rest}
      aria-describedby={field.describedBy}
      aria-invalid={field.ariaInvalid}
      onclick={handleInputClick}
      onchange={handleInputChange}
    />

    {#if isDragActive}
      {#if dragActive}
        {@render dragActive()}
      {:else}
        {@render defaultDragActive()}
      {/if}
    {:else if idle}
      {@render idle()}
    {:else}
      {@render defaultIdle()}
    {/if}

    <button
      type="button"
      class="cinder-file-upload__button"
      disabled={field.disabled}
      onclick={openPicker}
    >
      {triggerLabel}
    </button>
  </div>

  {#if renderedEntries.length > 0}
    {#if fileList}
      {@render fileList(renderedEntries)}
    {:else}
      <ul class="cinder-file-upload__list">
        {#each renderedEntries as entry (entry.id)}
          {@const errorId = entry.error ? `${resolvedId}-${entry.id}-error` : undefined}
          <li class="cinder-file-upload__row" aria-describedby={errorId}>
            <div class="cinder-file-upload__row-main">
              <div class="cinder-file-upload__file-meta">
                <span class="cinder-file-upload__file-name cinder-_truncate">{entry.file.name}</span
                >
                <span class="cinder-file-upload__file-size">{formatBytes(entry.file.size)}</span>
              </div>

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

            {#if entry.error}
              <p id={errorId} class="cinder-file-upload__error">{entry.error}</p>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  {/if}

  <div class="cinder-sr-only" aria-live="polite" aria-atomic="true">{announcer.message}</div>
</div>

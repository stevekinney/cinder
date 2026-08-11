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
  import { on } from 'svelte/events';

  import { resolveFieldControl } from '../../_internal/field-control.ts';
  import { getFormFieldContext } from '../../_internal/form-field-context.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { devWarn } from '../../utilities/dev-warn.ts';
  import { formatBytes } from '../../utilities/format-bytes.ts';
  import { useAnnouncer } from '../../utilities/use-announcer.svelte.ts';
  import FileUploadList from './file-upload-list.svelte';
  import {
    acceptsFile,
    formatAcceptDescription,
    INTERACTIVE_DESCENDANT_SELECTOR,
    nativeFilesMatch,
  } from './file-upload-utilities.ts';
  import type { FileUploadEntry, FileUploadProps, RejectedFile } from './file-upload.types.ts';

  let {
    id,
    accept,
    multiple = false,
    maxSize,
    maxFiles,
    disabled,
    required,
    name,
    class: className,
    title = 'Click to upload or drop files',
    description,
    draggingLabel = 'Drop to add',
    browseLabel = 'Browse files',
    borderBeamVisible = true,
    files,
    idle,
    dragActive,
    fileList,
    onFilesAccepted,
    onFilesChange,
    onReject,
    onFileRetry,
    oncancel,
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
      localIdNamespace: 'file-upload',
      hasDescription: idle === undefined,
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
  let browseButtonElement = $state<HTMLButtonElement | null>(null);
  let dragDepth = $state(0);
  let internalEntries = $state<FileUploadEntry[]>([]);
  let internalEntryCounter = $state(0);

  const isDragActive = $derived(dragDepth > 0);
  const renderedEntries = $derived(files ?? internalEntries);
  const resolvedDescription = $derived(description ?? formatAcceptDescription(accept));

  function synchronizeNativeInputFiles(entries: FileUploadEntry[] = renderedEntries) {
    if (!inputElement || typeof DataTransfer === 'undefined') return;
    const acceptedEntries = entries.filter((entry) => entry.rejectionReason === undefined);
    const acceptedFiles = (
      multiple
        ? maxFiles === undefined
          ? acceptedEntries
          : acceptedEntries.slice(0, Math.max(0, Math.floor(maxFiles)))
        : acceptedEntries.slice(0, 1)
    ).map((entry) => entry.file);
    let dataTransfer: DataTransfer;
    try {
      dataTransfer = new DataTransfer();
    } catch {
      if (!nativeFilesMatch(inputElement.files, acceptedFiles)) inputElement.value = '';
      return;
    }
    for (const file of acceptedFiles) dataTransfer.items.add(file);
    try {
      inputElement.files = dataTransfer.files;
    } catch {
      if (!nativeFilesMatch(inputElement.files, acceptedFiles)) inputElement.value = '';
    }
  }

  $effect(() => {
    synchronizeNativeInputFiles();
  });

  $effect(() => {
    const ownerDocument = inputElement?.ownerDocument;
    if (!ownerDocument || files !== undefined) return;
    let associatedForm: HTMLFormElement | null = null;
    let removeResetListener = () => {};
    function handleFormReset(event: Event) {
      queueMicrotask(() => {
        if (event.defaultPrevented || files !== undefined) return;
        internalEntries = [];
        synchronizeNativeInputFiles([]);
        onFilesChange?.([]);
      });
    }
    function bindAssociatedForm() {
      const nextForm = inputElement?.form ?? null;
      if (nextForm === associatedForm) return;
      removeResetListener();
      associatedForm = nextForm;
      removeResetListener = nextForm ? on(nextForm, 'reset', handleFormReset) : () => {};
    }
    bindAssociatedForm();
    const observer = new MutationObserver(bindAssociatedForm);
    observer.observe(ownerDocument.documentElement, {
      attributes: true,
      attributeFilter: ['form', 'id'],
      childList: true,
      subtree: true,
    });
    return () => {
      observer.disconnect();
      removeResetListener();
    };
  });

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
    return Array.from(fileTypes).includes('Files');
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

      if (!acceptsFile(file, accept)) {
        rejected.push({
          file,
          reason: 'wrong-type',
          message: `${file.name} is not an accepted file type`,
        });
        continue;
      }

      accepted.push(file);
    }

    const normalizedMaxFiles =
      maxFiles === undefined ? undefined : Math.max(0, Math.floor(maxFiles));
    const acceptedFileLimit = multiple ? normalizedMaxFiles : Math.min(1, normalizedMaxFiles ?? 1);
    const existingAcceptedCount =
      multiple && normalizedMaxFiles !== undefined
        ? renderedEntries.filter((entry) => entry.rejectionReason === undefined).length
        : 0;
    const remainingFileLimit =
      acceptedFileLimit === undefined
        ? undefined
        : Math.max(0, acceptedFileLimit - existingAcceptedCount);
    if (remainingFileLimit !== undefined && accepted.length > remainingFileLimit) {
      const extras = accepted.splice(remainingFileLimit);
      for (const file of extras) {
        rejected.push({
          file,
          reason: 'too-many',
          message: `${acceptedFileLimit === 1 ? 'Only one file is' : `Only ${acceptedFileLimit} files are`} allowed; ${file.name} was ignored`,
        });
      }
    }

    return { accepted, rejected };
  }

  function createEntries(accepted: File[], rejected: RejectedFile[]): FileUploadEntry[] {
    return [
      ...accepted.map((file) => ({
        id: nextEntryId('pending'),
        file,
        status: 'pending' as const,
      })),
      ...rejected.map((entry) => ({
        id: nextEntryId('error'),
        file: entry.file,
        status: 'error' as const,
        error: entry.message,
        rejectionReason: entry.reason,
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
    const entries = createEntries(accepted, rejected);
    const nextEntries = multiple ? [...renderedEntries, ...entries] : entries;
    internalEntries = nextEntries;
    synchronizeNativeInputFiles(files ?? nextEntries);
    if (accepted.length > 0) onFilesAccepted?.(accepted);
    onFilesChange?.(nextEntries);
    if (rejected.length > 0) onReject?.(rejected);
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
    // Deliberately asymmetric with handleDragEnter's guard: a `null`
    // dataTransfer here still decrements. A canceled drag (Escape, or a drop
    // outside the window) can deliver a 'dragleave' with an inaccessible
    // dataTransfer, and treating that the same as "not a file drag" (like
    // dragenter does) leaves dragDepth stuck above zero and the drag-active
    // overlay stuck open — see the "clear drag state after cancelled upload"
    // fix and its dedicated regression test. Only a present-but-non-Files
    // dataTransfer (e.g. a text drag) is ignored here.
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

  function surfaceActivation(node: HTMLElement) {
    function handleClick(event: MouseEvent) {
      if (field.disabled) return;
      const target = event.target;
      const interactiveDescendant =
        target instanceof Element ? target.closest(INTERACTIVE_DESCENDANT_SELECTOR) : null;
      if (interactiveDescendant && interactiveDescendant !== node) return;
      openPicker();
    }

    node.addEventListener('click', handleClick);
    return {
      destroy() {
        node.removeEventListener('click', handleClick);
      },
    };
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

  function handleInputCancel(event: Event) {
    synchronizeNativeInputFiles();
    oncancel?.(event as Event & { currentTarget: EventTarget & HTMLInputElement });
  }

  function removeEntry(entry: FileUploadEntry) {
    if (field.disabled) return;
    const nextEntries = renderedEntries.filter((candidate) => candidate.id !== entry.id);
    if (files === undefined) internalEntries = nextEntries;
    synchronizeNativeInputFiles(files ?? nextEntries);
    onFilesChange?.(nextEntries);
    announcer.announce(`${entry.file.name} removed`);
  }
</script>

{#snippet defaultIdle()}
  <div class="cinder-file-upload__body">
    <span class="cinder-file-upload__upload-icon" aria-hidden="true">
      <svg
        class="cinder-file-upload__upload-icon-svg"
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
    </span>
    <p class="cinder-file-upload__title">{title}</p>
    <p id={field.ownDescriptionId} class="cinder-file-upload__description">
      {resolvedDescription}
    </p>
  </div>
{/snippet}

{#snippet defaultDragActive()}
  <div class="cinder-file-upload__body">
    <p class="cinder-file-upload__title">{draggingLabel}</p>
    <p class="cinder-file-upload__hint">Release now to validate and queue the selected files.</p>
  </div>
{/snippet}

<div class={classNames('cinder-file-upload', className)}>
  <div
    class={classNames(
      'cinder-file-upload__dropzone',
      borderBeamVisible && 'cinder-file-upload__dropzone--border-beam',
    )}
    role="group"
    aria-label={dropzoneLabel}
    aria-labelledby={dropzoneLabelledBy}
    data-drag-active={isDragActive || undefined}
    data-disabled={field.disabled || undefined}
    ondragenter={handleDragEnter}
    ondragleave={handleDragLeave}
    ondragover={handleDragOver}
    ondrop={handleDrop}
    use:surfaceActivation
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
      oncancel={handleInputCancel}
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
      bind:this={browseButtonElement}
      type="button"
      class="cinder-file-upload__button"
      disabled={field.disabled}
      aria-describedby={field.describedBy}
      onclick={openPicker}
    >
      {browseLabel}
    </button>
  </div>

  {#if renderedEntries.length > 0}
    {#if fileList}
      {@render fileList(renderedEntries)}
    {:else}
      <FileUploadList
        entries={renderedEntries}
        {resolvedId}
        disabled={field.disabled}
        removable={files === undefined || onFilesChange !== undefined}
        {onFileRetry}
        onRemove={removeEntry}
        onQueueEmptyFocus={() => browseButtonElement?.focus()}
      />
    {/if}
  {/if}

  <div class="cinder-sr-only" aria-live="polite" aria-atomic="true">{announcer.message}</div>
</div>

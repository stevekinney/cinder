import type { Snippet } from 'svelte';
import type { HTMLInputAttributes } from 'svelte/elements';

export type FileUploadRejectionReason = 'too-large' | 'wrong-type' | 'too-many';

export type RejectedFile = {
  /** File rejected during local validation. */
  file: File;
  /** Stable rejection classification for consumers. */
  reason: FileUploadRejectionReason;
  /** Human-readable explanation suitable for inline UI. */
  message: string;
};

export type FileUploadStatus = 'pending' | 'uploading' | 'success' | 'error';

export type FileUploadEntry = {
  /** Stable key used for rendering. */
  id: string;
  /** File represented by this row. */
  file: File;
  /** Visual state rendered for the file. */
  status: FileUploadStatus;
  /** Optional 0-100 progress percentage used while uploading. */
  progress?: number;
  /** Optional error message rendered and linked via aria-describedby. */
  error?: string;
  /** Local validation reason. Omitted for errors produced after an accepted upload starts. */
  rejectionReason?: FileUploadRejectionReason;
};

export type FileUploadProps = Omit<
  HTMLInputAttributes,
  'type' | 'children' | 'onchange' | 'oninput' | 'value' | 'files' | 'class'
> & {
  /** Stable id for the native file input. Required when composing with `FormField`. */
  id?: string;
  /** Native file accept filter. */
  accept?: string;
  /** Allow more than one file. Default `false`. */
  multiple?: boolean;
  /** Maximum allowed file size in bytes. */
  maxSize?: number;
  /** Maximum number of files allowed. Files beyond this limit are rejected. */
  maxFiles?: number;
  /** Disables the file picker and drag-and-drop surface. */
  disabled?: boolean;
  /** Native input name used for form submission. */
  name?: string;
  /** Additional classes merged with `.cinder-file-upload`. */
  class?: string;
  /** Visible title for the dropzone. Default `Click to upload or drop files`. */
  title?: string;
  /** Visible description below the title. Defaults to a summary derived from `accept`. */
  description?: string;
  /** Visible label shown while files are dragged over the dropzone. Default `Drop to add`. */
  draggingLabel?: string;
  /** Visible text for the browse button. Default `Browse files`. */
  browseLabel?: string;
  /** Adds focus and drag-active border emphasis to the dropzone. Default `true`. */
  borderBeamVisible?: boolean;
  /** Consumer-driven file rows, including upload progress and error states. */
  files?: FileUploadEntry[];
  /** Replaces the default resting-state dropzone body. */
  idle?: Snippet;
  /** Replaces the default drag-active dropzone body. */
  dragActive?: Snippet;
  /** Replaces the default file-list renderer. Receives the resolved rows. */
  fileList?: Snippet<[FileUploadEntry[]]>;
  /** Fires with accepted files after local validation passes. */
  onFilesAccepted?: (files: File[]) => void;
  /** Fires with the full resolved entry list after local validation changes it. */
  onFilesChange?: (entries: FileUploadEntry[]) => void;
  /** Fires with rejected files and reasons after local validation runs. */
  onReject?: (files: RejectedFile[]) => void;
  /** Called when the retry button is activated for a failed file. */
  onRetry?: (entry: FileUploadEntry) => void;
};

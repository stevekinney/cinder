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
};

export type FileUploadProps = Omit<
  HTMLInputAttributes,
  'type' | 'children' | 'onchange' | 'oninput' | 'value' | 'files'
> & {
  /** Stable id for the native file input. Required when composing with `FormField`. */
  id?: string;
  /** Native file accept filter. */
  accept?: string;
  /** Allow more than one file. Default `false`. */
  multiple?: boolean;
  /** Maximum allowed file size in bytes. */
  maxSize?: number;
  /** Disables the file picker and drag-and-drop surface. */
  disabled?: boolean;
  /** Native input name used for form submission. */
  name?: string;
  /** Additional classes merged with `.cinder-file-upload`. */
  class?: string;
  /** Visible text for the picker trigger button. Default `Choose files`. */
  triggerLabel?: string;
  /** Consumer-driven file rows, including upload progress and error states. */
  files?: FileUploadEntry[];
  /** Replaces the default resting-state dropzone body. */
  idle?: Snippet;
  /** Replaces the default drag-active dropzone body. */
  dragActive?: Snippet;
  /** Replaces the default file-list renderer. Receives the resolved rows. */
  fileList?: Snippet<[FileUploadEntry[]]>;
  /** Fires with accepted files after local validation passes. */
  onchange?: (files: File[]) => void;
  /** Fires with rejected files and reasons after local validation runs. */
  onreject?: (files: RejectedFile[]) => void;
};

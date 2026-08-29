import type { FileUploadStatus } from '@lostgradient/cinder';

import type { AttachmentKind } from './attachment-kind.ts';

/** Attachment metadata for files (images, code, documents). */
export interface ChatAttachment {
  id: string;
  file: File;
  previewUrl: string;
  kind: AttachmentKind;
  textContent?: string;
  /** Original pasted text restored to the composer when this promoted attachment is removed. */
  restoreText?: string;
  /** Original selection replaced when a promoted paste is restored. */
  restoreRange?: { start: number; end: number };
  status: FileUploadStatus;
  error?: string;
}

import type { FileUploadStatus } from '@lostgradient/cinder';

import type { AttachmentKind } from './attachment-kind.ts';

/** Attachment metadata for files (images, code, documents). */
export interface ChatAttachment {
  id: string;
  file: File;
  previewUrl: string;
  kind: AttachmentKind;
  textContent?: string;
  status: FileUploadStatus;
  error?: string;
}

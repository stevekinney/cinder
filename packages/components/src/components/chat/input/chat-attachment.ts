import type { AttachmentKind } from './attachment-kind.js';

/** Attachment metadata for files (images, code, documents). */
export interface ChatAttachment {
  id: string;
  file: File;
  previewUrl: string;
  kind: AttachmentKind;
  textContent?: string;
  status: 'pending' | 'uploading' | 'ready' | 'error';
  error?: string;
}

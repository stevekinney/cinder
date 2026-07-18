/** Discriminant for attachment rendering strategy. */
export type AttachmentKind = 'image' | 'code' | 'document';

/** MIME types treated as code beyond `text/*`. */
const CODE_MIME_TYPES = new Set([
  'application/json',
  'application/javascript',
  'application/typescript',
  'application/xml',
  'application/yaml',
  'application/x-yaml',
  'application/x-sh',
  'application/sql',
  'application/toml',
]);

/**
 * Derive the attachment kind from a MIME type string.
 *
 * - `image/*` → `'image'`
 * - `text/*` and known code MIME types → `'code'`
 * - Everything else → `'document'`
 */
export function deriveAttachmentKind(mimeType: string): AttachmentKind {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('text/') || CODE_MIME_TYPES.has(mimeType)) return 'code';
  return 'document';
}

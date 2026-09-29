/**
 * Builds the downloadable file for a diff review export (COR-509 / DR-6,
 * "Markdown/JSON downloads: review.md / review.json, exact MIME types,
 * UTF-8 with no BOM"). `content` is the exact string
 * `exportDiffReviewMarkdown`/`exportDiffReviewJson` produced — this module
 * never re-derives or mutates it, only wraps it for a browser download.
 */

/// <reference lib="dom" />

export type DiffReviewDownloadFormat = 'markdown' | 'json';

export interface DiffReviewDownloadFile {
  filename: string;
  mimeType: string;
  blob: Blob;
}

const DIFF_REVIEW_DOWNLOAD_MIME_TYPES: Record<DiffReviewDownloadFormat, string> = {
  markdown: 'text/markdown;charset=utf-8',
  json: 'application/json;charset=utf-8',
};

const DIFF_REVIEW_DOWNLOAD_FILENAMES: Record<DiffReviewDownloadFormat, string> = {
  markdown: 'review.md',
  json: 'review.json',
};

/**
 * `Blob` constructed directly from the UTF-16 string content, so no encoder
 * ever has the opportunity to prepend a byte-order mark.
 */
export function buildDiffReviewDownload(
  format: DiffReviewDownloadFormat,
  content: string,
): DiffReviewDownloadFile {
  const mimeType = DIFF_REVIEW_DOWNLOAD_MIME_TYPES[format];
  return {
    filename: DIFF_REVIEW_DOWNLOAD_FILENAMES[format],
    mimeType,
    blob: new Blob([content], { type: mimeType }),
  };
}

/**
 * Triggers a real browser download for `file` via a temporary, invisible
 * `<a download>` — the standard client-side download mechanism, with no
 * network round trip. `doc` defaults to the global `document` and is
 * injectable for tests.
 */
export function triggerDiffReviewDownload(
  file: DiffReviewDownloadFile,
  doc: Document = document,
): void {
  const url = URL.createObjectURL(file.blob);
  const anchor = doc.createElement('a');
  anchor.href = url;
  anchor.download = file.filename;
  doc.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

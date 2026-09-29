/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '@lostgradient/testing';
import { buildDiffReviewDownload, triggerDiffReviewDownload } from './diff-review-download.ts';

setupHappyDom();

describe('DiffReview component download', () => {
  test('markdown downloads as review.md with an exact UTF-8 Markdown MIME type', async () => {
    const file = buildDiffReviewDownload('markdown', '# Review feedback\n');
    expect(file.filename).toBe('review.md');
    expect(file.mimeType).toBe('text/markdown;charset=utf-8');
    expect(await file.blob.text()).toBe('# Review feedback\n');
  });

  test('JSON downloads as review.json with an exact UTF-8 JSON MIME type', async () => {
    const file = buildDiffReviewDownload('json', '{"schemaVersion":1}\n');
    expect(file.filename).toBe('review.json');
    expect(file.mimeType).toBe('application/json;charset=utf-8');
    expect(await file.blob.text()).toBe('{"schemaVersion":1}\n');
  });

  test('the produced bytes carry no UTF-8 byte-order mark', async () => {
    const file = buildDiffReviewDownload('markdown', 'content');
    const bytes = new Uint8Array(await file.blob.arrayBuffer());
    expect(bytes[0]).not.toBe(0xef);
  });

  test('triggering a download creates and clicks a temporary anchor with the right filename', () => {
    const file = buildDiffReviewDownload('json', '{}');
    let clicked = false;
    let appended = false;
    let removed = false;
    const anchor = {
      href: '',
      download: '',
      click: () => {
        clicked = true;
      },
      remove: () => {
        removed = true;
      },
    } as unknown as HTMLAnchorElement;
    const fakeDocument = {
      createElement: (tag: string) => {
        expect(tag).toBe('a');
        return anchor;
      },
      body: {
        appendChild: (element: unknown) => {
          expect(element).toBe(anchor);
          appended = true;
        },
      },
    } as unknown as Document;

    triggerDiffReviewDownload(file, fakeDocument);

    expect(anchor.download).toBe('review.json');
    expect(anchor.href.startsWith('blob:')).toBe(true);
    expect(clicked).toBe(true);
    expect(appended).toBe(true);
    expect(removed).toBe(true);
  });
});

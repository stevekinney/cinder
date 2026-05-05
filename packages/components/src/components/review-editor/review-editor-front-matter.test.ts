import type { CommentAnchor } from '@cinder/commentary/comments';
import { describe, expect, test } from 'bun:test';

import {
  bodyAnchorToDocumentAnchor,
  bodyAnchorUpdateToDocumentAnchorUpdate,
  combineFrontMatterAndBody,
  documentAnchorToBodyAnchor,
  parseReviewEditorFrontMatter,
  parseYamlFieldValue,
  replaceFrontMatterData,
  reviewStateToMarkdown,
  serializeYamlFieldValue,
} from './review-editor-front-matter.ts';

describe('review editor front matter helpers', () => {
  test('parses body and recombines the original front matter', () => {
    const markdown = '---\nowner: platform\nstatus: draft\n---\n\n# Architecture\n';
    const frontMatter = parseReviewEditorFrontMatter(markdown);

    expect(frontMatter.hasFrontMatter).toBe(true);
    expect(frontMatter.data).toEqual({ owner: 'platform', status: 'draft' });
    expect(frontMatter.body).toBe('\n# Architecture\n');
    expect(frontMatter.bodyOffset).toBe(markdown.length - frontMatter.body.length);
    expect(combineFrontMatterAndBody(frontMatter, frontMatter.body)).toBe(markdown);
  });

  test('replaces parsed front matter data while preserving the markdown body', () => {
    const markdown = '---\nowner: platform\nstatus: draft\n---\n\n# Architecture\n';
    const next = replaceFrontMatterData(markdown, { owner: 'platform', status: 'published' });

    expect(next).toContain('owner: platform');
    expect(next).toContain('status: published');
    expect(next.endsWith('\n# Architecture\n')).toBe(true);
  });

  test('keeps empty front matter editable as raw YAML', () => {
    const markdown = '---\n---\n\n# Architecture\n';
    const frontMatter = parseReviewEditorFrontMatter(markdown);

    expect(frontMatter.hasFrontMatter).toBe(true);
    expect(frontMatter.data).toBeNull();
    expect(frontMatter.raw).toBe('');
    expect(combineFrontMatterAndBody(frontMatter, frontMatter.body)).toBe(markdown);
  });

  test('reconstructs older body-only review state with front matter', () => {
    expect(
      reviewStateToMarkdown({
        content: '\n# Architecture\n',
        frontMatter: { owner: 'platform' },
        frontMatterRaw: 'owner: platform',
      }),
    ).toBe('---\nowner: platform\n---\n\n# Architecture\n');
  });

  test('round-trips complex field values through YAML text', () => {
    const raw = serializeYamlFieldValue({ labels: ['editor', 'review'], priority: 2 });
    const parsed = parseYamlFieldValue(raw);

    expect(parsed).toEqual({
      valid: true,
      value: { labels: ['editor', 'review'], priority: 2 },
    });
  });

  test('translates anchors between full-document and body-editor positions', () => {
    const anchor: CommentAnchor = {
      from: 42,
      to: 55,
      quote: 'Architecture',
      prefix: '# ',
      suffix: '\n',
      status: 'anchored',
      lastKnownOffset: 40,
      originalPosition: { offset: 40, line: 3, column: 1 },
    };

    const bodyAnchor = documentAnchorToBodyAnchor(anchor, 30);
    expect(bodyAnchor.from).toBe(12);
    expect(bodyAnchor.to).toBe(25);
    expect(bodyAnchor.lastKnownOffset).toBe(10);
    expect(bodyAnchor.originalPosition?.offset).toBe(10);

    const documentAnchor = bodyAnchorToDocumentAnchor(
      bodyAnchor,
      30,
      '---\nowner: platform\n---\n\n# Architecture\n',
    );
    expect(documentAnchor.from).toBe(42);
    expect(documentAnchor.originalPosition).toEqual({ offset: 40, line: 6, column: 1 });
    expect(
      bodyAnchorUpdateToDocumentAnchorUpdate(
        {
          threadId: 'thread-1',
          from: 12,
          to: 25,
          quote: 'Architecture',
          prefix: '# ',
          suffix: '\n',
          status: 'anchored',
          lastKnownOffset: 10,
        },
        30,
      ).lastKnownOffset,
    ).toBe(40);
  });
});

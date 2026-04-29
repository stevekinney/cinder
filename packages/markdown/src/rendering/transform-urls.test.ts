/**
 * Unit tests for transformUrls.
 *
 * DEP-565: Coverage hardening for @cinder/markdown.
 */

import { describe, expect, it } from 'bun:test';
import type { Definition, Image, Link, Paragraph, Root } from 'mdast';
import { transformUrls } from './transform-urls.js';

/** Create a minimal mdast Root with the given children. */
function createRoot(...children: Root['children']): Root {
  return { type: 'root', children };
}

/** Create a link node. */
function createLink(url: string): Link {
  return {
    type: 'link',
    url,
    children: [{ type: 'text', value: 'link text' }],
  };
}

/** Create an image node. */
function createImage(url: string): Image {
  return { type: 'image', url, alt: 'alt text' };
}

/** Create a definition node (for reference-style links). */
function createDefinition(url: string, identifier = 'ref'): Definition {
  return { type: 'definition', url, identifier, label: identifier };
}

/** Wrap nodes in a paragraph to form valid mdast. */
function paragraph(...children: Paragraph['children']): Paragraph {
  return { type: 'paragraph', children };
}

describe('transformUrls', () => {
  it('leaves safe https links unchanged', () => {
    const link = createLink('https://example.com');
    const root = createRoot(paragraph(link));
    const result = transformUrls(root);
    expect(link.url).toBe('https://example.com');
    expect(result.hadUnsafeUrls).toBe(false);
  });

  it('replaces javascript: link URL with #', () => {
    const link = createLink('javascript:alert(1)');
    const root = createRoot(paragraph(link));
    const result = transformUrls(root);
    expect(link.url).toBe('#');
    expect(result.hadUnsafeUrls).toBe(true);
  });

  it('replaces unsafe image URL with empty string', () => {
    const image = createImage('javascript:alert(1)');
    const root = createRoot(paragraph(image));
    const result = transformUrls(root);
    expect(image.url).toBe('');
    expect(result.hadUnsafeUrls).toBe(true);
  });

  it('leaves safe image URL unchanged', () => {
    const image = createImage('https://example.com/photo.png');
    const root = createRoot(paragraph(image));
    const result = transformUrls(root);
    expect(image.url).toBe('https://example.com/photo.png');
    expect(result.hadUnsafeUrls).toBe(false);
  });

  it('replaces unsafe definition URL with #', () => {
    const definition = createDefinition('javascript:alert(1)');
    const root = createRoot(definition);
    const result = transformUrls(root);
    expect(definition.url).toBe('#');
    expect(result.hadUnsafeUrls).toBe(true);
  });

  it('leaves safe definition URL unchanged', () => {
    const definition = createDefinition('https://docs.example.com');
    const root = createRoot(definition);
    const result = transformUrls(root);
    expect(definition.url).toBe('https://docs.example.com');
    expect(result.hadUnsafeUrls).toBe(false);
  });

  it('blocks data: image URL by default', () => {
    const image = createImage('data:image/png;base64,abc');
    const root = createRoot(paragraph(image));
    const result = transformUrls(root);
    expect(image.url).toBe('');
    expect(result.hadUnsafeUrls).toBe(true);
  });

  it('allows data: image URL when allowDataImages is true', () => {
    const image = createImage('data:image/png;base64,abc');
    const root = createRoot(paragraph(image));
    const result = transformUrls(root, { allowDataImages: true });
    expect(image.url).toBe('data:image/png;base64,abc');
    expect(result.hadUnsafeUrls).toBe(false);
  });

  it('returns the root in the result', () => {
    const root = createRoot();
    const result = transformUrls(root);
    expect(result.root).toBe(root);
  });

  it('handles multiple unsafe URLs in the same tree', () => {
    const link = createLink('javascript:void(0)');
    const image = createImage('vbscript:msgbox');
    const root = createRoot(paragraph(link, image));
    const result = transformUrls(root);
    expect(link.url).toBe('#');
    expect(image.url).toBe('');
    expect(result.hadUnsafeUrls).toBe(true);
  });
});

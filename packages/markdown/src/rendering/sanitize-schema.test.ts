/**
 * Unit tests for createSanitizeSchema.
 *
 * DEP-565: Coverage hardening for @cinder/markdown.
 */

import { describe, expect, it } from 'bun:test';
import { createSanitizeSchema, sanitizeSchema } from './sanitize-schema.js';

describe('createSanitizeSchema', () => {
  it('blocks script tags', () => {
    const schema = createSanitizeSchema();
    expect(schema.tagNames).not.toContain('script');
    expect(schema.strip).toContain('script');
  });

  it('blocks style tags', () => {
    const schema = createSanitizeSchema();
    expect(schema.tagNames).not.toContain('style');
    expect(schema.strip).toContain('style');
  });

  it('blocks iframe tags', () => {
    const schema = createSanitizeSchema();
    expect(schema.tagNames).not.toContain('iframe');
    expect(schema.strip).toContain('iframe');
  });

  it('blocks object, embed, link, and meta tags', () => {
    const schema = createSanitizeSchema();
    for (const tag of ['object', 'embed', 'link', 'meta']) {
      expect(schema.tagNames).not.toContain(tag);
      expect(schema.strip).toContain(tag);
    }
  });

  it('allows common safe tags (a, p, code, pre, img)', () => {
    const schema = createSanitizeSchema();
    expect(schema.tagNames).toContain('a');
    expect(schema.tagNames).toContain('p');
    expect(schema.tagNames).toContain('code');
    expect(schema.tagNames).toContain('pre');
    expect(schema.tagNames).toContain('img');
  });

  it('allows href and title attributes on anchors', () => {
    const schema = createSanitizeSchema();
    expect(schema.attributes?.a).toContain('href');
    expect(schema.attributes?.a).toContain('title');
  });

  it('allows src, alt, and title attributes on images', () => {
    const schema = createSanitizeSchema();
    expect(schema.attributes?.img).toContain('src');
    expect(schema.attributes?.img).toContain('alt');
    expect(schema.attributes?.img).toContain('title');
  });

  it('allows className on all elements via wildcard', () => {
    const schema = createSanitizeSchema();
    expect(schema.attributes?.['*']).toContain('className');
  });

  it('sets href protocols to http, https, mailto, tel', () => {
    const schema = createSanitizeSchema();
    expect(schema.protocols?.href).toEqual(['http', 'https', 'mailto', 'tel']);
  });

  it('excludes data from image protocols by default', () => {
    const schema = createSanitizeSchema();
    expect(schema.protocols?.src).not.toContain('data');
  });

  it('includes data in image protocols when allowDataImages is true', () => {
    const schema = createSanitizeSchema({ allowDataImages: true });
    expect(schema.protocols?.src).toContain('data');
    expect(schema.protocols?.src).toContain('http');
    expect(schema.protocols?.src).toContain('https');
  });

  it('still excludes data in image protocols when allowDataImages is false', () => {
    const schema = createSanitizeSchema({ allowDataImages: false });
    expect(schema.protocols?.src).not.toContain('data');
  });
});

describe('sanitizeSchema (default export)', () => {
  it('is a pre-built schema without data images', () => {
    expect(sanitizeSchema.protocols?.src).not.toContain('data');
    expect(sanitizeSchema.tagNames).not.toContain('script');
  });
});

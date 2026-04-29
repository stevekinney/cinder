import { describe, expect, it } from 'bun:test';
import { findSafeRenderBoundary, splitStreamingContent } from './render-streaming.js';

describe('findSafeRenderBoundary', () => {
  it('returns full length for simple text without special constructs', () => {
    const text = 'Hello world';
    expect(findSafeRenderBoundary(text)).toBe(text.length);
  });

  it('returns paragraph boundary for text with paragraphs', () => {
    const text = 'First paragraph.\n\nSecond paragraph in progress';
    expect(findSafeRenderBoundary(text)).toBe(text.indexOf('\n\n'));
  });

  it('returns line boundary when no paragraph break exists', () => {
    const text = 'Line one\nLine two in progress';
    expect(findSafeRenderBoundary(text)).toBe(text.indexOf('\n'));
  });

  describe('unclosed code fences', () => {
    it('detects unclosed backtick fence', () => {
      const text = 'Some text\n\n```typescript\nconst x = 1;\n';
      const boundary = findSafeRenderBoundary(text);
      expect(boundary).toBe(text.indexOf('```'));
    });

    it('detects unclosed tilde fence', () => {
      const text = 'Before\n\n~~~python\ndef hello():\n';
      const boundary = findSafeRenderBoundary(text);
      expect(boundary).toBe(text.indexOf('~~~'));
    });

    it('handles properly closed fence', () => {
      const text = 'Before\n\n```js\nconsole.log("hi");\n```\n\nAfter text';
      const boundary = findSafeRenderBoundary(text);
      // Should find paragraph boundary, not fence boundary
      expect(text.slice(0, boundary)).not.toContain('After');
    });

    it('handles multiple fences where the last is unclosed', () => {
      const text = '```js\nfirst\n```\n\nSome text\n\n```python\ndef hello():\n  pass\n';
      const boundary = findSafeRenderBoundary(text);
      // The boundary is at the start of the unclosed fence
      expect(boundary).toBe(text.lastIndexOf('```python'));
    });

    it('handles fence with longer closing', () => {
      const text = '```js\ncode\n````\n\nAfter';
      // ```` (4 backticks) closes ``` (3 backticks)
      const boundary = findSafeRenderBoundary(text);
      expect(boundary).toBe(text.indexOf('\n\n'));
    });
  });

  describe('unclosed tables', () => {
    it('detects table without trailing blank line', () => {
      const text = 'Before\n\n| Header |\n|--------|\n| Cell';
      const boundary = findSafeRenderBoundary(text);
      // Should split before the table
      expect(boundary).toBe(text.indexOf('\n\n'));
    });

    it('ignores completed tables (followed by blank line)', () => {
      const text = 'Before\n\n| H |\n|---|\n| C |\n\nAfter text';
      const boundary = findSafeRenderBoundary(text);
      // Table is complete, should find paragraph boundary
      expect(text.slice(0, boundary)).not.toContain('After');
    });
  });

  it('returns full length for empty string', () => {
    expect(findSafeRenderBoundary('')).toBe(0);
  });
});

describe('splitStreamingContent', () => {
  it('returns empty for empty input', () => {
    expect(splitStreamingContent('')).toEqual({ rendered: '', tail: '' });
  });

  it('puts everything in rendered when fully safe', () => {
    const text = 'Hello world';
    expect(splitStreamingContent(text)).toEqual({ rendered: text, tail: '' });
  });

  it('splits at paragraph boundary', () => {
    const text = 'Complete paragraph.\n\nPartial paragraph in pro';
    const result = splitStreamingContent(text);
    expect(result.rendered).toBe('Complete paragraph.');
    expect(result.tail).toBe('\n\nPartial paragraph in pro');
  });

  it('splits before unclosed code fence', () => {
    const text = 'Some text\n\n```typescript\nconst x = 1;\nconst y =';
    const result = splitStreamingContent(text);
    // Boundary is at the \n\n before the fence, so rendered includes trailing \n\n
    expect(result.rendered).toBe('Some text\n\n');
    expect(result.tail).toContain('```typescript');
  });

  it('handles null/undefined gracefully', () => {
    expect(splitStreamingContent(null as unknown as string)).toEqual({
      rendered: '',
      tail: '',
    });
    expect(splitStreamingContent(undefined as unknown as string)).toEqual({
      rendered: '',
      tail: '',
    });
  });
});

/**
 * Security tests for markdown rendering pipeline.
 *
 * DEP-49: XSS prevention and sanitization verification.
 *
 * These tests cover various XSS attack vectors to ensure the rendering
 * pipeline safely handles malicious content.
 */

import { beforeEach, describe, expect, it } from 'bun:test';
import { clearRenderCache, renderMarkdown } from './render.js';

describe('security: XSS prevention', () => {
  beforeEach(() => {
    clearRenderCache();
  });

  describe('script injection', () => {
    it('removes raw HTML script tags', () => {
      const result = renderMarkdown('<script>alert("xss")</script>');
      expect(result.html).not.toContain('<script');
      expect(result.html).not.toContain('alert');
      expect(result.hadUnsafeContent).toBe(true);
    });

    it('removes script tags with variations', () => {
      const vectors = [
        '<SCRIPT>alert(1)</SCRIPT>',
        '<ScRiPt>alert(1)</ScRiPt>',
        '<script src="evil.js"></script>',
        '<script type="text/javascript">alert(1)</script>',
      ];

      for (const vector of vectors) {
        const result = renderMarkdown(vector);
        expect(result.html.toLowerCase()).not.toContain('<script');
        expect(result.hadUnsafeContent).toBe(true);
      }
    });

    it('removes script tags with whitespace tricks', () => {
      // Malformed script tags are parsed as text by the markdown parser
      // The important thing is that no executable script tags appear
      const vectors = ['<scr ipt>alert(1)</script>', '<script\n>alert(1)</script>'];

      for (const vector of vectors) {
        const result = renderMarkdown(vector);
        // Ensure no actual script tags in output (text "alert" may appear as content)
        expect(result.html).not.toMatch(/<script[^>]*>/i);
      }
    });
  });

  describe('event handlers', () => {
    it('strips onerror from images', () => {
      const result = renderMarkdown('<img src="x" onerror="alert(1)">');
      expect(result.html).not.toContain('onerror');
      expect(result.html).not.toContain('alert');
    });

    it('strips onclick from links', () => {
      const result = renderMarkdown('<a href="#" onclick="alert(1)">click</a>');
      expect(result.html).not.toContain('onclick');
    });

    it('strips various event handlers', () => {
      const handlers = ['onload', 'onmouseover', 'onfocus', 'onsubmit', 'onchange'];

      for (const handler of handlers) {
        const result = renderMarkdown(`<div ${handler}="alert(1)">test</div>`);
        expect(result.html).not.toContain(handler);
      }
    });
  });

  describe('dangerous URLs', () => {
    it('sanitizes javascript: URLs in links', () => {
      const result = renderMarkdown('[click](javascript:alert(1))');
      expect(result.html).not.toContain('javascript:');
      expect(result.html).toContain('href="#"');
      expect(result.hadUnsafeContent).toBe(true);
    });

    it('sanitizes vbscript: URLs', () => {
      const result = renderMarkdown('[click](vbscript:msgbox(1))');
      expect(result.html).not.toContain('vbscript:');
      expect(result.hadUnsafeContent).toBe(true);
    });

    it('sanitizes data: URLs in links', () => {
      const result = renderMarkdown('[click](data:text/html,<script>alert(1)</script>)');
      expect(result.html).not.toContain('data:text/html');
      expect(result.hadUnsafeContent).toBe(true);
    });

    it('sanitizes file: URLs', () => {
      const result = renderMarkdown('[file](file:///etc/passwd)');
      expect(result.html).not.toContain('file:');
      expect(result.hadUnsafeContent).toBe(true);
    });

    it('sanitizes javascript: URLs with obfuscation', () => {
      const vectors = [
        '[x](javascript\n:alert(1))',
        '[x](java\tscript:alert(1))',
        '[x](&#106;avascript:alert(1))',
        '[x](jAvAsCrIpT:alert(1))',
      ];

      for (const vector of vectors) {
        const result = renderMarkdown(vector);
        expect(result.html.toLowerCase()).not.toContain('javascript:');
      }
    });

    it('sanitizes reference-style links with javascript: URLs', () => {
      // Reference-style links store URLs in definition nodes, not link nodes.
      // The transformUrls function must visit definition nodes to correctly
      // set the hadUnsafeContent flag.
      const result = renderMarkdown('[click me][xss]\n\n[xss]: javascript:alert(1)');
      expect(result.html).not.toContain('javascript:');
      // Link should render but without the dangerous href
      expect(result.html).toContain('click me');
      // hadUnsafeContent must be true for reference-style links with unsafe URLs
      expect(result.hadUnsafeContent).toBe(true);
    });

    it('allows safe protocols', () => {
      const safeUrls = [
        { markdown: '[http](http://example.com)', expected: 'http://example.com' },
        { markdown: '[https](https://example.com)', expected: 'https://example.com' },
        { markdown: '[email](mailto:test@example.com)', expected: 'mailto:test@example.com' },
        { markdown: '[phone](tel:+1234567890)', expected: 'tel:+1234567890' },
      ];

      for (const { markdown, expected } of safeUrls) {
        const result = renderMarkdown(markdown);
        expect(result.html).toContain(`href="${expected}"`);
        expect(result.hadUnsafeContent).toBe(false);
      }
    });

    it('allows relative URLs', () => {
      const relativeUrls = [
        { markdown: '[page](/path/to/page)', expected: '/path/to/page' },
        { markdown: '[relative](./relative)', expected: './relative' },
        { markdown: '[parent](../parent)', expected: '../parent' },
        { markdown: '[anchor](#section)', expected: '#section' },
      ];

      for (const { markdown, expected } of relativeUrls) {
        const result = renderMarkdown(markdown);
        expect(result.html).toContain(`href="${expected}"`);
        expect(result.hadUnsafeContent).toBe(false);
      }
    });
  });

  describe('dangerous image URLs', () => {
    it('sanitizes javascript: URLs in images', () => {
      const result = renderMarkdown('![img](javascript:alert(1))');
      expect(result.html).not.toContain('javascript:');
      expect(result.hadUnsafeContent).toBe(true);
    });

    it('blocks data: URLs in images by default', () => {
      const result = renderMarkdown('![img](data:image/png;base64,abc123)');
      // URL should be sanitized
      expect(result.html).not.toContain('data:image');
      expect(result.hadUnsafeContent).toBe(true);
    });

    it('allows data: image URLs when option enabled', () => {
      const result = renderMarkdown('![img](data:image/png;base64,abc123)', {
        allowDataImages: true,
      });
      expect(result.html).toContain('data:image/png');
      expect(result.hadUnsafeContent).toBe(false);
    });

    it('blocks data:text/html even with allowDataImages', () => {
      const result = renderMarkdown('![img](data:text/html,<script>alert(1)</script>)', {
        allowDataImages: true,
      });
      expect(result.html).not.toContain('data:text/html');
      expect(result.hadUnsafeContent).toBe(true);
    });
  });

  describe('dangerous tags', () => {
    it('removes iframe tags', () => {
      const result = renderMarkdown('<iframe src="https://evil.com"></iframe>');
      expect(result.html).not.toContain('<iframe');
      expect(result.hadUnsafeContent).toBe(true);
    });

    it('removes object tags', () => {
      const result = renderMarkdown('<object data="evil.swf"></object>');
      expect(result.html).not.toContain('<object');
    });

    it('removes embed tags', () => {
      const result = renderMarkdown('<embed src="evil.swf">');
      expect(result.html).not.toContain('<embed');
    });

    it('removes style tags', () => {
      const result = renderMarkdown('<style>body { background: red; }</style>');
      expect(result.html).not.toContain('<style');
    });

    it('removes link tags', () => {
      const result = renderMarkdown('<link rel="stylesheet" href="evil.css">');
      expect(result.html).not.toContain('<link');
    });

    it('removes meta tags', () => {
      const result = renderMarkdown('<meta http-equiv="refresh" content="0;url=evil.com">');
      expect(result.html).not.toContain('<meta');
    });
  });

  describe('inline styles', () => {
    it('strips style attributes from raw HTML', () => {
      const result = renderMarkdown('<div style="background:url(javascript:alert(1))">test</div>');
      expect(result.html).not.toContain('style=');
    });
  });

  describe('encoding bypasses', () => {
    it('handles HTML entity encoded scripts', () => {
      const result = renderMarkdown('&#60;script&#62;alert(1)&#60;/script&#62;');
      // HTML entities in markdown text are just text
      expect(result.html).not.toContain('<script');
    });

    it('handles URL encoded javascript', () => {
      const result = renderMarkdown('[x](javascript%3Aalert%281%29)');
      // remark leaves URL-encoded content in link URLs as-is,
      // so this encoded javascript: URL never matches the blocked protocols list
      expect(result.html).not.toContain('javascript:alert');
    });
  });

  describe('mixed content', () => {
    it('handles markdown mixed with dangerous HTML', () => {
      const markdown = `
# Safe Heading

<script>alert(1)</script>

This is **safe** markdown with [a link](https://example.com).

<iframe src="evil.com"></iframe>

\`\`\`js
// Code is safe
const x = 1;
\`\`\`
`;

      const result = renderMarkdown(markdown);

      // Safe content preserved
      expect(result.html).toContain('<h1>Safe Heading</h1>');
      expect(result.html).toContain('<strong>safe</strong>');
      expect(result.html).toContain('href="https://example.com"');
      expect(result.html).toContain('const x = 1;');

      // Dangerous content removed
      expect(result.html).not.toContain('<script');
      expect(result.html).not.toContain('<iframe');
      expect(result.hadUnsafeContent).toBe(true);
    });

    it('sanitizes multiple dangerous elements', () => {
      const result = renderMarkdown(`
<script>bad1</script>
<script>bad2</script>
<iframe>bad3</iframe>
[click](javascript:bad4)
`);

      expect(result.html).not.toContain('bad1');
      expect(result.html).not.toContain('bad2');
      expect(result.html).not.toContain('bad3');
      expect(result.html).not.toContain('javascript:');
      expect(result.hadUnsafeContent).toBe(true);
    });
  });

  describe('SSR compatibility', () => {
    it('does not use browser-only APIs', () => {
      // This test verifies that renderMarkdown works without DOM APIs
      // If it throws due to missing document/window, the test fails
      expect(() => {
        renderMarkdown('# Test\n\n[link](https://example.com)');
      }).not.toThrow();
    });
  });
});

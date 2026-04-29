/**
 * Security tests for Markdown editor.
 * DEP-47: Verify XSS prevention in URL validation and understand HTML handling.
 *
 * IMPORTANT ARCHITECTURAL NOTE:
 * The markdown parser (remark/unified) preserves raw HTML nodes in the AST.
 * HTML sanitization happens at RENDER time through:
 * 1. Svelte's auto-escaping when using {expression} (not @html)
 * 2. ProseMirror's node schema (only allows whitelisted nodes)
 * 3. Explicit sanitization for clipboard paste (sanitizeHtml)
 *
 * These tests verify:
 * - URL validation (isSafeUrl) blocks XSS vectors
 * - Protocol-based attacks are blocked
 * - Entity encoding bypass attempts are blocked
 * - Round-trip behavior is predictable
 */

import { parse, serialize } from '@cinder/markdown/pipeline';
import { isSafeUrl, sanitizeUrl } from '@cinder/markdown/utilities/safe-url';
import { describe, expect, it } from 'bun:test';

describe('URL Safety - Protocol Attacks', () => {
  describe('javascript: protocol', () => {
    const javascriptVectors = [
      'javascript:alert(1)',
      'javascript:alert(document.cookie)',
      'JAVASCRIPT:alert(1)',
      'JaVaScRiPt:alert(1)',
      'javascript\n:alert(1)',
      'javascript\t:alert(1)',
      'javascript\u0000:alert(1)',
      'java\u0000script:alert(1)',
      'java\u200bscript:alert(1)', // Zero-width space
      'java\u200cscript:alert(1)', // Zero-width non-joiner
      'java\u200dscript:alert(1)', // Zero-width joiner
      'java\ufeffscript:alert(1)', // BOM
      '&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;:alert(1)', // Entity encoded
      '&#x6A;&#x61;&#x76;&#x61;&#x73;&#x63;&#x72;&#x69;&#x70;&#x74;:alert(1)', // Hex entities
    ];

    it.each(javascriptVectors)('should block: %s', (vector) => {
      expect(isSafeUrl(vector)).toBe(false);
      expect(sanitizeUrl(vector)).toBe('');
    });
  });

  describe('vbscript: protocol', () => {
    const vbscriptVectors = [
      'vbscript:msgbox(1)',
      'VBSCRIPT:msgbox(1)',
      'vbscript:Execute()',
      'VbScRiPt:msgbox',
    ];

    it.each(vbscriptVectors)('should block: %s', (vector) => {
      expect(isSafeUrl(vector)).toBe(false);
    });
  });

  describe('data: protocol', () => {
    const dataVectors = [
      'data:text/html,<script>alert(1)</script>',
      'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
      'data:application/javascript,alert(1)',
      'data:text/javascript,alert(1)',
      'DATA:text/html,<script>alert(1)</script>',
    ];

    it.each(dataVectors)('should block XSS data: URLs: %s', (vector) => {
      expect(isSafeUrl(vector)).toBe(false);
    });

    it('should allow safe image data: URLs when explicitly enabled', () => {
      expect(isSafeUrl('data:image/png;base64,abc123', { allowDataImages: true })).toBe(true);
      expect(isSafeUrl('data:image/jpeg;base64,abc123', { allowDataImages: true })).toBe(true);
      expect(isSafeUrl('data:image/gif;base64,abc123', { allowDataImages: true })).toBe(true);
      expect(isSafeUrl('data:image/webp;base64,abc123', { allowDataImages: true })).toBe(true);
      expect(isSafeUrl('data:image/svg+xml;base64,abc123', { allowDataImages: true })).toBe(true);
    });

    it('should block image data: URLs by default', () => {
      expect(isSafeUrl('data:image/png;base64,abc123')).toBe(false);
    });
  });

  describe('file: protocol', () => {
    const fileVectors = [
      'file:///etc/passwd',
      'file://localhost/etc/passwd',
      'FILE:///C:/Windows/System32',
      'file:///C:/Users/victim/Documents',
    ];

    it.each(fileVectors)('should block: %s', (vector) => {
      expect(isSafeUrl(vector)).toBe(false);
    });
  });
});

describe('URL Safety - Allowed Protocols', () => {
  describe('safe protocols', () => {
    const safeUrls = [
      'https://example.com',
      'http://example.com',
      'mailto:user@example.com',
      'tel:+1234567890',
      '/relative/path',
      './current/relative',
      '../parent/relative',
      '#anchor',
      '?query=value',
    ];

    it.each(safeUrls)('should allow: %s', (url) => {
      expect(isSafeUrl(url)).toBe(true);
    });
  });

  describe('blocked protocols', () => {
    const blockedUrls = [
      'javascript:void(0)',
      'vbscript:execute',
      'file:///path',
      'ftp://example.com',
      'gopher://example.com',
      'ldap://example.com',
      '//example.com', // Protocol-relative (ambiguous)
      'example.com', // Bare hostname
    ];

    it.each(blockedUrls)('should block: %s', (url) => {
      expect(isSafeUrl(url)).toBe(false);
    });
  });
});

describe('Null Byte and Control Character Injection', () => {
  const nullByteVectors = ['java\x00script:alert(1)', 'javascript\x00:alert(1)'];

  it.each(nullByteVectors)('should block null bytes in URLs: %s', (vector) => {
    expect(isSafeUrl(vector)).toBe(false);
  });

  const controlCharVectors = [
    'java\x01script:alert(1)',
    'java\x02script:alert(1)',
    'java\x0bscript:alert(1)',
    'java\x0cscript:alert(1)',
    'java\x1fscript:alert(1)',
  ];

  it.each(controlCharVectors)('should block control characters in URLs: %s', (vector) => {
    expect(isSafeUrl(vector)).toBe(false);
  });
});

describe('Markdown Link URL Validation', () => {
  it('should handle javascript: links in markdown AST', () => {
    const markdown = '[Click me](javascript:alert(1))';
    const result = parse(markdown);

    // Parser successfully parses the markdown
    expect(result.success).toBe(true);

    if (result.success) {
      // Find the link node
      const linkNode = result.ast.children[0];
      expect(linkNode.type).toBe('paragraph');

      // The URL in the AST should be validated before use
      // This is done at render time, not parse time
      const url = 'javascript:alert(1)';
      expect(isSafeUrl(url)).toBe(false);
      expect(sanitizeUrl(url)).toBe('');
    }
  });

  it('should handle safe links in markdown', () => {
    const markdown = '[Safe link](https://example.com)';
    const result = parse(markdown);

    expect(result.success).toBe(true);
    if (result.success) {
      const output = serialize(result.ast);
      expect(output).toContain('https://example.com');
      expect(isSafeUrl('https://example.com')).toBe(true);
    }
  });
});

describe('HTML in Markdown - Parser Behavior', () => {
  /**
   * NOTE: These tests document the parser's behavior, not security enforcement.
   * The markdown parser preserves raw HTML in the AST. Security enforcement happens:
   * 1. At render time (Svelte auto-escaping, ProseMirror schema)
   * 2. Via clipboard paste sanitization (sanitizeHtml)
   */

  it('should parse raw HTML as HTML nodes', () => {
    const markdown = '<script>alert(1)</script>';
    const result = parse(markdown);

    // Parser successfully parses
    expect(result.success).toBe(true);

    if (result.success) {
      // HTML is preserved in AST (this is expected parser behavior)
      const output = serialize(result.ast);
      // The raw HTML is in the output - sanitization happens at render time
      expect(output).toContain('<script>');
    }
  });

  it('should preserve markdown structure around HTML', () => {
    const markdown = '# Heading\n\nSafe text.\n\n<div>HTML block</div>';
    const result = parse(markdown);

    expect(result.success).toBe(true);
    if (result.success) {
      const output = serialize(result.ast);
      expect(output).toContain('# Heading');
      expect(output).toContain('Safe text.');
    }
  });

  it('should handle inline code with suspicious content safely', () => {
    const markdown = 'Check this: `<script>alert(1)</script>`';
    const result = parse(markdown);

    expect(result.success).toBe(true);
    if (result.success) {
      const output = serialize(result.ast);
      // Content in backticks is safe (displayed as code, not executed)
      expect(output).toContain('`<script>alert(1)</script>`');
    }
  });

  it('should handle code blocks with suspicious content safely', () => {
    const markdown = '```html\n<script>alert(1)</script>\n```';
    const result = parse(markdown);

    expect(result.success).toBe(true);
    if (result.success) {
      const output = serialize(result.ast);
      // Content in code blocks is safe (displayed as code, not executed)
      expect(output).toContain('<script>alert(1)</script>');
    }
  });
});

describe('Round-trip Behavior', () => {
  it('should preserve safe markdown structures', () => {
    const input = `# Heading

Paragraph with **bold** and *italic*.

- List item 1
- List item 2

\`\`\`javascript
// Code is safe in code blocks
const x = "<script>alert(1)</script>";
\`\`\`

[Link](https://example.com)
`;

    const result = parse(input);
    expect(result.success).toBe(true);

    if (result.success) {
      const output = serialize(result.ast);

      // Safe structures should be preserved
      expect(output).toContain('# Heading');
      expect(output).toContain('**bold**');
      expect(output).toContain('*italic*');
      expect(output).toContain('- List item');
      expect(output).toContain('[Link](https://example.com)');
    }
  });

  it('should be deterministic for the same input', () => {
    const input = '# Test\n\nParagraph with [link](https://example.com).';

    const result1 = parse(input);
    const result2 = parse(input);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);

    if (result1.success && result2.success) {
      const output1 = serialize(result1.ast);
      const output2 = serialize(result2.ast);
      expect(output1).toBe(output2);
    }
  });
});

describe('URL Sanitization Integration', () => {
  it('should provide sanitizeUrl for rendering layer', () => {
    // This demonstrates how the rendering layer should use sanitizeUrl
    const urls = [
      { input: 'javascript:alert(1)', expected: '' },
      { input: 'https://safe.com', expected: 'https://safe.com' },
      { input: 'data:text/html,evil', expected: '' },
      { input: '/relative/path', expected: '/relative/path' },
    ];

    for (const { input, expected } of urls) {
      expect(sanitizeUrl(input)).toBe(expected);
    }
  });

  it('should handle edge cases in URL validation', () => {
    // Empty/whitespace
    expect(isSafeUrl('')).toBe(false);
    expect(isSafeUrl('   ')).toBe(false);
    expect(isSafeUrl('\t\n')).toBe(false);

    // Protocol variations
    expect(isSafeUrl('HTTPS://EXAMPLE.COM')).toBe(true);
    expect(isSafeUrl('Http://Example.Com')).toBe(true);

    // Fragment and query
    expect(isSafeUrl('#section-1')).toBe(true);
    expect(isSafeUrl('?page=1&sort=asc')).toBe(true);
    expect(isSafeUrl('/path?query=value#anchor')).toBe(true);
  });
});

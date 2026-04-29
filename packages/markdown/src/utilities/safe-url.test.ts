/**
 * Tests for URL safety validation utilities.
 * DEP-47: Security hardening for the review editor.
 */

import { describe, expect, it } from 'bun:test';
import { isSafeUrl, sanitizeUrl, sanitizeUrlWithFallback } from './safe-url';

describe('isSafeUrl', () => {
  describe('safe protocols', () => {
    it('allows http: URLs', () => {
      expect(isSafeUrl('http://example.com')).toBe(true);
      expect(isSafeUrl('http://example.com/path')).toBe(true);
      expect(isSafeUrl('http://example.com:8080/path?query=1')).toBe(true);
    });

    it('allows https: URLs', () => {
      expect(isSafeUrl('https://example.com')).toBe(true);
      expect(isSafeUrl('https://example.com/path')).toBe(true);
      expect(isSafeUrl('https://user:pass@example.com/path')).toBe(true);
    });

    it('allows mailto: URLs', () => {
      expect(isSafeUrl('mailto:user@example.com')).toBe(true);
      expect(isSafeUrl('mailto:user@example.com?subject=Hello')).toBe(true);
    });

    it('allows tel: URLs', () => {
      expect(isSafeUrl('tel:+1234567890')).toBe(true);
      expect(isSafeUrl('tel:555-1234')).toBe(true);
    });
  });

  describe('relative paths', () => {
    it('allows absolute paths starting with /', () => {
      expect(isSafeUrl('/path/to/resource')).toBe(true);
      expect(isSafeUrl('/path')).toBe(true);
      expect(isSafeUrl('/')).toBe(true);
    });

    it('allows current-relative paths starting with ./', () => {
      expect(isSafeUrl('./resource')).toBe(true);
      expect(isSafeUrl('./path/to/resource')).toBe(true);
    });

    it('allows parent-relative paths starting with ../', () => {
      expect(isSafeUrl('../resource')).toBe(true);
      expect(isSafeUrl('../../path/to/resource')).toBe(true);
    });

    it('allows fragment-only URLs', () => {
      expect(isSafeUrl('#anchor')).toBe(true);
      expect(isSafeUrl('#')).toBe(true);
    });

    it('allows query-only URLs', () => {
      expect(isSafeUrl('?query=value')).toBe(true);
      expect(isSafeUrl('?')).toBe(true);
    });

    it('blocks protocol-relative URLs (//)', () => {
      // These could be used to switch protocols
      expect(isSafeUrl('//example.com/path')).toBe(false);
    });
  });

  describe('blocked protocols - XSS vectors', () => {
    it('blocks javascript: URLs', () => {
      expect(isSafeUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeUrl('javascript:void(0)')).toBe(false);
      expect(isSafeUrl('javascript:')).toBe(false);
    });

    it('blocks vbscript: URLs', () => {
      expect(isSafeUrl('vbscript:msgbox(1)')).toBe(false);
      expect(isSafeUrl('vbscript:')).toBe(false);
    });

    it('blocks file: URLs', () => {
      expect(isSafeUrl('file:///etc/passwd')).toBe(false);
      expect(isSafeUrl('file://localhost/path')).toBe(false);
    });

    it('blocks data: URLs by default', () => {
      expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
      expect(isSafeUrl('data:image/png;base64,abc123')).toBe(false);
    });
  });

  describe('protocol obfuscation attacks', () => {
    it('handles case variations', () => {
      expect(isSafeUrl('JAVASCRIPT:alert(1)')).toBe(false);
      expect(isSafeUrl('JavaScript:alert(1)')).toBe(false);
      expect(isSafeUrl('jAvAsCrIpT:alert(1)')).toBe(false);
    });

    it('handles leading whitespace', () => {
      expect(isSafeUrl('  javascript:alert(1)')).toBe(false);
      expect(isSafeUrl('\tjavascript:alert(1)')).toBe(false);
      expect(isSafeUrl('\njavascript:alert(1)')).toBe(false);
    });

    it('handles control characters', () => {
      expect(isSafeUrl('java\x00script:alert(1)')).toBe(false);
      expect(isSafeUrl('java\x07script:alert(1)')).toBe(false);
      expect(isSafeUrl('java\x1fscript:alert(1)')).toBe(false);
    });

    it('handles zero-width characters', () => {
      expect(isSafeUrl('java\u200bscript:alert(1)')).toBe(false); // zero-width space
      expect(isSafeUrl('java\u200cscript:alert(1)')).toBe(false); // zero-width non-joiner
      expect(isSafeUrl('java\u200dscript:alert(1)')).toBe(false); // zero-width joiner
      expect(isSafeUrl('java\ufeffscript:alert(1)')).toBe(false); // BOM
    });

    it('handles soft hyphens', () => {
      expect(isSafeUrl('java\u00adscript:alert(1)')).toBe(false);
    });
  });

  describe('data: URLs with allowDataImages option', () => {
    it('allows safe image data URLs when option is enabled', () => {
      expect(isSafeUrl('data:image/png;base64,abc123', { allowDataImages: true })).toBe(true);
      expect(isSafeUrl('data:image/jpeg;base64,abc123', { allowDataImages: true })).toBe(true);
      expect(isSafeUrl('data:image/gif;base64,abc123', { allowDataImages: true })).toBe(true);
      expect(isSafeUrl('data:image/webp;base64,abc123', { allowDataImages: true })).toBe(true);
      expect(isSafeUrl('data:image/svg+xml;base64,abc123', { allowDataImages: true })).toBe(true);
      expect(isSafeUrl('data:image/avif;base64,abc123', { allowDataImages: true })).toBe(true);
    });

    it('blocks non-image data URLs even when option is enabled', () => {
      expect(isSafeUrl('data:text/html,<script>alert(1)</script>', { allowDataImages: true })).toBe(
        false,
      );
      expect(isSafeUrl('data:text/javascript,alert(1)', { allowDataImages: true })).toBe(false);
      expect(isSafeUrl('data:application/javascript,alert(1)', { allowDataImages: true })).toBe(
        false,
      );
    });

    it('still blocks image data URLs when option is disabled (default)', () => {
      expect(isSafeUrl('data:image/png;base64,abc123')).toBe(false);
      expect(isSafeUrl('data:image/png;base64,abc123', { allowDataImages: false })).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('blocks empty strings', () => {
      expect(isSafeUrl('')).toBe(false);
    });

    it('blocks whitespace-only strings', () => {
      expect(isSafeUrl('   ')).toBe(false);
      expect(isSafeUrl('\t\n')).toBe(false);
    });

    it('blocks bare hostnames without protocol', () => {
      // These are ambiguous - caller should add https:// prefix
      expect(isSafeUrl('example.com')).toBe(false);
      expect(isSafeUrl('example.com/path')).toBe(false);
    });

    it('blocks unknown protocols', () => {
      expect(isSafeUrl('ftp://example.com')).toBe(false);
      expect(isSafeUrl('gopher://example.com')).toBe(false);
      expect(isSafeUrl('custom://example.com')).toBe(false);
    });
  });
});

describe('sanitizeUrl', () => {
  it('returns the URL if safe', () => {
    expect(sanitizeUrl('https://example.com')).toBe('https://example.com');
    expect(sanitizeUrl('/path/to/resource')).toBe('/path/to/resource');
    expect(sanitizeUrl('#anchor')).toBe('#anchor');
  });

  it('returns empty string if unsafe', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBe('');
    expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('');
    expect(sanitizeUrl('')).toBe('');
  });

  it('passes through options', () => {
    expect(sanitizeUrl('data:image/png;base64,abc123')).toBe('');
    expect(sanitizeUrl('data:image/png;base64,abc123', { allowDataImages: true })).toBe(
      'data:image/png;base64,abc123',
    );
  });
});

describe('sanitizeUrlWithFallback', () => {
  it('returns the URL if safe', () => {
    expect(sanitizeUrlWithFallback('https://example.com', '#')).toBe('https://example.com');
  });

  it('returns fallback if unsafe', () => {
    expect(sanitizeUrlWithFallback('javascript:alert(1)', '#')).toBe('#');
    expect(sanitizeUrlWithFallback('javascript:alert(1)', '/safe/default')).toBe('/safe/default');
  });

  it('passes through options', () => {
    expect(
      sanitizeUrlWithFallback('data:image/png;base64,abc123', '#', { allowDataImages: true }),
    ).toBe('data:image/png;base64,abc123');
  });
});

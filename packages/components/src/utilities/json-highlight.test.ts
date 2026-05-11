import { describe, expect, test } from 'bun:test';

import { highlightJson } from './json-highlight.ts';

describe('highlightJson — valid JSON', () => {
  test('object: keys, strings, separators each get a token span', () => {
    const html = highlightJson('{"status": "ok"}');
    expect(html).toContain('cinder-json-token-key">"status"');
    expect(html).toContain('cinder-json-token-string">"ok"');
    expect(html).toContain('cinder-json-token-punctuation">{');
    expect(html).toContain('cinder-json-token-punctuation">}');
    expect(html).toContain('cinder-json-token-punctuation">:');
  });

  test('quoted string is valid JSON and renders as a single string token', () => {
    const html = highlightJson('"hello world"');
    expect(html).toContain('cinder-json-token-string">"hello world"');
    expect(html).not.toContain('cinder-json-token-key');
  });

  test('booleans and null have their own token classes', () => {
    const html = highlightJson('{"a": true, "b": null, "c": false}');
    expect(html).toContain('cinder-json-token-boolean">true');
    expect(html).toContain('cinder-json-token-boolean">false');
    expect(html).toContain('cinder-json-token-null">null');
  });

  test('numbers including exponents tokenize as a single number', () => {
    const html = highlightJson('1.5e-10');
    expect(html).toContain('cinder-json-token-number">1.5e-10');
  });

  test('empty object and empty array tokenize as punctuation only', () => {
    expect(highlightJson('{}')).toBe(
      '<code class="cinder-json"><span class="cinder-json-token cinder-json-token-punctuation">{</span><span class="cinder-json-token cinder-json-token-punctuation">}</span></code>',
    );
    expect(highlightJson('[]')).toBe(
      '<code class="cinder-json"><span class="cinder-json-token cinder-json-token-punctuation">[</span><span class="cinder-json-token cinder-json-token-punctuation">]</span></code>',
    );
  });

  test('whitespace between tokens is preserved verbatim', () => {
    const html = highlightJson('{\n  "a": 1\n}');
    // Newline + two-space indent between the value token and the closing brace.
    expect(html).toContain(
      '<span class="cinder-json-token cinder-json-token-number">1</span>\n<span class="cinder-json-token cinder-json-token-punctuation">}',
    );
    // Indentation is the two literal spaces between the opener and the key span.
    expect(html).toContain('>{</span>\n  <span class="cinder-json-token cinder-json-token-key"');
    // Newline before the closing brace is preserved.
    expect(html).toContain(
      '</span>\n<span class="cinder-json-token cinder-json-token-punctuation">}',
    );
  });

  test('escaped quote inside a string stays inside the same string token', () => {
    const html = highlightJson('"a\\"b"');
    expect(html).toContain('cinder-json-token-string">"a\\"b"');
  });

  test('nested arrays: strings inside an array are values, not keys', () => {
    const html = highlightJson('{"items": ["a", "b"]}');
    expect(html).toContain('cinder-json-token-key">"items"');
    expect(html).toContain('cinder-json-token-string">"a"');
    expect(html).toContain('cinder-json-token-string">"b"');
  });

  test('keys after a comma in an object are still classified as keys', () => {
    const html = highlightJson('{"a": 1, "b": 2}');
    expect(html).toContain('cinder-json-token-key">"a"');
    expect(html).toContain('cinder-json-token-key">"b"');
  });

  test('keys after a value containing escaped quotes still classify as keys', () => {
    // Regression: the previous backward-scan implementation skipped strings by
    // walking back to the next `"`, treating an escaped `\"` as the boundary.
    // For {"a": "foo\"bar", "b": 1} that produced a mis-classification of "b"
    // as a value string. The forward-stack tokenizer is immune.
    const html = highlightJson(JSON.stringify({ a: 'foo"bar', b: 1 }));
    expect(html).toContain('cinder-json-token-key">"b"');
    expect(html).not.toContain('cinder-json-token-string">"b"');
  });
});

describe('highlightJson — fallback paths', () => {
  test('plain text (not JSON) returns escaped <code> without token spans', () => {
    const html = highlightJson('hello world');
    expect(html).toBe('<code class="cinder-json">hello world</code>');
    expect(html).not.toContain('cinder-json-token-');
  });

  test('invalid JSON returns the plain fallback', () => {
    const html = highlightJson('{ broken: ');
    expect(html).toContain('<code class="cinder-json">');
    expect(html).not.toContain('cinder-json-token-');
  });
});

describe('highlightJson — HTML escaping', () => {
  test('special characters in valid JSON values are escaped, never injected', () => {
    const html = highlightJson('{"k": "<script>alert(1)</script>"}');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;/script&gt;');
  });

  test('special characters in non-JSON input are escaped', () => {
    const html = highlightJson('<img src=x onerror=alert(1)>');
    expect(html).toBe('<code class="cinder-json">&lt;img src=x onerror=alert(1)&gt;</code>');
  });

  test('ampersand in keys is escaped to &amp;', () => {
    const html = highlightJson('{"a&b": 1}');
    expect(html).toContain('cinder-json-token-key">"a&amp;b"');
  });
});

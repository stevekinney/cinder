/**
 * Unit tests for markdown rendering pipeline.
 *
 * DEP-49: Chat markdown rendering pipeline + sanitization.
 */

import { describe, expect, it } from 'bun:test';
import { renderMarkdown } from './render.js';
describe('stripLinks option', () => {
  it('strips links when stripLinks is true', () => {
    const result = renderMarkdown('[Example](https://example.com)', { stripLinks: true });
    expect(result.html).not.toContain('<a');
    expect(result.html).not.toContain('href');
    expect(result.html).toContain('Example');
  });

  it('preserves links when stripLinks is false or undefined', () => {
    const resultFalse = renderMarkdown('[Example](https://example.com)', { stripLinks: false });
    const resultUndefined = renderMarkdown('[Example](https://example.com)');

    expect(resultFalse.html).toContain('<a href="https://example.com">Example</a>');
    expect(resultUndefined.html).toContain('<a href="https://example.com">Example</a>');
  });

  it('preserves link text when stripping links', () => {
    const result = renderMarkdown('Check out [the docs](https://docs.example.com) for more info.', {
      stripLinks: true,
    });
    expect(result.html).toContain('the docs');
    expect(result.html).not.toContain('href');
  });

  it('handles multiple links when stripping', () => {
    const result = renderMarkdown('[First](https://first.com) and [Second](https://second.com)', {
      stripLinks: true,
    });
    expect(result.html).toContain('First');
    expect(result.html).toContain('Second');
    expect(result.html).not.toContain('<a');
  });

  it('preserves nested formatting within stripped links', () => {
    const result = renderMarkdown('[**Bold link text**](https://example.com)', {
      stripLinks: true,
    });
    expect(result.html).toContain('<strong>Bold link text</strong>');
    expect(result.html).not.toContain('<a');
  });

  it('strips autolinks', () => {
    const result = renderMarkdown('<https://example.com>', { stripLinks: true });
    expect(result.html).not.toContain('<a');
    expect(result.html).toContain('https://example.com');
  });

  it('strips reference-style links', () => {
    const markdown =
      'Check out [the docs][docs] for more info.\n\n[docs]: https://docs.example.com';
    const result = renderMarkdown(markdown, { stripLinks: true });
    expect(result.html).toContain('the docs');
    expect(result.html).not.toContain('<a');
    expect(result.html).not.toContain('href');
  });

  it('strips shortcut reference links', () => {
    const markdown = 'See [example] for details.\n\n[example]: https://example.com';
    const result = renderMarkdown(markdown, { stripLinks: true });
    expect(result.html).toContain('example');
    expect(result.html).not.toContain('<a');
  });

  it('strips collapsed reference links', () => {
    const markdown = 'Read the [docs][] here.\n\n[docs]: https://docs.example.com';
    const result = renderMarkdown(markdown, { stripLinks: true });
    expect(result.html).toContain('docs');
    expect(result.html).not.toContain('<a');
  });

  it('preserves reference-style images when stripping links', () => {
    const markdown = 'See the ![logo][img] for branding.\n\n[img]: https://example.com/logo.png';
    const result = renderMarkdown(markdown, { stripLinks: true });
    expect(result.html).toContain('<img');
    expect(result.html).toContain('src="https://example.com/logo.png"');
    expect(result.html).toContain('alt="logo"');
  });

  it('strips links but preserves images in mixed content', () => {
    const markdown =
      'Check [the docs][docs] and see ![diagram][img].\n\n[docs]: https://docs.example.com\n[img]: https://example.com/diagram.png';
    const result = renderMarkdown(markdown, { stripLinks: true });
    // Link should be stripped
    expect(result.html).toContain('the docs');
    expect(result.html).not.toContain('href="https://docs.example.com"');
    // Image should be preserved
    expect(result.html).toContain('<img');
    expect(result.html).toContain('src="https://example.com/diagram.png"');
  });

  it('preserves images when definition is shared with link', () => {
    // Edge case: same identifier used for both link and image
    const markdown =
      'See [the resource][ref] or ![the resource][ref].\n\n[ref]: https://example.com/resource';
    const result = renderMarkdown(markdown, { stripLinks: true });
    // Link should be stripped (text preserved)
    expect(result.html).toContain('the resource');
    // Image should still work because we don't remove shared definitions
    expect(result.html).toContain('<img');
    expect(result.html).toContain('src="https://example.com/resource"');
  });
});

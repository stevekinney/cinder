/**
 * Tests for the GitHub-alert → Cinder Callout rewrite.
 *
 * These deliberately go through `renderMarkdown` / `renderMarkdownWithMath`
 * rather than driving the plugin in isolation. Two failure modes only show up
 * end-to-end:
 *
 *   1. The plugin is registered on a processor whose `.parse()` never runs
 *      transformers, so it is wired up but never called.
 *   2. The markup is produced correctly and then quietly dismantled by
 *      `rehype-sanitize`, whose `'*': ['className']` entry REPLACES the
 *      default wildcard allowlist. A stripped `data-cinder-variant` renders an
 *      un-themed callout, which looks exactly like the plugin not matching.
 */

import { describe, expect, it } from 'bun:test';
import type { Element, Root } from 'hast';
import { sanitize } from 'hast-util-sanitize';

import { clearRenderCache, renderMarkdown, renderMarkdownWithMath } from './render.js';
import { createSanitizeSchema } from './sanitize-schema.js';

describe('GitHub callouts through the full render pipeline', () => {
  it('survives sanitization with its variant, role, and label intact', () => {
    clearRenderCache();
    const { html } = renderMarkdown('> [!WARNING]\n> Do not do this.');

    // The attribute this test exists for. `data-cinder-variant` is what
    // selects the color treatment in callout.css; without the sanitizer
    // widening it is dropped and the callout renders un-themed.
    expect(html).toContain('data-cinder-variant="warning"');
    expect(html).toContain('role="note"');
    expect(html).toContain('aria-label="Warning"');
    expect(html).toContain('class="cinder-callout');
    expect(html).toContain('cinder-callout__title');
    expect(html).toContain('cinder-callout__content');
    expect(html).toContain('Do not do this.');

    // The marker itself must be gone — leaking it is the bug being fixed.
    expect(html).not.toContain('[!WARNING]');
  });

  it('maps all five GitHub alert types onto Cinder variants', () => {
    const cases: ReadonlyArray<[string, string, string]> = [
      ['NOTE', 'info', 'Note'],
      ['TIP', 'success', 'Tip'],
      ['IMPORTANT', 'info', 'Important'],
      ['WARNING', 'warning', 'Warning'],
      ['CAUTION', 'danger', 'Caution'],
    ];

    for (const [marker, variant, title] of cases) {
      clearRenderCache();
      const { html } = renderMarkdown(`> [!${marker}]\n> Body text.`);
      expect(html).toContain(`data-cinder-variant="${variant}"`);
      expect(html).toContain(`<p class="cinder-callout__title">${title}</p>`);
      expect(html).not.toContain(`[!${marker}]`);
    }
  });

  it('accepts the lowercase spelling GitHub also accepts', () => {
    clearRenderCache();
    const { html } = renderMarkdown('> [!caution]\n> Careful.');
    expect(html).toContain('data-cinder-variant="danger"');
  });

  it('uses same-line trailing text as the callout title', () => {
    clearRenderCache();
    const { html } = renderMarkdown(
      '> [!IMPORTANT] Chat needs a definite-height ancestor\n> Body.',
    );
    expect(html).toContain(
      '<p class="cinder-callout__title">Chat needs a definite-height ancestor</p>',
    );
    expect(html).toContain('aria-label="Chat needs a definite-height ancestor"');
    expect(html).toContain('data-cinder-variant="info"');
  });

  it('falls back to the default title when the rest of the line is inline markup', () => {
    // `\`someApi\`` parses into a separate inlineCode node, so the marker's own
    // text run ends right after the bracket. The styled remainder belongs to
    // the body rather than being flattened into a plain-text title.
    clearRenderCache();
    const { html } = renderMarkdown('> [!WARNING] `subscribe` runs inside an effect\n> Body.');
    expect(html).toContain('<p class="cinder-callout__title">Warning</p>');
    expect(html).toContain('<code>subscribe</code>');
  });

  it('leaves ordinary blockquotes alone', () => {
    clearRenderCache();
    const { html } = renderMarkdown('> Just a quotation.');
    expect(html).toContain('<blockquote>');
    expect(html).not.toContain('cinder-callout');
  });

  it('does not promote a marker that appears mid-sentence', () => {
    clearRenderCache();
    const { html } = renderMarkdown('> See the [!NOTE] convention below.');
    expect(html).toContain('<blockquote>');
    expect(html).not.toContain('cinder-callout');
  });

  it('runs on the math-aware pipeline too', async () => {
    // Both processors have to carry the plugin; the math pipeline is a
    // separate `unified()` chain that is easy to forget.
    clearRenderCache();
    const { html } = await renderMarkdownWithMath('> [!TIP]\n> Inline math $x = 1$ here.');
    expect(html).toContain('data-cinder-variant="success"');
    expect(html).toContain('katex');
  });
});

describe('sanitize schema: div attribute allowlist', () => {
  /** Sanitize a single-element hast tree and return the surviving properties. */
  function sanitizeProperties(properties: Element['properties']): Element['properties'] {
    const tree: Root = {
      type: 'root',
      children: [{ type: 'element', tagName: 'div', properties, children: [] }],
    };
    const cleaned = sanitize(tree, createSanitizeSchema()) as Root;
    const element = cleaned.children[0];
    return element?.type === 'element' ? element.properties : undefined;
  }

  it('keeps the callout attributes', () => {
    const properties = sanitizeProperties({
      className: ['cinder-callout'],
      dataCinderVariant: 'warning',
      role: 'note',
      ariaLabel: 'Warning',
    });

    expect(properties?.['dataCinderVariant']).toBe('warning');
    expect(properties?.['role']).toBe('note');
    expect(properties?.['ariaLabel']).toBe('Warning');
  });

  it('drops a role other than note, so div cannot claim an arbitrary role', () => {
    // The reason `role` is scoped to `div` with a value allowlist rather than
    // added to the `'*'` entry: a global `role` would let any document spoof
    // any element's semantics.
    expect(sanitizeProperties({ role: 'button' })?.['role']).toBeUndefined();
    expect(sanitizeProperties({ role: 'alert' })?.['role']).toBeUndefined();
  });

  it('drops a variant outside the four Cinder ships', () => {
    expect(
      sanitizeProperties({ dataCinderVariant: 'evil' })?.['dataCinderVariant'],
    ).toBeUndefined();
  });

  it('does not grant role to other elements', () => {
    const tree: Root = {
      type: 'root',
      children: [{ type: 'element', tagName: 'p', properties: { role: 'note' }, children: [] }],
    };
    const cleaned = sanitize(tree, createSanitizeSchema()) as Root;
    const element = cleaned.children[0];
    expect(element?.type === 'element' ? element.properties['role'] : undefined).toBeUndefined();
  });
});

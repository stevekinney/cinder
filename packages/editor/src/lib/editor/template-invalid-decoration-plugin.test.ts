/**
 * Tests for the template invalid decoration plugin internal logic.
 *
 * DEP-583: Validates that buildInvalidTokenDecorations correctly identifies
 * invalid `{{…}}` tokens in ProseMirror documents and creates decorations
 * with the expected CSS classes and data attributes.
 *
 * These tests run in Node environment using ProseMirror's model layer
 * (no DOM required).
 */

import type { PlaceholderCandidate } from '@lostgradient/markdown';
import { Schema } from '@milkdown/kit/prose/model';
import { describe, expect, it } from 'bun:test';

import { buildInvalidTokenDecorations } from './template-invalid-decoration-plugin.js';

// ---------------------------------------------------------------------------
// Test schema — minimal ProseMirror schema sufficient for document creation.
// ---------------------------------------------------------------------------

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: {
      content: 'inline*',
      group: 'block',
      parseDOM: [{ tag: 'p' }],
      toDOM() {
        return ['p', 0];
      },
    },
    heading: {
      attrs: { level: { default: 1 } },
      content: 'inline*',
      group: 'block',
      parseDOM: [{ tag: 'h1', attrs: { level: 1 } }],
      toDOM(node) {
        return [`h${node.attrs['level']}`, 0];
      },
    },
    code_block: {
      content: 'text*',
      group: 'block',
      code: true,
      marks: '',
      toDOM() {
        return ['pre', ['code', 0]];
      },
    },
    hard_break: {
      inline: true,
      group: 'inline',
      selectable: false,
      toDOM() {
        return ['br'];
      },
    },
    text: { group: 'inline' },
  },
  marks: {
    link: {
      attrs: { href: {} },
      toDOM(mark) {
        return ['a', { href: String(mark.attrs['href']) }, 0];
      },
    },
    strong: {
      parseDOM: [{ tag: 'strong' }],
      toDOM() {
        return ['strong', 0];
      },
    },
    emphasis: {
      toDOM() {
        return ['em', 0];
      },
    },
    inlineCode: {
      code: true,
      toDOM() {
        return ['code', 0];
      },
    },
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_INVALID_CLASS = 'template-placeholder-invalid';

function makeCandidates(...paths: string[]): PlaceholderCandidate[] {
  return paths.map((path) => ({ path, types: ['string'] }));
}

/**
 * Extract the inline decoration attributes from a Decoration object.
 *
 * ProseMirror's `Decoration.inline()` stores attributes on `decoration.type.attrs`.
 */
function getDecorationAttributes(decoration: unknown): Record<string, string> {
  if (!decoration || typeof decoration !== 'object') throw new Error('Missing decoration');
  const type = Reflect.get(decoration, 'type');
  const attributes = type && typeof type === 'object' ? Reflect.get(type, 'attrs') : undefined;
  if (!attributes || typeof attributes !== 'object')
    throw new Error('Missing decoration attributes');
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (typeof value !== 'string') throw new Error('Invalid decoration attributes');
    result[key] = value;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Per-run scanning (COR-526)
// ---------------------------------------------------------------------------

describe('buildInvalidTokenDecorations per-run scanning', () => {
  function reasons(doc: ReturnType<typeof schema.node>, candidates: PlaceholderCandidate[]) {
    return buildInvalidTokenDecorations(doc, candidates, DEFAULT_INVALID_CLASS).map(
      (decoration) => ({
        from: decoration.from,
        to: decoration.to,
        reason: getDecorationAttributes(decoration)['data-placeholder-validation-reason'],
      }),
    );
  }

  it('decorates a token inside one marked run at its exact range', () => {
    // "a " plain (positions 1-2), then "{{nope}}" bold (positions 3-10).
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [
        schema.text('a '),
        schema.text('{{nope}}', [schema.mark('strong')]),
      ]),
    ]);

    expect(reasons(doc, [])).toEqual([{ from: 3, to: 11, reason: 'unknown_placeholder' }]);
  });

  it('never joins text across a mark boundary into one token', () => {
    // "{{" plain + "known" bold + "}}" plain: each run is scanned alone, so
    // only the unclosed "{{" is reported and "known" is never validated.
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [
        schema.text('{{'),
        schema.text('known', [schema.mark('strong')]),
        schema.text('}}'),
      ]),
    ]);

    expect(reasons(doc, makeCandidates('known'))).toEqual([
      { from: 1, to: 3, reason: 'malformed_token' },
    ]);
  });

  it('reports the emphasis-split form of {{_meta_}} as a malformed opener, not a token', () => {
    // Loading the Markdown `{{_meta_}}` produces "{{" + emphasis("meta") + "}}".
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [
        schema.text('{{'),
        schema.text('meta', [schema.mark('emphasis')]),
        schema.text('}}'),
      ]),
    ]);

    expect(reasons(doc, makeCandidates('_meta_'))).toEqual([
      { from: 1, to: 3, reason: 'malformed_token' },
    ]);
  });

  it('decorates a token after a hard break at its exact range', () => {
    // "ab" (1-2), hard break (3), "{{nope}}" (4-11).
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [
        schema.text('ab'),
        schema.node('hard_break'),
        schema.text('{{nope}}'),
      ]),
    ]);

    expect(reasons(doc, [])).toEqual([{ from: 4, to: 12, reason: 'unknown_placeholder' }]);
  });

  it('decorates a token in link label text and never scans the link target', () => {
    const link = schema.mark('link', { href: 'https://example.com/{{target}}' });
    // "see " (1-4), then "{{nope}}" as the link label (5-12).
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('see '), schema.text('{{nope}}', [link])]),
    ]);

    expect(reasons(doc, [])).toEqual([{ from: 5, to: 13, reason: 'unknown_placeholder' }]);
  });

  it('does not scan inline code or code blocks', () => {
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('{{nope}}', [schema.mark('inlineCode')])]),
      schema.node('code_block', null, [schema.text('{{nope}}')]),
    ]);

    expect(reasons(doc, [])).toEqual([]);
  });

  it('reports blocked paths with their own reason', () => {
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('{{user.__proto__}}')]),
    ]);

    expect(reasons(doc, [])).toEqual([{ from: 1, to: 19, reason: 'blocked_path' }]);
  });
});

// ---------------------------------------------------------------------------
// buildInvalidTokenDecorations
// ---------------------------------------------------------------------------

describe('buildInvalidTokenDecorations', () => {
  it('returns no decorations for a valid token that matches a known candidate', () => {
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('Hello {{input.name}} world')]),
    ]);
    const candidates = makeCandidates('input.name');

    const decorations = buildInvalidTokenDecorations(doc, candidates, DEFAULT_INVALID_CLASS);

    expect(decorations).toHaveLength(0);
  });

  it('produces a decoration for an unknown placeholder', () => {
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('Use {{input.unknown}} here')]),
    ]);
    const candidates = makeCandidates('input.name');

    const decorations = buildInvalidTokenDecorations(doc, candidates, DEFAULT_INVALID_CLASS);

    expect(decorations).toHaveLength(1);

    const attributes = getDecorationAttributes(decorations[0]);
    expect(attributes['class']).toBe(DEFAULT_INVALID_CLASS);
    expect(attributes['data-placeholder-validation-reason']).toBe('unknown_placeholder');
  });

  it('produces a decoration for a malformed (unclosed) token', () => {
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('Check {{unclosed')]),
    ]);
    const candidates = makeCandidates('unclosed');

    const decorations = buildInvalidTokenDecorations(doc, candidates, DEFAULT_INVALID_CLASS);

    expect(decorations).toHaveLength(1);

    const attributes = getDecorationAttributes(decorations[0]);
    expect(attributes['class']).toBe(DEFAULT_INVALID_CLASS);
    expect(attributes['data-placeholder-validation-reason']).toBe('malformed_token');
  });

  it('produces a decoration for a token with invalid path format', () => {
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('Bad {{123invalid}}')]),
    ]);
    const candidates = makeCandidates();

    const decorations = buildInvalidTokenDecorations(doc, candidates, DEFAULT_INVALID_CLASS);

    expect(decorations).toHaveLength(1);

    const attributes = getDecorationAttributes(decorations[0]);
    expect(attributes['class']).toBe(DEFAULT_INVALID_CLASS);
    expect(attributes['data-placeholder-validation-reason']).toBe('invalid_path_format');
  });

  it('produces decorations across multiple paragraphs', () => {
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('First {{bad1}}')]),
      schema.node('paragraph', null, [schema.text('Second {{bad2}}')]),
    ]);
    const candidates = makeCandidates();

    const decorations = buildInvalidTokenDecorations(doc, candidates, DEFAULT_INVALID_CLASS);

    expect(decorations).toHaveLength(2);

    // Both should be unknown_placeholder since the paths are valid format but
    // not in candidates.
    for (const decoration of decorations) {
      const attributes = getDecorationAttributes(decoration);
      expect(attributes['data-placeholder-validation-reason']).toBe('unknown_placeholder');
    }
  });

  it('applies a custom CSS class when provided', () => {
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('{{unknown_field}}')]),
    ]);
    const candidates = makeCandidates();
    const customClass = 'my-custom-invalid-class';

    const decorations = buildInvalidTokenDecorations(doc, candidates, customClass);

    expect(decorations).toHaveLength(1);
    const attributes = getDecorationAttributes(decorations[0]);
    expect(attributes['class']).toBe(customClass);
  });

  it('only decorates invalid tokens when valid and invalid tokens are mixed', () => {
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [
        schema.text('Valid: {{name}}, Invalid: {{missing}}, Also valid: {{age}}'),
      ]),
    ]);
    const candidates = makeCandidates('name', 'age');

    const decorations = buildInvalidTokenDecorations(doc, candidates, DEFAULT_INVALID_CLASS);

    expect(decorations).toHaveLength(1);
    const attributes = getDecorationAttributes(decorations[0]);
    expect(attributes['data-placeholder-validation-reason']).toBe('unknown_placeholder');
  });

  it('returns no decorations for an empty document', () => {
    const doc = schema.node('doc', null, [schema.node('paragraph', null, [])]);
    const candidates = makeCandidates('name');

    const decorations = buildInvalidTokenDecorations(doc, candidates, DEFAULT_INVALID_CLASS);

    expect(decorations).toHaveLength(0);
  });

  it('returns no decorations for a document with no placeholder tokens', () => {
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('Just regular text without any templates.')]),
    ]);
    const candidates = makeCandidates('name');

    const decorations = buildInvalidTokenDecorations(doc, candidates, DEFAULT_INVALID_CLASS);

    expect(decorations).toHaveLength(0);
  });

  it('computes correct from/to positions for a single-paragraph document', () => {
    // Document structure:
    //   doc (pos 0)
    //     paragraph (pos 0, content starts at 1)
    //       text: "ab{{bad}}cd"
    //
    // "{{bad}}" starts at text offset 2 and ends at text offset 9.
    // In the document: from = 1 + 2 = 3, to = 1 + 9 = 10.
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('ab{{bad}}cd')]),
    ]);
    const candidates = makeCandidates();

    const decorations = buildInvalidTokenDecorations(doc, candidates, DEFAULT_INVALID_CLASS);

    expect(decorations).toHaveLength(1);
    expect(decorations[0]!.from).toBe(3);
    expect(decorations[0]!.to).toBe(10);
  });

  it('computes correct positions for tokens in a second paragraph', () => {
    // Document structure:
    //   doc (pos 0)
    //     paragraph (pos 0, content: "first", size 7 = 1 open + 5 text + 1 close)
    //     paragraph (pos 7, content starts at 8)
    //       text: "{{bad}}"
    //
    // "{{bad}}" starts at text offset 0 and ends at text offset 7.
    // In the document: from = 8 + 0 = 8, to = 8 + 7 = 15.
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('first')]),
      schema.node('paragraph', null, [schema.text('{{bad}}')]),
    ]);
    const candidates = makeCandidates();

    const decorations = buildInvalidTokenDecorations(doc, candidates, DEFAULT_INVALID_CLASS);

    expect(decorations).toHaveLength(1);
    expect(decorations[0]!.from).toBe(8);
    expect(decorations[0]!.to).toBe(15);
  });

  it('handles multiple invalid tokens in the same paragraph', () => {
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('{{bad1}} and {{bad2}}')]),
    ]);
    const candidates = makeCandidates();

    const decorations = buildInvalidTokenDecorations(doc, candidates, DEFAULT_INVALID_CLASS);

    expect(decorations).toHaveLength(2);

    // First token: "{{bad1}}" at text offset 0..8 => doc position 1..9
    expect(decorations[0]!.from).toBe(1);
    expect(decorations[0]!.to).toBe(9);

    // Second token: "{{bad2}}" at text offset 13, endOffset 21 => doc position 14..22
    expect(decorations[1]!.from).toBe(14);
    expect(decorations[1]!.to).toBe(22);
  });

  it('works with heading nodes (not just paragraphs)', () => {
    const doc = schema.node('doc', null, [
      schema.node('heading', { level: 1 }, [schema.text('Title {{unknown}}')]),
    ]);
    const candidates = makeCandidates();

    const decorations = buildInvalidTokenDecorations(doc, candidates, DEFAULT_INVALID_CLASS);

    expect(decorations).toHaveLength(1);
    const attributes = getDecorationAttributes(decorations[0]);
    expect(attributes['data-placeholder-validation-reason']).toBe('unknown_placeholder');
  });

  it('handles empty body token {{}} as invalid_path_format', () => {
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('empty {{}} token')]),
    ]);
    const candidates = makeCandidates();

    const decorations = buildInvalidTokenDecorations(doc, candidates, DEFAULT_INVALID_CLASS);

    expect(decorations).toHaveLength(1);
    const attributes = getDecorationAttributes(decorations[0]);
    expect(attributes['data-placeholder-validation-reason']).toBe('invalid_path_format');
  });

  it('returns empty array with empty candidates and no tokens', () => {
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('no tokens here')]),
    ]);

    const decorations = buildInvalidTokenDecorations(doc, [], DEFAULT_INVALID_CLASS);

    expect(decorations).toHaveLength(0);
  });
});

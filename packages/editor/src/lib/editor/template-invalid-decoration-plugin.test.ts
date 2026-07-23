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

import type { PlaceholderCandidate } from '@lostgradient/markdown/templates/types';
import { Schema } from '@milkdown/kit/prose/model';
import { describe, expect, it } from 'bun:test';

import {
  buildInvalidTokenDecorations,
  textOffsetToDocumentPosition,
} from './template-invalid-decoration-plugin.js';

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
    text: { group: 'inline' },
  },
  marks: {
    strong: {
      parseDOM: [{ tag: 'strong' }],
      toDOM() {
        return ['strong', 0];
      },
    },
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_INVALID_CLASS = 'template-placeholder-invalid';

function makeCandidates(...paths: string[]): PlaceholderCandidate[] {
  return paths.map((path) => ({
    path,
    description: undefined,
    valueKind: 'string' as const,
  }));
}

/**
 * Extract the inline decoration attributes from a Decoration object.
 *
 * ProseMirror's `Decoration.inline()` stores attributes on `decoration.type.attrs`.
 */
function getDecorationAttributes(decoration: unknown): Record<string, string> {
  return (decoration as any).type.attrs;
}

// ---------------------------------------------------------------------------
// textOffsetToDocumentPosition
// ---------------------------------------------------------------------------

describe('textOffsetToDocumentPosition', () => {
  it('maps offset 0 to the start of the block content (blockPosition + 1)', () => {
    const paragraph = schema.node('paragraph', null, [schema.text('hello')]);
    // In a real doc the paragraph might be at position 0; its content starts at 1.
    const blockPosition = 0;

    expect(textOffsetToDocumentPosition(paragraph, blockPosition, 0)).toBe(1);
  });

  it('maps offset equal to text length to the end of the text', () => {
    const paragraph = schema.node('paragraph', null, [schema.text('hello')]);
    const blockPosition = 0;

    // offset 5 is one-past-end, but the function should still produce a valid position.
    expect(textOffsetToDocumentPosition(paragraph, blockPosition, 5)).toBe(6);
  });

  it('maps an intermediate offset correctly', () => {
    const paragraph = schema.node('paragraph', null, [schema.text('hello')]);
    const blockPosition = 0;

    // offset 3 => position 4 (blockPos 0 + 1 + childOffset 0 + textOffset 3)
    expect(textOffsetToDocumentPosition(paragraph, blockPosition, 3)).toBe(4);
  });

  it('accounts for non-zero block position', () => {
    const paragraph = schema.node('paragraph', null, [schema.text('hello')]);
    const blockPosition = 10;

    // offset 2 => 10 + 1 + 0 + 2 = 13
    expect(textOffsetToDocumentPosition(paragraph, blockPosition, 2)).toBe(13);
  });

  it('maps correctly across multiple text nodes (split by marks)', () => {
    // "helloworld" split into two text nodes: "hello" (plain) + "world" (strong)
    const plainText = schema.text('hello');
    const strongText = schema.text('world', [schema.mark('strong')]);
    const paragraph = schema.node('paragraph', null, [plainText, strongText]);
    const blockPosition = 0;

    // offset 0 => in first text node at char 0 => blockPos + 1 + childOffset(0) + 0 = 1
    expect(textOffsetToDocumentPosition(paragraph, blockPosition, 0)).toBe(1);

    // offset 4 => in first text node at char 4 => blockPos + 1 + 0 + 4 = 5
    expect(textOffsetToDocumentPosition(paragraph, blockPosition, 4)).toBe(5);

    // offset 5 => first char of second text node. childOffset for second text node
    // in ProseMirror is 5 (the length of "hello"). localOffset = 5 - 5 = 0.
    // result = 0 + 1 + 5 + 0 = 6
    expect(textOffsetToDocumentPosition(paragraph, blockPosition, 5)).toBe(6);

    // offset 8 => "wor|ld" => childOffset 5, localOffset 3 => 0 + 1 + 5 + 3 = 9
    expect(textOffsetToDocumentPosition(paragraph, blockPosition, 8)).toBe(9);
  });

  it('returns start of block content for an empty block', () => {
    const paragraph = schema.node('paragraph', null, []);
    const blockPosition = 0;

    // No children, so the default (blockPosition + 1) is returned.
    expect(textOffsetToDocumentPosition(paragraph, blockPosition, 0)).toBe(1);
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

/**
 * Exhaustive tests for template placeholder domain logic.
 * DEP-582: Pure functions with no ProseMirror or DOM dependencies.
 * DEP-625: Comprehensive security tests for prototype pollution and XSS prevention.
 */

import { describe, expect, it } from 'bun:test';

import {
  buildPlaceholderCandidatesFromJsonSchema,
  normalizePlaceholderDefinitions,
  parseMarkdownPlaceholderTokens,
  parsePlaceholderTokens,
  resolveTemplatePlaceholders,
} from './template-placeholders.js';

describe('determinism and purity', () => {
  it('buildPlaceholderCandidatesFromJsonSchema returns identical output for identical input across two calls', () => {
    const schema = {
      type: 'object',
      properties: {
        b: { type: 'number' },
        a: { type: 'string', description: 'first' },
      },
    };

    const result1 = buildPlaceholderCandidatesFromJsonSchema(schema);
    const result2 = buildPlaceholderCandidatesFromJsonSchema(schema);

    expect(result1).toEqual(result2);
  });

  it('buildPlaceholderCandidatesFromJsonSchema does not mutate the input schema', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'The name' },
        nested: {
          type: 'object',
          properties: {
            inner: { type: 'number' },
          },
        },
      },
    };

    const schemaCopy = JSON.parse(JSON.stringify(schema));

    buildPlaceholderCandidatesFromJsonSchema(schema);

    expect(schema).toEqual(schemaCopy);
  });

  it('buildPlaceholderCandidatesFromJsonSchema output does not depend on key insertion order', () => {
    const forward = {
      type: 'object',
      properties: {
        b: { type: ['null', 'string'], properties: { y: {}, x: {} } },
        a: { type: 'nope' },
        'c-d': {},
      },
    };
    const reversed = {
      properties: {
        'c-d': {},
        a: { type: 'nope' },
        b: { properties: { x: {}, y: {} }, type: ['string', 'null'] },
      },
      type: 'object',
    };

    expect(buildPlaceholderCandidatesFromJsonSchema(reversed)).toEqual(
      buildPlaceholderCandidatesFromJsonSchema(forward),
    );
  });

  it('normalizePlaceholderDefinitions returns identical output and does not mutate its input', () => {
    const definitions = {
      candidates: [
        { path: 'b', types: ['string', 'integer'] },
        { path: 'a', title: 'A', description: undefined },
        { path: 'b' },
      ],
    };
    const copy = structuredClone(definitions);

    const first = normalizePlaceholderDefinitions(definitions);
    const second = normalizePlaceholderDefinitions(definitions);

    expect(first).toEqual(second);
    expect(definitions).toEqual(copy);
    expect(definitions.candidates[0]!.types).toEqual(['string', 'integer']);
  });

  it('resolveTemplatePlaceholders returns identical output for identical input across two calls', () => {
    const text = '{{a}} and {{b.c}}';
    const values = { a: 'x', b: { c: 'y' } };

    const options = { definitions: { candidates: [{ path: 'a' }, { path: 'b.c' }] } };
    const result1 = resolveTemplatePlaceholders(text, values, options);
    const result2 = resolveTemplatePlaceholders(text, values, options);

    expect(result1).toEqual(result2);
  });

  it('resolveTemplatePlaceholders does not mutate the input values object', () => {
    const values = { a: 'hello', nested: { b: [1, 2, 3] } };
    const valuesCopy = JSON.parse(JSON.stringify(values));

    const definitions = {
      candidates: [{ path: 'a' }, { path: 'nested' }, { path: 'nested.b' }],
    };
    const definitionsCopy = structuredClone(definitions);

    const result = resolveTemplatePlaceholders('{{a}} {{nested.b}} {{nested}}', values, {
      definitions,
    });

    expect(result.issues).toEqual([]);
    expect(values).toEqual(valuesCopy);
    expect(definitions).toEqual(definitionsCopy);
  });

  it('parsers return identical output across calls', () => {
    const text = '# {{a}}\n\n`{{b}}` {{c}} {{';

    expect(parseMarkdownPlaceholderTokens(text)).toEqual(parseMarkdownPlaceholderTokens(text));
    expect(parsePlaceholderTokens(text)).toEqual(parsePlaceholderTokens(text));
  });
});

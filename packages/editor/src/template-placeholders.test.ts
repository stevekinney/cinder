/**
 * Exhaustive tests for template placeholder domain logic.
 * DEP-582: Pure functions with no ProseMirror or DOM dependencies.
 * DEP-625: Comprehensive security tests for prototype pollution and XSS prevention.
 */

/* eslint-disable max-lines */

import { describe, expect, it } from 'bun:test';

import {
  buildPlaceholderCandidatesFromJsonSchema,
  parsePlaceholderTokens,
  resolveTemplatePlaceholders,
  validatePlaceholderTokens,
} from './template-placeholders.js';

describe('buildPlaceholderCandidatesFromJsonSchema', () => {
  it('emits candidates for each property of a flat object schema with correct valueKind', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'The name' },
        age: { type: 'number' },
      },
    };

    const candidates = buildPlaceholderCandidatesFromJsonSchema(schema);

    expect(candidates).toEqual([
      { path: 'age', description: undefined, valueKind: 'number' },
      { path: 'name', description: 'The name', valueKind: 'string' },
    ]);
  });

  it('emits parent and child paths for nested object schema in lexicographic order', () => {
    const schema = {
      type: 'object',
      properties: {
        input: {
          type: 'object',
          properties: {
            y: { type: 'number' },
            x: { type: 'string' },
          },
        },
      },
    };

    const candidates = buildPlaceholderCandidatesFromJsonSchema(schema);
    const paths = candidates.map((c) => c.path);

    expect(paths).toEqual(['input', 'input.x', 'input.y']);
  });

  it('emits whole-array path only for array-typed properties with valueKind "array"', () => {
    const schema = {
      type: 'object',
      properties: {
        tags: { type: 'array', items: { type: 'string' } },
      },
    };

    const candidates = buildPlaceholderCandidatesFromJsonSchema(schema);

    expect(candidates).toEqual([{ path: 'tags', description: undefined, valueKind: 'array' }]);
  });

  it('carries through description when present; undefined when missing', () => {
    const schema = {
      type: 'object',
      properties: {
        described: { type: 'string', description: 'Has a description' },
        undescribed: { type: 'string' },
      },
    };

    const candidates = buildPlaceholderCandidatesFromJsonSchema(schema);

    expect(candidates.find((c) => c.path === 'described')?.description).toBe('Has a description');
    expect(candidates.find((c) => c.path === 'undescribed')?.description).toBeUndefined();
  });

  it('maps JSON Schema type values to correct valueKind', () => {
    const typeMap: [string, string][] = [
      ['string', 'string'],
      ['number', 'number'],
      ['integer', 'number'],
      ['boolean', 'boolean'],
      ['array', 'array'],
      ['object', 'object'],
    ];

    const properties: Record<string, { type: string }> = {};
    for (const [schemaType] of typeMap) {
      properties[schemaType] = { type: schemaType };
    }

    const schema = { type: 'object', properties };
    const candidates = buildPlaceholderCandidatesFromJsonSchema(schema);

    for (const [schemaType, expectedKind] of typeMap) {
      const candidate = candidates.find((c) => c.path === schemaType);
      expect(candidate?.valueKind, `type "${schemaType}" should map to "${expectedKind}"`).toBe(
        expectedKind,
      );
    }
  });

  it('returns valueKind "unknown" when the type field is missing', () => {
    const schema = {
      type: 'object',
      properties: {
        mystery: { description: 'no type' },
      },
    };

    const candidates = buildPlaceholderCandidatesFromJsonSchema(schema);

    expect(candidates[0].valueKind).toBe('unknown');
  });

  const unsupportedKeywords = [
    '$ref',
    'allOf',
    'anyOf',
    'oneOf',
    'if',
    'then',
    'else',
    'patternProperties',
    'additionalProperties',
  ] as const;

  it.each(unsupportedKeywords)(
    'silently ignores unsupported keyword "%s" (no throw)',
    (keyword) => {
      const schema = {
        type: 'object',
        properties: {
          field: { type: 'string' },
        },
        [keyword]: keyword === '$ref' ? '#/definitions/Foo' : { type: 'string' },
      };

      expect(() => buildPlaceholderCandidatesFromJsonSchema(schema)).not.toThrow();
      const candidates = buildPlaceholderCandidatesFromJsonSchema(schema);
      expect(candidates).toHaveLength(1);
      expect(candidates[0].path).toBe('field');
    },
  );

  it('returns empty array for a schema with no properties', () => {
    expect(buildPlaceholderCandidatesFromJsonSchema({})).toEqual([]);
    expect(buildPlaceholderCandidatesFromJsonSchema({ type: 'object' })).toEqual([]);
  });

  it('emits all intermediate and leaf paths for deeply nested schema (3+ levels)', () => {
    const schema = {
      type: 'object',
      properties: {
        a: {
          type: 'object',
          properties: {
            b: {
              type: 'object',
              properties: {
                c: {
                  type: 'object',
                  properties: {
                    d: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    };

    const candidates = buildPlaceholderCandidatesFromJsonSchema(schema);
    const paths = candidates.map((c) => c.path);

    expect(paths).toEqual(['a', 'a.b', 'a.b.c', 'a.b.c.d']);
  });

  it('recurses into nested properties even without explicit type "object"', () => {
    const schema = {
      type: 'object',
      properties: {
        container: {
          // No type field at all
          properties: {
            inner: { type: 'string' },
          },
        },
      },
    };

    const candidates = buildPlaceholderCandidatesFromJsonSchema(schema);
    const paths = candidates.map((c) => c.path);

    expect(paths).toEqual(['container', 'container.inner']);
    expect(candidates.find((c) => c.path === 'container')?.valueKind).toBe('unknown');
    expect(candidates.find((c) => c.path === 'container.inner')?.valueKind).toBe('string');
  });

  it('skips keys with non-identifier characters that PATH_REGEX would reject', () => {
    const schema = {
      type: 'object',
      properties: {
        'first-name': { type: 'string' },
        'first.name': { type: 'string' },
        '123numeric': { type: 'number' },
        valid_field: { type: 'string' },
      },
    };

    const candidates = buildPlaceholderCandidatesFromJsonSchema(schema);
    const paths = candidates.map((c) => c.path);

    expect(paths).toEqual(['valid_field']);
  });

  it('skips non-identifier keys in nested schemas', () => {
    const schema = {
      type: 'object',
      properties: {
        parent: {
          type: 'object',
          properties: {
            'child-field': { type: 'string' },
            child_valid: { type: 'number' },
          },
        },
      },
    };

    const candidates = buildPlaceholderCandidatesFromJsonSchema(schema);
    const paths = candidates.map((c) => c.path);

    expect(paths).toContain('parent');
    expect(paths).toContain('parent.child_valid');
    expect(paths).not.toContain('parent.child-field');
  });
});

describe('parsePlaceholderTokens', () => {
  it('parses a single well-formed token with correct fields', () => {
    const text = '{{input.x}}';
    const tokens = parsePlaceholderTokens(text);

    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toEqual({
      raw: '{{input.x}}',
      path: 'input.x',
      startOffset: 0,
      endOffset: 11,
      closed: true,
    });
  });

  it('trims whitespace around path', () => {
    const text = '{{ input.x }}';
    const tokens = parsePlaceholderTokens(text);

    expect(tokens).toHaveLength(1);
    expect(tokens[0].path).toBe('input.x');
    expect(tokens[0].raw).toBe('{{ input.x }}');
    expect(tokens[0].closed).toBe(true);
  });

  it('parses adjacent tokens with correct non-overlapping offsets', () => {
    const text = '{{a}}{{b}}';
    const tokens = parsePlaceholderTokens(text);

    expect(tokens).toHaveLength(2);
    expect(tokens[0]).toEqual({
      raw: '{{a}}',
      path: 'a',
      startOffset: 0,
      endOffset: 5,
      closed: true,
    });
    expect(tokens[1]).toEqual({
      raw: '{{b}}',
      path: 'b',
      startOffset: 5,
      endOffset: 10,
      closed: true,
    });
  });

  it('returns two separate token objects for repeated same token', () => {
    const text = '{{x}} and {{x}}';
    const tokens = parsePlaceholderTokens(text);

    expect(tokens).toHaveLength(2);
    expect(tokens[0].path).toBe('x');
    expect(tokens[1].path).toBe('x');
    expect(tokens[0].startOffset).toBe(0);
    expect(tokens[1].startOffset).toBe(10);
    expect(tokens[0]).not.toBe(tokens[1]);
  });

  it('detects unclosed token at end of string', () => {
    const text = '{{input.x';
    const tokens = parsePlaceholderTokens(text);

    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toEqual({
      raw: '{{input.x',
      path: 'input.x',
      startOffset: 0,
      endOffset: text.length,
      closed: false,
    });
  });

  it('returns closed token with empty string path for empty body', () => {
    const text = '{{}}';
    const tokens = parsePlaceholderTokens(text);

    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toEqual({
      raw: '{{}}',
      path: '',
      startOffset: 0,
      endOffset: 4,
      closed: true,
    });
  });

  it('returns empty array for text with no tokens', () => {
    expect(parsePlaceholderTokens('Hello world')).toEqual([]);
    expect(parsePlaceholderTokens('')).toEqual([]);
    expect(parsePlaceholderTokens('just { single braces }')).toEqual([]);
  });

  it('parses tokens interspersed with prose with correct offsets', () => {
    const text = 'Hello {{name}}, your {{item}} is ready';
    const tokens = parsePlaceholderTokens(text);

    expect(tokens).toHaveLength(2);

    expect(tokens[0]).toEqual({
      raw: '{{name}}',
      path: 'name',
      startOffset: 6,
      endOffset: 14,
      closed: true,
    });

    expect(tokens[1]).toEqual({
      raw: '{{item}}',
      path: 'item',
      startOffset: 21,
      endOffset: 29,
      closed: true,
    });
  });

  it('parses nested braces as-is for path body', () => {
    const text = '{{ {inner} }}';
    const tokens = parsePlaceholderTokens(text);

    expect(tokens).toHaveLength(1);
    expect(tokens[0].path).toBe('{inner}');
    expect(tokens[0].closed).toBe(true);
  });
});

describe('validatePlaceholderTokens', () => {
  const candidates = [
    { path: 'name', description: undefined, valueKind: 'string' as const },
    { path: 'age', description: undefined, valueKind: 'number' as const },
    { path: 'input.x', description: undefined, valueKind: 'string' as const },
  ];

  it('reports malformed_token issue for unclosed token', () => {
    const tokens = parsePlaceholderTokens('{{name');
    const result = validatePlaceholderTokens(tokens, candidates);

    expect(result.invalidTokens).toHaveLength(1);
    expect(result.validTokens).toHaveLength(0);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].reason).toBe('malformed_token');
    expect(result.issues[0].token).toBe(tokens[0]);
  });

  const invalidPaths = [
    ['numeric start', '123'],
    ['double dot', 'a..b'],
    ['empty string', ''],
    ['leading dot', '.a'],
  ] as const;

  it.each(invalidPaths)(
    'reports invalid_path_format for path with %s ("%s")',
    (_label, pathValue) => {
      const token = {
        raw: `{{${pathValue}}}`,
        path: pathValue,
        startOffset: 0,
        endOffset: pathValue.length + 4,
        closed: true,
      };

      const result = validatePlaceholderTokens([token], candidates);

      expect(result.invalidTokens).toHaveLength(1);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].reason).toBe('invalid_path_format');
    },
  );

  it('reports unknown_placeholder for valid-format path not in candidate set', () => {
    const tokens = parsePlaceholderTokens('{{unknown_field}}');
    const result = validatePlaceholderTokens(tokens, candidates);

    expect(result.invalidTokens).toHaveLength(1);
    expect(result.validTokens).toHaveLength(0);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].reason).toBe('unknown_placeholder');
  });

  it('places valid token in validTokens with zero issues for that token', () => {
    const tokens = parsePlaceholderTokens('{{name}}');
    const result = validatePlaceholderTokens(tokens, candidates);

    expect(result.validTokens).toHaveLength(1);
    expect(result.validTokens[0].path).toBe('name');
    expect(result.invalidTokens).toHaveLength(0);
    expect(result.issues).toHaveLength(0);
  });

  it('correctly partitions mixed valid and invalid tokens', () => {
    const text = '{{name}} and {{}} and {{unknown}} and {{input.x';
    const tokens = parsePlaceholderTokens(text);
    const result = validatePlaceholderTokens(tokens, candidates);

    expect(result.validTokens).toHaveLength(1);
    expect(result.validTokens[0].path).toBe('name');

    expect(result.invalidTokens).toHaveLength(3);
    expect(result.issues).toHaveLength(3);

    const reasons = result.issues.map((issue) => issue.reason);
    expect(reasons).toContain('invalid_path_format'); // {{}}
    expect(reasons).toContain('unknown_placeholder'); // {{unknown}}
    expect(reasons).toContain('malformed_token'); // {{input.x (unclosed)
  });

  it('references the original token with source offsets in each issue', () => {
    const text = 'prefix {{bad..path}} suffix';
    const tokens = parsePlaceholderTokens(text);
    const result = validatePlaceholderTokens(tokens, candidates);

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].token.startOffset).toBe(7);
    expect(result.issues[0].token.endOffset).toBe(20);
    expect(result.issues[0].token.raw).toBe('{{bad..path}}');
  });
});

describe('resolveTemplatePlaceholders', () => {
  it('resolves string value', () => {
    const result = resolveTemplatePlaceholders('{{ input.x }}', { input: { x: 'hello' } });

    expect(result.text).toBe('hello');
    expect(result.issues).toHaveLength(0);
  });

  it('resolves number value', () => {
    const result = resolveTemplatePlaceholders('{{count}}', { count: 42 });

    expect(result.text).toBe('42');
  });

  it('resolves boolean value', () => {
    const result = resolveTemplatePlaceholders('{{flag}}', { flag: true });

    expect(result.text).toBe('true');
  });

  it('resolves object value as JSON', () => {
    const result = resolveTemplatePlaceholders('{{input}}', { input: { x: 'hello', y: 1 } });

    expect(result.text).toBe('{"x":"hello","y":1}');
  });

  it('resolves array value as comma-separated items', () => {
    const result = resolveTemplatePlaceholders('{{tags}}', { tags: ['a', 'b', 3] });

    expect(result.text).toBe('a, b, 3');
  });

  it('handles array with null and object items per item-coercion rules', () => {
    const result = resolveTemplatePlaceholders('{{items}}', {
      items: [null, { key: 'value' }, undefined, 'text'],
    });

    expect(result.text).toBe(', {"key":"value"}, , text');
  });

  it('coerces function items in arrays to empty string (consistent with top-level behavior)', () => {
    // String(fn) emits the function source code; that is inconsistent with the
    // documented contract that function values resolve to ''.
    const result = resolveTemplatePlaceholders('{{items}}', {
      items: ['a', () => 'hello', 'b'],
    });

    expect(result.text).toBe('a, , b');
  });

  it('coerces symbol items in arrays to empty string (consistent with top-level behavior)', () => {
    // String(sym) emits "Symbol(...)"; that is inconsistent with the documented
    // contract that symbol values resolve to ''.
    const result = resolveTemplatePlaceholders('{{items}}', {
      items: ['a', Symbol('test'), 'b'],
    });

    expect(result.text).toBe('a, , b');
  });

  it('resolves null value to empty string', () => {
    const result = resolveTemplatePlaceholders('{{field}}', { field: null });

    expect(result.text).toBe('');
  });

  it('resolves undefined / missing path to empty string', () => {
    const result = resolveTemplatePlaceholders('{{missing}}', {});

    expect(result.text).toBe('');
  });

  it('resolves bigint value', () => {
    const result = resolveTemplatePlaceholders('{{big}}', { big: BigInt(42) });

    expect(result.text).toBe('42');
  });

  it('preserves unclosed tokens in output text unmodified', () => {
    const text = 'Hello {{name}} and {{unclosed';
    const result = resolveTemplatePlaceholders(text, { name: 'World' });

    expect(result.text).toBe('Hello World and {{unclosed');
  });

  it('reports unknown_placeholder issues when candidatePaths is provided', () => {
    const result = resolveTemplatePlaceholders('{{unknown}}', {}, ['name', 'age']);

    expect(result.text).toBe('');
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].reason).toBe('unknown_placeholder');
  });

  it('replaces unknown paths with empty string without issues when candidatePaths is omitted', () => {
    const result = resolveTemplatePlaceholders('{{unknown}}', {});

    expect(result.text).toBe('');
    expect(result.issues).toHaveLength(0);
  });

  it('resolves multiple tokens in same text correctly via reverse-order iteration', () => {
    const text = '{{greeting}} {{name}}, you have {{count}} items.';
    const result = resolveTemplatePlaceholders(text, {
      greeting: 'Hello',
      name: 'Alice',
      count: 5,
    });

    expect(result.text).toBe('Hello Alice, you have 5 items.');
  });

  it('does not mutate the input values object', () => {
    const values = { name: 'Alice', nested: { x: 1 } };
    const valuesCopy = JSON.parse(JSON.stringify(values));

    resolveTemplatePlaceholders('{{name}} {{nested}}', values);

    expect(values).toEqual(valuesCopy);
  });

  it('resolves inherited prototype property names to empty string, not the inherited function', () => {
    // Without the Object.hasOwn guard, paths like "constructor" or "toString"
    // traverse the prototype chain and return the inherited function. JSON.stringify
    // coerces a function to undefined, producing the literal text "undefined" rather
    // than the expected empty string.
    const result = resolveTemplatePlaceholders('{{constructor}}', {});
    expect(result.text).toBe('');
  });

  it('resolves nested prototype property names to empty string', () => {
    const result = resolveTemplatePlaceholders('{{a.toString}}', { a: {} });
    expect(result.text).toBe('');
  });

  it('resolves function value to empty string (not the literal text "undefined")', () => {
    // JSON.stringify returns undefined for function values, which string
    // concatenation coerces to the literal text "undefined". The function/symbol
    // guard in formatValueForReplacement must intercept before JSON.stringify.
    const result = resolveTemplatePlaceholders('{{fn}}', { fn: () => 'hello' });
    expect(result.text).toBe('');
  });

  it('resolves symbol value to empty string (not the literal text "undefined")', () => {
    const result = resolveTemplatePlaceholders('{{sym}}', { sym: Symbol('test') });
    expect(result.text).toBe('');
  });

  it('reports issues in forward document order when multiple unknown tokens appear', () => {
    // resolveTemplatePlaceholders iterates tokens in reverse for correct string
    // splicing, but issues must be returned in forward document order to match
    // the ordering produced by validatePlaceholderTokens.
    const result = resolveTemplatePlaceholders('{{alpha}} and {{beta}} and {{gamma}}', {}, [
      'name',
    ]);

    expect(result.issues).toHaveLength(3);
    expect(result.issues[0].token.path).toBe('alpha');
    expect(result.issues[1].token.path).toBe('beta');
    expect(result.issues[2].token.path).toBe('gamma');

    // Verify by startOffset, not just path
    const offsets = result.issues.map((issue) => issue.token.startOffset);
    expect(offsets).toEqual(offsets.toSorted((a, b) => a - b));
  });
});

describe('DEP-625: Prototype pollution prevention', () => {
  describe('reserved segment blocking', () => {
    it('blocks __proto__ access', () => {
      const result = resolveTemplatePlaceholders('{{__proto__}}', {});
      expect(result.text).toBe('');
    });

    it('blocks constructor access', () => {
      const result = resolveTemplatePlaceholders('{{constructor}}', {});
      expect(result.text).toBe('');
    });

    it('blocks prototype access', () => {
      const result = resolveTemplatePlaceholders('{{prototype}}', {});
      expect(result.text).toBe('');
    });

    it('blocks nested __proto__ path (user.__proto__.isAdmin)', () => {
      const result = resolveTemplatePlaceholders('{{user.__proto__.isAdmin}}', {
        user: { name: 'Alice' },
      });
      expect(result.text).toBe('');
    });

    it('blocks nested constructor.prototype path', () => {
      const result = resolveTemplatePlaceholders('{{data.constructor.prototype}}', {
        data: { value: 42 },
      });
      expect(result.text).toBe('');
    });

    it('blocks __defineGetter__ access', () => {
      const result = resolveTemplatePlaceholders('{{__defineGetter__}}', {});
      expect(result.text).toBe('');
    });

    it('blocks __defineSetter__ access', () => {
      const result = resolveTemplatePlaceholders('{{__defineSetter__}}', {});
      expect(result.text).toBe('');
    });

    it('blocks __lookupGetter__ access', () => {
      const result = resolveTemplatePlaceholders('{{__lookupGetter__}}', {});
      expect(result.text).toBe('');
    });

    it('blocks __lookupSetter__ access', () => {
      const result = resolveTemplatePlaceholders('{{__lookupSetter__}}', {});
      expect(result.text).toBe('');
    });

    it('blocks hasOwnProperty access', () => {
      const result = resolveTemplatePlaceholders('{{hasOwnProperty}}', {});
      expect(result.text).toBe('');
    });

    it('blocks isPrototypeOf access', () => {
      const result = resolveTemplatePlaceholders('{{isPrototypeOf}}', {});
      expect(result.text).toBe('');
    });

    it('blocks propertyIsEnumerable access', () => {
      const result = resolveTemplatePlaceholders('{{propertyIsEnumerable}}', {});
      expect(result.text).toBe('');
    });

    it('blocks toString access', () => {
      const result = resolveTemplatePlaceholders('{{toString}}', {});
      expect(result.text).toBe('');
    });

    it('blocks toLocaleString access', () => {
      const result = resolveTemplatePlaceholders('{{toLocaleString}}', {});
      expect(result.text).toBe('');
    });

    it('blocks valueOf access', () => {
      const result = resolveTemplatePlaceholders('{{valueOf}}', {});
      expect(result.text).toBe('');
    });
  });

  describe('case-insensitive reserved segment blocking', () => {
    it('blocks __PROTO__ (uppercase)', () => {
      const result = resolveTemplatePlaceholders('{{__PROTO__}}', {});
      expect(result.text).toBe('');
    });

    it('blocks Constructor (mixed case)', () => {
      const result = resolveTemplatePlaceholders('{{Constructor}}', {});
      expect(result.text).toBe('');
    });

    it('blocks PROTOTYPE (uppercase)', () => {
      const result = resolveTemplatePlaceholders('{{PROTOTYPE}}', {});
      expect(result.text).toBe('');
    });

    it('blocks ToStRiNg (mixed case)', () => {
      const result = resolveTemplatePlaceholders('{{ToStRiNg}}', {});
      expect(result.text).toBe('');
    });

    it('blocks nested case-variant path (user.__PROTO__.isAdmin)', () => {
      const result = resolveTemplatePlaceholders('{{user.__PROTO__.isAdmin}}', {
        user: { name: 'Alice' },
      });
      expect(result.text).toBe('');
    });
  });

  describe('dunder property blocking', () => {
    it('blocks any segment starting with __ (custom dunder)', () => {
      const result = resolveTemplatePlaceholders('{{__custom__}}', {});
      expect(result.text).toBe('');
    });

    it('blocks nested path with dunder segment (user.__secret__.data)', () => {
      const result = resolveTemplatePlaceholders('{{user.__secret__.data}}', {
        user: { name: 'Alice' },
      });
      expect(result.text).toBe('');
    });

    it('blocks __proto__ via dunder prefix check', () => {
      const result = resolveTemplatePlaceholders('{{__proto__}}', {});
      expect(result.text).toBe('');
    });

    it('blocks __defineGetter__ via dunder prefix check', () => {
      const result = resolveTemplatePlaceholders('{{__defineGetter__}}', {});
      expect(result.text).toBe('');
    });
  });

  describe('empty segment blocking', () => {
    it('blocks empty segments from double dots (user..name)', () => {
      const result = resolveTemplatePlaceholders('{{user..name}}', {
        user: { name: 'Alice' },
      });
      expect(result.text).toBe('');
    });

    it('blocks leading dot (.user.name)', () => {
      const result = resolveTemplatePlaceholders('{{.user.name}}', {
        user: { name: 'Alice' },
      });
      expect(result.text).toBe('');
    });

    it('blocks trailing dot (user.name.)', () => {
      const result = resolveTemplatePlaceholders('{{user.name.}}', {
        user: { name: 'Alice' },
      });
      expect(result.text).toBe('');
    });

    it('blocks multiple consecutive dots (user...name)', () => {
      const result = resolveTemplatePlaceholders('{{user...name}}', {
        user: { name: 'Alice' },
      });
      expect(result.text).toBe('');
    });
  });

  describe('legitimate paths still resolve', () => {
    it('resolves valid simple path', () => {
      const result = resolveTemplatePlaceholders('{{name}}', { name: 'Alice' });
      expect(result.text).toBe('Alice');
    });

    it('resolves valid nested path', () => {
      const result = resolveTemplatePlaceholders('{{user.name}}', {
        user: { name: 'Alice' },
      });
      expect(result.text).toBe('Alice');
    });

    it('resolves deeply nested path (3+ levels)', () => {
      const result = resolveTemplatePlaceholders('{{a.b.c.d}}', {
        a: { b: { c: { d: 'value' } } },
      });
      expect(result.text).toBe('value');
    });

    it('resolves path with underscores (user_data.field_name)', () => {
      const result = resolveTemplatePlaceholders('{{user_data.field_name}}', {
        user_data: { field_name: 'test' },
      });
      expect(result.text).toBe('test');
    });

    it('resolves path starting with underscore (_private.data)', () => {
      const result = resolveTemplatePlaceholders('{{_private.data}}', {
        _private: { data: 'secret' },
      });
      expect(result.text).toBe('secret');
    });

    it('resolves legitimate single underscore properties', () => {
      const result = resolveTemplatePlaceholders('{{_value}}', { _value: 42 });
      expect(result.text).toBe('42');
    });
  });

  describe('edge cases', () => {
    it('returns empty string for null context with reserved segment', () => {
      const result = resolveTemplatePlaceholders('{{__proto__}}', {});
      expect(result.text).toBe('');
    });

    it('blocks reserved segments even when they exist in data', () => {
      // Even if someone manages to set these keys, they should not resolve
      const maliciousData = Object.create(null);
      maliciousData.constructor = 'evil';
      const result = resolveTemplatePlaceholders('{{constructor}}', maliciousData);
      expect(result.text).toBe('');
    });

    it('blocks reserved segments in complex nested paths', () => {
      const result = resolveTemplatePlaceholders('{{a.b.__proto__.c.d}}', {
        a: { b: { c: { d: 'value' } } },
      });
      expect(result.text).toBe('');
    });

    it('allows properties that contain reserved words but are not exact matches', () => {
      const result = resolveTemplatePlaceholders('{{constructor_id}}', {
        constructor_id: '12345',
      });
      expect(result.text).toBe('12345');
    });

    it('allows properties that end with reserved words', () => {
      const result = resolveTemplatePlaceholders('{{my_constructor}}', {
        my_constructor: 'Builder',
      });
      expect(result.text).toBe('Builder');
    });
  });

  describe('multiple tokens with mixed valid and blocked paths', () => {
    it('resolves valid paths and blocks reserved segments in same template', () => {
      const result = resolveTemplatePlaceholders(
        '{{name}} is {{age}} years old and {{__proto__}} is blocked',
        {
          name: 'Alice',
          age: 30,
        },
      );
      expect(result.text).toBe('Alice is 30 years old and  is blocked');
    });

    it('handles template with all blocked segments', () => {
      const result = resolveTemplatePlaceholders('{{__proto__}} {{constructor}} {{prototype}}', {});
      expect(result.text).toBe('  ');
    });

    it('handles template with all valid segments', () => {
      const result = resolveTemplatePlaceholders('{{a}} {{b}} {{c}}', { a: '1', b: '2', c: '3' });
      expect(result.text).toBe('1 2 3');
    });
  });
});

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

  it('resolveTemplatePlaceholders returns identical output for identical input across two calls', () => {
    const text = '{{a}} and {{b.c}}';
    const values = { a: 'x', b: { c: 'y' } };

    const result1 = resolveTemplatePlaceholders(text, values);
    const result2 = resolveTemplatePlaceholders(text, values);

    expect(result1).toEqual(result2);
  });

  it('resolveTemplatePlaceholders does not mutate the input values object', () => {
    const values = { a: 'hello', nested: { b: [1, 2, 3] } };
    const valuesCopy = JSON.parse(JSON.stringify(values));

    resolveTemplatePlaceholders('{{a}} {{nested.b}} {{nested}}', values);

    expect(values).toEqual(valuesCopy);
  });
});

describe('DEP-625: XSS prevention via renderTemplate', () => {
  // Tests use dynamic imports to avoid loading the heavy markdown rendering
  // pipeline at module load time for lightweight function tests
  describe('script tag removal', () => {
    it('removes <script> tags from template', async () => {
      const { renderTemplate } = await import('./template-render.js');
      // Markdown parser treats the text "Hello" after raw HTML differently, so we wrap in markdown context
      const html = renderTemplate('Hello <script>alert(1)</script> World', {});

      expect(html).not.toContain('<script>');
      expect(html).toContain('Hello');
      expect(html).toContain('World');
    });

    it('removes <script> tags with attributes', async () => {
      const { renderTemplate } = await import('./template-render.js');
      const html = renderTemplate('Text <script type="text/javascript">alert(1)</script> more', {});

      expect(html).not.toContain('<script>');
      expect(html).not.toContain('type="text/javascript"');
    });

    it('removes multiple <script> tags', async () => {
      const { renderTemplate } = await import('./template-render.js');
      const html = renderTemplate(
        'Start <script>alert(1)</script> Safe <script>alert(2)</script> End',
        {},
      );

      expect(html).not.toContain('<script>');
      expect(html).toContain('Safe');
    });

    it('removes <script> tags mixed with placeholders', async () => {
      const { renderTemplate } = await import('./template-render.js');
      const html = renderTemplate('Hello <script>alert(1)</script> {{name}}', {
        name: 'Alice',
      });

      expect(html).not.toContain('<script>');
      expect(html).toContain('Alice');
    });
  });

  describe('event handler removal', () => {
    it('removes onerror handler from img tag', async () => {
      const { renderTemplate } = await import('./template-render.js');
      const html = renderTemplate('<img src=x onerror=alert(1)>', {});

      expect(html).not.toContain('onerror');
      expect(html).not.toContain('alert');
    });

    it('removes onclick handler from div', async () => {
      const { renderTemplate } = await import('./template-render.js');
      const html = renderTemplate('<div onclick=alert(1)>Click me</div>', {});

      expect(html).not.toContain('onclick');
      expect(html).not.toContain('alert');
    });

    it('removes onload handler from body', async () => {
      const { renderTemplate } = await import('./template-render.js');
      const html = renderTemplate('<body onload=alert(1)>Content</body>', {});

      expect(html).not.toContain('onload');
      expect(html).not.toContain('alert');
    });

    it('removes onmouseover handler', async () => {
      const { renderTemplate } = await import('./template-render.js');
      const html = renderTemplate('<span onmouseover=alert(1)>Hover</span>', {});

      expect(html).not.toContain('onmouseover');
      expect(html).not.toContain('alert');
    });

    it('removes onfocus handler from input', async () => {
      const { renderTemplate } = await import('./template-render.js');
      const html = renderTemplate('<input onfocus=alert(1) value="test">', {});

      expect(html).not.toContain('onfocus');
      expect(html).not.toContain('alert');
    });
  });

  describe('dangerous URL blocking', () => {
    it('blocks javascript: URLs in links', async () => {
      const { renderTemplate } = await import('./template-render.js');
      const html = renderTemplate('[Click me](javascript:alert(1))', {});

      expect(html).not.toContain('javascript:');
      expect(html).not.toContain('alert');
    });

    it('blocks data: URLs in images by default', async () => {
      const { renderTemplate } = await import('./template-render.js');
      const html = renderTemplate('![img](data:text/html,<script>alert(1)</script>)', {});

      expect(html).not.toContain('data:');
      expect(html).not.toContain('<script>');
      expect(html).not.toContain('alert');
    });

    it('blocks vbscript: URLs', async () => {
      const { renderTemplate } = await import('./template-render.js');
      const html = renderTemplate('[Click](vbscript:msgbox(1))', {});

      expect(html).not.toContain('vbscript:');
      expect(html).not.toContain('msgbox');
    });

    it('blocks file: URLs', async () => {
      const { renderTemplate } = await import('./template-render.js');
      const html = renderTemplate('[Local file](file:///etc/passwd)', {});

      expect(html).not.toContain('file:');
      expect(html).not.toContain('/etc/passwd');
    });
  });

  describe('safe content preservation', () => {
    it('preserves markdown headings', async () => {
      const { renderTemplate } = await import('./template-render.js');
      const html = renderTemplate('# Hello {{name}}', { name: 'World' });

      expect(html).toContain('<h1');
      expect(html).toContain('Hello World');
      expect(html).toContain('</h1>');
    });

    it('preserves markdown emphasis', async () => {
      const { renderTemplate } = await import('./template-render.js');
      const html = renderTemplate('**bold** and *italic*', {});

      expect(html).toContain('<strong>bold</strong>');
      expect(html).toContain('<em>italic</em>');
    });

    it('preserves safe links (https)', async () => {
      const { renderTemplate } = await import('./template-render.js');
      const html = renderTemplate('[Link](https://example.com)', {});

      expect(html).toContain('<a');
      expect(html).toContain('href="https://example.com"');
      expect(html).toContain('Link');
      expect(html).toContain('</a>');
    });

    it('preserves safe links (http)', async () => {
      const { renderTemplate } = await import('./template-render.js');
      const html = renderTemplate('[Link](http://example.com)', {});

      expect(html).toContain('<a');
      expect(html).toContain('href="http://example.com"');
    });

    it('preserves mailto links', async () => {
      const { renderTemplate } = await import('./template-render.js');
      const html = renderTemplate('[Email](mailto:test@example.com)', {});

      expect(html).toContain('<a');
      expect(html).toContain('href="mailto:test@example.com"');
    });

    it('preserves markdown lists', async () => {
      const { renderTemplate } = await import('./template-render.js');
      const html = renderTemplate('- Item 1\n- Item 2', {});

      expect(html).toContain('<ul');
      expect(html).toContain('<li');
      expect(html).toContain('Item 1');
      expect(html).toContain('Item 2');
    });

    it('preserves code blocks', async () => {
      const { renderTemplate } = await import('./template-render.js');
      const html = renderTemplate('`inline code`', {});

      expect(html).toContain('<code');
      expect(html).toContain('inline code');
    });

    it('preserves blockquotes', async () => {
      const { renderTemplate } = await import('./template-render.js');
      const html = renderTemplate('> Quote', {});

      expect(html).toContain('<blockquote');
      expect(html).toContain('Quote');
    });
  });

  describe('mixed malicious and safe content', () => {
    it('sanitizes XSS while preserving safe markdown', async () => {
      const { renderTemplate } = await import('./template-render.js');
      const html = renderTemplate(
        '# Title\n\n<script>alert(1)</script>\n\n**Safe text** {{name}}',
        { name: 'Alice' },
      );

      expect(html).toContain('<h1');
      expect(html).toContain('Title');
      expect(html).toContain('<strong>Safe text</strong>');
      expect(html).toContain('Alice');
      expect(html).not.toContain('<script>');
      expect(html).not.toContain('alert');
    });

    it('sanitizes event handlers while preserving content', async () => {
      const { renderTemplate } = await import('./template-render.js');
      const html = renderTemplate('**Bold** <div onclick=alert(1)>Click</div> *italic*', {});

      expect(html).toContain('<strong>Bold</strong>');
      expect(html).toContain('<em>italic</em>');
      expect(html).not.toContain('onclick');
      expect(html).not.toContain('alert');
    });

    it('handles placeholders that contain XSS attempts', async () => {
      const { renderTemplate } = await import('./template-render.js');
      const html = renderTemplate('Hello {{user}}', { user: '<script>alert(1)</script>' });

      // The placeholder value is inserted as text, then markdown parsing treats
      // the raw HTML node as unsafe and removes it. The text inside (alert(1))
      // is preserved as safe text content.
      expect(html).not.toContain('<script>');
      expect(html).toContain('Hello');
      expect(html).toContain('alert(1)'); // text content inside script is preserved
    });

    it('blocks prototype pollution in placeholders and sanitizes output', async () => {
      const { renderTemplate } = await import('./template-render.js');
      const html = renderTemplate('{{__proto__.isAdmin}} <script>alert(1)</script>', {});

      // Both attacks blocked: prototype pollution returns empty, script removed
      expect(html).not.toContain('<script>');
      expect(html).not.toContain('alert');
      expect(html).not.toContain('isAdmin');
    });
  });

  describe('attribute-based XSS attempts', () => {
    it('removes style attribute with expression()', async () => {
      const { renderTemplate } = await import('./template-render.js');
      const html = renderTemplate('<div style="width:expression(alert(1))">Test</div>', {});

      expect(html).not.toContain('expression');
      expect(html).not.toContain('alert');
    });

    it('removes javascript: in style url()', async () => {
      const { renderTemplate } = await import('./template-render.js');
      const html = renderTemplate(
        '<div style="background:url(javascript:alert(1))">Test</div>',
        {},
      );

      expect(html).not.toContain('javascript:');
      expect(html).not.toContain('alert');
    });

    it('removes srcdoc attribute from iframe', async () => {
      const { renderTemplate } = await import('./template-render.js');
      const html = renderTemplate('<iframe srcdoc="<script>alert(1)</script>"></iframe>', {});

      expect(html).not.toContain('srcdoc');
      expect(html).not.toContain('<script>');
      expect(html).not.toContain('alert');
    });

    it('removes formaction attribute', async () => {
      const { renderTemplate } = await import('./template-render.js');
      const html = renderTemplate('<button formaction="javascript:alert(1)">Click</button>', {});

      expect(html).not.toContain('formaction');
      expect(html).not.toContain('javascript:');
      expect(html).not.toContain('alert');
    });
  });

  describe('edge cases and complex attacks', () => {
    it('handles nested HTML entities', async () => {
      const { renderTemplate } = await import('./template-render.js');
      const html = renderTemplate('&lt;script&gt;alert(1)&lt;/script&gt;', {});

      // HTML entities in markdown are treated as plain text
      // The markdown renderer wraps text in block elements (e.g., <p>)
      expect(html).not.toContain('<script>');
      // Verify the entity-encoded content is safely rendered
      // rehype-stringify encodes < as &#x3C; but may leave > unencoded (both are valid HTML)
      expect(html).toMatch(/(&lt;|&#x3C;)/);
      expect(html).toContain('alert(1)');
      // > can appear as &gt;, &#x3E;, or unencoded (all valid)
      expect(html).toMatch(/(&gt;|&#x3E;|>)/);
    });

    it('blocks case variations of script tag', async () => {
      const { renderTemplate } = await import('./template-render.js');
      const html = renderTemplate('Text <ScRiPt>alert(1)</ScRiPt> more', {});

      expect(html).not.toContain('<ScRiPt>');
      expect(html).not.toContain('<script>');
    });

    it('handles SVG-based XSS attempts', async () => {
      const { renderTemplate } = await import('./template-render.js');
      const html = renderTemplate('Text <svg><script>alert(1)</script></svg> more', {});

      expect(html).not.toContain('<script>');
      expect(html).not.toContain('<svg>');
      // The text inside is preserved
      expect(html).toContain('alert(1)');
    });

    it('blocks object/embed tags', async () => {
      const { renderTemplate } = await import('./template-render.js');
      const html = renderTemplate('<object data="javascript:alert(1)"></object>', {});

      expect(html).not.toContain('<object');
      expect(html).not.toContain('javascript:');
      expect(html).not.toContain('alert');
    });

    it('handles empty template gracefully', async () => {
      const { renderTemplate } = await import('./template-render.js');
      const html = renderTemplate('', {});

      expect(html).toBe('');
    });

    it('handles template with only placeholders', async () => {
      const { renderTemplate } = await import('./template-render.js');
      const html = renderTemplate('{{a}} {{b}} {{c}}', { a: '1', b: '2', c: '3' });

      expect(html).toContain('1');
      expect(html).toContain('2');
      expect(html).toContain('3');
    });
  });
});

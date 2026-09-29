/**
 * Resolver contract tests: required definitions, JSON value policy, literal
 * text encoding, opt-in Markdown, preserve and strict modes.
 */

import { describe, expect, it } from 'bun:test';

import { normalize } from '@lostgradient/markdown';

import {
  PlaceholderTemplateError,
  resolveTemplatePlaceholders,
  sortPlaceholderDiagnostics,
} from './template-placeholders.js';
import type {
  JsonObject,
  PlaceholderCandidate,
  PlaceholderDiagnostic,
  PlaceholderResolutionOptions,
} from './types.js';

/** Options declaring each path with unknown types unless given. */
function declare(
  ...candidates: Array<string | PlaceholderCandidate>
): PlaceholderResolutionOptions {
  return {
    definitions: {
      candidates: candidates.map((candidate) =>
        typeof candidate === 'string' ? { path: candidate } : candidate,
      ),
    },
  };
}

/** Resolve with values the TypeScript types cannot express (invalid runtime data). */
function resolveUnchecked(
  template: string,
  values: unknown,
  options: unknown,
): ReturnType<typeof resolveTemplatePlaceholders> {
  return resolveTemplatePlaceholders(
    template,
    values as JsonObject,
    options as PlaceholderResolutionOptions,
  );
}

/** An array with holes at indexes 0 and 1. */
function sparseArray(): number[] {
  const sparse: number[] = [];
  sparse[2] = 3;
  return sparse;
}

const ANY_MESSAGE = expect.any(String) as unknown as string;

function tokenIssue(
  code: PlaceholderDiagnostic['code'],
  template: string,
  raw: string,
  path?: string,
): PlaceholderDiagnostic {
  const startOffset = template.indexOf(raw);
  if (startOffset === -1) throw new Error(`fixture does not contain ${raw}`);
  return {
    code,
    message: ANY_MESSAGE,
    ...(path === undefined ? {} : { path }),
    location: { kind: 'token', startOffset, endOffset: startOffset + raw.length },
  };
}

function configurationIssue(
  code: PlaceholderDiagnostic['code'],
  property: string,
): PlaceholderDiagnostic {
  return { code, message: ANY_MESSAGE, location: { kind: 'configuration', property } };
}

describe('resolveTemplatePlaceholders options contract', () => {
  it('encodes Markdown punctuation in a text-mode string replacement and reports no issues', () => {
    const template = '{{value}}';
    const result = resolveTemplatePlaceholders(
      template,
      { value: '**important**' },
      { definitions: { candidates: [{ path: 'value', types: ['string'] }] } },
    );

    expect(result).toEqual({ text: '&#42;&#42;important&#42;&#42;', issues: [] });
  });

  it('matches the specification text-mode encoding fixture table', () => {
    const fixtures: Array<[JsonObject['value'], string]> = [
      ['Alice', 'Alice'],
      ['**important**', '&#42;&#42;important&#42;&#42;'],
      ['a&b', 'a&#38;b'],
      ['<x>', '&#60;x&#62;'],
      ['\\', '&#92;'],
      ['a\nb', 'a&#10;b'],
      ['a|b', 'a&#124;b'],
      ['# title', '&#35;&#32;title'],
      ['- item', '&#45;&#32;item'],
      ['[x](u)', '&#91;x&#93;&#40;u&#41;'],
      [42, '42'],
      [false, 'false'],
      [null, 'null'],
      [[1, 'x'], '&#91;1&#44;&#34;x&#34;&#93;'],
    ];

    for (const [value, expected] of fixtures) {
      expect(resolveTemplatePlaceholders('{{value}}', { value }, declare('value'))).toEqual({
        text: expected,
        issues: [],
      });
    }
  });

  it('keeps code points at or above U+00A0 and encodes other whitespace and controls', () => {
    const result = resolveTemplatePlaceholders(
      '{{value}}',
      { value: 'é😀 \t\r x' },
      declare('value'),
    );

    expect(result.text).toBe('é😀 &#9;&#13;&#32;x');
  });

  it('turns U+0000 and isolated surrogates into visible escape text before encoding', () => {
    const result = resolveTemplatePlaceholders(
      '{{value}}',
      { value: 'a\u0000b\ud800c\udfffd😀' },
      declare('value'),
    );

    expect(result.text).toBe('a&#92;u0000b&#92;ud800c&#92;udfffd😀');
  });

  it('uses the same replacement bytes in every eligible Markdown context', () => {
    const template = '# {{v}}\n\n- {{v}}\n\n> {{v}}\n\n| h |\n| - |\n| {{v}} |\n\n[{{v}}](u)';
    const result = resolveTemplatePlaceholders(template, { v: 'a|b' }, declare('v'));

    expect(result.text).toBe(template.replaceAll('{{v}}', 'a&#124;b'));
  });

  it('leaves the template untouched outside replaced ranges and processes replacements once', () => {
    const template = '**Bold** `{{v}}` {{v}}{{v}}';
    const result = resolveTemplatePlaceholders(template, { v: '{{v}}' }, declare('v'));

    expect(result).toEqual({
      text: '**Bold** `{{v}}` &#123;&#123;v&#125;&#125;&#123;&#123;v&#125;&#125;',
      issues: [],
    });
  });
});

describe('resolveTemplatePlaceholders JSON formatting', () => {
  it.each([
    ['empty string', '', ''],
    ['zero', 0, '0'],
    ['negative zero', -0, '0'],
    ['false', false, 'false'],
    ['empty array', [], '&#91;&#93;'],
    ['empty object', {}, '&#123;&#125;'],
    ['fraction', 1.5, '1&#46;5'],
    ['exponent', 1e21, '1e&#43;21'],
  ])('formats %s as a successful value', (_label, value, expected) => {
    expect(resolveTemplatePlaceholders('{{v}}', { v: value }, declare('v'))).toEqual({
      text: expected,
      issues: [],
    });
  });

  it('serializes nested arrays in order and objects with recursively sorted keys', () => {
    const value = {
      b: [3, { z: 1, y: [true, null] }],
      a: { 'first-name': 'Ada', 'dotted.key': 1 },
    };
    const result = resolveTemplatePlaceholders('{{v}}', { v: value }, declare('v'));
    const expectedJson =
      '{"a":{"dotted.key":1,"first-name":"Ada"},"b":[3,{"y":[true,null],"z":1}]}';

    expect(result.issues).toEqual([]);
    expect(result.text).toBe(
      expectedJson.replaceAll(/[^A-Za-z0-9]/g, (character) => `&#${character.charCodeAt(0)};`),
    );
  });

  it('inserts string values raw in markdown mode while other JSON stays literal', () => {
    const options = { ...declare('s', 'n', 'list'), valueMode: 'markdown' } as const;
    const result = resolveTemplatePlaceholders(
      '{{s}} {{n}} {{list}}',
      { s: '**important**', n: -0, list: ['*a*'] },
      options,
    );

    expect(result).toEqual({ text: '**important** 0 &#91;&#34;&#42;a&#42;&#34;&#93;', issues: [] });
  });

  it('serializes shared acyclic references at each position', () => {
    const shared = { k: 1 };
    const result = resolveTemplatePlaceholders(
      '{{v}}',
      { v: [shared, shared] },
      { ...declare('v'), valueMode: 'markdown' },
    );

    expect(result.issues).toEqual([]);
    expect(result.text).toBe(
      '&#91;&#123;&#34;k&#34;&#58;1&#125;&#44;&#123;&#34;k&#34;&#58;1&#125;&#93;',
    );
  });

  it('accepts null-prototype dictionaries and deeply nested data', () => {
    const dictionary = Object.assign(Object.create(null) as JsonObject, { name: 'x' });
    let deep: JsonObject['v'] = 'leaf';
    for (let depth = 0; depth < 20_000; depth++) deep = [deep];

    expect(resolveTemplatePlaceholders('{{d.name}}', { d: dictionary }, declare('d.name'))).toEqual(
      {
        text: 'x',
        issues: [],
      },
    );
    const deepResult = resolveTemplatePlaceholders('{{v}}', { v: deep }, declare('v'));
    expect(deepResult.issues).toEqual([]);
    expect(deepResult.text.startsWith('&#91;&#91;')).toBe(true);
  });
});

describe('resolveTemplatePlaceholders diagnostics', () => {
  it('distinguishes a missing own property from null', () => {
    const template = '{{a}} {{b}}';
    const result = resolveTemplatePlaceholders(template, { b: null }, declare('a', 'b'));

    expect(result).toEqual({
      text: '{{a}} null',
      issues: [tokenIssue('missing_value', template, '{{a}}', 'a')],
    });
  });

  it('never resolves undeclared input keys and rejects values with an inherited prototype', () => {
    const template = '{{extra}} {{name}} {{toStringish}}';
    const values = Object.assign(Object.create({ toStringish: 'inherited' }) as JsonObject, {
      extra: 'secret',
      name: 'Ada',
    });
    const result = resolveTemplatePlaceholders(template, values, declare('name', 'toStringish'));

    expect(result).toEqual({
      text: '{{extra}} {{name}} {{toStringish}}',
      issues: [configurationIssue('invalid_values', 'values')],
    });
    const plain = resolveTemplatePlaceholders(
      '{{extra}} {{name}}',
      { extra: 'secret', name: 'Ada' },
      declare('name'),
    );
    expect(plain).toEqual({
      text: '{{extra}} Ada',
      issues: [tokenIssue('unknown_placeholder', '{{extra}} {{name}}', '{{extra}}', 'extra')],
    });
  });

  it('reports one primary issue per token in precedence order with stable ordering', () => {
    const template =
      '{{name}} {{{x}}} {{1bad}} {{constructor}} {{unknown}} {{missing}} {{bad_value}} {{typed}} {{unclosed';
    const result = resolveTemplatePlaceholders(
      template,
      { name: 'Ada', bad_value: Number.NaN, typed: 'text' },
      declare('name', 'missing', 'bad_value', { path: 'typed', types: ['number'] }),
    );

    expect(result.text).toBe(template.replace('{{name}}', 'Ada'));
    expect(result.issues).toEqual([
      tokenIssue('malformed_token', template, '{{{x}}}'),
      tokenIssue('invalid_path_format', template, '{{1bad}}', '1bad'),
      tokenIssue('blocked_path', template, '{{constructor}}', 'constructor'),
      tokenIssue('unknown_placeholder', template, '{{unknown}}', 'unknown'),
      tokenIssue('missing_value', template, '{{missing}}', 'missing'),
      tokenIssue('invalid_value', template, '{{bad_value}}', 'bad_value'),
      tokenIssue('type_mismatch', template, '{{typed}}', 'typed'),
      tokenIssue('malformed_token', template, '{{unclosed'),
    ]);
  });

  it('checks declared types, including integer and unions', () => {
    const template = '{{i}} {{f}} {{u}} {{n}} {{s}} {{o}} {{a}} {{any}}';
    const result = resolveTemplatePlaceholders(
      template,
      { i: 3, f: 3.5, u: 2.5, n: null, s: null, o: [], a: {}, any: { x: [1] } },
      declare(
        { path: 'i', types: ['integer'] },
        { path: 'f', types: ['integer'] },
        { path: 'u', types: ['number', 'integer'] },
        { path: 'n', types: ['string', 'null'] },
        { path: 's', types: ['string'] },
        { path: 'o', types: ['object'] },
        { path: 'a', types: ['array'] },
        'any',
      ),
    );

    expect(result.issues.map((issue) => [issue.code, issue.path])).toEqual([
      ['type_mismatch', 'f'],
      ['type_mismatch', 's'],
      ['type_mismatch', 'o'],
      ['type_mismatch', 'a'],
    ]);
    expect(result.text.startsWith('3 {{f}} 2&#46;5 null {{s}} {{o}} {{a}} ')).toBe(true);
  });

  it.each([
    ['undefined', undefined],
    ['bigint', 1n],
    ['symbol', Symbol('s')],
    ['function', () => 'x'],
    ['infinity', Number.POSITIVE_INFINITY],
    ['sparse array', sparseArray()],
    ['nested undefined', { a: [undefined] }],
    ['class instance', new Date(0)],
    ['map', new Map()],
  ])('reports invalid_value for %s without leaking content', (_label, value) => {
    const template = 'x {{v}}';
    const result = resolveUnchecked(template, { v: value }, declare('v'));

    expect(result).toEqual({
      text: template,
      issues: [tokenIssue('invalid_value', template, '{{v}}', 'v')],
    });
  });

  it('reports cycles as invalid_value', () => {
    const cyclic: Record<string, unknown> = { name: 'loop' };
    cyclic['self'] = cyclic;
    const result = resolveUnchecked('{{v}}', { v: cyclic }, declare('v'));

    expect(result.issues.map((issue) => issue.code)).toEqual(['invalid_value']);
  });

  it('never invokes accessors or toJSON in referenced data', () => {
    let calls = 0;
    const withGetter = Object.defineProperty({}, 'secret', {
      enumerable: true,
      get: () => {
        calls++;
        return 'leaked';
      },
    });
    const withToJson = {
      toJSON: () => {
        calls++;
        return 'leaked';
      },
    };
    const template = '{{g}} {{g.secret}} {{t}}';
    const result = resolveUnchecked(
      template,
      { g: withGetter, t: withToJson },
      declare('g', 'g.secret', 't'),
    );

    expect(calls).toBe(0);
    expect(result.text).toBe(template);
    expect(result.issues.map((issue) => [issue.code, issue.path])).toEqual([
      ['invalid_value', 'g'],
      ['invalid_value', 'g.secret'],
      ['invalid_value', 't'],
    ]);
    expect(JSON.stringify(result.issues)).not.toContain('leaked');
  });

  it('treats JSON primitives and arrays as missing intermediates and other data as invalid', () => {
    const template = '{{s.x}} {{list.x}} {{u.x}} {{d.x}}';
    const result = resolveUnchecked(
      template,
      { s: 'text', list: [1], u: undefined, d: new Date(0) },
      declare('s.x', 'list.x', 'u.x', 'd.x'),
    );

    expect(result.issues.map((issue) => [issue.code, issue.path])).toEqual([
      ['missing_value', 's.x'],
      ['missing_value', 'list.x'],
      ['invalid_value', 'u.x'],
      ['invalid_value', 'd.x'],
    ]);
  });

  it('ignores invalid data outside the referenced subtrees', () => {
    const result = resolveUnchecked(
      '{{user.name}}',
      { user: { name: 'Ada', other: () => 1 }, unrelated: 1n },
      declare('user.name'),
    );

    expect(result).toEqual({ text: 'Ada', issues: [] });
  });

  it('never includes supplied values in diagnostic messages', () => {
    const result = resolveTemplatePlaceholders(
      '{{v}}',
      { v: 'SENSITIVE' },
      declare({ path: 'v', types: ['number'] }),
    );

    expect(result.issues).toHaveLength(1);
    expect(JSON.stringify(result.issues)).not.toContain('SENSITIVE');
  });
});

describe('resolveTemplatePlaceholders configuration', () => {
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['an array', []],
    ['a class instance', new Date(0)],
  ])(
    'reports invalid_values for %s values and returns the template unchanged',
    (_label, values) => {
      expect(resolveUnchecked('{{a}}', values, declare('a'))).toEqual({
        text: '{{a}}',
        issues: [configurationIssue('invalid_values', 'values')],
      });
    },
  );

  it('reports invalid option strings and disables fill', () => {
    expect(
      resolveUnchecked(
        '{{a}}',
        { a: 'x' },
        { ...declare('a'), valueMode: 'html', unresolved: null },
      ),
    ).toEqual({
      text: '{{a}}',
      issues: [
        configurationIssue('invalid_option', 'unresolved'),
        configurationIssue('invalid_option', 'valueMode'),
      ],
    });
  });

  it('treats explicit undefined options as their defaults', () => {
    expect(
      resolveUnchecked(
        '{{a}}',
        { a: '*x*' },
        { ...declare('a'), valueMode: undefined, unresolved: undefined },
      ),
    ).toEqual({ text: '&#42;x&#42;', issues: [] });
  });

  it('returns the unchanged template with only definition issues when the catalog is disabled', () => {
    const result = resolveUnchecked(
      '{{a}} {{unknown}} {{',
      { a: 'x' },
      { definitions: { candidates: [{ path: 'a' }, { path: 'a' }] } },
    );

    expect(result.text).toBe('{{a}} {{unknown}} {{');
    expect(result.issues.map((issue) => [issue.code, issue.location.kind])).toEqual([
      ['duplicate_candidate', 'definition'],
    ]);
  });

  it('reports missing definitions as invalid_definitions', () => {
    expect(resolveUnchecked('{{a}}', { a: 'x' }, {})).toEqual({
      text: '{{a}}',
      issues: [configurationIssue('invalid_definitions', 'definitions')],
    });
    expect(resolveUnchecked('{{a}}', { a: 'x' }, undefined).issues).toEqual([
      configurationIssue('invalid_definitions', 'definitions'),
    ]);
  });

  it('reports every eligible token as unknown with an empty valid catalog', () => {
    const template = '{{a}} and {{b}}';

    expect(resolveTemplatePlaceholders(template, {}, { definitions: { candidates: [] } })).toEqual({
      text: template,
      issues: [
        tokenIssue('unknown_placeholder', template, '{{a}}', 'a'),
        tokenIssue('unknown_placeholder', template, '{{b}}', 'b'),
      ],
    });
  });

  it('accepts schema definitions', () => {
    const result = resolveTemplatePlaceholders(
      'Hi {{user.name}}',
      { user: { name: 'Ada' } },
      {
        definitions: {
          schema: {
            type: 'object',
            properties: { user: { type: 'object', properties: { name: { type: 'string' } } } },
          },
        },
      },
    );

    expect(result).toEqual({ text: 'Hi Ada', issues: [] });
  });
});

describe('resolveTemplatePlaceholders strict mode', () => {
  it('throws PlaceholderTemplateError with the ordered issues and no partial result', () => {
    const template = '{{b}} {{a}} {{known}}';
    let caught: unknown;
    try {
      resolveTemplatePlaceholders(
        template,
        { known: 'SECRET_VALUE' },
        { ...declare('known'), unresolved: 'error' },
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(PlaceholderTemplateError);
    expect(caught).toBeInstanceOf(Error);
    const error = caught as PlaceholderTemplateError;
    expect(error.name).toBe('PlaceholderTemplateError');
    expect(error.issues).toEqual([
      tokenIssue('unknown_placeholder', template, '{{b}}', 'b'),
      tokenIssue('unknown_placeholder', template, '{{a}}', 'a'),
    ]);
    expect(Object.keys(error).toSorted()).toEqual(['issues', 'name']);
    expect(`${error.message}${JSON.stringify(error)}`).not.toContain('SECRET_VALUE');
  });

  it('throws for configuration issues too', () => {
    expect(() => resolveUnchecked('{{a}}', null, { ...declare('a'), unresolved: 'error' })).toThrow(
      PlaceholderTemplateError,
    );
  });

  it('returns normally when there are no issues', () => {
    expect(
      resolveTemplatePlaceholders('{{a}}', { a: 1 }, { ...declare('a'), unresolved: 'error' }),
    ).toEqual({ text: '1', issues: [] });
  });
});

describe('resolveTemplatePlaceholders Markdown interaction caveats', () => {
  it('explains that Markdown formatting can split a token such as {{_meta_}}', () => {
    const result = resolveTemplatePlaceholders('{{_meta_}}', { _meta_: 'x' }, declare('_meta_'));

    expect(result.text).toBe('{{_meta_}}');
    expect(result.issues.map((issue) => issue.code)).toEqual(['malformed_token']);
    expect(result.issues[0]?.message).toContain('split by Markdown formatting');
  });

  it('never scans tokens inside dollar-delimited inline math, even in strict mode', () => {
    const template = 'Was ${{old}}, now ${{new}}.';

    expect(
      resolveTemplatePlaceholders(
        template,
        { old: '1', new: '2' },
        { ...declare('old', 'new'), unresolved: 'error' },
      ),
    ).toEqual({ text: 'Was ${{old}}, now $2.', issues: [] });
  });

  it('keeps ASCII letters and digits, so values can combine with adjacent template syntax', () => {
    expect(
      resolveTemplatePlaceholders('{{n}}. item &{{x}};', { n: 42, x: 'lt' }, declare('n', 'x')),
    ).toEqual({ text: '42. item &lt;', issues: [] });
  });
});

describe('resolveTemplatePlaceholders backslash-escaped paths', () => {
  it('fills a body backslash-escaped path in text mode, replacing the full original range', () => {
    // {{user\_name}} is what the Markdown serializer produces from
    // {{user_name}} after one rich-mode edit or mode switch.
    const template = 'Hello {{user\\_name}}!';

    expect(
      resolveTemplatePlaceholders(template, { user_name: 'Ada' }, declare('user_name')),
    ).toEqual({ text: 'Hello Ada!', issues: [] });
  });

  it('fills a body backslash-escaped path in markdown mode, replacing the full original range', () => {
    const template = 'Hello {{user\\_name}}!';

    expect(
      resolveTemplatePlaceholders(
        template,
        { user_name: 'Ada' },
        { ...declare('user_name'), valueMode: 'markdown' },
      ),
    ).toEqual({ text: 'Hello Ada!', issues: [] });
  });
});

describe('resolveTemplatePlaceholders round trip through normalize', () => {
  it('fills {{user_name}} after normalize backslash-escapes it, exactly as for the raw template', () => {
    const raw = resolveTemplatePlaceholders(
      'Hello {{user_name}}',
      { user_name: 'Ada' },
      declare('user_name'),
    );
    const serialized = normalize('Hello {{user_name}}');
    const normalized = resolveTemplatePlaceholders(
      serialized,
      { user_name: 'Ada' },
      declare('user_name'),
    );

    expect(serialized).toBe('Hello {{user\\_name}}\n');
    expect(normalized).toEqual({ text: 'Hello Ada\n', issues: [] });
    expect(normalized.text.trim()).toBe(raw.text);
  });

  it('fills the escaped serialized form the rich editor produces for {{_meta_}}, which is stable under normalize', () => {
    // A user types {{_meta_}} as unmarked text; the editor's serializer
    // escapes it to {{\_meta\_}}, and normalize leaves that already-escaped
    // form unchanged, so it keeps resolving across further round trips.
    const serialized = '{{\\_meta\\_}}';

    expect(normalize(serialized)).toBe(`${serialized}\n`);
    expect(
      resolveTemplatePlaceholders(normalize(serialized), { _meta_: 'x' }, declare('_meta_')),
    ).toEqual({ text: 'x\n', issues: [] });
  });

  it('is not itself a round-trip case: raw unescaped {{_meta_}} is emphasis and stays unfillable', () => {
    // Documented in the amendment: the underscores form emphasis, splitting
    // the token, so this path can never be written as raw unescaped
    // Markdown. Only the serialized escaped form above resolves.
    const result = resolveTemplatePlaceholders('{{_meta_}}', { _meta_: 'x' }, declare('_meta_'));

    expect(result.issues.map((issue) => issue.code)).toEqual(['malformed_token']);
  });

  it('fills {{user.first_name}} after normalize backslash-escapes its segment, exactly as for the raw template', () => {
    const values = { user: { first_name: 'Ada' } };
    const raw = resolveTemplatePlaceholders(
      '{{user.first_name}}',
      values,
      declare('user.first_name'),
    );
    const serialized = normalize('{{user.first_name}}');
    const normalized = resolveTemplatePlaceholders(serialized, values, declare('user.first_name'));

    expect(serialized).toBe('{{user.first\\_name}}\n');
    expect(normalized).toEqual({ text: 'Ada\n', issues: [] });
    expect(normalized.text.trim()).toBe(raw.text);
  });
});

describe('sortPlaceholderDiagnostics', () => {
  it('is re-exported from template-placeholders.js for reuse outside the resolver', () => {
    const template = '{{b}} {{a}}';
    const bIssue = tokenIssue('unknown_placeholder', template, '{{b}}', 'b');
    const aIssue = tokenIssue('unknown_placeholder', template, '{{a}}', 'a');

    // {{b}} starts before {{a}} in source, so it sorts first by startOffset
    // regardless of insertion order; the duplicate {{a}} entry collapses.
    expect(sortPlaceholderDiagnostics([aIssue, bIssue, aIssue])).toEqual([bIssue, aIssue]);
  });
});

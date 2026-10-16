import { describe, expect, test } from 'bun:test';

import { getByPath, pointerSegments } from './resolve-shared.ts';
import { mergeAndExpandExtends, mergeDocuments } from './resolve.ts';
import { expandContextSources, expandSetSources } from './resolver-order.ts';
import type { ResolverDocument, TokenDocument } from './types.ts';
import { TokenValidationError } from './types.ts';

function reasonOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    if (error instanceof TokenValidationError) return error.issues[0]!.reason;
    throw error;
  }
  throw new Error('expected a TokenValidationError');
}

function resolverWith(sourceRef: string): ResolverDocument {
  return {
    version: '2025.10',
    sets: { shared: { sources: [{ $ref: sourceRef }] } },
    modifiers: { theme: { contexts: { light: [{ $ref: sourceRef }] } } },
    resolutionOrder: [{ $ref: '#/sets/shared' }, { $ref: '#/modifiers/theme' }],
  };
}

describe('resolver-internal references', () => {
  test('a set source that is not a well-formed #/sets/<name> pointer is malformed', () => {
    expect(reasonOf(() => expandSetSources(resolverWith('#/nonsense'), 'shared'))).toBe(
      'malformed resolver-internal reference: #/nonsense',
    );
  });

  test('a modifier context source that is not a well-formed pointer is malformed', () => {
    expect(reasonOf(() => expandContextSources(resolverWith('#/nonsense'), 'theme', 'light'))).toBe(
      'malformed resolver-internal reference: #/nonsense',
    );
  });

  test('an unknown modifier context is named, not guessed', () => {
    expect(
      reasonOf(() => expandContextSources(resolverWith('a.tokens.json'), 'theme', 'dark')),
    ).toBe('resolver-internal reference names an unknown modifier context: dark');
    expect(
      reasonOf(() => expandContextSources(resolverWith('a.tokens.json'), 'nope', 'light')),
    ).toBe('resolver-internal reference names an unknown modifier context: light');
  });
});

describe('JSON Pointer reading', () => {
  test('a pointer with an invalid percent escape is reported', () => {
    expect(reasonOf(() => pointerSegments('#/a/%E0%A4%A'))).toBe(
      'JSON Pointer contains invalid percent encoding',
    );
  });

  test('walks into arrays by canonical index and refuses every other segment', () => {
    const value = { list: [{ name: 'first' }, { name: 'second' }] };
    expect(getByPath(value, ['list', '1', 'name'])).toBe('second');
    expect(getByPath(value, ['list', 'length'])).toBeUndefined();
    expect(getByPath(value, ['list', '01'])).toBeUndefined();
    expect(getByPath(value, ['list', '9'.repeat(400)])).toBeUndefined();
    expect(getByPath(value, ['list', '5', 'name'])).toBeUndefined();
  });
});

describe('document merging', () => {
  test('an override that does not restate $deprecated keeps the base token deprecated', () => {
    const merged = mergeDocuments([
      { size: { $type: 'number', $value: 1, $deprecated: 'use scale' } },
      { size: { $value: 2 } },
    ]);
    expect(merged['size']).toMatchObject({ $value: 2, $deprecated: 'use scale', $type: 'number' });
  });

  test('a nested group inherits an $extends it never declared, remembering where it was written', () => {
    const document: TokenDocument = {
      src: { t: { $type: 'number', $value: 1 } },
      base: { inner: { $extends: '{src}' } },
      derived: { $extends: '{base}', inner: { u: { $type: 'number', $value: 2 } } },
    };
    const origins = new Map<object, string>([[document, 'doc.tokens.json']]);
    const merged = mergeAndExpandExtends([document], [document], origins);
    const inner = (merged['derived'] as TokenDocument)['inner'] as TokenDocument;
    expect(Object.keys(inner)).toEqual(expect.arrayContaining(['u', 't']));
  });
});

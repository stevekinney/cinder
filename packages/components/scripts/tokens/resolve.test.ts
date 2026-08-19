import { describe, expect, test } from 'bun:test';
import { mergeDocuments, resolveDocument } from './resolve.ts';
import { TokenValidationError, type TokenDocument } from './types.ts';

describe('DTCG resolver', () => {
  test('resolves curly aliases and composite property references', () => {
    const resolved = resolveDocument({
      primitive: { $type: 'dimension', value: { $value: { value: 2, unit: 'px' } } },
      border: {
        $type: 'border',
        base: { $value: { color: '{color}', width: '{primitive.value}', style: 'solid' } },
      },
      color: { $type: 'color', $value: { colorSpace: 'oklch', components: [0.5, 0.1, 255] } },
    });
    expect(resolved['border.base']?.$value).toEqual({
      color: { colorSpace: 'oklch', components: [0.5, 0.1, 255] },
      width: { value: 2, unit: 'px' },
      style: 'solid',
    });
  });

  test('resolves JSON Pointer aliases', () => {
    const resolved = resolveDocument({
      group: { $type: 'number', base: { $value: 2 }, copy: { $value: '#/group/base' } },
    });
    expect(resolved['group.copy']?.$value).toBe(2);
  });

  test('resolves canonical escaped JSON Pointers into token properties', () => {
    const resolved = resolveDocument({
      'a/b': { $type: 'dimension', $value: { value: 2, unit: 'px' } },
      copy: { $type: 'number', $value: '#/a~1b/$value/value' },
    });
    expect(resolved['copy']?.$value).toBe(2);
  });

  test('decodes percent-encoded JSON Pointer fragments', () => {
    const resolved = resolveDocument({
      'a b': { $type: 'number', $value: 2 },
      copy: { $type: 'number', $value: '#/a%20b' },
    });
    expect(resolved['copy']?.$value).toBe(2);
  });

  test('retains inherited types and a group root token', () => {
    const resolved = resolveDocument({
      group: { $type: 'number', $root: { $value: 1 }, child: { $value: 2 } },
    });
    expect(resolved['group']).toMatchObject({ $type: 'number', $value: 1 });
    expect(resolved['group.child']).toMatchObject({ $type: 'number', $value: 2 });
  });

  test('rejects circular aliases and group extensions', () => {
    expect(() =>
      resolveDocument({
        $type: 'number',
        first: { $value: '{second}' },
        second: { $value: '{first}' },
      }),
    ).toThrow(TokenValidationError);
    expect(() =>
      resolveDocument({ one: { $extends: '{two}' }, two: { $extends: '{one}' } }),
    ).toThrow('circular $extends');
  });

  test('inherits group tokens through $extends', () => {
    const resolved = resolveDocument({
      base: { $type: 'number', value: { $value: 1 } },
      derived: { $extends: '{base}' },
    });
    expect(resolved['derived.value']).toEqual({ $type: 'number', $value: 1 });
  });

  test('resolves nested extensions before copying an extended group', () => {
    const resolved = resolveDocument({
      common: { value: { $value: 1 } },
      base: { nested: { $extends: '{common}' } },
      derived: { $extends: '{base}' },
    });
    expect(resolved['derived.nested.value']?.$value).toBe(1);
  });

  test('merges ordered sources with the final source winning', () => {
    const first: TokenDocument = { $type: 'number', token: { $value: 1 } };
    const last: TokenDocument = { $type: 'number', token: { $value: 2 } };
    expect(resolveDocument(mergeDocuments([first, last]))['token']?.$value).toBe(2);
  });

  test('merges sparse nested modifiers without dropping untouched tokens', () => {
    const merged = mergeDocuments([
      { group: { $type: 'number', first: { $value: 1 }, second: { $value: 2 } } },
      { group: { first: { $value: 3 } } },
    ]);
    expect(resolveDocument(merged)['group.first']?.$value).toBe(3);
    expect(resolveDocument(merged)['group.second']?.$value).toBe(2);
  });

  test('retains tokens named __proto__ through resolution and document merging', () => {
    const document = JSON.parse('{"$type":"number","__proto__":{"$value":1}}') as TokenDocument;
    expect(resolveDocument(document)['__proto__']).toMatchObject({ $type: 'number', $value: 1 });
    expect(resolveDocument(mergeDocuments([document]))['__proto__']).toMatchObject({
      $type: 'number',
      $value: 1,
    });
  });

  test('retains nested __proto__ tokens when a later source merges the group', () => {
    const base = JSON.parse(
      '{"group":{"$type":"number","__proto__":{"$value":1},"first":{"$value":1}}}',
    ) as TokenDocument;
    const modifier: TokenDocument = { group: { first: { $value: 2 } } };

    expect(resolveDocument(mergeDocuments([base, modifier]))['group.__proto__']).toMatchObject({
      $type: 'number',
      $value: 1,
    });
  });
});

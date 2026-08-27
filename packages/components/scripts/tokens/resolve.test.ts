import { describe, expect, test } from 'bun:test';
import { mergeDocuments, resolveDocument } from './resolve.ts';
import { TokenValidationError, type TokenDocument } from './types.ts';
import { assertValidTokenDocument } from './validate.ts';

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

  test('resolves a property-level JSON Pointer reference into a composite token value', () => {
    // Distinct from the whole-token curly-brace alias case above: this
    // reference targets one property ($value) of a dimension token from
    // inside a border token's `width` member, not the whole dimension token.
    const resolved = resolveDocument({
      dimension: { $type: 'dimension', hairline: { $value: { value: 1, unit: 'px' } } },
      color: { $type: 'color', $value: { colorSpace: 'oklch', components: [0, 0, 0] } },
      border: {
        $type: 'border',
        thin: {
          $value: { color: '{color}', width: '#/dimension/hairline/$value', style: 'solid' },
        },
      },
    });
    expect(resolved['border.thin']?.$value).toEqual({
      color: { colorSpace: 'oklch', components: [0, 0, 0] },
      width: { value: 1, unit: 'px' },
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

  test('resolves JSON Pointers to group root tokens', () => {
    const resolved = resolveDocument({
      group: { $type: 'number', $root: { $value: 1 } },
      copy: { $type: 'number', $value: '#/group/$root/$value' },
    });
    expect(resolved['copy']?.$value).toBe(1);
  });

  test('resolves JSON Pointers to document root tokens', () => {
    const resolved = resolveDocument({
      $type: 'number',
      $root: { $value: 1 },
      copy: { $value: '#/$root/$value' },
    });
    expect(resolved['copy']?.$value).toBe(1);
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

  test('retains inherited nested group members through sparse overrides', () => {
    const resolved = resolveDocument({
      base: { $type: 'number', nested: { first: { $value: 1 }, second: { $value: 2 } } },
      derived: { $extends: '{base}', nested: { first: { $value: 3 } } },
    });
    expect(resolved['derived.nested.first']?.$value).toBe(3);
    expect(resolved['derived.nested.second']?.$value).toBe(2);
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

  test('round-trips an unrecognized $extensions vendor key byte-for-byte through validate and resolve', () => {
    // Simulates the load -> validate -> resolve pipeline (loadTokenDocuments()
    // reads from the real corpus on disk, which this package does not own or
    // touch; assertValidTokenDocument + resolveDocument exercise the same
    // validate-then-resolve steps that pipeline runs per document).
    const extensions = {
      'com.example.vendor': { unrecognized: { nested: [1, 'two', null, true] } },
    };
    const document: TokenDocument = {
      color: {
        $type: 'color',
        $value: { colorSpace: 'oklch', components: [0.5, 0.1, 255] },
        $extensions: extensions,
      },
    };

    assertValidTokenDocument(document);
    const resolved = resolveDocument(document);

    expect(resolved['color']?.$extensions).toEqual(extensions);
    expect(JSON.stringify(resolved['color']?.$extensions)).toBe(JSON.stringify(extensions));
  });

  test('inherits __proto__ tokens through group extensions', () => {
    const document = JSON.parse(
      '{"base":{"$type":"number","__proto__":{"$value":1}},"derived":{"$extends":"{base}"}}',
    ) as TokenDocument;

    expect(resolveDocument(document)['derived.__proto__']).toMatchObject({
      $type: 'number',
      $value: 1,
    });
  });
});

describe('CIN-31: an override inherits identity metadata but not generation metadata', () => {
  const CINDER = 'com.lostgradient.cinder';

  function baseDocument(): TokenDocument {
    return {
      surface: {
        $type: 'color',
        raised: {
          $value: { colorSpace: 'oklch', components: [0.98, 0, 0] },
          $description: 'The raised surface.',
          $extensions: {
            'org.example.other': { note: 'unknown vendor data' },
            [CINDER]: {
              cssProperty: '--cinder-surface-raised',
              public: true,
              category: 'color',
              contrastPairs: ['color.text.default'],
              cssRecipe: 'light-dark(white, black)',
            },
          },
        },
      },
    };
  }

  function cinderOf(document: TokenDocument, path: readonly string[]): Record<string, unknown> {
    let node: unknown = document;
    for (const key of path) node = (node as Record<string, unknown>)[key];
    const extensions = (node as { $extensions?: Record<string, unknown> }).$extensions ?? {};
    return (extensions[CINDER] ?? {}) as Record<string, unknown>;
  }

  // Replacing a token wholesale dropped $description and the entire
  // $extensions block for every override, leaving 96 of 216 tokens in
  // resolved/dark.json with no cssProperty and no description -- a consumer
  // could not map most tokens back to a custom property.
  test('an override with no $extensions keeps identity and description', () => {
    const merged = mergeDocuments([
      baseDocument(),
      {
        surface: {
          raised: { $value: { colorSpace: 'oklch', components: [0.2, 0, 0] } },
        },
      },
    ]);

    const token = (merged['surface'] as Record<string, unknown>)['raised'] as Record<
      string,
      unknown
    >;
    expect(token['$description']).toBe('The raised surface.');
    expect(cinderOf(merged, ['surface', 'raised'])['cssProperty']).toBe('--cinder-surface-raised');
    expect(cinderOf(merged, ['surface', 'raised'])['public']).toBe(true);
    expect(cinderOf(merged, ['surface', 'raised'])['category']).toBe('color');
  });

  // The case that breaks a naive deep merge. shadow.small's base carries a
  // two-arm light-dark() recipe while its light override is a plain literal, so
  // inheriting the recipe would contradict the $value sitting beside it. An
  // absent cssRecipe means "no recipe" -- whether the override omitted the key
  // or omitted $extensions entirely.
  test('an override does NOT inherit the base cssRecipe', () => {
    const merged = mergeDocuments([
      baseDocument(),
      {
        surface: {
          raised: { $value: { colorSpace: 'oklch', components: [0.2, 0, 0] } },
        },
      },
    ]);

    expect(cinderOf(merged, ['surface', 'raised'])['cssRecipe']).toBeUndefined();
  });

  // The case that breaks a shallow merge of the $extensions OBJECT: an override
  // carrying its own namespace entry would wipe every key it does not restate.
  test('an override carrying its own recipe keeps it and still inherits identity', () => {
    const merged = mergeDocuments([
      baseDocument(),
      {
        surface: {
          raised: {
            $value: { colorSpace: 'oklch', components: [0.2, 0, 0] },
            $extensions: { [CINDER]: { cssRecipe: 'color-mix(in oklch, white, black)' } },
          },
        },
      },
    ]);

    const cinder = cinderOf(merged, ['surface', 'raised']);
    expect(cinder['cssRecipe']).toBe('color-mix(in oklch, white, black)');
    expect(cinder['cssProperty']).toBe('--cinder-surface-raised');
    expect(cinder['public']).toBe(true);
    expect(cinder['contrastPairs']).toEqual(['color.text.default']);
  });

  test('an override may override an inherited identity key rather than only add to it', () => {
    const merged = mergeDocuments([
      baseDocument(),
      {
        surface: {
          raised: {
            $value: { colorSpace: 'oklch', components: [0.2, 0, 0] },
            $description: 'Overridden description.',
            $extensions: { [CINDER]: { category: 'surface' } },
          },
        },
      },
    ]);

    const token = (merged['surface'] as Record<string, unknown>)['raised'] as Record<
      string,
      unknown
    >;
    expect(token['$description']).toBe('Overridden description.');
    expect(cinderOf(merged, ['surface', 'raised'])['category']).toBe('surface');
  });

  // The format requires unknown extension data to survive resolution, and an
  // override has no way to restate a namespace it knows nothing about.
  test('an unknown vendor namespace survives the merge', () => {
    const merged = mergeDocuments([
      baseDocument(),
      {
        surface: {
          raised: { $value: { colorSpace: 'oklch', components: [0.2, 0, 0] } },
        },
      },
    ]);

    const token = (merged['surface'] as Record<string, unknown>)['raised'] as {
      $extensions?: Record<string, unknown>;
    };
    expect(token.$extensions?.['org.example.other']).toEqual({ note: 'unknown vendor data' });
  });

  test('the override value still wins', () => {
    const merged = mergeDocuments([
      baseDocument(),
      {
        surface: {
          raised: { $value: { colorSpace: 'oklch', components: [0.2, 0, 0] } },
        },
      },
    ]);

    expect(resolveDocument(merged)['surface.raised']?.$value).toEqual({
      colorSpace: 'oklch',
      components: [0.2, 0, 0],
    });
  });
});

import { describe, expect, test } from 'bun:test';
import {
  createValueResolver,
  mergeAndExpandExtends,
  mergeDocuments,
  resolveDocument,
  tokenPathFromReference,
} from './resolve.ts';
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

  test('resolves a property-level $value pointer through a later-declared target alias', () => {
    const resolved = resolveDocument({
      copy: { $type: 'number', $value: '#/source/$value/value' },
      source: { $type: 'dimension', $value: '#/late/$value' },
      late: { $type: 'dimension', $value: { value: 3, unit: 'px' } },
    });
    expect(resolved['copy']?.$value).toBe(3);
  });

  test('resolves a $ref pointer into token metadata other than $value', () => {
    // The earlier property-level fix only special-cased a remainder starting
    // with `$value`; any other reserved token property ($description here,
    // but the same applies to $deprecated/$extensions) fell through to
    // looking inside `resolvedToken.$value`, where it doesn't exist.
    const resolved = resolveDocument({
      base: { $type: 'number', $value: 1, $description: 'the base token' },
      copy: { $type: 'string', $ref: '#/base/$description' },
    });
    expect(resolved['copy']?.$value).toBe('the base token');
  });

  test('resolves a bare #/$root pointer into metadata other than $value', () => {
    const resolved = resolveDocument({
      $root: { $type: 'number', $value: 1, $description: 'the document root token' },
      copy: { $type: 'string', $ref: '#/$root/$description' },
    });
    expect(resolved['copy']?.$value).toBe('the document root token');
  });

  test('resolves document-root group metadata without requiring an explicit $root segment', () => {
    const resolved = resolveDocument({
      $description: 'document group metadata',
      $root: { $type: 'number', $value: 1, $description: 'document root token metadata' },
      copy: { $type: 'string', $ref: '#/$description' },
    });
    expect(resolved['copy']?.$value).toBe('document group metadata');
  });

  test("resolves a $ref pointer into another alias token's own $ref, reading it before resolution deletes it", () => {
    // resolveRefToken deletes `$ref` from its token once resolved (so a
    // resolved token never carries a leftover alias pointer). Reading
    // `#/alias/$ref` therefore must capture the raw value BEFORE `alias`
    // itself gets resolved, or it always finds nothing.
    const resolved = resolveDocument({
      base: { $type: 'number', $value: 1 },
      alias: { $ref: '#/base' },
      copy: { $type: 'string', $ref: '#/alias/$ref' },
    });
    expect(resolved['copy']?.$value).toBe('#/base');
    // `alias` itself still resolves normally -- reading its raw $ref for
    // `copy` must not disturb `alias`'s own resolution.
    expect(resolved['alias']).toMatchObject({ $type: 'number', $value: 1 });
  });

  test('resolves a $ref into a dotted vendor extension key', () => {
    // `tokenPathFromReference` dot-joins the pointer and `resolveReference`
    // re-splits on '.' to walk the remainder -- lossy for a pointer segment
    // that itself contains a literal dot, which vendor extension keys always
    // do by convention ("com.lostgradient.cinder"). This test PINS today's
    const resolved = resolveDocument({
      base: {
        $type: 'color',
        $value: { colorSpace: 'oklch', components: [0, 0, 0] },
        $extensions: { 'com.lostgradient.cinder': { cssProperty: '--test-base' } },
      },
      copy: { $type: 'string', $ref: '#/base/$extensions/com.lostgradient.cinder/cssProperty' },
    });
    expect(resolved['copy']?.$value).toBe('--test-base');
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

  test('rejects a bare JSON Pointer fragment instead of treating it as the document root', () => {
    expect(() => resolveDocument({ $root: { $value: 1 }, copy: { $ref: '#/' } })).toThrow(
      /reference target does not exist/,
    );
  });

  test('rejects a bare JSON Pointer fragment when normalizing a generator path', () => {
    expect(() => tokenPathFromReference('#/')).toThrow(/reference target does not exist/);
  });

  test('resolves an inferred alias type before a metadata pointer reads it', () => {
    const resolved = resolveDocument({
      base: { $type: 'number', $value: 2 },
      copy: { $type: 'string', $value: '#/alias/$type' },
      alias: { $ref: '#/base' },
    });

    expect(resolved['copy']?.$value).toBe('number');
  });

  test('resolves an inferred document-root alias type before a metadata pointer reads it', () => {
    const resolved = resolveDocument({
      base: { $type: 'number', $value: 2 },
      $root: { $ref: '#/base' },
      copy: { $type: 'string', $value: '#/$root/$type' },
    });

    expect(resolved['copy']?.$value).toBe('number');
  });

  test('rejects a group pointer that omits the explicit $root segment', () => {
    expect(() =>
      resolveDocument({ group: { $root: { $value: 1 } }, copy: { $ref: '#/group' } }),
    ).toThrow(/reference target group must name \$root explicitly/);
  });

  test('rejects a group-root pointer that omits the $value property segment', () => {
    expect(() =>
      resolveDocument({
        group: { $root: { value: 7 } },
        copy: { $ref: '#/group/$root/value' },
      }),
    ).toThrow(/has no requested property/);
  });

  test('allows a token to point at its own metadata without circular-alias failure', () => {
    const resolved = resolveDocument({
      copy: { $type: 'string', $ref: '#/copy/$description', $description: 'metadata' },
    });
    expect(resolved['copy']?.$value).toBe('metadata');
  });

  test('resolves metadata on a rootless group', () => {
    const resolved = resolveDocument({
      group: { $description: 'group metadata', child: { $value: 1 } },
      copy: { $type: 'string', $ref: '#/group/$description' },
    });
    expect(resolved['copy']?.$value).toBe('group metadata');
  });

  test('resolves effective inherited $type on a rootless group', () => {
    const resolved = resolveDocument({
      group: { $type: 'number', child: { $description: 'child metadata' } },
      copy: { $type: 'string', $ref: '#/group/child/$type' },
    });
    expect(resolved['copy']?.$value).toBe('number');
  });

  test('resolves effective inherited $deprecated on a rootless group', () => {
    const resolved = resolveDocument({
      group: { $deprecated: 'legacy', child: { $description: 'child metadata' } },
      copy: { $type: 'string', $ref: '#/group/child/$deprecated' },
    });
    expect(resolved['copy']?.$value).toBe('legacy');
  });

  test('resolves inherited $deprecated alongside an explicit local $type', () => {
    const resolved = resolveDocument({
      group: {
        $deprecated: 'legacy',
        child: { $type: 'number', $description: 'child metadata' },
      },
      copy: { $type: 'string', $ref: '#/group/child/$deprecated' },
    });
    expect(resolved['copy']?.$value).toBe('legacy');
  });

  test('prefers group metadata when a group and its $root share an indexed path', () => {
    const resolved = resolveDocument({
      group: {
        $description: 'group metadata',
        $root: { $type: 'number', $value: 1, $description: 'root metadata' },
      },
      copy: { $type: 'string', $ref: '#/group/$description' },
    });
    expect(resolved['copy']?.$value).toBe('group metadata');
  });

  test('does not re-resolve a metadata value when its token is reached later', () => {
    const resolved = resolveDocument({
      alias: { $ref: '#/base', $description: 'base' },
      copy: { $type: 'string', $ref: '#/alias/$ref' },
      trigger: { $value: '{copy}' },
      base: { $type: 'string', $value: 'literal' },
    });
    expect(resolved['copy']?.$value).toBe('#/base');
  });

  test('keeps completion state across createValueResolver calls', () => {
    const resolver = createValueResolver([
      {
        base: { $type: 'string', $value: 'literal' },
        alias: { $ref: '#/base' },
        copy: { $type: 'string', $ref: '#/alias/$ref' },
        trigger: { $value: '{copy}' },
      },
    ]);
    expect(resolver('{trigger}')).toBe('#/base');
    expect(resolver('{copy}')).toBe('#/base');
  });

  test('preserves lookup-scope deprecation through a shadowing group', () => {
    const merged = mergeAndExpandExtends(
      [{ outer: { other: { $value: 1 } }, derived: { $extends: '{outer.base}' } }],
      [{ outer: { $deprecated: 'legacy', base: { value: { $value: 1 } } } }],
    );
    expect((merged['derived'] as Record<string, unknown>)['$deprecated']).toBe('legacy');
  });

  test('resolves lookup ancestor extends before inheriting deprecation through a shadowing wrapper', () => {
    const merged = mergeAndExpandExtends(
      [{ outer: { wrapper: { marker: { $value: 1 } } }, derived: { $extends: '{outer.base}' } }],
      [{ outer: { base: { $extends: '{legacy}' } }, legacy: { $deprecated: 'legacy' } }],
    );
    expect((merged['derived'] as Record<string, unknown>)['$deprecated']).toBe('legacy');
  });

  test('resolves ancestor extends before inheriting deprecation', () => {
    const merged = mergeAndExpandExtends([
      {
        $deprecated: false,
        derived: { $extends: '{outer.child}' },
        outer: { $extends: '{legacy}', child: { grandchild: { $value: 1 } } },
        legacy: { $deprecated: 'legacy', marker: { $value: true } },
      },
    ]);
    expect((merged['derived'] as Record<string, unknown>)['$deprecated']).toBe('legacy');
  });

  test('does not report a false circular extends when a nested target is under an active ancestor', () => {
    const resolved = resolveDocument({
      base: { child: { value: { $value: 1 } } },
      outer: { $extends: '{base}', child: { value: { $value: 2 } } },
      derived: { $extends: '{outer.child}' },
    });
    expect(resolved['derived.value']?.$value).toBe(2);
  });

  test('traverses nested wrappers after registering groups inherited by an outer extends', () => {
    const resolved = resolveDocument({
      base: { child: { value: { $value: 1 } } },
      outer: {
        $extends: '{base}',
        wrapper: { derived: { $extends: '{outer.child}' } },
      },
    });
    expect(resolved['outer.wrapper.derived.value']?.$value).toBe(1);
  });

  test('rejects a $root pointer into an ordinary token that has no $root member', () => {
    // "base" is an ordinary token, not a group with a $root child --
    // #/base/$root names a location that does not exist. Without checking
    // that "base" is actually a group's redirected root token, the loop
    // would strip "$root" unconditionally and silently resolve to "base"'s
    // own value, treating a malformed pointer as if it were valid.
    expect(() =>
      resolveDocument({
        base: { $type: 'number', $value: 1 },
        copy: { $type: 'number', $ref: '#/base/$root' },
      }),
    ).toThrow(/has no requested property/);
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

  test('a $ref token alias passes the full validate-then-resolve gate (CIN-463)', () => {
    // Unlike the other $ref tests in this file, this goes through
    // assertValidTokenDocument first -- the official DTCG 2025.10 format
    // JSON Schema's own $value/$ref discriminator (see the token.json
    // definition's allOf) runs ahead of validate.ts's semantic checks, and
    // this is the acceptance case named in the ticket: no $type anywhere in
    // the document for `copy` to inherit.
    const document: TokenDocument = {
      base: { $type: 'number', $value: 1 },
      copy: { $ref: '#/base' },
    };
    assertValidTokenDocument(document);
    const resolved = resolveDocument(document);
    expect(resolved['copy']).toMatchObject({ $type: 'number', $value: 1 });
  });

  test('resolves a whole-token $ref alias to the referenced token value (CIN-463)', () => {
    const resolved = resolveDocument({
      base: { $type: 'number', $value: 1 },
      copy: { $ref: '#/base' },
    });
    expect(resolved['copy']).toMatchObject({ $type: 'number', $value: 1 });
    // A resolved token never carries a leftover $ref alongside its $value.
    expect(resolved['copy']).not.toHaveProperty('$ref');
  });

  test("a $ref token keeps its own declared $type over the target's", () => {
    const resolved = resolveDocument({
      base: { $type: 'number', $value: 1 },
      copy: { $type: 'number', $ref: '#/base' },
    });
    expect(resolved['copy']?.$type).toBe('number');
  });

  test('resolves a chained $ref alias', () => {
    const resolved = resolveDocument({
      base: { $type: 'number', $value: 1 },
      second: { $ref: '#/base' },
      third: { $ref: '#/second' },
    });
    expect(resolved['third']).toMatchObject({ $type: 'number', $value: 1 });
  });

  test('infers $type from the target of a $ref ending in a $value segment, with no own $type', () => {
    // refTargetIndexPath (used for type inference) only stripped a trailing
    // `$root` segment, not `$value` -- `#/base/$value` dot-joined to
    // `base.$value`, which never matches the `tokens` index (`base` does),
    // so a $ref token with no own $type and a $value-suffixed target
    // resolved its VALUE correctly but silently ended up untyped.
    const resolved = resolveDocument({
      base: { $type: 'number', $value: 1 },
      copy: { $ref: '#/base/$value' },
    });
    expect(resolved['copy']).toMatchObject({ $type: 'number', $value: 1 });
  });

  test('infers $type from a $root target reached via a $value-suffixed $ref, with no own $type', () => {
    const resolved = resolveDocument({
      group: { $type: 'number', $root: { $value: 1 } },
      copy: { $ref: '#/group/$root/$value' },
    });
    expect(resolved['copy']).toMatchObject({ $type: 'number', $value: 1 });
  });

  test('resolves a property-level $ref pointing into a composite token', () => {
    const resolved = resolveDocument({
      dimension: { $type: 'dimension', hairline: { $value: { value: 1, unit: 'px' } } },
      copy: { $type: 'dimension', $ref: '#/dimension/hairline/$value' },
    });
    expect(resolved['copy']?.$value).toEqual({ value: 1, unit: 'px' });
  });

  test('rejects a direct self-referencing $ref alias', () => {
    expect(() => resolveDocument({ loop: { $type: 'number', $ref: '#/loop' } })).toThrow(
      TokenValidationError,
    );
  });

  test('rejects a circular $ref chain before generation', () => {
    expect(() =>
      resolveDocument({
        first: { $type: 'number', $ref: '#/second' },
        second: { $type: 'number', $ref: '#/third' },
        third: { $type: 'number', $ref: '#/first' },
      }),
    ).toThrow(TokenValidationError);
  });

  test('raises a named error for an unresolvable $ref rather than dropping the token', () => {
    expect(() => resolveDocument({ copy: { $type: 'number', $ref: '#/does-not-exist' } })).toThrow(
      /copy.*unresolvable \$ref/s,
    );
  });

  test('does not silently drop a $ref token from the resolved output', () => {
    // Before CIN-463, `collectTokens`'s `isToken` recognised only `$value`,
    // so a `$ref`-only node was walked as an (empty) group and never appeared
    // in `resolveDocuments`'s output at all -- no error, just a vanished key.
    const resolved = resolveDocument({
      base: { $type: 'number', $value: 1 },
      copy: { $ref: '#/base' },
    });
    expect(Object.keys(resolved)).toContain('copy');
  });

  test('resolves a $ref alias that targets a group root token', () => {
    // Regression: `resolveReference`'s `$root` branch returned the entire
    // resolved `DesignToken` object (`{ $value, $type, ... }`) rather than
    // extracting `$value`, so a whole-token $ref to a `$root` token produced
    // a nested-object $value instead of the referenced value.
    const resolved = resolveDocument({
      group: { $type: 'number', $root: { $value: 1 } },
      copy: { $ref: '#/group/$root' },
    });
    expect(resolved['copy']?.$value).toBe(1);
    expect(resolved['copy']?.$type).toBe('number');
  });

  test('resolves a $ref alias that targets a document root token', () => {
    const resolved = resolveDocument({
      $type: 'number',
      $root: { $value: 1 },
      copy: { $ref: '#/$root' },
    });
    expect(resolved['copy']?.$value).toBe(1);
    expect(resolved['copy']?.$type).toBe('number');
  });

  test('resolves a bare JSON Pointer to a group root token (no trailing $value)', () => {
    // The embedded-alias equivalent of the two $ref cases above: a $value
    // string alias to a bare `#/group/$root`/`#/$root` pointer must extract
    // $value too, not the whole DesignToken object.
    const resolved = resolveDocument({
      group: { $type: 'number', $root: { $value: 1 } },
      copy: { $type: 'number', $value: '#/group/$root' },
    });
    expect(resolved['copy']?.$value).toBe(1);
  });

  test('rejects a resolved token carrying both $value and $ref', () => {
    // Validation (assertValidTokenDocument) is what normally enforces this;
    // this is the resolve-time backstop for a caller that reaches
    // resolveDocuments directly, so $ref is never silently preferred over an
    // untouched $value with no diagnostic.
    expect(() =>
      resolveDocument({
        base: { $type: 'number', $value: 1 },
        copy: { $type: 'number', $value: 2, $ref: '#/base' },
      }),
    ).toThrow(/mutually exclusive/);
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

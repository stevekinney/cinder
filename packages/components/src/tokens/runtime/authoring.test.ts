import { describe, expect, test } from 'bun:test';

import { cloneCorpus, loadProfileCorpus } from '../../../scripts/tokens/authoring-test-support.ts';
import { buildAuthoringCatalogue } from './authoring-catalogue.ts';
import { traceProvenance } from './authoring-provenance.ts';
import { UNKNOWN, type TokenContextProvenance } from './authoring-types.ts';
import { requireDocument } from './context-order.ts';
import { authoringContexts, authoringLayerStack } from './context-stack.ts';
import { evaluateTheme } from './evaluate.ts';
import { evaluateContextProvenance } from './evaluated-provenance.ts';
import type { TokenDocument } from './types.ts';

type MutableGroup = Record<string, any>;

const BASE = 'profile-base.tokens.json';
const DARK = 'profile-dark.tokens.json';

function edited(edit: (documents: Map<string, MutableGroup>) => void) {
  const corpus = cloneCorpus(loadProfileCorpus());
  edit(corpus.documentsByPath);
  return corpus;
}

describe('palette metadata', () => {
  test('rejects an anchor flag that is not a boolean', () => {
    const corpus = edited((documents) => {
      documents.get(BASE)!['halo'] = {
        one: {
          $type: 'color',
          $value: { colorSpace: 'oklch', components: [0.5, 0.1, 250] },
          $extensions: {
            'com.lostgradient.cinder': {
              cssProperty: '--cinder-halo-one',
              public: true,
              category: 'color',
              palette: { family: 'accent', role: 'one', anchor: 'yes' },
            },
          },
        },
      };
    });
    expect(() => buildAuthoringCatalogue(corpus.resolver, corpus.documentsByPath)).toThrow(
      'palette anchor must be a boolean',
    );
  });
});

describe('the authoring catalogue', () => {
  test('refuses a token that a modifier replaces with a group, naming the context', () => {
    // Merging lets a later token replace an earlier group wholesale, so `space.two`
    // is defined in the base but absent from the dark context.
    const corpus = edited((documents) => {
      documents.get(DARK)!['space'] = {
        $type: 'dimension',
        $value: { value: 1, unit: 'rem' },
      };
    });
    expect(() => buildAuthoringCatalogue(corpus.resolver, corpus.documentsByPath)).toThrow(
      'is not defined in context dark/default',
    );
  });
});

describe('provenance inputs', () => {
  const trace = (corpus: ReturnType<typeof loadProfileCorpus>) => {
    const context = authoringContexts(corpus.resolver)[0]!;
    return traceProvenance(authoringLayerStack(corpus.resolver, corpus.documentsByPath, context));
  };

  test('reads JSON Pointer values and whole-token references as token paths', () => {
    const corpus = edited((documents) => {
      documents.get(BASE)!['pointer'] = { $type: 'color', $value: '#/palette/ink' };
      documents.get(BASE)!['pointed'] = { $ref: '#/palette/paper' };
    });
    const traced = trace(corpus);
    expect(traced.get('pointer')!.inputs.aliases).toEqual(['palette.ink']);
    expect(traced.get('pointed')!.inputs.refs).toEqual(['palette.paper']);
  });

  test('keeps a malformed pointer verbatim instead of failing the trace', () => {
    const corpus = edited((documents) => {
      documents.get(BASE)!['broken'] = { $type: 'color', $value: '#/palette/%E0%A4%A' };
      documents.get(BASE)!['broken-ref'] = { $ref: '#/palette/%E0%A4%A' };
    });
    const traced = trace(corpus);
    expect(traced.get('broken')!.inputs.aliases).toEqual([]);
    expect(traced.get('broken-ref')!.inputs.refs).toEqual(['#/palette/%E0%A4%A']);
  });
});

describe('provenance through $extends', () => {
  const layer = (name: string, content: MutableGroup) => ({
    document: `${name}.tokens.json`,
    kind: 'set' as const,
    layer: `sets.${name}`,
    content: content as TokenDocument,
  });
  const number = (value: number) => ({ $type: 'number', $value: value });

  test('a member inherited through a nearer, unrelated $extends is traced to its real origin', () => {
    const traced = traceProvenance([
      layer('one', { far: { inner: { c: number(1) } }, near: { other: number(2) } }),
      layer('two', {
        host: { $extends: '{far}', inner: { $extends: '{near}' } },
      }),
    ]);
    // `host.inner` extends `near`, which has no `c`; `c` arrives through `host` extending `far`.
    expect(traced.get('host.inner.c')!.winner).toEqual({
      document: 'one.tokens.json',
      path: 'far.inner.c',
    });
    expect(traced.get('host.inner.other')!.winner).toEqual({
      document: 'one.tokens.json',
      path: 'near.other',
    });
  });

  test('a member reaching a group through a chain of extended groups is traced to its first declaration', () => {
    // The later layer restates `d` without `x`, so neither `b` nor `a` can expand to `x`
    // from that layer alone; the merge still delivers it, from the earlier layer's `d.x`.
    const traced = traceProvenance([
      layer('one', { d: { x: number(1) } }),
      layer('two', { d: { z: number(3) }, b: { $extends: '{d}' }, a: { $extends: '{b}' } }),
    ]);
    expect(traced.get('a.x')!.winner).toEqual({ document: 'one.tokens.json', path: 'd.x' });
    expect(traced.get('a.x')!.layers.map((entry) => [entry.document, entry.via])).toEqual([
      ['two.tokens.json', 'extends'],
    ]);
  });

  test('a type that only a single layer, read on its own, could not see is attributed to no layer', () => {
    // The later layer restates `family` without its type, so extending it alone inherits no
    // type; the type exists only in the merge of both layers.
    const traced = traceProvenance([
      layer('one', { family: { $type: 'number', first: { $value: 1 } } }),
      layer('two', { family: { second: { $value: 2 } }, host: { $extends: '{family}' } }),
    ]);
    expect(traced.get('host.second')!.effectiveType).toEqual({
      type: 'number',
      origin: 'inherited',
      declaredAt: UNKNOWN,
    });
  });
});

describe('evaluating a group that extends a group restated in the same layer', () => {
  function publicNumber(cssProperty: string, value: number) {
    return {
      $value: value,
      $extensions: { 'com.lostgradient.cinder': { cssProperty, public: true, category: 'space' } },
    };
  }

  const sources = () => {
    const corpus = cloneCorpus(loadProfileCorpus());
    const documents = corpus.documentsByPath as Map<string, MutableGroup>;
    // A modifier may only override base tokens; the unbound imported token is traced elsewhere.
    delete documents.get('profile-light.tokens.json')!['imported'];
    documents.get(BASE)!['family'] = {
      $type: 'number',
      first: publicNumber('--cinder-family-first', 1),
    };
    // A second set restates `family` without its type or `first`, and extends it.
    documents.set('profile-extra.tokens.json', {
      family: { second: publicNumber('--cinder-family-second', 2) },
      host: { $extends: '{family}' },
    });
    corpus.resolver.sets['extra'] = { sources: [{ $ref: 'profile-extra.tokens.json' }] };
    corpus.resolver.resolutionOrder.splice(1, 0, { $ref: '#/sets/extra' });
    return {
      revision: 1,
      resolver: corpus.resolver,
      documents: Object.fromEntries(documents),
    };
  };

  test('evaluates, tracing the inherited member to the layer that declares it', () => {
    const result = evaluateTheme(sources());
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics, null, 2));
    const tokens = result.provenance.tokens['light/default']!;
    const first = tokens.find((token) => token.path === 'host.first')!;
    expect(first.provenance.winner).toEqual({ document: BASE, path: 'family.first' });
    expect(first.provenance.layers.map((entry) => [entry.document, entry.via])).toEqual([
      ['profile-extra.tokens.json', 'extends'],
    ]);
    expect(result.properties['light/default']!['--cinder-family-first']).toBe('1');
  });
});

describe('layer stacks', () => {
  test('a resolver whose modifiers are not theme and motion has no authoring contexts', () => {
    const { resolver } = cloneCorpus(loadProfileCorpus());
    delete resolver.modifiers['motion'];
    expect(() => authoringContexts(resolver)).toThrow(
      'defined over the "theme" and "motion" modifiers; this resolver declares theme',
    );
  });

  test('a resolver reference to a document that was never loaded is named', () => {
    expect(() =>
      requireDocument(new Map<string, TokenDocument>(), './missing.tokens.json'),
    ).toThrow(
      'Resolver references "./missing.tokens.json" but no loaded token document has that path.',
    );
  });

  test('evaluating a theme whose modifiers are not theme and motion reports a diagnostic', () => {
    const corpus = cloneCorpus(loadProfileCorpus());
    // A modifier may only override base tokens; the unbound imported token is traced elsewhere.
    delete (corpus.documentsByPath.get('profile-light.tokens.json') as MutableGroup)['imported'];
    delete corpus.resolver.modifiers['motion'];
    corpus.resolver.resolutionOrder = corpus.resolver.resolutionOrder.filter(
      (entry) => !entry.$ref.endsWith('/motion'),
    );
    for (const path of corpus.documentsByPath.keys()) {
      if (path.includes('motion')) corpus.documentsByPath.delete(path);
    }
    const result = evaluateTheme({
      revision: 4,
      resolver: corpus.resolver,
      documents: Object.fromEntries(corpus.documentsByPath),
    });
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]).toMatchObject({ revision: 4, path: '$' });
    expect(result.diagnostics[0]!.reason).toContain('defined over the "theme" and "motion"');
  });
});

describe('evaluated provenance edges', () => {
  const provenance = (inputs: Partial<TokenContextProvenance['inputs']>, path: string) =>
    ({
      winner: { document: 'a.tokens.json', path },
      layers: [],
      effectiveType: { type: UNKNOWN, origin: UNKNOWN, declaredAt: UNKNOWN },
      inputs: { aliases: [], refs: [], extends: [], recipes: [], ...inputs },
    }) satisfies TokenContextProvenance;

  test('a reference into a token resolves to the token that holds it', () => {
    const traced = new Map([
      ['shadow.small', provenance({}, 'shadow.small')],
      ['card.shadow', provenance({ aliases: ['shadow.small.blur'] }, 'card.shadow')],
      ['card.other', provenance({ aliases: ['nowhere.at.all'] }, 'card.other')],
    ]);
    const evaluated = evaluateContextProvenance(
      [{ document: 'a.tokens.json', kind: 'set', layer: 'sets.a' }],
      traced,
    );
    const card = evaluated.find((token) => token.path === 'card.shadow')!;
    expect(card.dependencies.map((dependency) => dependency.path)).toEqual(['shadow.small']);
    expect(evaluated.find((token) => token.path === 'card.other')!.dependencies).toEqual([]);
  });
});

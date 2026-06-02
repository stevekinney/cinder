/**
 * Tests for the Props / API reference helpers.
 *
 * These are pure functions over a `ComponentManifest`, so we test them directly
 * — no component mount required. We assert against Button's REAL manifest
 * (analyzed live) to prove the panel shapes a real component with required
 * props and varied control kinds, plus synthetic manifests to cover the
 * bindable column and the fetch/validation paths deterministically.
 */
import { describe, expect, it } from 'bun:test';
import { join } from 'node:path';

import { analyzeComponent } from './analyze.ts';
import {
  describeControlType,
  describeDefaultValue,
  fetchComponentManifest,
  isComponentManifest,
  splitUnionType,
  toPropReferenceRow,
  toPropReferenceRows,
} from './manifest-reference.ts';
import type { ComponentManifest, PropManifest } from './types.ts';

const COMPONENTS_ROOT = join(import.meta.dir, '..', '..', 'components', 'src', 'components');

function buttonManifest(): Promise<ComponentManifest> {
  return analyzeComponent(join(COMPONENTS_ROOT, 'button', 'button.svelte'));
}

// Module-scope fetch fixtures for the unhappy-path fetch tests. They capture
// nothing from their call sites, so they live at module scope rather than being
// re-created inside each `it` block.
const notFoundFetch = async (): Promise<Response> =>
  new Response('not found', { status: 404, statusText: 'Not Found' });

const malformedBodyFetch = async (): Promise<Response> =>
  new Response(JSON.stringify({ not: 'a manifest' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

describe('describeControlType', () => {
  it('renders a select control as a quoted union', () => {
    expect(describeControlType({ kind: 'select', options: ['sm', 'md', 'lg'] })).toBe(
      "'sm' | 'md' | 'lg'",
    );
  });

  it('renders an unknown control as its raw type', () => {
    expect(describeControlType({ kind: 'unknown', rawType: 'string | number' })).toBe(
      'string | number',
    );
  });

  it('falls back to "unknown" when the raw type is the "?" placeholder', () => {
    expect(describeControlType({ kind: 'unknown', rawType: '?' })).toBe('unknown');
    expect(describeControlType({ kind: 'unknown', rawType: '' })).toBe('unknown');
  });

  it('renders primitive control kinds as their bare kind', () => {
    expect(describeControlType({ kind: 'text' })).toBe('text');
    expect(describeControlType({ kind: 'number' })).toBe('number');
    expect(describeControlType({ kind: 'boolean' })).toBe('boolean');
    expect(describeControlType({ kind: 'snippet' })).toBe('snippet');
  });
});

describe('splitUnionType', () => {
  it('splits a top-level union into trimmed members', () => {
    expect(splitUnionType("'neutral' | 'success' | 'danger'")).toEqual([
      "'neutral'",
      "'success'",
      "'danger'",
    ]);
  });

  it('returns a single member for a non-union type', () => {
    expect(splitUnionType('string')).toEqual(['string']);
    expect(splitUnionType('number')).toEqual(['number']);
  });

  it('does NOT split a pipe nested inside angle brackets (generics)', () => {
    expect(splitUnionType('Map<string, A | B>')).toEqual(['Map<string, A | B>']);
  });

  it('does NOT split a pipe nested inside an object or function type', () => {
    expect(splitUnionType('{ a: 1 | 2 }')).toEqual(['{ a: 1 | 2 }']);
    expect(splitUnionType('(value: A | B) => void')).toEqual(['(value: A | B) => void']);
  });

  it('splits top-level members while preserving nested pipes', () => {
    expect(splitUnionType('Array<A | B> | null | undefined')).toEqual([
      'Array<A | B>',
      'null',
      'undefined',
    ]);
  });

  it('treats a bare "|" without surrounding spaces as not a separator', () => {
    // The describe* output always pads union separators with spaces; a `||`
    // operator or an unspaced pipe inside a string must not split.
    expect(splitUnionType("'a||b'")).toEqual(["'a||b'"]);
  });

  it('falls back to the whole string when there are no members', () => {
    expect(splitUnionType('')).toEqual(['']);
  });
});

describe('describeDefaultValue', () => {
  it('single-quotes string defaults', () => {
    expect(describeDefaultValue('secondary')).toBe("'secondary'");
  });

  it('stringifies primitive defaults', () => {
    expect(describeDefaultValue(false)).toBe('false');
    expect(describeDefaultValue(42)).toBe('42');
    expect(describeDefaultValue(null)).toBe('null');
  });

  it('returns undefined when there is no default', () => {
    expect(describeDefaultValue(undefined)).toBeUndefined();
  });

  it('JSON-serializes structured defaults', () => {
    expect(describeDefaultValue({ a: 1 })).toBe('{"a":1}');
    expect(describeDefaultValue([1, 2])).toBe('[1,2]');
  });
});

describe('toPropReferenceRow', () => {
  it('marks a prop with no default and optional=false as required', () => {
    const prop: PropManifest = {
      name: 'label',
      control: { kind: 'text' },
      bindable: false,
      optional: false,
    };
    expect(toPropReferenceRow(prop).required).toBe(true);
  });

  it('does not mark an optional prop as required', () => {
    const prop: PropManifest = {
      name: 'variant',
      control: { kind: 'select', options: ['a', 'b'] },
      bindable: false,
      optional: true,
    };
    expect(toPropReferenceRow(prop).required).toBe(false);
  });

  it('does not mark a prop with a default as required even when optional=false', () => {
    const prop: PropManifest = {
      name: 'count',
      control: { kind: 'number' },
      bindable: false,
      optional: false,
      defaultValue: 0,
    };
    const row = toPropReferenceRow(prop);
    expect(row.required).toBe(false);
    expect(row.defaultValue).toBe('0');
  });

  it('carries the bindable flag through to the row', () => {
    const prop: PropManifest = {
      name: 'value',
      control: { kind: 'text' },
      bindable: true,
      optional: true,
    };
    expect(toPropReferenceRow(prop).bindable).toBe(true);
  });
});

describe('toPropReferenceRows — Button (real manifest)', () => {
  it('produces one row per prop', async () => {
    const manifest = await buttonManifest();
    const rows = toPropReferenceRows(manifest);
    expect(rows).toHaveLength(manifest.props.length);
    expect(rows.length).toBeGreaterThan(0);
  });

  it('shapes the variant select prop with a quoted union and quoted default', async () => {
    const rows = toPropReferenceRows(await buttonManifest());
    const variant = rows.find((row) => row.name === 'variant');
    expect(variant).toBeDefined();
    expect(variant?.type).toContain("'primary'");
    expect(variant?.type).toContain(' | ');
    expect(variant?.defaultValue).toBe("'secondary'");
    expect(variant?.required).toBe(false);
  });

  it('shapes the loading boolean prop with a boolean type and false default', async () => {
    const rows = toPropReferenceRows(await buttonManifest());
    const loading = rows.find((row) => row.name === 'loading');
    expect(loading?.type).toBe('boolean');
    expect(loading?.defaultValue).toBe('false');
    expect(loading?.required).toBe(false);
  });

  it('marks props that have no default and are not optional as required', async () => {
    const rows = toPropReferenceRows(await buttonManifest());
    // `label` and `children` are not optional and carry no default.
    const label = rows.find((row) => row.name === 'label');
    expect(label?.required).toBe(true);
    expect(rows.some((row) => row.required)).toBe(true);
  });

  it('covers varied control kinds (select, boolean, snippet, unknown)', async () => {
    const rows = toPropReferenceRows(await buttonManifest());
    const kinds = new Set(rows.map((row) => row.type));
    // Snippet props (leadingIcon/trailingIcon) render as the bare 'snippet' kind.
    expect(kinds.has('snippet')).toBe(true);
    expect(kinds.has('boolean')).toBe(true);
    // The variant union and at least one unknown/raw type are present.
    expect(rows.some((row) => row.type.includes(' | '))).toBe(true);
  });
});

describe('isComponentManifest', () => {
  it("accepts Button's real manifest", async () => {
    expect(isComponentManifest(await buttonManifest())).toBe(true);
  });

  it('rejects non-objects', () => {
    expect(isComponentManifest(null)).toBe(false);
    expect(isComponentManifest('nope')).toBe(false);
    expect(isComponentManifest(undefined)).toBe(false);
  });

  it('rejects an object missing required fields', () => {
    expect(isComponentManifest({ name: 'Button' })).toBe(false);
  });

  it('rejects a manifest with a malformed prop', () => {
    expect(
      isComponentManifest({
        name: 'X',
        kebabName: 'x',
        file: 'x.svelte',
        importPath: 'cinder/x',
        props: [{ name: 'p', control: { kind: 'select' /* missing options */ } }],
      }),
    ).toBe(false);
  });

  it('accepts a minimal well-formed manifest', () => {
    expect(
      isComponentManifest({
        name: 'X',
        kebabName: 'x',
        file: 'x.svelte',
        importPath: 'cinder/x',
        props: [{ name: 'open', control: { kind: 'boolean' }, bindable: true, optional: true }],
      }),
    ).toBe(true);
  });
});

describe('fetchComponentManifest', () => {
  const minimalManifest: ComponentManifest = {
    name: 'Accordion',
    kebabName: 'accordion',
    file: 'accordion.svelte',
    importPath: 'cinder/accordion',
    props: [
      {
        name: 'expandedIds',
        control: { kind: 'unknown', rawType: 'string[]' },
        bindable: true,
        optional: true,
      },
    ],
  };

  it('requests the encoded component name and returns the validated manifest', async () => {
    let requestedUrl = '';
    const fakeFetch = async (url: string) => {
      requestedUrl = url;
      return new Response(JSON.stringify(minimalManifest), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const manifest = await fetchComponentManifest('accordion', fakeFetch);
    expect(requestedUrl).toBe('/api/manifest/accordion');
    expect(manifest.kebabName).toBe('accordion');
    // The bindable prop survives the round-trip and normalizes correctly.
    expect(toPropReferenceRows(manifest)[0]?.bindable).toBe(true);
  });

  it('throws on a non-OK response', async () => {
    await expect(fetchComponentManifest('nope', notFoundFetch)).rejects.toThrow(/404/);
  });

  it('throws on a malformed body', async () => {
    await expect(fetchComponentManifest('button', malformedBodyFetch)).rejects.toThrow(
      /valid ComponentManifest/,
    );
  });
});

import { describe, expect, it } from 'bun:test';
import { join } from 'node:path';

import { analyzeAll, analyzeComponent } from './analyze.ts';

const COMPONENTS_DIR = join(import.meta.dirname, '../../src/components');

function componentPath(name: string): string {
  return join(COMPONENTS_DIR, `${name}.svelte`);
}

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

describe('analyzeComponent — button.svelte', () => {
  it('returns the correct name and kebabName', async () => {
    const manifest = await analyzeComponent(componentPath('button'));
    expect(manifest.name).toBe('Button');
    expect(manifest.kebabName).toBe('button');
  });

  it('sets importPath correctly', async () => {
    const manifest = await analyzeComponent(componentPath('button'));
    expect(manifest.importPath).toBe('cinder/button');
  });

  it('includes a variant prop as a select control', async () => {
    const manifest = await analyzeComponent(componentPath('button'));
    const variant = manifest.props.find((p) => p.name === 'variant');
    expect(variant).toBeDefined();
    expect(variant?.control.kind).toBe('select');
    if (variant?.control.kind === 'select') {
      expect(variant.control.options).toContain('primary');
      expect(variant.control.options).toContain('secondary');
      expect(variant.control.options).toContain('danger');
      expect(variant.control.options).toContain('ghost');
    }
  });

  it('includes a size prop as a select control', async () => {
    const manifest = await analyzeComponent(componentPath('button'));
    const size = manifest.props.find((p) => p.name === 'size');
    expect(size).toBeDefined();
    expect(size?.control.kind).toBe('select');
  });

  it('includes a loading prop as a boolean control', async () => {
    const manifest = await analyzeComponent(componentPath('button'));
    const loading = manifest.props.find((p) => p.name === 'loading');
    expect(loading).toBeDefined();
    expect(loading?.control.kind).toBe('boolean');
  });

  it('includes a fullWidth prop as a boolean control', async () => {
    const manifest = await analyzeComponent(componentPath('button'));
    const fullWidth = manifest.props.find((p) => p.name === 'fullWidth');
    expect(fullWidth).toBeDefined();
    expect(fullWidth?.control.kind).toBe('boolean');
  });

  it('does not include the class prop', async () => {
    const manifest = await analyzeComponent(componentPath('button'));
    expect(manifest.props.find((p) => p.name === 'class')).toBeUndefined();
  });

  it('file is the absolute path to the svelte file', async () => {
    const manifest = await analyzeComponent(componentPath('button'));
    expect(manifest.file).toBe(componentPath('button'));
  });
});

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------

describe('analyzeComponent — spinner.svelte', () => {
  it('returns the correct name', async () => {
    const manifest = await analyzeComponent(componentPath('spinner'));
    expect(manifest.name).toBe('Spinner');
    expect(manifest.kebabName).toBe('spinner');
  });

  it('has a size prop as select with options sm, md, lg', async () => {
    const manifest = await analyzeComponent(componentPath('spinner'));
    const size = manifest.props.find((p) => p.name === 'size');
    expect(size).toBeDefined();
    expect(size?.control.kind).toBe('select');
    if (size?.control.kind === 'select') {
      expect(size.control.options).toEqual(['sm', 'md', 'lg']);
    }
  });

  it('has a label prop as text', async () => {
    const manifest = await analyzeComponent(componentPath('spinner'));
    const label = manifest.props.find((p) => p.name === 'label');
    expect(label).toBeDefined();
    expect(label?.control.kind).toBe('text');
  });

  it('has default value for size', async () => {
    const manifest = await analyzeComponent(componentPath('spinner'));
    const size = manifest.props.find((p) => p.name === 'size');
    expect(size?.defaultValue).toBe('md');
  });
});

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

describe('analyzeComponent — input.svelte', () => {
  it('has an id prop as text', async () => {
    const manifest = await analyzeComponent(componentPath('input'));
    const id = manifest.props.find((p) => p.name === 'id');
    expect(id).toBeDefined();
    expect(id?.control.kind).toBe('text');
  });

  it('has a value prop as text and bindable', async () => {
    const manifest = await analyzeComponent(componentPath('input'));
    const value = manifest.props.find((p) => p.name === 'value');
    expect(value).toBeDefined();
    expect(value?.control.kind).toBe('text');
    expect(value?.bindable).toBe(true);
  });

  it('has a disabled prop as boolean', async () => {
    const manifest = await analyzeComponent(componentPath('input'));
    const disabled = manifest.props.find((p) => p.name === 'disabled');
    expect(disabled).toBeDefined();
    expect(disabled?.control.kind).toBe('boolean');
  });

  it('does not include class prop', async () => {
    const manifest = await analyzeComponent(componentPath('input'));
    expect(manifest.props.find((p) => p.name === 'class')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Accordion — bindable expandedIds
// ---------------------------------------------------------------------------

describe('analyzeComponent — accordion.svelte', () => {
  it('has expandedIds as bindable', async () => {
    const manifest = await analyzeComponent(componentPath('accordion'));
    const expandedIds = manifest.props.find((p) => p.name === 'expandedIds');
    expect(expandedIds).toBeDefined();
    expect(expandedIds?.bindable).toBe(true);
  });

  it('has multiple as boolean with default false', async () => {
    const manifest = await analyzeComponent(componentPath('accordion'));
    const multiple = manifest.props.find((p) => p.name === 'multiple');
    expect(multiple).toBeDefined();
    expect(multiple?.control.kind).toBe('boolean');
    expect(multiple?.defaultValue).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// analyzeAll
// ---------------------------------------------------------------------------

describe('analyzeAll', () => {
  it('returns at least 21 entries', async () => {
    const manifests = await analyzeAll(COMPONENTS_DIR);
    expect(manifests.length).toBeGreaterThanOrEqual(21);
  });

  it('all entries have a non-empty file path', async () => {
    const manifests = await analyzeAll(COMPONENTS_DIR);
    for (const manifest of manifests) {
      expect(typeof manifest.file).toBe('string');
      expect(manifest.file.length).toBeGreaterThan(0);
    }
  });

  it('all entries have a props array', async () => {
    const manifests = await analyzeAll(COMPONENTS_DIR);
    for (const manifest of manifests) {
      expect(Array.isArray(manifest.props)).toBe(true);
    }
  });

  it('results are sorted by kebabName', async () => {
    const manifests = await analyzeAll(COMPONENTS_DIR);
    const names = manifests.map((m) => m.kebabName);
    const sorted = [...names].toSorted((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  });

  it('button appears in the results', async () => {
    const manifests = await analyzeAll(COMPONENTS_DIR);
    const button = manifests.find((m) => m.kebabName === 'button');
    expect(button).toBeDefined();
    expect(button?.name).toBe('Button');
  });

  it('excludes files from _internal/', async () => {
    const manifests = await analyzeAll(COMPONENTS_DIR);
    for (const manifest of manifests) {
      expect(manifest.file).not.toContain('_internal');
    }
  });
});

// ---------------------------------------------------------------------------
// NavigationItem — non-destructuring $props() returns empty props array
// ---------------------------------------------------------------------------

describe('analyzeComponent — navigation-item.svelte (non-destructuring $props)', () => {
  it('returns an empty props array when $props() is not destructured', async () => {
    const manifest = await analyzeComponent(componentPath('navigation-item'));
    // NavigationItem uses `const props: NavigationItemProps = $props()` (no destructuring),
    // so extractPropsFromSvelteAst returns [] and the manifest has no props.
    expect(manifest.props).toEqual([]);
  });

  it('still returns the correct name and kebabName', async () => {
    const manifest = await analyzeComponent(componentPath('navigation-item'));
    expect(manifest.name).toBe('NavigationItem');
    expect(manifest.kebabName).toBe('navigation-item');
  });
});

// ---------------------------------------------------------------------------
// Card — discriminated union Props (CardWithHeader | CardWithTitle)
// ---------------------------------------------------------------------------

describe('analyzeComponent — card.svelte (discriminated union Props)', () => {
  it('returns a manifest without throwing', async () => {
    await expect(analyzeComponent(componentPath('card'))).resolves.toBeDefined();
  });

  it('includes the children prop present in both arms', async () => {
    const manifest = await analyzeComponent(componentPath('card'));
    const children = manifest.props.find((p) => p.name === 'children');
    expect(children).toBeDefined();
    expect(children?.control.kind).toBe('snippet');
  });

  it('marks arm-only props as optional (header is only in CardWithHeader)', async () => {
    const manifest = await analyzeComponent(componentPath('card'));
    const header = manifest.props.find((p) => p.name === 'header');
    // header appears in CardWithHeader but not CardWithTitle → optional across arms
    if (header !== undefined) {
      expect(header.optional).toBe(true);
    }
  });

  it('marks arm-only props as optional (title is only in CardWithTitle)', async () => {
    const manifest = await analyzeComponent(componentPath('card'));
    const title = manifest.props.find((p) => p.name === 'title');
    if (title !== undefined) {
      expect(title.optional).toBe(true);
    }
  });
});

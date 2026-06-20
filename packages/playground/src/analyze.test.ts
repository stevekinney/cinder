import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { analyzeAll, analyzeComponent, getProjectCreationCount, resetProject } from './analyze.ts';

const COMPONENTS_DIR = join(import.meta.dirname, '../../components/src/components');

function componentPath(name: string): string {
  // Migrated components live in `<name>/<name>.svelte`; legacy flat components
  // live in `<name>.svelte`. Prefer the directory shape so the analyzer's
  // component-side fallback to `<name>.types.ts` (next to the .svelte) finds
  // the types file.
  const directoryPath = join(COMPONENTS_DIR, name, `${name}.svelte`);
  if (existsSync(directoryPath)) return directoryPath;
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
    expect(manifest.importPath).toBe('@lostgradient/cinder/button');
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

  it('includes date in the type prop options', async () => {
    const manifest = await analyzeComponent(componentPath('input'));
    const type = manifest.props.find((p) => p.name === 'type');
    expect(type?.control.kind).toBe('select');
    if (type?.control.kind === 'select') {
      expect(type.control.options).toContain('date');
    }
  });

  it('does not include class prop', async () => {
    const manifest = await analyzeComponent(componentPath('input'));
    expect(manifest.props.find((p) => p.name === 'class')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Surface — imported literal-union prop type
// ---------------------------------------------------------------------------

describe('analyzeComponent — surface.svelte', () => {
  it('resolves imported literal-union aliases as select controls', async () => {
    const manifest = await analyzeComponent(componentPath('surface'));
    const tone = manifest.props.find((p) => p.name === 'tone');

    expect(tone?.control).toEqual({
      kind: 'select',
      options: ['default', 'raised', 'inset', 'transparent'],
    });
    expect(tone?.defaultValue).toBe('default');
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

  it('date-picker does not appear in the results', async () => {
    const manifests = await analyzeAll(COMPONENTS_DIR);
    expect(manifests.map((manifest) => manifest.kebabName)).not.toContain('date-picker');
  });

  it('excludes files from _internal/', async () => {
    const manifests = await analyzeAll(COMPONENTS_DIR);
    for (const manifest of manifests) {
      expect(manifest.file).not.toContain('_internal');
    }
  });
});

// ---------------------------------------------------------------------------
// Shared ts-morph Project — project sharing + resetProject()
// ---------------------------------------------------------------------------

describe('shared ts-morph project', () => {
  it('exposes a callable resetProject()', () => {
    expect(() => resetProject()).not.toThrow();
  });

  it('reuses a single Project across one analyzeAll run', async () => {
    resetProject();
    const before = getProjectCreationCount();
    await analyzeAll(COMPONENTS_DIR);
    const after = getProjectCreationCount();
    // ~100 concurrent analyzeComponent calls must share a single Project, so
    // exactly one new instance is created for the whole run.
    expect(after - before).toBe(1);
  });

  it('creates exactly one new Project after a reset', async () => {
    await analyzeAll(COMPONENTS_DIR);
    resetProject();
    const before = getProjectCreationCount();
    await analyzeAll(COMPONENTS_DIR);
    expect(getProjectCreationCount() - before).toBe(1);
  });

  it('produces identical manifests across two runs with a reset between them', async () => {
    const first = await analyzeAll(COMPONENTS_DIR);
    resetProject();
    const second = await analyzeAll(COMPONENTS_DIR);
    // A reset between runs must not change the output: no stale source files
    // accumulate on the shared project, so the second run reproduces the first.
    expect(second).toEqual(first);
  });

  it('produces identical manifests across two runs without a reset', async () => {
    const first = await analyzeAll(COMPONENTS_DIR);
    const second = await analyzeAll(COMPONENTS_DIR);
    // Reusing the same project across runs (synthetic files removed each call)
    // must also yield identical output.
    expect(second).toEqual(first);
  });
});

// ---------------------------------------------------------------------------
// SideNavigationItem — non-destructuring $props() returns empty props array
// ---------------------------------------------------------------------------

describe('analyzeComponent — side-navigation-item.svelte (non-destructuring $props)', () => {
  it('returns an empty props array when $props() is not destructured', async () => {
    const manifest = await analyzeComponent(componentPath('side-navigation-item'));
    // SideNavigationItem uses `const props: SideNavigationItemProps = $props()` (no
    // destructuring), so extractPropsFromSvelteAst returns [] and the manifest has no props.
    // (NavigationItem previously covered this path but now destructures $props() to forward
    // native attributes via `...rest`, so the non-destructure case moved to this component.)
    expect(manifest.props).toEqual([]);
  });

  it('still returns the correct name and kebabName', async () => {
    const manifest = await analyzeComponent(componentPath('side-navigation-item'));
    expect(manifest.name).toBe('SideNavigationItem');
    expect(manifest.kebabName).toBe('side-navigation-item');
  });
});

// ---------------------------------------------------------------------------
// Card — discriminated union Props (CardPlain | CardWithHeader | CardWithTitle)
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

  it('exposes layout controls for variant, tones, and mobile edge-to-edge mode', async () => {
    const manifest = await analyzeComponent(componentPath('card'));
    const variant = manifest.props.find((p) => p.name === 'variant');
    const bodyTone = manifest.props.find((p) => p.name === 'bodyTone');
    const footerTone = manifest.props.find((p) => p.name === 'footerTone');
    const edgeToEdgeOnMobile = manifest.props.find((p) => p.name === 'edgeToEdgeOnMobile');

    expect(variant?.control).toEqual({ kind: 'select', options: ['card', 'well'] });
    expect(variant?.defaultValue).toBe('card');
    expect(bodyTone?.control).toEqual({ kind: 'select', options: ['default', 'muted'] });
    expect(footerTone?.control).toEqual({ kind: 'select', options: ['default', 'muted'] });
    expect(edgeToEdgeOnMobile?.control.kind).toBe('boolean');
    expect(edgeToEdgeOnMobile?.defaultValue).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Bare `<script module>` regression
//
// The module-script extractor's opening-tag pattern previously required at
// least one attribute before `module` (`[^>]+`), so a bare `<script module>`
// — valid Svelte 5 — silently failed to match. Type info was then lost and
// every prop collapsed to `{ kind: 'unknown' }`. These fixtures exercise the
// bare form via a real temp file so the extractor runs end to end.
// ---------------------------------------------------------------------------

describe('analyzeComponent — bare <script module> block', () => {
  let fixtureDir: string;

  beforeAll(() => {
    fixtureDir = mkdtempSync(join(tmpdir(), 'cinder-analyze-'));
  });

  afterAll(() => {
    rmSync(fixtureDir, { recursive: true, force: true });
  });

  /** Writes a `.svelte` fixture to the temp dir and returns its absolute path. */
  async function writeFixture(kebabName: string, source: string): Promise<string> {
    const filePath = join(fixtureDir, `${kebabName}.svelte`);
    await Bun.write(filePath, source);
    return filePath;
  }

  it('reads the Props type from a bare <script module> (no leading attribute)', async () => {
    const source = `<script module>
  export type WidgetProps = {
    /** The visual variant. */
    variant?: 'primary' | 'secondary';
    disabled?: boolean;
    count?: number;
    label?: string;
  };
</script>

<script lang="ts">
  let {
    variant = 'primary',
    disabled = false,
    count = 0,
    label = 'Widget',
  }: WidgetProps = $props();
</script>

<div>{label}</div>`;

    const manifest = await analyzeComponent(await writeFixture('widget', source));

    const variant = manifest.props.find((p) => p.name === 'variant');
    const disabled = manifest.props.find((p) => p.name === 'disabled');
    const count = manifest.props.find((p) => p.name === 'count');
    const label = manifest.props.find((p) => p.name === 'label');

    // The control kinds prove the module script was found: without the fix
    // every control here would be `{ kind: 'unknown' }`.
    expect(variant?.control).toEqual({ kind: 'select', options: ['primary', 'secondary'] });
    expect(disabled?.control.kind).toBe('boolean');
    expect(count?.control.kind).toBe('number');
    expect(label?.control.kind).toBe('text');

    // Defaults still come from the instance-script destructuring.
    expect(variant?.defaultValue).toBe('primary');
    expect(disabled?.defaultValue).toBe(false);
    expect(count?.defaultValue).toBe(0);

    // JSDoc descriptions still flow through.
    expect(variant?.description).toBe('The visual variant.');
  });

  it('still reads the Props type when an attribute precedes module', async () => {
    const source = `<script lang="ts" module>
  export type GadgetProps = {
    tone?: 'info' | 'danger';
  };
</script>

<script lang="ts">
  let { tone = 'info' }: GadgetProps = $props();
</script>

<span>{tone}</span>`;

    const manifest = await analyzeComponent(await writeFixture('gadget', source));
    const tone = manifest.props.find((p) => p.name === 'tone');
    expect(tone?.control).toEqual({ kind: 'select', options: ['info', 'danger'] });
  });

  // Regression: `AST.Root.instance` is typed `Script | null`, but at runtime
  // `parse(..., { modern: true })` returns `undefined` when a component has no
  // instance `<script>` block. A strict `=== null` check missed that case and
  // threw `TypeError: undefined is not an object` on `instanceScript.content`.
  // A markup-only component is the simplest reproduction.
  it('returns an empty manifest for a markup-only component (no instance script)', async () => {
    const source = `<div class="notice">Static markup with no script block.</div>`;

    const filePath = await writeFixture('notice', source);
    const manifest = await analyzeComponent(filePath);

    expect(manifest.props).toEqual([]);
  });

  // A component with only a `<script module>` block (no instance script) also
  // leaves `ast.instance` undefined, exercising the same nullish path.
  it('returns an empty manifest for a module-only component (no instance script)', async () => {
    const source = `<script lang="ts" module>
  export type PanelProps = {
    heading?: string;
  };
</script>

<section>Module-only component, no destructured props.</section>`;

    const filePath = await writeFixture('panel', source);
    const manifest = await analyzeComponent(filePath);

    expect(manifest.props).toEqual([]);
  });

  it('treats a fixture with no sibling index.ts as non-compound', async () => {
    // A fixture written to the temp dir has no index.ts beside it, so compound
    // detection returns false without throwing.
    const filePath = await writeFixture(
      'loose',
      `<script lang="ts">
  let { label }: { label?: string } = $props();
</script>

<span>{label}</span>`,
    );
    const manifest = await analyzeComponent(filePath);
    expect(manifest.isCompound).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Compound detection (isCompound)
// ---------------------------------------------------------------------------

describe('analyzeComponent — isCompound', () => {
  // Each index.ts-shape case gets its OWN temp directory: a sibling `index.ts`
  // written next to one fixture must not leak into another fixture's detection.
  let compoundDir: string;

  beforeAll(() => {
    compoundDir = mkdtempSync(join(tmpdir(), 'cinder-compound-'));
  });

  afterAll(() => {
    rmSync(compoundDir, { recursive: true, force: true });
  });

  /** Write a `.svelte` + sibling `index.ts` into an isolated subdir; return the .svelte path. */
  async function writeComponentWithIndex(subdir: string, indexSource: string): Promise<string> {
    const dir = join(compoundDir, subdir);
    const sveltePath = join(dir, `${subdir}.svelte`);
    await Bun.write(
      sveltePath,
      `<script lang="ts">
  let { children }: { children?: unknown } = $props();
</script>`,
    );
    await Bun.write(join(dir, 'index.ts'), indexSource);
    return sveltePath;
  }

  it('flags a real compound component (Accordion) whose index.ts uses Object.assign', async () => {
    // Accordion assembles `Accordion.Item` onto the root via Object.assign.
    const manifest = await analyzeComponent(componentPath('accordion'));
    expect(manifest.isCompound).toBe(true);
  });

  it('leaves a real non-compound component (Badge) unflagged', async () => {
    // Badge renders plain-text children and has no sub-component namespace.
    const manifest = await analyzeComponent(componentPath('badge'));
    expect(manifest.isCompound).toBeUndefined();
  });

  it('flags a namespace assembled via Object.assign(Root, { … })', async () => {
    const sveltePath = await writeComponentWithIndex(
      'widget',
      `import WidgetRoot from './widget.svelte';
const Widget = Object.assign(WidgetRoot, { Item: {} });
export default Widget;`,
    );
    const manifest = await analyzeComponent(sveltePath);
    expect(manifest.isCompound).toBe(true);
  });

  it('does NOT flag a config-merge Object.assign({}, …)', async () => {
    // An object-literal first argument is a config merge, not namespace assembly —
    // the leading-identifier requirement excludes it.
    const sveltePath = await writeComponentWithIndex(
      'merger',
      `import MergerRoot from './merger.svelte';
export const defaults = Object.assign({}, { size: 'md' });
export default MergerRoot;`,
    );
    const manifest = await analyzeComponent(sveltePath);
    expect(manifest.isCompound).toBeUndefined();
  });

  it('does NOT flag an Object.assign that appears only in a comment', async () => {
    const sveltePath = await writeComponentWithIndex(
      'commented',
      `import CommentedRoot from './commented.svelte';
// historically used Object.assign(CommentedRoot, { Item }) — no longer.
export default CommentedRoot;`,
    );
    const manifest = await analyzeComponent(sveltePath);
    expect(manifest.isCompound).toBeUndefined();
  });
});

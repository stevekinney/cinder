/**
 * Tests for the greenfield component scaffolding generator.
 *
 * These exercise the pure render functions through the SAME extractors the
 * generators run in `components:check` — the strongest guarantee that a freshly
 * scaffolded component validates cleanly:
 *
 *   - The rendered `.svelte` `@cinder` block must pass `extractFromSource`
 *     (the metadata extractor) with all required tags present.
 *   - The rendered playground example must pass `extractExampleFile`
 *     (the examples extractor) as a publishable `example`.
 *   - The rendered `<Pascal>Props` stub must be the type name the schema
 *     generator resolves.
 */

import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'bun:test';

import { hasSubstantiveTest } from './component-conventions.ts';
import {
  buildContext,
  createOne,
  planFiles,
  renderExample,
  renderIndex,
  renderReadme,
  renderSvelte,
  renderTest,
  renderTypes,
  type CreationContext,
} from './create-component.ts';
import { extractExampleFile } from './generate-component-examples.ts';
import { extractFromSource } from './generate-component-metadata.ts';

describe('buildContext', () => {
  it('derives the pascal name and stable import path from a kebab id', () => {
    const context = buildContext('my-widget');
    expect(context.name).toBe('my-widget');
    expect(context.pascalName).toBe('MyWidget');
    expect(context.isExperimental).toBe(false);
    expect(context.importPath).toBe('@lostgradient/cinder/my-widget');
    // The printed scaffold location and root-barrel path use relativeDirectory;
    // for a stable component it is just the bare name.
    expect(context.relativeDirectory).toBe('my-widget');
  });

  it('handles the experimental/ prefix', () => {
    const context = buildContext('experimental/json-viewer');
    expect(context.name).toBe('json-viewer');
    expect(context.pascalName).toBe('JsonViewer');
    expect(context.isExperimental).toBe(true);
    expect(context.importPath).toBe('@lostgradient/cinder/experimental/json-viewer');
    // relativeDirectory MUST keep the experimental/ segment so the printed
    // scaffold location (src/components/experimental/<name>/) and the
    // root-barrel next-step path (./components/experimental/<name>/index.ts)
    // point at where the files were actually written — not src/components/<name>/.
    expect(context.relativeDirectory).toBe('experimental/json-viewer');
    expect(context.directory.endsWith('experimental/json-viewer')).toBe(true);
  });

  it('rejects names that are not kebab-case', () => {
    expect(() => buildContext('MyWidget')).toThrow(/kebab-case/);
    expect(() => buildContext('my_widget')).toThrow(/kebab-case/);
    expect(() => buildContext('my widget')).toThrow(/kebab-case/);
    expect(() => buildContext('-leading')).toThrow(/kebab-case/);
  });
});

describe('renderSvelte @cinder block', () => {
  it('produces a block that the metadata extractor accepts (stable component)', () => {
    const context = buildContext('my-widget');
    const source = renderSvelte(context);
    const result = extractFromSource(source, 'my-widget', '/virtual/my-widget.svelte', false);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.reason);
    expect(result.metadata.category).toBe('data-display');
    expect(result.metadata.status).toBe('beta');
    expect(result.metadata.purpose.length).toBeGreaterThan(0);
  });

  it('scaffolds an @avoidWhen with a reason but NO dangling alternative', () => {
    // The scaffold once shipped `@avoidWhen <reason> | alternative-component-id`,
    // whose placeholder id is not a real component. It passes extraction but
    // fails manifest generation's dangling-alternative cross-check the moment the
    // scaffolded component is added to the tree. The template must therefore emit
    // a reason-only entry; an author opts into an alternative deliberately.
    const source = renderSvelte(buildContext('my-widget'));
    const result = extractFromSource(source, 'my-widget', '/virtual/my-widget.svelte', false);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.reason);
    expect(result.metadata.avoidWhen).toHaveLength(1);
    const [entry] = result.metadata.avoidWhen;
    expect(entry?.reason.length).toBeGreaterThan(0);
    expect(entry?.alternative).toBeUndefined();
  });

  it('imports class-names two levels up for a stable component (src/components/<name>/)', () => {
    const source = renderSvelte(buildContext('my-widget'));
    expect(source).toContain("import { classNames } from '../../utilities/class-names.ts';");
    expect(source).not.toContain('../../../utilities/class-names.ts');
  });

  it('marks experimental components as alpha so the metadata extractor accepts them', () => {
    const context = buildContext('experimental/json-viewer');
    const source = renderSvelte(context);
    const result = extractFromSource(source, 'json-viewer', '/virtual/json-viewer.svelte', true);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.reason);
    expect(result.metadata.status).toBe('alpha');
  });

  it('imports class-names three levels up for an experimental component (src/components/experimental/<name>/)', () => {
    const source = renderSvelte(buildContext('experimental/json-viewer'));
    expect(source).toContain("import { classNames } from '../../../utilities/class-names.ts';");
  });

  it('re-exports the props type from the module block', () => {
    const source = renderSvelte(buildContext('my-widget'));
    expect(source).toContain("export type { MyWidgetProps } from './my-widget.types.ts';");
  });
});

describe('renderTypes', () => {
  it('exports the <Pascal>Props name the schema generator resolves', () => {
    const source = renderTypes(buildContext('my-widget'));
    expect(source).toContain('export type MyWidgetProps =');
  });
});

describe('renderIndex', () => {
  it('emits default, named, and props-type exports', () => {
    const source = renderIndex(buildContext('my-widget'));
    expect(source).toContain("import MyWidget from './my-widget.svelte';");
    expect(source).toContain('export default MyWidget;');
    expect(source).toContain('export { MyWidget };');
    expect(source).toContain("export type { MyWidgetProps } from './my-widget.types.ts';");
  });
});

describe('renderReadme', () => {
  it('includes every generated-region marker pair the README renderer expects', () => {
    const readme = renderReadme(buildContext('my-widget'));
    for (const region of ['props', 'variables', 'subcomponents']) {
      expect(readme).toContain(`<!-- generated:${region}:start -->`);
      expect(readme).toContain(`<!-- generated:${region}:end -->`);
    }
  });

  it('flags experimental components in the README body', () => {
    const readme = renderReadme(buildContext('experimental/json-viewer'));
    expect(readme).toContain('EXPERIMENTAL');
  });
});

describe('renderExample', () => {
  it('produces a file the examples extractor publishes', () => {
    const context = buildContext('my-widget');
    const source = renderExample(context);
    const result = extractExampleFile({
      componentId: 'my-widget',
      filePath: 'playground/src/examples/my-widget/basic.example.svelte',
      source,
      validCinderSubpaths: new Set(['my-widget']),
    });

    expect(result.kind).toBe('example');
    if (result.kind !== 'example') throw new Error(`expected example, got ${result.kind}`);
    expect(result.example.id).toBe('basic');
    expect(result.example.title).toBe('MyWidget');
    expect(result.example.description.length).toBeGreaterThan(0);
    expect(result.example.code).toContain(
      "import { MyWidget } from '@lostgradient/cinder/my-widget';",
    );
  });

  it('imports experimental components via the experimental subpath', () => {
    const context = buildContext('experimental/json-viewer');
    const source = renderExample(context);
    const result = extractExampleFile({
      componentId: 'json-viewer',
      filePath: 'playground/src/examples/json-viewer/basic.example.svelte',
      source,
      validCinderSubpaths: new Set(['experimental/json-viewer']),
    });

    expect(result.kind).toBe('example');
    if (result.kind !== 'example') throw new Error(`expected example, got ${result.kind}`);
    expect(result.example.code).toContain(
      "import { JsonViewer } from '@lostgradient/cinder/experimental/json-viewer';",
    );
  });
});

describe('renderTest', () => {
  it('produces a test the convention check #9 predicate accepts as substantive', async () => {
    const source = renderTest(buildContext('my-widget'));
    const directory = await mkdtemp(join(tmpdir(), 'create-component-test-'));
    try {
      const testFilePath = join(directory, 'my-widget.test.ts');
      await writeFile(testFilePath, source);
      const result = hasSubstantiveTest(testFilePath);
      expect(result.pass).toBe(true);
      expect(result.count).toBeGreaterThanOrEqual(1);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('imports happy-dom two levels up for a stable component (src/components/<name>/)', () => {
    const source = renderTest(buildContext('my-widget'));
    expect(source).toContain("import { setupHappyDom } from '../../test/happy-dom.ts';");
    expect(source).not.toContain('../../../test/happy-dom.ts');
  });

  it('imports happy-dom three levels up for an experimental component', () => {
    const source = renderTest(buildContext('experimental/json-viewer'));
    expect(source).toContain("import { setupHappyDom } from '../../../test/happy-dom.ts';");
  });

  it('mounts the component and asserts on the cinder-<name> wrapper', () => {
    const source = renderTest(buildContext('my-widget'));
    expect(source).toContain("const { default: MyWidget } = await import('./my-widget.svelte');");
    expect(source).toContain('.cinder-my-widget');
    // Substantive: real test() blocks with assertions, never .skip / .todo.
    expect(source).not.toContain('test.skip');
    expect(source).not.toContain('test.todo');
  });
});

describe('planFiles', () => {
  it('includes the playground example among the destinations so it is collision-checked', () => {
    const paths = planFiles(buildContext('my-widget')).map((file) => file.path);
    // The playground example lives outside the component directory; if it is not
    // in the planned set, the up-front precondition check would miss it and the
    // partial-scaffold bug returns.
    expect(paths.some((path) => path.endsWith('basic.example.svelte'))).toBe(true);
    // And every component-directory file is planned too.
    for (const suffix of [
      'my-widget.svelte',
      'my-widget.types.ts',
      'index.ts',
      'my-widget.test.ts',
      'README.md',
    ]) {
      expect(paths.some((path) => path.endsWith(suffix))).toBe(true);
    }
  });
});

describe('createOne', () => {
  /**
   * Build a CreationContext whose directory and examplesDirectory point into a
   * throwaway temp tree, so createOne can be exercised against the real
   * filesystem without touching the repository's src/ or playground/.
   */
  function temporaryContext(root: string, inputName: string): CreationContext {
    const base = buildContext(inputName);
    return {
      ...base,
      directory: join(root, 'components', base.relativeDirectory),
      examplesDirectory: join(root, 'examples', base.name),
    };
  }

  it('scaffolds every planned file when nothing collides', async () => {
    const root = await mkdtemp(join(tmpdir(), 'create-component-create-'));
    try {
      const context = temporaryContext(root, 'my-widget');
      await createOne(context);
      for (const { path } of planFiles(context)) {
        expect(existsSync(path)).toBe(true);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('aborts BEFORE writing any component file when the playground example already exists', async () => {
    const root = await mkdtemp(join(tmpdir(), 'create-component-create-'));
    try {
      const context = temporaryContext(root, 'my-widget');
      // Pre-create only the playground example — the regression scenario where
      // the old code wrote the whole component tree first and only then threw.
      await mkdir(context.examplesDirectory, { recursive: true });
      await writeFile(join(context.examplesDirectory, 'basic.example.svelte'), '<!-- existing -->');

      await expect(createOne(context)).rejects.toThrow(
        /refusing to overwrite existing file.*basic\.example\.svelte/,
      );

      // The component directory and its files must NOT exist: a clean abort with
      // no half-created scaffold to clean up by hand.
      expect(existsSync(context.directory)).toBe(false);
      expect(existsSync(join(context.directory, 'my-widget.svelte'))).toBe(false);
      // The pre-existing example is left untouched.
      const exampleContent = await readFile(
        join(context.examplesDirectory, 'basic.example.svelte'),
        'utf8',
      );
      expect(exampleContent).toBe('<!-- existing -->');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

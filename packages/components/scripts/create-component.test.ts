/**
 * Tests for the greenfield component scaffolding generator.
 *
 * These exercise the pure render functions through the SAME extractors the
 * generators run in `components:check` — the strongest guarantee that a freshly
 * scaffolded component validates cleanly:
 *
 *   - The rendered `.svelte` `@cinder` block must pass `extractFromSource`
 *     (the metadata extractor) with all required tags present.
 *   - The rendered `<Pascal>Props` stub must be the type name the schema
 *     generator resolves.
 */

import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'bun:test';

import { hasSubstantiveTest, renderComponentAuthoringChecklist } from './component-conventions.ts';
import {
  assertScaffoldPropConventions,
  buildContext,
  createOne,
  planFiles,
  renderAccessibilityReview,
  renderIndex,
  renderReadme,
  renderSvelte,
  renderTest,
  renderTypes,
  type CreationContext,
} from './create-component.ts';
import { extractFromSource } from './generate-component-metadata.ts';

const REPOSITORY_ROOT = join(import.meta.dir, '..', '..', '..');
const CHECKLIST_START = '<!-- component-authoring-checklist:start -->';
const CHECKLIST_END = '<!-- component-authoring-checklist:end -->';
const CHECKLIST_MIRRORS = [
  '.agents/skills/cinder-component-authoring/SKILL.md',
  '.claude/skills/cinder-component-authoring/SKILL.md',
  'AGENTS.md',
  'packages/components/AGENTS.md',
] as const;

function extractChecklist(source: string, path: string): string {
  const start = source.indexOf(CHECKLIST_START);
  const end = source.indexOf(CHECKLIST_END);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`${path} is missing the component authoring checklist markers`);
  }
  return source.slice(start + CHECKLIST_START.length, end).trim();
}

describe('component authoring guidance', () => {
  it('keeps every checklist mirror synchronized with the machine-readable source', async () => {
    const canonicalChecklist = renderComponentAuthoringChecklist();
    expect(canonicalChecklist).toContain('`cinder-_floating-surface`');
    expect(canonicalChecklist).toContain('design review');
    expect(canonicalChecklist).toContain('accessibility review');
    expect(canonicalChecklist).toContain('`*.a11y.md`');
    expect(canonicalChecklist).toContain('#968');
    expect(canonicalChecklist).toContain('sidebar count-gate');
    expect(canonicalChecklist).toContain('check-token-contrast.test.ts');
    expect(canonicalChecklist).toContain('structural mirror pipeline guard');

    for (const relativePath of CHECKLIST_MIRRORS) {
      const source = await readFile(join(REPOSITORY_ROOT, relativePath), 'utf8');
      expect(extractChecklist(source, relativePath)).toBe(canonicalChecklist);
    }
  });

  it('uses runnable root-workspace commands in both skill mirrors', async () => {
    for (const relativePath of CHECKLIST_MIRRORS.slice(0, 2)) {
      const source = await readFile(join(REPOSITORY_ROOT, relativePath), 'utf8');
      const generateComponents = source.indexOf(
        'bun run --filter=@lostgradient/cinder components:generate',
      );
      const generateExports = source.indexOf(
        'bun run --filter=@lostgradient/cinder exports:generate',
      );
      const checkComponents = source.indexOf(
        'bun run --filter=@lostgradient/cinder components:check',
      );
      const checkExports = source.indexOf('bun run --filter=@lostgradient/cinder exports:check');

      expect(generateComponents).toBeGreaterThan(-1);
      expect(generateExports).toBeGreaterThan(generateComponents);
      expect(checkComponents).toBeGreaterThan(generateExports);
      expect(checkExports).toBeGreaterThan(checkComponents);
    }
  });
});

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
  it('scaffolds neighbour metadata for the inventory convention', () => {
    const source = renderSvelte(buildContext('my-widget'));
    expect(source).not.toContain('@related button');
    expect(source).toContain('@rationale Nearest alternative: TODO');
  });

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

  it('uses the class-omission convention and passes the shared prop-vocabulary guard', () => {
    const context = buildContext('my-widget');
    expect(renderTypes(context)).toContain("Omit<HTMLAttributes<HTMLDivElement>, 'class'>");
    expect(() => assertScaffoldPropConventions(context)).not.toThrow();
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
    for (const region of ['props', 'authoring', 'variables', 'subcomponents']) {
      expect(readme).toContain(`<!-- generated:${region}:start -->`);
      expect(readme).toContain(`<!-- generated:${region}:end -->`);
    }
  });

  it('flags experimental components in the README body', () => {
    const readme = renderReadme(buildContext('experimental/json-viewer'));
    expect(readme).toContain('EXPERIMENTAL');
  });

  it('links to the live component-authoring checklist instead of copying it', () => {
    const readme = renderReadme(buildContext('my-widget'));
    const experimentalReadme = renderReadme(buildContext('experimental/json-viewer'));

    expect(readme).toContain(
      '[component authoring pre-flight](../../../AGENTS.md#component-authoring-pre-flight)',
    );
    expect(experimentalReadme).toContain(
      '[component authoring pre-flight](../../../../AGENTS.md#component-authoring-pre-flight)',
    );
    expect(readme).not.toContain(renderComponentAuthoringChecklist());
    expect(experimentalReadme).not.toContain(renderComponentAuthoringChecklist());
  });
});

describe('renderAccessibilityReview', () => {
  it('requires a recorded design review for every new component', () => {
    const review = renderAccessibilityReview(buildContext('my-widget'));

    expect(review).toContain('# MyWidget design and accessibility review');
    expect(review).toContain('## Design review (required)');
    expect(review).toContain('Nearest neighbours');
    expect(review).toContain('Why this component exists');
    expect(review).toContain('Review outcome');
  });

  it('records the complete accessibility review for a novel interaction model', () => {
    const review = renderAccessibilityReview(buildContext('my-widget'));

    expect(review).toContain('## Novel interaction accessibility review');
    expect(review).toContain('- Applies: _Pending');
    expect(review).toContain('Focus management');
    expect(review).toContain('Keyboard matrix');
    expect(review).toContain('Assistive-technology announcements');
    expect(review).toContain('Review outcome');
  });

  it('states plainly what the human gate catches that tooling cannot', () => {
    const review = renderAccessibilityReview(buildContext('my-widget'));

    expect(review).toContain('drab, bulbous, ugly');
    expect(review).toMatch(/interaction\s+model is wrong/);
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
  it('plans every component-directory file and no playground example', () => {
    const paths = planFiles(buildContext('my-widget')).map((file) => file.path);
    expect(paths.some((path) => path.endsWith('.example.svelte'))).toBe(false);
    for (const suffix of [
      'my-widget.svelte',
      'my-widget.types.ts',
      'index.ts',
      'my-widget.test.ts',
      'my-widget.a11y.md',
      'README.md',
    ]) {
      expect(paths.some((path) => path.endsWith(suffix))).toBe(true);
    }
  });
});

describe('createOne', () => {
  /**
   * Build a CreationContext whose directory points into a throwaway temp tree,
   * so createOne can be exercised against the real filesystem without touching
   * the repository's src/.
   */
  function temporaryContext(root: string, inputName: string): CreationContext {
    const base = buildContext(inputName);
    return {
      ...base,
      directory: join(root, 'components', base.relativeDirectory),
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

  it('aborts without writing anything when the component directory already exists', async () => {
    const root = await mkdtemp(join(tmpdir(), 'create-component-create-'));
    try {
      const context = temporaryContext(root, 'my-widget');
      await mkdir(context.directory, { recursive: true });
      await writeFile(join(context.directory, 'README.md'), '<!-- existing -->');

      await expect(createOne(context)).rejects.toThrow(/component directory already exists/);

      expect(existsSync(join(context.directory, 'my-widget.svelte'))).toBe(false);
      expect(await readFile(join(context.directory, 'README.md'), 'utf8')).toBe(
        '<!-- existing -->',
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

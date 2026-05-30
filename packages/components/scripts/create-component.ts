/**
 * Greenfield component scaffolding generator.
 *
 * Where `migrate-component.ts` moves an existing flat `.svelte` file into the
 * per-directory layout, this script creates a brand-new component skeleton
 * from scratch — the automated form of the five manual steps documented in
 * `AGENTS.md` § "Adding a new component".
 *
 * For a component name `<name>` (kebab-case, optionally `experimental/<name>`),
 * it writes:
 *
 *   1. `src/components/<name>/<name>.svelte` — instance + module script. The
 *      module script carries a VALID `@cinder` JSDoc block with every required
 *      tag (`@category`, `@status`, `@purpose`) plus optional placeholder tags,
 *      and re-exports the props type.
 *   2. `src/components/<name>/<name>.types.ts` — a `<Pascal>Props` stub that the
 *      schema generator resolves.
 *   3. `src/components/<name>/index.ts` — the barrel (default + named export,
 *      plus the props type re-export).
 *   4. `src/components/<name>/<name>.test.ts` — a substantive sibling test (two
 *      mount assertions) so the component satisfies convention check #9
 *      (`hasSubstantiveTest`) the moment it is discovered.
 *   5. `src/components/<name>/README.md` — with the `generated:*` region markers
 *      the README renderer expects.
 *   6. `packages/playground/src/examples/<name>/basic.example.svelte` — a
 *      playground example with the `<script lang="ts" module>` `title`/
 *      `description` metadata the examples generator requires.
 *
 * The placeholder values are intentionally generic — the contributor edits them
 * in place. They are chosen so that, immediately after creation, running
 * `bun run components:generate` produces drift-free artifacts and the `@cinder`
 * header validates cleanly through `generate-component-metadata.ts`.
 *
 * This script does NOT regenerate schemas, the manifest, `package.json`
 * exports, the root `src/index.ts` barrel, or `src/styles/components.css`. Run
 * the central generators (`bun run components:generate`, `bun run
 * exports:generate`) and hand-edit the barrel/CSS aggregator afterward, exactly
 * as the manual flow requires.
 *
 * Usage:
 *   bun run scripts/create-component.ts <name>
 *   bun run components:create <name>
 *
 * Examples:
 *   bun run components:create my-widget
 *   bun run components:create experimental/json-viewer
 */

import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const PACKAGE_ROOT = join(import.meta.dir, '..');
const PACKAGES_ROOT = join(PACKAGE_ROOT, '..');
const COMPONENTS_DIR = join(PACKAGE_ROOT, 'src', 'components');
const PLAYGROUND_EXAMPLES_DIR = join(PACKAGES_ROOT, 'playground', 'src', 'examples');

const EXPERIMENTAL_PREFIX = 'experimental/';

/** A kebab-case component id: lowercase letters/digits separated by single hyphens. */
const KEBAB_CASE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export interface CreationContext {
  /** Logical name from the CLI: e.g. `my-widget` or `experimental/json-viewer`. */
  inputName: string;
  /** The bare component name (basename): e.g. `my-widget`, `json-viewer`. */
  name: string;
  /** Pascal-case form: `MyWidget`, `JsonViewer`. */
  pascalName: string;
  /** True if `experimental/<name>`. */
  isExperimental: boolean;
  /** Absolute path to the new component directory. */
  directory: string;
  /**
   * Component directory relative to `src/components/`: `<name>` for stable
   * components, `experimental/<name>` for experimental ones. Used in the
   * printed scaffold location and the root-barrel next-step path so the output
   * matches where the files were actually written.
   */
  relativeDirectory: string;
  /** Absolute path to the playground examples directory for this component. */
  examplesDirectory: string;
  /** Import subpath consumers use: `cinder/<name>` or `cinder/experimental/<name>`. */
  importPath: string;
}

/** Convert a kebab-case id to PascalCase (`my-widget` → `MyWidget`). */
function pascalCase(kebab: string): string {
  return kebab
    .split('-')
    .filter(Boolean)
    .map((segment) => segment[0]!.toUpperCase() + segment.slice(1))
    .join('');
}

/** Build the creation context from the raw CLI name, validating the kebab id. */
export function buildContext(inputName: string): CreationContext {
  const isExperimental = inputName.startsWith(EXPERIMENTAL_PREFIX);
  const name = isExperimental ? inputName.slice(EXPERIMENTAL_PREFIX.length) : inputName;

  if (!KEBAB_CASE.test(name)) {
    throw new Error(
      `component name '${name}' is not kebab-case (lowercase, hyphen-separated, e.g. 'my-widget')`,
    );
  }

  const pascalName = pascalCase(name);
  const relativeDirectory = isExperimental ? `experimental/${name}` : name;
  const directory = isExperimental
    ? join(COMPONENTS_DIR, 'experimental', name)
    : join(COMPONENTS_DIR, name);
  const examplesDirectory = join(PLAYGROUND_EXAMPLES_DIR, name);
  const importPath = isExperimental ? `cinder/experimental/${name}` : `cinder/${name}`;

  return {
    inputName,
    name,
    pascalName,
    isExperimental,
    directory,
    relativeDirectory,
    examplesDirectory,
    importPath,
  };
}

/**
 * Render `<name>.svelte`. The module script carries a valid `@cinder` block with
 * placeholder values for every required tag and re-exports the props type; the
 * instance script renders a class-tagged wrapper that forwards rest props.
 */
export function renderSvelte(context: CreationContext): string {
  const { name, pascalName, isExperimental } = context;
  const status = isExperimental ? 'alpha' : 'beta';
  // Experimental components live at src/components/experimental/<name>/ — one
  // level deeper than stable components at src/components/<name>/ — so the
  // relative path back up to src/utilities/ needs an extra `../`.
  const utilitiesImport = isExperimental
    ? '../../../utilities/class-names.ts'
    : '../../utilities/class-names.ts';
  return `<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status ${status}
   * @purpose TODO: one-sentence description of what ${pascalName} renders and when to reach for it.
   * @tag ${name}
   * @useWhen TODO: describe a scenario where ${pascalName} is the right choice.
   * @avoidWhen TODO: describe a scenario where a different component fits better.
   */
  export type { ${pascalName}Props } from './${name}.types.ts';
</script>

<script lang="ts">
  import { classNames } from '${utilitiesImport}';

  import type { ${pascalName}Props } from './${name}.types.ts';

  let { class: customClassName, children, ...rest }: ${pascalName}Props = $props();
</script>

<div class={classNames('cinder-${name}', customClassName)} {...rest}>
  {@render children()}
</div>
`;
}

/** Render `<name>.types.ts` — a `<Pascal>Props` stub the schema generator resolves. */
export function renderTypes(context: CreationContext): string {
  const { name, pascalName } = context;
  return `import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

/** Props for the ${pascalName} component. */
export type ${pascalName}Props = HTMLAttributes<HTMLDivElement> & {
  /** Custom class merged with \`.cinder-${name}\`. */
  class?: string;
  /** Rendered content. */
  children: Snippet;
};
`;
}

/** Render the directory's `index.ts` barrel: default + named export + props type. */
export function renderIndex(context: CreationContext): string {
  const { name, pascalName } = context;
  return `import ${pascalName} from './${name}.svelte';

export default ${pascalName};
export type { ${pascalName}Props } from './${name}.types.ts';
export { ${pascalName} };
`;
}

/**
 * Render `README.md` with the three generated-region marker pairs the README
 * renderer rewrites in place (`props`, `variables`, `subcomponents`).
 */
export function renderReadme(context: CreationContext): string {
  const { pascalName, isExperimental, importPath } = context;
  const experimentalNote = isExperimental
    ? `> **EXPERIMENTAL** — this component's API may change between minor versions until promoted to stable.\n\n`
    : '';
  return `# ${pascalName}

${experimentalNote}TODO: one-line purpose statement for ${pascalName}.

## Usage

\`\`\`svelte
<script lang="ts">
  import ${pascalName} from '${importPath}';
</script>

<${pascalName}>Content</${pascalName}>
\`\`\`

## Props

<!-- generated:props:start -->
<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->
<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->
None.
<!-- generated:subcomponents:end -->
`;
}

/**
 * Render the playground `basic.example.svelte`. The module block exports the
 * `title`/`description` string literals the examples generator requires; the
 * instance imports the component via its public `cinder/<name>` subpath.
 */
export function renderExample(context: CreationContext): string {
  const { name, pascalName, importPath } = context;
  return `<script lang="ts" module>
  export const title = '${pascalName}';
  export const description = 'TODO: describe what this ${name} example demonstrates.';
</script>

<script lang="ts">
  import { ${pascalName} } from '${importPath}';
</script>

<${pascalName}>Content</${pascalName}>
`;
}

/**
 * Render `<name>.test.ts` — a substantive sibling test that mounts the component
 * and asserts it renders, with a second case covering the `class` passthrough.
 *
 * Convention check #9 (`src/convention.test.ts`) requires every public component
 * to ship a `<name>.test.ts` with at least one active `test()`/`it()` call (the
 * `hasSubstantiveTest` predicate), so the generated skeleton MUST include real
 * tests — a `.skip`/`.todo` placeholder would fail the check the moment the
 * component is discovered. The mount setup mirrors the existing component tests
 * (e.g. `badge.test.ts`): `setupHappyDom()` runs first, then testing-library and
 * the component are dynamic-imported so Bun's svelte plugin resolves the client
 * build (a static `'svelte'` import would resolve to the server build and make
 * `mount()` throw "not available on the server").
 */
export function renderTest(context: CreationContext): string {
  const { name, pascalName, isExperimental } = context;
  // Tests sit beside the component: stable at src/components/<name>/, experimental
  // one level deeper at src/components/experimental/<name>/, so the relative path
  // back up to src/test/ needs an extra `../` for experimental components.
  const happyDomImport = isExperimental ? '../../../test/happy-dom.ts' : '../../test/happy-dom.ts';
  return `/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '${happyDomImport}';

// setupHappyDom() MUST run before any \`@testing-library/svelte\` import. testing-library
// reads \`globalThis.document\` / \`window\` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: ${pascalName} } = await import('./${name}.svelte');
// createRawSnippet must be imported dynamically so Bun's svelte plugin (which patches
// the svelte package to resolve to the client build) applies before this import resolves.
// A top-level static import of 'svelte' resolves to svelte/index-server.js in Bun's
// non-browser environment, making \`mount()\` throw "not available on the server".
const { createRawSnippet } = await import('svelte');

/** Creates a Svelte 5 Snippet that renders text content. */
function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => \`<span>\${text}</span>\`,
  }));
}

describe('${pascalName}', () => {
  test('renders the cinder-${name} wrapper with its children', () => {
    const { container } = render(${pascalName}, { children: textSnippet('content') });
    const element = container.querySelector('.cinder-${name}');
    expect(element).not.toBeNull();
    expect(element?.textContent).toContain('content');
  });

  test('merges a custom class alongside cinder-${name}', () => {
    const { container } = render(${pascalName}, {
      children: textSnippet('content'),
      class: 'my-custom-class',
    });
    const element = container.querySelector('.cinder-${name}');
    expect(element?.getAttribute('class')).toContain('cinder-${name}');
    expect(element?.getAttribute('class')).toContain('my-custom-class');
  });
});
`;
}

/** A single file to scaffold: its absolute destination path and rendered content. */
export interface PlannedFile {
  path: string;
  content: string;
}

/**
 * Resolve every file `createOne` will write — across both the component
 * directory and the playground examples directory — so that all destinations
 * can be collision-checked up front, before anything touches the disk.
 */
export function planFiles(context: CreationContext): PlannedFile[] {
  const { name, directory, examplesDirectory } = context;
  return [
    { path: join(directory, `${name}.svelte`), content: renderSvelte(context) },
    { path: join(directory, `${name}.types.ts`), content: renderTypes(context) },
    { path: join(directory, 'index.ts'), content: renderIndex(context) },
    { path: join(directory, `${name}.test.ts`), content: renderTest(context) },
    { path: join(directory, 'README.md'), content: renderReadme(context) },
    { path: join(examplesDirectory, 'basic.example.svelte'), content: renderExample(context) },
  ];
}

/**
 * Scaffold a single component's full skeleton atomically: every destination —
 * the component directory itself and all of its files plus the playground
 * example — is checked for an existing path BEFORE anything is written, so a
 * collision aborts cleanly with no half-created scaffold left on disk.
 */
export async function createOne(context: CreationContext): Promise<void> {
  const { directory, examplesDirectory } = context;

  if (existsSync(directory)) {
    throw new Error(`component directory already exists: ${directory}`);
  }

  const plannedFiles = planFiles(context);
  for (const { path } of plannedFiles) {
    if (existsSync(path)) {
      throw new Error(`refusing to overwrite existing file: ${path}`);
    }
  }

  await mkdir(directory, { recursive: true });
  await mkdir(examplesDirectory, { recursive: true });
  for (const { path, content } of plannedFiles) {
    await Bun.write(path, content);
  }
}

async function main(): Promise<void> {
  const names = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
  if (names.length !== 1) {
    process.stderr.write('Usage: create-component.ts <name>\n');
    process.stderr.write('  e.g. bun run components:create my-widget\n');
    process.exit(1);
  }

  const context = buildContext(names[0]!);
  process.stdout.write(`creating ${context.inputName}…\n`);
  try {
    await createOne(context);
  } catch (err) {
    process.stderr.write(
      `  ✗ ${context.inputName}: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(1);
  }

  process.stdout.write(`  ✓ scaffolded src/components/${context.relativeDirectory}/\n`);
  process.stdout.write('\nNext steps:\n');
  process.stdout.write('  1. Fill in the @cinder JSDoc placeholders and the props stub.\n');
  process.stdout.write(
    `  2. Flesh out ${context.name}.test.ts with behavioral coverage (a passing stub ships already).\n`,
  );
  process.stdout.write(
    `  3. Add 'export ... from ./components/${context.relativeDirectory}/index.ts' to src/index.ts.\n`,
  );
  process.stdout.write('  4. Run: bun run components:generate && bun run exports:generate\n');
  process.stdout.write('  5. Verify: bun run components:check && bun run exports:check\n');
}

if (import.meta.main) {
  await main();
}

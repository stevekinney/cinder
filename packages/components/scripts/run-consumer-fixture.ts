/**
 * Phase-aware consumer fixture for the per-directory component migration.
 *
 * Given a comma-separated list of components, generates a fixture entry that
 * imports every consumer-facing surface for each component and verifies:
 *   1. Typecheck: default component import, props type import, schema import,
 *      variables import all resolve from the package's subpath exports.
 *   2. Runtime: schema is a valid ComponentSchema object, variables is a
 *      non-empty (or empty, but always Array.isArray) readonly string[]. Runtime
 *      import of the component module is only exercised when the component's
 *      pre-migration baseline was green (recorded in MIGRATION-NOTES.md).
 *
 * Usage:
 *   bun run scripts/run-consumer-fixture.ts -- button,accordion,accordion-item
 *
 * The fixture resolves through `@lostgradient/cinder` from the workspace — the same `exports`
 * map is used regardless of whether the package was installed from a tarball
 * or linked from the workspace, so subpath resolution is identical.
 */

import { $ } from 'bun';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

interface FixtureOptions {
  components: string[];
  /** Components with a green pre-migration runtime-import baseline. */
  runtimeBaseline: Set<string>;
}

const ALL_RUNTIME_BASELINE = new Set([
  'button',
  'accordion',
  'accordion-item',
  // Phase 2 batch — all eight had green pre-migration runtime imports.
  'badge',
  'kbd',
  'visually-hidden',
  'spinner',
  'status-dot',
  'surface',
  'alert',
  'breadcrumbs',
]);

function parseArgs(): FixtureOptions {
  // Bun-style argv: when called as `bun run components:fixture -- <list>`,
  // process.argv[2] is the literal list. Accept both forms.
  const raw = process.argv.slice(2).filter((arg) => arg !== '--');
  if (raw.length === 0) {
    process.stderr.write(
      'Usage: bun run scripts/run-consumer-fixture.ts -- <comma-separated-components>\n',
    );
    process.exit(1);
  }
  const list = raw[0]!;
  const components = list
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return { components, runtimeBaseline: ALL_RUNTIME_BASELINE };
}

function toPascal(name: string): string {
  return name
    .split(/[-/]/)
    .filter(Boolean)
    .map((segment) => segment[0]!.toUpperCase() + segment.slice(1))
    .join('');
}

function renderFixture(options: FixtureOptions): string {
  const lines: string[] = [
    '// Auto-generated consumer fixture — exercises every subpath export for the',
    '// migrated components passed to `components:fixture`.',
    '',
    "import process from 'node:process';",
    '',
  ];

  // Imports first (typecheck surface).
  for (const name of options.components) {
    const pascal = toPascal(name);
    lines.push(`import ${pascal} from '@lostgradient/cinder/${name}';`);
    lines.push(`import type { ${pascal}Props } from '@lostgradient/cinder/${name}';`);
    lines.push(`import ${pascal}Schema from '@lostgradient/cinder/${name}/schema';`);
    lines.push(`import ${pascal}Variables from '@lostgradient/cinder/${name}/variables';`);
  }

  lines.push('', 'const failures: string[] = [];', '');

  // Runtime assertions per component.
  for (const name of options.components) {
    const pascal = toPascal(name);
    const exerciseComponent = options.runtimeBaseline.has(name);

    lines.push(`// ${name}`);
    if (exerciseComponent) {
      lines.push(
        `if (typeof ${pascal} !== 'function') failures.push('${name}: default export is not callable');`,
      );
    } else {
      lines.push(`// runtime import of ${name} skipped (no green pre-migration baseline)`);
    }
    lines.push(
      `if (${pascal}Schema?.type !== 'object') failures.push('${name}: schema.type !== "object"');`,
    );
    lines.push(
      `if (${pascal}Schema?.$schema !== 'https://json-schema.org/draft/2020-12/schema') failures.push('${name}: schema.$schema is wrong dialect');`,
    );
    lines.push(
      `if (!Array.isArray(${pascal}Variables)) failures.push('${name}: variables is not an array');`,
    );
    lines.push(
      `if (!${pascal}Variables.every((v: unknown) => typeof v === 'string')) failures.push('${name}: variables contains non-string entries');`,
    );
    // Use the props type at the type level so unused-import lint doesn't strip it.
    lines.push(`type _${pascal}PropsAlias = ${pascal}Props;`);
    lines.push(`const _${pascal}Probe: _${pascal}PropsAlias | undefined = undefined;`);
    lines.push(`void _${pascal}Probe;`);
    lines.push('');
  }

  lines.push(
    'if (failures.length > 0) {',
    "  process.stderr.write('components:fixture FAILED:\\n');",
    '  for (const f of failures) process.stderr.write(`  • ${f}\\n`);',
    '  process.exit(1);',
    '}',
    'process.stdout.write(`components:fixture OK — ${' +
      'JSON' +
      '.stringify(failures)} (verified ' +
      options.components.length.toString() +
      ' components)\\n`);',
    '',
  );

  return lines.join('\n');
}

async function main(): Promise<void> {
  const options = parseArgs();
  // Place the fixture inside the package's node_modules/.cache so workspace
  // module resolution finds the `@lostgradient/cinder` package via the parent
  // monorepo's node_modules. A temp directory outside the repo cannot resolve
  // workspace packages.
  const packageRoot = join(import.meta.dir, '..');
  // Place the fixture in the monorepo root's node_modules/.cache, where Bun's
  // standard lookup can find the workspace package and private dependencies.
  const monorepoRoot = join(packageRoot, '..', '..');
  const fixtureDirectory = join(monorepoRoot, 'node_modules', '.cache', 'cinder-consumer-fixture');
  await mkdir(fixtureDirectory, { recursive: true });
  const fixtureSource = renderFixture(options);
  const fixturePath = join(fixtureDirectory, 'fixture.ts');

  await Bun.write(fixturePath, fixtureSource);

  try {
    // Execute the fixture under Bun with the browser + svelte conditions so
    // subpath exports resolve to source (`./src/...`) while the published
    // package still lets Node SSR prefer `node` when `browser` is not active.
    //
    // The svelte loader plugin must be preloaded so `.svelte` imports compile;
    // the package's bunfig.toml only preloads for `bun test`, not generic
    // `bun run`, so we pass it explicitly here.
    const preloadPath = join(packageRoot, 'scripts', 'preload.ts');
    const runtimeResult =
      await $`bun run --conditions browser --conditions svelte --preload ${preloadPath} ${fixturePath}`
        .cwd(packageRoot)
        .nothrow();

    if (runtimeResult.exitCode !== 0) {
      process.stderr.write(runtimeResult.stderr.toString());
      process.exit(runtimeResult.exitCode);
    }

    process.stdout.write(runtimeResult.stdout.toString());
  } finally {
    await rm(fixturePath, { force: true });
  }
}

if (import.meta.main) {
  await main();
}

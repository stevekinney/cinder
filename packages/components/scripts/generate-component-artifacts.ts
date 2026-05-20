/**
 * For each directory-shaped component under `src/components/`, regenerate the
 * schema (`.schema.{json,ts}`), variables (`.variables.{json,ts}`), and the
 * generated regions of its `README.md`.
 *
 * Used by:
 *   - `bun run components:generate` — writes to disk.
 *   - `bun run components:check`    — compares against committed files; non-zero on drift.
 *   - The Phase 1 build pipeline (prebuild step).
 *
 * Flat legacy components (single `.svelte` files in `src/components/`) are
 * skipped entirely until they migrate.
 */

import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import prettier from 'prettier';

import { generateSchemaForComponent } from './generate-component-schema.ts';
import { generateVariablesForComponent } from './generate-component-variables.ts';
import { renderComponentReadme } from './render-component-readme.ts';

/**
 * Run prettier over the generated content using the repo's prettier config.
 * Without this, lint-staged's prettier --write pass reformats our generated
 * files on every commit, which then makes `components:check` fail with a
 * "stale" drift report on the next build cycle. Running prettier inline keeps
 * the on-disk form identical to what lint-staged would produce.
 */
async function formatGenerated(content: string, filepath: string): Promise<string> {
  try {
    const options = await prettier.resolveConfig(filepath);
    return await prettier.format(content, { ...options, filepath });
  } catch {
    return content;
  }
}

export interface DiscoveredComponent {
  /** Absolute path to the component directory. */
  directory: string;
  /** Kebab-case component name (the directory basename). */
  name: string;
  /** True for `src/components/experimental/<name>/`. */
  isExperimental: boolean;
}

const COMPONENTS_ROOT = join(import.meta.dir, '..', 'src', 'components');

export async function discoverComponentDirectories(): Promise<DiscoveredComponent[]> {
  const results: DiscoveredComponent[] = [];

  for (const entry of await readdir(COMPONENTS_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('_')) continue;

    if (entry.name === 'experimental') {
      const experimentalRoot = join(COMPONENTS_ROOT, 'experimental');
      for (const subEntry of await readdir(experimentalRoot, { withFileTypes: true })) {
        if (!subEntry.isDirectory()) continue;
        if (subEntry.name.startsWith('_')) continue;
        const directory = join(experimentalRoot, subEntry.name);
        // A migrated component has both `<name>.svelte` AND `<name>.types.ts` —
        // the types file is the schema generator's input and the marker of
        // completed migration. Legacy ad-hoc subdirectories (e.g. chat/) lack it.
        if (!existsSync(join(directory, `${subEntry.name}.svelte`))) continue;
        if (!existsSync(join(directory, `${subEntry.name}.types.ts`))) continue;
        results.push({ directory, name: subEntry.name, isExperimental: true });
      }
      continue;
    }

    if (entry.name === 'icons') continue;

    const directory = join(COMPONENTS_ROOT, entry.name);
    if (!existsSync(join(directory, `${entry.name}.svelte`))) continue;
    if (!existsSync(join(directory, `${entry.name}.types.ts`))) continue;
    results.push({ directory, name: entry.name, isExperimental: false });
  }

  return results.toSorted((a, b) => a.directory.localeCompare(b.directory));
}

export interface ComponentArtifacts {
  component: DiscoveredComponent;
  schemaJson: string;
  schemaModule: string;
  variablesJson: string;
  variablesModule: string;
  readme: string | null;
}

export async function generateArtifactsForComponent(
  component: DiscoveredComponent,
): Promise<ComponentArtifacts> {
  const { directory, name, isExperimental } = component;
  const depthToSrc = isExperimental ? 3 : 2;
  const typesFilePath = join(directory, `${name}.types.ts`);

  const schema = generateSchemaForComponent({ typesFilePath, componentName: name, depthToSrc });
  const variables = await generateVariablesForComponent({
    componentDirectory: directory,
    componentName: name,
  });

  const readmePath = join(directory, 'README.md');
  let readme: string | null = null;
  if (existsSync(readmePath)) {
    const existing = await Bun.file(readmePath).text();
    readme = renderComponentReadme({
      existingReadme: existing,
      schema: schema.schema,
      variables: variables.variables,
      // No subcomponents key — the migrator hand-authors the subcomponents
      // region (or leaves it as "None."). The orchestrator does not currently
      // have a programmatic source for which sibling .svelte files are public.
    });
  }

  const schemaJsonPath = join(directory, `${name}.schema.json`);
  const schemaModulePath = join(directory, `${name}.schema.ts`);
  const variablesJsonPath = join(directory, `${name}.variables.json`);
  const variablesModulePath = join(directory, `${name}.variables.ts`);

  return {
    component,
    schemaJson: await formatGenerated(schema.schemaJson, schemaJsonPath),
    schemaModule: await formatGenerated(schema.schemaModule, schemaModulePath),
    variablesJson: await formatGenerated(variables.variablesJson, variablesJsonPath),
    variablesModule: await formatGenerated(variables.variablesModule, variablesModulePath),
    readme: readme === null ? null : await formatGenerated(readme, readmePath),
  };
}

export async function writeArtifacts(artifacts: ComponentArtifacts): Promise<void> {
  const { component } = artifacts;
  await Bun.write(join(component.directory, `${component.name}.schema.json`), artifacts.schemaJson);
  await Bun.write(join(component.directory, `${component.name}.schema.ts`), artifacts.schemaModule);
  await Bun.write(
    join(component.directory, `${component.name}.variables.json`),
    artifacts.variablesJson,
  );
  await Bun.write(
    join(component.directory, `${component.name}.variables.ts`),
    artifacts.variablesModule,
  );
  if (artifacts.readme !== null) {
    await Bun.write(join(component.directory, 'README.md'), artifacts.readme);
  }
}

export interface DriftIssue {
  component: string;
  file: string;
  reason: 'missing' | 'stale';
}

export async function checkComponentArtifacts(): Promise<DriftIssue[]> {
  const issues: DriftIssue[] = [];
  const components = await discoverComponentDirectories();

  for (const component of components) {
    const artifacts = await generateArtifactsForComponent(component);
    const files: Array<{ filename: string; expected: string | null }> = [
      { filename: `${component.name}.schema.json`, expected: artifacts.schemaJson },
      { filename: `${component.name}.schema.ts`, expected: artifacts.schemaModule },
      { filename: `${component.name}.variables.json`, expected: artifacts.variablesJson },
      { filename: `${component.name}.variables.ts`, expected: artifacts.variablesModule },
      { filename: 'README.md', expected: artifacts.readme },
    ];

    for (const { filename, expected } of files) {
      if (expected === null) continue;
      const path = join(component.directory, filename);
      if (!existsSync(path)) {
        issues.push({ component: component.name, file: filename, reason: 'missing' });
        continue;
      }
      const actual = await Bun.file(path).text();
      if (actual !== expected) {
        issues.push({ component: component.name, file: filename, reason: 'stale' });
      }
    }
  }

  return issues;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const checkMode = args.includes('--check');

  if (checkMode) {
    const issues = await checkComponentArtifacts();
    if (issues.length === 0) {
      process.stdout.write('components:check — OK\n');
      return;
    }
    process.stderr.write(
      'components:check — drift detected. Run `bun run components:generate` to fix:\n',
    );
    for (const issue of issues) {
      process.stderr.write(`  • ${issue.component}/${issue.file} (${issue.reason})\n`);
    }
    process.exit(1);
  }

  const targetName = args.find((arg) => !arg.startsWith('-'));
  const components = await discoverComponentDirectories();
  const filtered = targetName
    ? components.filter((c) => c.name === targetName || `experimental/${c.name}` === targetName)
    : components;

  if (filtered.length === 0) {
    process.stderr.write(
      targetName
        ? `No component named "${targetName}"\n`
        : 'No directory-shaped components found\n',
    );
    process.exit(1);
  }

  for (const component of filtered) {
    const artifacts = await generateArtifactsForComponent(component);
    await writeArtifacts(artifacts);
    process.stdout.write(`generated ${component.name}\n`);
  }
}

if (import.meta.main) {
  await main();
}

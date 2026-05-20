/**
 * For each directory-shaped component under `src/components/`, regenerate the
 * schema (`.schema.{json,ts}`), variables (`.variables.{json,ts}`), and the
 * generated regions of its `README.md`.
 *
 * After per-component artifacts, this orchestrator also runs:
 *   1. Constraints generator — serializes `{name}.constraints.ts` → `.json`.
 *   2. Examples generator   — serializes playground examples → `{name}.examples.json`.
 *   3. Manifest generator   — builds `components.json` from all metadata (runs last
 *                             so it observes `hasConstraints`/`hasExamples` from above).
 *
 * Used by:
 *   - `bun run components:generate` — writes to disk.
 *   - `bun run components:check`    — compares against committed files; non-zero on drift.
 *     In check mode all stages run; an early failure does not suppress later reports.
 *   - The Phase 1 build pipeline (prebuild step).
 *
 * Flat legacy components (single `.svelte` files in `src/components/`) are
 * skipped entirely until they migrate.
 */

import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import prettier from 'prettier';

import { checkConstraintsDrift, generateAllConstraints } from './generate-component-constraints.ts';
import {
  checkExamplesDrift,
  generateAllExamples,
  writeExampleArtifacts,
} from './generate-component-examples.ts';
import { generateSchemaForComponent } from './generate-component-schema.ts';
import { generateVariablesForComponent } from './generate-component-variables.ts';
import { buildManifest, writeManifest } from './generate-manifest.ts';
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
    // Stage 1: per-component schema/variables/README drift check.
    const perComponentIssues = await checkComponentArtifacts();

    // Stage 2: constraints drift check.
    let constraintIssues: DriftIssue[] = [];
    try {
      const issues = await checkConstraintsDrift();
      constraintIssues = issues.map((issue) => ({
        component: issue.name,
        file: issue.file,
        reason: issue.reason,
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`components:check — constraints stage failed: ${message}\n`);
    }

    // Stage 3: examples drift check.
    let exampleIssues: string[] = [];
    try {
      const result = await generateAllExamples();
      exampleIssues = await checkExamplesDrift(result);
      if (result.errors.length > 0) {
        process.stderr.write(
          `components:check — ${result.errors.length} example(s) have extraction errors\n`,
        );
        for (const error of result.errors.slice(0, 5)) {
          process.stderr.write(`  [${error.componentId}] ${error.reason}\n`);
        }
        if (result.errors.length > 5) {
          process.stderr.write(`  … and ${result.errors.length - 5} more\n`);
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`components:check — examples stage failed: ${message}\n`);
    }

    // Stage 4: manifest drift check.
    // The format must match what `writeManifest()` produces — JSON.stringify
    // run through prettier — so the comparison succeeds against the
    // committed-and-formatted file.
    let manifestDrift = false;
    try {
      const manifest = await buildManifest();
      const MANIFEST_PATH = join(import.meta.dir, '..', 'components.json');
      const generated = await formatGenerated(
        JSON.stringify(manifest, null, 2) + '\n',
        MANIFEST_PATH,
      );
      if (!existsSync(MANIFEST_PATH)) {
        manifestDrift = true;
        process.stderr.write('components:check — components.json is missing\n');
      } else {
        const committed = await Bun.file(MANIFEST_PATH).text();
        if (generated !== committed) {
          manifestDrift = true;
          process.stderr.write('components:check — components.json is stale\n');
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`components:check — manifest stage failed: ${message}\n`);
      manifestDrift = true;
    }

    // Collect and report all failures.
    const allIssues: string[] = [
      ...perComponentIssues.map((issue) => `${issue.component}/${issue.file} (${issue.reason})`),
      ...constraintIssues.map(
        (issue) => `constraints: ${issue.component}/${issue.file} (${issue.reason})`,
      ),
      ...exampleIssues.map((issue) => `examples: ${issue}`),
      ...(manifestDrift ? ['manifest: components.json is missing or stale'] : []),
    ];

    if (allIssues.length === 0) {
      process.stdout.write('components:check — OK\n');
      return;
    }

    process.stderr.write(
      'components:check — drift detected. Run `bun run components:generate` to fix:\n',
    );
    for (const issue of allIssues) {
      process.stderr.write(`  • ${issue}\n`);
    }
    process.exit(1);
  }

  // Generate mode.
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

  // Stage 1: per-component schema/variables/README.
  for (const component of filtered) {
    const artifacts = await generateArtifactsForComponent(component);
    await writeArtifacts(artifacts);
    process.stdout.write(`generated ${component.name}\n`);
  }

  // Stages 2–4 run only when processing the full component set (no target filter).
  // Targeted single-component runs skip the package-level artifacts.
  if (targetName !== undefined) return;

  // Stage 2: constraints.
  const constraintsCount = await generateAllConstraints();
  if (constraintsCount > 0) {
    process.stdout.write(`generated ${constraintsCount} constraints sidecar(s)\n`);
  }

  // Stage 3: examples.
  const examplesResult = await generateAllExamples();
  await writeExampleArtifacts(examplesResult);
  process.stdout.write(
    `generated examples: ${examplesResult.exampleSets.length} component(s), ` +
      `${examplesResult.exampleSets.reduce((sum, s) => sum + s.examples.length, 0)} example(s)\n`,
  );

  // Stage 4: manifest (last — observes hasExamples/hasConstraints from the above).
  await writeManifest();
  process.stdout.write('generated components.json\n');
}

if (import.meta.main) {
  await main();
}

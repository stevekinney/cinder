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
import { join } from 'node:path';

import type { DriftIssue } from './component-artifact-operations.ts';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const checkMode = args.includes('--check');

  if (checkMode) {
    const { checkComponentArtifacts, formatGenerated } =
      await import('./component-artifact-operations.ts');
    const { checkConstraintsDrift } = await import('./generate-component-constraints.ts');
    const { checkExamplesDrift, generateAllExamples } =
      await import('./generate-component-examples.ts');
    const { buildManifest } = await import('./generate-manifest.ts');

    // Stage 1: per-component schema/variables/README drift check.
    const perComponentIssues = await checkComponentArtifacts();

    // Stage 2: constraints drift check.
    let constraintIssues: DriftIssue[] = [];
    let constraintsStageFailed = false;
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
      constraintsStageFailed = true;
    }

    // Stage 3: examples drift check.
    let exampleIssues: string[] = [];
    let exampleExtractionErrors = 0;
    let examplesStageFailed = false;
    try {
      const result = await generateAllExamples();
      exampleIssues = await checkExamplesDrift(result);
      exampleExtractionErrors = result.errors.length;
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
      examplesStageFailed = true;
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

    // Collect and report all failures. Generator stage failures and example
    // extraction errors are non-drift issues — they must still fail the check
    // even when the on-disk artifacts match.
    const allIssues: string[] = [
      ...perComponentIssues.map((issue) => `${issue.component}/${issue.file} (${issue.reason})`),
      ...constraintIssues.map(
        (issue) => `constraints: ${issue.component}/${issue.file} (${issue.reason})`,
      ),
      ...(constraintsStageFailed ? ['constraints: stage threw — see error above'] : []),
      ...exampleIssues.map((issue) => `examples: ${issue}`),
      ...(exampleExtractionErrors > 0
        ? [`examples: ${exampleExtractionErrors} example(s) have extraction errors`]
        : []),
      ...(examplesStageFailed ? ['examples: stage threw — see error above'] : []),
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
    process.exitCode = 1;
    return;
  }

  // Generate mode.
  const { discoverComponentDirectories } = await import('./discover-component-directories.ts');
  const { generateArtifactsForComponent, writeArtifacts } =
    await import('./component-artifact-operations.ts');
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
    process.exitCode = 1;
    return;
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

  const { generateAllConstraints } = await import('./generate-component-constraints.ts');
  const { generateAllExamples, writeExampleArtifacts } =
    await import('./generate-component-examples.ts');
  const { writeManifest } = await import('./generate-manifest.ts');

  // Stage 2: constraints.
  const constraintsCount = await generateAllConstraints();
  if (constraintsCount > 0) {
    process.stdout.write(`generated ${constraintsCount} constraints sidecar(s)\n`);
  }

  // Stage 3: examples.
  // Extraction errors are hard failures — never write artifacts or proceed to
  // the manifest stage when the examples set is incomplete.
  const examplesResult = await generateAllExamples();
  if (examplesResult.errors.length > 0) {
    process.stderr.write(
      `components:generate — refusing to write artifacts: ${examplesResult.errors.length} example(s) have extraction errors\n`,
    );
    for (const error of examplesResult.errors.slice(0, 10)) {
      process.stderr.write(`  [${error.componentId}] ${error.reason}\n`);
    }
    if (examplesResult.errors.length > 10) {
      process.stderr.write(`  … and ${examplesResult.errors.length - 10} more\n`);
    }
    process.exitCode = 1;
    return;
  }
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
  if (process.argv.includes('--check')) {
    await main();
  } else {
    const { withLocalValidationGateLock } = await import('./husky/utilities.ts');
    await withLocalValidationGateLock(main);
  }
}

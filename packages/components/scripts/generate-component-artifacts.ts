/** Generate or check component-local artifacts, constraints, and manifest. */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { Manifest } from './generate-manifest.ts';

type CheckStage = { issues: string[] };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function runArtifactCheck(): Promise<CheckStage> {
  try {
    const { checkComponentArtifacts } = await import('./component-artifact-operations.ts');
    const issues = await checkComponentArtifacts();
    return {
      issues: issues.map((issue) => `${issue.component}/${issue.file} (${issue.reason})`),
    };
  } catch (error) {
    process.stderr.write(`components:check — artifacts stage failed: ${errorMessage(error)}\n`);
    return { issues: ['artifacts: stage threw — see error above'] };
  }
}

async function runConstraintCheck(): Promise<CheckStage> {
  try {
    const { checkConstraintsDrift } = await import('./generate-component-constraints.ts');
    const issues = await checkConstraintsDrift();
    return {
      issues: issues.map((issue) => `constraints: ${issue.name}/${issue.file} (${issue.reason})`),
    };
  } catch (error) {
    process.stderr.write(`components:check — constraints stage failed: ${errorMessage(error)}\n`);
    return { issues: ['constraints: stage threw — see error above'] };
  }
}

async function runExampleCheck(): Promise<CheckStage> {
  try {
    const { checkCommittedExamples } = await import('./check-component-examples.ts');
    const issues = await checkCommittedExamples();
    for (const issue of issues) process.stderr.write(`components:check — examples: ${issue}\n`);
    return { issues: issues.map((issue) => `examples: ${issue}`) };
  } catch (error) {
    process.stderr.write(`components:check — examples stage failed: ${errorMessage(error)}\n`);
    return { issues: ['examples: stage threw — see error above'] };
  }
}

async function runManifestCheck(): Promise<{ stage: CheckStage; manifest?: Manifest }> {
  try {
    const { buildManifest } = await import('./generate-manifest.ts');
    const { formatGenerated } = await import('./component-artifact-operations.ts');
    const manifest = await buildManifest();
    const manifestPath = join(import.meta.dir, '..', 'components.json');
    const generated = await formatGenerated(JSON.stringify(manifest, null, 2) + '\n', manifestPath);
    const committed = existsSync(manifestPath) ? await Bun.file(manifestPath).text() : undefined;
    const drift = committed === undefined || generated !== committed;
    if (drift) {
      process.stderr.write(
        `components:check — components.json is ${committed === undefined ? 'missing' : 'stale'}\n`,
      );
    }
    return {
      stage: { issues: drift ? ['manifest: components.json is missing or stale'] : [] },
      manifest,
    };
  } catch (error) {
    process.stderr.write(`components:check — manifest stage failed: ${errorMessage(error)}\n`);
    return { stage: { issues: ['manifest: components.json is missing or stale'] } };
  }
}

async function runRootMetadataExportCheck(manifest: Manifest): Promise<CheckStage> {
  try {
    const { checkRootMetadataExports } = await import('./generate-root-metadata-exports.ts');
    return { issues: await checkRootMetadataExports(manifest) };
  } catch (error) {
    process.stderr.write(
      `components:check — root metadata export stage failed: ${errorMessage(error)}\n`,
    );
    return { issues: ['root metadata exports: stage threw — see error above'] };
  }
}

async function runCheckMode(): Promise<void> {
  const artifacts = await runArtifactCheck();
  const constraints = await runConstraintCheck();
  const examples = await runExampleCheck();
  const manifest = await runManifestCheck();
  const rootMetadata = manifest.manifest
    ? await runRootMetadataExportCheck(manifest.manifest)
    : { issues: ['root metadata exports: manifest unavailable'] };
  const issues = [
    ...artifacts.issues,
    ...constraints.issues,
    ...examples.issues,
    ...manifest.stage.issues,
    ...rootMetadata.issues,
  ];
  if (issues.length === 0) {
    process.stdout.write('components:check — OK\n');
    return;
  }
  process.stderr.write(
    'components:check — drift detected. Run `bun run components:generate` to fix:\n',
  );
  for (const issue of issues) process.stderr.write(`  • ${issue}\n`);
  process.exitCode = 1;
}

async function runGenerateMode(args: string[]): Promise<void> {
  const { discoverComponentDirectories } = await import('./discover-component-directories.ts');
  const { generateArtifactsForComponent, writeArtifacts } =
    await import('./component-artifact-operations.ts');
  const targetName = args.find((arg) => !arg.startsWith('-'));
  const components = await discoverComponentDirectories();
  const filtered = targetName
    ? components.filter(
        (component) =>
          component.name === targetName || `experimental/${component.name}` === targetName,
      )
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
  for (const component of filtered) {
    await writeArtifacts(await generateArtifactsForComponent(component));
    process.stdout.write(`generated ${component.name}\n`);
  }
  if (targetName !== undefined) return;
  const { generateAllConstraints } = await import('./generate-component-constraints.ts');
  const { writeManifest } = await import('./generate-manifest.ts');
  const constraintsCount = await generateAllConstraints();
  if (constraintsCount > 0) {
    process.stdout.write(`generated ${constraintsCount} constraints sidecar(s)\n`);
  }
  await writeManifest();
  process.stdout.write('generated components.json\n');
  const { buildManifest } = await import('./generate-manifest.ts');
  const { writeRootMetadataExports } = await import('./generate-root-metadata-exports.ts');
  await writeRootMetadataExports(await buildManifest());
  process.stdout.write('generated root metadata exports\n');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--check')) return runCheckMode();
  return runGenerateMode(args);
}

if (import.meta.main) await main();

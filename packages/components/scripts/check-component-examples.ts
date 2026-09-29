/** Validate committed component example metadata and its manifest relationship. */

import { readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';

import type { Manifest } from './generate-manifest.ts';
import { readJsonFile } from './lib/read-json-file.ts';

const PACKAGE_ROOT = join(import.meta.dir, '..');
const COMPONENTS_ROOT = join(PACKAGE_ROOT, 'src', 'components');
const MANIFEST_PATH = join(PACKAGE_ROOT, 'components.json');
const SCHEMA_PATH = join(PACKAGE_ROOT, 'src', 'schemas', 'examples.schema.json');
const PUBLIC_ROOT_IMPORT = '@lostgradient/cinder';

export type ExampleArtifact = {
  component: string;
  import: string;
  examples: Array<{ code: string }>;
};
type ExampleValidator = ValidateFunction<ExampleArtifact>;

export type ComponentLocation = {
  directory: string;
  id: string;
  isExperimental: boolean;
};

function formatSchemaErrors(errors: ErrorObject[] | null | undefined): string {
  return (errors ?? [])
    .map((error) => `${error.instancePath || '/'} ${error.message ?? 'is invalid'}`)
    .join('; ');
}

async function componentLocations(): Promise<ComponentLocation[]> {
  const locations: ComponentLocation[] = [];
  const entries = await readdir(COMPONENTS_ROOT, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('_') || entry.name === 'icons') continue;
    if (entry.name === 'experimental') {
      const experimentalRoot = join(COMPONENTS_ROOT, entry.name);
      for (const child of await readdir(experimentalRoot, { withFileTypes: true })) {
        if (!child.isDirectory() || child.name.startsWith('_')) continue;
        locations.push({
          directory: join(experimentalRoot, child.name),
          id: child.name,
          isExperimental: true,
        });
      }
      continue;
    }
    locations.push({
      directory: join(COMPONENTS_ROOT, entry.name),
      id: entry.name,
      isExperimental: false,
    });
  }

  return locations.toSorted((a, b) => a.directory.localeCompare(b.directory));
}

function artifactPath(location: ComponentLocation): string {
  const directory = location.isExperimental ? `experimental/${location.id}` : location.id;
  return `src/components/${directory}/${location.id}.examples.json`;
}

function readManifest(): Promise<Manifest> {
  return readJsonFile<Manifest>(MANIFEST_PATH);
}

async function validateArtifact(
  location: ComponentLocation,
  entryName: string,
  validator: ExampleValidator,
  manifestById: ReadonlyMap<string, Manifest['components'][number]>,
): Promise<string[]> {
  const path = join(location.directory, entryName);
  const packagePath = relative(PACKAGE_ROOT, path);
  const artifactId = entryName.slice(0, -'.examples.json'.length);
  let artifact: unknown;

  try {
    artifact = await Bun.file(path).json();
  } catch (error) {
    return [
      `${packagePath}: invalid JSON (${error instanceof Error ? error.message : String(error)})`,
    ];
  }

  return validateExampleArtifactValue(
    artifact,
    location,
    artifactId,
    packagePath,
    validator,
    manifestById.get(artifactId),
  );
}

export function validateExampleArtifactValue(
  artifact: unknown,
  location: ComponentLocation,
  artifactId: string,
  packagePath: string,
  validator: ExampleValidator,
  manifestComponent: Manifest['components'][number] | undefined,
): string[] {
  if (!validator(artifact)) {
    return [`${packagePath}: schema validation failed (${formatSchemaErrors(validator.errors)})`];
  }

  const metadataIssues = validateArtifactMetadata(artifact, location, artifactId, packagePath);
  if (manifestComponent === undefined) {
    return [...metadataIssues, `${packagePath}: no matching component in components.json`];
  }
  return [
    ...metadataIssues,
    ...validateManifestRelation(manifestComponent, location, artifactId, packagePath),
  ];
}

function validateArtifactMetadata(
  value: ExampleArtifact,
  location: ComponentLocation,
  artifactId: string,
  packagePath: string,
): string[] {
  const issues: string[] = [];
  if (artifactId !== location.id) {
    issues.push(`${packagePath}: filename does not match owning directory "${location.id}"`);
  }
  if (value.component !== location.id) {
    issues.push(
      `${packagePath}: component "${value.component}" does not match owning directory "${location.id}"`,
    );
  }
  if (value.import !== PUBLIC_ROOT_IMPORT) {
    issues.push(`${packagePath}: import must use public root "${PUBLIC_ROOT_IMPORT}"`);
  }
  if (
    value.examples.some((example) =>
      /(?:from|import)\s+['"]@lostgradient\/cinder\//.test(example.code),
    )
  ) {
    issues.push(
      `${packagePath}: example code must use the public root import "${PUBLIC_ROOT_IMPORT}"`,
    );
  }
  return issues;
}

function validateManifestRelation(
  manifestComponent: Manifest['components'][number],
  location: ComponentLocation,
  artifactId: string,
  packagePath: string,
): string[] {
  const issues: string[] = [];
  if (!manifestComponent.hasExamples) {
    issues.push(`${packagePath}: components.json does not advertise this examples artifact`);
  }
  if (manifestComponent.import !== PUBLIC_ROOT_IMPORT) {
    issues.push(
      `components.json ${artifactId}: import is not the public root "${PUBLIC_ROOT_IMPORT}"`,
    );
  }
  if (manifestComponent.artifacts.examples !== artifactPath(location)) {
    issues.push(
      `${packagePath}: manifest artifact path is "${manifestComponent.artifacts.examples ?? 'absent'}"`,
    );
  }
  return issues;
}

async function validateLocation(
  location: ComponentLocation,
  validator: ExampleValidator,
  manifestById: ReadonlyMap<string, Manifest['components'][number]>,
): Promise<{ issues: string[]; paths: string[] }> {
  const issues: string[] = [];
  const paths: string[] = [];
  for (const entry of await readdir(location.directory, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.examples.json')) continue;
    paths.push(relative(PACKAGE_ROOT, join(location.directory, entry.name)));
    issues.push(...(await validateArtifact(location, entry.name, validator, manifestById)));
  }
  return { issues, paths };
}

/** Return every committed example-sidecar issue; an empty array means valid. */
export async function checkCommittedExamples(): Promise<string[]> {
  const [locations, manifest, schema] = await Promise.all([
    componentLocations(),
    readManifest(),
    Bun.file(SCHEMA_PATH).json(),
  ]);
  const validator = new Ajv({ allErrors: true, strict: false }).compile<ExampleArtifact>(schema);
  const manifestById = new Map(manifest.components.map((component) => [component.id, component]));
  const issues: string[] = [];
  const discoveredArtifacts = new Set<string>();

  for (const location of locations) {
    const result = await validateLocation(location, validator, manifestById);
    issues.push(...result.issues);
    for (const path of result.paths) discoveredArtifacts.add(path);
  }

  for (const component of manifest.components) {
    const expected = component.artifacts.examples;
    if (component.hasExamples && expected !== undefined && !discoveredArtifacts.has(expected)) {
      issues.push(
        `components.json ${component.id}: advertised examples artifact "${expected}" is missing`,
      );
    }
  }

  return issues;
}

async function main(): Promise<void> {
  const issues = await checkCommittedExamples();
  if (issues.length > 0) {
    for (const issue of issues) process.stderr.write(`component examples: ${issue}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write('component examples: OK\n');
}

if (import.meta.main) await main();

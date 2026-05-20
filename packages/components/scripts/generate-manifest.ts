/**
 * Builds and writes `packages/components/components.json`, the machine-readable
 * index of every public cinder component.
 *
 * Usage:
 *   bun run scripts/generate-manifest.ts           # write components.json
 *   bun run scripts/generate-manifest.ts --check   # diff against committed file; non-zero on drift
 *
 * The generator fails loudly when `extractAllComponentMetadata()` returns any
 * errors — a partial manifest is never written to disk.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import Ajv from 'ajv/dist/2020.js';

import type { CategoryId, StatusLevel } from '../src/manifest.meta.ts';
import { categories, overlapFamilies, statusLevels } from '../src/manifest.meta.ts';
import type { ComponentMetadata } from './generate-component-metadata.ts';
import { extractAllComponentMetadata } from './generate-component-metadata.ts';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** A single entry in `components.json#components`. */
export type ManifestComponent = {
  /** PascalCase name for use in prose and documentation. Equals `exportName`. */
  name: string;
  /** Kebab-case canonical identifier, matching the component directory name. */
  id: string;
  /**
   * Import specifier consumers use. E.g. `"cinder/button"`.
   * Experimental components use `"cinder/experimental/{id}"`.
   */
  import: string;
  /** PascalCase named export the component ships under. */
  exportName: string;
  /** Category identifier from the closed set in `manifest.meta.ts`. */
  category: CategoryId;
  /** Status identifier from the closed set in `manifest.meta.ts`. */
  status: StatusLevel;
  /** One-sentence description of what this component is for. */
  purpose: string;
  /** Free-form classification tags. */
  tags: string[];
  /** When to prefer this component over similar alternatives. */
  useWhen: string[];
  /** When NOT to use this component. */
  avoidWhen: string[];
  /** Kebab-case ids of related components. */
  related: string[];
  /**
   * True when the component directory contains a `{id}.constraints.ts` file.
   * The constraints sidecar is published at `cinder/{id}/constraints`.
   */
  hasConstraints: boolean;
  /**
   * True when the playground has at least one `.example.svelte` file for this
   * component. The examples sidecar is published at `cinder/{id}/examples`.
   */
  hasExamples: boolean;
  /** Subpath import specifiers for the machine-readable artifacts. */
  artifacts: {
    schema: string;
    variables: string;
    examples?: string;
    constraints?: string;
  };
};

/** The full shape of `components.json`. */
export type Manifest = {
  $schema: string;
  manifestVersion: 1;
  package: {
    name: string;
    version: string;
    framework: 'svelte';
    frameworkVersionRange: string;
    classPrefix: string;
    cssVarPrefix: string;
    tokenNamespaces: string[];
    stylesEntry: string;
    schemaDialect: string;
  };
  categories: Record<CategoryId, { label: string; description: string }>;
  statusLevels: Record<StatusLevel, string>;
  overlapFamilies: Record<string, readonly string[]>;
  components: ManifestComponent[];
};

// ---------------------------------------------------------------------------
// Filesystem roots (resolved relative to this script)
// ---------------------------------------------------------------------------

const PACKAGE_ROOT = join(import.meta.dir, '..');
const PLAYGROUND_EXAMPLES_ROOT = join(import.meta.dir, '..', '..', 'playground', 'src', 'examples');
const COMPONENTS_ROOT = join(PACKAGE_ROOT, 'src', 'components');
const MANIFEST_PATH = join(PACKAGE_ROOT, 'components.json');
const SCHEMA_PATH = join(PACKAGE_ROOT, 'src', 'schemas', 'manifest.schema.json');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a kebab-case component id to PascalCase.
 * "button-group" → "ButtonGroup"
 */
function kebabToPascal(id: string): string {
  return id
    .split('-')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('');
}

/**
 * Determine the `import` specifier for a component.
 * Experimental components use the `cinder/experimental/{id}` subpath,
 * matching what `generate-exports.ts` emits for `./experimental/{name}`.
 */
function importSpecifier(id: string, isExperimental: boolean): string {
  return isExperimental ? `cinder/experimental/${id}` : `cinder/${id}`;
}

/**
 * Check whether a playground examples directory exists and contains at least
 * one `.example.svelte` file (non-excluded).
 */
async function hasPlaygroundExamples(id: string): Promise<boolean> {
  const examplesDir = join(PLAYGROUND_EXAMPLES_ROOT, id);
  if (!existsSync(examplesDir)) return false;
  const { readdir } = await import('node:fs/promises');
  const entries = await readdir(examplesDir);
  return entries.some((file) => file.endsWith('.example.svelte'));
}

/**
 * Check whether a component directory ships a constraints sidecar
 * (`{id}.constraints.ts`).
 */
function hasConstraintsSidecar(id: string, isExperimental: boolean): boolean {
  const componentDir = isExperimental
    ? join(COMPONENTS_ROOT, 'experimental', id)
    : join(COMPONENTS_ROOT, id);
  return existsSync(join(componentDir, `${id}.constraints.ts`));
}

/**
 * Derive the artifact subpath prefix. Per the plan, artifact subpaths do NOT
 * include the `experimental/` prefix — they use the same flat `cinder/{id}/…`
 * pattern regardless of whether the component is experimental.
 *
 * This matches how `generate-exports.ts` computes the `schema` and `variables`
 * subpaths for experimental components: it uses `./experimental/{name}/schema`
 * in `package.json#exports` but the consumer-facing import remains
 * `cinder/experimental/{name}/schema`. We follow that same pattern here.
 */
function artifactSubpath(id: string, isExperimental: boolean, suffix: string): string {
  const prefix = isExperimental ? `cinder/experimental/${id}` : `cinder/${id}`;
  return `${prefix}/${suffix}`;
}

// ---------------------------------------------------------------------------
// Core builder
// ---------------------------------------------------------------------------

/**
 * Build the manifest from all discovered component metadata.
 *
 * Throws when:
 * - `extractAllComponentMetadata()` returns any errors (partial manifest is
 *   never emitted — callers must fix all annotations first).
 * - The produced manifest fails validation against `manifest.schema.json`.
 */
/**
 * Format an extraction-errors list into the human-readable message that
 * `buildManifest()` throws when annotations are incomplete.
 *
 * Exported separately from `buildManifest()` so tests can exercise the
 * "fail loudly" path without mocking the extractor — mocking entire modules
 * with `mock.module()` leaks across files in a single `bun test` run and
 * breaks unrelated suites.
 */
export function formatExtractionErrorMessage(
  errors: ReadonlyArray<{ componentId: string; reason: string }>,
): string {
  const shown = errors.slice(0, 10);
  const lines = shown.map((e) => `  [${e.componentId}] ${e.reason}`);
  const tail =
    errors.length > 10
      ? `  … and ${errors.length - 10} more errors (${errors.length} total)`
      : `  (${errors.length} error${errors.length === 1 ? '' : 's'} total)`;
  return `Cannot build manifest — ${errors.length} component${errors.length === 1 ? '' : 's'} have extraction errors:\n${lines.join('\n')}\n${tail}\n\nFix all @cinder metadata annotations before generating the manifest.`;
}

export async function buildManifest(): Promise<Manifest> {
  // 1. Extract metadata from every component's .svelte file.
  const { metadata, errors } = await extractAllComponentMetadata();

  if (errors.length > 0) {
    throw new Error(formatExtractionErrorMessage(errors));
  }

  // 2. Read version and frameworkVersionRange from package.json.
  const packageJsonPath = join(PACKAGE_ROOT, 'package.json');
  const packageJson = (await Bun.file(packageJsonPath).json()) as {
    name: string;
    version: string;
    peerDependencies?: Record<string, string>;
  };

  const version = packageJson.version;
  const frameworkVersionRange = packageJson.peerDependencies?.['svelte'] ?? '>=5.0.0';

  // 3. Build per-component entries in parallel.
  const componentEntries = await Promise.all(
    metadata.map(async (meta: ComponentMetadata): Promise<ManifestComponent> => {
      const exportName = kebabToPascal(meta.id);
      const importPath = importSpecifier(meta.id, meta.isExperimental);
      const hasExamplesFlag = await hasPlaygroundExamples(meta.id);
      const hasConstraintsFlag = hasConstraintsSidecar(meta.id, meta.isExperimental);

      const artifacts: ManifestComponent['artifacts'] = {
        schema: artifactSubpath(meta.id, meta.isExperimental, 'schema'),
        variables: artifactSubpath(meta.id, meta.isExperimental, 'variables'),
      };

      if (hasExamplesFlag) {
        artifacts.examples = artifactSubpath(meta.id, meta.isExperimental, 'examples');
      }
      if (hasConstraintsFlag) {
        artifacts.constraints = artifactSubpath(meta.id, meta.isExperimental, 'constraints');
      }

      return {
        name: exportName,
        id: meta.id,
        import: importPath,
        exportName,
        category: meta.category,
        status: meta.status,
        purpose: meta.purpose,
        tags: meta.tags,
        useWhen: meta.useWhen,
        avoidWhen: meta.avoidWhen,
        related: meta.related,
        hasConstraints: hasConstraintsFlag,
        hasExamples: hasExamplesFlag,
        artifacts,
      };
    }),
  );

  // 4. The metadata is already sorted stable-first, experimental-last,
  //    alphabetical within each group (matching discoverDirectoryComponents).
  //    No re-sorting needed here — extractAllComponentMetadata preserves the
  //    discover order modulo the stable/experimental split.

  // 5. Assemble the manifest.
  const manifest: Manifest = {
    $schema: './src/schemas/manifest.schema.json',
    manifestVersion: 1,
    package: {
      name: 'cinder',
      version,
      framework: 'svelte',
      frameworkVersionRange,
      classPrefix: 'cinder-',
      cssVarPrefix: '--cinder-',
      tokenNamespaces: ['color', 'space', 'radius', 'ring', 'type', 'motion', 'shadow'],
      stylesEntry: 'cinder/styles',
      schemaDialect: 'https://json-schema.org/draft/2020-12/schema',
    },
    categories,
    statusLevels,
    overlapFamilies,
    components: componentEntries,
  };

  // 6. Validate the manifest against manifest.schema.json before returning.
  const schemaText = await Bun.file(SCHEMA_PATH).text();
  const schema = JSON.parse(schemaText) as object;

  const ajv = new Ajv({ strict: false });
  const validate = ajv.compile(schema);
  const valid = validate(manifest);

  if (!valid) {
    const validationErrors = (validate.errors ?? [])
      .map((e) => `  ${e.instancePath || '(root)'}: ${e.message ?? 'unknown error'}`)
      .join('\n');
    throw new Error(`Generated manifest failed schema validation:\n${validationErrors}`);
  }

  return manifest;
}

/**
 * Build the manifest and write it to `packages/components/components.json`.
 * Throws if extraction errors exist (never writes a partial manifest).
 */
export async function writeManifest(): Promise<void> {
  const manifest = await buildManifest();
  const content = JSON.stringify(manifest, null, 2) + '\n';
  await Bun.write(MANIFEST_PATH, content);
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const checkMode = process.argv.includes('--check');

  if (checkMode) {
    // Regenerate into memory, compare against committed file.
    let manifest: Manifest;
    try {
      manifest = await buildManifest();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`manifest:check — build failed:\n${message}\n`);
      process.exit(1);
    }

    const generated = JSON.stringify(manifest, null, 2) + '\n';

    if (!existsSync(MANIFEST_PATH)) {
      process.stderr.write(
        'manifest:check — components.json does not exist. Run `bun run manifest:generate` to create it.\n',
      );
      process.exit(1);
    }

    const committed = await Bun.file(MANIFEST_PATH).text();

    if (generated === committed) {
      process.stdout.write('manifest:check — OK\n');
      return;
    }

    // Produce a readable unified diff.
    process.stderr.write(
      'manifest:check — drift detected. Run `bun run manifest:generate` to fix:\n\n',
    );

    const committedLines = committed.split('\n');
    const generatedLines = generated.split('\n');
    const maxLines = Math.max(committedLines.length, generatedLines.length);

    let diffLines = 0;
    for (let i = 0; i < maxLines && diffLines < 40; i++) {
      const committed_line = committedLines[i] ?? '';
      const generated_line = generatedLines[i] ?? '';
      if (committed_line !== generated_line) {
        process.stderr.write(`- ${committed_line}\n`);
        process.stderr.write(`+ ${generated_line}\n`);
        diffLines++;
      }
    }

    if (diffLines >= 40) {
      process.stderr.write('... (diff truncated — run manifest:generate to see full changes)\n');
    }

    process.exit(1);
  }

  // Generate mode: write the manifest to disk.
  try {
    await writeManifest();
    process.stdout.write(`manifest:generate — wrote components.json\n`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`manifest:generate — failed:\n${message}\n`);
    process.exit(1);
  }
}

if (import.meta.main) {
  await main();
}

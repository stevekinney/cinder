import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';

import Ajv from 'ajv/dist/2020.js';
import * as prettier from 'prettier';

import {
  generateArtifactsForComponent,
  type ComponentArtifacts,
} from '../../components/scripts/component-artifact-operations.ts';
import {
  extractExampleFile,
  type ExampleExclusion,
  type ExampleSet,
  type ExtractExampleError,
  type GenerateExamplesResult,
} from '../../components/scripts/generate-component-examples.ts';
import {
  extractFromSource,
  type ComponentMetadata,
} from '../../components/scripts/generate-component-metadata.ts';
import { discoverDirectoryComponents } from '../../components/scripts/generate-exports.ts';
import { categories, statusLevels } from '../../components/src/manifest.meta.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

type ComponentDefinition = {
  id: string;
  exportName: string;
  importSpecifier: string;
};

type ManifestComponent = Omit<ComponentMetadata, 'isExperimental'> & {
  name: string;
  import: string;
  exportName: string;
  hasConstraints: false;
  hasExamples: true;
  artifacts: {
    schema: string;
    variables: string;
    examples: string;
  };
};

const PACKAGE_ROOT = join(import.meta.dir, '..');
const PACKAGES_ROOT = join(PACKAGE_ROOT, '..');
const COMPONENTS_ROOT = join(PACKAGE_ROOT, 'src', 'lib', 'components');
const PLAYGROUND_EXAMPLES_ROOT = join(PACKAGES_ROOT, 'playground', 'src', 'examples');
const MANIFEST_PATH = join(PACKAGE_ROOT, 'components.json');
const MANIFEST_SCHEMA_PATH = join(PACKAGE_ROOT, 'src', 'lib', 'schemas', 'manifest.schema.json');

const componentDefinitions: readonly ComponentDefinition[] = [
  {
    id: 'markdown-editor',
    exportName: 'MarkdownEditor',
    importSpecifier: '@lostgradient/editor/markdown-editor',
  },
  {
    id: 'review-editor',
    exportName: 'ReviewEditor',
    importSpecifier: '@lostgradient/editor/review-editor',
  },
  {
    id: 'diff-viewer',
    exportName: 'DiffViewer',
    importSpecifier: '@lostgradient/editor/diff-viewer',
  },
];

const componentDefinitionById = new Map(
  componentDefinitions.map((definition) => [definition.id, definition]),
);
const allowedEditorImportSpecifiers = new Set(
  componentDefinitions.map((definition) => definition.importSpecifier),
);

async function format(content: string, path: string): Promise<string> {
  const configuration = await prettier.resolveConfig(path);
  return prettier.format(content, { ...configuration, filepath: path });
}

function componentDirectory(definition: ComponentDefinition): string {
  return join(COMPONENTS_ROOT, definition.id);
}

async function generateComponentArtifacts(
  definition: ComponentDefinition,
): Promise<ComponentArtifacts> {
  const artifacts = await generateArtifactsForComponent({
    directory: componentDirectory(definition),
    name: definition.id,
    isExperimental: false,
  });

  const schemaModulePath = join(componentDirectory(definition), `${definition.id}.schema.ts`);
  const schemaModule = artifacts.schemaModule.replace(
    /(from ['"](?:\.\.\/)+schema-types)(['"])/,
    '$1.ts$2',
  );

  return {
    ...artifacts,
    schemaModule: await format(schemaModule, schemaModulePath),
  };
}

async function writeComponentArtifacts(artifacts: ComponentArtifacts): Promise<void> {
  const { directory, name } = artifacts.component;
  await Bun.write(join(directory, `${name}.schema.json`), artifacts.schemaJson);
  await Bun.write(join(directory, `${name}.schema.ts`), artifacts.schemaModule);
  await Bun.write(join(directory, `${name}.variables.json`), artifacts.variablesJson);
  await Bun.write(join(directory, `${name}.variables.ts`), artifacts.variablesModule);
  if (artifacts.readme !== null) await Bun.write(join(directory, 'README.md'), artifacts.readme);
}

async function componentArtifactDrift(artifacts: ComponentArtifacts): Promise<string[]> {
  const { directory, name } = artifacts.component;
  const expectedFiles = new Map<string, string | null>([
    [`${name}.schema.json`, artifacts.schemaJson],
    [`${name}.schema.ts`, artifacts.schemaModule],
    [`${name}.variables.json`, artifacts.variablesJson],
    [`${name}.variables.ts`, artifacts.variablesModule],
    ['README.md', artifacts.readme],
  ]);
  const drift: string[] = [];

  for (const [filename, expected] of expectedFiles) {
    if (expected === null) continue;
    const path = join(directory, filename);
    if (!existsSync(path)) {
      drift.push(`${name}/${filename} (missing)`);
    } else if ((await Bun.file(path).text()) !== expected) {
      drift.push(`${name}/${filename} (stale)`);
    }
  }

  const accessibilityPath = join(directory, `${name}.a11y.md`);
  if (!existsSync(accessibilityPath)) drift.push(`${name}/${name}.a11y.md (missing)`);
  return drift;
}

function exampleArtifactPath(componentId: string): string {
  const definition = componentDefinitionById.get(componentId);
  if (definition === undefined) throw new Error(`Unknown Editor component: ${componentId}`);
  return join(componentDirectory(definition), `${componentId}.examples.json`);
}

function serializedExampleSet(exampleSet: ExampleSet): string {
  return `${JSON.stringify(exampleSet, null, 2)}\n`;
}

export async function generateEditorExamples(): Promise<GenerateExamplesResult> {
  const cinderComponents = await discoverDirectoryComponents();
  const validCinderSubpaths = new Set<string>(['highlighters/shiki']);
  for (const component of cinderComponents) {
    validCinderSubpaths.add(
      component.isExperimental ? `experimental/${component.name}` : component.name,
    );
  }

  const exampleSets: ExampleSet[] = [];
  const exclusions: ExampleExclusion[] = [];
  const errors: ExtractExampleError[] = [];

  for (const definition of componentDefinitions) {
    const examplesDirectory = join(PLAYGROUND_EXAMPLES_ROOT, definition.id);
    let filenames: string[];
    try {
      const directoryEntries = await readdir(examplesDirectory);
      filenames = directoryEntries
        .filter((filename) => filename.endsWith('.example.svelte'))
        .toSorted();
    } catch {
      errors.push({
        componentId: definition.id,
        file: `playground/src/examples/${definition.id}`,
        reason: 'example directory is missing or unreadable',
      });
      continue;
    }

    if (filenames.length === 0) {
      errors.push({
        componentId: definition.id,
        file: `playground/src/examples/${definition.id}`,
        reason: 'no .example.svelte source files found',
      });
      continue;
    }

    const examples: ExampleSet['examples'] = [];
    for (const filename of filenames) {
      const filePath = join(examplesDirectory, filename);
      const relativeFilePath = filePath.slice(PACKAGES_ROOT.length + 1);
      let source: string;
      try {
        source = await Bun.file(filePath).text();
      } catch {
        errors.push({
          componentId: definition.id,
          file: relativeFilePath,
          reason: `could not read file: ${filePath}`,
        });
        continue;
      }

      const result = extractExampleFile({
        componentId: definition.id,
        filePath: relativeFilePath,
        source,
        validCinderSubpaths,
        allowedImportSpecifiers: allowedEditorImportSpecifiers,
      });
      if (result.kind === 'error') {
        errors.push({
          componentId: definition.id,
          file: relativeFilePath,
          reason: result.reason,
        });
        continue;
      }
      if (result.kind === 'exclusion') {
        exclusions.push({
          componentId: definition.id,
          file: relativeFilePath,
          reason: result.reason,
        });
        continue;
      }
      if (result.componentOverride !== undefined) {
        errors.push({
          componentId: definition.id,
          file: relativeFilePath,
          reason: 'Editor examples cannot override their owning component',
        });
        continue;
      }

      examples.push(result.example);
    }

    if (examples.length === 0) {
      errors.push({
        componentId: definition.id,
        file: `playground/src/examples/${definition.id}`,
        reason: `all ${filenames.length} playground example(s) are excluded or errored; at least one must be published`,
      });
      continue;
    }

    exampleSets.push({
      $schema: '../../schemas/examples.schema.json',
      component: definition.id,
      import: definition.importSpecifier,
      examples,
    });
  }

  const totalExamples =
    exclusions.length +
    errors.filter((error) => !error.reason.startsWith('all ')).length +
    exampleSets.reduce((total, exampleSet) => total + exampleSet.examples.length, 0);
  if (exclusions.length > totalExamples * 0.1) {
    throw new Error(
      `exclusion budget exceeded: ${exclusions.length} of ${totalExamples} examples excluded; cap is 10%`,
    );
  }

  return { exampleSets, exclusions, errors };
}

async function writeEditorExampleArtifacts(result: GenerateExamplesResult): Promise<void> {
  for (const exampleSet of result.exampleSets) {
    await Bun.write(exampleArtifactPath(exampleSet.component), serializedExampleSet(exampleSet));
  }
}

type EditorExamplesDriftOptions = {
  listComponentDirectories?: () => Promise<readonly string[]>;
  readDirectory?: (directory: string) => Promise<readonly string[]>;
};

async function componentDirectoriesOnDisk(): Promise<string[]> {
  const entries = await readdir(COMPONENTS_ROOT, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(COMPONENTS_ROOT, entry.name))
    .toSorted((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export async function checkEditorExamplesDrift(
  result: GenerateExamplesResult,
  options: EditorExamplesDriftOptions = {},
): Promise<string[]> {
  const issues: string[] = [];
  const expectedPaths = new Set<string>();
  for (const exampleSet of result.exampleSets) {
    const path = exampleArtifactPath(exampleSet.component);
    expectedPaths.add(path);
    if (!existsSync(path)) {
      issues.push(`${exampleSet.component}/${exampleSet.component}.examples.json (missing)`);
    } else if ((await Bun.file(path).text()) !== serializedExampleSet(exampleSet)) {
      issues.push(`${exampleSet.component}/${exampleSet.component}.examples.json (stale)`);
    }
  }

  const readDirectory = options.readDirectory ?? readdir;
  const listComponentDirectories = options.listComponentDirectories ?? componentDirectoriesOnDisk;
  const componentDirectories = await listComponentDirectories();
  for (const directory of componentDirectories) {
    const componentId = basename(directory);
    const filenames = await readDirectory(directory).catch(() => []);
    for (const filename of filenames.toSorted((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
      if (!filename.endsWith('.examples.json')) continue;
      const path = join(directory, filename);
      if (!expectedPaths.has(path)) {
        issues.push(
          `orphan artifact (no corresponding source example): ${componentId}/${filename}`,
        );
      }
    }
  }
  return issues;
}

async function extractMetadata(definition: ComponentDefinition): Promise<ComponentMetadata> {
  const path = join(componentDirectory(definition), `${definition.id}.svelte`);
  const result = extractFromSource(await Bun.file(path).text(), definition.id, path, false);
  if (!result.ok) throw new Error(`[${definition.id}] ${result.error.reason}`);
  return result.metadata;
}

async function buildManifest(): Promise<Record<string, unknown>> {
  const packageJson: unknown = JSON.parse(
    await Bun.file(join(PACKAGE_ROOT, 'package.json')).text(),
  );
  if (
    !isRecord(packageJson) ||
    typeof packageJson['name'] !== 'string' ||
    typeof packageJson['version'] !== 'string' ||
    !isRecord(packageJson['peerDependencies']) ||
    typeof packageJson['peerDependencies']['svelte'] !== 'string'
  ) {
    throw new Error('package.json must define name, version, and the Svelte peer range');
  }

  const components: ManifestComponent[] = [];
  for (const definition of componentDefinitions) {
    const metadata = await extractMetadata(definition);
    const artifactPrefix = definition.importSpecifier;
    components.push({
      id: metadata.id,
      category: metadata.category,
      status: metadata.status,
      purpose: metadata.purpose,
      tags: metadata.tags,
      useWhen: metadata.useWhen,
      avoidWhen: metadata.avoidWhen,
      related: metadata.related,
      ...(metadata.a11y === undefined ? {} : { a11y: metadata.a11y }),
      name: definition.exportName,
      import: definition.importSpecifier,
      exportName: definition.exportName,
      hasConstraints: false,
      hasExamples: true,
      artifacts: {
        schema: `${artifactPrefix}/schema`,
        variables: `${artifactPrefix}/variables`,
        examples: `${artifactPrefix}/examples`,
      },
    });
  }

  const manifest = {
    $schema: './dist/schemas/manifest.schema.json',
    manifestVersion: 1,
    package: {
      name: packageJson['name'],
      version: packageJson['version'],
      framework: 'svelte',
      frameworkVersionRange: packageJson['peerDependencies']['svelte'],
      classPrefix: 'cinder-',
      cssVarPrefix: '--cinder-',
      tokenNamespaces: ['color', 'space', 'radius', 'ring', 'type', 'motion', 'shadow'],
      stylesEntry: '@lostgradient/cinder/styles',
      schemaDialect: 'https://json-schema.org/draft/2020-12/schema',
    },
    categories,
    statusLevels,
    overlapFamilies: {},
    components,
  };

  const schema: unknown = JSON.parse(await Bun.file(MANIFEST_SCHEMA_PATH).text());
  if (!isRecord(schema)) throw new Error('manifest schema must be a JSON object');
  const validate = new Ajv({ strict: false }).compile(schema);
  if (!validate(manifest)) {
    const errors = (validate.errors ?? [])
      .map((error) => `${error.instancePath || '(root)'}: ${error.message ?? 'invalid'}`)
      .join('\n');
    throw new Error(`Generated manifest failed schema validation:\n${errors}`);
  }
  return manifest;
}

async function formattedManifest(): Promise<string> {
  return format(`${JSON.stringify(await buildManifest(), null, 2)}\n`, MANIFEST_PATH);
}

async function main(): Promise<void> {
  const checkMode = process.argv.includes('--check');
  const issues: string[] = [];
  const examples = await generateEditorExamples();

  for (const error of examples.errors) {
    issues.push(`examples: ${error.componentId}/${error.file} (${error.reason})`);
  }
  if (checkMode) {
    issues.push(...(await checkEditorExamplesDrift(examples)));
  } else if (examples.errors.length > 0) {
    process.stderr.write(
      `components:generate — refusing to write artifacts: ${examples.errors.length} example error(s)\n`,
    );
    for (const error of examples.errors) {
      process.stderr.write(`  [${error.componentId}] ${error.file}: ${error.reason}\n`);
    }
    process.exitCode = 1;
    return;
  }

  for (const definition of componentDefinitions) {
    const artifacts = await generateComponentArtifacts(definition);
    if (checkMode) {
      issues.push(...(await componentArtifactDrift(artifacts)));
    } else {
      await writeComponentArtifacts(artifacts);
      process.stdout.write(`generated ${definition.id}\n`);
    }
  }

  if (!checkMode) {
    await writeEditorExampleArtifacts(examples);
    process.stdout.write(
      `generated examples: ${examples.exampleSets.length} component(s), ${examples.exampleSets.reduce((total, exampleSet) => total + exampleSet.examples.length, 0)} example(s)\n`,
    );
  }

  const manifest = await formattedManifest();
  if (checkMode) {
    if (!existsSync(MANIFEST_PATH)) {
      issues.push('components.json (missing)');
    } else if ((await Bun.file(MANIFEST_PATH).text()) !== manifest) {
      issues.push('components.json (stale)');
    }
  } else {
    await Bun.write(MANIFEST_PATH, manifest);
    process.stdout.write('generated components.json\n');
  }

  if (issues.length > 0) {
    process.stderr.write(
      `components:check — drift detected. Run \`bun run components:generate\` to fix:\n${issues.map((issue) => `  • ${issue}`).join('\n')}\n`,
    );
    process.exitCode = 1;
  } else if (checkMode) {
    process.stdout.write('components:check — OK\n');
  }
}

if (import.meta.main) await main();

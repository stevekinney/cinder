import { existsSync } from 'node:fs';
import { join } from 'node:path';

import Ajv from 'ajv/dist/2020.js';
import * as prettier from 'prettier';

import {
  generateArtifactsForComponent,
  type ComponentArtifacts,
} from '../../components/scripts/component-artifact-operations.ts';
import {
  extractFromSource,
  type ComponentMetadata,
} from '../../components/scripts/generate-component-metadata.ts';
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
const COMPONENTS_ROOT = join(PACKAGE_ROOT, 'src', 'lib', 'components');
const MANIFEST_PATH = join(PACKAGE_ROOT, 'components.json');
const MANIFEST_SCHEMA_PATH = join(PACKAGE_ROOT, 'src', 'lib', 'schemas', 'manifest.schema.json');

const componentDefinitions: readonly ComponentDefinition[] = [
  { id: 'chat', exportName: 'Chat', importSpecifier: '@lostgradient/chat' },
  {
    id: 'chat-composer-popover',
    exportName: 'ChatComposerPopover',
    importSpecifier: '@lostgradient/chat/composer-popover',
  },
  {
    id: 'chat-conversation-header',
    exportName: 'ChatConversationHeader',
    importSpecifier: '@lostgradient/chat/conversation-header',
  },
  {
    id: 'chat-conversation-list',
    exportName: 'ChatConversationList',
    importSpecifier: '@lostgradient/chat/conversation-list',
  },
];

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

async function validateExamples(definition: ComponentDefinition): Promise<string[]> {
  const path = join(componentDirectory(definition), `${definition.id}.examples.json`);
  if (!existsSync(path)) return [`${definition.id}/${definition.id}.examples.json (missing)`];

  let artifact: {
    component?: unknown;
    import?: unknown;
    examples?: unknown[];
  };
  try {
    const parsed: unknown = JSON.parse(await Bun.file(path).text());
    if (!isRecord(parsed)) throw new Error('examples artifact must be a JSON object');
    artifact = {
      component: parsed['component'],
      import: parsed['import'],
      ...(Array.isArray(parsed['examples']) ? { examples: parsed['examples'] } : {}),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return [`${definition.id}/${definition.id}.examples.json (invalid JSON: ${message})`];
  }

  const issues: string[] = [];
  if (artifact.component !== definition.id) issues.push(`${definition.id}/examples component`);
  if (artifact.import !== definition.importSpecifier)
    issues.push(`${definition.id}/examples import`);
  if (!Array.isArray(artifact.examples) || artifact.examples.length === 0) {
    issues.push(`${definition.id}/examples entries`);
  }

  const source = JSON.stringify(artifact);
  if (source.includes('@lostgradient/cinder/chat')) {
    issues.push(`${definition.id}/examples contains a removed Cinder Chat import`);
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

  for (const definition of componentDefinitions) {
    const artifacts = await generateComponentArtifacts(definition);
    issues.push(...(await validateExamples(definition)));
    if (checkMode) {
      issues.push(...(await componentArtifactDrift(artifacts)));
    } else {
      await writeComponentArtifacts(artifacts);
      process.stdout.write(`generated ${definition.id}\n`);
    }
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

await main();

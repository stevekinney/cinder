import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';

import { formatGenerated } from './component-artifact-operations.ts';
import type { Manifest, ManifestComponent } from './generate-manifest.ts';

const PACKAGE_ROOT = join(import.meta.dir, '..');
const EXPORTS_DIRECTORY = join(PACKAGE_ROOT, 'src', 'exports');

type MetadataKind = 'schema' | 'variables' | 'constraints' | 'examples';

const outputFiles: Record<MetadataKind, readonly string[]> = {
  schema: ['metadata-schemas.ts'],
  variables: ['metadata-variables.ts'],
  constraints: ['metadata-constraints.ts'],
  examples: ['metadata-examples-a-m.ts', 'metadata-examples-n-z.ts'],
};

const MANIFEST_FILENAME = 'metadata-manifest.ts';

function toLowerCamelCase(identifier: string): string {
  return identifier
    .split('-')
    .map((part, index) => (index === 0 ? part : `${part.charAt(0).toUpperCase()}${part.slice(1)}`))
    .join('');
}

function componentArtifactPath(
  component: ManifestComponent,
  kind: MetadataKind,
): string | undefined {
  const artifact = component.artifacts[kind];
  if (artifact === undefined) return undefined;
  const extension = kind === 'schema' || kind === 'variables' ? '.ts' : '.json';
  const expectedSuffix = kind === 'schema' ? '.schema.json' : `.${kind}.json`;
  if (!artifact.endsWith(expectedSuffix)) {
    throw new Error(`Unexpected ${kind} artifact path for ${component.id}: ${artifact}`);
  }
  return artifact.slice(0, -'.json'.length) + extension;
}

function createFileHeader(kind: MetadataKind): string {
  return `/** Generated root exports for component ${kind} metadata. Do not edit. */\n\n`;
}

function isIncludedInOutputFile(
  component: ManifestComponent,
  kind: MetadataKind,
  fileIndex: number,
): boolean {
  return kind !== 'examples' || component.id < 'n' === (fileIndex === 0);
}

function createModuleSource(
  manifest: Manifest,
  kind: MetadataKind,
  fileIndex: number,
  exportsDirectory: string,
): string {
  const names = new Map<string, string>();
  const imports: string[] = [];
  const exports: string[] = [];

  for (const component of manifest.components) {
    if (!isIncludedInOutputFile(component, kind, fileIndex)) continue;
    const artifact = componentArtifactPath(component, kind);
    if (artifact === undefined) continue;
    const name = `${toLowerCamelCase(component.id)}${kind === 'schema' ? 'Schema' : kind === 'variables' ? 'Variables' : kind.charAt(0).toUpperCase() + kind.slice(1)}`;
    const existing = names.get(name);
    if (existing !== undefined) {
      throw new Error(`Metadata export ${name} collides between ${existing} and ${component.id}`);
    }
    names.set(name, component.id);
    const absoluteArtifactPath = join(PACKAGE_ROOT, artifact);
    if (!existsSync(absoluteArtifactPath)) {
      throw new Error(`Missing ${kind} artifact for ${component.id}: ${artifact}`);
    }
    const importPath = relative(exportsDirectory, absoluteArtifactPath).replaceAll('\\', '/');
    if (kind === 'schema' || kind === 'variables') {
      exports.push(`export { default as ${name} } from '${importPath}';`);
    } else {
      imports.push(`import ${name} from '${importPath}' with { type: 'json' };`);
      exports.push(`export { ${name} };`);
    }
  }

  return `${createFileHeader(kind)}${imports.join('\n')}\n${exports.join('\n')}\n`;
}

async function formatRootExport(
  content: string,
  filepath: string,
  shouldFormat: boolean,
): Promise<string> {
  return shouldFormat ? formatGenerated(content, filepath) : content;
}

export async function generateRootMetadataExports(
  manifest: Manifest,
  exportsDirectory: string = EXPORTS_DIRECTORY,
  shouldFormat = true,
): Promise<Map<string, string>> {
  const generated = new Map<string, string>();
  const manifestPath = join(exportsDirectory, MANIFEST_FILENAME);
  generated.set(
    MANIFEST_FILENAME,
    await formatRootExport(
      "/** Generated root export for the component manifest. Do not edit. */\n\nimport manifest from '../../components.json' with { type: 'json' };\n\nexport { manifest };\n",
      manifestPath,
      shouldFormat,
    ),
  );
  const kinds: MetadataKind[] = ['schema', 'variables', 'constraints', 'examples'];
  for (const kind of kinds) {
    for (const [fileIndex, filename] of outputFiles[kind].entries()) {
      const path = join(EXPORTS_DIRECTORY, filename);
      generated.set(
        filename,
        await formatRootExport(
          createModuleSource(manifest, kind, fileIndex, exportsDirectory),
          path,
          shouldFormat,
        ),
      );
    }
  }
  return generated;
}

export async function checkRootMetadataExports(
  manifest: Manifest,
  exportsDirectory: string = EXPORTS_DIRECTORY,
  shouldFormat = true,
): Promise<string[]> {
  const generated = await generateRootMetadataExports(manifest, exportsDirectory, shouldFormat);
  const issues: string[] = [];
  for (const [filename, expected] of generated) {
    const path = join(exportsDirectory, filename);
    const actual = existsSync(path) ? await Bun.file(path).text() : undefined;
    if (actual !== expected) {
      issues.push(
        `root metadata export ${filename} is ${actual === undefined ? 'missing' : 'stale'}`,
      );
    }
  }
  return issues;
}

export async function writeRootMetadataExports(
  manifest: Manifest,
  exportsDirectory: string = EXPORTS_DIRECTORY,
  shouldFormat = true,
): Promise<void> {
  const generated = await generateRootMetadataExports(manifest, exportsDirectory, shouldFormat);
  for (const [filename, content] of generated) {
    await Bun.write(join(exportsDirectory, filename), content);
  }
}

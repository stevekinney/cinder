import { dirname, join } from 'node:path';

import { renderMarkdown } from '@cinder/markdown/rendering';

import type {
  ComponentDocumentationPayload,
  DocumentationComponentSummary,
  DocumentationReadme,
  JsonValue,
} from './component-documentation-types.ts';
import type { ComponentManifest } from './types.ts';

const PLAYGROUND_ROOT = dirname(import.meta.dirname);
const COMPONENTS_ROOT = join(PLAYGROUND_ROOT, '..', 'components');
const COMPONENTS_SOURCE_ROOT = join(COMPONENTS_ROOT, 'src', 'components');
const COMPONENTS_MANIFEST_PATH = join(COMPONENTS_ROOT, 'components.json');

type PackageComponentEntry = {
  name: string;
  id: string;
  import: string;
  exportName: string;
  category: string;
  status: string;
  purpose: string;
  tags: string[];
  useWhen: string[];
  avoidWhen: string[];
  related: string[];
  hasConstraints: boolean;
  hasExamples: boolean;
  artifacts: {
    schema: string;
    variables: string;
    examples?: string;
    constraints?: string;
  };
};

type PackageManifest = {
  components: PackageComponentEntry[];
  categories: Record<string, { label: string; description: string }>;
  statusLevels: Record<string, string>;
};

type DocumentationArtifactName = 'schema' | 'variables' | 'constraints' | 'examples';

export class ComponentDocumentationError extends Error {
  constructor(
    readonly code:
      | 'unknown-component'
      | 'malformed-components-manifest'
      | 'missing-required-artifact'
      | 'invalid-json-artifact',
    message: string,
  ) {
    super(message);
    this.name = 'ComponentDocumentationError';
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return true;
  }
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (!isObject(value)) return false;
  return Object.values(value).every(isJsonValue);
}

function isArtifactSpecifiers(value: unknown): value is PackageComponentEntry['artifacts'] {
  if (!isObject(value)) return false;
  const examples = value['examples'];
  const constraints = value['constraints'];
  return (
    typeof value['schema'] === 'string' &&
    typeof value['variables'] === 'string' &&
    (examples === undefined || typeof examples === 'string') &&
    (constraints === undefined || typeof constraints === 'string')
  );
}

function isPackageComponentEntry(value: unknown): value is PackageComponentEntry {
  if (!isObject(value)) return false;
  return (
    typeof value['name'] === 'string' &&
    typeof value['id'] === 'string' &&
    typeof value['import'] === 'string' &&
    typeof value['exportName'] === 'string' &&
    typeof value['category'] === 'string' &&
    typeof value['status'] === 'string' &&
    typeof value['purpose'] === 'string' &&
    isStringArray(value['tags']) &&
    isStringArray(value['useWhen']) &&
    isStringArray(value['avoidWhen']) &&
    isStringArray(value['related']) &&
    typeof value['hasConstraints'] === 'boolean' &&
    typeof value['hasExamples'] === 'boolean' &&
    isArtifactSpecifiers(value['artifacts'])
  );
}

function isCategoryMap(value: unknown): value is PackageManifest['categories'] {
  if (!isObject(value)) return false;
  return Object.values(value).every(
    (entry) =>
      isObject(entry) &&
      typeof entry['label'] === 'string' &&
      typeof entry['description'] === 'string',
  );
}

function isStatusMap(value: unknown): value is PackageManifest['statusLevels'] {
  return isObject(value) && Object.values(value).every((entry) => typeof entry === 'string');
}

function isPackageManifest(value: unknown): value is PackageManifest {
  if (!isObject(value)) return false;
  const components = value['components'];
  return (
    Array.isArray(components) &&
    components.every(isPackageComponentEntry) &&
    isCategoryMap(value['categories']) &&
    isStatusMap(value['statusLevels'])
  );
}

export async function loadPackageManifestForDocumentation(): Promise<PackageManifest> {
  const raw: unknown = await Bun.file(COMPONENTS_MANIFEST_PATH).json();
  if (!isPackageManifest(raw)) {
    throw new ComponentDocumentationError(
      'malformed-components-manifest',
      'packages/components/components.json does not match the documentation manifest shape',
    );
  }
  return raw;
}

async function readRequiredText(path: string, label: string): Promise<string> {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    throw new ComponentDocumentationError(
      'missing-required-artifact',
      `${label} is required but was not found at ${path}`,
    );
  }
  return await file.text();
}

async function parseJsonArtifact(path: string, label: string): Promise<JsonValue> {
  let raw: unknown;
  try {
    raw = await Bun.file(path).json();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new ComponentDocumentationError(
      'invalid-json-artifact',
      `${label} at ${path} could not be parsed as JSON: ${detail}`,
    );
  }

  if (!isJsonValue(raw)) {
    throw new ComponentDocumentationError(
      'invalid-json-artifact',
      `${label} at ${path} did not parse as JSON-compatible data`,
    );
  }

  return raw;
}

async function readRequiredJson(path: string, label: string): Promise<JsonValue> {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    throw new ComponentDocumentationError(
      'missing-required-artifact',
      `${label} is required but was not found at ${path}`,
    );
  }
  return await parseJsonArtifact(path, label);
}

async function readOptionalJson(path: string, label: string): Promise<JsonValue | null> {
  const file = Bun.file(path);
  if (!(await file.exists())) return null;
  return await parseJsonArtifact(path, label);
}

function artifactPath(componentName: string, artifactName: DocumentationArtifactName): string {
  return join(COMPONENTS_SOURCE_ROOT, componentName, `${componentName}.${artifactName}.json`);
}

function readmePath(componentName: string): string {
  return join(COMPONENTS_SOURCE_ROOT, componentName, 'README.md');
}

const generatedRegionPattern =
  /^<!-- generated:(props|variables|subcomponents):start -->\n?([\s\S]*?)^<!-- generated:\1:end -->\n?/gm;
const inlineCodeSpanPattern = /(`+[^`\n]*?`+)/g;
const htmlLikeTagPattern =
  /<\/?[A-Za-z][A-Za-z0-9.-]*(?:\s+[A-Za-z_:][A-Za-z0-9_:.-]*(?:=(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*\s*\/?>/g;
const unsafeHtmlTagNamePattern = /^<\/?\s*(?:script|iframe|object|embed|style|link|meta|img)\b/i;
const unsafeHtmlAttributePattern = /\son[a-z]+\s*=|javascript\s*:/i;

function escapeHtmlToken(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeSafeGeneratedTagReferences(value: string): string {
  return value.replace(htmlLikeTagPattern, (tag) => {
    if (unsafeHtmlTagNamePattern.test(tag) || unsafeHtmlAttributePattern.test(tag)) return tag;
    return escapeHtmlToken(tag);
  });
}

function escapeGeneratedRegionMarkdown(value: string): string {
  return value
    .split(inlineCodeSpanPattern)
    .map((segment, index) =>
      index % 2 === 1 ? segment : escapeSafeGeneratedTagReferences(segment),
    )
    .join('');
}

function normalizeReadmeMarkdownForRendering(markdown: string): string {
  return markdown.replace(generatedRegionPattern, (_match, _regionName: string, content: string) =>
    escapeGeneratedRegionMarkdown(content),
  );
}

export function renderReadmeDocumentation(rawMarkdown: string): DocumentationReadme {
  const rendered = renderMarkdown(normalizeReadmeMarkdownForRendering(rawMarkdown));
  return {
    rawMarkdown: rendered.rawMarkdown,
    html: rendered.html,
    codeBlocks: rendered.codeBlocks,
    hadUnsafeContent: rendered.hadUnsafeContent,
  };
}

function toComponentSummary(
  entry: PackageComponentEntry,
  packageManifest: PackageManifest,
): DocumentationComponentSummary {
  const category = packageManifest.categories[entry.category];
  const statusDescription = packageManifest.statusLevels[entry.status];
  return {
    id: entry.id,
    name: entry.name,
    importSpecifier: entry.import,
    exportName: entry.exportName,
    category: entry.category,
    categoryLabel: category?.label ?? entry.category,
    categoryDescription: category?.description ?? '',
    status: entry.status,
    statusDescription: statusDescription ?? '',
    purpose: entry.purpose,
    tags: entry.tags,
    useWhen: entry.useWhen,
    avoidWhen: entry.avoidWhen,
    related: entry.related,
    hasConstraints: entry.hasConstraints,
    hasExamples: entry.hasExamples,
    artifacts: entry.artifacts,
  };
}

/**
 * Build the playground's canonical documentation payload for one component.
 *
 * The package manifest and generated sidecars stay the source of truth; this
 * helper only assembles them into the reader-facing shape consumed by the
 * playground route and component page.
 */
export async function buildComponentDocumentation(
  componentName: string,
  propsManifest: ComponentManifest,
): Promise<ComponentDocumentationPayload> {
  const packageManifest = await loadPackageManifestForDocumentation();
  const entry = packageManifest.components.find((component) => component.id === componentName);
  if (entry === undefined) {
    throw new ComponentDocumentationError(
      'unknown-component',
      `Component "${componentName}" is not listed in packages/components/components.json`,
    );
  }

  const readmeMarkdown = await readRequiredText(
    readmePath(componentName),
    `${componentName} README.md`,
  );
  const readme = renderReadmeDocumentation(readmeMarkdown);
  const schema = await readRequiredJson(
    artifactPath(componentName, 'schema'),
    `${componentName} schema`,
  );
  const variables = await readRequiredJson(
    artifactPath(componentName, 'variables'),
    `${componentName} variables`,
  );
  const constraints = entry.hasConstraints
    ? await readRequiredJson(
        artifactPath(componentName, 'constraints'),
        `${componentName} constraints`,
      )
    : await readOptionalJson(
        artifactPath(componentName, 'constraints'),
        `${componentName} constraints`,
      );
  const examples = entry.hasExamples
    ? await readRequiredJson(artifactPath(componentName, 'examples'), `${componentName} examples`)
    : await readOptionalJson(artifactPath(componentName, 'examples'), `${componentName} examples`);
  const manifestEntry: JsonValue = {
    name: entry.name,
    id: entry.id,
    import: entry.import,
    exportName: entry.exportName,
    category: entry.category,
    status: entry.status,
    purpose: entry.purpose,
    tags: entry.tags,
    useWhen: entry.useWhen,
    avoidWhen: entry.avoidWhen,
    related: entry.related,
    hasConstraints: entry.hasConstraints,
    hasExamples: entry.hasExamples,
    artifacts: entry.artifacts,
  };

  return {
    component: toComponentSummary(entry, packageManifest),
    readme,
    propsManifest,
    schema,
    variables,
    constraints,
    examples,
    rawArtifacts: {
      manifestEntry,
      schema,
      variables,
      constraints,
      examples,
    },
  };
}

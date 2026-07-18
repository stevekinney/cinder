import { join, posix } from 'node:path';

import { initializeHighlighter, renderMarkdown } from '@cinder/markdown/rendering';

import { isA11yMetadata, isAvoidWhenArray } from './component-documentation-guards.ts';
import type {
  A11yMetadata,
  AvoidWhenEntry,
  ComponentDocumentationPayload,
  DocumentationComponentSummary,
  DocumentationReadme,
  JsonValue,
} from './component-documentation-types.ts';
import { CINDER_COMPONENT_SOURCE, type ComponentSource } from './component-sources.ts';
import { discoverComponents } from './discover.ts';
import { repositorySourceHref, rewriteRelativeRenderedMarkdownLinks } from './repository-links.ts';
import type { ComponentManifest } from './types.ts';

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
  avoidWhen: AvoidWhenEntry[];
  related: string[];
  hasConstraints: boolean;
  hasExamples: boolean;
  artifacts: {
    schema: string;
    variables: string;
    examples?: string;
    constraints?: string;
  };
  a11y?: A11yMetadata;
};

type PackageManifest = {
  package: { version: string };
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
    isAvoidWhenArray(value['avoidWhen']) &&
    isStringArray(value['related']) &&
    typeof value['hasConstraints'] === 'boolean' &&
    typeof value['hasExamples'] === 'boolean' &&
    isArtifactSpecifiers(value['artifacts']) &&
    (value['a11y'] === undefined || isA11yMetadata(value['a11y']))
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

function isPackageMetadata(value: unknown): value is PackageManifest['package'] {
  return isObject(value) && typeof value['version'] === 'string';
}

function isPackageManifest(value: unknown): value is PackageManifest {
  if (!isObject(value)) return false;
  const components = value['components'];
  return (
    isPackageMetadata(value['package']) &&
    Array.isArray(components) &&
    components.every(isPackageComponentEntry) &&
    isCategoryMap(value['categories']) &&
    isStatusMap(value['statusLevels'])
  );
}

export async function loadPackageManifestForDocumentation(
  componentSource: ComponentSource = CINDER_COMPONENT_SOURCE,
): Promise<PackageManifest> {
  const raw: unknown = await Bun.file(componentSource.manifestPath).json();
  if (!isPackageManifest(raw)) {
    throw new ComponentDocumentationError(
      'malformed-components-manifest',
      `${componentSource.manifestPath} does not match the documentation manifest shape`,
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

function artifactPath(
  componentSource: ComponentSource,
  componentName: string,
  artifactName: DocumentationArtifactName,
): string {
  return join(
    componentSource.componentsRoot,
    componentName,
    `${componentName}.${artifactName}.json`,
  );
}

function readmePath(componentSource: ComponentSource, componentName: string): string {
  return join(componentSource.componentsRoot, componentName, 'README.md');
}

const generatedRegionPattern =
  /^<!-- generated:(props|variables|subcomponents):start -->\n?([\s\S]*?)^<!-- generated:\1:end -->\n?/gm;
const inlineCodeSpanPattern = /(`+[^`\n]*?`+)/g;
const htmlLikeTagPattern =
  /<\/?[A-Za-z][A-Za-z0-9.-]*(?:\s+[A-Za-z_:][A-Za-z0-9_:.-]*(?:=(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*\s*\/?>/g;

function escapeHtmlToken(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeGeneratedTagReferences(value: string): string {
  return value.replace(htmlLikeTagPattern, (tag) => escapeHtmlToken(tag));
}

function escapeGeneratedRegionMarkdown(value: string): string {
  return value
    .split(inlineCodeSpanPattern)
    .map((segment, index) => (index % 2 === 1 ? segment : escapeGeneratedTagReferences(segment)))
    .join('');
}

function normalizeReadmeMarkdownForRendering(markdown: string): string {
  return markdown.replace(generatedRegionPattern, (_match, _regionName: string, content: string) =>
    escapeGeneratedRegionMarkdown(content),
  );
}

// A generated reference section in the README: its `##`/`###` heading plus the
// generated region that follows it. The docs page presents this data in its own
// dedicated sections (Props table, etc.), so rendering it again inside the
// Overview prose would duplicate it. Matches the heading line through the end of
// the `<!-- generated:…:end -->` marker (and any blank line after).
const generatedSectionWithHeadingPattern =
  /^#{2,3} [^\n]*\n+<!-- generated:(props|variables|subcomponents):start -->[\s\S]*?<!-- generated:\1:end -->\n*/gm;

// The leading top-level `# <Name>` heading duplicates the hero title on the page,
// so it is dropped from the Overview render.
const leadingTitlePattern = /^#\s+[^\n]*\n+/;

/**
 * Trim the README markdown for the page's **Overview** section: drop the leading
 * `# <Name>` title (the hero already shows it) and the generated reference
 * sections (`## Props` table, `## CSS Variables`, `## Subcomponents`) whose data
 * the page renders in its own dedicated sections. The hand-written prose
 * (Usage, comparisons, etc.) is what remains.
 */
function trimReadmeForOverview(markdown: string): string {
  return markdown.replace(leadingTitlePattern, '').replace(generatedSectionWithHeadingPattern, '');
}

function componentReadmeSourceHref(
  componentSource: ComponentSource,
  componentName: string,
  href: string,
): string {
  return repositorySourceHref(`${componentSource.repositoryComponentsRoot}/${componentName}`, href);
}

function componentReadmeHref(
  componentSource: ComponentSource,
  componentName: string,
  href: string,
  componentIds: ReadonlySet<string>,
): { href: string; attributes: string } {
  const [path = ''] = href.split('#', 2);
  const normalizedPath = posix.normalize(posix.join(componentName, path));
  const match = normalizedPath.match(/^([a-z0-9][a-z0-9-]*)\/README\.md$/);
  if (match?.[1] !== undefined && componentIds.has(match[1])) {
    return { href: `/c/${match[1]}`, attributes: ' target="_top"' };
  }
  return {
    href: componentReadmeSourceHref(componentSource, componentName, href),
    attributes: ' target="_blank" rel="noopener noreferrer"',
  };
}

export function rewriteComponentReadmeLinks(
  html: string,
  componentName: string,
  componentIds: ReadonlySet<string>,
  componentSource: ComponentSource = CINDER_COMPONENT_SOURCE,
): string {
  return rewriteRelativeRenderedMarkdownLinks(html, (href) =>
    componentReadmeHref(componentSource, componentName, href, componentIds),
  );
}

export function renderReadmeDocumentation(rawMarkdown: string): DocumentationReadme {
  const trimmed = trimReadmeForOverview(rawMarkdown);
  const rendered = renderMarkdown(normalizeReadmeMarkdownForRendering(trimmed));
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
    // Library-level version (no per-component version exists). The spec card
    // renders it; it is the version that ships this component.
    packageVersion: packageManifest.package.version,
    ...(entry.a11y !== undefined ? { a11y: entry.a11y } : {}),
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
  packageManifestOverride?: PackageManifest,
  componentSource: ComponentSource = CINDER_COMPONENT_SOURCE,
): Promise<ComponentDocumentationPayload> {
  const packageManifest =
    packageManifestOverride ?? (await loadPackageManifestForDocumentation(componentSource));
  const entry = packageManifest.components.find((component) => component.id === componentName);
  if (entry === undefined) {
    throw new ComponentDocumentationError(
      'unknown-component',
      `Component "${componentName}" is not listed in ${componentSource.manifestPath}`,
    );
  }

  const readmeMarkdownPromise = readRequiredText(
    readmePath(componentSource, componentName),
    `${componentName} README.md`,
  );
  const schemaPromise = readRequiredJson(
    artifactPath(componentSource, componentName, 'schema'),
    `${componentName} schema`,
  );
  const variablesPromise = readRequiredJson(
    artifactPath(componentSource, componentName, 'variables'),
    `${componentName} variables`,
  );
  const constraintsPromise = entry.hasConstraints
    ? readRequiredJson(
        artifactPath(componentSource, componentName, 'constraints'),
        `${componentName} constraints`,
      )
    : readOptionalJson(
        artifactPath(componentSource, componentName, 'constraints'),
        `${componentName} constraints`,
      );
  const examplesPromise = entry.hasExamples
    ? readRequiredJson(
        artifactPath(componentSource, componentName, 'examples'),
        `${componentName} examples`,
      )
    : readOptionalJson(
        artifactPath(componentSource, componentName, 'examples'),
        `${componentName} examples`,
      );

  const [readmeMarkdown, schema, variables, constraints, examples] = await Promise.all([
    readmeMarkdownPromise,
    schemaPromise,
    variablesPromise,
    constraintsPromise,
    examplesPromise,
    initializeHighlighter(),
  ]);
  // README relationships can cross package boundaries (for example Chat's
  // composer popover links to Cinder's CommandMenu). Route every component
  // known to the shared playground internally; only true file links should
  // fall through to a repository URL.
  const componentIds = new Set(await discoverComponents());
  const readme = renderReadmeDocumentation(readmeMarkdown);
  readme.html = rewriteComponentReadmeLinks(
    readme.html,
    componentName,
    componentIds,
    componentSource,
  );
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
    ...(entry.a11y !== undefined ? { a11y: entry.a11y } : {}),
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

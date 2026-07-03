import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { bestPracticeSections } from './best-practices.ts';
import { validateManifest } from './manifest-validation.ts';
import {
  CinderKnowledgeError,
  type BestPracticeSection,
  type BestPracticeTopic,
  type CinderManifest,
  type ComponentComparison,
  type ComponentDetail,
  type ComponentSummary,
  type ListOptions,
  type ManifestComponent,
  type PackageSummary,
  type SearchOptions,
  type SearchResult,
} from './types.ts';

export type {
  BestPracticeSection,
  BestPracticeTopic,
  CinderManifest,
  ComponentComparison,
  ComponentDetail,
  ComponentSummary,
  ListOptions,
  ManifestComponent,
  PackageSummary,
  SearchOptions,
  SearchResult,
};

export { CinderKnowledgeError };

const cliDirectory = dirname(fileURLToPath(import.meta.url));
const defaultPackageRoot = resolve(cliDirectory, '..', '..');
const requireFromCli = createRequire(import.meta.url);

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function tokenize(value: string): string[] {
  return normalize(value)
    .split(/[^a-z0-9]+/u)
    .filter((token) => token.length > 0);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function levenshtein(left: string, right: string): number {
  const rows = Array.from({ length: left.length + 1 }, (_, index) => [index]);
  for (let column = 1; column <= right.length; column += 1) rows[0]![column] = column;

  for (let row = 1; row <= left.length; row += 1) {
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      rows[row]![column] = Math.min(
        rows[row - 1]![column]! + 1,
        rows[row]![column - 1]! + 1,
        rows[row - 1]![column - 1]! + cost,
      );
    }
  }
  return rows[left.length]![right.length]!;
}

function textIncludesToken(value: string, token: string): boolean {
  return normalize(value).includes(token);
}

function componentDirectory(component: ManifestComponent, packageRoot: string): string {
  const suffix = component.import.replace(/^@lostgradient\/cinder\//u, '');
  const segments = suffix.startsWith('experimental/')
    ? ['src', 'components', 'experimental', suffix.replace(/^experimental\//u, '')]
    : ['src', 'components', suffix];
  return join(packageRoot, ...segments);
}

async function readJsonFile(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function loadMetadataJson(
  component: ManifestComponent,
  kind: 'schema' | 'variables',
  packageRoot: string,
): Promise<unknown> {
  const localPath = join(
    componentDirectory(component, packageRoot),
    `${component.id}.${kind}.json`,
  );
  if (existsSync(localPath)) {
    return readJsonFile(localPath);
  }
  throw new CinderKnowledgeError(
    'ARTIFACT_NOT_FOUND',
    `${component.id} does not ship a ${kind} JSON artifact.`,
    [component.id],
  );
}

async function loadJsonArtifact(
  component: ManifestComponent,
  kind: 'examples' | 'constraints',
  packageRoot: string,
): Promise<unknown> {
  const specifier = component.artifacts[kind];
  if (!specifier) {
    throw new CinderKnowledgeError(
      'ARTIFACT_NOT_FOUND',
      `${component.id} does not ship a ${kind} artifact.`,
      [component.id],
    );
  }
  const localPath = join(
    componentDirectory(component, packageRoot),
    `${component.id}.${kind}.json`,
  );
  if (existsSync(localPath)) return readJsonFile(localPath);
  return requireFromCli(specifier);
}

function toSummary(
  component: ManifestComponent,
  overlapFamilies: Record<string, string[]>,
): ComponentSummary {
  return {
    id: component.id,
    name: component.name,
    exportName: component.exportName,
    import: component.import,
    category: component.category,
    status: component.status,
    purpose: component.purpose,
    tags: component.tags,
    useWhen: component.useWhen,
    avoidWhen: component.avoidWhen,
    related: component.related,
    overlapFamilies: Object.entries(overlapFamilies)
      .filter(([, members]) => members.includes(component.id))
      .map(([family]) => family)
      .toSorted(),
    hasExamples: component.hasExamples,
    hasConstraints: component.hasConstraints,
  };
}

export class CinderKnowledge {
  readonly manifest: CinderManifest;
  readonly package: PackageSummary;
  private readonly packageRoot: string;
  private readonly byId: Map<string, ManifestComponent>;

  constructor(manifest: CinderManifest, packageRoot: string = defaultPackageRoot) {
    this.manifest = manifest;
    this.package = {
      name: manifest.package.name,
      version: manifest.package.version,
    };
    this.packageRoot = packageRoot;
    this.byId = new Map(manifest.components.map((component) => [component.id, component]));
  }

  list(options: ListOptions = {}): ComponentSummary[] {
    this.validateFilters(options);
    return this.manifest.components
      .filter((component) => this.matchesFilters(component, options))
      .map((component) => toSummary(component, this.manifest.overlapFamilies));
  }

  search(query: string, options: SearchOptions = {}): SearchResult[] {
    const tokens = tokenize(query);
    if (tokens.length === 0) {
      throw new CinderKnowledgeError('BAD_QUERY', 'Search query must contain at least one token.');
    }
    this.validateFilters(options);
    const limit = options.limit ?? 10;
    return this.manifest.components
      .filter((component) => this.matchesFilters(component, options))
      .map((component) => this.scoreComponent(component, query, tokens))
      .filter((result) => result.score > 0)
      .toSorted((left, right) => right.score - left.score || left.id.localeCompare(right.id))
      .slice(0, limit);
  }

  async show(idOrName: string): Promise<ComponentDetail> {
    const component = this.findComponent(idOrName);
    const detail: ComponentDetail = {
      component,
      overlapFamilies: toSummary(component, this.manifest.overlapFamilies).overlapFamilies,
      schema: await loadMetadataJson(component, 'schema', this.packageRoot),
      variables: await loadMetadataJson(component, 'variables', this.packageRoot),
    };
    if (component.hasExamples) {
      detail.examples = await loadJsonArtifact(component, 'examples', this.packageRoot);
    }
    if (component.hasConstraints) {
      detail.constraints = await loadJsonArtifact(component, 'constraints', this.packageRoot);
    }
    return detail;
  }

  compare(idsOrNames: string[]): ComponentComparison {
    if (idsOrNames.length < 2) {
      throw new CinderKnowledgeError(
        'BAD_COMPARE',
        'Compare requires at least two component ids.',
        this.manifest.components.slice(0, 5).map((component) => component.id),
      );
    }
    const components = idsOrNames.map((id) =>
      toSummary(this.findComponent(id), this.manifest.overlapFamilies),
    );
    const componentIds = new Set(components.map((component) => component.id));
    const sharedOverlapFamilies: Record<string, string[]> = {};
    for (const [family, members] of Object.entries(this.manifest.overlapFamilies)) {
      const selected = members.filter((member) => componentIds.has(member));
      if (selected.length > 1) sharedOverlapFamilies[family] = selected;
    }
    return {
      components,
      sharedOverlapFamilies,
      guidance: [
        'Start with purpose, then use useWhen and avoidWhen as the tiebreaker.',
        'If the components share an overlap family, prefer the component whose avoidWhen entries do not describe your scenario.',
        'When a component has constraints, read them before generating code.',
      ],
    };
  }

  bestPractices(topic: BestPracticeTopic = 'all'): BestPracticeSection[] {
    if (topic === 'all') return Object.values(bestPracticeSections);
    const section = bestPracticeSections[topic];
    if (!section) {
      throw new CinderKnowledgeError('BAD_TOPIC', `Unknown best-practices topic "${topic}".`, [
        'imports',
        'styles',
        'metadata',
        'overlap',
        'all',
      ]);
    }
    return [section];
  }

  async artifact(
    idOrName: string,
    kind: 'schema' | 'variables' | 'examples' | 'constraints',
  ): Promise<unknown> {
    const component = this.findComponent(idOrName);
    if (kind === 'schema' || kind === 'variables') {
      return loadMetadataJson(component, kind, this.packageRoot);
    }
    return loadJsonArtifact(component, kind, this.packageRoot);
  }

  componentIds(): string[] {
    return this.manifest.components.map((component) => component.id);
  }

  suggestComponentIds(value: string, limit = 5): string[] {
    const normalized = normalize(value);
    return this.manifest.components
      .map((component) => ({
        id: component.id,
        distance: levenshtein(normalized, component.id),
        substring:
          component.id.includes(normalized) || normalize(component.name).includes(normalized),
      }))
      .toSorted(
        (left, right) =>
          Number(right.substring) - Number(left.substring) ||
          left.distance - right.distance ||
          left.id.localeCompare(right.id),
      )
      .slice(0, limit)
      .map((component) => component.id);
  }

  private findComponent(idOrName: string): ManifestComponent {
    const normalized = normalize(idOrName);
    const exact = this.byId.get(normalized);
    if (exact) return exact;
    const byExportName = this.manifest.components.find(
      (component) =>
        normalize(component.exportName) === normalized || normalize(component.name) === normalized,
    );
    if (byExportName) return byExportName;
    throw new CinderKnowledgeError(
      'COMPONENT_NOT_FOUND',
      `Unknown Cinder component "${idOrName}".`,
      this.suggestComponentIds(idOrName),
    );
  }

  private validateFilters(options: ListOptions): void {
    if (options.category && !Object.hasOwn(this.manifest.categories, options.category)) {
      throw new CinderKnowledgeError(
        'BAD_CATEGORY',
        `Unknown category "${options.category}".`,
        Object.keys(this.manifest.categories).toSorted(),
      );
    }
    if (options.status && !Object.hasOwn(this.manifest.statusLevels, options.status)) {
      throw new CinderKnowledgeError(
        'BAD_STATUS',
        `Unknown status "${options.status}".`,
        Object.keys(this.manifest.statusLevels).toSorted(),
      );
    }
  }

  private matchesFilters(component: ManifestComponent, options: ListOptions): boolean {
    if (options.category && component.category !== options.category) return false;
    if (options.status && component.status !== options.status) return false;
    if (options.tag && !component.tags.includes(options.tag)) return false;
    return true;
  }

  private scoreComponent(
    component: ManifestComponent,
    query: string,
    tokens: string[],
  ): SearchResult {
    const matched: string[] = [];
    let score = 0;
    const normalizedQuery = normalize(query);
    if (normalizedQuery === component.id || normalizedQuery === normalize(component.exportName)) {
      score += 10_000;
      matched.push('exact');
    }

    const fields: Array<readonly [string, number, string[]]> = [
      ['id', 200, [component.id, component.name, component.exportName]],
      ['tags', 80, component.tags],
      ['category', 60, [component.category, component.status]],
      ['purpose', 40, [component.purpose]],
      ['useWhen', 30, component.useWhen],
      [
        'avoidWhen',
        25,
        component.avoidWhen.map((entry) => `${entry.reason} ${entry.alternative ?? ''}`),
      ],
      ['related', 20, component.related],
    ];

    for (const token of tokens) {
      for (const [field, weight, values] of fields) {
        if (values.some((value) => textIncludesToken(value, token))) {
          score += weight;
          matched.push(field);
        }
      }
      for (const [family, members] of Object.entries(this.manifest.overlapFamilies)) {
        if (family.includes(token) && members.includes(component.id)) {
          score += 35;
          matched.push(`overlap:${family}`);
        } else if (
          members.some((member) => member.includes(token)) &&
          members.includes(component.id)
        ) {
          score += 10;
          matched.push(`overlap:${family}`);
        }
      }
    }

    return {
      ...toSummary(component, this.manifest.overlapFamilies),
      score,
      matched: unique(matched).toSorted(),
    };
  }
}

export async function loadCinderKnowledge(
  packageRoot: string = defaultPackageRoot,
): Promise<CinderKnowledge> {
  const manifest = validateManifest(await readJsonFile(join(packageRoot, 'components.json')));
  return new CinderKnowledge(manifest, packageRoot);
}

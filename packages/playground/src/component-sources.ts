import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

import { DOCUMENTATION_CINDER_COMPONENTS } from './documentation-styles.ts';
import { COMPOUND_COMPONENT_PARENTS } from './shell-app/compound-families.ts';

const PLAYGROUND_ROOT = dirname(import.meta.dirname);
const PACKAGES_ROOT = join(PLAYGROUND_ROOT, '..');

const CHAT_IMPORT_PATHS: Readonly<Record<string, string>> = {
  chat: '@lostgradient/chat',
  'chat-composer-popover': '@lostgradient/chat/composer-popover',
  'chat-conversation-header': '@lostgradient/chat/conversation-header',
  'chat-conversation-list': '@lostgradient/chat/conversation-list',
};
export const CHAT_COMPONENT_NAMES = Object.keys(CHAT_IMPORT_PATHS).toSorted();

const EDITOR_IMPORT_PATHS: Readonly<Record<string, string>> = {
  'markdown-editor': '@lostgradient/editor/markdown-editor',
  'review-editor': '@lostgradient/editor/review-editor',
  'diff-viewer': '@lostgradient/editor/diff-viewer',
};
export const EDITOR_COMPONENT_NAMES = Object.keys(EDITOR_IMPORT_PATHS).toSorted();

/**
 * One published component package represented in the shared playground.
 *
 * Keeping package topology here prevents discovery, documentation, bundling,
 * styles, and browser-test manifests from each growing their own package-name
 * special cases as domain packages are extracted from Cinder.
 */
export type ComponentSource = {
  id: string;
  packageName: string;
  packageRoot: string;
  componentsRoot: string;
  manifestPath: string;
  repositoryComponentsRoot: string;
  componentNames: readonly string[] | null;
  importPath(componentName: string): string;
  componentStylesheetUrl(componentName: string): string | null;
};

const cinderPackageRoot = join(PACKAGES_ROOT, 'components');
const chatPackageRoot = join(PACKAGES_ROOT, 'chat');
const editorPackageRoot = join(PACKAGES_ROOT, 'editor');

export const CINDER_COMPONENT_SOURCE: ComponentSource = {
  id: 'cinder',
  packageName: '@lostgradient/cinder',
  packageRoot: cinderPackageRoot,
  componentsRoot: join(cinderPackageRoot, 'src', 'components'),
  manifestPath: join(cinderPackageRoot, 'components.json'),
  repositoryComponentsRoot: 'packages/components/src/components',
  // The Cinder set is discovered from its large, evolving source tree.
  componentNames: null,
  importPath: (componentName) => `@lostgradient/cinder/${componentName}`,
  // Cinder's full component cascade is already loaded from /styles/all.css.
  componentStylesheetUrl: () => null,
};

const DOCUMENTATION_CINDER_COMPONENT_SET = new Set<string>(DOCUMENTATION_CINDER_COMPONENTS);
const CINDER_COMPONENT_IMPORT = /from\s+['"]@lostgradient\/cinder\/([a-z0-9][a-z0-9-]*)['"]/gu;
const CINDER_ROOT_BARREL_IMPORT = /import\s*\{([^}]+)\}\s*from\s*['"]@lostgradient\/cinder['"]/gu;
const RELATIVE_IMPLEMENTATION_IMPORT = /from\s+['"](\.{1,2}\/[^'"]+\.(?:svelte|ts))['"]/gu;

type CinderManifestComponent = { id?: unknown; exportName?: unknown };
type CinderManifest = { components?: unknown };

function cinderComponentNamesByExport(): ReadonlyMap<string, string> {
  const manifest = JSON.parse(
    readFileSync(join(cinderPackageRoot, 'components.json'), 'utf8'),
  ) as CinderManifest;
  const names = new Map<string, string>();
  if (!Array.isArray(manifest.components)) return names;
  for (const component of manifest.components as CinderManifestComponent[]) {
    if (typeof component.id !== 'string' || typeof component.exportName !== 'string') continue;
    names.set(component.exportName, component.id);
  }
  return names;
}

const CINDER_COMPONENT_NAME_BY_EXPORT = cinderComponentNamesByExport();

function stylesheetOwner(componentName: string): string {
  return COMPOUND_COMPONENT_PARENTS[componentName] ?? componentName;
}

function cinderComponentStylesheetUrl(componentName: string): string | null {
  const owner = stylesheetOwner(componentName);
  if (DOCUMENTATION_CINDER_COMPONENT_SET.has(owner)) return null;
  const stylesheet = join(cinderPackageRoot, 'src', 'components', owner, `${owner}.css`);
  return existsSync(stylesheet) ? `/components/${owner}/${owner}.css` : null;
}

function cinderComponentDependenciesFromSource(source: string, dependencies: Set<string>): void {
  for (const match of source.matchAll(CINDER_COMPONENT_IMPORT)) {
    dependencies.add(match[1]!);
  }
  for (const match of source.matchAll(CINDER_ROOT_BARREL_IMPORT)) {
    for (const importedName of match[1]!.split(',')) {
      const exportName = importedName
        .trim()
        .replace(/^type\s+/u, '')
        .split(/\s+as\s+/u)[0];
      if (exportName === undefined) continue;
      const componentName = CINDER_COMPONENT_NAME_BY_EXPORT.get(exportName);
      if (componentName !== undefined) dependencies.add(componentName);
    }
  }
}

function componentExportName(componentName: string): string {
  return componentName
    .split('-')
    .map((segment) => `${segment[0]?.toUpperCase() ?? ''}${segment.slice(1)}`)
    .join('');
}

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function extractedPackageComponentDependenciesFromSource(
  componentSource: ComponentSource,
  source: string,
  dependencies: Set<string>,
): void {
  if (componentSource.componentNames === null) return;

  for (const componentName of componentSource.componentNames) {
    const importPath = componentSource.importPath(componentName);
    const escapedImportPath = escapeRegularExpression(importPath);
    const namedImportPattern = new RegExp(
      `import\\s*\\{([^}]+)\\}\\s*from\\s*['"]${escapedImportPath}['"]`,
      'gu',
    );

    for (const match of source.matchAll(namedImportPattern)) {
      const importedNames = match[1]!.split(',').map(
        (importedName) =>
          importedName
            .trim()
            .replace(/^type\s+/u, '')
            .split(/\s+as\s+/u)[0],
      );
      if (importedNames.includes(componentExportName(componentName))) {
        dependencies.add(componentName);
      }
    }

    if (importPath !== componentSource.packageName) {
      const directImportPattern = new RegExp(`from\\s*['"]${escapedImportPath}['"]`, 'u');
      if (directImportPattern.test(source)) dependencies.add(componentName);
    }
  }
}

function implementationDependencies(
  componentsRoot: string,
  implementationPath: string,
  dependencies: Set<string>,
  visitedPaths = new Set<string>(),
): void {
  const resolvedPath = resolve(implementationPath);
  const resolvedComponentsRoot = resolve(componentsRoot);
  const pathWithinComponentsRoot = relative(resolvedComponentsRoot, resolvedPath);
  const isOutsideComponentsRoot =
    pathWithinComponentsRoot === '..' ||
    pathWithinComponentsRoot.startsWith(`..${sep}`) ||
    isAbsolute(pathWithinComponentsRoot);
  if (isOutsideComponentsRoot || visitedPaths.has(resolvedPath)) return;
  visitedPaths.add(resolvedPath);
  if (resolvedComponentsRoot === resolve(cinderPackageRoot, 'src', 'components')) {
    const componentName = pathWithinComponentsRoot.split(sep)[0];
    if (componentName !== undefined && componentName !== '') dependencies.add(componentName);
  }
  if (!existsSync(resolvedPath)) return;

  const source = readFileSync(resolvedPath, 'utf8');
  cinderComponentDependenciesFromSource(source, dependencies);
  for (const match of source.matchAll(RELATIVE_IMPLEMENTATION_IMPORT)) {
    implementationDependencies(
      resolvedComponentsRoot,
      resolve(dirname(resolvedPath), match[1]!),
      dependencies,
      visitedPaths,
    );
  }
}

/**
 * Return the stylesheet a documentation page needs in addition to the shared
 * documentation CSS. Cinder primitives rendered by the page itself are
 * already bundled into that shared asset; every other component retains its
 * own sidecar and compound-family imports.
 */
export function documentationComponentStylesheetUrl(
  componentSource: ComponentSource,
  componentName: string,
): string | null {
  if (componentSource.id === CINDER_COMPONENT_SOURCE.id) {
    return cinderComponentStylesheetUrl(componentName);
  }
  return componentSource.componentStylesheetUrl(componentName);
}

/**
 * Resolve styles for every component imported by a documented component's
 * examples. A page can compose an otherwise unrelated primitive (CheckboxGroup's
 * examples render Checkbox, for example), so its own sidecar alone is not
 * enough after removing the global stylesheet.
 */
export function documentationExampleStylesheetUrls(
  componentSource: ComponentSource,
  componentName: string,
  scenarios: readonly string[],
): string[] {
  const cinderDependencyNames = new Set<string>();
  const packageDependencyNames = new Set<string>([componentName]);
  for (const scenario of scenarios) {
    const examplePath = join(
      PLAYGROUND_ROOT,
      'src',
      'examples',
      componentName,
      `${scenario}.example.svelte`,
    );
    const source = readFileSync(examplePath, 'utf8');
    cinderComponentDependenciesFromSource(source, cinderDependencyNames);
    extractedPackageComponentDependenciesFromSource(
      componentSource,
      source,
      packageDependencyNames,
    );
  }

  if (componentSource.id === CINDER_COMPONENT_SOURCE.id) {
    cinderDependencyNames.add(componentName);
  }
  implementationDependencies(
    componentSource.componentsRoot,
    join(componentSource.componentsRoot, componentName, `${componentName}.svelte`),
    cinderDependencyNames,
  );

  // Examples can import a Cinder component whose implementation composes more
  // primitives. Iterating the growing Set follows that complete graph instead
  // of stopping at the example's direct import (for example, ConfirmDialog →
  // Modal on Card's danger-zone examples).
  const visitedImplementationPaths = new Set<string>();
  for (const dependencyName of cinderDependencyNames) {
    implementationDependencies(
      CINDER_COMPONENT_SOURCE.componentsRoot,
      join(CINDER_COMPONENT_SOURCE.componentsRoot, dependencyName, `${dependencyName}.svelte`),
      cinderDependencyNames,
      visitedImplementationPaths,
    );
  }

  const cinderStylesheetUrls = [...cinderDependencyNames]
    .toSorted()
    .map(cinderComponentStylesheetUrl)
    .filter((stylesheetUrl): stylesheetUrl is string => stylesheetUrl !== null);
  const packageStylesheetUrls =
    componentSource.id === CINDER_COMPONENT_SOURCE.id
      ? []
      : [...packageDependencyNames]
          .toSorted()
          .map(componentSource.componentStylesheetUrl)
          .filter((stylesheetUrl): stylesheetUrl is string => stylesheetUrl !== null);

  return [...cinderStylesheetUrls, ...packageStylesheetUrls].filter(
    (stylesheetUrl, index, urls) => urls.indexOf(stylesheetUrl) === index,
  );
}

export const CHAT_COMPONENT_SOURCE: ComponentSource = {
  id: 'chat',
  packageName: '@lostgradient/chat',
  packageRoot: chatPackageRoot,
  componentsRoot: join(chatPackageRoot, 'src', 'lib', 'components'),
  manifestPath: join(chatPackageRoot, 'components.json'),
  repositoryComponentsRoot: 'packages/chat/src/lib/components',
  componentNames: CHAT_COMPONENT_NAMES,
  importPath(componentName) {
    const importPath = CHAT_IMPORT_PATHS[componentName];
    if (importPath === undefined) {
      throw new Error(
        `[playground] ${componentName} was discovered in @lostgradient/chat but has no public import path`,
      );
    }
    return importPath;
  },
  componentStylesheetUrl: (componentName) =>
    `/package-components/chat/${componentName}/${componentName}.css`,
};

type EditorPackageManifest = { exports?: Record<string, unknown> };

const editorPackageManifest: EditorPackageManifest = JSON.parse(
  readFileSync(join(editorPackageRoot, 'package.json'), 'utf8'),
);
const editorExportKeys = new Set(Object.keys(editorPackageManifest.exports ?? {}));

/**
 * Resolve a component's CSS-sidecar route from Editor's real `exports` map,
 * rather than a hardcoded per-component allowlist. `exportKeys` is injected
 * so this generalizes beyond the one styles export the real manifest has
 * today — see `component-sources.test.ts`.
 */
export function resolveEditorStylesheetUrl(
  exportKeys: ReadonlySet<string>,
  componentName: string,
): string | null {
  return exportKeys.has(`./${componentName}/styles`)
    ? `/package-components/editor/${componentName}/${componentName}.css`
    : null;
}

export const EDITOR_COMPONENT_SOURCE: ComponentSource = {
  id: 'editor',
  packageName: '@lostgradient/editor',
  packageRoot: editorPackageRoot,
  componentsRoot: join(editorPackageRoot, 'src', 'lib', 'components'),
  manifestPath: join(editorPackageRoot, 'components.json'),
  repositoryComponentsRoot: 'packages/editor/src/lib/components',
  componentNames: EDITOR_COMPONENT_NAMES,
  importPath(componentName) {
    const importPath = EDITOR_IMPORT_PATHS[componentName];
    if (importPath === undefined) {
      throw new Error(
        `[playground] ${componentName} was discovered in @lostgradient/editor but has no public import path`,
      );
    }
    return importPath;
  },
  // Unlike Chat, Editor's three components don't uniformly ship a standalone
  // CSS sidecar: `markdown-editor` and `diff-viewer` style entirely through
  // scoped `<style>` blocks compiled inline by Svelte (matching their
  // pre-move shape in cinder). Read from the package's real `exports` map
  // (below) rather than hardcoding which components have a sidecar, so this
  // stays correct as Editor's own `package.json` grows more styles exports.
  componentStylesheetUrl: (componentName) =>
    resolveEditorStylesheetUrl(editorExportKeys, componentName),
};

/** Ordered, canonical list of packages represented in the playground. */
export const COMPONENT_SOURCES: readonly ComponentSource[] = [
  CINDER_COMPONENT_SOURCE,
  CHAT_COMPONENT_SOURCE,
  EDITOR_COMPONENT_SOURCE,
];

/** Resolve a configured package source by its stable route identifier. */
export function componentSourceById(sourceId: string): ComponentSource | undefined {
  return COMPONENT_SOURCES.find((source) => source.id === sourceId);
}

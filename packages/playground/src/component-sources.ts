import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { DOCUMENTATION_CINDER_COMPONENTS } from './documentation-styles.ts';

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

function cinderComponentStylesheetUrl(componentName: string): string | null {
  if (DOCUMENTATION_CINDER_COMPONENT_SET.has(componentName)) return null;
  const stylesheet = join(
    cinderPackageRoot,
    'src',
    'components',
    componentName,
    `${componentName}.css`,
  );
  return existsSync(stylesheet) ? `/components/${componentName}/${componentName}.css` : null;
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
 * Resolve styles for every Cinder component imported by a documented
 * component's examples. A page can compose an otherwise unrelated primitive
 * (CheckboxGroup's examples render Checkbox, for example), so its own
 * sidecar alone is not enough after removing the global stylesheet.
 */
export function documentationExampleStylesheetUrls(
  componentName: string,
  scenarios: readonly string[],
): string[] {
  const dependencyNames = new Set<string>();
  for (const scenario of scenarios) {
    const examplePath = join(
      PLAYGROUND_ROOT,
      'src',
      'examples',
      componentName,
      `${scenario}.example.svelte`,
    );
    const source = readFileSync(examplePath, 'utf8');
    for (const match of source.matchAll(CINDER_COMPONENT_IMPORT)) {
      dependencyNames.add(match[1]!);
    }
  }

  const componentStylesheet = cinderComponentStylesheetUrl(componentName);
  return [
    ...[...dependencyNames]
      .filter((dependencyName) => dependencyName !== componentName)
      .toSorted()
      .map(cinderComponentStylesheetUrl)
      .filter((stylesheetUrl): stylesheetUrl is string => stylesheetUrl !== null),
    ...(componentStylesheet === null ? [] : [componentStylesheet]),
  ];
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

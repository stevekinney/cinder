import { dirname, join } from 'node:path';

const PLAYGROUND_ROOT = dirname(import.meta.dirname);
const PACKAGES_ROOT = join(PLAYGROUND_ROOT, '..');

const CHAT_IMPORT_PATHS: Readonly<Record<string, string>> = {
  chat: '@lostgradient/chat',
  'chat-composer-popover': '@lostgradient/chat/composer-popover',
  'chat-conversation-header': '@lostgradient/chat/conversation-header',
  'chat-conversation-list': '@lostgradient/chat/conversation-list',
};
export const CHAT_COMPONENT_NAMES = Object.keys(CHAT_IMPORT_PATHS).sort();

const EDITOR_IMPORT_PATHS: Readonly<Record<string, string>> = {
  'markdown-editor': '@lostgradient/editor/markdown-editor',
  'review-editor': '@lostgradient/editor/review-editor',
  'diff-viewer': '@lostgradient/editor/diff-viewer',
};
export const EDITOR_COMPONENT_NAMES = Object.keys(EDITOR_IMPORT_PATHS).sort();

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
  // pre-move shape in cinder), and `packages/editor/package.json` only
  // declares a `./review-editor/styles` export. Returning a URL for the
  // other two 404s — `static-export.ts` crawls every referenced `href` and
  // throws on a non-OK response — so gate on the one component that actually
  // has a sidecar.
  componentStylesheetUrl: (componentName) =>
    componentName === 'review-editor'
      ? `/package-components/editor/${componentName}/${componentName}.css`
      : null,
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

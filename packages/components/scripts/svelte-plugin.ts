import { sveltePlugin as createUpstreamSveltePlugin } from '@lostgradient/bun-plugin-svelte';
import type { BunPlugin } from 'bun';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { compile, parse } from 'svelte/compiler';
import ts from 'typescript';

type GenerationTarget = 'client' | 'server';

export type ServerComponentBoundary = {
  column: number;
  index: number;
  line: number;
};

/**
 * Components allowed to compile a real `<style>` block instead of routing
 * styles through `src/styles/`.
 *
 * This is NOT dead code, even though none of these four names are directories
 * under `packages/components/src/components` — `allowsStyleBlock`'s path
 * match is package-agnostic (it matches the first path segment under any
 * `.../components/<name>/` directory), and this file is imported
 * cross-package by `packages/chat/scripts/{build,preload,validate-consumer}.ts`
 * and `packages/editor/scripts/{build,preload,validate-consumer}.ts`. So these
 * names protect live components in THOSE packages' own `src/lib/components/`
 * trees: `packages/chat/src/lib/components/chat/**` (e.g. `chat.svelte`,
 * `chat-message.svelte`) and `packages/editor/src/lib/components/
 * {diff-viewer,markdown-editor,review-editor}/**` (e.g. `diff-viewer.svelte`,
 * `review-editor-impl.svelte`) — dozens of files, confirmed non-empty
 * `<style>` blocks as of this comment. `source-diff-viewer`, the surviving
 * `packages/components` name closest to `diff-viewer`, needs no entry here:
 * it has no `<style>` block.
 */
const DOMAIN_SUITE_STYLE_COMPONENTS = new Set([
  'chat',
  'diff-viewer',
  'markdown-editor',
  'review-editor',
]);

/**
 * Whether `name` is one of the domain-suite components allowed to carry a
 * real `<style>` block (see {@link DOMAIN_SUITE_STYLE_COMPONENTS}). Exported
 * so `build.ts` can assert the converse invariant for its OWN package: a
 * `packages/components` component may not both be named here and ship a
 * generated CSS sidecar (`css-import-plugin.ts`) — that combination would
 * give it two independent CSS delivery paths with no obvious cascade winner.
 */
export function isDomainSuiteStyleComponentName(name: string): boolean {
  return DOMAIN_SUITE_STYLE_COMPONENTS.has(name);
}

const PUBLISHED_PACKAGE_SOURCE_MAPPINGS = [
  {
    publishedSourcePrefix: 'node_modules/@lostgradient/cinder/',
    workspaceSourceMarker: '/packages/components/',
  },
  {
    publishedSourcePrefix: 'node_modules/@lostgradient/chat/dist/',
    workspaceSourceMarker: '/packages/chat/src/lib/',
  },
  {
    publishedSourcePrefix: 'node_modules/@lostgradient/editor/dist/',
    workspaceSourceMarker: '/packages/editor/src/lib/',
  },
] as const;

/**
 * Give authored package components the same filename in workspace builds that
 * Vite gives their published source. Svelte's default scoped-CSS hash includes
 * the compiler filename, so an absolute checkout path in `dist/server` and the
 * package-relative client source path otherwise produce different class names
 * and cannot hydrate each other.
 */
export function publishedSvelteCompileFilename(filePath: string): string {
  const normalizedPath = filePath.replaceAll('\\', '/');
  for (const {
    publishedSourcePrefix,
    workspaceSourceMarker,
  } of PUBLISHED_PACKAGE_SOURCE_MAPPINGS) {
    const installedSourceMarker = `/${publishedSourcePrefix}`;
    const installedSourceIndex = normalizedPath.lastIndexOf(installedSourceMarker);
    if (installedSourceIndex >= 0) {
      return normalizedPath.slice(installedSourceIndex + 1);
    }

    const workspaceSourceIndex = normalizedPath.lastIndexOf(workspaceSourceMarker);
    if (workspaceSourceIndex >= 0) {
      return `${publishedSourcePrefix}${normalizedPath.slice(
        workspaceSourceIndex + workspaceSourceMarker.length,
      )}`;
    }
  }

  return filePath;
}

export function allowsStyleBlock(path: string): boolean {
  const normalizedPath = path.replaceAll('\\', '/');

  // Playground chrome is not part of the design-system cascade — the no-style
  // rule exists to keep the shipped component library on a single CSS surface.
  // Files under packages/playground/ are dev-only scaffolding and may co-locate
  // their styles with their markup.
  if (normalizedPath.includes('/packages/playground/')) return true;
  // Test fixtures are not published package components or part of the public
  // cascade. Allow them to keep scoped styles local to the fixture.
  if (normalizedPath.includes('/packages/components/src/test/fixtures/')) return true;
  // Visual-regression fixture hosts colocated with their component
  // (`src/components/<name>/<name>.fixture.svelte`, e.g. `accordion.fixture.svelte`)
  // are dev-only mounting scaffolding for Playwright/visual fixtures and are
  // never shipped in dist — same rationale as the `/test/fixtures/` carve-out
  // above, extended to this established naming convention (`extract-fixtures.ts`
  // already requires fixture hosts to end in `.fixture.svelte`).
  if (/\/src\/components\/[^/]+\/[^/]+\.fixture\.svelte$/.test(normalizedPath)) return true;

  const componentPathMatch = normalizedPath.match(
    /\/(?:src\/(?:lib\/)?|dist\/)components\/([^/]+)(?:\/|\.svelte$)/,
  );
  const componentName = componentPathMatch?.[1];
  return componentName !== undefined && DOMAIN_SUITE_STYLE_COMPONENTS.has(componentName);
}

export function hasAuthoredStyleBlock(source: string): boolean {
  const ast = parse(source, { modern: true });
  return isNodeStyleSheet(ast.css);
}

function isNodeStyleSheet(value: unknown): boolean {
  return Boolean(
    value && typeof value === 'object' && (value as { type?: unknown }).type === 'StyleSheet',
  );
}

function hasModifier(
  node: ts.Node & { modifiers?: ts.NodeArray<ts.ModifierLike> },
  kind: ts.SyntaxKind,
): boolean {
  return node.modifiers?.some((modifier) => modifier.kind === kind) ?? false;
}

function isServerComponentBoundaryCall(node: ts.CallExpression): boolean {
  const [firstArgument] = node.arguments;
  return (
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === 'component' &&
    node.arguments.length === 1 &&
    firstArgument !== undefined &&
    (ts.isArrowFunction(firstArgument) || ts.isFunctionExpression(firstArgument))
  );
}

function findDefaultComponentFunction(
  sourceFile: ts.SourceFile,
): ts.FunctionDeclaration | undefined {
  let defaultExportName: string | undefined;

  for (const statement of sourceFile.statements) {
    if (
      ts.isFunctionDeclaration(statement) &&
      statement.name !== undefined &&
      hasModifier(statement, ts.SyntaxKind.ExportKeyword) &&
      hasModifier(statement, ts.SyntaxKind.DefaultKeyword)
    ) {
      return statement;
    }

    if (ts.isExportAssignment(statement) && ts.isIdentifier(statement.expression)) {
      defaultExportName = statement.expression.text;
    }
  }

  if (defaultExportName === undefined) return undefined;

  return sourceFile.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === defaultExportName,
  );
}

function parseJavaScript(source: string, fileName: string): ts.SourceFile {
  return ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
}

const COMPONENT_BOUNDARY_TOKEN = /\.\s*component\s*\(/;

export function findOneArgumentServerComponentBoundaries(
  source: string,
  fileName = 'component.js',
): ServerComponentBoundary[] {
  if (!COMPONENT_BOUNDARY_TOKEN.test(source)) return [];

  const sourceFile = parseJavaScript(source, fileName);
  const boundaries: ServerComponentBoundary[] = [];

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node) && isServerComponentBoundaryCall(node)) {
      const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      boundaries.push({
        column: position.character + 1,
        index: node.getStart(sourceFile),
        line: position.line + 1,
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return boundaries;
}

export function preserveServerComponentIdentity(source: string, fileName = 'component.js'): string {
  const sourceFile = parseJavaScript(source, fileName);
  const componentFunction = findDefaultComponentFunction(sourceFile);
  const componentName = componentFunction?.name?.text;
  if (componentFunction?.body === undefined || componentName === undefined) return source;

  const insertionIndexes: number[] = [];

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node) && isServerComponentBoundaryCall(node)) {
      const firstArgument = node.arguments[0];
      if (firstArgument !== undefined) insertionIndexes.push(firstArgument.getEnd());
    }

    ts.forEachChild(node, visit);
  }

  visit(componentFunction.body);

  if (insertionIndexes.length === 0) return source;

  let transformedSource = source;
  // Do not use Array.prototype.toSorted(): the package targets ES2022.
  const sortedInsertionIndexes = Array.from(insertionIndexes);
  sortedInsertionIndexes.sort((left, right) => right - left);
  for (const insertionIndex of sortedInsertionIndexes) {
    transformedSource =
      transformedSource.slice(0, insertionIndex) +
      `, ${componentName}` +
      transformedSource.slice(insertionIndex);
  }
  return transformedSource;
}

function isPlaygroundPath(path: string): boolean {
  return path.replaceAll('\\', '/').includes('/packages/playground/');
}

/**
 * Compile a `.svelte` file directly instead of delegating to
 * `@lostgradient/bun-plugin-svelte`, for the two cases the published plugin's
 * public options have no hook for:
 *
 * - Playground dev-only chrome always gets its styles injected into the
 *   compiled output, independent of `injectCss` — it is not part of the
 *   design-system cascade `injectCss` otherwise governs, and would render
 *   unstyled on first paint (client mount or SSR `head`) otherwise.
 * - Production server compiles (`generate: 'server'`, `NODE_ENV=production`)
 *   need `$$renderer.component()` calls to carry the compiled component's
 *   identity as a second argument (`preserveServerComponentIdentity`) — a
 *   Cinder-specific SSR fix (see its doc comment) with no equivalent in the
 *   published plugin, which exposes no hook to transform compiled output
 *   before Bun consumes it.
 *
 * Neither case needs the CSS-sidecar virtual-module registry the published
 * plugin owns (`emitCss` is only ever true for non-server `'external'` mode,
 * which cinder never uses), so compiling them directly here needs no extra
 * plumbing.
 */
function compileWithCinderPolicy(
  source: string,
  path: string,
  generate: GenerationTarget,
  injectCss: boolean,
  dev: boolean,
): { contents: string; loader: 'js'; resolveDir: string } {
  const css = isPlaygroundPath(path) || injectCss ? 'injected' : 'external';
  const compileResult = compile(source, {
    filename: publishedSvelteCompileFilename(path),
    generate,
    css,
    dev,
  });
  const contents =
    generate === 'server' && !dev
      ? preserveServerComponentIdentity(compileResult.js.code, path)
      : compileResult.js.code;
  return { contents, loader: 'js', resolveDir: dirname(path) };
}

/**
 * Bun plugin that compiles Svelte 5 `.svelte` components and `.svelte.(js|ts)`
 * rune modules, wrapping `@lostgradient/bun-plugin-svelte` with Cinder-only
 * policy:
 *
 * - Rejects any component that carries a `<style>` block, except for files
 *   under `packages/playground/`, test/visual-regression fixtures (see
 *   {@link allowsStyleBlock}), and the domain-suite components allowlisted
 *   above. Styles belong in `src/styles/` so the design system has a single
 *   CSS cascade surface.
 * - `generate`: chooses client-side or server-side rendering output, passed
 *   straight through.
 * - `injectCss`: when `true`, every component injects its CSS into the JS
 *   bundle (`css: 'injected'`) — used by the playground server so domain-suite
 *   components get their scoped styles applied. When `false` (default),
 *   library components compile with `css: 'none'`: scoped class names, CSS
 *   discarded — Cinder's own `css-import-plugin.ts` sidecar system owns
 *   delivering their styles, so the published plugin never emits a stylesheet
 *   that would duplicate it.
 * - The two cases above the published plugin cannot express are compiled
 *   directly by {@link compileWithCinderPolicy}; every other `.svelte` file
 *   and every `.svelte.(js|ts)` rune module delegates to
 *   `@lostgradient/bun-plugin-svelte`.
 */
export function sveltePlugin(
  options: { generate: GenerationTarget; injectCss?: boolean } = {
    generate: 'client',
  },
): BunPlugin {
  const injectCss = options.injectCss ?? false;
  const dev = process.env['NODE_ENV'] !== 'production';
  const upstreamPlugin = createUpstreamSveltePlugin({
    generate: options.generate,
    css: injectCss ? 'injected' : 'none',
    compileFilename: publishedSvelteCompileFilename,
    // Cinder never wired up Svelte's HMR runtime (no `[serve.static]` bunfig
    // registration, no `Bun.serve({ development: { hmr: true } })`) — the
    // playground's dev server rebuilds and re-serves per request instead.
    // Force this off rather than let it default to `dev`, so compiled output
    // stays exactly what it was before this migration in every dev-mode
    // pipeline (test preloads, `validate:consumer`, the playground server).
    hmr: false,
  });

  return {
    name: `svelte-${options.generate}`,
    setup(builder) {
      if (options.generate === 'server') {
        builder.onResolve({ filter: /^\.\.?\/.*\.svelte$/ }, (args) => {
          const candidate = resolve(args.resolveDir || dirname(args.importer), args.path);
          return existsSync(candidate) ? { path: candidate } : undefined;
        });
      }

      // `@lostgradient/bun-plugin-svelte`'s own `.svelte` component compiler
      // must not be registered on `builder` directly: cinder's policy check
      // has to run first and, for two cases (below), replace the compile
      // entirely, which would normally mean registering a second `onLoad` for
      // the same filter and returning `undefined` to fall through to this
      // one. That works under `Bun.build()`, but NOT under the runtime
      // `Bun.plugin()` loader every package's `scripts/preload.ts` uses for
      // `bun test` — there, an `onLoad` callback that returns `undefined`
      // throws `TypeError: onLoad() expects an object returned` instead of
      // trying the next registered handler (verified against Bun 1.3.13).
      // So this captures the upstream component-compile callback instead of
      // registering it, and cinder's own `onLoad` below calls it directly —
      // the only `.svelte` `onLoad` ever registered on the real builder.
      let componentLoader: Bun.OnLoadCallback | undefined;
      // Minimal test stubs (see components.test.ts) only implement `onLoad`.
      // Bun's own real builder always has the rest of `PluginBuilder`, and
      // cinder's `css` values (`'injected'` / `'none'`) never trigger the
      // upstream plugin's `onStart`/`onEnd`/`onBeforeParse`/`module` hooks or
      // its virtual-CSS `onResolve`, so a no-op fallback is never a
      // functional loss even when it IS the real builder.
      let bridgeBuilder: Bun.PluginBuilder;
      bridgeBuilder = {
        onStart: (callback) =>
          typeof builder.onStart === 'function' ? builder.onStart(callback) : bridgeBuilder,
        onEnd: (callback) =>
          typeof builder.onEnd === 'function' ? builder.onEnd(callback) : bridgeBuilder,
        onBeforeParse: (constraints, callback) =>
          typeof builder.onBeforeParse === 'function'
            ? builder.onBeforeParse(constraints, callback)
            : bridgeBuilder,
        onResolve: (constraints, callback) =>
          typeof builder.onResolve === 'function'
            ? builder.onResolve(constraints, callback)
            : bridgeBuilder,
        module: (specifier, callback) =>
          typeof builder.module === 'function'
            ? builder.module(specifier, callback)
            : bridgeBuilder,
        onLoad: (matcher, callback) => {
          // The component filter (`.svelte$`) matches a bare `.svelte` path;
          // the rune-module filter (`.svelte.(js|ts)$`) does not — register
          // everything else (rune modules, the virtual CSS resolver/loader)
          // on the real builder unchanged.
          if (matcher.filter.test('cinder-bridge-probe.svelte')) {
            componentLoader = callback;
            return bridgeBuilder;
          }
          return builder.onLoad(matcher, callback);
        },
        get config() {
          return builder.config;
        },
      };
      void upstreamPlugin.setup(bridgeBuilder);
      if (componentLoader === undefined) {
        throw new Error(
          "[svelte-plugin] could not find @lostgradient/bun-plugin-svelte's component onLoad " +
            'handler — the published package may have changed its internal registration.',
        );
      }
      const compileComponent = componentLoader;

      builder.onLoad({ filter: /\.svelte$/ }, async (args) => {
        const { path } = args;
        const source = await Bun.file(path).text();
        const isPlaygroundFile = isPlaygroundPath(path);

        if (!isPlaygroundFile && hasAuthoredStyleBlock(source) && !allowsStyleBlock(path)) {
          throw new Error(
            `[svelte-plugin] <style> block in ${path} — not allowed. Put styles in src/styles/.`,
          );
        }

        const needsOwnCompile = isPlaygroundFile || (options.generate === 'server' && !dev);
        if (needsOwnCompile)
          return compileWithCinderPolicy(source, path, options.generate, injectCss, dev);

        return compileComponent(args);
      });
    },
  };
}

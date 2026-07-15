import type { BunPlugin } from 'bun';
import { compile, compileModule } from 'svelte/compiler';
import ts from 'typescript';

type GenerationTarget = 'client' | 'server';

export type ServerComponentBoundary = {
  column: number;
  index: number;
  line: number;
};

const DOMAIN_SUITE_STYLE_COMPONENTS = new Set([
  'chat',
  'diff-viewer',
  'markdown-editor',
  'review-editor',
]);

const PUBLISHED_PACKAGE_SOURCE_PREFIX = 'node_modules/@lostgradient/cinder/';

/**
 * Give authored package components the same filename in workspace builds that
 * Vite gives their published source. Svelte's default scoped-CSS hash includes
 * the compiler filename, so an absolute checkout path in `dist/server` and the
 * package-relative client source path otherwise produce different class names
 * and cannot hydrate each other.
 */
export function publishedSvelteCompileFilename(filePath: string): string {
  const normalizedPath = filePath.replaceAll('\\', '/');
  const installedSourceMarker = `/${PUBLISHED_PACKAGE_SOURCE_PREFIX}`;
  const installedSourceIndex = normalizedPath.lastIndexOf(installedSourceMarker);
  if (installedSourceIndex >= 0) {
    return normalizedPath.slice(installedSourceIndex + 1);
  }

  const workspaceSourceMarker = '/packages/components/';
  const workspaceSourceIndex = normalizedPath.lastIndexOf(workspaceSourceMarker);
  if (workspaceSourceIndex >= 0) {
    return `${PUBLISHED_PACKAGE_SOURCE_PREFIX}${normalizedPath.slice(
      workspaceSourceIndex + workspaceSourceMarker.length,
    )}`;
  }

  return filePath;
}

function allowsStyleBlock(path: string): boolean {
  const normalizedPath = path.replaceAll('\\', '/');

  // Playground chrome is not part of the design-system cascade — the no-style
  // rule exists to keep the shipped component library on a single CSS surface.
  // Files under packages/playground/ are dev-only scaffolding and may co-locate
  // their styles with their markup.
  if (normalizedPath.includes('/packages/playground/')) return true;

  const componentPathMatch = normalizedPath.match(/\/src\/components\/([^/]+)(?:\/|\.svelte$)/);
  const componentName = componentPathMatch?.[1];
  return componentName !== undefined && DOMAIN_SUITE_STYLE_COMPONENTS.has(componentName);
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

/**
 * Bun plugin that compiles Svelte 5 components with `svelte/compiler`.
 *
 * - `generate`: chooses client-side or server-side rendering output.
 * - `injectCss`: when `true`, every component injects its CSS into the JS
 *   bundle — used by the playground server so domain-suite components (chat,
 *   diff-viewer, markdown-editor, review-editor) get their scoped styles
 *   applied. When `false` (default), library components emit external CSS
 *   sidecars so consumers can ship one cascade. Playground files always
 *   inject regardless of this flag, since dev-only chrome should not depend
 *   on the design-system cascade.
 * - Rejects any component that carries a `<style>` block, except for files
 *   under `packages/playground/` and the domain-suite components allowlisted
 *   above. Styles belong in `src/styles/` so the design system has a single
 *   CSS cascade surface; the playground is dev-only chrome and not part of it.
 * - Compiles `.svelte.js` / `.svelte.ts` rune modules via `compileModule` so libraries
 *   like `@testing-library/svelte-core` that use runes in plain modules work at runtime.
 */
export function sveltePlugin(
  options: { generate: GenerationTarget; injectCss?: boolean } = {
    generate: 'client',
  },
): BunPlugin {
  const injectCss = options.injectCss ?? false;
  return {
    name: `svelte-${options.generate}`,
    setup(builder) {
      builder.onLoad({ filter: /\.svelte$/ }, async ({ path }) => {
        const source = await Bun.file(path).text();
        const filename = publishedSvelteCompileFilename(path);
        const isPlaygroundFile = path.replaceAll('\\', '/').includes('/packages/playground/');
        const css = isPlaygroundFile || injectCss ? 'injected' : 'external';
        const dev = process.env['NODE_ENV'] !== 'production';
        const compileResult = compile(source, {
          filename,
          generate: options.generate,
          css,
          // Read the same environment source that `scripts/build.ts` writes before `Bun.build()`
          // runs so production builds and test/dev loads stay in sync.
          dev,
        });
        if (!isPlaygroundFile && compileResult.css?.code?.trim() && !allowsStyleBlock(path)) {
          throw new Error(
            `[svelte-plugin] <style> block in ${path} — not allowed. Put styles in src/styles/.`,
          );
        }
        const compiledSource =
          options.generate === 'server' && !dev
            ? preserveServerComponentIdentity(compileResult.js.code, path)
            : compileResult.js.code;
        return { contents: compiledSource, loader: 'js' };
      });

      builder.onLoad({ filter: /\.svelte\.(js|ts)$/ }, async ({ path }) => {
        const source = await Bun.file(path).text();
        const moduleSource = path.endsWith('.ts')
          ? new Bun.Transpiler({ loader: 'ts' }).transformSync(source)
          : source;
        const compileResult = compileModule(moduleSource, {
          filename: path,
          generate: options.generate,
          // Read the same environment source that `scripts/build.ts` writes before `Bun.build()`
          // runs so production builds and test/dev loads stay in sync.
          dev: process.env['NODE_ENV'] !== 'production',
        });
        return { contents: compileResult.js.code, loader: 'js' };
      });
    },
  };
}

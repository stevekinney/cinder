import type { BunPlugin } from 'bun';
import { dirname } from 'node:path';
import { compile, compileModule, parse } from 'svelte/compiler';
import ts from 'typescript';
import { environmentConfiguration } from './environment-configuration.ts';

export type SvelteGenerationTarget = 'client' | 'server';

export type SvelteCompilerPluginOptions = {
  generate?: SvelteGenerationTarget;
  injectCss?: boolean;
  development?: boolean;
  allowStyleBlock?: (path: string) => boolean;
  filename?: (path: string) => string;
  transformServerOutput?: (input: { code: string; path: string; dev: boolean }) => string;
};

type SvelteCompilerPluginHooks = {
  allowStyleBlock?: ((path: string) => boolean) | undefined;
  filename?: ((path: string) => string) | undefined;
  transformServerOutput?:
    ((input: { code: string; path: string; dev: boolean }) => string) | undefined;
};

export type ServerComponentBoundary = {
  column: number;
  index: number;
  line: number;
};

const typeScriptTranspiler = new Bun.Transpiler({ loader: 'ts' });

export function hasAuthoredStyleBlock(source: string): boolean {
  const ast = parse(source, { modern: true });
  return Boolean(ast.css);
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

export function compileSvelteComponentForBun(
  source: string,
  path: string,
  options: Required<Pick<SvelteCompilerPluginOptions, 'generate' | 'injectCss'>>,
  hooks: SvelteCompilerPluginHooks,
  development?: boolean,
): { contents: string; loader: 'js'; resolveDir: string } {
  // Parsing a component to look for a `<style>` block costs about half of compiling it, so
  // only do it when a policy hook exists to consult.
  if (
    hooks.allowStyleBlock !== undefined &&
    hasAuthoredStyleBlock(source) &&
    !hooks.allowStyleBlock(path)
  ) {
    throw new Error(
      `[svelte-plugin] <style> block in ${path} is not allowed by this test compiler configuration.`,
    );
  }

  const filename = hooks.filename?.(path) ?? path;
  const dev = development ?? environmentConfiguration().nodeEnv !== 'production';
  const result = compile(source, {
    filename,
    generate: options.generate,
    css: options.injectCss ? 'injected' : 'external',
    dev,
  });

  const code =
    options.generate === 'server'
      ? (hooks.transformServerOutput?.({ code: result.js.code, path, dev }) ?? result.js.code)
      : result.js.code;

  return { contents: code, loader: 'js', resolveDir: dirname(path) };
}

export function compileSvelteRuneModuleForBun(
  source: string,
  path: string,
  generate: SvelteGenerationTarget,
  development?: boolean,
): { contents: string; loader: 'js'; resolveDir: string } {
  const moduleSource = path.endsWith('.ts') ? typeScriptTranspiler.transformSync(source) : source;
  const result = compileModule(moduleSource, {
    filename: path,
    generate,
    dev: development ?? environmentConfiguration().nodeEnv !== 'production',
  });

  return { contents: result.js.code, loader: 'js', resolveDir: dirname(path) };
}

export function sveltePlugin(options: SvelteCompilerPluginOptions = {}): BunPlugin {
  const generate = options.generate ?? 'client';
  const injectCss = options.injectCss ?? false;

  return {
    name: `svelte-${generate}`,
    setup(builder) {
      builder.onLoad({ filter: /\.svelte$/ }, async ({ path }) =>
        compileSvelteComponentForBun(
          await Bun.file(path).text(),
          path,
          { generate, injectCss },
          {
            allowStyleBlock: options.allowStyleBlock,
            filename: options.filename,
            transformServerOutput: options.transformServerOutput,
          },
          options.development,
        ),
      );

      builder.onLoad({ filter: /\.svelte\.[jt]s$/ }, async ({ path }) =>
        compileSvelteRuneModuleForBun(
          await Bun.file(path).text(),
          path,
          generate,
          options.development,
        ),
      );
    },
  };
}

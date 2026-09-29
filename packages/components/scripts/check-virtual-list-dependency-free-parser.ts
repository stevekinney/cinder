import { parse as parseSvelte } from 'svelte/compiler';
import ts from 'typescript';

export type ParsedSpecifier = {
  readonly specifier: string;
  readonly offset: number;
  readonly isDynamic: boolean;
  readonly isLiteral: boolean;
};

type LiteralText = (node: ts.Node) => string | undefined;

function literalText(node: ts.Node): string | undefined {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return undefined;
}

function collectStaticImport(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  baseOffset: number,
  found: ParsedSpecifier[],
  readLiteral: LiteralText,
): void {
  if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) return;
  const specifier = node.moduleSpecifier && readLiteral(node.moduleSpecifier);
  if (specifier === undefined) return;
  found.push({
    specifier,
    offset: baseOffset + node.moduleSpecifier!.getStart(sourceFile),
    isDynamic: false,
    isLiteral: true,
  });
}

function collectImportType(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  baseOffset: number,
  found: ParsedSpecifier[],
): void {
  if (!ts.isImportTypeNode(node) || !ts.isLiteralTypeNode(node.argument)) return;
  const literal = node.argument.literal;
  if (!ts.isStringLiteral(literal)) return;
  found.push({
    specifier: literal.text,
    offset: baseOffset + literal.getStart(sourceFile),
    isDynamic: false,
    isLiteral: true,
  });
}

function collectCallImport(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  baseOffset: number,
  found: ParsedSpecifier[],
  readLiteral: LiteralText,
): void {
  if (!ts.isCallExpression(node)) return;
  const [argument] = node.arguments;
  const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require';
  const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
  if ((!isRequire && !isDynamicImport) || argument === undefined) return;
  const specifier = readLiteral(argument);
  found.push({
    specifier: specifier ?? argument.getText(sourceFile),
    offset: baseOffset + argument.getStart(sourceFile),
    isDynamic: true,
    isLiteral: specifier !== undefined,
  });
}

function collectImportEquals(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  baseOffset: number,
  found: ParsedSpecifier[],
  readLiteral: LiteralText,
): void {
  if (!ts.isImportEqualsDeclaration(node) || !ts.isExternalModuleReference(node.moduleReference)) {
    return;
  }
  const { expression } = node.moduleReference;
  const specifier = readLiteral(expression);
  found.push({
    specifier: specifier ?? expression.getText(sourceFile),
    offset: baseOffset + expression.getStart(sourceFile),
    isDynamic: false,
    isLiteral: specifier !== undefined,
  });
}

/**
 * Extracts every `<script>` body from a Svelte component, with the offset each
 * body starts at so positions can be mapped back to the original file.
 */
function extractScriptBlocks(content: string): Array<{ text: string; offset: number }> {
  const blocks: Array<{ text: string; offset: number }> = [];
  const openTag = /<script\b[^>]*>/g;
  let match: RegExpExecArray | null;
  while ((match = openTag.exec(content)) !== null) {
    const bodyStart = match.index + match[0].length;
    const bodyEnd = content.indexOf('</script>', bodyStart);
    if (bodyEnd === -1) break;
    blocks.push({ text: content.slice(bodyStart, bodyEnd), offset: bodyStart });
    openTag.lastIndex = bodyEnd;
  }
  return blocks;
}

/**
 * Collects `import()` expressions written in a Svelte TEMPLATE, outside any
 * `<script>` block.
 *
 * `{#await import('@tanstack/virtual-core')}` is valid Svelte and loads the
 * package for real, but it lives in the markup, so a scan of extracted script
 * bodies never sees it. The template is walked through Svelte's own parser rather
 * than pattern-matched, for the same reason the script bodies go through
 * TypeScript's: the guard should see what the runtime sees.
 */
function collectTemplateSpecifiers(content: string): ParsedSpecifier[] {
  const found: ParsedSpecifier[] = [];
  let root: unknown;
  try {
    root = parseSvelte(content, { modern: true });
  } catch {
    // A component that does not parse cannot ship either, and the build reports
    // that far more clearly than this guard would.
    return found;
  }

  const seen = new Set<object>();

  const visit = (node: unknown): void => {
    if (!isPlainRecord(node)) {
      if (Array.isArray(node)) for (const child of node) visit(child);
      return;
    }
    if (seen.has(node)) return;
    seen.add(node);

    if (node['type'] === 'ImportExpression') found.push(parseTemplateImport(node));

    for (const key of Object.keys(node)) {
      if (key === 'parent') continue;
      visit(node[key]);
    }
  };

  // Only the template fragment. Script bodies belong to the TypeScript parser, and
  // walking them here as well would report every import in them twice.
  visit(isPlainRecord(root) ? root['fragment'] : undefined);
  return found;
}

/** Narrows to a walkable AST node without asserting a shape the value may not have. */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Reads one template `import()` expression into the shape the classifier expects. */
function parseTemplateImport(node: Record<string, unknown>): ParsedSpecifier {
  const nodeStart = typeof node['start'] === 'number' ? node['start'] : 0;
  const source = node['source'];
  if (isPlainRecord(source) && source['type'] === 'Literal') {
    const value = source['value'];
    const sourceStart = typeof source['start'] === 'number' ? source['start'] : nodeStart;
    if (typeof value === 'string') {
      return { specifier: value, offset: sourceStart, isDynamic: true, isLiteral: true };
    }
  }
  return {
    specifier: 'import(<computed>)',
    offset: nodeStart,
    isDynamic: true,
    isLiteral: false,
  };
}

/**
 * Collects import specifiers from one TypeScript source using the compiler's own
 * parser.
 *
 * This replaced a regex scanner that was evaded four separate times — by
 * multiline forms, by template literals, by package subpaths, and by comments
 * sitting between the import token and its specifier. Each was a real bypass of a
 * guard whose entire job is to be un-bypassable, and each fix invited the next
 * variant. A parser ends the category: it sees exactly what the runtime sees, and
 * comments, arbitrary whitespace, and string-literal form stop mattering.
 */
function collectSpecifiers(text: string, baseOffset: number): ParsedSpecifier[] {
  // TS, not TSX. In TSX grammar a legal angle-bracket type assertion — `const value
  // = <Foo>bar;` — parses as malformed JSX, and because parser diagnostics are
  // ignored here, every import after it can vanish from the AST and slip past this
  // guard. The repository compiles these files as ordinary TypeScript, so the
  // scanner must read them the same way.
  const sourceFile = ts.createSourceFile(
    'scan.ts',
    text,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TS,
  );
  const found: ParsedSpecifier[] = [];

  const visit = (node: ts.Node): void => {
    collectStaticImport(node, sourceFile, baseOffset, found, literalText);
    collectImportType(node, sourceFile, baseOffset, found);
    collectCallImport(node, sourceFile, baseOffset, found, literalText);
    collectImportEquals(node, sourceFile, baseOffset, found, literalText);
    ts.forEachChild(node, visit);
  };

  ts.forEachChild(sourceFile, visit);
  return found;
}

export function collectAllSpecifiers(content: string, filePath: string): ParsedSpecifier[] {
  const isSvelte = filePath.endsWith('.svelte');
  const blocks = isSvelte ? extractScriptBlocks(content) : [{ text: content, offset: 0 }];
  const parsed = blocks.flatMap((block) => collectSpecifiers(block.text, block.offset));
  if (isSvelte) parsed.push(...collectTemplateSpecifiers(content));
  return parsed;
}

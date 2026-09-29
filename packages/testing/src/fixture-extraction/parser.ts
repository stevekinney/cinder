import { createHash } from 'node:crypto';
import { basename, dirname } from 'node:path';

import ts from 'typescript';

import { parseFixtureFile } from '../visual-fixtures.ts';
import { extractLiteralValue } from './literal-parser.ts';
import type { FileParseResult } from './types.ts';

const COMPONENT_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

function sha256(contents: string): string {
  return createHash('sha256').update(contents).digest('hex');
}

function position(sourceFile: ts.SourceFile, node: ts.Node): string {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.pos);
  return `${line + 1}:${character + 1}`;
}

type Collection = {
  importedNames: Set<string>;
  localArrayConsts: Map<string, ts.ArrayLiteralExpression>;
  rawFixturesNode?: ts.ArrayLiteralExpression;
  rawMetadataNode?: ts.ObjectLiteralExpression;
  violations: string[];
};

function readImport(
  statement: ts.ImportDeclaration,
  collection: Collection,
  componentName: string,
  sourceFile: ts.SourceFile,
): void {
  if (!statement.importClause) {
    collection.violations.push(
      `[${componentName}] side-effect import at ${position(sourceFile, statement)} is not allowed in fixture files`,
    );
    return;
  }
  const clause = statement.importClause;
  if (clause.namedBindings) {
    if (ts.isNamespaceImport(clause.namedBindings))
      collection.importedNames.add(clause.namedBindings.name.text);
    else {
      for (const element of clause.namedBindings.elements) {
        if (!element.isTypeOnly && !clause.isTypeOnly)
          collection.importedNames.add(element.name.text);
      }
    }
  }
  if (clause.name && !clause.isTypeOnly) collection.importedNames.add(clause.name.text);
}

function readMetadataDeclaration(
  declaration: ts.VariableDeclaration,
  collection: Collection,
  componentName: string,
  sourceFile: ts.SourceFile,
  isConst: boolean,
): boolean {
  if (!ts.isIdentifier(declaration.name) || declaration.name.text !== 'visualFixtureMetadata')
    return false;
  if (!isConst)
    collection.violations.push(
      `[${componentName}] visualFixtureMetadata at ${position(sourceFile, declaration)} must be declared as const`,
    );
  else if (!declaration.initializer || !ts.isObjectLiteralExpression(declaration.initializer))
    collection.violations.push(
      `[${componentName}] visualFixtureMetadata at ${position(sourceFile, declaration)} must be initialized to an object literal`,
    );
  else collection.rawMetadataNode = declaration.initializer;
  return true;
}

function readDeclaration(
  declaration: ts.VariableDeclaration,
  collection: Collection,
  componentName: string,
  sourceFile: ts.SourceFile,
  isConst: boolean,
): void {
  if (!ts.isIdentifier(declaration.name)) {
    collection.violations.push(
      `[${componentName}] destructured declaration at ${position(sourceFile, declaration)} is not allowed in fixture files`,
    );
    return;
  }
  if (readMetadataDeclaration(declaration, collection, componentName, sourceFile, isConst)) return;
  if (isConst && declaration.initializer && ts.isArrayLiteralExpression(declaration.initializer)) {
    collection.localArrayConsts.set(declaration.name.text, declaration.initializer);
    return;
  }
  if (!isConst)
    collection.violations.push(
      `[${componentName}] non-const variable '${declaration.name.text}' at ${position(sourceFile, declaration)} is not allowed in fixture files`,
    );
}

function readVariables(
  statement: ts.VariableStatement,
  collection: Collection,
  componentName: string,
  sourceFile: ts.SourceFile,
): void {
  const isConst = (statement.declarationList.flags & ts.NodeFlags.Const) !== 0;
  for (const declaration of statement.declarationList.declarations)
    readDeclaration(declaration, collection, componentName, sourceFile, isConst);
}

function readExportAssignment(
  statement: ts.ExportAssignment,
  collection: Collection,
  componentName: string,
  sourceFile: ts.SourceFile,
): void {
  const expression = statement.expression;
  if (ts.isArrayLiteralExpression(expression)) collection.rawFixturesNode = expression;
  else if (ts.isIdentifier(expression)) {
    const referencedArray = collection.localArrayConsts.get(expression.text);
    if (referencedArray) collection.rawFixturesNode = referencedArray;
    else
      collection.violations.push(
        `[${componentName}] default export references '${expression.text}' at ${position(sourceFile, expression)} which is not a locally-declared array const`,
      );
  } else
    collection.violations.push(
      `[${componentName}] non-literal default export at ${position(sourceFile, expression)}: ${ts.SyntaxKind[expression.kind]}`,
    );
}

function readStatement(
  statement: ts.Statement,
  collection: Collection,
  componentName: string,
  sourceFile: ts.SourceFile,
): void {
  if (ts.isImportDeclaration(statement))
    return readImport(statement, collection, componentName, sourceFile);
  if (ts.isVariableStatement(statement))
    return readVariables(statement, collection, componentName, sourceFile);
  if (ts.isExportDeclaration(statement)) return;
  if (ts.isExportAssignment(statement) && !statement.isExportEquals)
    return readExportAssignment(statement, collection, componentName, sourceFile);
  collection.violations.push(
    `[${componentName}] unexpected top-level statement at ${position(sourceFile, statement)}: ${ts.SyntaxKind[statement.kind]}`,
  );
}

function collectNodes(sourceFile: ts.SourceFile, componentName: string): Collection {
  const collection: Collection = {
    importedNames: new Set(),
    localArrayConsts: new Map(),
    violations: [],
  };
  for (const statement of sourceFile.statements)
    readStatement(statement, collection, componentName, sourceFile);
  return collection;
}

function parsedEntry(
  sourcePath: string,
  contents: string,
  componentName: string,
  rawFixtures: unknown,
  rawMetadata: unknown,
): FileParseResult {
  try {
    const parsed = parseFixtureFile({
      fixtures: rawFixtures,
      metadata: rawMetadata,
      componentName,
    });
    return {
      kind: 'entry',
      entry: {
        componentName,
        sourcePath,
        contentHash: sha256(contents),
        fixtures: parsed.fixtures,
        metadata: parsed.metadata,
      },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      kind: 'violations',
      violations: message.split('\n').filter((line) => line.length > 0),
    };
  }
}

export function parseFixtureFileStatic(sourcePath: string, contents: string): FileParseResult {
  const componentName = basename(dirname(sourcePath));
  if (!COMPONENT_NAME_PATTERN.test(componentName))
    return {
      kind: 'violations',
      violations: [
        `[${componentName}] invalid component directory name '${componentName}' — must match ${String(COMPONENT_NAME_PATTERN)}`,
      ],
    };
  const sourceFile = ts.createSourceFile(sourcePath, contents, ts.ScriptTarget.Latest, true);
  if (
    !sourceFile.statements.some(
      (statement) => ts.isExportAssignment(statement) && !statement.isExportEquals,
    )
  )
    return { kind: 'skipped' };
  const collection = collectNodes(sourceFile, componentName);
  if (collection.violations.length > 0)
    return { kind: 'violations', violations: collection.violations };
  if (!collection.rawFixturesNode)
    return {
      kind: 'violations',
      violations: [
        `[${componentName}] no default export found — fixture file must export a default array`,
      ],
    };
  const rawFixtures = extractLiteralValue(
    collection.rawFixturesNode,
    collection.importedNames,
    componentName,
    sourceFile,
  );
  if ('violation' in rawFixtures)
    return { kind: 'violations', violations: [rawFixtures.violation] };
  let rawMetadata: unknown;
  if (collection.rawMetadataNode) {
    const metadataResult = extractLiteralValue(
      collection.rawMetadataNode,
      collection.importedNames,
      componentName,
      sourceFile,
    );
    if ('violation' in metadataResult)
      return { kind: 'violations', violations: [metadataResult.violation] };
    rawMetadata = metadataResult.value;
  }
  return parsedEntry(sourcePath, contents, componentName, rawFixtures.value, rawMetadata);
}

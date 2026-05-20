/**
 * Static-data fixture extractor for the visual-regression pipeline.
 *
 * Parses `**\/*-fixtures.ts` files using the TypeScript compiler API without
 * executing them. Extracts the default-exported array and optional named
 * export `visualFixtureMetadata`, validates both via `parseFixtureFile` from
 * the fixture schema, and returns a typed result consumed downstream.
 *
 * Only pure JSON-literal fixture files are accepted. Any file that uses
 * function calls, imported identifiers in props, spread elements, computed
 * property names, or non-literal expressions is rejected with a named
 * violation and excluded from the result set.
 */

import { basename, dirname, join } from 'node:path';

import ts from 'typescript';

import {
  parseFixtureFile,
  type VisualFixture,
  type VisualFixtureMetadata,
} from '@cinder/testing/fixture-schema';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A single successfully-extracted fixture file. `sourcePath` is for internal
 * error reporting and is omitted from the manifest output.
 */
export type FixtureFileEntry = {
  componentName: string;
  sourcePath: string;
  fixtures: VisualFixture[];
  metadata: VisualFixtureMetadata;
};

/** The result returned by `extractFixtures`. */
export type FixtureExtractResult = {
  entries: FixtureFileEntry[];
  violations: string[];
};

// ---------------------------------------------------------------------------
// Component name validation
// ---------------------------------------------------------------------------

const COMPONENT_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

// ---------------------------------------------------------------------------
// Literal value extraction
// ---------------------------------------------------------------------------

/**
 * Attempts to convert a TypeScript AST expression node into a plain
 * JSON-serializable value. Returns `undefined` when the node is not a
 * supported literal form, which the caller treats as a rejection trigger.
 */
function extractLiteralValue(
  node: ts.Expression,
  importedNames: ReadonlySet<string>,
  componentName: string,
  sourceFile: ts.SourceFile,
): { value: unknown } | { violation: string } {
  // String literal
  if (ts.isStringLiteral(node)) {
    return { value: node.text };
  }

  // Numeric literal
  if (ts.isNumericLiteral(node)) {
    return { value: Number(node.text) };
  }

  // Negative numeric literal: -<NumericLiteral>
  if (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(node.operand)
  ) {
    return { value: -Number(node.operand.text) };
  }

  // Boolean / null keyword tokens
  if (node.kind === ts.SyntaxKind.TrueKeyword) return { value: true };
  if (node.kind === ts.SyntaxKind.FalseKeyword) return { value: false };
  if (node.kind === ts.SyntaxKind.NullKeyword) return { value: null };

  // Array literal — recurse into each element
  if (ts.isArrayLiteralExpression(node)) {
    const items: unknown[] = [];
    for (const element of node.elements) {
      if (ts.isSpreadElement(element)) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(element.pos);
        return {
          violation: `[${componentName}] spread element at ${line + 1}:${character + 1}`,
        };
      }
      const result = extractLiteralValue(element, importedNames, componentName, sourceFile);
      if ('violation' in result) return result;
      items.push(result.value);
    }
    return { value: items };
  }

  // Object literal — recurse into properties
  if (ts.isObjectLiteralExpression(node)) {
    const object: Record<string, unknown> = {};
    for (const property of node.properties) {
      // Reject spread assignments
      if (ts.isSpreadAssignment(property)) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(property.pos);
        return {
          violation: `[${componentName}] spread element at ${line + 1}:${character + 1}`,
        };
      }

      if (!ts.isPropertyAssignment(property)) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(property.pos);
        return {
          violation: `[${componentName}] non-literal expression at ${line + 1}:${character + 1}: ${ts.SyntaxKind[property.kind]}`,
        };
      }

      // Reject computed property names
      if (ts.isComputedPropertyName(property.name)) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(property.name.pos);
        return {
          violation: `[${componentName}] computed property name at ${line + 1}:${character + 1}`,
        };
      }

      // Accept identifier or string literal as property key
      let key: string;
      if (ts.isIdentifier(property.name)) {
        key = property.name.text;
      } else if (ts.isStringLiteral(property.name)) {
        key = property.name.text;
      } else {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(property.name.pos);
        return {
          violation: `[${componentName}] non-literal property name at ${line + 1}:${character + 1}: ${ts.SyntaxKind[property.name.kind]}`,
        };
      }

      const result = extractLiteralValue(
        property.initializer,
        importedNames,
        componentName,
        sourceFile,
      );
      if ('violation' in result) return result;
      object[key] = result.value;
    }
    return { value: object };
  }

  // Identifier reference — check if it's an imported name (forbidden)
  if (ts.isIdentifier(node)) {
    const name = node.text;
    if (importedNames.has(name)) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.pos);
      return {
        violation: `[${componentName}] imported identifier '${name}' used in fixture at ${line + 1}:${character + 1}`,
      };
    }
    // Any other identifier reference is also a non-literal
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.pos);
    return {
      violation: `[${componentName}] non-literal expression at ${line + 1}:${character + 1}: ${ts.SyntaxKind[node.kind]}`,
    };
  }

  // Property access (e.g. iconComponents.check) — treat as non-literal
  if (ts.isPropertyAccessExpression(node)) {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.pos);
    return {
      violation: `[${componentName}] non-literal expression at ${line + 1}:${character + 1}: ${ts.SyntaxKind[node.kind]}`,
    };
  }

  // Everything else is a non-literal
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.pos);
  return {
    violation: `[${componentName}] non-literal expression at ${line + 1}:${character + 1}: ${ts.SyntaxKind[node.kind]}`,
  };
}

// ---------------------------------------------------------------------------
// Single-file parser
// ---------------------------------------------------------------------------

type FileParseResult =
  | { kind: 'entry'; entry: FixtureFileEntry }
  | { kind: 'violations'; violations: string[] }
  | { kind: 'skipped' };

/**
 * Parses a single `*-fixtures.ts` file without executing it. Returns either a
 * valid `FixtureFileEntry` or a list of violations.
 */
function parseFixtureFile_static(sourcePath: string, contents: string): FileParseResult {
  const componentName = basename(dirname(sourcePath));

  if (!COMPONENT_NAME_PATTERN.test(componentName)) {
    return {
      kind: 'violations',
      violations: [
        `[${componentName}] invalid component directory name '${componentName}' — must match ${String(COMPONENT_NAME_PATTERN)}`,
      ],
    };
  }

  const sourceFile = ts.createSourceFile(
    sourcePath,
    contents,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
  );

  // Files that share the `-fixtures.ts` suffix but predate the visual-regression
  // convention (e.g. chat test-factory fixtures) have no default export.
  // Skip them silently — they aren't visual-regression fixtures. The schema
  // contract is: a visual-regression fixture file has `export default [...]`
  // at the top level.
  const hasDefaultExport = sourceFile.statements.some(
    (statement) => ts.isExportAssignment(statement) && !statement.isExportEquals,
  );
  if (!hasDefaultExport) {
    return { kind: 'skipped' };
  }

  const violations: string[] = [];

  // Track locally-declared const names and imported identifiers
  const importedNames = new Set<string>();

  // Collect locally-declared const names whose initializer is an array literal,
  // keyed by identifier name.
  const localArrayConsts = new Map<string, ts.ArrayLiteralExpression>();
  const localObjectConsts = new Map<string, ts.ObjectLiteralExpression>();

  // --- First pass: collect declarations and validate top-level structure ---

  let rawFixturesNode: ts.ArrayLiteralExpression | undefined;
  let rawMetadataNode: ts.ObjectLiteralExpression | undefined;

  for (const statement of sourceFile.statements) {
    // Allow import declarations (type-only or value), but track imported names
    if (ts.isImportDeclaration(statement)) {
      // Reject side-effect-only imports (no import clause)
      if (!statement.importClause) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(statement.pos);
        violations.push(
          `[${componentName}] side-effect import at ${line + 1}:${character + 1} is not allowed in fixture files`,
        );
        continue;
      }

      const clause = statement.importClause;
      // Named bindings
      if (clause.namedBindings) {
        if (ts.isNamespaceImport(clause.namedBindings)) {
          // import * as foo from '...'
          importedNames.add(clause.namedBindings.name.text);
        } else {
          // import { a, b as c } from '...'
          for (const element of clause.namedBindings.elements) {
            // Only track value imports (not `import type { ... }`)
            if (!element.isTypeOnly && !clause.isTypeOnly) {
              importedNames.add(element.name.text);
            }
          }
        }
      }
      // Default import: import Foo from '...'
      if (clause.name && !clause.isTypeOnly) {
        importedNames.add(clause.name.text);
      }

      continue;
    }

    // Allow const variable declarations
    if (ts.isVariableStatement(statement)) {
      // Must be const
      const isConst = (statement.declarationList.flags & ts.NodeFlags.Const) !== 0;

      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) {
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(declaration.pos);
          violations.push(
            `[${componentName}] destructured declaration at ${line + 1}:${character + 1} is not allowed in fixture files`,
          );
          continue;
        }

        const varName = declaration.name.text;

        // Track the `visualFixtureMetadata` const (must be an object literal)
        if (varName === 'visualFixtureMetadata') {
          if (!isConst) {
            const { line, character } = sourceFile.getLineAndCharacterOfPosition(declaration.pos);
            violations.push(
              `[${componentName}] visualFixtureMetadata at ${line + 1}:${character + 1} must be declared as const`,
            );
            continue;
          }
          if (!declaration.initializer || !ts.isObjectLiteralExpression(declaration.initializer)) {
            const { line, character } = sourceFile.getLineAndCharacterOfPosition(declaration.pos);
            violations.push(
              `[${componentName}] visualFixtureMetadata at ${line + 1}:${character + 1} must be initialized to an object literal`,
            );
            continue;
          }
          rawMetadataNode = declaration.initializer;
          continue;
        }

        // Track any const whose initializer is an array literal — may be the
        // indirectly-exported fixtures array
        if (
          isConst &&
          declaration.initializer &&
          ts.isArrayLiteralExpression(declaration.initializer)
        ) {
          localArrayConsts.set(varName, declaration.initializer);
          continue;
        }

        // Track any const whose initializer is an object literal
        if (
          isConst &&
          declaration.initializer &&
          ts.isObjectLiteralExpression(declaration.initializer)
        ) {
          localObjectConsts.set(varName, declaration.initializer);
          continue;
        }

        // Non-const or unexpected initializer
        if (!isConst) {
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(declaration.pos);
          violations.push(
            `[${componentName}] non-const variable '${varName}' at ${line + 1}:${character + 1} is not allowed in fixture files`,
          );
        }
      }

      continue;
    }

    // Allow export statements
    if (ts.isExportDeclaration(statement)) {
      // Re-exports are fine to skip (e.g. `export type { ... }`)
      continue;
    }

    // Handle `export default [...]` and `export default <identifier>`
    if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
      const expression = statement.expression;

      // Direct array literal: export default [...]
      if (ts.isArrayLiteralExpression(expression)) {
        rawFixturesNode = expression;
        continue;
      }

      // Indirect: export default <identifier> where identifier points to a local const
      if (ts.isIdentifier(expression)) {
        const referencedArray = localArrayConsts.get(expression.text);
        if (referencedArray) {
          rawFixturesNode = referencedArray;
          continue;
        }
        // If it's some other identifier, that's a violation
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(expression.pos);
        violations.push(
          `[${componentName}] default export references '${expression.text}' at ${line + 1}:${character + 1} which is not a locally-declared array const`,
        );
        continue;
      }

      // Function call or anything else
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(expression.pos);
      violations.push(
        `[${componentName}] non-literal default export at ${line + 1}:${character + 1}: ${ts.SyntaxKind[expression.kind]}`,
      );
      continue;
    }

    // Any other top-level statement is forbidden
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(statement.pos);
    violations.push(
      `[${componentName}] unexpected top-level statement at ${line + 1}:${character + 1}: ${ts.SyntaxKind[statement.kind]}`,
    );
  }

  // --- Early exit on structural violations ---
  if (violations.length > 0) {
    return { kind: 'violations', violations };
  }

  if (!rawFixturesNode) {
    return {
      kind: 'violations',
      violations: [
        `[${componentName}] no default export found — fixture file must export a default array`,
      ],
    };
  }

  // --- Second pass: extract literal values from the fixtures array ---

  const rawFixtures = extractLiteralValue(
    rawFixturesNode,
    importedNames,
    componentName,
    sourceFile,
  );

  if ('violation' in rawFixtures) {
    return { kind: 'violations', violations: [rawFixtures.violation] };
  }

  let rawMetadata: unknown = undefined;
  if (rawMetadataNode) {
    const metadataResult = extractLiteralValue(
      rawMetadataNode,
      importedNames,
      componentName,
      sourceFile,
    );
    if ('violation' in metadataResult) {
      return { kind: 'violations', violations: [metadataResult.violation] };
    }
    rawMetadata = metadataResult.value;
  }

  // --- Schema validation via parseFixtureFile from P2a ---

  try {
    const parsed = parseFixtureFile({
      fixtures: rawFixtures.value,
      metadata: rawMetadata,
      componentName,
    });

    return {
      kind: 'entry',
      entry: {
        componentName,
        sourcePath,
        fixtures: parsed.fixtures,
        metadata: parsed.metadata,
      },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    // parseFixtureFile throws a single Error with newline-separated violations
    return {
      kind: 'violations',
      violations: message.split('\n').filter((line) => line.length > 0),
    };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Globs all `**\/*-fixtures.ts` files under `componentsRoot`, parses each
 * statically (no execution), validates via the fixture schema, and returns
 * all successfully-parsed entries alongside any violations.
 *
 * Violations from one file do not prevent other files from being processed.
 *
 * @param componentsRoot - Absolute path to the root directory to search.
 * @returns A `FixtureExtractResult` containing entries and any violations.
 */
export async function extractFixtures(componentsRoot: string): Promise<FixtureExtractResult> {
  const glob = new Bun.Glob('**/*-fixtures.ts');
  const entries: FixtureFileEntry[] = [];
  const violations: string[] = [];

  for await (const relativePath of glob.scan({ cwd: componentsRoot })) {
    const absolutePath = join(componentsRoot, relativePath);
    const contents = await Bun.file(absolutePath).text();

    const result = parseFixtureFile_static(absolutePath, contents);

    if (result.kind === 'entry') {
      entries.push(result.entry);
    } else if (result.kind === 'violations') {
      violations.push(...result.violations);
    }
    // 'skipped' files are intentionally ignored — they share the
    // `-fixtures.ts` suffix but are not visual-regression fixtures.
  }

  return { entries, violations };
}

/**
 * Writes a fixture manifest JSON file to `outputPath`. The manifest contains
 * all successfully-extracted entries with `sourcePath` omitted (it is an
 * internal field used for error reporting only).
 *
 * The shape of the output is:
 * ```json
 * {
 *   "entries": [
 *     { "componentName": "modal", "fixtures": [...], "metadata": {...} }
 *   ]
 * }
 * ```
 *
 * @param result - The result returned by `extractFixtures`.
 * @param outputPath - Absolute path to write the JSON manifest to.
 */
export async function writeFixtureManifest(
  result: FixtureExtractResult,
  outputPath: string,
): Promise<void> {
  const manifest = {
    entries: result.entries.map(({ componentName, fixtures, metadata }) => ({
      componentName,
      fixtures,
      metadata,
    })),
  };

  await Bun.write(outputPath, JSON.stringify(manifest, null, 2) + '\n');
}

// ---------------------------------------------------------------------------
// CLI entrypoint (when run directly)
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const componentsRoot = process.argv[2] ?? join(import.meta.dir, '..', 'src', 'components');
  const outputPath = process.argv[3] ?? join(import.meta.dir, '..', 'tmp', 'fixture-manifest.json');

  const result = await extractFixtures(componentsRoot);

  if (result.violations.length > 0) {
    process.stderr.write(`extract-fixtures — ${result.violations.length} violation(s):\n`);
    for (const violation of result.violations) {
      process.stderr.write(`  • ${violation}\n`);
    }
    // Exit non-zero without writing a manifest — violations mean the fixture
    // data is malformed and must not enter the pipeline.
    process.exit(1);
  }

  if (result.entries.length > 0) {
    await writeFixtureManifest(result, outputPath);
    process.stdout.write(
      `extract-fixtures — wrote ${result.entries.length} component(s) to ${outputPath}\n`,
    );
  } else {
    process.stdout.write('extract-fixtures — no fixture files found\n');
  }
}

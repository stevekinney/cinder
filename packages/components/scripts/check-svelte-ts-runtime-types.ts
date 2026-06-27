/**
 * Guard shared utility rune modules against exported type syntax.
 *
 * Cinder publishes source-backed `browser`/`svelte` conditions for component
 * graphs. Vite's dependency optimizer can hand reachable `.svelte.ts` utility
 * modules to a JavaScript parser before TypeScript stripping, so exported type
 * declarations in those runtime modules can crash optimizeDeps. Keep runtime
 * values in `.svelte.ts` and public type contracts in sibling `.types.ts`
 * files.
 */

import { Glob } from 'bun';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDirectory, '..');
const utilitiesRoot = resolve(packageRoot, 'src', 'utilities');
const repositoryRoot = resolve(packageRoot, '..', '..');

type Violation = { filePath: string; line: number; kind: string };

function hasExportModifier(node: ts.Node): boolean {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
  );
}

function lineFor(sourceFile: ts.SourceFile, position: number): number {
  return sourceFile.getLineAndCharacterOfPosition(position).line + 1;
}

function collectViolations(sourceFile: ts.SourceFile, filePath: string): Violation[] {
  const violations: Violation[] = [];

  for (const statement of sourceFile.statements) {
    if (ts.isTypeAliasDeclaration(statement) && hasExportModifier(statement)) {
      violations.push({
        filePath,
        line: lineFor(sourceFile, statement.getStart(sourceFile)),
        kind: 'export type',
      });
      continue;
    }

    if (ts.isInterfaceDeclaration(statement) && hasExportModifier(statement)) {
      violations.push({
        filePath,
        line: lineFor(sourceFile, statement.getStart(sourceFile)),
        kind: 'export interface',
      });
      continue;
    }

    if (ts.isExportDeclaration(statement) && statement.isTypeOnly) {
      violations.push({
        filePath,
        line: lineFor(sourceFile, statement.getStart(sourceFile)),
        kind: 'export type {...}',
      });
    }
  }

  return violations;
}

async function scan(): Promise<Violation[]> {
  const violations: Violation[] = [];
  const glob = new Glob('*.svelte.ts');

  for await (const relativePath of glob.scan({ cwd: utilitiesRoot })) {
    const absolutePath = resolve(utilitiesRoot, relativePath);
    const source = await Bun.file(absolutePath).text();
    const sourceFile = ts.createSourceFile(
      absolutePath,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    violations.push(...collectViolations(sourceFile, relative(repositoryRoot, absolutePath)));
  }

  return violations;
}

async function main(): Promise<void> {
  const violations = await scan();
  if (violations.length === 0) {
    process.stdout.write(
      'check-svelte-ts-runtime-types — OK (shared utility .svelte.ts runtime modules export values only).\n',
    );
    return;
  }

  process.stderr.write(
    'check-svelte-ts-runtime-types — exported type syntax found in shared utility .svelte.ts runtime modules.\n' +
      'Move exported type contracts to sibling .types.ts files and re-export them from the package barrel there.\n\n',
  );
  for (const violation of violations) {
    process.stderr.write(`  ${violation.filePath}:${violation.line} (${violation.kind})\n`);
  }
  process.exit(1);
}

await main();

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { DeclarationIdentity, DeclarationRecord } from './css-usage-inventory-extraction';
import { extractSource } from './css-usage-inventory-extraction';

export type Source = { path: string; content: string; globalDefinitions?: boolean };
export type DynamicRecord = {
  file: string;
  line: number;
  column: number;
  kind: string;
  property: string | null;
  expression: string;
};
export type Diagnostic = {
  file: string;
  line: number;
  column: number;
  kind: 'cycle' | 'parse-error' | 'unsupported-surface';
  reason: string;
};
export type ChainNode = { name: string; definition: DeclarationIdentity | null };
export type UseRecord = {
  file: string;
  line: number;
  column: number;
  property: string;
  value: string;
  selector: string | null;
  atRules: { name: string; parameters: string }[];
  tokenProperty: string;
  chain: ChainNode[];
};
export type Inventory = {
  schemaVersion: 1;
  uses: UseRecord[];
  dynamic: DynamicRecord[];
  diagnostics: Diagnostic[];
  sourceFiles: { path: string; sha256: string; globalDefinitions: boolean }[];
};

function compareCodePoint(left: string, right: string): number {
  if (left === right) return 0;
  const leftPoints = Array.from(left, (character) => character.codePointAt(0) ?? 0);
  const rightPoints = Array.from(right, (character) => character.codePointAt(0) ?? 0);
  for (let index = 0; index < Math.min(leftPoints.length, rightPoints.length); index++) {
    if (leftPoints[index] !== rightPoints[index]) return leftPoints[index]! - rightPoints[index]!;
  }
  return leftPoints.length - rightPoints.length;
}
function identity(record: DeclarationRecord): DeclarationIdentity {
  return {
    file: record.file,
    line: record.line,
    column: record.column,
    property: record.property,
    value: record.value,
    selector: record.selector,
    atRules: record.atRules,
  };
}
function key(value: unknown): string {
  return JSON.stringify(value);
}
function declarationComparator(left: DeclarationRecord, right: DeclarationRecord): number {
  return compareCodePoint(key(identity(left)), key(identity(right)));
}
function locationComparator(
  left: { file: string; line: number; column: number },
  right: { file: string; line: number; column: number },
): number {
  return (
    compareCodePoint(left.file, right.file) || left.line - right.line || left.column - right.column
  );
}

/** Builds a deterministic, conservative inventory from explicit source inputs. */
export function inventoryFromSources(
  sources: readonly Source[],
  publicProperties: ReadonlySet<string>,
): Inventory {
  const paths = new Set<string>();
  let globalCount = 0;
  for (const source of sources) {
    if (paths.has(source.path)) throw new Error(`Duplicate source path: ${source.path}`);
    paths.add(source.path);
    if (source.globalDefinitions) globalCount++;
  }
  if (globalCount > 1) throw new Error('At most one source may set globalDefinitions');
  const declarations: DeclarationRecord[] = [];
  const dynamic: DynamicRecord[] = [];
  const diagnostics: Diagnostic[] = [];
  for (const source of sources) {
    const extracted = extractSource(source);
    declarations.push(...extracted.declarations);
    dynamic.push(...extracted.dynamic);
    diagnostics.push(...extracted.diagnostics);
  }
  const globals = declarations.filter(
    (record) => sources.find((source) => source.path === record.sourceFile)?.globalDefinitions,
  );
  const uses: UseRecord[] = [];
  const addUse = (terminal: DeclarationRecord, tokenProperty: string, chain: ChainNode[]): void => {
    uses.push({
      file: terminal.file,
      line: terminal.line,
      column: terminal.column,
      property: terminal.property,
      value: terminal.value,
      selector: terminal.selector,
      atRules: terminal.atRules,
      tokenProperty,
      chain,
    });
  };
  for (const terminal of declarations.filter((record) => !record.property.startsWith('--')))
    for (const reference of terminal.refs) {
      const walk = (
        name: string,
        contextFile: string,
        chain: ChainNode[],
        visited: Set<string>,
        candidates: DeclarationRecord[],
      ): void => {
        if (visited.has(name)) {
          diagnostics.push({
            file: terminal.file,
            line: terminal.line,
            column: terminal.column,
            kind: 'cycle',
            reason: `Cycle while resolving ${name}`,
          });
          return;
        }
        if (publicProperties.has(name)) {
          const definitions = candidates.length
            ? candidates
            : globals.filter((record) => record.property === name);
          if (!definitions.length) addUse(terminal, name, [...chain, { name, definition: null }]);
          else
            for (const definition of definitions)
              addUse(terminal, name, [...chain, { name, definition: identity(definition) }]);
        }
        const nextVisited = new Set(visited);
        nextVisited.add(name);
        for (const definition of candidates)
          for (const dependency of definition.refs) {
            const local = declarations
              .filter(
                (record) =>
                  record.sourceFile === contextFile &&
                  record.property === dependency &&
                  record.property.startsWith('--'),
              )
              .sort(declarationComparator);
            const next = local.length
              ? local
              : publicProperties.has(dependency)
                ? globals
                    .filter((record) => record.property === dependency)
                    .sort(declarationComparator)
                : [];
            walk(
              dependency,
              contextFile,
              [...chain, { name, definition: identity(definition) }],
              nextVisited,
              next,
            );
          }
      };
      const local = declarations
        .filter(
          (record) =>
            record.sourceFile === terminal.sourceFile &&
            record.property === reference &&
            record.property.startsWith('--'),
        )
        .sort(declarationComparator);
      walk(
        reference,
        terminal.sourceFile,
        [],
        new Set(),
        local.length
          ? local
          : publicProperties.has(reference)
            ? globals.filter((record) => record.property === reference).sort(declarationComparator)
            : [],
      );
    }
  const stableUses = [...new Map(uses.map((use) => [key(use), use])).values()].sort(
    (left, right) => locationComparator(left, right) || compareCodePoint(key(left), key(right)),
  );
  const stableDynamic = [...new Map(dynamic.map((record) => [key(record), record])).values()].sort(
    (left, right) => locationComparator(left, right) || compareCodePoint(key(left), key(right)),
  );
  const stableDiagnostics = [
    ...new Map(diagnostics.map((record) => [key(record), record])).values(),
  ].sort(
    (left, right) => locationComparator(left, right) || compareCodePoint(key(left), key(right)),
  );
  return {
    schemaVersion: 1,
    uses: stableUses,
    dynamic: stableDynamic,
    diagnostics: stableDiagnostics,
    sourceFiles: sources
      .map((source) => ({
        path: source.path,
        sha256: createHash('sha256').update(source.content).digest('hex'),
        globalDefinitions: source.globalDefinitions === true,
      }))
      .sort((left, right) => compareCodePoint(left.path, right.path)),
  };
}

/** Loads the repository source roots with the one approved global definition set. */
export async function loadRepositorySources(root: string): Promise<Source[]> {
  const bases = [
    'packages/components/src',
    'packages/chat/src',
    'packages/editor/src',
    'packages/markdown/src',
    'packages/playground/src',
  ];
  const extensions = new Set(['.css', '.svelte', '.ts', '.tsx', '.js', '.jsx']);
  const sources: Source[] = [];
  const glob = new Bun.Glob('**/*');
  for (const base of bases)
    for await (const path of glob.scan({ cwd: resolve(root, base), onlyFiles: true })) {
      const relativePath = `${base}/${path}`.replaceAll('\\', '/');
      const extension = relativePath.slice(relativePath.lastIndexOf('.'));
      if (
        !extensions.has(extension) ||
        /(^|\/)__tests__(\/|$)/.test(relativePath) ||
        /\.(test|spec|playwright)\.[^.]+$/.test(relativePath)
      )
        continue;
      sources.push({
        path: relativePath,
        content: await readFile(resolve(root, relativePath), 'utf8'),
        globalDefinitions: relativePath === 'packages/components/src/styles/tokens-base.css',
      });
    }
  if (!sources.some((source) => source.globalDefinitions))
    throw new Error('Missing packages/components/src/styles/tokens-base.css');
  return sources.sort((left, right) => compareCodePoint(left.path, right.path));
}

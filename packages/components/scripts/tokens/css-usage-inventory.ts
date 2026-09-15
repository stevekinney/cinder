import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  compositionCandidates,
  compositionElements,
  createCompositionCaches,
  declarationIdentityKey,
  importedStylesheets,
  reachableStylesheets,
  terminalElements,
  type CompositionSource,
  type ElementEvidence,
} from './css-usage-composition';
import type { DeclarationIdentity, DeclarationRecord } from './css-usage-inventory-extraction';
import { extractSource } from './css-usage-inventory-extraction';

export type Source = CompositionSource & { globalDefinitions?: boolean };
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
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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
  const reachable = new Set(reachableStylesheets(sources));
  const elements = compositionElements(sources);
  const compositionCaches = createCompositionCaches();
  for (const element of elements)
    for (const stylesheet of element.ownerStylesheets) reachable.add(stylesheet);
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
      const terminalContexts = terminalElements(terminal, elements, reachable, compositionCaches);
      const walk = (
        name: string,
        contextFile: string,
        chain: ChainNode[],
        visited: Set<string>,
        candidates: DeclarationRecord[],
        element: ElementEvidence | undefined,
      ): void => {
        const definitionKey = candidates.map(declarationIdentityKey).sort().join(',');
        const visitKey = `${name}|${element?.sourceFile ?? contextFile}|${element?.offset ?? 0}|${definitionKey}`;
        if (visited.has(visitKey)) {
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
        nextVisited.add(visitKey);
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
            const composed = element
              ? compositionCandidates(
                  dependency,
                  element,
                  declarations,
                  reachable,
                  compositionCaches,
                )
              : [];
            const next = local.length
              ? local
              : composed.length
                ? composed.sort(declarationComparator)
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
              element,
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
      for (const element of terminalContexts.length ? terminalContexts : [undefined]) {
        const composed = element
          ? compositionCandidates(reference, element, declarations, reachable, compositionCaches)
          : [];
        walk(
          reference,
          terminal.sourceFile,
          [],
          new Set(),
          local.length
            ? local
            : composed.length
              ? composed.sort(declarationComparator)
              : publicProperties.has(reference)
                ? globals
                    .filter((record) => record.property === reference)
                    .sort(declarationComparator)
                : [],
          element,
        );
      }
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
  const entryPaths = await stylesheetEntryPaths(root, sources);
  const sourcePaths = new Set(sources.map((source) => source.path));
  for (const source of sources)
    for (const imported of importedStylesheets(source, sourcePaths)) entryPaths.add(imported);
  for (const source of sources) source.stylesheetEntry = entryPaths.has(source.path);
  return sources.sort((left, right) => compareCodePoint(left.path, right.path));
}

function exportTarget(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return undefined;
  if (!isRecord(value)) return undefined;
  for (const condition of ['browser', 'svelte', 'import', 'default'])
    if (typeof value[condition] === 'string') return value[condition];
  return undefined;
}

async function stylesheetEntryPaths(
  root: string,
  sources: readonly Source[],
): Promise<Set<string>> {
  const packageRoots = [
    'packages/components',
    'packages/chat',
    'packages/editor',
    'packages/markdown',
  ];
  const sourcePaths = new Set(sources.map((source) => source.path));
  const entries = new Set<string>();
  for (const packageRoot of packageRoots) {
    const packageFile = resolve(root, packageRoot, 'package.json');
    let manifest: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(await readFile(packageFile, 'utf8'));
      if (!isRecord(parsed)) continue;
      manifest = parsed;
    } catch {
      continue;
    }
    const exports = manifest['exports'];
    if (!exports || typeof exports !== 'object') continue;
    if (!isRecord(exports)) continue;
    const exportEntries = Object.entries(exports);
    const targetSources = new Map<string, string>();
    for (const [name, value] of exportEntries) {
      if (!name.endsWith('/styles') && name !== './styles') continue;
      const target = exportTarget(value);
      if (!target || !target.endsWith('.css')) continue;
      if (target.startsWith('./src/')) {
        const relative = `${packageRoot}/${target.slice(2)}`;
        if (sourcePaths.has(relative)) targetSources.set(target, relative);
        continue;
      }
      const componentName = name.slice(2, -'/styles'.length);
      const componentExport = exports[`./${componentName}`];
      const sourceTarget = exportTarget(componentExport);
      if (!sourceTarget) continue;
      const sourceDirectory = sourceTarget.startsWith('./')
        ? `${packageRoot}/${sourceTarget.slice(2)}`.split('/').slice(0, -1).join('/')
        : undefined;
      if (!sourceDirectory) continue;
      const relative = `${sourceDirectory}/${target.split('/').at(-1)}`;
      if (sourcePaths.has(relative)) targetSources.set(target, relative);
    }
    for (const [name, value] of exportEntries) {
      if (!name.endsWith('/styles') && name !== './styles') continue;
      const target = exportTarget(value);
      const relative = target ? targetSources.get(target) : undefined;
      if (relative) entries.add(relative);
    }
  }
  return entries;
}

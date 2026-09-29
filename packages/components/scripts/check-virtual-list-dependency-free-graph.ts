import { Glob } from 'bun';
import { existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { collectAllSpecifiers } from './check-virtual-list-dependency-free-parser.ts';
import {
  buildLineStartOffsets,
  findDependencyViolations,
  lineNumberForOffset,
  TEST_FILE_PATTERN,
  type DependencyViolation,
} from './check-virtual-list-dependency-free-policy.ts';
import { readJsonFile } from './lib/read-json-file.ts';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDirectory, '..');
const packageJsonPath = join(packageRoot, 'package.json');
const virtualListRoot = join(packageRoot, 'src', 'components', 'virtual-list');
const fixedVirtualWindowFile = join(packageRoot, 'src', 'utilities', 'fixed-virtual-window.ts');
const SELF_TEST_RELATIVE_PATH = join('_internal', 'dependency-free.test.ts');

function isRelativeSpecifier(specifier: string): boolean {
  return specifier.startsWith('.') || specifier.startsWith('/');
}

type PackageManifest = { dependencies?: Record<string, string> };

/** Reads `components/cinder/package.json`'s `dependencies` keys. */
export async function loadDeclaredDependencyNames(
  manifestPath: string = packageJsonPath,
): Promise<Set<string>> {
  const manifest = await readJsonFile<PackageManifest>(manifestPath);
  return new Set(Object.keys(manifest.dependencies ?? {}));
}

/**
 * Every `.ts`/`.svelte` file under `virtual-list/**`, plus the one shared
 * utility module the engine is allowed to depend on.
 */
export async function collectScanTargets(): Promise<string[]> {
  const files: string[] = [];
  const glob = new Glob('**/*.{ts,svelte}');
  for await (const relativePath of glob.scan({ cwd: virtualListRoot })) {
    if (relativePath === SELF_TEST_RELATIVE_PATH) continue;
    files.push(join(virtualListRoot, relativePath));
  }
  files.push(fixedVirtualWindowFile);
  return files;
}

/**
 * Extensions `collectScanTargets`' own glob recognizes. A relative import that
 * resolves to anything else (`./virtual-list.css`, say) is real and gets its
 * existence confirmed by `resolveRelativeSpecifier`, but this guard has no import
 * graph to walk for it — it only understands `.ts`/`.svelte` source — so it is left
 * unscanned rather than fed to a TypeScript parser that was never going to
 * understand it.
 */
/**
 * Extensions a relative import can resolve to, and that this guard can read.
 *
 * The JavaScript ones matter as much as the TypeScript: Bun bundles a relative `.js`,
 * `.mjs`, or `.cjs` helper exactly like a `.ts` one, so accepting those as resolved and
 * then declining to scan them left a hole the size of the whole guard — the helper could
 * import `@tanstack/virtual-core` or an undeclared package and nothing would report it.
 */
const SCANNABLE_SOURCE_EXTENSIONS = ['.ts', '.tsx', '.svelte', '.js', '.mjs', '.cjs'] as const;

function isScannableSourceFile(filePath: string): boolean {
  return SCANNABLE_SOURCE_EXTENSIONS.some((extension) => filePath.endsWith(extension));
}

/**
 * Resolves a relative import specifier against the file that wrote it, trying (in
 * order) the specifier exactly as written, then each extension this package's own
 * relative imports are sometimes written without appended to it (e.g.
 * `virtual-list.schema.ts` imports `'../../schema-types'`, no `.ts`), then an
 * `index` file inside it as a directory. Returns `undefined` — never throws — when
 * none of those exist, so a broken relative import is reported as a violation
 * rather than crashing the scan.
 *
 * `statSync(...).isFile()`, not just `existsSync`, because a specifier can name an
 * existing DIRECTORY with no `index` file inside it (`./some-folder` where nothing
 * has been added yet) — `existsSync` alone would treat the directory itself as a
 * resolved module.
 */
export function resolveRelativeSpecifier(
  specifier: string,
  importingFilePath: string,
): string | undefined {
  const candidateBase = resolve(dirname(importingFilePath), specifier);
  const candidatePaths = [
    candidateBase,
    ...SCANNABLE_SOURCE_EXTENSIONS.map((extension) => `${candidateBase}${extension}`),
    ...SCANNABLE_SOURCE_EXTENSIONS.map((extension) => join(candidateBase, `index${extension}`)),
  ];
  for (const candidatePath of candidatePaths) {
    // `statSync` can throw even when `existsSync` just said yes — a permission error, or
    // the path disappearing between the two calls. A guard that crashes reports nothing
    // at all, which is strictly worse than reporting the import as unresolved, so a
    // candidate that cannot be inspected is simply not a match.
    try {
      if (existsSync(candidatePath) && statSync(candidatePath).isFile()) return candidatePath;
    } catch {
      continue;
    }
  }
  return undefined;
}

const UNRESOLVED_RELATIVE_IMPORT_REASON =
  'this relative import does not resolve to a file on disk, so the dependency-free guard cannot ' +
  'verify what it would pull into the virtual-list engine';

/** What one full transitive scan of the virtual-list dependency graph found. */
export type DependencyGraphWalkResult = {
  /**
   * Every disallowed specifier found across the whole reachable graph, plus one
   * entry per relative import that did not resolve to a file on disk.
   */
  readonly violations: DependencyViolation[];
  /**
   * Every `.ts`/`.svelte` file the walk actually parsed for violations — the
   * original `rootFilePaths` plus everything reached transitively through a
   * literal relative import.
   */
  readonly scannedFilePaths: readonly string[];
};

/**
 * Follows every literal relative import reachable from `rootFilePaths`, closing
 * the CIN-522 escape hatch where a scanned file relatively imports a module
 * outside the scan set and that module goes completely unchecked —
 * `classifySpecifier` always waves a relative specifier through, so nothing short
 * of actually opening the file it points to can tell whether that file is clean.
 *
 * Runs as two passes over one shared `visited` set, rather than classifying each
 * newly-reached file by its own filename in isolation, so a file's shipped-versus-
 * test status is decided by how the import graph actually reaches it:
 *
 *   1. From every root NOT matched by `TEST_FILE_PATTERN`, follow relative
 *      imports to exhaustion. Everything this reaches ships, and faces the full
 *      rule (`treatAsTestFile: false`).
 *   2. From every root matched by `TEST_FILE_PATTERN`, follow relative imports
 *      into whatever pass 1 left unvisited. A file reached ONLY this way — e.g.
 *      a shared test helper used only by tests — gets the same
 *      undeclared-devDependency leniency `resolveViolationReason` already grants
 *      any `*.test.ts` file (`treatAsTestFile: true`). The forbidden-package ban
 *      still applies to it regardless — see `resolveViolationReason`.
 *
 * A file reachable from both groups is claimed by pass 1, since it runs to
 * completion first and marks the file visited — correct, because reachability
 * from any shipping root means the file ships, however else it is also reached.
 * `visited` is what makes a cycle terminate: each file is read and parsed at most
 * once, however many edges point at it.
 */
export async function walkDependencyGraph(
  rootFilePaths: readonly string[],
  declaredDependencyNames: ReadonlySet<string>,
): Promise<DependencyGraphWalkResult> {
  const visited = new Set<string>();
  const violations: DependencyViolation[] = [];
  const scannedFilePaths: string[] = [];

  async function visitFrom(
    seedFilePaths: readonly string[],
    treatAsTestFile: boolean,
  ): Promise<void> {
    // Walked with a moving index rather than `shift()`, which reindexes the whole array
    // on every step and makes the traversal quadratic as the graph grows. Paths pushed
    // while walking are picked up by the same loop, so the order is unchanged.
    const queue = [...seedFilePaths];
    for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
      const filePath = queue[queueIndex]!;
      if (visited.has(filePath)) continue;
      visited.add(filePath);
      if (!isScannableSourceFile(filePath)) continue;

      const content = await Bun.file(filePath).text();
      scannedFilePaths.push(filePath);
      violations.push(
        ...findDependencyViolations(content, filePath, declaredDependencyNames, {
          treatAsTestFile,
        }),
      );

      const lineStartOffsets = buildLineStartOffsets(content);
      const lines = content.split('\n');
      for (const parsed of collectAllSpecifiers(content, filePath)) {
        if (!parsed.isLiteral || !isRelativeSpecifier(parsed.specifier)) continue;
        const resolvedPath = resolveRelativeSpecifier(parsed.specifier, filePath);
        if (resolvedPath === undefined) {
          const lineNumber = lineNumberForOffset(lineStartOffsets, parsed.offset);
          violations.push({
            filePath,
            lineNumber,
            specifier: parsed.specifier,
            line: (lines[lineNumber - 1] ?? '').trim(),
            reason: UNRESOLVED_RELATIVE_IMPORT_REASON,
          });
          continue;
        }
        if (!visited.has(resolvedPath)) queue.push(resolvedPath);
      }
    }
  }

  const testRootFilePaths = rootFilePaths.filter((filePath) => TEST_FILE_PATTERN.test(filePath));
  const productionRootFilePaths = rootFilePaths.filter(
    (filePath) => !TEST_FILE_PATTERN.test(filePath),
  );

  await visitFrom(productionRootFilePaths, false);
  await visitFrom(testRootFilePaths, true);

  return { violations, scannedFilePaths };
}

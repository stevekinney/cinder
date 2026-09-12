/**
 * CIN-204: virtual-list dependency-free guard.
 *
 * The virtual-list engine (`packages/components/src/components/virtual-list/**`
 * and its one shared utility, `src/utilities/fixed-virtual-window.ts`) is
 * deliberately hand-rolled rather than built on `@tanstack/virtual-core` —
 * `tree` and `data-grid` already depend on that package, but virtual-list's
 * whole design point (see the Wave 1 design document) is a small, dependency-
 * free measurement/offset engine. Nothing stops a future edit from reaching for
 * `@tanstack/virtual-core` (it is already a declared dependency of this
 * package, imported by other components) or from quietly introducing some
 * other new bare import into this one subtree without a corresponding,
 * reviewed `dependencies` entry.
 *
 * This script starts from every `.ts`/`.svelte` file under
 * `packages/components/src/components/virtual-list/**` plus
 * `packages/components/src/utilities/fixed-virtual-window.ts`, parses every
 * `import`/`export ... from`/`import x = require(...)` specifier (dynamic
 * `import()` included), and — via `walkDependencyGraph` — follows every literal
 * RELATIVE one transitively to whatever file it resolves to, so a relative hop to
 * a module outside that starting set cannot smuggle in anything unchecked (CIN-522).
 * It fails if any specifier reached this way:
 *
 *   - is exactly `@tanstack/virtual-core`, or
 *   - is a bare specifier (not relative, not `svelte`/`svelte/*`, not a
 *     Node/Bun builtin) that is not already listed in this package's
 *     `package.json` `dependencies` — unless the file it was found in is reached
 *     ONLY through relative imports from a `*.test.ts`/`*.spec.ts` file, in which
 *     case it never ships and the undeclared-dependency rule does not apply (see
 *     `walkDependencyGraph`'s doc comment for exactly how that is decided).
 *
 * Registered as `check:virtual-list-dependency-free` and wired into
 * `lint:invariants` so it is CI-gated, not merely runnable.
 * `check-pipeline-coverage.ts`'s `DECLARATION_TABLE` still needs a row for
 * this command naming the layers it runs in (`unit-tests`, `main-green`,
 * alongside its `lint:invariants` siblings) — that table lives outside this
 * script and is not edited here.
 * `_internal/dependency-free.test.ts` is a companion Bun regression asserting
 * the same invariant independently, so a local `bun test` run (not just CI)
 * catches a violation without needing this script.
 *
 * oxlint cannot express this rule (no per-glob `no-restricted-imports` scoping
 * in our config, and the forbidden specifier only applies to one subtree, not
 * the whole package). A scanned grep with an explicit allow-list is the
 * simplest durable enforcement, matching `check-no-cycle-imports.ts`.
 */

import { Glob } from 'bun';
import { existsSync, statSync } from 'node:fs';
import { isBuiltin } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse as parseSvelte } from 'svelte/compiler';
import ts from 'typescript';

import { readJsonFile } from './lib/read-json-file.ts';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDirectory, '..');
const packageJsonPath = join(packageRoot, 'package.json');
const virtualListRoot = join(packageRoot, 'src', 'components', 'virtual-list');
const fixedVirtualWindowFile = join(packageRoot, 'src', 'utilities', 'fixed-virtual-window.ts');

/**
 * `_internal/dependency-free.test.ts` (relative to `virtualListRoot`) is this
 * script's own companion regression. It legitimately contains the literal
 * `@tanstack/virtual-core` specifier — and other fabricated bare-specifier
 * text — as INERT test fixture strings, exercising this very script's
 * failure path against synthetic source (see its module doc). A grep-based
 * scanner cannot distinguish "a string literal containing import-shaped
 * text" from a real import, so it is excluded here by exact relative path,
 * the same way `check-no-bare-console-warn.ts` allowlists its one legitimate
 * exception. Every OTHER test file under `virtual-list/**` stays in scope.
 */
const SELF_TEST_RELATIVE_PATH = join('_internal', 'dependency-free.test.ts');

/** The one specifier this guard bans outright, regardless of `dependencies`. */
export const FORBIDDEN_SPECIFIER = '@tanstack/virtual-core';

/** Files whose imports never ship, so the undeclared-bare-import rule does not apply to them. */
const TEST_FILE_PATTERN = /\.(?:test|spec)\.[cm]?tsx?$/u;

/**
 * Whether a specifier resolves to the forbidden package, root or subpath.
 *
 * Shared by every branch on purpose. `@tanstack/virtual-core/some-entry` reduces
 * to the package root, which IS a declared dependency here, so any branch that
 * compares against the root alone waves deep imports through — which is exactly
 * what the test-file branch did after the root-or-subpath rule was added to
 * `classifySpecifier` but nowhere else.
 */
export function isForbiddenSpecifier(specifier: string): boolean {
  return specifier === FORBIDDEN_SPECIFIER || specifier.startsWith(`${FORBIDDEN_SPECIFIER}/`);
}

const FORBIDDEN_SPECIFIER_REASON =
  'the virtual-list engine (CIN-204) must stay dependency-free of @tanstack/virtual-core';

/** One disallowed import specifier found in a scanned virtual-list source file. */
export type DependencyViolation = {
  /** Absolute path of the file the violation was found in. */
  filePath: string;
  /** 1-indexed line number within `filePath`. */
  lineNumber: number;
  /** The raw specifier text as written in the source (e.g. `@tanstack/virtual-core`). */
  specifier: string;
  /** The full source line, trimmed, for context in the failure message. */
  line: string;
  /** Human-readable explanation of why this specifier is disallowed. */
  reason: string;
};

function isRelativeSpecifier(specifier: string): boolean {
  return specifier.startsWith('.') || specifier.startsWith('/');
}

function isSvelteSpecifier(specifier: string): boolean {
  return specifier === 'svelte' || specifier.startsWith('svelte/');
}

/**
 * The installable package name a specifier resolves to — everything up to
 * (and including) the scope segment for a scoped package (`@scope/name`), or
 * just the first path segment otherwise. This is what gets looked up against
 * `package.json`'s `dependencies` keys, so `@lostgradient/markdown/foo` and
 * `@lostgradient/markdown` both resolve to the same declared dependency name.
 */
export function packageNameFromSpecifier(specifier: string): string {
  const segments = specifier.split('/');
  if (specifier.startsWith('@')) {
    const [scope, name] = segments;
    return scope === undefined || name === undefined ? specifier : `${scope}/${name}`;
  }
  return segments[0] ?? specifier;
}

/**
 * Returns a human-readable violation reason if `specifier` is not allowed in
 * the virtual-list engine, or `undefined` if it is allowed.
 */
export function classifySpecifier(
  specifier: string,
  declaredDependencyNames: ReadonlySet<string>,
): string | undefined {
  // Subpaths count. `@tanstack/virtual-core/some-entry` reduces to the package
  // root, which IS a declared dependency of this package, so an exact-match check
  // alone would wave a deep import straight through the CIN-204 boundary.
  if (isForbiddenSpecifier(specifier)) {
    return FORBIDDEN_SPECIFIER_REASON;
  }
  if (isRelativeSpecifier(specifier)) return undefined;
  if (isSvelteSpecifier(specifier)) return undefined;
  if (isBuiltin(specifier)) return undefined;

  const packageName = packageNameFromSpecifier(specifier);
  if (declaredDependencyNames.has(packageName)) return undefined;

  return (
    `bare import "${packageName}" is not declared in packages/components/package.json ` +
    '"dependencies" (and is not relative, "svelte"/"svelte/*", or a Node/Bun builtin)'
  );
}

/** One import found by the parser, with the offset it was written at. */
type ParsedSpecifier = {
  /** The resolved specifier, or the raw argument text when it is not a literal. */
  readonly specifier: string;
  readonly offset: number;
  readonly isDynamic: boolean;
  /**
   * False for a dynamic `import()` whose argument is not a string literal — a
   * variable, a concatenation, an interpolated template. Nothing can resolve those
   * statically, so shipped source is not allowed to contain them here.
   */
  readonly isLiteral: boolean;
};

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

  const literalText = (node: ts.Node): string | undefined => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    return undefined;
  };

  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined
    ) {
      const specifier = literalText(node.moduleSpecifier);
      if (specifier !== undefined) {
        found.push({
          specifier,
          offset: baseOffset + node.moduleSpecifier.getStart(sourceFile),
          isDynamic: false,
          isLiteral: true,
        });
      }
    }

    // `export type X = import('pkg').Y` — the specifier is retained in the emitted
    // declaration file, so a published consumer resolves it exactly like a value
    // import. A type-only reference to the forbidden package is still a reference.
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      const literal = node.argument.literal;
      if (ts.isStringLiteral(literal)) {
        found.push({
          specifier: literal.text,
          offset: baseOffset + literal.getStart(sourceFile),
          isDynamic: false,
          isLiteral: true,
        });
      }
    }

    // `require('pkg')` loads a real dependency that a bundler will include, and Bun's
    // types make it legal TypeScript here, so leaving it unscanned would let a
    // forbidden or undeclared package in through the side door.
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'require' &&
      node.arguments.length === 1
    ) {
      const [argument] = node.arguments;
      if (argument !== undefined) {
        const specifier = literalText(argument);
        found.push({
          specifier: specifier ?? argument.getText(sourceFile),
          offset: baseOffset + argument.getStart(sourceFile),
          isDynamic: true,
          isLiteral: specifier !== undefined,
        });
      }
    }

    // `import x = require('pkg')` is TypeScript's own import-equals form, still legal
    // in a `.ts` file compiled as CommonJS-interop, and loads exactly as real a
    // dependency as `import x from 'pkg'` does. `ts.forEachChild` does not surface it
    // through either of the two branches above — its right-hand side is an
    // `ExternalModuleReference` node, not a `CallExpression` — so a bare `visit` walk
    // skips it unless asked for by name. It is a static declaration, not a runtime
    // call, hence `isDynamic: false` here (matching the plain `import`/`export from`
    // branch above), even though `require()` calls are treated as dynamic.
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      const { expression } = node.moduleReference;
      const specifier = literalText(expression);
      found.push({
        specifier: specifier ?? expression.getText(sourceFile),
        offset: baseOffset + expression.getStart(sourceFile),
        isDynamic: false,
        isLiteral: specifier !== undefined,
      });
    }

    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const [argument] = node.arguments;
      if (argument !== undefined) {
        const specifier = literalText(argument);
        found.push({
          specifier: specifier ?? argument.getText(sourceFile),
          offset: baseOffset + argument.getStart(sourceFile),
          isDynamic: true,
          isLiteral: specifier !== undefined,
        });
      }
    }

    ts.forEachChild(node, visit);
  };

  ts.forEachChild(sourceFile, visit);
  return found;
}

const NONLITERAL_DYNAMIC_IMPORT_REASON =
  'a dynamic import() in shipped virtual-list source must take a string literal, so this ' +
  'guard can verify what it resolves to; a variable or interpolated argument cannot be ' +
  'checked and would bypass both the @tanstack/virtual-core ban and the declared-dependency rule';

/**
 * Decides whether one parsed import is a violation.
 *
 * TEST FILES face ONLY the forbidden-package ban, and only where the specifier is
 * a literal — a computed `import(name)` cannot be resolved to a package by
 * anything, so there is nothing to compare against. That is acceptable here
 * precisely because test files do not ship. They
 * legitimately reach for devDependencies — `import { render } from
 * '@testing-library/svelte'` as much as the dynamic form — and this guard resolves
 * bare specifiers against `dependencies` alone, so the full rule would flag every
 * one of them. Nothing in a test file ships, so the undeclared-import risk does
 * not apply there.
 *
 * SHIPPED SOURCE faces the full rule, and additionally may not use a dynamic
 * `import()` with a non-literal argument at all: `await import(packageName)` is
 * unresolvable by any static scanner, so permitting it would leave an opening
 * wide enough to drive the whole guard through.
 */
function resolveViolationReason(
  parsed: ParsedSpecifier,
  isTestFile: boolean,
  declaredDependencyNames: ReadonlySet<string>,
): string | undefined {
  if (isTestFile) {
    return parsed.isLiteral && isForbiddenSpecifier(parsed.specifier)
      ? FORBIDDEN_SPECIFIER_REASON
      : undefined;
  }
  if (!parsed.isLiteral) return NONLITERAL_DYNAMIC_IMPORT_REASON;
  return classifySpecifier(parsed.specifier, declaredDependencyNames);
}

/**
 * Every import specifier `content` contains: for a `.ts` file, the whole file
 * parsed once; for a `.svelte` file, each `<script>` body parsed separately (see
 * `extractScriptBlocks`) plus the template walked on its own (see
 * `collectTemplateSpecifiers`), since a template `{#await import(...)}` lives
 * outside every script body.
 *
 * Shared by `findDependencyViolations` (classifies each specifier) and
 * `walkDependencyGraph` (follows the relative ones to the file they resolve to) so
 * both see the exact same import list for a given file — the two-parser drift this
 * module's history warns about (see the module doc) is a risk only when a
 * scanner is reimplemented, not when it is reused.
 */
function collectAllSpecifiers(content: string, filePath: string): ParsedSpecifier[] {
  const isSvelte = filePath.endsWith('.svelte');
  const blocks = isSvelte ? extractScriptBlocks(content) : [{ text: content, offset: 0 }];
  const parsedSpecifiers = blocks.flatMap((block) => collectSpecifiers(block.text, block.offset));
  if (isSvelte) parsedSpecifiers.push(...collectTemplateSpecifiers(content));
  return parsedSpecifiers;
}

/** Overrides for {@link findDependencyViolations}. */
export type FindDependencyViolationsOptions = {
  /**
   * Forces the shipped-source-versus-test-file rule (see {@link resolveViolationReason})
   * for this call, in place of `TEST_FILE_PATTERN.test(filePath)`. `walkDependencyGraph`
   * passes this once it has determined whether the file is reachable from a
   * shipping entry point at all, rather than from its filename alone — a file
   * reached ONLY through a relative import from a test file (e.g.
   * `src/test/happy-dom.ts`, which never ships) needs the lenient rule even though
   * its own name does not end in `.test.ts`. Omitted, this call behaves exactly as
   * it always has.
   */
  readonly treatAsTestFile?: boolean;
};

/**
 * Returns one {@link DependencyViolation} per disallowed specifier in `content`.
 * Pure and filesystem-free so it can be exercised directly against fabricated
 * source text (see `_internal/dependency-free.test.ts`).
 *
 * See {@link resolveViolationReason} for the shipped-source versus test-file rules.
 */
export function findDependencyViolations(
  content: string,
  filePath: string,
  declaredDependencyNames: ReadonlySet<string>,
  options?: FindDependencyViolationsOptions,
): DependencyViolation[] {
  const isTestFile = options?.treatAsTestFile ?? TEST_FILE_PATTERN.test(filePath);
  const lineStartOffsets = buildLineStartOffsets(content);
  const lines = content.split('\n');
  const parsedSpecifiers = collectAllSpecifiers(content, filePath);

  const violations: DependencyViolation[] = [];
  {
    for (const parsed of parsedSpecifiers) {
      const reason = resolveViolationReason(parsed, isTestFile, declaredDependencyNames);
      if (reason === undefined) continue;
      const lineNumber = lineNumberForOffset(lineStartOffsets, parsed.offset);
      violations.push({
        filePath,
        lineNumber,
        specifier: parsed.specifier,
        line: (lines[lineNumber - 1] ?? '').trim(),
        reason,
      });
    }
  }

  return violations.sort((left, right) => left.lineNumber - right.lineNumber);
}

/** Byte offset at which each line starts, for mapping a match index to a line number. */
function buildLineStartOffsets(content: string): number[] {
  const offsets = [0];
  for (let index = 0; index < content.length; index += 1) {
    if (content[index] === '\n') offsets.push(index + 1);
  }
  return offsets;
}

/** 1-indexed line number containing `offset`, by binary search over line starts. */
function lineNumberForOffset(lineStartOffsets: readonly number[], offset: number): number {
  let low = 0;
  let high = lineStartOffsets.length - 1;
  let result = 0;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if ((lineStartOffsets[middle] ?? 0) <= offset) {
      result = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return result + 1;
}

type PackageManifest = { dependencies?: Record<string, string> };

/** Reads `packages/components/package.json`'s `dependencies` keys. */
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
 *      `src/test/happy-dom.ts`, which `package.json`'s `files` allowlist excludes
 *      from the published tarball — never ships, so it gets the same
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

async function main(): Promise<void> {
  const declaredDependencyNames = await loadDeclaredDependencyNames();
  const rootFilePaths = await collectScanTargets();
  const { violations, scannedFilePaths } = await walkDependencyGraph(
    rootFilePaths,
    declaredDependencyNames,
  );

  if (violations.length === 0) {
    process.stdout.write(
      `check-virtual-list-dependency-free — OK (${scannedFilePaths.length} files, no ` +
        '@tanstack/virtual-core or undeclared bare imports).\n',
    );
    return;
  }

  process.stderr.write(
    'check-virtual-list-dependency-free — forbidden imports detected.\n' +
      'packages/components/src/components/virtual-list/** and fixed-virtual-window.ts must never ' +
      'import `@tanstack/virtual-core`, and every other bare import must already be declared in ' +
      "packages/components/package.json's `dependencies`. Use a relative import, or add the " +
      'package to `dependencies` if this is a deliberate, reviewed addition.\n\n',
  );
  for (const violation of violations) {
    process.stderr.write(
      `  ${violation.filePath}:${violation.lineNumber}\n` +
        `    ${violation.line}\n` +
        `    "${violation.specifier}" — ${violation.reason}\n`,
    );
  }
  process.exit(1);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error('check-virtual-list-dependency-free failed:', error);
    process.exit(1);
  });
}

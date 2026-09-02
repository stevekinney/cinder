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
 * This script walks every `.ts`/`.svelte` file under
 * `packages/components/src/components/virtual-list/**` plus
 * `packages/components/src/utilities/fixed-virtual-window.ts`, parses every
 * `import`/`export ... from` specifier, and fails if any specifier:
 *
 *   - is exactly `@tanstack/virtual-core`, or
 *   - is a bare specifier (not relative, not `svelte`/`svelte/*`, not a
 *     Node/Bun builtin) that is not already listed in this package's
 *     `package.json` `dependencies`.
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
  const sourceFile = ts.createSourceFile(
    'scan.tsx',
    text,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TSX,
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
): DependencyViolation[] {
  const isTestFile = TEST_FILE_PATTERN.test(filePath);
  const lineStartOffsets = buildLineStartOffsets(content);
  const lines = content.split('\n');

  const isSvelte = filePath.endsWith('.svelte');
  const blocks = isSvelte ? extractScriptBlocks(content) : [{ text: content, offset: 0 }];
  const parsedSpecifiers = blocks.flatMap((block) => collectSpecifiers(block.text, block.offset));
  if (isSvelte) parsedSpecifiers.push(...collectTemplateSpecifiers(content));

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

async function main(): Promise<void> {
  const declaredDependencyNames = await loadDeclaredDependencyNames();
  const files = await collectScanTargets();

  const violations: DependencyViolation[] = [];
  for (const filePath of files) {
    const content = await Bun.file(filePath).text();
    violations.push(...findDependencyViolations(content, filePath, declaredDependencyNames));
  }

  if (violations.length === 0) {
    process.stdout.write(
      `check-virtual-list-dependency-free — OK (${files.length} files, no @tanstack/virtual-core ` +
        'or undeclared bare imports).\n',
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

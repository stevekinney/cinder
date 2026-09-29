import { isBuiltin } from 'node:module';
import {
  collectAllSpecifiers,
  type ParsedSpecifier,
} from './check-virtual-list-dependency-free-parser.ts';

/** The one specifier this guard bans outright, regardless of `dependencies`. */
export const FORBIDDEN_SPECIFIER = '@tanstack/virtual-core';
/** Test modules and their named support modules are test roots, unless production imports them. */
export const TEST_FILE_PATTERN =
  /(?:\.(?:test|spec)|-test-(?:helpers|fixtures|utilities))\.[cm]?tsx?$/u;

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
 * `package.json`'s `dependencies` keys, so `@lostgradient/markdown` and
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
    `bare import "${packageName}" is not declared in components/cinder/package.json ` +
    '"dependencies" (and is not relative, "svelte"/"svelte/*", or a Node/Bun builtin)'
  );
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

/** Overrides for {@link findDependencyViolations}. */
export type FindDependencyViolationsOptions = {
  /**
   * Forces the shipped-source-versus-test-file rule (see {@link resolveViolationReason})
   * for this call, in place of `TEST_FILE_PATTERN.test(filePath)`. `walkDependencyGraph`
   * passes this once it has determined whether the file is reachable from a
   * shipping entry point at all, rather than from its filename alone — a file
   * reached ONLY through a relative import from a test file (e.g.
   * a shared test helper, which never ships) needs the lenient rule even though
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

  return violations.toSorted((left, right) => left.lineNumber - right.lineNumber);
}

/** Byte offset at which each line starts, for mapping a match index to a line number. */
export function buildLineStartOffsets(content: string): number[] {
  const offsets = [0];
  for (let index = 0; index < content.length; index += 1) {
    if (content[index] === '\n') offsets.push(index + 1);
  }
  return offsets;
}

/** 1-indexed line number containing `offset`, by binary search over line starts. */
export function lineNumberForOffset(lineStartOffsets: readonly number[], offset: number): number {
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

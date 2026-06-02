/**
 * Token-usage discipline report + guard for Cinder component styles.
 *
 * Backs the themeability policy: a consumer overrides a documented set of design
 * tokens and the whole library follows. That contract breaks when component CSS
 * references a `var(--cinder-*)` name that resolves to nothing — a typo, a stale
 * rename, or an undeclared "looks-like-a-token" name. Those references silently
 * fall back to their inline default (or `unset`), so the component stops tracking
 * the token system without any error.
 *
 * Every `var(--cinder-*)` reference in component styling is classified into one
 * category, and the report groups by category so a fixer knows the right action:
 *   - `global`         — a documented token declared in `tokens-base.css`. OK.
 *   - `component-owned` — `--cinder-<this-file's-component>-*`. A public component
 *     override variable, valid even when only ever read-with-fallback / JS-set. OK.
 *   - `private`         — `--_cinder-*`. An implementation detail. OK.
 *   - `runtime`         — a JS/inline-style-set state variable on the runtime
 *     allowlist (read OUTSIDE its owning component). OK, documented.
 *   - `unresolved`      — none of the above. This is the debt: a stale name to
 *     rename, a missing token to add to `tokens-base.css`, or a cross-component
 *     reference that should be a shared token. REPORTED.
 *
 * The ownership prefix is the CURRENT FILE's own component-directory name, NOT
 * "any component name." This matters: a `surface/` component dir exists, so an
 * "any-dir" rule would wrongly bless the stale `--cinder-surface-muted` reference
 * in `feed.css` as component-owned. Per-file-prefix flags it correctly.
 *
 * Two modes (mirrors `check-platform-features.ts` / `check-component-css-raw-colors.ts`):
 *   - default: print the per-category inventory + the unresolved sites. Exits 0.
 *   - `--strict`: compare unresolved sites against the baseline
 *     (`token-usage-baseline.json`); exit non-zero only when a NEW unresolved
 *     reference appears. `--update-baseline` rewrites it after an intentional
 *     change (a stale name fixed → the baseline shrinks).
 *
 * Run via `bun run --filter=cinder tokens:audit` (report) / `tokens:audit
 * --strict` (gate; wired into `validate` once report output is clean).
 */

import { Glob } from 'bun';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const componentsRoot = resolve(scriptDirectory, '..');
const componentsSource = join(componentsRoot, 'src');
const tokensBasePath = join(componentsSource, 'styles', 'tokens-base.css');
const baselinePath = join(scriptDirectory, 'token-usage-baseline.json');

/**
 * Runtime-state variables that are set from JS (`element.style.setProperty`) or an
 * inline `style:` binding and READ from a file other than their owning component.
 * Component-prefixed runtime vars (e.g. `--cinder-color-picker-hue`) do NOT belong
 * here — they resolve via the component-owned rule from their own component. Each
 * entry needs a written reason so the allowlist stays honest.
 */
export const RUNTIME_VARIABLE_ALLOWLIST: Array<{ name: string; reason: string }> = [
  // (none yet — every runtime var found so far is component-prefixed and resolves
  // via the component-owned rule. Add cross-component runtime vars here with a reason.)
];

/**
 * Shared CSS partials under `src/styles/components/` have no component directory,
 * so their "owned" custom-property prefixes are enumerated explicitly. A reference
 * in one of these files is `component-owned` when it matches one of the listed
 * prefixes. Keep this minimal and reasoned.
 */
export const SHARED_PARTIAL_OWNED_PREFIXES: Record<string, string[]> = {
  'src/styles/components/_input-frame.css': ['--cinder-input-frame'],
  'src/styles/components/_control-item.css': ['--cinder-control-item'],
  'src/styles/components/_dismiss-button.css': ['--cinder-dismiss-button'],
  'src/styles/components/_floating-surface.css': ['--cinder-floating-surface'],
  'src/styles/components/json-highlight.css': ['--cinder-json-highlight'],
  'src/styles/components/experimental/_json-viewer-node.css': ['--cinder-json-viewer'],
  'src/styles/components/experimental/popover.css': ['--cinder-popover'],
  'src/styles/components/experimental.css': [],
};

export type TokenCategory = 'global' | 'component-owned' | 'private' | 'runtime' | 'unresolved';

export type TokenFlag = {
  /** Source-relative POSIX path. */
  filePath: string;
  /** 1-based line number where the reference starts. */
  lineNumber: number;
  /** The full custom-property name, e.g. `--cinder-surface-muted`. */
  name: string;
  /** Resolution category. */
  category: TokenCategory;
};

/** Normalizes a path to forward slashes so baseline keys are OS-independent. */
export function toPosixPath(path: string): string {
  return path.replaceAll('\\', '/');
}

/** True for test/spec sources, which are never part of the authoring rule. */
export function isTestPath(relativePath: string): boolean {
  return (
    /(?:^|\/)__tests__\//.test(relativePath) ||
    /\.(?:test|spec)\.[cm]?tsx?$/.test(relativePath) ||
    /\.examples?\.json$/.test(relativePath)
  );
}

/** Strips block comments, preserving newline count (shared shape across guards). */
export function stripCssComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, (comment) => {
    const newlines = comment.match(/\n/g)?.length ?? 0;
    return ' ' + '\n'.repeat(newlines);
  });
}

/** Keeps only `<style>` content for a `.svelte` file; passes `.css` through. */
export function extractStyleSurface(source: string, isSvelte: boolean): string {
  if (!isSvelte) return source;
  const styleBlock = /<style\b[^>]*>([\s\S]*?)<\/style>/g;
  let result = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = styleBlock.exec(source)) !== null) {
    const blockStart = match.index + match[0].indexOf('>') + 1;
    const blockEnd = blockStart + (match[1]?.length ?? 0);
    result += source.slice(lastIndex, blockStart).replace(/[^\n]/g, ' ');
    result += source.slice(blockStart, blockEnd);
    lastIndex = blockEnd;
  }
  result += source.slice(lastIndex).replace(/[^\n]/g, ' ');
  return result;
}

/**
 * Parses the set of globally declared `--cinder-*` token names from a stylesheet
 * body (intended to be `tokens-base.css`). A declaration is a custom property on
 * the left-hand side of a `:` (`  --cinder-space-4: 1rem;`). Pure for testability.
 */
export function parseGlobalTokens(tokensBaseSource: string): Set<string> {
  const tokens = new Set<string>();
  const declaration = /(--cinder-[a-z0-9-]+)\s*:/g;
  let match: RegExpExecArray | null;
  while ((match = declaration.exec(tokensBaseSource)) !== null) {
    if (match[1]) tokens.add(match[1]);
  }
  return tokens;
}

/**
 * Extracts every custom-property name a source DECLARES or SETS: a CSS LHS
 * declaration (`--cinder-kanban-column-width: 18rem;`), a JS
 * `style.setProperty('--cinder-toast-height', …)`, or an inline Svelte
 * `style="--cinder-toast-swipe-x: …"` / `style:--x`. These are the variables a
 * component OWNS even when its prefix is a shortened form of the directory name
 * (`toast-region/` owns `--cinder-toast-*`; `kanban-board/` owns
 * `--cinder-kanban-*`). Pure for testability.
 */
export function findDeclaredNames(source: string): Set<string> {
  const declared = new Set<string>();
  // CSS LHS declaration: `--cinder-x:` not preceded by `var(` (a reference).
  const cssDeclaration =
    /(^|[;{]\s*|\(\s*--_?cinder[a-z0-9-]*\s*,\s*)?(--_?cinder-[a-z0-9-]+)\s*:/g;
  let match: RegExpExecArray | null;
  while ((match = cssDeclaration.exec(source)) !== null) {
    // Skip a `:` that is actually a pseudo-class or value separator inside var().
    // A real declaration's name is captured in group 2; `var(--x, --y:...)` won't
    // produce a bare `--y:` so this stays accurate for our inputs.
    if (match[2]) declared.add(match[2]);
  }
  const setProperty = /setProperty\(\s*['"](--_?cinder-[a-z0-9-]+)/g;
  while ((match = setProperty.exec(source)) !== null) {
    if (match[1]) declared.add(match[1]);
  }
  return declared;
}

/**
 * Derives the owning component prefix for a component-tree file path. For
 * `src/components/color-picker/color-picker.css` the component dir is
 * `color-picker`, so the owned prefix is `--cinder-color-picker`. Leaf files in a
 * compound component (e.g. `accordion-item/`) own their own dir's prefix; a family
 * reference to the parent is intentionally NOT auto-owned (parent tokens that are
 * shared belong in tokens-base or are flagged for promotion). Returns null for a
 * path that is not directly under `src/components/<dir>/`.
 */
export function componentOwnedPrefix(posixPath: string): string | null {
  const match = /^src\/components\/([^/]+)\//.exec(posixPath);
  if (!match || !match[1]) return null;
  // A bare file like `src/components/_sortable-item.svelte` has no component dir.
  if (match[1].endsWith('.svelte')) return null;
  return `--cinder-${match[1]}`;
}

/** True when `name` equals `prefix` or extends it at a hyphen boundary. */
export function matchesPrefix(name: string, prefix: string): boolean {
  return name === prefix || name.startsWith(`${prefix}-`);
}

/**
 * Classifies a single `--cinder-*` reference for a file. `ownedPrefixes` are the
 * file's component-owned prefixes (dir-derived or shared-partial); `ownedDeclared`
 * is the set of custom-property names the file's OWN component declares/sets
 * (catches shortened prefixes like `toast-region/` owning `--cinder-toast-*`);
 * `globals` is the set of declared global token names. Pure for testability.
 */
export function classifyReference(
  name: string,
  ownedPrefixes: string[],
  ownedDeclared: Set<string>,
  globals: Set<string>,
): TokenCategory {
  if (name.startsWith('--_cinder')) return 'private';
  if (globals.has(name)) return 'global';
  if (ownedPrefixes.some((prefix) => matchesPrefix(name, prefix))) return 'component-owned';
  if (ownedDeclared.has(name)) return 'component-owned';
  if (RUNTIME_VARIABLE_ALLOWLIST.some((entry) => entry.name === name)) return 'runtime';
  return 'unresolved';
}

/** The component-dir key for a component-tree posix path, or null. */
export function componentDirKey(posixPath: string): string | null {
  const match = /^src\/components\/([^/]+)\//.exec(posixPath);
  if (!match || !match[1] || match[1].endsWith('.svelte')) return null;
  return match[1];
}

/** All `var(--cinder-*)` reference names + line numbers in a (stripped) surface. */
export function findReferences(surface: string): Array<{ name: string; lineNumber: number }> {
  const references: Array<{ name: string; lineNumber: number }> = [];
  // Match each `var( --cinder-NAME` opener — a nested fallback
  // `var(--a, var(--b))` yields two openers, so both --a and --b are captured.
  const pattern = /var\(\s*(--_?cinder-[a-z0-9-]+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(surface)) !== null) {
    const name = match[1];
    if (!name) continue;
    const lineNumber = surface.slice(0, match.index).split('\n').length;
    references.push({ name, lineNumber });
  }
  return references;
}

/** Scans every component style surface and classifies every `--cinder-*` reference. */
export async function scan(globals: Set<string>): Promise<TokenFlag[]> {
  const flags: TokenFlag[] = [];
  const scanRoots = [
    { dir: join(componentsSource, 'components'), prefix: 'src/components' },
    { dir: join(componentsSource, 'styles', 'components'), prefix: 'src/styles/components' },
  ];

  // Pass 1: collect, per component directory, every custom-property name that
  // component declares or sets (across ALL its files, including .svelte script +
  // markup). A reference to one of its OWN declared names is component-owned even
  // when the prefix is a shortened form of the directory name.
  const declaredByComponent = new Map<string, Set<string>>();
  for (const { dir } of scanRoots) {
    const glob = new Glob('**/*.{css,svelte,ts}');
    for await (const relativePath of glob.scan({ cwd: dir })) {
      if (isTestPath(relativePath)) continue;
      const posix = `src/components/${toPosixPath(relativePath)}`;
      const componentKey = componentDirKey(posix);
      if (!componentKey) continue;
      const declared = findDeclaredNames(await Bun.file(join(dir, relativePath)).text());
      if (declared.size === 0) continue;
      const existing = declaredByComponent.get(componentKey) ?? new Set<string>();
      for (const name of declared) existing.add(name);
      declaredByComponent.set(componentKey, existing);
    }
  }

  // Pass 2: classify every reference in .css / .svelte <style> surfaces.
  for (const { dir, prefix } of scanRoots) {
    const glob = new Glob('**/*.{css,svelte}');
    for await (const relativePath of glob.scan({ cwd: dir })) {
      if (isTestPath(relativePath)) continue;
      const posix = `${prefix}/${toPosixPath(relativePath)}`;
      const ownedPrefixes =
        SHARED_PARTIAL_OWNED_PREFIXES[posix] ??
        ((p) => (p ? [p] : []))(componentOwnedPrefix(posix));
      const componentKey = componentDirKey(posix);
      const ownedDeclared =
        (componentKey && declaredByComponent.get(componentKey)) || new Set<string>();

      const rawSource = await Bun.file(join(dir, relativePath)).text();
      const surface = stripCssComments(
        extractStyleSurface(rawSource, relativePath.endsWith('.svelte')),
      );

      for (const reference of findReferences(surface)) {
        flags.push({
          filePath: posix,
          lineNumber: reference.lineNumber,
          name: reference.name,
          category: classifyReference(reference.name, ownedPrefixes, ownedDeclared, globals),
        });
      }
    }
  }
  return flags;
}

// ── Baseline (count-based, unresolved only) ─────────────────────────────────────

export type BaselineEntry = { filePath: string; name: string; allowedCount: number };

/** Identity key for an unresolved reference: file + token name. */
export function flagKey(flag: { filePath: string; name: string }): string {
  return `${flag.filePath}::${flag.name}`;
}

export function countByKey(flags: Array<{ filePath: string; name: string }>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const flag of flags) {
    counts.set(flagKey(flag), (counts.get(flagKey(flag)) ?? 0) + 1);
  }
  return counts;
}

function isBaselineEntry(value: unknown): value is BaselineEntry {
  if (typeof value !== 'object' || value === null) return false;
  return (
    typeof (value as { filePath?: unknown }).filePath === 'string' &&
    typeof (value as { name?: unknown }).name === 'string' &&
    typeof (value as { allowedCount?: unknown }).allowedCount === 'number'
  );
}

export function parseBaseline(parsed: unknown): Map<string, number> {
  if (!Array.isArray(parsed)) {
    throw new Error('baseline must be a JSON array of {filePath, name, allowedCount} entries.');
  }
  const allowed = new Map<string, number>();
  for (const entry of parsed) {
    if (!isBaselineEntry(entry)) {
      throw new Error(`invalid baseline entry: ${JSON.stringify(entry)}`);
    }
    allowed.set(flagKey(entry), entry.allowedCount);
  }
  return allowed;
}

export async function readBaseline(): Promise<Map<string, number>> {
  const file = Bun.file(baselinePath);
  if (!(await file.exists())) return new Map();
  return parseBaseline(await file.json());
}

export function buildBaselineEntries(
  flags: Array<{ filePath: string; name: string }>,
): BaselineEntry[] {
  const counts = countByKey(flags);
  const byKey = new Map<string, BaselineEntry>();
  for (const flag of flags) {
    const key = flagKey(flag);
    if (!byKey.has(key)) {
      byKey.set(key, {
        filePath: flag.filePath,
        name: flag.name,
        allowedCount: counts.get(key) ?? 0,
      });
    }
  }
  return [...byKey.values()].toSorted(
    (a, b) => a.filePath.localeCompare(b.filePath) || a.name.localeCompare(b.name),
  );
}

export type Regression = { filePath: string; name: string; allowed: number; found: number };

export function findRegressions(
  unresolvedFlags: Array<{ filePath: string; name: string }>,
  allowed: Map<string, number>,
): Regression[] {
  const counts = countByKey(unresolvedFlags);
  const regressions: Regression[] = [];
  for (const [key, found] of counts) {
    const allowedCount = allowed.get(key) ?? 0;
    if (found > allowedCount) {
      const separator = key.lastIndexOf('::');
      const filePath = key.slice(0, separator);
      const name = key.slice(separator + 2);
      regressions.push({ filePath, name, allowed: allowedCount, found });
    }
  }
  return regressions.toSorted(
    (a, b) => a.filePath.localeCompare(b.filePath) || a.name.localeCompare(b.name),
  );
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function renderReport(flags: TokenFlag[]): string {
  const order: TokenCategory[] = ['unresolved', 'global', 'component-owned', 'private', 'runtime'];
  const byCategory = new Map<TokenCategory, TokenFlag[]>();
  for (const flag of flags) {
    const list = byCategory.get(flag.category) ?? [];
    list.push(flag);
    byCategory.set(flag.category, list);
  }
  let report = 'Token-usage audit — Cinder component styles\n\n';
  for (const category of order) {
    const list = byCategory.get(category) ?? [];
    report += `## ${category}: ${list.length} reference(s)\n`;
    if (category === 'unresolved') {
      for (const flag of list.toSorted(
        (a, b) => a.filePath.localeCompare(b.filePath) || a.lineNumber - b.lineNumber,
      )) {
        report += `  ${flag.filePath}:${flag.lineNumber}  ${flag.name}\n`;
      }
    }
    report += '\n';
  }
  return report;
}

async function main(): Promise<void> {
  const strict = process.argv.includes('--strict');
  const updateBaseline = process.argv.includes('--update-baseline');

  const globals = parseGlobalTokens(await Bun.file(tokensBasePath).text());
  const flags = await scan(globals);
  const unresolved = flags.filter((flag) => flag.category === 'unresolved');

  if (updateBaseline) {
    const entries = buildBaselineEntries(unresolved);
    await Bun.write(baselinePath, `${JSON.stringify(entries, null, 2)}\n`);
    process.stdout.write(`Wrote ${entries.length} baseline entries to ${baselinePath}\n`);
    return;
  }

  process.stdout.write(renderReport(flags));

  const allowed = await readBaseline();
  const baselineTotal = [...allowed.values()].reduce((sum, count) => sum + count, 0);
  const direction =
    unresolved.length > baselineTotal
      ? 'ABOVE'
      : unresolved.length < baselineTotal
        ? 'below'
        : 'at';
  process.stdout.write(
    `unresolved: ${unresolved.length} reference(s) — ${direction} baseline (${baselineTotal})\n`,
  );

  if (!strict) {
    process.exitCode = 0;
    return;
  }

  const regressions = findRegressions(unresolved, allowed);
  if (regressions.length > 0) {
    process.stderr.write(`\nNEW unresolved --cinder-* references (not in baseline):\n`);
    for (const regression of regressions) {
      process.stderr.write(
        `  ${regression.filePath}  ${regression.name}: found ${regression.found}, allowed ${regression.allowed}\n`,
      );
    }
    process.stderr.write(
      `\nDeclare the token in tokens-base.css, rename it to an existing token, use the ` +
        `component-owned prefix, or (after an intentional fix) run tokens:audit --update-baseline.\n`,
    );
    process.exitCode = 1;
    return;
  }
  process.exitCode = 0;
}

if (import.meta.main) {
  await main();
}

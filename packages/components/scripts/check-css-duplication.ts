import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  type AtRule,
  type Container,
  type Declaration,
  type Document,
  parse,
  type Root,
  type Rule,
} from 'postcss';

import { discoverComponentDirectories } from './discover-component-directories.ts';

/**
 * CSS near-duplicate admission guard (decision 8 — the behavior-first
 * admission bar, docs/decisions/component-admission-bar.md).
 *
 * A "new component" whose sidecar CSS closely duplicates an existing
 * component's is the strongest cheap signal that it is a presentation
 * variation that should have been a prop, variant, or documented example
 * preset instead. This check compares every component sidecar pairwise on a
 * normalized declaration multiset and fails on any above-threshold pair not
 * recorded in `css-duplication-baseline.json`.
 *
 * The baseline is the escape hatch AND the newness detector: legitimately
 * similar pairs are checked in with a written reason, and a brand-new
 * near-duplicate cannot already be in the checked-in baseline, so it fails
 * at PR time (this also catches an existing component's CSS being copied
 * wholesale into another existing one — strictly better than git-newness).
 *
 * Run with `--update-baseline` to add currently-flagged pairs to the
 * baseline with a TODO reason for the author to replace before commit.
 */

export type CssDuplicationPair = {
  /** Component id, lexicographically before `b`. */
  readonly a: string;
  readonly b: string;
  /** Why this similarity is legitimate — required, reviewed prose. */
  readonly reason: string;
};

export type CssDuplicationViolation = {
  readonly a: string;
  readonly b: string;
  readonly similarity: number;
  readonly message: string;
};

/** Flag pairs at or above this normalized-declaration-multiset similarity. */
export const SIMILARITY_THRESHOLD = 0.8;

/**
 * Ignore sidecars with fewer normalized declarations than this — many
 * compound-leaf sidecars are deliberately tiny and would otherwise pair with
 * each other at similarity 1.0.
 */
export const MINIMUM_DECLARATIONS = 12;

const SIBLING_LEAF_IMPORT = /^import\s+\w+\s+from\s+['"]\.\.\/([a-z0-9-]+)\/\1\.svelte['"]/;

/** Multiset of normalized `context|prop:value` declaration keys. */
export type DeclarationMultiset = Map<string, number>;

function normalizeValue(value: string, componentName: string): string {
  let normalized = value.toLowerCase().replace(/\s+/g, ' ').trim();
  // Private custom properties and component-scoped public ones are naming
  // noise, not shared vocabulary — collapse them so two components with the
  // same declaration shape but different property names still match.
  normalized = normalized.replace(/--_cinder-[a-z0-9-]+/g, '--v');
  normalized = normalized.replace(new RegExp(`--cinder-${componentName}-[a-z0-9-]+`, 'g'), '--v');
  return normalized;
}

function normalizeProperty(property: string, componentName: string): string {
  const lower = property.toLowerCase();
  if (lower.startsWith('--_cinder-')) return '--v';
  if (lower.startsWith(`--cinder-${componentName}-`)) return '--v';
  return lower;
}

function isAtRule(node: Container | Document): node is AtRule {
  return node.type === 'atrule';
}

function isRule(node: Container | Document): node is Rule {
  return node.type === 'rule';
}

function atRuleContext(node: Declaration): string {
  const parts: string[] = [];
  // Climb through every container (rules included) to the root, collecting
  // the at-rules along the way.
  let current: Container | Document | undefined = node.parent;
  while (current && current.type !== 'root') {
    // The cascade-layer wrapper is universal — not a distinguishing context.
    if (isAtRule(current) && current.name !== 'layer') {
      parts.unshift(`@${current.name} ${current.params.replace(/\s+/g, ' ').trim()}`);
    }
    current = current.parent;
  }
  return parts.join('|');
}

/**
 * Build the normalized declaration multiset for one component sidecar.
 * Selectors are dropped entirely; at-rule context (media/supports/container,
 * not the layer wrapper) prefixes each key so responsive clones count.
 */
export function declarationMultiset(root: Root, componentName: string): DeclarationMultiset {
  return declarationMultisetForComponent(root, componentName, () => true);
}

function declarationBelongsToComponent(declaration: Declaration, componentName: string): boolean {
  return declarationBelongsToClasses(declaration, [`cinder-${componentName}`]);
}

function declarationBelongsToClasses(
  declaration: Declaration,
  classNames: readonly string[],
): boolean {
  let current: Container | Document | undefined = declaration.parent;
  while (current && current.type !== 'root') {
    if (isRule(current)) {
      const rule = current;
      if (classNames.some((className) => selectorContainsComponent(rule, className))) return true;
    }
    current = current.parent;
  }
  return false;
}

function selectorContainsComponent(rule: Rule, className: string): boolean {
  return new RegExp(`(^|[^a-z0-9-])\\.${className}(?:$|--|__|[^a-z0-9-])`, 'i').test(rule.selector);
}

/** Extract Cinder classes rendered by a component, including declaration-free leaves. */
export function componentClassNamesFromMarkup(source: string): string[] {
  return [
    ...new Set([...source.matchAll(/\bcinder-[a-z0-9_-]+/gi)].map((match) => match[0])),
  ].toSorted();
}

/**
 * Build a declaration multiset from rules owned by one component. This lets a
 * compound parent keep leaf rules in its stylesheet without hiding that leaf
 * from cross-component duplication detection.
 */
export function declarationMultisetForComponent(
  root: Root,
  componentName: string,
  belongsToComponent = declarationBelongsToComponent,
): DeclarationMultiset {
  const multiset: DeclarationMultiset = new Map();
  root.walkDecls((declaration) => {
    if (!belongsToComponent(declaration, componentName)) return;
    const context = atRuleContext(declaration);
    const key = `${context}|${normalizeProperty(declaration.prop, componentName)}:${normalizeValue(
      declaration.value,
      componentName,
    )}`;
    multiset.set(key, (multiset.get(key) ?? 0) + 1);
  });
  return multiset;
}

export function multisetSize(multiset: DeclarationMultiset): number {
  let total = 0;
  for (const count of multiset.values()) total += count;
  return total;
}

/** Weighted Jaccard over two declaration multisets. */
export function multisetSimilarity(a: DeclarationMultiset, b: DeclarationMultiset): number {
  let intersection = 0;
  let union = 0;
  const keys = new Set([...a.keys(), ...b.keys()]);
  for (const key of keys) {
    const countA = a.get(key) ?? 0;
    const countB = b.get(key) ?? 0;
    intersection += Math.min(countA, countB);
    union += Math.max(countA, countB);
  }
  return union === 0 ? 0 : intersection / union;
}

/**
 * Compound-leaf imports of one component's `index.ts` (compound-family
 * edges). Only the namespace-attachment pattern — a parent barrel importing
 * a sibling's `.svelte` root (`import Tab from '../tab/tab.svelte'`) —
 * counts. CSS `@import` edges are deliberately NOT used: composed standalone
 * components (ApprovalCard, Feed, …) import many unrelated siblings' CSS as
 * dependencies, and treating those as family edges would union-find most of
 * the inventory into one exempt group and blind the guard.
 */
export function siblingLeafImports(indexSource: string): string[] {
  const leaves: string[] = [];
  for (const line of indexSource.split('\n')) {
    const match = line.trim().match(SIBLING_LEAF_IMPORT);
    if (match?.[1]) leaves.push(match[1]);
  }
  return leaves;
}

/** Union-find over compound-family edges so intra-family pairs are exempt. */
export function compoundFamilies(
  edges: ReadonlyArray<readonly [string, string]>,
): Map<string, string> {
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) !== undefined && parent.get(root) !== root) root = parent.get(root)!;
    return root;
  };
  for (const [a, b] of edges) {
    if (!parent.has(a)) parent.set(a, a);
    if (!parent.has(b)) parent.set(b, b);
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent.set(rootA, rootB);
  }
  const resolved = new Map<string, string>();
  for (const key of parent.keys()) resolved.set(key, find(key));
  return resolved;
}

export function pairKey(a: string, b: string): readonly [string, string] {
  return a < b ? [a, b] : [b, a];
}

type ComponentCss = {
  readonly name: string;
  readonly multiset: DeclarationMultiset;
  readonly familyRoot: string;
};

async function collectComponentCss(): Promise<ComponentCss[]> {
  const components = await discoverComponentDirectories();
  const sources = new Map<string, Root[]>();
  for (const component of components) {
    const componentSources: Root[] = [];
    for (const entry of readdirSync(component.directory, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.css')) continue;
      const sourcePath = join(component.directory, entry.name);
      componentSources.push(parse(readFileSync(sourcePath, 'utf8'), { from: sourcePath }));
    }
    sources.set(component.name, componentSources);
  }

  const edges: Array<readonly [string, string]> = [];
  const compoundParents = new Map<string, Set<string>>();
  for (const component of components) {
    const indexPath = join(component.directory, 'index.ts');
    if (!existsSync(indexPath)) continue;
    for (const leaf of siblingLeafImports(readFileSync(indexPath, 'utf8'))) {
      edges.push([component.name, leaf]);
      const parents = compoundParents.get(leaf) ?? new Set<string>();
      parents.add(component.name);
      compoundParents.set(leaf, parents);
    }
  }
  const families = compoundFamilies(edges);

  const results: ComponentCss[] = [];
  for (const component of components) {
    const multiset: DeclarationMultiset = new Map();
    const componentSources = sources.get(component.name) ?? [];
    const classNames = new Set([`cinder-${component.name}`]);
    for (const entry of readdirSync(component.directory, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.svelte')) continue;
      for (const className of componentClassNamesFromMarkup(
        readFileSync(join(component.directory, entry.name), 'utf8'),
      )) {
        classNames.add(className);
      }
    }
    for (const source of componentSources) {
      source.walkRules((rule) => {
        for (const match of rule.selector.matchAll(/\\.([a-z][a-z0-9-]*)/gi)) {
          if (match[1]?.startsWith('cinder-')) classNames.add(match[1]);
        }
      });
      for (const [key, count] of declarationMultisetForComponent(
        source,
        component.name,
        () => true,
      )) {
        multiset.set(key, (multiset.get(key) ?? 0) + count);
      }
    }
    for (const parent of compoundParents.get(component.name) ?? []) {
      for (const source of sources.get(parent) ?? []) {
        for (const [key, count] of declarationMultisetForComponent(
          source,
          component.name,
          (declaration) => declarationBelongsToClasses(declaration, [...classNames]),
        )) {
          multiset.set(key, (multiset.get(key) ?? 0) + count);
        }
      }
    }
    if (multiset.size === 0) continue;
    results.push({
      name: component.name,
      multiset,
      familyRoot: families.get(component.name) ?? component.name,
    });
  }
  return results;
}

export function findDuplicatePairs(
  components: readonly ComponentCss[],
  baseline: readonly CssDuplicationPair[],
): CssDuplicationViolation[] {
  const baselineKeys = new Set(baseline.map((pair) => `${pair.a} ${pair.b}`));
  const eligible = components.filter(
    (component) => multisetSize(component.multiset) >= MINIMUM_DECLARATIONS,
  );
  const violations: CssDuplicationViolation[] = [];
  for (let i = 0; i < eligible.length; i += 1) {
    for (let j = i + 1; j < eligible.length; j += 1) {
      const left = eligible[i]!;
      const right = eligible[j]!;
      if (left.familyRoot === right.familyRoot) continue;
      const similarity = multisetSimilarity(left.multiset, right.multiset);
      if (similarity < SIMILARITY_THRESHOLD) continue;
      const [a, b] = pairKey(left.name, right.name);
      if (baselineKeys.has(`${a} ${b}`)) continue;
      violations.push({
        a,
        b,
        similarity,
        message:
          `${a} and ${b} share ${(similarity * 100).toFixed(0)}% of their normalized CSS ` +
          `declarations — under the behavior-first admission bar ` +
          `(docs/decisions/component-admission-bar.md) one of them is likely a presentation ` +
          `variation that should be a prop, variant, or documented example preset. If the ` +
          `similarity is legitimate, add the pair to scripts/css-duplication-baseline.json ` +
          `with a written reason (or run this script with --update-baseline and edit the ` +
          `TODO reason).`,
      });
    }
  }
  return violations.toSorted((left, right) => right.similarity - left.similarity);
}

function baselinePath(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), 'css-duplication-baseline.json');
}

/** Baseline entries whose reason is blank or the generated TODO placeholder. */
export function placeholderBaselineEntries(
  baseline: readonly CssDuplicationPair[],
): CssDuplicationPair[] {
  return baseline.filter(
    (entry) => entry.reason.trim() === '' || entry.reason.trimStart().startsWith('TODO'),
  );
}

function isCssDuplicationPair(value: unknown): value is CssDuplicationPair {
  return (
    typeof value === 'object' &&
    value !== null &&
    'a' in value &&
    typeof value.a === 'string' &&
    'b' in value &&
    typeof value.b === 'string' &&
    'reason' in value &&
    typeof value.reason === 'string'
  );
}

export function readBaseline(): CssDuplicationPair[] {
  const path = baselinePath();
  if (!existsSync(path)) return [];
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (!Array.isArray(parsed)) {
    throw new Error(`Baseline at ${path} must be a JSON array of {a, b, reason} entries.`);
  }
  return parsed.map((entry: unknown) => {
    if (!isCssDuplicationPair(entry)) {
      throw new Error(
        `Malformed baseline entry in ${path}: ${JSON.stringify(entry)} — ` +
          `every entry needs string fields a, b, and reason.`,
      );
    }
    return entry;
  });
}

async function main(): Promise<void> {
  const updateBaseline = process.argv.includes('--update-baseline');
  const baseline = readBaseline();

  // A baseline entry only exempts a pair when it carries a real reviewed
  // reason — a blank reason or the generated `--update-baseline` TODO
  // placeholder committed as-is would bypass the admission guard by pair
  // IDs alone. (Skipped under --update-baseline so the TODO an earlier run
  // wrote can be replaced by re-running rather than hand-deleting first.)
  if (!updateBaseline) {
    const placeholders = placeholderBaselineEntries(baseline);
    if (placeholders.length > 0) {
      process.stderr.write(
        `check:css-duplication — ${placeholders.length} baseline entr(y/ies) with a blank or ` +
          `TODO placeholder reason:\n` +
          placeholders.map((entry) => `  ${entry.a} / ${entry.b}\n`).join('') +
          `Replace each with the written justification the admission bar requires.\n`,
      );
      process.exitCode = 1;
      return;
    }
  }

  const components = await collectComponentCss();
  const violations = findDuplicatePairs(components, baseline);

  if (violations.length === 0) {
    process.stdout.write('check:css-duplication — no unbaselined near-duplicate sidecars.\n');
    return;
  }

  if (updateBaseline) {
    const nextBaseline = [
      ...baseline,
      ...violations.map((violation) => ({
        a: violation.a,
        b: violation.b,
        reason: 'TODO: justify why this similarity is legitimate before committing.',
      })),
    ].toSorted((left, right) =>
      left.a === right.a ? (left.b < right.b ? -1 : 1) : left.a < right.a ? -1 : 1,
    );
    writeFileSync(baselinePath(), `${JSON.stringify(nextBaseline, null, 2)}\n`);
    process.stdout.write(
      `check:css-duplication — added ${violations.length} pair(s) to the baseline; ` +
        `replace each TODO reason before committing.\n`,
    );
    return;
  }

  process.stderr.write(`check:css-duplication — ${violations.length} near-duplicate pair(s):\n`);
  for (const violation of violations) {
    process.stderr.write(`  ${violation.message}\n`);
  }
  process.exitCode = 1;
}

if (import.meta.main) {
  await main();
}

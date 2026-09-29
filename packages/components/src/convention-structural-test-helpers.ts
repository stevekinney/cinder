/** Structural and namespace convention collection for public components. */

import { requiredValue } from '@lostgradient/testing';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'svelte/compiler';
import { hasSubstantiveTest } from '../scripts/component-conventions-tests.ts';
import {
  findPropsDeclaration,
  findPropsObjectPattern,
  findRestElementName,
  hasNativeElementSpread,
  hasPropsTypeExport,
} from './convention-structural-ast-test-helpers.ts';

const COMPONENTS_DIR = join(import.meta.dir, 'components');
const UNPREFIXED_ICON_UTILITY_PATTERN = /(?<![\w-])icon-(?:xs|sm|md|lg)(?![\w-])/g;

// Components that are interactive and must have a sibling .a11y.md file.
// AccordionItem is excluded — its a11y docs live in accordion.a11y.md.
// Tab is excluded — its a11y docs live in tabs.a11y.md.
const INTERACTIVE_ALLOW_LIST = new Set([
  'accordion',
  'area-chart',
  'bar-chart',
  'checkbox',
  'combobox',
  'copy-button',
  'dropdown',
  'input',
  'kanban-board',
  'line-chart',
  'modal',
  'multi-select',
  'navigation-item',
  'pagination',
  'phone-input',
  'pin-input',
  'radio-group',
  'rating',
  'select',
  'table',
  'tag-input',
  'tabs',
  'textarea',
  'toast-region',
  'toggle',
  'tooltip',
]);

const DOMAIN_SUITE_STYLE_ALLOW_LIST = new Set<string>([]);

/**
 * Components that intentionally render no class-bearing root element and
 * therefore do not need `classNames()`. This is empty today: every
 * public component renders a class-bearing root.
 *
 * **When to add a component here:** the component's entire template is
 * `{@render children()}` (or another snippet/slot pass-through) with no
 * root element of its own. Components that render any element — even a
 * `<div>` they don't expose a class prop for — should accept and merge a
 * `class` prop via `classNames()` rather than land on this list.
 */
const NO_CLASS_MERGING_ALLOW_LIST = new Set<string>([
  // locale-provider.svelte is intentionally context-only and renders only its
  // children snippet, so it has no class-bearing root element of its own.
  'locale-provider',
  // guidance-region.svelte is a context provider that renders its children and
  // an optional Popover portal, so it has no stable class-bearing root.
  'guidance-region',
  // modal-region.svelte is a context provider that renders its children and
  // zero or more modal portals, so it has no stable class-bearing root.
  'modal-region',
  // schema-form.svelte is a thin wrapper that only renders
  // `{#key schema}<SchemaFormBody {...rest} />{/key}` so a schema change recreates
  // the body's $state (issue #464). It has no class-bearing root element of its own —
  // the consumer `class` flows through `{...rest}` to schema-form-body.svelte, whose
  // `<form>` root merges it via `classNames('cinder-schema-form', customClassName)`.
  'schema-form',
]);

/**
 * Components that currently ship without a substantive behavioral `.test.ts`
 * (a sibling test file containing at least one active `test(...)`/`it(...)`
 * call — a types-only `.type-test.svelte` snapshot does not count).
 *
 * This list documents the existing coverage gap so CI stays green today while
 * convention check #9 prevents NEW untested components from landing. Each entry
 * is a known debt to be paid down: add a real test, then delete its line here.
 *
 * Detection shares the exact `hasSubstantiveTest` predicate the stable-promotion
 * gate uses (`scripts/component-conventions-tests.ts`), so "has a real test" means the
 * same thing in both places.
 */
const NO_TEST_REQUIRED_ALLOW_LIST = new Set<string>();

/**
 * Discover the public-component .svelte files. After the per-directory migration
 * each public component lives at `<name>/<name>.svelte`; this helper returns
 * paths in that nested form (e.g. `button/button.svelte`) so the readFile
 * step below resolves correctly. Falls back to top-level `<name>.svelte`
 * files for any components that have not yet been migrated.
 */
export function getPublicComponentSvelteFiles(): string[] {
  const entries = readdirSync(COMPONENTS_DIR, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith('_')) continue;
    if (entry.isFile() && entry.name.endsWith('.svelte')) {
      files.push(entry.name);
      continue;
    }
    if (entry.isDirectory()) {
      if (entry.name === 'experimental' || entry.name === 'icons') continue;
      const inner = `${entry.name}/${entry.name}.svelte`;
      if (existsSync(join(COMPONENTS_DIR, inner))) {
        files.push(inner);
      }
    }
  }
  files.sort();
  return files;
}

export function getAllComponentSvelteFiles(): string[] {
  const glob = new Bun.Glob('**/*.svelte');
  const files = [...glob.scanSync({ cwd: COMPONENTS_DIR })];
  files.sort();
  return files;
}

function toPascal(kebab: string): string {
  return kebab
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

export function collectStructuralConventionErrors(files: readonly string[]): string[] {
  return files.flatMap(validateComponent);
}

function validateComponent(file: string): string[] {
  const name = file.replace(/^.*\//, '').replace(/\.svelte$/, '');
  const source = readFileSync(join(COMPONENTS_DIR, file), 'utf-8');
  const errors = checkSubstantiveTest(file, name);
  let ast: ReturnType<typeof parse>;
  try {
    ast = parse(source, { filename: file, modern: true });
  } catch (error) {
    return [...errors, `${file}: parse error — ${String(error)}`];
  }
  errors.push(...checkStyle(ast, file, name));
  const scripts = checkScripts(ast, file, name);
  errors.push(...scripts.errors);
  if (scripts.stop) return errors;
  errors.push(...checkSourceRules(source, file, name, ast, scripts.propsDeclaration));
  errors.push(...checkA11yDoc(file, name));
  return errors;
}

function checkSubstantiveTest(file: string, name: string): string[] {
  if (NO_TEST_REQUIRED_ALLOW_LIST.has(name)) return [];
  const testFilePath = join(COMPONENTS_DIR, file.replace(/\.svelte$/, '.test.ts'));
  return hasSubstantiveTest(testFilePath).pass
    ? []
    : [
        `${file}: missing a substantive ${name}.test.ts (needs >=1 active test()/it() call; ` +
          `a types-only snapshot does not count). Add a test, or — only if truly unavoidable — ` +
          `add '${name}' to NO_TEST_REQUIRED_ALLOW_LIST with a TODO.`,
      ];
}

function checkStyle(ast: ReturnType<typeof parse>, file: string, name: string): string[] {
  return ast['css'] !== null && !DOMAIN_SUITE_STYLE_ALLOW_LIST.has(name)
    ? [`${file}: has a <style> block (must be removed — use CSS partial instead)`]
    : [];
}

function checkScripts(
  ast: ReturnType<typeof parse>,
  file: string,
  name: string,
): { errors: string[]; stop: boolean; propsDeclaration?: unknown } {
  const moduleContent = ast['module']?.content;
  if (!moduleContent) {
    return { errors: [`${file}: missing module script (<script lang="ts" module>)`], stop: true };
  }
  const propsType = `${toPascal(name)}Props`;
  const errors = hasPropsTypeExport(moduleContent, propsType)
    ? []
    : [`${file}: module script must export 'type ${propsType}'`];
  const instanceContent = ast['instance']?.content;
  if (!instanceContent) return { errors, stop: true };
  const propsDeclaration = findPropsDeclaration(instanceContent);
  if (!propsDeclaration) {
    errors.push(`${file}: instance script must destructure $props()`);
    return { errors, stop: true };
  }
  return { errors, stop: false, propsDeclaration };
}

function checkSourceRules(
  source: string,
  file: string,
  name: string,
  ast: ReturnType<typeof parse>,
  propsDeclaration: unknown,
): string[] {
  return [
    ...checkBindableArguments(source, file),
    ...checkClassMerging(source, file, name),
    ...checkOptionalSnippets(source, file),
    ...checkShapeB(source, file, ast, propsDeclaration),
  ];
}

function checkBindableArguments(source: string, file: string): string[] {
  const errors: string[] = [];
  for (const match of source.matchAll(/\$bindable\(([^)]+)\)/g)) {
    const arg = requiredValue(match[1]).trim();
    if (arg === '' || /^['"`]/.test(arg) || /^-?\d/.test(arg)) continue;
    if (['true', 'false', 'null', '[]', '{}'].includes(arg) || /^\[.*\]$/.test(arg)) continue;
    errors.push(
      `${file}: $bindable(${arg}) — argument must be JSON-serializable (literal, [], {}, or empty)`,
    );
  }
  return errors;
}

function checkClassMerging(source: string, file: string, name: string): string[] {
  return !NO_CLASS_MERGING_ALLOW_LIST.has(name) && !source.includes('classNames(')
    ? [`${file}: must use classNames() for class merging`]
    : [];
}

function checkOptionalSnippets(source: string, file: string): string[] {
  return /Snippet\s*\|\s*undefined/.test(source)
    ? [`${file}: use 'Snippet?' not 'Snippet | undefined' for optional snippets`]
    : [];
}

function checkShapeB(
  source: string,
  file: string,
  ast: ReturnType<typeof parse>,
  propsDeclaration: unknown,
): string[] {
  const isShapeB =
    /HTMLAttributes|HTMLInputAttributes|HTMLTextareaAttributes|HTMLButtonAttributes|HTMLAnchorAttributes/.test(
      source,
    ) && source.includes('...rest');
  if (!isShapeB) return [];
  const id = findPropsObjectPattern(propsDeclaration);
  const restName = findRestElementName(id);
  if (!restName)
    return [`${file}: Shape B component must have ...rest in the $props() destructuring`];
  return hasNativeElementSpread(ast['fragment'])
    ? []
    : [
        `${file}: Shape B component destructures ...${restName} but never spreads it on a native DOM element`,
      ];
}

function checkA11yDoc(file: string, name: string): string[] {
  if (!INTERACTIVE_ALLOW_LIST.has(name)) return [];
  const adjacent = join(COMPONENTS_DIR, name, `${name}.a11y.md`);
  const flat = join(COMPONENTS_DIR, `${name}.a11y.md`);
  return existsSync(adjacent) || existsSync(flat)
    ? []
    : [`${file}: interactive component missing ${name}.a11y.md`];
}

export function collectUnprefixedIconUtilityOffenders(files: readonly string[]): string[] {
  const offenders: string[] = [];
  for (const file of files) {
    const source = readFileSync(join(COMPONENTS_DIR, file), 'utf-8');
    const matches = [...source.matchAll(UNPREFIXED_ICON_UTILITY_PATTERN)];
    if (matches.length === 0) continue;

    const lineStarts = [0];
    for (let index = source.indexOf('\n'); index !== -1; index = source.indexOf('\n', index + 1)) {
      lineStarts.push(index + 1);
    }

    const locations = matches.map((match) => {
      const offset = match.index ?? 0;
      const lineIndex = lineStarts.findLastIndex((start) => start <= offset);
      return `${file}:${lineIndex + 1}`;
    });
    offenders.push(...locations);
  }
  return offenders;
}

// @ts-nocheck — test file performs heavy AST walking with Record<string,unknown>
// nodes from svelte/compiler.parse; noPropertyAccessFromIndexSignature would
// require bracket notation everywhere. Per project conventions, test files
// may play fast and loose with types.

/**
 * Convention tests for every public .svelte component.
 *
 * Uses svelte/compiler.parse (AST-only, no ts-morph) to enforce the structural
 * conventions every Phase-2 component must satisfy. These conventions are the
 * prerequisites the Phase-4 static analyzer depends on.
 *
 * Tests run with TZ=UTC via the package.json test script.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';
import { parse } from 'svelte/compiler';

import { hasSubstantiveTest } from '../scripts/component-conventions.ts';

const COMPONENTS_DIR = join(import.meta.dir, 'components');

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

const DOMAIN_SUITE_STYLE_ALLOW_LIST = new Set([
  'chat',
  'diff-viewer',
  'review-editor',
  'markdown-editor',
]);

/**
 * Components that intentionally render no class-bearing root element and
 * therefore do not need `cn()` / `classNames()`. Today this is the
 * pass-through `<CinderProvider>` whose entire job is to publish Svelte
 * context for descendants — it renders only `{@render children()}` and
 * carries no DOM of its own to merge classes onto.
 *
 * **When to add a component here:** the component's entire template is
 * `{@render children()}` (or another snippet/slot pass-through) with no
 * root element of its own. Components that render any element — even a
 * `<div>` they don't expose a class prop for — should accept and merge a
 * `class` prop via `classNames()` rather than land on this list.
 */
const NO_CLASS_MERGING_ALLOW_LIST = new Set(['cinder-provider']);

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
 * gate uses (`scripts/component-conventions.ts`), so "has a real test" means the
 * same thing in both places.
 */
const NO_TEST_REQUIRED_ALLOW_LIST = new Set([
  'chat', // TODO: add tests and remove from allow-list
  'command-item', // TODO: add tests and remove from allow-list
  'context-menu-trigger', // TODO: add tests and remove from allow-list
  'diff-viewer', // TODO: add tests and remove from allow-list
  'dropdown-group', // TODO: add tests and remove from allow-list
  'dropdown-item', // TODO: add tests and remove from allow-list
  'dropdown-label', // TODO: add tests and remove from allow-list
  'dropdown-menu', // TODO: add tests and remove from allow-list
  'dropdown-separator', // TODO: add tests and remove from allow-list
  'dropdown-trigger', // TODO: add tests and remove from allow-list
  'markdown-editor', // TODO: add tests and remove from allow-list
  'radio', // TODO: add tests and remove from allow-list
  'review-editor', // TODO: add tests and remove from allow-list
  'segment', // TODO: add tests and remove from allow-list
  'tab', // TODO: add tests and remove from allow-list
  'tab-list', // TODO: add tests and remove from allow-list
  'tab-panel', // TODO: add tests and remove from allow-list
  'table-body', // TODO: add tests and remove from allow-list
  'table-cell', // TODO: add tests and remove from allow-list
  'table-header', // TODO: add tests and remove from allow-list
  'table-row', // TODO: add tests and remove from allow-list
  'tree-item', // TODO: add tests and remove from allow-list
  'tree-select-all', // TODO: add tests and remove from allow-list
]);

/**
 * Discover the public-component .svelte files. After the per-directory migration
 * each public component lives at `<name>/<name>.svelte`; this helper returns
 * paths in that nested form (e.g. `button/button.svelte`) so the readFile
 * step below resolves correctly. Falls back to top-level `<name>.svelte`
 * files for any components that have not yet been migrated.
 */
async function getSvelteFiles(): Promise<string[]> {
  const entries = await readdir(COMPONENTS_DIR, { withFileTypes: true });
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
      try {
        await readFile(join(COMPONENTS_DIR, inner), 'utf-8');
        files.push(inner);
      } catch {
        // Directory without a matching .svelte (e.g. chat container) — skip.
      }
    }
  }
  return files.toSorted();
}

function toPascal(kebab: string): string {
  return kebab
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function findRestElement(objectPattern: unknown): boolean {
  if (!objectPattern || typeof objectPattern !== 'object') return false;
  const op = objectPattern as Record<string, unknown>;
  if (!Array.isArray(op.properties)) return false;
  return op.properties.some((p: unknown) => {
    if (!p || typeof p !== 'object') return false;
    return (p as Record<string, unknown>).type === 'RestElement';
  });
}

function findSpreadOnNativeElement(fragment: unknown, _restName: string): boolean {
  if (!fragment || typeof fragment !== 'object') return false;
  const node = fragment as Record<string, unknown>;

  // Check if this node is a RegularElement (native DOM element) or SvelteElement
  // (<svelte:element this={...}>) with any SpreadAttribute.
  // We accept any SpreadAttribute identifier — the component may alias `rest` before spreading
  // (e.g. Button casts rest → anchorAttributes / buttonAttributes). The structural requirement
  // is that SOME spread lands on a native element, not that the spread identifier is always "rest".
  const isNativeOrDynamicElement =
    (node.type === 'RegularElement' &&
      typeof node.name === 'string' &&
      node.name === node.name.toLowerCase() &&
      !node.name.includes(':')) ||
    node.type === 'SvelteElement';

  if (isNativeOrDynamicElement) {
    const attrs = Array.isArray(node.attributes) ? node.attributes : [];
    const hasSpread = attrs.some((attr: unknown) => {
      if (!attr || typeof attr !== 'object') return false;
      const a = attr as Record<string, unknown>;
      return a.type === 'SpreadAttribute';
    });
    if (hasSpread) return true;
  }

  // Recurse into child nodes (covers Svelte modern AST: nodes, children, body, etc.)
  for (const key of [
    'nodes',
    'children',
    'body',
    'fragment',
    'block',
    'consequent',
    'alternate',
    'then',
    'else',
  ]) {
    const child = node[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        if (findSpreadOnNativeElement(item, _restName)) return true;
      }
    } else if (child && typeof child === 'object') {
      if (findSpreadOnNativeElement(child, _restName)) return true;
    }
  }

  return false;
}

describe('component conventions', () => {
  test('every public .svelte file passes structural conventions', async () => {
    const files = await getSvelteFiles();
    expect(files.length).toBeGreaterThan(0);

    const errors: string[] = [];

    for (const file of files) {
      // file is either `<name>.svelte` (flat) or `<name>/<name>.svelte`
      // (migrated). Strip both shapes to a bare kebab name.
      const base = file.includes('/') ? file.split('/').pop()! : file;
      const name = base.replace(/\.svelte$/, '');
      const pascal = toPascal(name);
      const source = await readFile(join(COMPONENTS_DIR, file), 'utf-8');

      let ast: ReturnType<typeof parse>;
      try {
        ast = parse(source, { filename: file, modern: true });
      } catch (err) {
        errors.push(`${file}: parse error — ${String(err)}`);
        continue;
      }

      // 1. No <style> block.
      if (ast.css !== null && !DOMAIN_SUITE_STYLE_ALLOW_LIST.has(name)) {
        errors.push(`${file}: has a <style> block (must be removed — use CSS partial instead)`);
      }

      // 2. Module script exports a Props type alias named ${Pascal}Props.
      const moduleContent = ast.module?.content;
      if (!moduleContent) {
        errors.push(`${file}: missing module script (<script lang="ts" module>)`);
        continue;
      }

      const moduleBody = (moduleContent as Record<string, unknown>).body as unknown[];
      const hasPropsExport = moduleBody?.some((node: unknown) => {
        if (!node || typeof node !== 'object') return false;
        const n = node as Record<string, unknown>;
        if (n.type !== 'ExportNamedDeclaration') return false;

        // Direct declaration: `export type ${Pascal}Props = ...`
        const decl = n.declaration as Record<string, unknown> | null;
        if (decl?.type === 'TSTypeAliasDeclaration') {
          if ((decl.id as Record<string, unknown>)?.name === `${pascal}Props`) return true;
        }

        // Re-export: `export type { ${Pascal}Props } from './...';` After the
        // per-directory migration the type itself lives in `<name>.types.ts`
        // and the .svelte module script only re-exports it.
        const specifiers = n.specifiers as unknown[] | undefined;
        if (Array.isArray(specifiers)) {
          for (const spec of specifiers) {
            if (!spec || typeof spec !== 'object') continue;
            const s = spec as Record<string, unknown>;
            const exported = s.exported as Record<string, unknown> | undefined;
            if (exported?.name === `${pascal}Props`) return true;
          }
        }
        return false;
      });

      if (!hasPropsExport) {
        errors.push(`${file}: module script must export 'type ${pascal}Props'`);
      }

      // 3. Instance script has a $props() destructuring.
      const instanceContent = ast.instance?.content;
      if (!instanceContent) {
        // Some very simple components may not need an instance script.
        // Only flag if we expect one based on naming.
        continue;
      }

      const instanceBody = (instanceContent as Record<string, unknown>).body as unknown[];
      const propsDecl = instanceBody?.find((node: unknown) => {
        if (!node || typeof node !== 'object') return false;
        const n = node as Record<string, unknown>;
        if (n.type !== 'VariableDeclaration') return false;
        const decls = n.declarations as unknown[];
        return decls?.some((d: unknown) => {
          if (!d || typeof d !== 'object') return false;
          const decl = d as Record<string, unknown>;
          const init = decl.init as Record<string, unknown> | null;
          if (!init) return false;
          if (init.type !== 'CallExpression') return false;
          const callee = init.callee as Record<string, unknown>;
          return callee?.name === '$props';
        });
      });

      if (!propsDecl) {
        errors.push(`${file}: instance script must destructure $props()`);
        continue;
      }

      // 4. Check $bindable() arguments are JSON-serializable (no complex expressions).
      // Walk source looking for $bindable(complexExpr) patterns.
      const bindableMatches = source.matchAll(/\$bindable\(([^)]+)\)/g);
      for (const match of bindableMatches) {
        const arg = match[1].trim();
        // Allow: empty, string literals, number literals, boolean literals, [], {}
        if (arg === '') continue;
        if (/^['"`]/.test(arg)) continue; // string literal
        if (/^-?\d/.test(arg)) continue; // number literal
        if (arg === 'true' || arg === 'false' || arg === 'null') continue;
        if (arg === '[]' || arg === '{}') continue;
        if (/^\[.*\]$/.test(arg)) continue; // array of literals (basic check)
        errors.push(
          `${file}: $bindable(${arg}) — argument must be JSON-serializable (literal, [], {}, or empty)`,
        );
      }

      // 5. Source contains cn( or classNames( for class merging.
      //    Pass-through components (e.g. CinderProvider) that render no
      //    class-bearing root element are exempt — they have no element to
      //    merge classes onto.
      if (
        !NO_CLASS_MERGING_ALLOW_LIST.has(name) &&
        !source.includes('cn(') &&
        !source.includes('classNames(')
      ) {
        errors.push(`${file}: must use cn() or classNames() for class merging`);
      }

      // 6. No Snippet | undefined — optional snippets must use Snippet? syntax.
      if (/Snippet\s*\|\s*undefined/.test(source)) {
        errors.push(`${file}: use 'Snippet?' not 'Snippet | undefined' for optional snippets`);
      }

      // 7. Shape B enforcement: if Props is an intersection type, the $props()
      //    ObjectPattern must have a RestElement AND the template must spread it.
      // We detect Shape B by looking for HTMLAttributes/HTMLInputAttributes/etc in module.
      const isShapeB =
        /HTMLAttributes|HTMLInputAttributes|HTMLTextareaAttributes|HTMLButtonAttributes|HTMLAnchorAttributes/.test(
          source,
        ) && source.includes('...rest');

      if (isShapeB) {
        // Find the ObjectPattern from the $props() decl and check for RestElement.
        const decls = (propsDecl as Record<string, unknown>).declarations as unknown[];
        const propsDeclarator = decls?.[0] as Record<string, unknown>;
        const id = propsDeclarator?.id;
        const hasRest = findRestElement(id);

        if (!hasRest) {
          errors.push(`${file}: Shape B component must have ...rest in the $props() destructuring`);
        } else {
          // Check that ...rest is spread on a native DOM element in the template.
          // Find the RestElement name.
          const idNode = id as Record<string, unknown>;
          const restEl = (idNode.properties as unknown[])?.find((p: unknown) => {
            const n = p as Record<string, unknown>;
            return n.type === 'RestElement';
          }) as Record<string, unknown> | undefined;
          const restName = (restEl?.argument as Record<string, unknown>)?.name as string;

          if (restName) {
            const spreadFound = findSpreadOnNativeElement(ast.fragment, restName);
            if (!spreadFound) {
              errors.push(
                `${file}: Shape B component destructures ...${restName} but never spreads it on a native DOM element`,
              );
            }
          }
        }
      }

      // 8. Interactive components must have a sibling .a11y.md file.
      // After migration, the .a11y.md lives inside the component directory next
      // to the .svelte; check both the migrated and the legacy flat locations.
      if (INTERACTIVE_ALLOW_LIST.has(name)) {
        const directoryPath = join(COMPONENTS_DIR, name, `${name}.a11y.md`);
        const flatPath = join(COMPONENTS_DIR, `${name}.a11y.md`);
        const exists =
          (await Bun.file(directoryPath).exists()) || (await Bun.file(flatPath).exists());
        if (!exists) {
          errors.push(`${file}: interactive component missing ${name}.a11y.md`);
        }
      }

      // 9. Every component must have a sibling <name>.test.ts containing at
      //    least one active test()/it() call. A types-only snapshot file does
      //    not satisfy this. Components on the NO_TEST_REQUIRED_ALLOW_LIST are
      //    grandfathered-in gaps tracked for follow-up; everything else — and
      //    crucially every NEW component — must ship a real test.
      //    Detection uses the same hasSubstantiveTest predicate as the
      //    stable-promotion gate so the "has a substantive test" signal is
      //    identical in both places.
      if (!NO_TEST_REQUIRED_ALLOW_LIST.has(name)) {
        const testFilePath = join(COMPONENTS_DIR, file.replace(/\.svelte$/, '.test.ts'));
        if (!hasSubstantiveTest(testFilePath).pass) {
          errors.push(
            `${file}: missing a substantive ${name}.test.ts (needs >=1 active test()/it() call; ` +
              `a types-only snapshot does not count). Add a test, or — only if truly unavoidable — ` +
              `add '${name}' to NO_TEST_REQUIRED_ALLOW_LIST with a TODO.`,
          );
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(`Convention violations found:\n${errors.map((e) => `  • ${e}`).join('\n')}`);
    }
    // Parses every public .svelte file; raise the timeout so CPU contention
    // (parallel CI / multi-worktree) does not flake this whole-tree scan.
  }, 60_000);
});

// ---------------------------------------------------------------------------
// Regression coverage for convention check #9 (substantive-test requirement).
//
// The whole-tree test above proves the live tree is clean; these focused tests
// prove the GATE itself behaves correctly — it must flag a brand-new untested
// component, reject a types-only snapshot or a `.skip` stub, and keep the
// allow-list honest (no stale entries; every entry is a real current gap).
// ---------------------------------------------------------------------------

describe('convention #9 — substantive-test gate', () => {
  // The check's decision for one discovered component, mirroring the loop above:
  // exempt if allow-listed, otherwise it must have a substantive test.
  function componentFails(name: string, testFilePath: string): boolean {
    if (NO_TEST_REQUIRED_ALLOW_LIST.has(name)) return false;
    return !hasSubstantiveTest(testFilePath).pass;
  }

  test('a new component with no test file fails the check', () => {
    const directory = mkdtempSync(join(tmpdir(), 'convention9-notest-'));
    try {
      writeFileSync(
        join(directory, 'widget.svelte'),
        `<script lang="ts" module>export type WidgetProps = { class?: string };</script>` +
          `<div class={classNames(rest.class)}></div>`,
      );
      // No widget.test.ts written at all.
      const result = componentFails('widget', join(directory, 'widget.test.ts'));
      expect(result).toBe(true);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test('a component with only a types-only snapshot (no test() call) fails the check', () => {
    const directory = mkdtempSync(join(tmpdir(), 'convention9-typesonly-'));
    try {
      // A .type-test.svelte snapshot exists, but the .test.ts has zero test()/it() calls.
      writeFileSync(join(directory, 'widget.type-test.svelte'), `<!-- type snapshot only -->`);
      writeFileSync(
        join(directory, 'widget.test.ts'),
        `import { expectTypeOf } from 'expect-type';\n` +
          `// purely a type assertion module — no runtime test() or it() calls\n` +
          `expectTypeOf<string>().toBeString();\n`,
      );
      expect(componentFails('widget', join(directory, 'widget.test.ts'))).toBe(true);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test('a stub test file with only test.skip / test.todo fails the check', () => {
    const directory = mkdtempSync(join(tmpdir(), 'convention9-skip-'));
    try {
      writeFileSync(
        join(directory, 'widget.test.ts'),
        `import { test } from 'bun:test';\n` +
          `test.skip('not yet', () => {});\n` +
          `test.todo('later');\n`,
      );
      expect(componentFails('widget', join(directory, 'widget.test.ts'))).toBe(true);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test('a component with at least one active test() passes the check', () => {
    const directory = mkdtempSync(join(tmpdir(), 'convention9-pass-'));
    try {
      writeFileSync(
        join(directory, 'widget.test.ts'),
        `import { test, expect } from 'bun:test';\n` +
          `test('renders', () => { expect(true).toBe(true); });\n`,
      );
      expect(componentFails('widget', join(directory, 'widget.test.ts'))).toBe(false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test('an allow-listed component is exempt even with no test', () => {
    // Pick any current allow-list entry; the gate must not flag it.
    const [firstAllowListed] = [...NO_TEST_REQUIRED_ALLOW_LIST];
    expect(firstAllowListed).toBeDefined();
    expect(componentFails(firstAllowListed!, '/tmp/does-not-exist-for-allow-listed.test.ts')).toBe(
      false,
    );
  });

  test('every allow-list entry is a real current gap (no stale entries)', async () => {
    // If a component on the list gained a substantive test, its entry is stale
    // and must be deleted. This keeps the documented debt accurate over time.
    const files = await getSvelteFiles();
    const byName = new Map<string, string>();
    for (const file of files) {
      const base = file.includes('/') ? file.split('/').pop()! : file;
      const name = base.replace(/\.svelte$/, '');
      byName.set(name, file);
    }

    const stale: string[] = [];
    for (const name of NO_TEST_REQUIRED_ALLOW_LIST) {
      const file = byName.get(name);
      if (!file) {
        stale.push(`${name} (no matching component .svelte — remove from allow-list)`);
        continue;
      }
      const testFilePath = join(COMPONENTS_DIR, file.replace(/\.svelte$/, '.test.ts'));
      if (hasSubstantiveTest(testFilePath).pass) {
        stale.push(`${name} (now has a substantive test — remove from allow-list)`);
      }
    }

    expect(stale).toEqual([]);
  }, 30_000);
});

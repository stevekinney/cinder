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

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';
import { parse } from 'svelte/compiler';

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
    }

    if (errors.length > 0) {
      throw new Error(`Convention violations found:\n${errors.map((e) => `  • ${e}`).join('\n')}`);
    }
  });
});

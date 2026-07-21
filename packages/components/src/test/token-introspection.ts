/**
 * Shared `tokens-base.css` `:root` introspection for tests. Internal — not
 * part of the public package surface: these helpers live outside
 * `package.json#exports`, alongside other test-only infrastructure like
 * `src/test/happy-dom.ts` and `src/test/css.ts`, and are reached from
 * `packages/playground` test files via the `packages/components/src/test/*`
 * relative-import allowance that `check-consumer-boundaries.ts` carves out.
 *
 * Parsing is done with PostCSS (a real CSS tokenizer) rather than a
 * hand-rolled regex, so the result is correct regardless of indentation and
 * naturally ignores scoped variants like `:root[data-theme='dark']` — PostCSS
 * matches rule selectors exactly, so `:root[data-theme='dark']` never equals
 * the `:root` filter — and comments, which PostCSS parses as distinct nodes
 * that are simply not walked when collecting declarations.
 */

import { parse, type Rule } from 'postcss';

/**
 * Finds the first BARE `:root { ... }` rule at the stylesheet's top level
 * (not nested inside `@media`, `@supports`, etc.) and returns its body as the
 * raw source text between the outer braces. Scoped variants such as
 * `:root[data-theme='dark']` are never matched — PostCSS compares the full
 * rule selector, so an attribute-qualified selector is simply a different
 * string. Nested `:root` rules (e.g. inside a `@media (prefers-reduced-motion:
 * reduce)` block) are skipped so a token stylesheet can safely contain more
 * than one `:root` block.
 */
export function extractRootBlock(css: string): string {
  const root = parse(css);
  let rootRule: Rule | undefined;

  root.walkRules(':root', (rule) => {
    if (rule.parent?.type !== 'root') return;
    rootRule ??= rule;
    return false;
  });

  if (!rootRule) {
    throw new Error('Could not find :root { ... } block in tokens-base.css');
  }

  const text = rootRule.toString();
  return text.slice(text.indexOf('{') + 1, text.lastIndexOf('}'));
}

/**
 * Returns the set of `--cinder-*` custom property names declared directly in
 * the top-level `:root { ... }` block of a token stylesheet (see
 * {@link extractRootBlock}). Comments are inherently excluded — PostCSS
 * parses them as separate nodes, not declarations — so a
 * `/* --cinder-future: reserved *\/` aside can never be mistaken for a real
 * declaration.
 */
export function readRootTokenNames(css: string): Set<string> {
  const root = parse(css);
  const names = new Set<string>();
  let found = false;

  root.walkRules(':root', (rule) => {
    if (found || rule.parent?.type !== 'root') return;
    found = true;

    for (const node of rule.nodes) {
      if (node.type === 'decl' && node.prop.startsWith('--cinder-')) {
        names.add(node.prop);
      }
    }

    return false;
  });

  if (!found) {
    throw new Error('Could not find :root { ... } block in tokens-base.css');
  }

  return names;
}

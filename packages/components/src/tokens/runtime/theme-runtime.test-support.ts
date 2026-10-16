/**
 * Test support for the runtime parity suite: evaluates what a generated
 * stylesheet declares for one context, so runtime property maps can be compared
 * with the CLI's CSS output.
 *
 * It models the document the stylesheet targets: `<html>` carrying
 * `data-theme`, and `data-reduced-motion="on"` for the forced context. The
 * `reduced` context is the operating-system preference, so
 * `@media (prefers-reduced-motion: reduce)` applies and the attribute is absent.
 * `prefers-color-scheme` blocks guard on `:not([data-theme])`, so they never
 * apply to an explicit theme. Only the selector forms the generator emits are
 * understood; any other selector fails the test rather than being guessed at.
 */

import { parse, type AtRule } from 'postcss';
import { format } from 'prettier';
import postcssPlugin from 'prettier/plugins/postcss';

export type CascadeContext = { theme: string; motion: string };

type Attributes = Record<string, string | undefined>;

const SELECTOR_PART =
  /^(?::root|\[([a-z-]+)(?:=(?:'([^']*)'|"([^"]*)"))?\]|:not\(\[([a-z-]+)(?:=(?:'([^']*)'|"([^"]*)"))?\]\))/;

/** The specificity (class-level count) of `selector` if it matches `<html>`, else undefined. */
function matchRoot(selector: string, attributes: Attributes): number | undefined {
  let rest = selector.trim();
  let specificity = 0;
  while (rest.length > 0) {
    const part = SELECTOR_PART.exec(rest);
    if (!part) {
      // A descendant combinator can never match the root element; anything else is unknown.
      if (/^\s|^[>+~]/.test(rest) || /\s\S/.test(rest)) return undefined;
      throw new Error(`Unsupported selector form in ${selector}`);
    }
    const [text, attribute, singleQuoted, doubleQuoted, negated, negatedSingle, negatedDouble] =
      part;
    rest = rest.slice(text.length);
    specificity += 1;
    if (attribute !== undefined) {
      const expected = singleQuoted ?? doubleQuoted;
      const actual = attributes[attribute];
      if (actual === undefined || (expected !== undefined && actual !== expected)) return undefined;
    } else if (negated !== undefined) {
      const expected = negatedSingle ?? negatedDouble;
      const actual = attributes[negated];
      if (actual !== undefined && (expected === undefined || actual === expected)) return undefined;
    }
  }
  return specificity;
}

/** Each custom property's winning declaration for `<html>` in `context`. */
export function cascadeCustomProperties(css: string, context: CascadeContext): Map<string, string> {
  const attributes: Attributes = {
    'data-theme': context.theme,
    'data-reduced-motion': context.motion === 'forced-reduced-motion' ? 'on' : undefined,
  };
  const winners = new Map<string, { value: string; specificity: number; order: number }>();
  let order = 0;
  parse(css).walkRules((rule) => {
    const parent = rule.parent;
    if (parent?.type === 'atrule') {
      const atRule = parent as AtRule;
      if (atRule.name !== 'media') return;
      const wantsReduced = /prefers-reduced-motion:\s*reduce/.test(atRule.params);
      const wantsScheme = /prefers-color-scheme/.test(atRule.params);
      if (wantsScheme) return;
      if (!wantsReduced || context.motion !== 'reduced') return;
    }
    const matches = rule.selectors
      .map((selector) =>
        matchRoot(selector.replace(/\(\s+/g, '(').replace(/\s+\)/g, ')'), attributes),
      )
      .filter((value): value is number => value !== undefined);
    if (matches.length === 0) return;
    const specificity = Math.max(...matches);
    rule.walkDecls(/^--/, (declaration) => {
      order += 1;
      const current = winners.get(declaration.prop);
      if (!current || specificity >= current.specificity) {
        winners.set(declaration.prop, { value: declaration.value, specificity, order });
      }
    });
  });
  return new Map([...winners].map(([property, { value }]) => [property, value]));
}

/**
 * Normalizes values the way the generator's formatter does, so an unformatted
 * runtime value compares equal to its committed, Prettier-formatted counterpart.
 */
export async function normalizeCssValues(
  properties: ReadonlyMap<string, string>,
): Promise<Map<string, string>> {
  const declarations = [...properties].map(([property, value]) => `${property}: ${value};`);
  const formatted = await format(`:root {\n${declarations.join('\n')}\n}`, {
    parser: 'css',
    plugins: [postcssPlugin],
  });
  const normalized = new Map<string, string>();
  parse(formatted).walkDecls((declaration) => {
    normalized.set(declaration.prop, declaration.value.replace(/\s+/g, ' ').trim());
  });
  return normalized;
}

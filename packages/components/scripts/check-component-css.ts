/**
 * Sidecar CSS linter for per-component bundles.
 *
 * Component CSS files (`src/components/<name>/<name>.css`) are shipped verbatim
 * to `dist/components/<name>/<name>.css` as an opt-in sidecar that consumers
 * can pull in via `cinder/<name>/styles`. The contract is:
 *
 *   1. Component CSS may only declare component-scoped rules and custom
 *      properties of the `--cinder-*` family.
 *   2. No `:root`, `html`, `body`, or bare universal `*` selectors at the
 *      effective top level — those belong in token / foundation layers.
 *   3. No `@layer` declarations inside the sidecar — layer assignment happens
 *      at the import side, via the `cinder/styles` aggregator wrapping its
 *      imports with `@import '...' layer(cinder.components)`.
 *
 * Scoped descendants are allowed (e.g. `.button *`, `.alert :where(html)`).
 * The check distinguishes these from forbidden globals by walking the parsed
 * selector AST and inspecting the FIRST compound — the rule's "effective top
 * level" — rather than text-matching the raw selector string.
 *
 * Used as a pre-emit gate in `scripts/build.ts`: any violation aborts the
 * build before sidecars are copied into `dist/`.
 */

import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';

const FORBIDDEN_TAGS = new Set(['html', 'body']);
const FORBIDDEN_PSEUDOS = new Set([':root']);

export type CssViolation = {
  file: string;
  line: number;
  column: number;
  selector?: string;
  message: string;
};

/**
 * Inspect a single CSS selector and decide whether its FIRST compound targets
 * a forbidden global. Compounds inside `:is()`, `:where()`, `:not()`, etc. on
 * a non-global anchor are tolerated — only a top-level selector whose initial
 * compound is itself global is rejected.
 */
function firstCompoundIsGlobal(selectorString: string): string | null {
  let offendingMatch: string | null = null;
  selectorParser((root) => {
    root.each((selector) => {
      // Walk the first compound: nodes until the first combinator.
      for (const node of selector.nodes) {
        if (node.type === 'combinator') break;
        if (node.type === 'tag' && FORBIDDEN_TAGS.has(node.value.toLowerCase())) {
          offendingMatch = node.value;
          return;
        }
        if (node.type === 'pseudo' && FORBIDDEN_PSEUDOS.has(node.value.toLowerCase())) {
          offendingMatch = node.value;
          return;
        }
        if (node.type === 'universal') {
          // Only flag bare `*` as the entire first compound — `.button *` is a
          // descendant universal, not a top-level target.
          if (selector.nodes.length === 1 || selector.nodes[1]?.type === 'combinator') {
            offendingMatch = '*';
            return;
          }
        }
      }
    });
  }).processSync(selectorString);
  return offendingMatch;
}

export async function checkComponentCss(file: string): Promise<CssViolation[]> {
  const source = await Bun.file(file).text();
  return checkComponentCssSource(source, file);
}

export function checkComponentCssSource(source: string, file: string): CssViolation[] {
  const violations: CssViolation[] = [];

  let root: postcss.Root;
  try {
    root = postcss.parse(source, { from: file });
  } catch (error) {
    violations.push({
      file,
      line: 1,
      column: 1,
      message: `Could not parse CSS: ${(error as Error).message}`,
    });
    return violations;
  }

  root.walkAtRules('layer', (atRule) => {
    violations.push({
      file,
      line: atRule.source?.start?.line ?? 1,
      column: atRule.source?.start?.column ?? 1,
      message:
        '`@layer` is not allowed inside a component CSS sidecar. Layer assignment happens at the import side via `cinder/styles`.',
    });
  });

  root.walkRules((rule) => {
    // Rules nested under another rule (CSS nesting) are inherently scoped to a
    // parent compound — they cannot define globals at the effective top level.
    if (rule.parent?.type === 'rule') return;

    // Rules nested under at-rules other than `@layer` (e.g. `@media`,
    // `@supports`, `@container`) are still subject to their own top-level
    // selector rules.
    for (const rawSelector of rule.selectors) {
      const offending = firstCompoundIsGlobal(rawSelector);
      if (offending !== null) {
        violations.push({
          file,
          line: rule.source?.start?.line ?? 1,
          column: rule.source?.start?.column ?? 1,
          selector: rawSelector,
          message: `Selector \`${rawSelector}\` targets the global \`${offending}\` at the top level. Component CSS sidecars must scope rules to component classes; tokens, resets, and globals belong in the foundation layer.`,
        });
      }
    }
  });

  return violations;
}

export function formatViolation(violation: CssViolation): string {
  const location = `${violation.file}:${violation.line}:${violation.column}`;
  return violation.selector
    ? `${location}  ${violation.message}`
    : `${location}  ${violation.message}`;
}

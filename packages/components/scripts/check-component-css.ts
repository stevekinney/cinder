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

export type CssViolation = {
  file: string;
  line: number;
  column: number;
  selector?: string;
  message: string;
};

const FUNCTIONAL_PSEUDOS = new Set([':is', ':where', ':not', ':has', ':matches']);

/**
 * Decide whether a compound selector contains a class anchor — directly, or
 * recursively inside a functional pseudo like `:is(.button)` / `:where(.button)`.
 * Component CSS sidecars must always start with a class anchor so the rules
 * stay scoped to the component. Everything else (`:root`, `html`, `body`,
 * universal `*`, bare attribute selectors, raw tags) is global at the top
 * level and belongs in the foundation / tokens layer.
 */
function compoundHasClassAnchor(nodes: readonly selectorParser.Node[]): boolean {
  for (const node of nodes) {
    if (node.type === 'combinator') break;
    if (node.type === 'class') return true;
    // Attribute selectors anchored to the `data-cinder-*` namespace are the
    // documented convention for state-driven scoping in cinder (see
    // `steps.css`: `[data-cinder-state='current'] .cinder-steps__marker`).
    // The `data-cinder-` prefix is component-scoped by namespace, equivalent
    // in intent to a `.cinder-*` class anchor.
    if (node.type === 'attribute' && node.attribute.toLowerCase().startsWith('data-cinder-')) {
      return true;
    }
    // `:is(.button)` and `:where(.button-icon, .button-label)` are valid
    // scoped anchors — recurse into the functional pseudo's argument selectors.
    if (node.type === 'pseudo' && FUNCTIONAL_PSEUDOS.has(node.value.toLowerCase())) {
      for (const inner of node.nodes ?? []) {
        if (compoundHasClassAnchor(inner.nodes)) return true;
      }
    }
  }
  return false;
}

/**
 * Render the first compound of a parsed selector back to a string for use in
 * a violation message. We stop at the first combinator so the message points
 * at the offending anchor rather than the whole selector chain.
 */
function describeFirstCompound(nodes: readonly selectorParser.Node[]): string {
  const compoundParts: string[] = [];
  for (const node of nodes) {
    if (node.type === 'combinator') break;
    compoundParts.push(String(node));
  }
  const joined = compoundParts.join('').trim();
  return joined === '' ? '(empty)' : joined;
}

/**
 * Inspect a single CSS selector and decide whether its FIRST compound is
 * suitably component-scoped. Returns the offending compound as a string when
 * the selector targets a global; returns `null` when the compound is anchored
 * to a class (or to a class nested inside `:is()` / `:where()` / `:not()` /
 * `:has()`).
 *
 * The "first compound must have a class anchor" rule is strict by design:
 * - Rejects `:root`, `html`, `body`, raw `button`, `[data-theme]`, `*:focus`,
 *   `:where(:root)`, `:is(html, body)`, etc.
 * - Accepts `.cinder-button`, `.cinder-button:hover`, `.button[data-state]`,
 *   `:where(.button, .button-icon)`, etc.
 * - Scoped descendants like `.button *`, `.button > [data-slot]` start with
 *   `.button` so they pass.
 */
function firstCompoundIsGlobal(selectorString: string): string | null {
  let offendingCompound: string | null = null;
  selectorParser((root) => {
    root.each((selector) => {
      if (!compoundHasClassAnchor(selector.nodes)) {
        offendingCompound = describeFirstCompound(selector.nodes);
      }
    });
  }).processSync(selectorString);
  return offendingCompound;
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

  // Sidecars are copied verbatim into `dist/components/<name>/`. An `@import`
  // would try to resolve from that directory, where its target was never
  // copied. Reject upfront rather than ship a broken sidecar.
  root.walkAtRules('import', (atRule) => {
    violations.push({
      file,
      line: atRule.source?.start?.line ?? 1,
      column: atRule.source?.start?.column ?? 1,
      message:
        '`@import` is not allowed inside a component CSS sidecar. The sidecar is copied verbatim into `dist/components/<name>/` and `@import` paths would not resolve. Inline the rules instead.',
    });
  });

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

    // `@keyframes` selectors are stop markers (`from`, `to`, `50%`), not
    // descendant selectors that target the document tree. The keyframes rule
    // itself is scoped via its `animation-name` consumer.
    for (
      let ancestor: postcss.Container | postcss.Document | undefined = rule.parent;
      ancestor && ancestor.type !== 'root';
      ancestor = ancestor.parent
    ) {
      if (ancestor.type === 'atrule') {
        const atRule = ancestor as postcss.AtRule;
        if (/^(-\w+-)?keyframes$/i.test(atRule.name)) return;
      }
    }

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
          message: `Selector \`${rawSelector}\` is not anchored to a class — its first compound is \`${offending}\`. Component CSS sidecars must scope rules to component classes (or class lists nested in \`:is()\` / \`:where()\`); tokens, resets, and globals belong in the foundation layer.`,
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

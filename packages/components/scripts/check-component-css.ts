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
 *   3. All rules must live inside a single top-level
 *      `@layer cinder.components { … }` wrapper so the layer assignment is
 *      intrinsic to the file and survives a direct subpath import
 *      (`cinder/<name>/styles`). A bare top-level rule outside the wrapper is
 *      a violation.
 *   4. The ONLY at-rules permitted outside the wrapper are leading
 *      sibling-leaf `@import '../<leaf>/<leaf>.css'` statements. Compound
 *      parents (Tabs, Table, Accordion, SideNavigation) use these so that
 *      importing `cinder/<parent>/styles` pulls the whole family. The path
 *      shape mirrors the verbatim dist layout — `dist/components/<parent>/`
 *      and `dist/components/<leaf>/` are siblings — so `../<leaf>/<leaf>.css`
 *      resolves identically in `src/` and `dist/`. Any other `@import`
 *      (absolute, bare specifier, or non-sibling path) is rejected because it
 *      would not resolve after the verbatim copy.
 *
 * Scoped descendants are allowed (e.g. `.button *`, `.alert :where(html)`).
 * The check distinguishes these from forbidden globals by walking the parsed
 * selector AST and inspecting the FIRST compound — the rule's "effective top
 * level" — rather than text-matching the raw selector string.
 *
 * Used as a pre-emit gate in `scripts/build.ts`: any violation aborts the
 * build before sidecars are copied into `dist/`.
 */

import { parse, type AtRule, type Container, type Document, type Root } from 'postcss';
import selectorParser from 'postcss-selector-parser';

export type CssViolation = {
  file: string;
  line: number;
  column: number;
  selector?: string;
  message: string;
};

/**
 * The single cascade layer every component CSS sidecar must self-declare.
 * Exported as the one source of truth so the build gate, the dist-side
 * verification, and the invariant test all agree on the name.
 */
export const COMPONENT_LAYER_NAME = 'cinder.components';

/**
 * Matches a sibling-leaf CSS import: `'../<leaf>/<leaf>.css'` where the
 * directory name and file basename are identical kebab-case tokens. This is
 * the only `@import` shape a compound-parent sidecar may carry — it resolves
 * identically in `src/components/<parent>/` and the verbatim-copied
 * `dist/components/<parent>/` because the leaf lives at the sibling
 * `<leaf>/<leaf>.css`.
 */
const SIBLING_LEAF_IMPORT_PARAMS = /^(['"])\.\.\/([a-z][a-z0-9-]*)\/\2\.css\1$/;

/**
 * Whether a `@import` at-rule is a permitted sibling-leaf import (see
 * {@link SIBLING_LEAF_IMPORT_PARAMS}). The capture group `\2` forces the
 * directory name and file basename to match, so `../tab/tab.css` passes while
 * `../tab/other.css`, `'foo'`, or `url(...)` forms do not.
 */
function isSiblingLeafImport(atRule: AtRule): boolean {
  return SIBLING_LEAF_IMPORT_PARAMS.test(atRule.params.trim());
}

/**
 * Whether a top-level AST node is the `@layer cinder.components { … }` wrapper —
 * a `@layer` at-rule whose params name exactly the component layer AND that has
 * a block body (rejecting the statement form `@layer cinder.components;`).
 */
function isComponentLayerNode(node: { type: string }): boolean {
  if (node.type !== 'atrule') return false;
  // The `type === 'atrule'` runtime check guarantees this is a postcss AtRule,
  // but the loose `{ type: string }` param type can't carry that narrowing.
  // eslint-disable-next-line no-unsafe-type-assertion -- runtime-checked: node.type === 'atrule' above.
  const atRule = node as AtRule;
  return (
    atRule.name === 'layer' &&
    atRule.params.trim() === COMPONENT_LAYER_NAME &&
    atRule.nodes !== undefined
  );
}

/**
 * Whether a parsed stylesheet satisfies the wrapper invariant: after ignoring
 * comments, exactly one top-level node is a `@layer cinder.components { … }`
 * block, and every other top-level node is a permitted sibling-leaf `@import`
 * (compound-parent family aggregation). Shared by the build gate
 * ({@link checkComponentCssSource}) and the structural invariant test so both
 * agree on one definition.
 */
export function isSingleComponentLayer(root: Root): boolean {
  const topLevelNodes = root.nodes.filter((node) => node.type !== 'comment');
  let layerCount = 0;
  for (const node of topLevelNodes) {
    if (isComponentLayerNode(node)) {
      layerCount += 1;
      continue;
    }
    if (node.type === 'atrule' && node.name === 'import' && isSiblingLeafImport(node)) {
      continue;
    }
    return false;
  }
  return layerCount === 1;
}

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

  let root: Root;
  try {
    root = parse(source, { from: file });
  } catch (error) {
    violations.push({
      file,
      line: 1,
      column: 1,
      message: `Could not parse CSS: ${error instanceof Error ? error.message : String(error)}`,
    });
    return violations;
  }

  // Sidecars are copied verbatim into `dist/components/<name>/`. A general
  // `@import` would try to resolve from that directory, where its target was
  // never copied. The single exception is a sibling-leaf import
  // (`../<leaf>/<leaf>.css`) used by compound parents to aggregate their
  // family — that path resolves identically in `src/` and `dist/` because the
  // layout mirrors. Reject every other `@import` upfront.
  root.walkAtRules('import', (atRule) => {
    if (isSiblingLeafImport(atRule)) return;
    violations.push({
      file,
      line: atRule.source?.start?.line ?? 1,
      column: atRule.source?.start?.column ?? 1,
      message:
        "`@import` is not allowed inside a component CSS sidecar, except a sibling-leaf family import of the form `@import '../<leaf>/<leaf>.css'`. The sidecar is copied verbatim into `dist/components/<name>/`, where only sibling-leaf paths resolve. Inline other rules instead.",
    });
  });

  // Sibling-leaf imports must precede the `@layer` block. CSS ignores any
  // `@import` that follows a style rule or layer block, so a misordered import
  // would silently fail to pull the leaf family in a real bundler.
  const topLevel = root.nodes.filter((node) => node.type !== 'comment');
  let sawLayerBlock = false;
  for (const node of topLevel) {
    if (isComponentLayerNode(node)) {
      sawLayerBlock = true;
      continue;
    }
    if (node.type === 'atrule' && node.name === 'import' && sawLayerBlock) {
      violations.push({
        file,
        line: node.source?.start?.line ?? 1,
        column: node.source?.start?.column ?? 1,
        message:
          'A sibling-leaf `@import` must appear BEFORE the `@layer cinder.components { … }` block. CSS ignores `@import` rules that follow style rules or layer blocks.',
      });
    }
  }

  // Layer assignment must be intrinsic to the sidecar so it survives a direct
  // subpath import (`cinder/<name>/styles`) rather than relying on the
  // aggregator wrapping the `@import` with `layer(cinder.components)`. The
  // contract: exactly one top-level node (ignoring comments) is the
  // `@layer cinder.components { … }` wrapper; the only other permitted
  // top-level nodes are leading sibling-leaf `@import` statements. A bare
  // top-level style rule or any other at-rule outside that wrapper is the
  // violation.
  if (!isSingleComponentLayer(root)) {
    const topLevelNodes = root.nodes.filter((node) => node.type !== 'comment');
    const offender = topLevelNodes.find(
      (node) =>
        !isComponentLayerNode(node) &&
        !(node.type === 'atrule' && node.name === 'import' && isSiblingLeafImport(node)),
    );
    const target = offender ?? root;
    violations.push({
      file,
      line: target.source?.start?.line ?? 1,
      column: target.source?.start?.column ?? 1,
      message: `Component CSS sidecar rules must live inside a single top-level \`@layer ${COMPONENT_LAYER_NAME} { … }\` wrapper so the layer assignment survives a direct subpath import. Wrap the file contents in \`@layer ${COMPONENT_LAYER_NAME} { … }\`.`,
    });
  }

  root.walkRules((rule) => {
    // Rules nested under another rule (CSS nesting) are inherently scoped to a
    // parent compound — they cannot define globals at the effective top level.
    if (rule.parent?.type === 'rule') return;

    // `@keyframes` selectors are stop markers (`from`, `to`, `50%`), not
    // descendant selectors that target the document tree. The keyframes rule
    // itself is scoped via its `animation-name` consumer.
    for (
      let ancestor: Container | Document | undefined = rule.parent;
      ancestor && ancestor.type !== 'root';
      ancestor = ancestor.parent
    ) {
      if (ancestor.type === 'atrule') {
        // eslint-disable-next-line no-unsafe-type-assertion -- runtime-checked: ancestor.type === 'atrule' above narrows this postcss node to an AtRule.
        const atRule = ancestor as AtRule;
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
  // The selector, when present, is already embedded in `message`, so the
  // formatted line is the same shape either way.
  return `${location}  ${violation.message}`;
}

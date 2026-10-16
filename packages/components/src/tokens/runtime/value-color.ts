import valueParser from 'postcss-value-parser';
import type { CorpusEntry } from './corpus.ts';
import { tokenPathFromReference } from './resolve-shared.ts';
import {
  COLOR_ARGUMENT_FUNCTIONS,
  COLOR_FUNCTIONS,
  type ColorValueNode,
  fallbackNodes,
  mathFunctionType,
  splitArguments,
  stripSpaces,
} from './value-color-parse.ts';

export function wholeTokenIndexPath(reference: string): string {
  let path = tokenPathFromReference(reference);
  if (!reference.startsWith('#/')) return path;
  if (path.endsWith('.$value')) path = path.slice(0, -'.$value'.length);
  if (path === '$root') return '';
  return path.endsWith('.$root') ? path.slice(0, -'.$root'.length) : path;
}

export function resolveAlias(reference: string, baseIndex: Map<string, CorpusEntry>): string {
  const path = wholeTokenIndexPath(reference);
  const target = baseIndex.get(path);
  if (!target?.cssProperty) {
    throw new Error(
      `Alias reference "${reference}" does not resolve to a base token with a cssProperty ` +
        `(looked up path "${path}").`,
    );
  }
  return `var(${target.cssProperty})`;
}

/**
 * Whether `reference` names a whole token that `resolveAlias` can turn into a
 * `var(--property)` reference -- used by `serializeEntryValue` to decide
 * whether a `$ref` alias should take that path or fall through to typed
 * serialization instead of throwing (see `serializeEntryValue`'s doc comment).
 */
export function isWholeTokenAlias(reference: string, baseIndex: Map<string, CorpusEntry>): boolean {
  return baseIndex.get(wholeTokenIndexPath(reference))?.cssProperty !== undefined;
}

export function isUnambiguousPercentageNode(node: ColorValueNode): boolean {
  if (node.type === 'function') {
    if (node.unclosed) return false;
    return mathFunctionType(node) === 1;
  }
  if (node.type === 'word') {
    const unit = valueParser.unit(node.value);
    return unit !== false && unit.unit === '%';
  }
  return false;
}

/**
 * A `var()` node whose FALLBACK is a percentage, so the reference resolves to
 * one either way: `var(--weight, 40%)`.
 *
 * In a `color-mix()` argument a bare `var()` is ambiguous between the color and
 * the weight, and this is the case where it stops being ambiguous. Without it,
 * checking the `var()` as a color position descends into the fallback and
 * reports `40%` as a bare component list -- rejecting a recipe the browser
 * accepts.
 */
export function isPercentageValuedVarNode(node: ColorValueNode): boolean {
  if (node.type !== 'function' || node.value.toLowerCase() !== 'var') return false;
  const fallback = fallbackNodes(node.nodes);
  if (fallback === undefined) return false;
  const items = stripSpaces(fallback);
  return items.length === 1 && isUnambiguousPercentageNode(items[0]!);
}

/**
 * The node groups of a `color-mix()` argument that might be its `<color>`,
 * each wrapped as its own single-node candidate.
 *
 * The argument is `<color> && <percentage>?` in either order, so the weight has
 * to be set aside before the color can be checked. The safe way to do that is
 * to drop only what CANNOT be a color -- a literal percentage or a math
 * function -- and check everything else.
 *
 * Guessing which token is the weight is what went wrong before. An earlier
 * version picked "whichever token is not a complete color", but the checker
 * returned `undefined` (complete) for any function it did not recognise,
 * `calc()` included, so a computed weight read as a complete color and the
 * REAL color was discarded as the weight. That let the exact value CIN-242
 * exists to reject --
 * `color-mix(in oklch, calc(var(--w) * 1%) light-dark(100% 0 0, 0% 0 0), transparent)`
 * -- through the gate untouched.
 *
 * Returning every candidate costs nothing: a `var()` passes the check anyway,
 * so including an ambiguous one is free, while every genuine color is checked.
 */
export function mixColorCandidates(argumentNodes: ColorValueNode[]): ColorValueNode[][] {
  const items = stripSpaces(argumentNodes);
  if (items.length < 2) return [argumentNodes];
  const candidates = items.filter(
    (item) => !isUnambiguousPercentageNode(item) && !isPercentageValuedVarNode(item),
  );
  return candidates.length === 0 ? [argumentNodes] : candidates.map((item) => [item]);
}

/**
 * The first color position within `nodes` that is not a complete CSS color, as
 * the node group to report -- or `undefined` when every position is complete.
 *
 * A color position is complete when it is a single hex literal or bare keyword
 * (`transparent`, `currentColor`), a single call to one of
 * {@link COLOR_FUNCTIONS}, a `var()` whose fallback (if any) is itself
 * complete, or a `light-dark()`/`color-mix()` whose own color arguments are
 * all complete. A component list is more than one top-level token -- `0 0 0`
 * is three -- or a call to any OTHER function, which this walker has never
 * seen before and so cannot assume is a color: FAIL CLOSED. That is the one
 * behavior change from the string-matching version this replaces, which
 * treated an unrecognised function as automatically complete.
 */
export function findBareInNodes(nodes: ColorValueNode[]): ColorValueNode[] | undefined {
  const items = stripSpaces(nodes);
  if (items.length === 0) return undefined;
  if (items.length > 1) return nodes;
  const node = items[0]!;
  if (node.type === 'function') return findBareInFunction(node);
  if (node.type === 'word') {
    if (/^#[0-9a-fA-F]{3,8}$/.test(node.value)) return undefined;
    if (/^[a-zA-Z][a-zA-Z0-9-]*$/.test(node.value)) return undefined;
    return [node];
  }
  // A quoted string, a comment, a unicode-range, or a stray comma: never a
  // valid color position.
  return [node];
}

/** {@link findBareInNodes} for a single function-call node. */
export function findBareInFunction(
  node: Extract<ColorValueNode, { type: 'function' }>,
): ColorValueNode[] | undefined {
  const name = node.value.toLowerCase();
  // `postcss-value-parser` still produces a function node for a call missing
  // its closing `)`, marked `unclosed`, with everything up to the end of the
  // declaration swept in as its arguments. The browser discards a declaration
  // containing such a value as invalid CSS -- silently, the exact failure
  // mode this gate exists to catch -- so an unclosed call is NEVER a complete
  // color, regardless of which function it names or how deep it sits (a
  // `var()` reference, an allowlisted color function, or one nested inside
  // `light-dark()`/`color-mix()` all reach this same check). Checking this
  // before every acceptance path below, rather than only the allowlist one,
  // is what keeps `oklch(50% 0.1 30` from passing the way the old
  // whole-string regex correctly rejected it.
  if (node.unclosed) return [node];
  // `var()`'s FALLBACK sits in the same color position as the reference
  // itself, so a bare list there is the same defect one level down:
  // `var(--x, 0% 0 0)` is a silently dropped declaration whenever `--x` is
  // unset. The custom-property name is not a color and is skipped. No
  // fallback at all is a bare reference, which is ambiguous and accepted --
  // see {@link mixColorCandidates}'s doc comment on the safe direction.
  if (name === 'var') {
    const fallback = fallbackNodes(node.nodes);
    return fallback === undefined ? undefined : findBareInNodes(fallback);
  }
  if (COLOR_FUNCTIONS.has(name)) return undefined;
  if (!COLOR_ARGUMENT_FUNCTIONS.has(name)) return [node];
  return findBareInArguments(name, splitArguments(node.nodes));
}

export function findBareInArguments(
  name: string,
  args: ColorValueNode[][],
): ColorValueNode[] | undefined {
  // `color-mix()`'s first argument is its interpolation method (`in oklch`),
  // not a color; `light-dark()`'s arguments are all colors.
  const colorArguments = name === 'color-mix' ? args.slice(1) : args;
  return findBareInColorArguments(name === 'color-mix', colorArguments);
}

export function findBareInColorArguments(
  isMix: boolean,
  colorArguments: ColorValueNode[][],
): ColorValueNode[] | undefined {
  for (const argument of colorArguments) {
    // Only `color-mix()` arguments carry a weight -- `light-dark()` takes two
    // colors and nothing else, so its arguments are checked whole. Splitting
    // them would report the wrong fragment: a bare `100% 0 0` would be
    // dissected into `0` rather than named as the component list it is.
    const candidates = isMix ? mixColorCandidates(argument) : [argument];
    for (const candidate of candidates) {
      const bare = findBareInNodes(candidate);
      if (bare !== undefined) return bare;
    }
  }
  return undefined;
}

/**
 * The first fragment of `value` that sits in a `<color>` position but is not a
 * complete CSS color -- or `undefined` when every color position is complete.
 *
 * This exists for one failure mode, from CIN-242's decision record: a token
 * authored as a BARE OKLCH COMPONENT TRIPLET (`light-dark(0% 0 0, 100% 0 0)`,
 * so a call site can staple its own alpha on with `oklch(var(--token) / 0.4)`)
 * is not a color. Assigned directly to `color`/`background-color`/
 * `border-color` it produces an invalid declaration, which CSS drops SILENTLY
 * -- the element keeps its inherited or initial color and nothing anywhere
 * reports a problem. A complete value that is mis-referenced instead paints a
 * visibly wrong color, which is catchable. Hence: complete values only.
 *
 * Completeness is decided from a PARSED value tree (`postcss-value-parser`),
 * not a function-name allowlist matched against text -- see
 * {@link findBareInNodes} for the actual rule. A component list starts with a
 * number, so it is exactly what falls through.
 */
export function findBareColorComponents(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  const bare = findBareInNodes(valueParser(trimmed).nodes);
  return bare === undefined ? undefined : valueParser.stringify(bare).trim();
}

import valueParser from 'postcss-value-parser';
import type { CorpusEntry } from './corpus.ts';
import { tokenPathFromReference } from './resolve.ts';

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

/** A node from a parsed CSS value -- see `postcss-value-parser`'s `ParsedValue.nodes`. */
type ColorValueNode = ReturnType<typeof valueParser>['nodes'][number];

/**
 * CSS color functions that are a COMPLETE color on their own, so their body is
 * never re-examined -- `oklch()`, `rgb()`, and the rest all take numbers (and,
 * for `oklch(from … l c h)`, a nested relative-color source) as their own
 * arguments, so descending into one would flag the bare component list it is
 * SUPPOSED to contain.
 *
 * This is a CLOSED allowlist, drawn from the CSS Color Module functions plus
 * every function the real corpus recipes a color with (verified by
 * `generate.test.ts`'s "every color declaration the corpus emits" case, which
 * runs {@link findBareColorComponents} over the committed `tokens-base.css`
 * and fails if a real function name is missing here). CSS adds new color
 * functions rarely and deliberately, so growing this set is a deliberate,
 * reviewable edit -- unlike the open set this replaces, which treated ANY
 * unrecognised function as a complete color and so silently accepted whatever
 * CSS (or a typo) introduced next. Anything not in this set, and not one of
 * the two functions below, is presumed NOT a complete color: fail closed.
 */
const COLOR_FUNCTIONS = new Set([
  'rgb',
  'rgba',
  'hsl',
  'hsla',
  'hwb',
  'lab',
  'lch',
  'oklab',
  'oklch',
  'color',
]);

/**
 * The two color functions whose ARGUMENTS are themselves `<color>` values, and
 * so have to be checked recursively by {@link findBareColorComponents}.
 */
const COLOR_ARGUMENT_FUNCTIONS = new Set(['light-dark', 'color-mix']);

/**
 * CSS math functions CAPABLE of standing in for the `<percentage>` mix weight
 * in a `color-mix()` argument. `color-mix()` accepts a general `<percentage>`,
 * not only a literal, and the weight may sit on either side of the color, so
 * the weight has to be recognised in computed form too -- otherwise a recipe
 * the browser accepts reads as a bare component list and fails generation.
 *
 * This set is deliberately narrower than "every CSS Values L4 math function":
 * only the functions the spec defines as TYPE-PRESERVING (a `<percentage>`
 * argument yields a `<percentage>` result, the same way a `<length>` argument
 * yields a `<length>` result) belong here. `calc()`, `min()`, `max()`,
 * `clamp()`, `round()`, `mod()`, `rem()`, and `abs()` are all type-preserving
 * per the spec's calculation-type rules. `hypot()` is too -- its arguments
 * "must be the same type... either <number>, <percentage>, or <dimension>"
 * and the result matches that type, so `hypot(1%, 2%)` is itself a
 * `<percentage>`, exactly like a `color-mix()` weight the browser accepts.
 *
 * Membership here says only that a CALL to the function is CAPABLE of
 * producing a percentage -- it says nothing about any particular call, since
 * every one of these functions produces whatever type its arguments do:
 * `hypot(1px, 2px)` is a `<length>`, not a `<percentage>`, every bit as much
 * as `hypot(1%, 2%)` is a percentage. Whether a given call actually resolves
 * to a percentage is decided per-call by
 * {@link mathFunctionType}, which is why this set alone is
 * never enough to accept a node -- see {@link isUnambiguousPercentageNode}.
 *
 * `sign()` is deliberately EXCLUDED even though it takes the same argument
 * types as `abs()`: unlike `abs()`, the spec defines `sign()`'s result as
 * ALWAYS a plain `<number>` (1, -1, 0, or NaN), regardless of its argument's
 * type -- `sign(-10%)` is `-1`, a number, never a percentage. Including it
 * would make every call, not just a mistyped one, fail open.
 *
 * The exponential and trigonometric functions `pow()`, `sqrt()`, `log()`, and
 * `exp()` are NOT included either: the spec requires their arguments (and
 * result) to be a plain `<number>`, never a `<percentage>`, so they can never
 * legitimately stand in for a mix weight. The trigonometric functions
 * `sin()`, `cos()`, and `tan()` always return a `<number>`, and `asin()`,
 * `acos()`, `atan()`, and `atan2()` always return an `<angle>` -- none of the
 * seven ever produce a `<percentage>` either, so they are excluded for the
 * same reason `sign()` is.
 *
 * `var()` is deliberately absent. A bare `var()` is ambiguous between the color
 * and the weight, and reading it as the color is the safe direction: treating
 * it as a weight would strip the only complete value out of the argument and
 * flag what remains.
 */
const PERCENTAGE_FUNCTIONS = new Set([
  'calc',
  'clamp',
  'min',
  'max',
  'round',
  'mod',
  'rem',
  'abs',
  'hypot',
]);

/** `nodes` with every whitespace divider removed, so only meaningful tokens remain. */
function stripSpaces(nodes: ColorValueNode[]): ColorValueNode[] {
  return nodes.filter((node) => node.type !== 'space');
}

/**
 * `nodes` split into top-level comma-separated argument groups. Nested
 * function arguments stay whole automatically, because `postcss-value-parser`
 * already parsed them into their own `FunctionNode.nodes` -- a comma inside
 * `color-mix(...)` never appears in the outer array this walks.
 */
function splitArguments(nodes: ColorValueNode[]): ColorValueNode[][] {
  const groups: ColorValueNode[][] = [[]];
  for (const node of nodes) {
    if (node.type === 'div' && node.value === ',') {
      groups.push([]);
      continue;
    }
    groups[groups.length - 1]!.push(node);
  }
  return groups;
}

/**
 * Everything in a `var()` call's nodes after its first top-level comma -- the
 * fallback, verbatim, including any further commas it may itself contain
 * (`var()`'s fallback is not re-parsed by CSS, so neither is it here). `undefined`
 * when there is no fallback at all.
 */
function fallbackNodes(callNodes: ColorValueNode[]): ColorValueNode[] | undefined {
  const index = callNodes.findIndex((node) => node.type === 'div' && node.value === ',');
  return index === -1 ? undefined : callNodes.slice(index + 1);
}

/** Unitless CSS calculation constants, such as the scalar in `calc(1% * pi)`. */
const CALC_NUMBER_KEYWORDS = new Set(['pi', 'e', 'infinity', '-infinity', 'nan']);

// Track the percentage exponent: a number is 0, a percentage is 1. Intermediate
// products can have other exponents; division can cancel them again. Unsupported
// dimensions and malformed expressions are null, distinct from a bare variable.
type MathValueType = number | 'variable' | null;

function mathValueType(nodes: ColorValueNode[]): MathValueType {
  const parser = {
    items: nodes.filter((node) => node.type !== 'space' && node.type !== 'comment'),
    position: 0,
  };
  return mathExpression(parser, nodes);
}

type MathParser = { items: ColorValueNode[]; position: number };

function mathExpression(parser: MathParser, original: ColorValueNode[]): MathValueType {
  let result = mathProduct(parser);
  while (hasAddOperator(parser)) {
    const operator = parser.items[parser.position++];
    const originalIndex = original.indexOf(operator!);
    if (!isSpacedOperator(original, originalIndex)) return null;
    const right = mathProduct(parser);
    if (!sameNumericType(result, right)) return null;
  }
  return parser.position === parser.items.length ? result : null;
}

function hasAddOperator(parser: MathParser): boolean {
  const value = parser.items[parser.position]?.value;
  return value === '+' || value === '-';
}

function isSpacedOperator(nodes: ColorValueNode[], index: number): boolean {
  return nodes[index - 1]?.type === 'space' && nodes[index + 1]?.type === 'space';
}

function sameNumericType(left: MathValueType, right: MathValueType): boolean {
  return typeof left === 'number' && left === right;
}

function mathProduct(parser: MathParser): MathValueType {
  let left = mathPrimary(parser);
  while (hasProductOperator(parser)) {
    const operator = parser.items[parser.position++]!.value;
    const right = mathPrimary(parser);
    const combined = combineProduct(operator, left, right);
    if (combined === null) return null;
    left = combined;
  }
  return left;
}

function hasProductOperator(parser: MathParser): boolean {
  const value = parser.items[parser.position]?.value;
  return value === '*' || value === '/';
}

function combineProduct(
  operator: string,
  left: MathValueType,
  right: MathValueType,
): MathValueType {
  if (left === null || right === null) return null;
  if (operator === '*' && isVariablePercentagePair(left, right)) return 1;
  if (typeof left !== 'number' || typeof right !== 'number') return null;
  return operator === '*' ? left + right : left - right;
}

function isVariablePercentagePair(left: MathValueType, right: MathValueType): boolean {
  return (left === 'variable' && right === 1) || (right === 'variable' && left === 1);
}

function mathPrimary(parser: MathParser): MathValueType {
  const node = parser.items[parser.position++];
  if (!node) return null;
  if (node.type === 'word') return mathWordType(node.value);
  if (node.type !== 'function' || node.unclosed) return null;
  if (node.value === '') return mathValueType(node.nodes);
  if (node.value.toLowerCase() === 'var') return mathVariableType(node);
  return mathFunctionType(node);
}

function mathWordType(value: string): MathValueType {
  const unit = valueParser.unit(value);
  if (unit !== false) return unit.unit === '%' ? 1 : unit.unit === '' ? 0 : null;
  return CALC_NUMBER_KEYWORDS.has(value.toLowerCase()) ? 0 : null;
}

function mathVariableType(node: Extract<ColorValueNode, { type: 'function' }>): MathValueType {
  const argumentGroups = splitArguments(node.nodes);
  const reference = stripSpaces(argumentGroups[0]!);
  if (
    reference.length !== 1 ||
    reference[0]?.type !== 'word' ||
    !/^--[^\s,()]+$/.test(reference[0].value)
  )
    return null;
  const fallback = fallbackNodes(node.nodes);
  return fallback === undefined ? 'variable' : mathValueType(fallback);
}

function mathFunctionType(node: Extract<ColorValueNode, { type: 'function' }>): MathValueType {
  const name = node.value.toLowerCase();
  if (node.unclosed || !PERCENTAGE_FUNCTIONS.has(name)) return null;
  const argumentGroups = normalizedMathArguments(name, splitArguments(node.nodes));
  if (name === 'round' && argumentGroups.length === 1) return roundMathType(argumentGroups[0]!);
  const arity = mathArity(name);
  if (arity !== undefined && argumentGroups.length !== arity) return null;
  if (name === 'clamp') return clampMathType(argumentGroups);
  return uniformMathType(argumentGroups);
}

function normalizedMathArguments(
  name: string,
  argumentGroups: ColorValueNode[][],
): ColorValueNode[][] {
  if (name !== 'round') return argumentGroups;
  const strategy = stripSpaces(argumentGroups[0]!);
  const isStrategy =
    strategy.length === 1 &&
    strategy[0]?.type === 'word' &&
    ['nearest', 'up', 'down', 'to-zero'].includes(strategy[0].value.toLowerCase());
  return isStrategy ? argumentGroups.slice(1) : argumentGroups;
}

function mathArity(name: string): number | undefined {
  if (name === 'calc' || name === 'abs') return 1;
  if (name === 'clamp') return 3;
  return ['round', 'mod', 'rem'].includes(name) ? 2 : undefined;
}

function roundMathType(nodes: ColorValueNode[]): MathValueType {
  return mathValueType(nodes) === 0 ? 0 : null;
}

function clampMathType(argumentGroups: ColorValueNode[][]): MathValueType {
  const middle = mathValueType(argumentGroups[1]!);
  const validBound = (nodes: ColorValueNode[]) => {
    const items = stripSpaces(nodes);
    return (
      (items.length === 1 &&
        items[0]?.type === 'word' &&
        items[0].value.toLowerCase() === 'none') ||
      mathValueType(nodes) === middle
    );
  };
  return typeof middle === 'number' &&
    validBound(argumentGroups[0]!) &&
    validBound(argumentGroups[2]!)
    ? middle
    : null;
}

function uniformMathType(argumentGroups: ColorValueNode[][]): MathValueType {
  const types = argumentGroups.map(mathValueType);
  const first = types[0];
  return typeof first === 'number' && types.every((type) => type === first) ? first : null;
}

/**
 * A CSS `<percentage-token>`: a `<number-token>` followed by `%`, or a call to
 * a {@link PERCENTAGE_FUNCTIONS} member whose arguments DEMONSTRABLY resolve
 * to a percentage, including its operator types and argument count.
 * `postcss-value-parser`'s `unit` helper implements the actual
 * `<number-token>` grammar -- a number may be signed and may carry an
 * exponent, so `+40%`, `-0%`, `.5%`, and `4e1%` are all valid weights, and a
 * hand-rolled digits-and-dots pattern misses three of those four.
 */
function isUnambiguousPercentageNode(node: ColorValueNode): boolean {
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
function isPercentageValuedVarNode(node: ColorValueNode): boolean {
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
function mixColorCandidates(argumentNodes: ColorValueNode[]): ColorValueNode[][] {
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
function findBareInNodes(nodes: ColorValueNode[]): ColorValueNode[] | undefined {
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
function findBareInFunction(
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

function findBareInArguments(name: string, args: ColorValueNode[][]): ColorValueNode[] | undefined {
  // `color-mix()`'s first argument is its interpolation method (`in oklch`),
  // not a color; `light-dark()`'s arguments are all colors.
  const colorArguments = name === 'color-mix' ? args.slice(1) : args;
  return findBareInColorArguments(name === 'color-mix', colorArguments);
}

function findBareInColorArguments(
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

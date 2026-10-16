import valueParser from 'postcss-value-parser';

/** A node from a parsed CSS value -- see `postcss-value-parser`'s `ParsedValue.nodes`. */
export type ColorValueNode = ReturnType<typeof valueParser>['nodes'][number];

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
export const COLOR_FUNCTIONS = new Set([
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
export const COLOR_ARGUMENT_FUNCTIONS = new Set(['light-dark', 'color-mix']);

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
export const PERCENTAGE_FUNCTIONS = new Set([
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
export function stripSpaces(nodes: ColorValueNode[]): ColorValueNode[] {
  return nodes.filter((node) => node.type !== 'space');
}

/**
 * `nodes` split into top-level comma-separated argument groups. Nested
 * function arguments stay whole automatically, because `postcss-value-parser`
 * already parsed them into their own `FunctionNode.nodes` -- a comma inside
 * `color-mix(...)` never appears in the outer array this walks.
 */
export function splitArguments(nodes: ColorValueNode[]): ColorValueNode[][] {
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
export function fallbackNodes(callNodes: ColorValueNode[]): ColorValueNode[] | undefined {
  const index = callNodes.findIndex((node) => node.type === 'div' && node.value === ',');
  return index === -1 ? undefined : callNodes.slice(index + 1);
}

/** Unitless CSS calculation constants, such as the scalar in `calc(1% * pi)`. */
export const CALC_NUMBER_KEYWORDS = new Set(['pi', 'e', 'infinity', '-infinity', 'nan']);

// Track the percentage exponent: a number is 0, a percentage is 1. Intermediate
// products can have other exponents; division can cancel them again. Unsupported
// dimensions and malformed expressions are null, distinct from a bare variable.
export type MathValueType = number | 'variable' | null;

export function mathValueType(nodes: ColorValueNode[]): MathValueType {
  const parser = {
    items: nodes.filter((node) => node.type !== 'space' && node.type !== 'comment'),
    position: 0,
  };
  return mathExpression(parser, nodes);
}

export type MathParser = { items: ColorValueNode[]; position: number };

export function mathExpression(parser: MathParser, original: ColorValueNode[]): MathValueType {
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

export function hasAddOperator(parser: MathParser): boolean {
  const value = parser.items[parser.position]?.value;
  return value === '+' || value === '-';
}

export function isSpacedOperator(nodes: ColorValueNode[], index: number): boolean {
  return nodes[index - 1]?.type === 'space' && nodes[index + 1]?.type === 'space';
}

export function sameNumericType(left: MathValueType, right: MathValueType): boolean {
  return typeof left === 'number' && left === right;
}

export function mathProduct(parser: MathParser): MathValueType {
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

export function hasProductOperator(parser: MathParser): boolean {
  const value = parser.items[parser.position]?.value;
  return value === '*' || value === '/';
}

export function combineProduct(
  operator: string,
  left: MathValueType,
  right: MathValueType,
): MathValueType {
  if (left === null || right === null) return null;
  if (operator === '*' && isVariablePercentagePair(left, right)) return 1;
  if (typeof left !== 'number' || typeof right !== 'number') return null;
  return operator === '*' ? left + right : left - right;
}

export function isVariablePercentagePair(left: MathValueType, right: MathValueType): boolean {
  return (left === 'variable' && right === 1) || (right === 'variable' && left === 1);
}

export function mathPrimary(parser: MathParser): MathValueType {
  const node = parser.items[parser.position++];
  if (!node) return null;
  if (node.type === 'word') return mathWordType(node.value);
  if (node.type !== 'function' || node.unclosed) return null;
  if (node.value === '') return mathValueType(node.nodes);
  if (node.value.toLowerCase() === 'var') return mathVariableType(node);
  return mathFunctionType(node);
}

export function mathWordType(value: string): MathValueType {
  const unit = valueParser.unit(value);
  if (unit !== false) return unit.unit === '%' ? 1 : unit.unit === '' ? 0 : null;
  return CALC_NUMBER_KEYWORDS.has(value.toLowerCase()) ? 0 : null;
}

export function mathVariableType(
  node: Extract<ColorValueNode, { type: 'function' }>,
): MathValueType {
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

export function mathFunctionType(
  node: Extract<ColorValueNode, { type: 'function' }>,
): MathValueType {
  const name = node.value.toLowerCase();
  if (node.unclosed || !PERCENTAGE_FUNCTIONS.has(name)) return null;
  const argumentGroups = normalizedMathArguments(name, splitArguments(node.nodes));
  if (name === 'round' && argumentGroups.length === 1) return roundMathType(argumentGroups[0]!);
  const arity = mathArity(name);
  if (arity !== undefined && argumentGroups.length !== arity) return null;
  if (name === 'clamp') return clampMathType(argumentGroups);
  return uniformMathType(argumentGroups);
}

export function normalizedMathArguments(
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

export function mathArity(name: string): number | undefined {
  if (name === 'calc' || name === 'abs') return 1;
  if (name === 'clamp') return 3;
  return ['round', 'mod', 'rem'].includes(name) ? 2 : undefined;
}

export function roundMathType(nodes: ColorValueNode[]): MathValueType {
  return mathValueType(nodes) === 0 ? 0 : null;
}

export function clampMathType(argumentGroups: ColorValueNode[][]): MathValueType {
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

export function uniformMathType(argumentGroups: ColorValueNode[][]): MathValueType {
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

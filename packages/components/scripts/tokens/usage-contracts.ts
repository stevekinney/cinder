import valueParser from 'postcss-value-parser';
import type { TokenType } from './types.ts';
import { profileValueViolation, recipeIsLengthLiteral } from './usage-contract-value-validation.ts';

export type UsageContract = { property: string; profile: string };
export type UsageProfile = {
  valueKind: string;
  cssGrammar: Readonly<Record<string, string>>;
  /** Insert a serialized token into this property grammar; omitted properties use {value}. */
  validationTemplates?: Readonly<Record<string, string>>;
  /** Editable DTCG dimension units; trusted CSS projections retain their property grammar. */
  units?: readonly string[];
  keywords?: readonly string[];
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: boolean;
  integer?: boolean;
  finite?: boolean;
};

const lengthGrammars = {
  padding: '<length-percentage>{1,4}',
  'padding-block': '<length-percentage>{1,2}',
  'padding-inline': '<length-percentage>{1,2}',
  'padding-block-start': '<length-percentage>',
  'padding-block-end': '<length-percentage>',
  'padding-inline-start': '<length-percentage>',
  'padding-inline-end': '<length-percentage>',
  'padding-top': "<'padding-top'>",
  'padding-bottom': "<'padding-bottom'>",
  'padding-left': "<'padding-left'>",
  'padding-right': "<'padding-right'>",
  gap: '<length-percentage>{1,2}',
  'row-gap': '<length-percentage>',
  'column-gap': '<length-percentage>',
  width: '<length-percentage>',
  height: '<length-percentage>',
  'min-width': '<length-percentage>',
  'max-width': '<length-percentage>',
  'min-height': '<length-percentage>',
  'max-height': '<length-percentage>',
  'inline-size': '<length-percentage>',
  'block-size': '<length-percentage>',
  'min-inline-size': '<length-percentage>',
  'max-inline-size': '<length-percentage>',
  'min-block-size': '<length-percentage>',
  'max-block-size': '<length-percentage>',
  'border-radius': '<length-percentage>{1,4} [ / <length-percentage>{1,4} ]?',
  'border-start-start-radius': '<length-percentage>{1,2}',
  'border-start-end-radius': '<length-percentage>{1,2}',
  'border-end-start-radius': '<length-percentage>{1,2}',
  'border-end-end-radius': '<length-percentage>{1,2}',
  'border-top-left-radius': "<'border-top-left-radius'>",
  'border-top-right-radius': "<'border-top-right-radius'>",
  'border-width': '<line-width>{1,4}',
  'border-block-width': '<line-width>{1,2}',
  'border-inline-width': '<line-width>{1,2}',
  'outline-width': '<line-width>',
  'stroke-width': '<length-percentage> | <number>',
  'flex-basis': '<length-percentage>',
  flex: "<'flex'>",
  'grid-auto-columns': "<'grid-auto-columns'>",
  'backdrop-filter': "<'backdrop-filter'>",
  'box-shadow': "<'box-shadow'>",
  border: "<'border'>",
  'border-top': "<'border-top'>",
  'border-bottom': "<'border-bottom'>",
  'border-left': "<'border-left'>",
  'border-right': "<'border-right'>",
  'border-block': "<'border-block'>",
  'border-block-start': "<'border-block-start'>",
  'border-block-end': "<'border-block-end'>",
  'border-inline-start': "<'border-inline-start'>",
  'border-inline-end': "<'border-inline-end'>",
  outline: "<'outline'>",
} as const;

const signedLengthGrammars = {
  margin: '<length-percentage>{1,4}',
  'margin-block': '<length-percentage>{1,2}',
  'margin-inline': '<length-percentage>{1,2}',
  'margin-block-start': '<length-percentage>',
  'margin-block-end': '<length-percentage>',
  'margin-inline-start': '<length-percentage>',
  'margin-inline-end': '<length-percentage>',
  'margin-top': "<'margin-top'>",
  'margin-bottom': "<'margin-bottom'>",
  inset: '<length-percentage>{1,4}',
  'inset-block': '<length-percentage>{1,2}',
  'inset-inline': '<length-percentage>{1,2}',
  'inset-block-start': '<length-percentage>',
  'inset-block-end': '<length-percentage>',
  'inset-inline-start': '<length-percentage>',
  'inset-inline-end': '<length-percentage>',
  'letter-spacing': '<length>',
  'outline-offset': '<length>',
  translate: '<length-percentage>{1,2} <length>?',
  transform: '<transform-list>',
  'text-indent': '<length-percentage>',
  top: "<'top'>",
  bottom: "<'bottom'>",
  left: "<'left'>",
  right: "<'right'>",
  'box-shadow': "<'box-shadow'>",
} as const;

const colorGrammars = {
  color: '<color>',
  background: '<bg-layer>#? <final-bg-layer>',
  'background-color': '<color>',
  'background-image': '<image>#',
  'border-color': '<color>{1,4}',
  'border-block-color': '<color>{1,2}',
  'border-inline-color': '<color>{1,2}',
  'border-top-color': '<color>',
  'border-bottom-color': '<color>',
  'border-left-color': '<color>',
  'border-right-color': '<color>',
  'border-block-start-color': '<color>',
  'border-block-end-color': '<color>',
  'border-inline-start-color': '<color>',
  'border-inline-end-color': '<color>',
  border: '<line-width> || <line-style> || <color>',
  'border-block': '<line-width> || <line-style> || <color>',
  'border-inline': '<line-width> || <line-style> || <color>',
  'border-top': '<line-width> || <line-style> || <color>',
  'border-bottom': '<line-width> || <line-style> || <color>',
  'border-left': "<'border-left'>",
  'border-right': "<'border-right'>",
  'border-block-start': '<line-width> || <line-style> || <color>',
  'border-block-end': '<line-width> || <line-style> || <color>',
  'border-inline-start': '<line-width> || <line-style> || <color>',
  'border-inline-end': '<line-width> || <line-style> || <color>',
  outline: '<outline-width> || <outline-style> || <color>',
  'outline-color': '<color>',
  'accent-color': 'auto | <color>',
  'caret-color': 'auto | <color>',
  fill: '<paint>',
  stroke: '<paint>',
  'stop-color': '<color>',
  'box-shadow': 'none | <shadow>#',
  'text-shadow': 'none | <shadow-t>#',
  'text-decoration-color': '<color>',
  'text-decoration': "<'text-decoration'>",
  'scrollbar-color': 'auto | <color>{2}',
} as const;

/** Reviewed Cinder editing constraints; these are not inferred from a token name. */
export const PROFILE_DEFINITIONS: Readonly<Record<string, UsageProfile>> = {
  color: {
    valueKind: 'color',
    cssGrammar: colorGrammars,
    keywords: ['currentColor'],
    validationTemplates: {
      'background-image': 'linear-gradient({value}, {value})',
      'box-shadow': '0 0 {value}',
      'text-shadow': '0 0 {value}',
      'scrollbar-color': '{value} {value}',
    },
  },
  'nonnegative-length': {
    valueKind: 'length',
    cssGrammar: lengthGrammars,
    validationTemplates: {
      'box-shadow': '0 0 0 {value} black',
      'backdrop-filter': 'blur({value})',
      'grid-auto-columns': 'minmax({value}, 1fr)',
      flex: '0 0 {value}',
    },
    units: ['px', 'rem'],
    minimum: 0,
    finite: true,
  },
  'signed-length': {
    valueKind: 'length',
    cssGrammar: signedLengthGrammars,
    validationTemplates: {
      'box-shadow': '0 0 0 {value} black',
      transform: 'translateX({value})',
    },
    units: ['px', 'rem'],
    finite: true,
  },
  'positive-font-size': {
    valueKind: 'length',
    cssGrammar: {
      'font-size': '<absolute-size> | <relative-size> | <length-percentage>',
      font: "<'font'>",
    },
    validationTemplates: { font: '400 {value} sans-serif' },
    units: ['px', 'rem'],
    minimum: 0,
    exclusiveMinimum: true,
    finite: true,
  },
  'percentage-size': {
    valueKind: 'length',
    cssGrammar: lengthGrammars,
    units: ['px', 'rem', '%'],
    minimum: 0,
    finite: true,
  },
  'auto-size': {
    valueKind: 'length',
    cssGrammar: {
      height: 'auto | <length-percentage>',
      width: 'auto | <length-percentage>',
      'block-size': 'auto | <length-percentage>',
      'inline-size': 'auto | <length-percentage>',
      'flex-basis': 'auto | <length-percentage>',
    },
    units: ['px', 'rem', '%'],
    keywords: ['auto'],
    minimum: 0,
    finite: true,
  },
  opacity: {
    valueKind: 'number',
    cssGrammar: { opacity: '<opacity-value>' },
    minimum: 0,
    maximum: 1,
    finite: true,
  },
  'layer-index': {
    valueKind: 'number',
    cssGrammar: { 'z-index': '<integer> | auto' },
    minimum: -2147483648,
    maximum: 2147483647,
    integer: true,
    finite: true,
  },
  'font-weight': {
    valueKind: 'fontWeight',
    cssGrammar: { 'font-weight': '<font-weight-absolute> | bolder | lighter', font: "<'font'>" },
    validationTemplates: { font: '{value} 16px sans-serif' },
    keywords: [
      'thin',
      'hairline',
      'extra-light',
      'ultra-light',
      'light',
      'normal',
      'regular',
      'book',
      'medium',
      'semi-bold',
      'demi-bold',
      'bold',
      'extra-bold',
      'ultra-bold',
      'black',
      'heavy',
      'extra-black',
      'ultra-black',
    ],
    minimum: 1,
    maximum: 1000,
    finite: true,
  },
  'font-family': {
    valueKind: 'fontFamily',
    cssGrammar: { 'font-family': '[ <family-name> | <generic-family> ]#', font: "<'font'>" },
    validationTemplates: { font: '400 16px {value}' },
  },
  'line-height': {
    valueKind: 'number',
    cssGrammar: { 'line-height': 'normal | <number> | <length-percentage>' },
    minimum: 0,
    finite: true,
  },
  'tab-size': {
    valueKind: 'number',
    cssGrammar: { 'tab-size': '<number> | <length>' },
    minimum: 0,
    finite: true,
  },
  duration: {
    valueKind: 'duration',
    cssGrammar: {
      transition: '<single-transition>#',
      'transition-duration': '<time>#',
      'transition-delay': '<time>#',
      animation: '<single-animation>#',
      'animation-duration': '<time>#',
      'animation-delay': '<time>#',
    },
    validationTemplates: { transition: 'opacity {value} linear', animation: 'spin {value} linear' },
    units: ['ms', 's'],
    minimum: 0,
    finite: true,
  },
  easing: {
    valueKind: 'cubicBezier',
    cssGrammar: {
      transition: '<single-transition>#',
      'transition-timing-function': '<easing-function>#',
      animation: '<single-animation>#',
      'animation-timing-function': '<easing-function>#',
    },
    validationTemplates: { transition: 'opacity 1s {value}', animation: 'spin 1s {value}' },
  },
  shadow: {
    valueKind: 'shadow',
    cssGrammar: { 'box-shadow': 'none | <shadow>#' },
    units: ['px', 'rem'],
  },
  ratio: {
    valueKind: 'ratio',
    cssGrammar: { 'aspect-ratio': 'auto || <ratio>' },
    minimum: 0,
    exclusiveMinimum: true,
    finite: true,
  },
};

export type UsageToken = {
  path: string;
  cssProperty: string;
  type: TokenType | undefined;
  value: unknown;
  metadata: Record<string, unknown>;
};

function matchesProfileType(token: UsageToken, profile: UsageProfile): boolean {
  const recipe = token.metadata['cssRecipe'];
  // Tokens without an authored DTCG type cannot be checked for a conflicting
  // source type; their reviewed recipe and profile remain the contract.
  if (token.type === undefined && typeof recipe === 'string') return true;
  if (profile.valueKind === token.type) return true;
  if (profile.valueKind === 'ratio') return token.type === 'number';
  if (profile.valueKind !== 'length') return false;
  if (token.type === 'dimension') return true;
  if (token.type !== 'number') return false;
  // A recipe must be a complete length literal, not merely contain one.
  // Shipped numeric projections use em tracking, ch widths and percentages.
  if (typeof recipe === 'string') return recipeIsLengthLiteral(recipe);
  // CSS permits unitless zero in length positions without inventing a unit.
  return token.value === 0;
}

export type TokenUsageMetadata = {
  usageContracts: UsageContract[];
  recipeInputs: string[];
  scale: 'spacing' | null;
  portabilityReason: string | null;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function recipeProperties(recipe: string): string[] {
  const references = new Set<string>();
  valueParser(recipe).walk((node) => {
    if (node.type === 'function' && node.value === 'var') {
      const name = node.nodes.find((part) => part.type !== 'space');
      if (name?.type !== 'word' || !name.value.startsWith('--'))
        throw new Error('malformed recipe var()');
      references.add(name.value);
    }
  });
  return [...references];
}

/** Validate authored metadata and observed uses without granting imports recipe trust. */
export function validateUsageContracts(
  tokens: readonly UsageToken[],
  observedProperties: ReadonlyMap<string, readonly string[]> = new Map(),
): Map<string, TokenUsageMetadata> {
  const canonicalPaths = new Map<string, string>();
  const knownPaths = new Set(tokens.map((token) => token.path));
  for (const token of tokens)
    if (!canonicalPaths.has(token.cssProperty)) canonicalPaths.set(token.cssProperty, token.path);
  const result = new Map<string, TokenUsageMetadata>();
  for (const token of tokens) {
    function fail(reason: string): never {
      throw new Error(`${token.path}: ${reason}`);
    }
    const metadata = token.metadata;
    const raw = metadata['usageContracts'];
    if (!Array.isArray(raw) || raw.length === 0)
      fail('public token requires nonempty usageContracts');
    const contracts: UsageContract[] = [];
    const seen = new Set<string>();
    const valueKinds = new Set<string>();
    for (const candidate of raw) {
      if (
        !isObject(candidate) ||
        typeof candidate['property'] !== 'string' ||
        typeof candidate['profile'] !== 'string'
      )
        fail('malformed usage contract');
      const property = candidate['property'];
      const profile = candidate['profile'];
      const definition = PROFILE_DEFINITIONS[profile];
      if (!definition || !Object.hasOwn(definition.cssGrammar, property))
        fail(`unsupported CSS property/profile ${property}/${profile}`);
      const identity = `${property}/${profile}`;
      if (seen.has(identity)) fail(`duplicate usage contract ${identity}`);
      seen.add(identity);
      valueKinds.add(definition.valueKind);
      contracts.push({ property, profile });
    }
    if (valueKinds.size !== 1) fail('incompatible usage value kinds');
    for (const property of observedProperties.get(token.cssProperty) ?? [])
      if (!contracts.some((contract) => contract.property === property))
        fail(`missing observed CSS property ${property}`);

    const recipe = metadata['cssRecipe'];
    const rawInputs = metadata['recipeInputs'];
    const inputs = rawInputs === undefined ? [] : rawInputs;
    if (
      !Array.isArray(inputs) ||
      !inputs.every((input): input is string => typeof input === 'string') ||
      new Set(inputs).size !== inputs.length
    )
      fail('malformed or duplicate recipe inputs');
    const recipeInputs = inputs;
    if (recipeInputs.some((path) => !knownPaths.has(path))) fail('unknown recipe input');
    const expectedInputs = new Set<string>();
    if (typeof recipe === 'string') {
      for (const property of recipeProperties(recipe)) {
        const path = canonicalPaths.get(property);
        if (!path) fail(`unknown recipe property ${property}`);
        expectedInputs.add(path);
      }
    }
    if (
      recipeInputs.length !== expectedInputs.size ||
      recipeInputs.some((path) => !expectedInputs.has(path))
    )
      fail('recipe inputs do not match its CSS references');

    let portabilityReason: string | null = null;
    if (metadata['nonRepresentableValue'] === true) {
      const reason = metadata['portabilityReason'];
      if (
        typeof recipe !== 'string' ||
        !recipe.trim() ||
        typeof reason !== 'string' ||
        !reason.trim()
      )
        fail('CSS-only values require a real cssRecipe and portabilityReason');
      portabilityReason = reason;
    }
    const scale = metadata['scale'];
    if (
      scale !== undefined &&
      (scale !== 'spacing' ||
        !token.cssProperty.startsWith('--cinder-') ||
        token.type !== 'dimension' ||
        !isObject(token.value) ||
        typeof token.value['value'] !== 'number' ||
        !Number.isFinite(token.value['value']) ||
        !['px', 'rem'].includes(String(token.value['unit'])) ||
        typeof recipe === 'string')
    )
      fail('spacing scale requires a public literal dimension without a recipe');
    for (const contract of contracts) {
      const profile = PROFILE_DEFINITIONS[contract.profile]!;
      if (!matchesProfileType(token, profile))
        fail(
          `incompatible token type ${token.type ?? 'unknown'} for usage profile ${contract.profile}`,
        );
      const violation = profileValueViolation(
        token.value,
        typeof recipe === 'string' ? recipe : undefined,
        profile,
      );
      if (violation !== null)
        fail(`usage profile ${contract.profile} violates ${violation} for effective value`);
    }
    if (result.has(token.path)) fail('duplicate token classification');
    result.set(token.path, {
      usageContracts: contracts,
      recipeInputs,
      scale: scale === 'spacing' ? scale : null,
      portabilityReason,
    });
  }
  return result;
}

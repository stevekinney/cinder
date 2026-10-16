/**
 * CSS usage profiles: the numeric and structural contract each public token
 * must honor, given the CSS properties it feeds.
 *
 * DTCG says a `number` is any number and a `dimension` any signed length. CSS
 * is stricter per property (an opacity outside 0-1 is clamped, a negative
 * padding is invalid, a fractional z-index is not an integer), so a theme
 * editor needs the per-property limits, not the type's. A profile is that
 * limit. It is looked up from an explicit ordered rule table over type,
 * category, and path, never inferred from a name prefix alone, and the lookup
 * fails loudly on a token no rule covers or two rules disagree about.
 *
 * No Node imports: TB05's value validation and the browser runtime reuse this.
 */

import type { ProfileDefinition, ProfileRange } from './authoring-types.ts';
import type { TokenType } from './types.ts';

const NON_NEGATIVE: Omit<ProfileRange, 'part'> = { finite: true, min: 0 };

function dimension(
  id: string,
  description: string,
  cssUsage: string[],
  range: Omit<ProfileRange, 'part'> | undefined,
): ProfileDefinition {
  return {
    id,
    description,
    types: ['dimension'],
    cssUsage,
    ...(range ? { range: { part: 'dimension.value', ...range } } : {}),
  };
}

function plain(id: string, type: TokenType, description: string, cssUsage: string[]) {
  return { id, description, types: [type], cssUsage } satisfies ProfileDefinition;
}

/** DTCG 2025.10 named font weights (the `fontWeight` value schema's string enum). */
export const FONT_WEIGHT_KEYWORDS = [
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
];

const PROFILE_LIST: ProfileDefinition[] = [
  plain('color', 'color', 'A color of any supported DTCG color space.', [
    'color',
    'background-color',
    'border-color',
    'outline-color',
    'fill',
  ]),
  plain('font-family', 'fontFamily', 'An ordered font stack.', ['font-family']),
  plain('easing', 'cubicBezier', 'A cubic-bezier timing function.', [
    'transition-timing-function',
    'animation-timing-function',
  ]),
  plain('shadow', 'shadow', 'One or more shadow layers.', ['box-shadow']),
  plain('border', 'border', 'A composite border.', ['border']),
  plain('transition', 'transition', 'A composite transition.', ['transition']),
  plain('gradient', 'gradient', 'A gradient stop list.', ['background-image']),
  plain('typography', 'typography', 'A composite typography style.', ['font']),
  plain('stroke-style', 'strokeStyle', 'A named or dashed stroke style.', ['border-style']),
  {
    id: 'opacity',
    description: 'A finite alpha between 0 and 1 inclusive.',
    types: ['number'],
    cssUsage: ['opacity'],
    range: { part: 'number', finite: true, min: 0, max: 1 },
  },
  {
    id: 'z-index',
    description: 'A signed 32-bit integer stacking order.',
    types: ['number'],
    cssUsage: ['z-index'],
    range: {
      part: 'number',
      finite: true,
      integer: true,
      min: -2147483648,
      max: 2147483647,
    },
  },
  {
    id: 'font-weight',
    description: 'A weight from 1 to 1000, or a named DTCG weight.',
    types: ['fontWeight'],
    cssUsage: ['font-weight'],
    range: { part: 'fontWeight', finite: true, min: 1, max: 1000 },
    keywords: FONT_WEIGHT_KEYWORDS,
  },
  {
    id: 'duration',
    description: 'A non-negative time.',
    types: ['duration'],
    cssUsage: ['transition-duration', 'animation-duration'],
    range: { part: 'duration.value', ...NON_NEGATIVE },
  },
  dimension('font-size', 'A strictly positive length.', ['font-size'], {
    finite: true,
    min: 0,
    minExclusive: true,
  }),
  {
    id: 'line-height',
    description: 'A non-negative unitless multiplier.',
    types: ['number', 'dimension'],
    cssUsage: ['line-height'],
    range: { part: 'number', ...NON_NEGATIVE },
  },
  dimension('letter-spacing', 'A signed length.', ['letter-spacing'], { finite: true }),
  {
    id: 'tab-size',
    description: 'A non-negative tab width in characters.',
    types: ['number'],
    cssUsage: ['tab-size'],
    range: { part: 'number', ...NON_NEGATIVE },
  },
  dimension('spacing', 'A non-negative spacing-scale step.', ['padding', 'gap', 'margin'], {
    ...NON_NEGATIVE,
  }),
  dimension('padding', 'A non-negative length.', ['padding', 'padding-block', 'padding-inline'], {
    ...NON_NEGATIVE,
  }),
  dimension('gap', 'A non-negative length.', ['gap', 'row-gap', 'column-gap'], NON_NEGATIVE),
  dimension('margin', 'A signed length.', ['margin', 'margin-inline', 'margin-block'], {
    finite: true,
  }),
  dimension('offset', 'A signed length.', ['outline-offset', 'inset', 'translate'], {
    finite: true,
  }),
  dimension('radius', 'A non-negative length.', ['border-radius'], NON_NEGATIVE),
  {
    id: 'width',
    description: 'A non-negative length.',
    types: ['dimension', 'number'],
    cssUsage: ['width', 'inline-size', 'max-width'],
    range: { part: 'dimension.value', ...NON_NEGATIVE },
  },
  dimension('height', 'A non-negative length.', ['height', 'block-size', 'min-height'], {
    ...NON_NEGATIVE,
  }),
  dimension('size', 'A non-negative square extent.', ['width', 'height', 'inline-size'], {
    ...NON_NEGATIVE,
  }),
  dimension('border-width', 'A non-negative length.', ['border-width', 'outline-width'], {
    ...NON_NEGATIVE,
  }),
  dimension('blur', 'A non-negative blur radius.', ['filter', 'backdrop-filter'], NON_NEGATIVE),
  {
    id: 'aspect-ratio',
    description: 'A strictly positive ratio.',
    types: ['number'],
    cssUsage: ['aspect-ratio'],
    range: { part: 'number', finite: true, min: 0, minExclusive: true },
  },
];

export const PROFILES: Readonly<Record<string, ProfileDefinition>> = Object.fromEntries(
  PROFILE_LIST.map((profile) => [profile.id, profile]),
);

/** What a rule needs to know about a token. */
export type ProfileSubject = {
  path: string;
  type: TokenType | undefined;
  category: string | undefined;
  /** A trusted `cssRecipe` governs the CSS, so the DTCG type need not match the profile. */
  hasRecipe: boolean;
};

type ProfileRule = {
  profile: string;
  type?: TokenType;
  category?: string;
  path?: RegExp;
  unless?: RegExp;
};

/**
 * Every rule that matches must name the same profile. Rules are narrow on
 * purpose: a new public token that none matches fails generation and has to be
 * given a deliberate usage contract.
 */
export const PROFILE_RULES: readonly ProfileRule[] = [
  { type: 'color', profile: 'color' },
  { type: 'fontFamily', profile: 'font-family' },
  { type: 'cubicBezier', profile: 'easing' },
  { type: 'shadow', profile: 'shadow' },
  { type: 'border', profile: 'border' },
  { type: 'transition', profile: 'transition' },
  { type: 'gradient', profile: 'gradient' },
  { type: 'typography', profile: 'typography' },
  { type: 'strokeStyle', profile: 'stroke-style' },
  { type: 'fontWeight', profile: 'font-weight' },
  { type: 'duration', profile: 'duration' },
  { category: 'opacity', profile: 'opacity' },
  { category: 'z-index', profile: 'z-index' },
  { category: 'radius', profile: 'radius' },
  { category: 'spacing', path: /^space\./, profile: 'spacing' },
  { category: 'spacing', path: /(^|[.-])gap(\.|$)/, profile: 'gap' },
  { category: 'spacing', path: /(^|[.-])(pad|padding)(\.|-|$)|indent-step$/, profile: 'padding' },
  { category: 'spacing', path: /bleed$|overlap$/, profile: 'margin' },
  { category: 'size', path: /(^|[.-])height(\.|$)/, profile: 'height' },
  { category: 'size', path: /(^|\.)width(\.|$)/, unless: /^ring\./, profile: 'width' },
  { category: 'size', path: /^ring\.width$|thickness$/, profile: 'border-width' },
  { category: 'size', path: /(^|\.)offset$/, profile: 'offset' },
  { category: 'size', path: /(^|\.)blur$/, profile: 'blur' },
  { category: 'size', path: /(^|[.-])size$|target-min$/, profile: 'size' },
  { category: 'layout', path: /(^|[.-])(width|slide-size)(\.|$)/, profile: 'width' },
  { category: 'layout', path: /aspect-ratio$/, profile: 'aspect-ratio' },
  { category: 'typography', path: /(^|[.-])font[.-]size(\.|$)/, profile: 'font-size' },
  { category: 'typography', path: /^tracking\./, profile: 'letter-spacing' },
  { category: 'typography', path: /^leading\.|(^|\.)line-height$/, profile: 'line-height' },
  { category: 'typography', path: /tab-size$/, profile: 'tab-size' },
];

function matches(rule: ProfileRule, subject: ProfileSubject): boolean {
  if (rule.type !== undefined && rule.type !== subject.type) return false;
  if (rule.category !== undefined && rule.category !== subject.category) return false;
  if (rule.path !== undefined && !rule.path.test(subject.path)) return false;
  if (rule.unless !== undefined && rule.unless.test(subject.path)) return false;
  return true;
}

/**
 * The usage profile for a token. Throws when no rule covers it, when rules
 * disagree, or when the matched profile cannot describe the token's type.
 */
export function selectProfile(
  subject: ProfileSubject,
  rules: readonly ProfileRule[] = PROFILE_RULES,
  profiles: Readonly<Record<string, ProfileDefinition>> = PROFILES,
): ProfileDefinition {
  const matched = [
    ...new Set(rules.filter((rule) => matches(rule, subject)).map((r) => r.profile)),
  ];
  const where = `Token "${subject.path}" (type ${subject.type ?? 'unknown'}, category ${subject.category ?? 'unknown'})`;
  if (matched.length === 0) {
    throw new Error(`${where} has no CSS usage profile; add a rule to authoring-profiles.ts.`);
  }
  if (matched.length > 1) {
    throw new Error(`${where} has contradictory usage profiles: ${matched.join(', ')}.`);
  }
  const profile = profiles[matched[0]!];
  if (!profile) throw new Error(`${where} maps to unknown profile "${matched[0]}".`);
  if (!subject.hasRecipe && (subject.type === undefined || !profile.types.includes(subject.type))) {
    throw new Error(
      `${where} is contradictory with profile "${profile.id}", which accepts ${profile.types.join(', ')}.`,
    );
  }
  return profile;
}

/** The first reason `value` violates the profile's numeric range, or undefined when it fits. */
export function profileRangeViolation(
  profile: ProfileDefinition,
  value: number | string,
): string | undefined {
  if (typeof value === 'string') {
    return profile.keywords?.includes(value) ? undefined : `"${value}" is not a named value`;
  }
  const range = profile.range;
  if (!range) return undefined;
  if (!Number.isFinite(value)) return 'must be finite';
  if (range.integer && !Number.isInteger(value)) return 'must be an integer';
  if (range.min !== undefined && (range.minExclusive ? value <= range.min : value < range.min))
    return `must be ${range.minExclusive ? '>' : '>='} ${range.min}`;
  if (range.max !== undefined && value > range.max) return `must be <= ${range.max}`;
  return undefined;
}

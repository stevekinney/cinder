import valueParser from 'postcss-value-parser';
import type { UsageProfile } from './usage-contracts.ts';

type KnownValue =
  | { kind: 'number'; value: number; unit: string | undefined }
  | { kind: 'keyword'; value: string }
  | undefined;

function recipeLiteral(recipe: string): KnownValue {
  const nodes = valueParser(recipe).nodes.filter(
    (node) => node.type !== 'space' && node.type !== 'comment',
  );
  if (nodes.length !== 1 || nodes[0]?.type !== 'word') return undefined;
  const word = nodes[0].value;
  const parsed = valueParser.unit(word);
  if (parsed === false || parsed === undefined) return { kind: 'keyword', value: word };
  const value = Number(parsed.number);
  return { kind: 'number', value, unit: parsed.unit === '' ? undefined : parsed.unit };
}

function tokenLiteral(value: unknown): KnownValue {
  if (typeof value === 'number') return { kind: 'number', value, unit: undefined };
  if (typeof value === 'string') return { kind: 'keyword', value };
  if (
    typeof value === 'object' &&
    value !== null &&
    'value' in value &&
    typeof value.value === 'number'
  ) {
    const unit = 'unit' in value && typeof value.unit === 'string' ? value.unit : undefined;
    return { kind: 'number', value: value.value, unit };
  }
  return undefined;
}

/** Return the violated profile keyword, or null when the value is valid/unknown. */
export function profileValueViolation(
  value: unknown,
  recipe: string | undefined,
  profile: UsageProfile,
): string | null {
  const known = recipe === undefined ? tokenLiteral(value) : recipeLiteral(recipe);
  if (known === undefined) return null;
  if (known.kind === 'keyword') {
    if (profile.keywords?.includes(known.value)) return null;
    const hasNumericConstraints =
      profile.finite === true ||
      profile.integer === true ||
      profile.minimum !== undefined ||
      profile.maximum !== undefined ||
      profile.units !== undefined;
    return profile.keywords === undefined && !hasNumericConstraints ? null : 'keyword';
  }

  if (profile.finite === true && !Number.isFinite(known.value)) return 'finite';
  // The profile units describe the resolved DTCG literal. Existing authored
  // CSS recipes intentionally project numeric source values into CSS units
  // such as em, ch, and %, so their grammar remains authoritative here.
  if (profile.units !== undefined && recipe === undefined) {
    const unit = known.unit?.toLowerCase();
    if (unit === undefined) {
      if (known.value !== 0) return 'units';
    } else if (!profile.units.includes(unit)) {
      return 'units';
    }
  } else if (profile.units === undefined && known.unit !== undefined) {
    return 'units';
  }
  if (profile.integer === true && !Number.isInteger(known.value)) return 'integer';
  if (profile.minimum !== undefined) {
    if (profile.exclusiveMinimum === true && known.value <= profile.minimum)
      return 'exclusiveMinimum';
    if (profile.exclusiveMinimum !== true && known.value < profile.minimum) return 'minimum';
  }
  if (profile.maximum !== undefined && known.value > profile.maximum) return 'maximum';
  return null;
}

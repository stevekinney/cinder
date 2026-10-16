import type { TokenType, ValidationIssue } from './types.ts';
import { TOKEN_TYPES } from './types.ts';

export const TOKEN_NAME_PATTERN = /^[^${}.][^{}.]*$/;
export const VENDOR_EXTENSION_PATTERN = /^(?:[a-z0-9-]+\.)+[a-z0-9-]+$/i;
export const TOKEN_TYPE_SET = new Set<string>(TOKEN_TYPES);
export const COLOR_SPACES = new Set([
  'srgb',
  'srgb-linear',
  'display-p3',
  'a98-rgb',
  'prophoto-rgb',
  'rec2020',
  'xyz-d50',
  'xyz-d65',
  'hsl',
  'hwb',
  'lab',
  'oklab',
  'lch',
  'oklch',
]);
export const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
export const COLOR_MEMBERS = new Set(['colorSpace', 'components', 'alpha', 'hex']);
export const DIMENSION_MEMBERS = new Set(['value', 'unit']);

export type JsonObject = Record<string, unknown>;
export type ResolverDocumentShape = {
  version: unknown;
  sets: JsonObject;
  modifiers: JsonObject;
  resolutionOrder: unknown[];
};
export const GROUP_METADATA = new Set([
  '$type',
  '$description',
  '$deprecated',
  '$extensions',
  '$extends',
  '$root',
  '$schema',
]);
export const TOKEN_METADATA = new Set([
  '$value',
  '$ref',
  '$type',
  '$description',
  '$deprecated',
  '$extensions',
]);

export function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isCubicBezier(value: unknown): value is [number, number, number, number] {
  return (
    Array.isArray(value) && value.length === 4 && value.every((entry) => typeof entry === 'number')
  );
}

export function isReference(value: unknown): value is string {
  return typeof value === 'string' && (/^\{[^{}]+\}$/.test(value) || value.startsWith('#/'));
}

/**
 * A node is token-shaped if it declares either the value form (`$value`) or
 * the DTCG 2025.10 alias form (`$ref`) -- as opposed to a group, which
 * declares neither and instead nests further named children. Checking both
 * keys (rather than `$value` alone) is what CIN-463 fixes: previously a
 * `$ref`-only node fell through to being validated as an (empty) group.
 */
export function hasTokenValue(value: JsonObject): boolean {
  return '$value' in value || '$ref' in value;
}

export function addIssue(issues: ValidationIssue[], path: string, reason: string): void {
  issues.push({ path, reason });
}

export function validateCompositeMembers(
  value: JsonObject,
  members: Readonly<Record<string, TokenType>>,
  path: string,
  issues: ValidationIssue[],
  optionalMembers: ReadonlySet<string> = new Set(),
): void {
  const allowedMembers = new Set([...Object.keys(members), ...optionalMembers]);
  for (const name of Object.keys(value))
    if (!allowedMembers.has(name)) addIssue(issues, path, `unknown composite member ${name}`);
  for (const [name, type] of Object.entries(members)) {
    if (!(name in value)) {
      addIssue(issues, path, `composite value must include ${name}`);
      continue;
    }
    validateValue(type, value[name], `${path}.${name}`, issues);
  }
}

function validateColor(
  objectValue: JsonObject | undefined,
  path: string,
  issues: ValidationIssue[],
): void {
  if (
    !objectValue ||
    typeof objectValue['colorSpace'] !== 'string' ||
    !COLOR_SPACES.has(objectValue['colorSpace']) ||
    !Array.isArray(objectValue['components']) ||
    objectValue['components'].length !== 3 ||
    !objectValue['components'].every(
      (component) =>
        typeof component === 'number' || component === 'none' || isReference(component),
    ) ||
    (objectValue['alpha'] !== undefined &&
      (typeof objectValue['alpha'] !== 'number' ||
        objectValue['alpha'] < 0 ||
        objectValue['alpha'] > 1) &&
      objectValue['alpha'] !== 'none' &&
      !isReference(objectValue['alpha'])) ||
    (objectValue['hex'] !== undefined &&
      (typeof objectValue['hex'] !== 'string' || !HEX_COLOR_PATTERN.test(objectValue['hex'])))
  )
    addIssue(
      issues,
      path,
      'color must have a colorSpace, three numeric or none components, and valid optional alpha or hex',
    );
  if (objectValue)
    for (const name of Object.keys(objectValue))
      if (!COLOR_MEMBERS.has(name)) addIssue(issues, path, `unknown color member ${name}`);
}

function validateStrokeStyle(
  value: unknown,
  objectValue: JsonObject | undefined,
  path: string,
  issues: ValidationIssue[],
): void {
  if (
    typeof value === 'string' &&
    ['dotted', 'dashed', 'solid', 'double', 'groove', 'ridge', 'inset', 'outset'].includes(value)
  )
    return;
  if (
    !objectValue ||
    !Array.isArray(objectValue['dashArray']) ||
    objectValue['dashArray'].length === 0 ||
    !['round', 'butt', 'square'].includes(String(objectValue['lineCap']))
  )
    addIssue(issues, path, 'strokeStyle must be a named style or dash array');
  else
    objectValue['dashArray'].forEach((entry, index) => {
      validateValue('dimension', entry, `${path}.dashArray.${index}`, issues);
      if (isObject(entry) && typeof entry['value'] === 'number' && entry['value'] < 0)
        addIssue(issues, `${path}.dashArray.${index}`, 'stroke dash length must be non-negative');
    });
}

function validateShadow(
  value: unknown,
  objectValue: JsonObject | undefined,
  path: string,
  issues: ValidationIssue[],
): void {
  if ((!objectValue && !Array.isArray(value)) || (Array.isArray(value) && value.length === 0))
    addIssue(issues, path, 'shadow must be a shadow object or array');
  else {
    const shadows = Array.isArray(value) ? value : [objectValue];
    for (const [index, shadow] of shadows.entries()) {
      if (!isObject(shadow)) {
        addIssue(issues, `${path}.${index}`, 'shadow must be an object');
        continue;
      }
      validateCompositeMembers(
        shadow,
        {
          color: 'color',
          offsetX: 'dimension',
          offsetY: 'dimension',
          blur: 'dimension',
          spread: 'dimension',
        },
        Array.isArray(value) ? `${path}.${index}` : path,
        issues,
        new Set(['inset']),
      );
      const blur = shadow['blur'];
      if (isObject(blur) && typeof blur['value'] === 'number' && blur['value'] < 0)
        addIssue(
          issues,
          `${Array.isArray(value) ? `${path}.${index}` : path}.blur`,
          'shadow blur must be non-negative',
        );
      if (
        shadow['inset'] !== undefined &&
        typeof shadow['inset'] !== 'boolean' &&
        !isReference(shadow['inset'])
      )
        addIssue(
          issues,
          `${Array.isArray(value) ? `${path}.${index}` : path}.inset`,
          'inset must be boolean',
        );
    }
  }
}

function validateGradient(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!Array.isArray(value) || value.length < 2)
    addIssue(issues, path, 'gradient must contain at least two color-position stops');
  else {
    let previousPosition: number | undefined;
    for (const [index, stop] of value.entries()) {
      if (!isObject(stop)) {
        addIssue(issues, `${path}.${index}`, 'gradient stop must be an object');
        continue;
      }
      validateCompositeMembers(
        stop,
        { color: 'color', position: 'number' },
        `${path}.${index}`,
        issues,
      );
      if (typeof stop['position'] === 'number' && (stop['position'] < 0 || stop['position'] > 1))
        addIssue(issues, `${path}.${index}.position`, 'gradient position must be within [0, 1]');
      if (
        typeof stop['position'] === 'number' &&
        previousPosition !== undefined &&
        stop['position'] < previousPosition
      )
        addIssue(issues, `${path}.${index}.position`, 'gradient positions must be nondecreasing');
      if (typeof stop['position'] === 'number') previousPosition = stop['position'];
    }
  }
}

function validateTypography(
  objectValue: JsonObject | undefined,
  path: string,
  issues: ValidationIssue[],
): void {
  if (!objectValue) addIssue(issues, path, 'typography must contain all five composite properties');
  else {
    validateCompositeMembers(
      objectValue,
      {
        fontFamily: 'fontFamily',
        fontSize: 'dimension',
        fontWeight: 'fontWeight',
        letterSpacing: 'dimension',
      },
      path,
      issues,
      new Set(['lineHeight']),
    );
    if (!('lineHeight' in objectValue))
      addIssue(issues, path, 'composite value must include lineHeight');
    else if (typeof objectValue['lineHeight'] !== 'number')
      validateValue('dimension', objectValue['lineHeight'], `${path}.lineHeight`, issues);
    if (
      (typeof objectValue['lineHeight'] === 'number' && objectValue['lineHeight'] < 0) ||
      (isObject(objectValue['lineHeight']) &&
        typeof objectValue['lineHeight']['value'] === 'number' &&
        objectValue['lineHeight']['value'] < 0)
    )
      addIssue(issues, `${path}.lineHeight`, 'typography lineHeight must be non-negative');
    if (
      isObject(objectValue['fontSize']) &&
      typeof objectValue['fontSize']['value'] === 'number' &&
      objectValue['fontSize']['value'] < 0
    )
      addIssue(issues, `${path}.fontSize`, 'typography fontSize must be non-negative');
  }
}

export function validateValue(
  type: TokenType,
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): void {
  if (isReference(value)) return;
  const objectValue: JsonObject | undefined = isObject(value) ? value : undefined;
  switch (type) {
    case 'color':
      validateColor(objectValue, path, issues);
      return;
    case 'dimension':
      if (
        !objectValue ||
        typeof objectValue['value'] !== 'number' ||
        !['px', 'rem'].includes(String(objectValue['unit']))
      )
        addIssue(issues, path, 'dimension must have a numeric value and px or rem unit');
      else
        for (const name of Object.keys(objectValue))
          if (!DIMENSION_MEMBERS.has(name))
            addIssue(issues, path, `unknown dimension member ${name}`);
      return;
    case 'duration':
      if (
        !objectValue ||
        typeof objectValue['value'] !== 'number' ||
        objectValue['value'] < 0 ||
        !['ms', 's'].includes(String(objectValue['unit']))
      )
        addIssue(issues, path, 'duration must have a non-negative numeric value and ms or s unit');
      else
        for (const name of Object.keys(objectValue))
          if (!DIMENSION_MEMBERS.has(name))
            addIssue(issues, path, `unknown duration member ${name}`);
      return;
    case 'fontFamily':
      if (!(
        typeof value === 'string' ||
        (Array.isArray(value) &&
          value.length > 0 &&
          value.every((entry) => typeof entry === 'string'))
      ))
        addIssue(issues, path, 'fontFamily must be a string or string array');
      return;
    case 'fontWeight':
      if (
        !(typeof value === 'number' && value >= 1 && value <= 1000) &&
        ![
          'thin',
          'extra-light',
          'light',
          'normal',
          'medium',
          'semi-bold',
          'bold',
          'extra-bold',
          'black',
          'extra-black',
        ].includes(String(value))
      )
        addIssue(issues, path, 'fontWeight must be within [1, 1000] or a named weight');
      return;
    case 'number':
      if (typeof value !== 'number') addIssue(issues, path, `${type} must be numeric`);
      return;
    case 'cubicBezier':
      if (!isCubicBezier(value) || value[0] < 0 || value[0] > 1 || value[2] < 0 || value[2] > 1)
        addIssue(issues, path, 'cubicBezier must be four numbers with x coordinates in [0, 1]');
      return;
    case 'strokeStyle':
      validateStrokeStyle(value, objectValue, path, issues);
      return;
    case 'border':
      if (!objectValue) addIssue(issues, path, 'border must include color, width, and style');
      else
        validateCompositeMembers(
          objectValue,
          { color: 'color', width: 'dimension', style: 'strokeStyle' },
          path,
          issues,
        );
      if (
        isObject(objectValue?.['width']) &&
        typeof objectValue['width']['value'] === 'number' &&
        objectValue['width']['value'] < 0
      )
        addIssue(issues, `${path}.width`, 'border width must be non-negative');
      return;
    case 'transition':
      if (!objectValue)
        addIssue(issues, path, 'transition must include duration, delay, and timingFunction');
      else
        validateCompositeMembers(
          objectValue,
          { duration: 'duration', delay: 'duration', timingFunction: 'cubicBezier' },
          path,
          issues,
        );
      return;
    case 'shadow':
      validateShadow(value, objectValue, path, issues);
      return;
    case 'gradient':
      validateGradient(value, path, issues);
      return;
    case 'typography':
      validateTypography(objectValue, path, issues);
      return;
  }
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isTokenType(value: unknown): value is TokenType {
  return typeof value === 'string' && TOKEN_TYPE_SET.has(value);
}

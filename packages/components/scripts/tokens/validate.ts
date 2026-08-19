import type {
  DesignToken,
  ResolverDocument,
  TokenDocument,
  TokenType,
  ValidationIssue,
} from './types.ts';
import { TokenValidationError } from './types.ts';

const TOKEN_NAME_PATTERN = /^[^${}.][^{}.]*$/;
const VENDOR_EXTENSION_PATTERN = /^(?:[a-z0-9-]+\.)+[a-z0-9-]+$/i;
const TOKEN_TYPES = new Set<string>([
  'color',
  'dimension',
  'fontFamily',
  'fontWeight',
  'duration',
  'cubicBezier',
  'number',
  'strokeStyle',
  'border',
  'transition',
  'shadow',
  'gradient',
  'typography',
]);
const COLOR_SPACES = new Set([
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
const HEX_COLOR_PATTERN = /^#[0-9a-f]{3,4}(?:[0-9a-f]{2})?$/i;

type JsonObject = Record<string, unknown>;
type ResolverDocumentShape = {
  version: unknown;
  sets: unknown[];
  modifiers: unknown[];
  resolutionOrder: unknown[];
};
const GROUP_METADATA = new Set([
  '$type',
  '$description',
  '$deprecated',
  '$extensions',
  '$extends',
  '$root',
  '$schema',
]);
const TOKEN_METADATA = new Set(['$value', '$type', '$description', '$deprecated', '$extensions']);

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCubicBezier(value: unknown): value is [number, number, number, number] {
  return (
    Array.isArray(value) && value.length === 4 && value.every((entry) => typeof entry === 'number')
  );
}

function isReference(value: unknown): value is string {
  return typeof value === 'string' && (/^\{[^{}]+\}$/.test(value) || value.startsWith('#/'));
}

function addIssue(issues: ValidationIssue[], path: string, reason: string): void {
  issues.push({ path, reason });
}

function validateCompositeMembers(
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

function validateValue(
  type: TokenType,
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): void {
  if (isReference(value)) return;
  const objectValue: JsonObject | undefined = isObject(value) ? value : undefined;
  switch (type) {
    case 'color':
      if (
        !objectValue ||
        typeof objectValue['colorSpace'] !== 'string' ||
        !COLOR_SPACES.has(objectValue['colorSpace']) ||
        !Array.isArray(objectValue['components']) ||
        objectValue['components'].length !== 3 ||
        !objectValue['components'].every(
          (component) => typeof component === 'number' || component === 'none',
        ) ||
        (objectValue['alpha'] !== undefined &&
          (typeof objectValue['alpha'] !== 'number' ||
            objectValue['alpha'] < 0 ||
            objectValue['alpha'] > 1) &&
          objectValue['alpha'] !== 'none') ||
        (objectValue['hex'] !== undefined &&
          (typeof objectValue['hex'] !== 'string' || !HEX_COLOR_PATTERN.test(objectValue['hex'])))
      )
        addIssue(
          issues,
          path,
          'color must have a colorSpace, three numeric or none components, and valid optional alpha or hex',
        );
      return;
    case 'dimension':
      if (
        !objectValue ||
        typeof objectValue['value'] !== 'number' ||
        !['px', 'rem'].includes(String(objectValue['unit']))
      )
        addIssue(issues, path, 'dimension must have a numeric value and px or rem unit');
      return;
    case 'duration':
      if (
        !objectValue ||
        typeof objectValue['value'] !== 'number' ||
        objectValue['value'] < 0 ||
        !['ms', 's'].includes(String(objectValue['unit']))
      )
        addIssue(issues, path, 'duration must have a non-negative numeric value and ms or s unit');
      return;
    case 'fontFamily':
      if (
        !(
          typeof value === 'string' ||
          (Array.isArray(value) &&
            value.length > 0 &&
            value.every((entry) => typeof entry === 'string'))
        )
      )
        addIssue(issues, path, 'fontFamily must be a string or string array');
      return;
    case 'fontWeight':
      if (typeof value !== 'number' || value < 1 || value > 1000)
        addIssue(issues, path, 'fontWeight must be within [1, 1000]');
      return;
    case 'number':
      if (typeof value !== 'number') addIssue(issues, path, `${type} must be numeric`);
      return;
    case 'cubicBezier':
      if (!isCubicBezier(value) || value[0] < 0 || value[0] > 1 || value[2] < 0 || value[2] > 1)
        addIssue(issues, path, 'cubicBezier must be four numbers with x coordinates in [0, 1]');
      return;
    case 'strokeStyle':
      if (
        typeof value === 'string' &&
        [
          'none',
          'hidden',
          'dotted',
          'dashed',
          'solid',
          'double',
          'groove',
          'ridge',
          'inset',
          'outset',
        ].includes(value)
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
            addIssue(
              issues,
              `${path}.dashArray.${index}`,
              'stroke dash length must be non-negative',
            );
        });
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
          if (shadow['inset'] !== undefined && typeof shadow['inset'] !== 'boolean')
            addIssue(
              issues,
              `${Array.isArray(value) ? `${path}.${index}` : path}.inset`,
              'inset must be boolean',
            );
        }
      }
      return;
    case 'gradient':
      if (!Array.isArray(value) || value.length < 2)
        addIssue(issues, path, 'gradient must contain at least two color-position stops');
      else
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
          if (
            typeof stop['position'] === 'number' &&
            (stop['position'] < 0 || stop['position'] > 1)
          )
            addIssue(
              issues,
              `${path}.${index}.position`,
              'gradient position must be within [0, 1]',
            );
        }
      return;
    case 'typography':
      if (!objectValue)
        addIssue(issues, path, 'typography must contain all five composite properties');
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
          isObject(objectValue['lineHeight']) &&
          typeof objectValue['lineHeight']['value'] === 'number' &&
          objectValue['lineHeight']['value'] < 0
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
}

function tokenType(
  token: JsonObject,
  inheritedType: TokenType | undefined,
  path: string,
  issues: ValidationIssue[],
): TokenType | undefined {
  const declaredType = token['$type'];
  if (declaredType !== undefined && !isTokenType(declaredType)) {
    addIssue(issues, path, `unknown $type ${JSON.stringify(declaredType)}`);
    return undefined;
  }
  const resolvedType = declaredType ?? inheritedType;
  if (!resolvedType) addIssue(issues, path, 'token has no $type and no inherited type');
  return resolvedType;
}

function validateMetadata(
  node: JsonObject,
  path: string,
  issues: ValidationIssue[],
  isDocumentRoot = false,
): void {
  if (node['$schema'] !== undefined && (!isDocumentRoot || typeof node['$schema'] !== 'string'))
    addIssue(issues, path, '$schema must be a root-level string URI');
  if (node['$description'] !== undefined && typeof node['$description'] !== 'string')
    addIssue(issues, path, '$description must be a string');
  if (node['$extends'] !== undefined && !isReference(node['$extends']))
    addIssue(issues, path, '$extends must be a token reference');
  if (
    node['$deprecated'] !== undefined &&
    typeof node['$deprecated'] !== 'boolean' &&
    typeof node['$deprecated'] !== 'string'
  )
    addIssue(issues, path, '$deprecated must be a boolean or string');
  if (node['$extensions'] !== undefined) {
    if (!isObject(node['$extensions'])) addIssue(issues, path, '$extensions must be an object');
    else
      for (const key of Object.keys(node['$extensions']))
        if (!VENDOR_EXTENSION_PATTERN.test(key))
          addIssue(issues, path, `$extensions key ${key} is not a vendor name`);
  }
}

function validateGroup(
  group: JsonObject,
  path: string,
  inheritedType: TokenType | undefined,
  issues: ValidationIssue[],
  isDocumentRoot = false,
): void {
  validateMetadata(group, path, issues, isDocumentRoot);
  for (const key of Object.keys(group))
    if (key.startsWith('$') && !GROUP_METADATA.has(key))
      addIssue(issues, path, `unknown reserved property ${key}`);
  const groupType =
    group['$type'] === undefined ? inheritedType : tokenType(group, inheritedType, path, issues);
  for (const [name, value] of Object.entries(group)) {
    if (name === '$root') {
      if (!isObject(value) || !('$value' in value)) {
        addIssue(issues, path, '$root must be a token object');
        continue;
      }
      validateMetadata(value, path, issues);
      const nonMetadataChildren = Object.keys(value).filter((key) => !key.startsWith('$'));
      if (nonMetadataChildren.length > 0)
        addIssue(issues, path, '$root token cannot contain child groups');
      for (const key of Object.keys(value))
        if (key.startsWith('$') && !TOKEN_METADATA.has(key))
          addIssue(issues, path, `unknown reserved property ${key}`);
      const type =
        groupType === undefined && group['$extends'] !== undefined && value['$type'] === undefined
          ? undefined
          : tokenType(value, groupType, path, issues);
      if (type) validateValue(type, value['$value'], path, issues);
      continue;
    }
    if (name.startsWith('$')) continue;
    const childPath = `${path}.${name}`;
    if (!TOKEN_NAME_PATTERN.test(name)) {
      addIssue(
        issues,
        childPath,
        'token and group names may not start with $, or contain {, }, or .',
      );
      continue;
    }
    if (!isObject(value)) {
      addIssue(issues, childPath, 'token or group must be an object');
      continue;
    }
    if ('$value' in value) {
      const nonMetadataChildren = Object.keys(value).filter((key) => !key.startsWith('$'));
      if (nonMetadataChildren.length > 0)
        addIssue(issues, childPath, 'a token with $value cannot contain child groups');
      validateMetadata(value, childPath, issues);
      for (const key of Object.keys(value))
        if (key.startsWith('$') && !TOKEN_METADATA.has(key))
          addIssue(issues, childPath, `unknown reserved property ${key}`);
      const type =
        groupType === undefined && group['$extends'] !== undefined && value['$type'] === undefined
          ? undefined
          : tokenType(value, groupType, childPath, issues);
      if (type) validateValue(type, value['$value'], childPath, issues);
      continue;
    }
    validateGroup(value, childPath, groupType, issues);
  }
}

export function validateTokenDocument(document: unknown, source = '$'): void {
  const issues: ValidationIssue[] = [];
  if (!isObject(document)) addIssue(issues, source, 'document must be an object');
  else validateGroup(document, source, undefined, issues, true);
  if (issues.length > 0) throw new TokenValidationError(issues);
}

/** Validates a fully resolved token so aliases cannot change its declared value shape. */
export function validateResolvedToken(token: DesignToken, path: string): void {
  const issues: ValidationIssue[] = [];
  if (!token.$type) addIssue(issues, path, 'resolved token has no $type');
  else validateValue(token.$type, token.$value, path, issues);
  if (issues.length > 0) throw new TokenValidationError(issues);
}

export function validateResolverDocument(document: ResolverDocumentShape): void {
  const issues: ValidationIssue[] = [];
  if (document.version !== '2025.10')
    addIssue(issues, '$.version', 'resolver version must be 2025.10');
  const modifierNames = new Set<string>();
  for (const modifier of document.modifiers) {
    if (
      !isObject(modifier) ||
      typeof modifier['name'] !== 'string' ||
      !Array.isArray(modifier['values'])
    ) {
      addIssue(issues, '$.modifiers', 'modifier must have a string name and string values');
      continue;
    }
    const { name, values } = { name: modifier['name'], values: modifier['values'] };
    if (!name) addIssue(issues, '$.modifiers', 'modifier names must be non-empty strings');
    if (modifierNames.has(name))
      addIssue(issues, `$.modifiers.${name}`, 'modifier names must be unique');
    modifierNames.add(name);
    if (!values.every(isString))
      addIssue(issues, `$.modifiers.${name}`, 'modifier values must be strings');
    if (values.length === 0)
      addIssue(issues, `$.modifiers.${name}`, 'modifier values must not be empty');
    if (
      modifier['default'] !== undefined &&
      (!isString(modifier['default']) || !values.includes(modifier['default']))
    )
      addIssue(issues, `$.modifiers.${name}`, 'modifier default must be one of its values');
  }
  const setNames = new Set<string>();
  if (document.sets.length === 0)
    addIssue(issues, '$.sets', 'resolver must include at least one set');
  for (const set of document.sets) {
    if (!isObject(set) || typeof set['name'] !== 'string' || !Array.isArray(set['source'])) {
      addIssue(issues, '$.sets', 'set must have a string name and string source array');
      continue;
    }
    if (!set['name']) addIssue(issues, '$.sets', 'set names must be non-empty strings');
    if (setNames.has(set['name']))
      addIssue(issues, `$.sets.${set['name']}`, 'set names must be unique');
    setNames.add(set['name']);
    if (!set['source'].every(isString))
      addIssue(issues, `$.sets.${set['name']}`, 'set sources must be strings');
  }
  const resolutionOrderNames = new Set<string>();
  for (const name of document.resolutionOrder) {
    if (!isString(name) || !modifierNames.has(name))
      addIssue(issues, '$.resolutionOrder', `unknown modifier ${String(name)}`);
    else if (resolutionOrderNames.has(name))
      addIssue(issues, '$.resolutionOrder', 'modifier names must appear only once');
    else resolutionOrderNames.add(name);
  }
  if (resolutionOrderNames.size !== modifierNames.size)
    addIssue(issues, '$.resolutionOrder', 'must list every modifier exactly once');
  if (issues.length > 0) throw new TokenValidationError(issues);
}

export function assertValidTokenDocument(
  document: unknown,
  source?: string,
): asserts document is TokenDocument {
  const issues: ValidationIssue[] = [];
  if (!isObject(document)) addIssue(issues, source ?? '$', 'document must be an object');
  if (issues.length > 0) throw new TokenValidationError(issues);
  validateTokenDocument(document, source);
}

export function assertValidResolverDocument(
  document: unknown,
): asserts document is ResolverDocument {
  if (!isObject(document))
    throw new TokenValidationError([{ path: '$', reason: 'resolver must be an object' }]);
  if (
    document['version'] !== '2025.10' ||
    !Array.isArray(document['sets']) ||
    !Array.isArray(document['modifiers']) ||
    !Array.isArray(document['resolutionOrder'])
  )
    throw new TokenValidationError([
      {
        path: '$',
        reason: 'resolver must contain version, sets, modifiers, and resolutionOrder',
      },
    ]);
  const issues: ValidationIssue[] = [];
  for (const [index, set] of document['sets'].entries()) {
    if (
      !isObject(set) ||
      typeof set['name'] !== 'string' ||
      !Array.isArray(set['source']) ||
      !set['source'].every(isString)
    )
      addIssue(issues, `$.sets.${index}`, 'set must have a string name and string source array');
  }
  for (const [index, modifier] of document['modifiers'].entries()) {
    if (
      !isObject(modifier) ||
      typeof modifier['name'] !== 'string' ||
      !Array.isArray(modifier['values']) ||
      !modifier['values'].every(isString) ||
      (modifier['default'] !== undefined && typeof modifier['default'] !== 'string')
    )
      addIssue(
        issues,
        `$.modifiers.${index}`,
        'modifier must have a string name, string values, and optional string default',
      );
  }
  if (!document['resolutionOrder'].every(isString))
    addIssue(issues, '$.resolutionOrder', 'resolution order must contain strings');
  if (issues.length > 0) throw new TokenValidationError(issues);
  validateResolverDocument({
    version: document['version'],
    sets: document['sets'],
    modifiers: document['modifiers'],
    resolutionOrder: document['resolutionOrder'],
  });
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isTokenType(value: unknown): value is TokenType {
  return typeof value === 'string' && TOKEN_TYPES.has(value);
}

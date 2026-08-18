import type { ResolverDocument, TokenDocument, TokenType, ValidationIssue } from './types.ts';
import { TokenValidationError } from './types.ts';

const TOKEN_NAME_PATTERN = /^[^${}.][^${}.]*$/;
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

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isReference(value: unknown): value is string {
  return typeof value === 'string' && (/^\{[^{}]+\}$/.test(value) || value.startsWith('#/'));
}

function addIssue(issues: ValidationIssue[], path: string, reason: string): void {
  issues.push({ path, reason });
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
        !Array.isArray(objectValue['components']) ||
        objectValue['components'].length !== 3
      )
        addIssue(issues, path, 'color must have colorSpace and three components');
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
        !['ms', 's'].includes(String(objectValue['unit']))
      )
        addIssue(issues, path, 'duration must have a numeric value and ms or s unit');
      return;
    case 'fontFamily':
      if (
        !(
          typeof value === 'string' ||
          (Array.isArray(value) && value.every((entry) => typeof entry === 'string'))
        )
      )
        addIssue(issues, path, 'fontFamily must be a string or string array');
      return;
    case 'fontWeight':
    case 'number':
      if (typeof value !== 'number') addIssue(issues, path, `${type} must be numeric`);
      return;
    case 'cubicBezier':
      if (
        !Array.isArray(value) ||
        value.length !== 4 ||
        !value.every((entry) => typeof entry === 'number')
      )
        addIssue(issues, path, 'cubicBezier must be four numbers');
      return;
    case 'strokeStyle':
      if (
        !(
          typeof value === 'string' ||
          (objectValue &&
            Array.isArray(objectValue['dashArray']) &&
            ['round', 'butt', 'square'].includes(String(objectValue['lineCap'])))
        )
      )
        addIssue(issues, path, 'strokeStyle must be a named style or dash array');
      return;
    case 'border':
      if (
        !objectValue ||
        !('color' in objectValue && 'width' in objectValue && 'style' in objectValue)
      )
        addIssue(issues, path, 'border must include color, width, and style');
      return;
    case 'transition':
      if (
        !objectValue ||
        !('duration' in objectValue && 'delay' in objectValue && 'timingFunction' in objectValue)
      )
        addIssue(issues, path, 'transition must include duration, delay, and timingFunction');
      return;
    case 'shadow':
      if (
        !(
          Array.isArray(value) ||
          (objectValue &&
            'color' in objectValue &&
            'offsetX' in objectValue &&
            'offsetY' in objectValue &&
            'blur' in objectValue &&
            'spread' in objectValue)
        )
      )
        addIssue(issues, path, 'shadow must be a shadow object or array');
      return;
    case 'gradient':
      if (
        !Array.isArray(value) ||
        value.some((entry) => !isObject(entry) || !('color' in entry && 'position' in entry))
      )
        addIssue(issues, path, 'gradient must be color-position stops');
      return;
    case 'typography':
      if (
        !objectValue ||
        !['fontFamily', 'fontSize', 'fontWeight', 'letterSpacing', 'lineHeight'].every(
          (key) => key in objectValue,
        )
      )
        addIssue(issues, path, 'typography must contain all five composite properties');
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

function validateMetadata(node: JsonObject, path: string, issues: ValidationIssue[]): void {
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
): void {
  validateMetadata(group, path, issues);
  const groupType =
    group['$type'] === undefined ? inheritedType : tokenType(group, inheritedType, path, issues);
  for (const [name, value] of Object.entries(group)) {
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
      const type = tokenType(value, groupType, childPath, issues);
      if (type) validateValue(type, value['$value'], childPath, issues);
      continue;
    }
    validateGroup(value, childPath, groupType, issues);
  }
}

export function validateTokenDocument(document: unknown, source = '$'): void {
  const issues: ValidationIssue[] = [];
  if (!isObject(document)) addIssue(issues, source, 'document must be an object');
  else validateGroup(document, source, undefined, issues);
  if (issues.length > 0) throw new TokenValidationError(issues);
}

export function validateResolverDocument(document: ResolverDocument): void {
  const issues: ValidationIssue[] = [];
  if (document.version !== '2025.10')
    addIssue(issues, '$.version', 'resolver version must be 2025.10');
  const modifierNames = new Set<string>();
  for (const modifier of document.modifiers) {
    if (modifierNames.has(modifier.name))
      addIssue(issues, `$.modifiers.${modifier.name}`, 'modifier names must be unique');
    modifierNames.add(modifier.name);
    if (modifier.values.some((value) => typeof value !== 'string'))
      addIssue(issues, `$.modifiers.${modifier.name}`, 'modifier values must be strings');
    if (modifier.default !== undefined && !modifier.values.includes(modifier.default))
      addIssue(
        issues,
        `$.modifiers.${modifier.name}`,
        'modifier default must be one of its values',
      );
  }
  for (const set of document.sets)
    if (set.source.some((source) => typeof source !== 'string'))
      addIssue(issues, `$.sets.${set.name}`, 'set sources must be strings');
  for (const name of document.resolutionOrder)
    if (!modifierNames.has(name)) addIssue(issues, '$.resolutionOrder', `unknown modifier ${name}`);
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
  validateResolverDocument({
    version: document['version'],
    sets: document['sets'].filter(isObject).map((set) => ({
      name: typeof set['name'] === 'string' ? set['name'] : '',
      source: Array.isArray(set['source']) ? set['source'].filter(isString) : [],
    })),
    modifiers: document['modifiers'].filter(isObject).map((modifier) => ({
      name: typeof modifier['name'] === 'string' ? modifier['name'] : '',
      values: Array.isArray(modifier['values']) ? modifier['values'].filter(isString) : [],
      ...(typeof modifier['default'] === 'string' ? { default: modifier['default'] } : {}),
    })),
    resolutionOrder: document['resolutionOrder'].filter(isString),
  });
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isTokenType(value: unknown): value is TokenType {
  return typeof value === 'string' && TOKEN_TYPES.has(value);
}

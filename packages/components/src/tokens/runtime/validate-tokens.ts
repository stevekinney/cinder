import type { DesignToken, TokenType, ValidationIssue } from './types.ts';
import { TokenValidationError } from './types.ts';
import { unknownReservedPropertyReason } from './validate-resolver.ts';
import {
  GROUP_METADATA,
  TOKEN_METADATA,
  TOKEN_NAME_PATTERN,
  VENDOR_EXTENSION_PATTERN,
  addIssue,
  hasTokenValue,
  isObject,
  isReference,
  isTokenType,
  validateValue,
  type JsonObject,
} from './validate-values.ts';

export function tokenType(
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

export function validateMetadata(
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

/**
 * Validates a token-shaped node ($root's value, or an ordinary named leaf)
 * once both callers in `validateGroup` agree it declares `$value` and/or
 * `$ref` rather than nesting further groups.
 *
 * $type for a `$ref` token: unlike a `$value` token, `$ref` does not require
 * a declared or inherited `$type` here -- the acceptance case for CIN-463
 * (`{ copy: { $ref: "#/base" } }` at the document root, with no ancestor
 * group typing it) has nowhere to inherit one from. `resolve.ts` fills the
 * resolved `$type` in from the reference target when the `$ref` token
 * declares none of its own; `validateResolvedToken` is what actually
 * enforces "every resolved token has a $type", after that fallback has run.
 * If a `$ref` token DOES declare its own `$type`, it is still checked here
 * for membership in the known type set, just never used to check a value
 * shape (there is no `$value` to check until resolution).
 */
export function validateTokenNode(
  value: JsonObject,
  path: string,
  groupType: TokenType | undefined,
  mayInheritTypeThroughExtension: boolean,
  issues: ValidationIssue[],
  isRoot = false,
): void {
  validateMetadata(value, path, issues);
  const hasValue = '$value' in value;
  const hasRef = '$ref' in value;
  if (hasValue && hasRef) addIssue(issues, path, 'a token cannot declare both $value and $ref');
  const nonMetadataChildren = Object.keys(value).filter((key) => !key.startsWith('$'));
  if (nonMetadataChildren.length > 0)
    addIssue(
      issues,
      path,
      isRoot
        ? '$root token cannot contain child groups'
        : 'a token with $value or $ref cannot contain child groups',
    );
  for (const key of Object.keys(value))
    if (key.startsWith('$') && !TOKEN_METADATA.has(key))
      addIssue(issues, path, unknownReservedPropertyReason(key));
  if (hasRef && !hasValue) {
    if (typeof value['$ref'] !== 'string' || !value['$ref'].startsWith('#/'))
      addIssue(issues, path, '$ref must be a JSON Pointer reference');
    if (value['$type'] !== undefined && !isTokenType(value['$type']))
      addIssue(issues, path, `unknown $type ${JSON.stringify(value['$type'])}`);
    return;
  }
  const type =
    groupType === undefined && mayInheritTypeThroughExtension && value['$type'] === undefined
      ? undefined
      : tokenType(value, groupType, path, issues);
  if (type) validateValue(type, value['$value'], path, issues);
}

export function validateGroup(
  group: JsonObject,
  path: string,
  inheritedType: TokenType | undefined,
  issues: ValidationIssue[],
  isDocumentRoot = false,
  inheritsTypeThroughExtension = false,
): void {
  validateMetadata(group, path, issues, isDocumentRoot);
  for (const key of Object.keys(group))
    if (key.startsWith('$') && !GROUP_METADATA.has(key))
      addIssue(issues, path, unknownReservedPropertyReason(key));
  const groupType =
    group['$type'] === undefined ? inheritedType : tokenType(group, inheritedType, path, issues);
  const mayInheritTypeThroughExtension =
    inheritsTypeThroughExtension || (groupType === undefined && group['$extends'] !== undefined);
  for (const [name, value] of Object.entries(group)) {
    if (name === '$root') {
      // A `$root` token resolves at its group's own path, but reporting issues
      // there cannot distinguish the root token from the group that holds it --
      // and a group with a `$root` usually has siblings too. Point at the
      // document location instead, which is unambiguous and is where the author
      // has to edit; the token path is that minus the trailing `.$root`.
      const rootPath = `${path}.$root`;
      if (!isObject(value) || !hasTokenValue(value)) {
        addIssue(issues, rootPath, '$root must be a token object');
        continue;
      }
      validateTokenNode(value, rootPath, groupType, mayInheritTypeThroughExtension, issues, true);
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
    if (hasTokenValue(value)) {
      validateTokenNode(value, childPath, groupType, mayInheritTypeThroughExtension, issues);
      continue;
    }
    validateGroup(value, childPath, groupType, issues, false, mayInheritTypeThroughExtension);
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

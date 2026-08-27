import type {
  DesignToken,
  ResolverDocument,
  TokenDocument,
  TokenType,
  ValidationIssue,
} from './types.ts';
import { TokenValidationError } from './types.ts';
import { validateResolverDocumentSchema, validateTokenDocumentSchema } from './validate-schema.ts';

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
const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const COLOR_MEMBERS = new Set(['colorSpace', 'components', 'alpha', 'hex']);
const DIMENSION_MEMBERS = new Set(['value', 'unit']);

type JsonObject = Record<string, unknown>;
type ResolverDocumentShape = {
  version: unknown;
  sets: JsonObject;
  modifiers: JsonObject;
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
const TOKEN_METADATA = new Set([
  '$value',
  '$ref',
  '$type',
  '$description',
  '$deprecated',
  '$extensions',
]);

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

/**
 * A node is token-shaped if it declares either the value form (`$value`) or
 * the DTCG 2025.10 alias form (`$ref`) -- as opposed to a group, which
 * declares neither and instead nests further named children. Checking both
 * keys (rather than `$value` alone) is what CIN-463 fixes: previously a
 * `$ref`-only node fell through to being validated as an (empty) group.
 */
function hasTokenValue(value: JsonObject): boolean {
  return '$value' in value || '$ref' in value;
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
      return;
    case 'gradient':
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
          if (
            typeof stop['position'] === 'number' &&
            (stop['position'] < 0 || stop['position'] > 1)
          )
            addIssue(
              issues,
              `${path}.${index}.position`,
              'gradient position must be within [0, 1]',
            );
          if (
            typeof stop['position'] === 'number' &&
            previousPosition !== undefined &&
            stop['position'] < previousPosition
          )
            addIssue(
              issues,
              `${path}.${index}.position`,
              'gradient positions must be nondecreasing',
            );
          if (typeof stop['position'] === 'number') previousPosition = stop['position'];
        }
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
function validateTokenNode(
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

function validateGroup(
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

function isResolverReference(value: unknown): value is { $ref: string } {
  return isObject(value) && typeof value['$ref'] === 'string';
}

function unknownReservedPropertyReason(key: string): string {
  return `unknown reserved property ${key}`;
}

/**
 * Parses a resolutionOrder entry's `$ref` (e.g. "#/sets/foundation" or
 * "#/modifiers/theme") into its target kind and name. JSON Pointer
 * tilde-escapes are decoded per RFC 6901; returns undefined for anything
 * that isn't a well-formed pointer into `sets` or `modifiers`.
 */
function isResolverTargetKind(value: string): value is 'sets' | 'modifiers' {
  return value === 'sets' || value === 'modifiers';
}

export function resolutionOrderTarget(
  ref: string,
): { kind: 'sets' | 'modifiers'; name: string } | undefined {
  // RFC 6901 §6 order: percent-decode the whole fragment, then split
  // structurally on `/`, then tilde-decode the segment. Decoding before
  // splitting is what makes `#/sets/foo%2Fbar` decode to the three-segment
  // pointer `/sets/foo/bar` and be rejected -- a set named `foo/bar` is only
  // addressable as `#/sets/foo~1bar` -- while `#/sets/high%20contrast`
  // correctly names `high contrast`.
  let decoded: string;
  try {
    decoded = decodeURIComponent(ref);
  } catch {
    return undefined;
  }
  // `[^/]+` rather than `.+`: an unescaped `/` makes this a deeper pointer
  // than `#/<kind>/<name>`, not a name containing a slash.
  const match = /^#\/(sets|modifiers)\/([^/]+)$/.exec(decoded);
  if (!match) return undefined;
  const [, kind, rawName] = match;
  if (
    kind === undefined ||
    rawName === undefined ||
    !isResolverTargetKind(kind) ||
    /~(?:[^01]|$)/.test(rawName)
  )
    return undefined;
  const name = rawName.replaceAll('~1', '/').replaceAll('~0', '~');
  return { kind, name };
}

/**
 * Semantic checks the official DTCG 2025.10 resolver JSON Schema cannot
 * express: `default` matching a live context key, resolutionOrder entries
 * resolving to a set or modifier that actually exists (schema can only
 * constrain the `$ref` string's shape, not cross-reference sibling `sets`/
 * `modifiers` object keys), non-empty source/context arrays, and
 * resolutionOrder covering every set and modifier exactly once -- EXCEPT a
 * set that is reached only through a resolver-internal `#/sets/<name>`
 * reference from another set's `sources` or a modifier context (CIN-464):
 * that set contributes its documents at the position of whatever references
 * it, so requiring it in resolutionOrder too would be redundant. Such a set
 * MAY still appear in resolutionOrder as well -- nothing here forbids it --
 * it is simply no longer REQUIRED to.
 */
export function validateResolverDocument(document: ResolverDocumentShape): void {
  const issues: ValidationIssue[] = [];
  if (document.version !== '2025.10')
    addIssue(issues, '$.version', 'resolver version must be 2025.10');

  // CIN-464: a set or modifier context source may itself be a
  // resolver-internal `#/sets/<name>` reference rather than a token-document
  // path (see `validate-corpus.ts`'s `expandSetSources`/`expandContextSources`,
  // which resolve these into the referenced set's own documents). A set
  // pulled in only through another SET -- never named directly in
  // `resolutionOrder` -- still contributes its documents, at the position of
  // whatever references it, so it must NOT also be required in
  // `resolutionOrder` itself below. A set referenced only through a MODIFIER
  // CONTEXT is different: `buildTokensBaseCss`/`buildBaseDocuments` build the
  // base index exclusively from `resolutionOrder`'s set entries, and a CSS
  // custom-property override has nothing to override without a base
  // declaration -- so a set reachable ONLY via a modifier context, with no
  // path into the base, is a validated-but-ungenerable shape, not a
  // legitimate exemption. Only `setReferencedByAnotherSet` counts toward the
  // resolutionOrder exemption; modifier-context references are tracked
  // separately and checked below instead.
  // Keyed by CHILD set name -> the set of PARENT set names that reference it
  // internally. More than one parent referencing the same child means that
  // child gets expanded more than once into the resolved document tree --
  // reject that below (see the "Reject a child set expanded by multiple
  // ordered parents" check) rather than let it surface as the same
  // CSS-vs-resolved-JSON disagreement the single-parent-plus-explicit-listing
  // case already guards against.
  const parentsReferencingSet = new Map<string, Set<string>>();
  // Direct set-to-set reference edges (parent -> the child set names its own
  // sources reference), used below to compute each ORDERED set's full
  // transitive descendant closure -- the direct-parents-only version of that
  // check missed a child reachable through a CHAIN of internal references
  // (e.g. resolutionOrder "A, theme, Wrapper" where A -> Base and
  // Wrapper -> B -> Base: Base's only DIRECT parents are A and B, and only A
  // is itself ordered, so a direct-parent check sees no conflict even though
  // Base is genuinely expanded at both ordered positions).
  const setDirectChildren = new Map<string, Set<string>>();
  const setReferencedByAnotherSet = new Set<string>();
  const setReferencedByModifierContext = new Map<string, string>();
  function noteSetReferencedByAnotherSet(parentName: string, sources: unknown): void {
    if (!Array.isArray(sources)) return;
    for (const source of sources) {
      if (!isResolverReference(source)) continue;
      const target = resolutionOrderTarget(source['$ref']);
      if (target?.kind !== 'sets') continue;
      setReferencedByAnotherSet.add(target.name);
      const parents = parentsReferencingSet.get(target.name) ?? new Set();
      parents.add(parentName);
      parentsReferencingSet.set(target.name, parents);
      const children = setDirectChildren.get(parentName) ?? new Set();
      children.add(target.name);
      setDirectChildren.set(parentName, children);
    }
  }
  function noteSetReferencedByModifierContext(sources: unknown, contextPath: string): void {
    if (!Array.isArray(sources)) return;
    for (const source of sources) {
      if (!isResolverReference(source)) continue;
      const target = resolutionOrderTarget(source['$ref']);
      // Keep the FIRST-seen reference site: `.set()` would overwrite it when
      // multiple contexts reference the same unreachable set, silently
      // discarding evidence of every context but the last-processed one.
      if (target?.kind === 'sets' && !setReferencedByModifierContext.has(target.name))
        setReferencedByModifierContext.set(target.name, contextPath);
    }
  }

  const modifierNames = new Set(Object.keys(document.modifiers));
  for (const [name, modifier] of Object.entries(document.modifiers)) {
    if (!isObject(modifier) || !isObject(modifier['contexts'])) {
      addIssue(issues, `$.modifiers.${name}`, 'modifier must have a contexts object');
      continue;
    }
    const contexts = modifier['contexts'];
    for (const [contextName, sources] of Object.entries(contexts)) {
      if (!Array.isArray(sources) || sources.length === 0 || !sources.every(isResolverReference))
        addIssue(
          issues,
          `$.modifiers.${name}.contexts.${contextName}`,
          'context must be a non-empty array of $ref sources',
        );
      else
        noteSetReferencedByModifierContext(sources, `$.modifiers.${name}.contexts.${contextName}`);
    }
    if (
      modifier['default'] !== undefined &&
      (!isString(modifier['default']) || !Object.keys(contexts).includes(modifier['default']))
    )
      addIssue(issues, `$.modifiers.${name}`, 'modifier default must be one of its context names');
  }

  const setNames = new Set(Object.keys(document.sets));
  if (setNames.size === 0) addIssue(issues, '$.sets', 'resolver must include at least one set');
  for (const [name, set] of Object.entries(document.sets)) {
    if (
      !isObject(set) ||
      !Array.isArray(set['sources']) ||
      set['sources'].length === 0 ||
      !set['sources'].every(isResolverReference)
    )
      addIssue(issues, `$.sets.${name}`, 'set must have a non-empty array of $ref sources');
    else noteSetReferencedByAnotherSet(name, set['sources']);
  }
  const internallyReferencedSetNames = setReferencedByAnotherSet;

  const resolutionOrderTargets = new Set<string>();
  const explicitSetOrderPath = new Map<string, string>();
  for (const [index, entry] of document.resolutionOrder.entries()) {
    if (!isResolverReference(entry)) {
      addIssue(issues, `$.resolutionOrder.${index}`, 'resolutionOrder entry must be a $ref object');
      continue;
    }
    const target = resolutionOrderTarget(entry['$ref']);
    if (!target || !(target.kind === 'sets' ? setNames : modifierNames).has(target.name)) {
      addIssue(
        issues,
        `$.resolutionOrder.${index}`,
        `resolutionOrder must reference an existing set or modifier: ${entry['$ref']}`,
      );
      continue;
    }
    const key = `${target.kind}/${target.name}`;
    if (resolutionOrderTargets.has(key))
      addIssue(issues, `$.resolutionOrder.${index}`, 'resolutionOrder entries must be unique');
    resolutionOrderTargets.add(key);
    if (target.kind === 'sets') explicitSetOrderPath.set(target.name, `$.resolutionOrder.${index}`);
  }
  const expectedTargets = new Set([
    ...[...setNames]
      .filter((name) => !internallyReferencedSetNames.has(name))
      .map((name) => `sets/${name}`),
    ...[...modifierNames].map((name) => `modifiers/${name}`),
  ]);
  const unlistedTargets = [...expectedTargets].filter(
    (target) => !resolutionOrderTargets.has(target),
  );
  if (unlistedTargets.length > 0)
    addIssue(issues, '$.resolutionOrder', 'must list every set and modifier exactly once');

  // A set referenced by another SET is exempt from resolutionOrder because it
  // still contributes through that set's own expansion -- but nothing stops
  // it from ALSO being listed explicitly. That double inclusion is never
  // correct: `buildResolvedContexts` walks the full resolutionOrder, so if a
  // modifier sits between the referencing set and the explicit entry (e.g.
  // "A, theme, B" where A internally references B), expanding A re-applies
  // B's values AFTER the modifier, silently resetting whatever the modifier
  // just overrode -- while `buildTokensBaseCss` collects every set into
  // `:root` once and emits theme documents separately, so the generated CSS
  // and the resolved JSON snapshots disagree about which value wins. Reject
  // the combination outright rather than let it surface as that disagreement
  // later.
  for (const setName of setReferencedByAnotherSet) {
    const explicitPath = explicitSetOrderPath.get(setName);
    if (explicitPath !== undefined) {
      addIssue(
        issues,
        explicitPath,
        `set "${setName}" is already referenced internally by another ordered set and must not ` +
          'also appear in resolutionOrder -- it would be included twice',
      );
    }
  }

  // The single-parent-plus-explicit-listing case above doesn't cover a child
  // set reachable from TWO DIFFERENT ordered positions through a chain of
  // internal references -- e.g. resolutionOrder "A, theme, Wrapper" where
  // A -> Base directly, and Wrapper -> B -> Base (Base's only DIRECT parents
  // are A and B; only A is itself ordered, so a direct-parents-only check
  // sees no conflict even though Base is genuinely expanded again through
  // Wrapper's own recursive expansion). Compute each ordered set's full
  // TRANSITIVE descendant closure and reject any set reachable from more
  // than one ordered position -- this subsumes the direct-parent case above,
  // since a direct parent is a one-hop descendant.
  function transitiveDescendants(setName: string): Set<string> {
    const seen = new Set<string>();
    const stack = [setName];
    while (stack.length > 0) {
      const current = stack.pop()!;
      for (const child of setDirectChildren.get(current) ?? []) {
        if (seen.has(child)) continue; // also guards against a reference cycle
        seen.add(child);
        stack.push(child);
      }
    }
    return seen;
  }
  const reachingOrderedSets = new Map<string, Set<string>>();
  for (const target of resolutionOrderTargets) {
    if (!target.startsWith('sets/')) continue;
    const orderedSetName = target.slice('sets/'.length);
    for (const descendant of transitiveDescendants(orderedSetName)) {
      const reachers = reachingOrderedSets.get(descendant) ?? new Set();
      reachers.add(orderedSetName);
      reachingOrderedSets.set(descendant, reachers);
    }
  }
  for (const [setName, orderedAncestors] of reachingOrderedSets) {
    if (orderedAncestors.size > 1) {
      addIssue(
        issues,
        '$.resolutionOrder',
        `set "${setName}" is reachable from more than one ordered set ` +
          `(${[...orderedAncestors].sort().join(', ')}) and would be expanded more than once`,
      );
    }
  }

  // The `expectedTargets`/`unlistedTargets` check above exempts any set
  // referenced by another set from needing its own resolutionOrder entry --
  // but that exemption is unsound for a CLOSED CYCLE of sets that reference
  // only each other (e.g. "a" -> "b" -> "a"): each member is "referenced by
  // another set", so both are exempted, and neither is ever required to be
  // ordered. The cycle is then unreachable from every actual ordered
  // position, and `buildTokensBaseCss`/`buildBaseDocuments` silently omit
  // its documents entirely. `reachingOrderedSets` (computed above) already
  // captures every set genuinely reachable from an ordered position --
  // anything internally referenced but absent from it is unreachable,
  // cycle or not.
  for (const setName of setReferencedByAnotherSet) {
    const directlyOrdered = resolutionOrderTargets.has(`sets/${setName}`);
    if (!directlyOrdered && !reachingOrderedSets.has(setName)) {
      addIssue(
        issues,
        '$.resolutionOrder',
        `set "${setName}" is referenced internally but not reachable from any ordered set ` +
          '(possibly part of a closed cycle of sets that only reference each other) -- ' +
          'its documents would never be included',
      );
    }
  }

  // A set referenced only by a modifier context, with no path into the base
  // (neither listed in resolutionOrder itself nor reachable through another
  // set that is), has no base declaration for its tokens -- generation has
  // nothing to override. Reject it here, at validation time, rather than
  // letting it surface later as a confusing "no matching base token" error
  // during CSS generation.
  //
  // Known gap, tracked in CIN-479: this only checks that the set is
  // reachable SOMEWHERE in resolutionOrder -- not that its ordered position
  // precedes this modifier's own position. With resolutionOrder
  // [theme, base] and theme's context internally referencing #/sets/base,
  // documentsForResolutionOrder resolves base -> light-override -> base
  // again (the later explicit entry), so the resolved JSON reverts to base
  // while buildTokensBaseCss still lets the light override win via selector
  // specificity -- the two artifacts disagree. Fixing it means tracking each
  // ordered position's INDEX, not just membership, and requiring the
  // referenced set's (or its ordered ancestor's) position to strictly
  // precede this modifier's. Deferred rather than reworked this late in
  // review; nothing in the real corpus orders a modifier before the set it
  // references.
  for (const [setName, contextPath] of setReferencedByModifierContext) {
    const reachableFromBase =
      resolutionOrderTargets.has(`sets/${setName}`) || setReferencedByAnotherSet.has(setName);
    if (!reachableFromBase) {
      addIssue(
        issues,
        contextPath,
        `references set "${setName}", which has no path into the base ` +
          '(not in resolutionOrder and not referenced by another set) -- ' +
          'a modifier context can only override a base token, not introduce one',
      );
    }
  }

  if (issues.length > 0) throw new TokenValidationError(issues);
}

export function assertValidTokenDocument(
  document: unknown,
  source?: string,
): asserts document is TokenDocument {
  const issues: ValidationIssue[] = [];
  if (!isObject(document)) addIssue(issues, source ?? '$', 'document must be an object');
  if (issues.length > 0) throw new TokenValidationError(issues);
  // First-pass gate: the official DTCG 2025.10 format JSON Schema catches shape
  // violations structurally, before the semantic checks below run. See
  // validate-schema.ts for why this precedes (rather than replaces) validateTokenDocument.
  validateTokenDocumentSchema(document, source ?? '$');
  validateTokenDocument(document, source);
}

export function assertValidResolverDocument(
  document: unknown,
): asserts document is ResolverDocument {
  if (!isObject(document))
    throw new TokenValidationError([{ path: '$', reason: 'resolver must be an object' }]);
  // First-pass gate: the official DTCG 2025.10 resolver JSON Schema catches
  // shape violations structurally, before the semantic checks below run
  // (see validate-schema.ts for why validateResolverDocumentSchema exists
  // as a separate, explicitly-called step rather than being folded in here).
  validateResolverDocumentSchema(document);
  if (
    document['version'] !== '2025.10' ||
    !isObject(document['sets']) ||
    !isObject(document['modifiers']) ||
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

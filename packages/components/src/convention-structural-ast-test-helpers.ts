import { isObjectRecord } from '../scripts/validation-utilities.ts';

const CHILD_KEYS = [
  'nodes',
  'children',
  'body',
  'fragment',
  'block',
  'consequent',
  'alternate',
  'then',
  'else',
] as const;

export function findRestElementName(objectPattern: unknown): string | undefined {
  if (!isObjectRecord(objectPattern)) return undefined;
  const properties = objectPattern['properties'];
  if (!Array.isArray(properties)) return undefined;
  const rest = properties.find(isRestElement);
  if (!isObjectRecord(rest)) return undefined;
  const argument = rest['argument'];
  return isObjectRecord(argument) && typeof argument['name'] === 'string'
    ? argument['name']
    : undefined;
}

export function hasPropsTypeExport(moduleContent: unknown, propsName: string): boolean {
  return readBody(moduleContent).some((node) => isPropsTypeExport(node, propsName));
}

function isPropsTypeExport(node: unknown, propsName: string): boolean {
  if (!isObjectRecord(node) || node['type'] !== 'ExportNamedDeclaration') return false;
  const declaration = node['declaration'];
  if (isObjectRecord(declaration) && declaration['type'] === 'TSTypeAliasDeclaration') {
    const id = declaration['id'];
    if (isObjectRecord(id) && id['name'] === propsName) return true;
  }
  const specifiers = node['specifiers'];
  return (
    Array.isArray(specifiers) &&
    specifiers.some((specifier) => {
      if (!isObjectRecord(specifier)) return false;
      const exported = specifier['exported'];
      return isObjectRecord(exported) && exported['name'] === propsName;
    })
  );
}

export function findPropsDeclaration(instanceContent: unknown): unknown {
  return readBody(instanceContent).find(isPropsDeclaration);
}

function isPropsDeclaration(node: unknown): boolean {
  if (!isObjectRecord(node) || node['type'] !== 'VariableDeclaration') return false;
  const declarations = node['declarations'];
  return Array.isArray(declarations) && declarations.some(isPropsDeclarator);
}

function isPropsDeclarator(node: unknown): boolean {
  if (!isObjectRecord(node)) return false;
  const init = node['init'];
  if (!isObjectRecord(init) || init['type'] !== 'CallExpression') return false;
  const callee = init['callee'];
  return isObjectRecord(callee) && callee['name'] === '$props';
}

export function findPropsObjectPattern(propsDeclaration: unknown): unknown {
  if (!isObjectRecord(propsDeclaration)) return undefined;
  const declarations = propsDeclaration['declarations'];
  if (!Array.isArray(declarations)) return undefined;
  const first = declarations[0];
  return isObjectRecord(first) ? first['id'] : undefined;
}

function readBody(content: unknown): unknown[] {
  if (!isObjectRecord(content)) return [];
  const body = content['body'];
  return Array.isArray(body) ? body : [];
}

function isRestElement(value: unknown): boolean {
  return isObjectRecord(value) && value['type'] === 'RestElement';
}

export function hasNativeElementSpread(fragment: unknown): boolean {
  if (!isObjectRecord(fragment)) return false;
  if (isNativeElementWithSpread(fragment)) return true;
  return CHILD_KEYS.some((key) => hasSpreadInChild(fragment[key]));
}

function hasSpreadInChild(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasNativeElementSpread);
  return hasNativeElementSpread(value);
}

function isNativeElementWithSpread(node: Record<string, unknown>): boolean {
  if (!isNativeOrDynamicElement(node)) return false;
  const attributes = node['attributes'];
  return Array.isArray(attributes) && attributes.some(isSpreadAttribute);
}

function isNativeOrDynamicElement(node: Record<string, unknown>): boolean {
  if (node['type'] === 'SvelteElement') return true;
  return (
    node['type'] === 'RegularElement' &&
    typeof node['name'] === 'string' &&
    node['name'] === node['name'].toLowerCase() &&
    !node['name'].includes(':')
  );
}

function isSpreadAttribute(value: unknown): boolean {
  return isObjectRecord(value) && value['type'] === 'SpreadAttribute';
}

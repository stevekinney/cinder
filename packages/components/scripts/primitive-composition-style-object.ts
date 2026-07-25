import { parse as parseSvelte } from 'svelte/compiler';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function staticPropertyName(property: UnknownRecord): string | undefined {
  const key = property['key'];
  if (!isRecord(key)) return undefined;
  if (key['type'] === 'Identifier' && typeof key['name'] === 'string') return key['name'];
  if (key['type'] === 'Literal' && typeof key['value'] === 'string') return key['value'];
  return undefined;
}

function cssPropertyName(propertyName: string): string {
  return propertyName.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`).toLowerCase();
}

function staticValue(
  expression: unknown,
  bindings: ReadonlyMap<string, unknown>,
): string | undefined {
  if (!isRecord(expression)) return undefined;
  if (
    expression['type'] === 'Literal' &&
    (typeof expression['value'] === 'string' || typeof expression['value'] === 'number')
  )
    return String(expression['value']);
  if (expression['type'] === 'Identifier' && typeof expression['name'] === 'string') {
    const binding = bindings.get(expression['name']);
    return typeof binding === 'string' || typeof binding === 'number' ? String(binding) : undefined;
  }
  return undefined;
}

function collectObjectDeclarations(
  expression: unknown,
  bindings: ReadonlyMap<string, unknown>,
  declarations: Map<string, string>,
): void {
  if (!isRecord(expression)) return;
  if (expression['type'] === 'Identifier' && typeof expression['name'] === 'string') {
    collectObjectDeclarations(bindings.get(expression['name']), bindings, declarations);
    return;
  }
  if (expression['type'] !== 'ObjectExpression' || !Array.isArray(expression['properties'])) return;
  for (const property of expression['properties']) {
    if (!isRecord(property)) continue;
    if (property['type'] === 'SpreadElement') {
      collectObjectDeclarations(property['argument'], bindings, declarations);
      continue;
    }
    if (property['type'] !== 'Property' || property['computed'] === true) continue;
    const propertyName = staticPropertyName(property);
    if (propertyName === undefined) continue;
    declarations.set(
      cssPropertyName(propertyName),
      staticValue(property['value'], bindings)?.toLowerCase() ?? 'var(--cinder-dynamic-value)',
    );
  }
}

function staticBindings(instance: unknown): Map<string, unknown> {
  const bindings = new Map<string, unknown>();
  if (!isRecord(instance) || !isRecord(instance['content'])) return bindings;
  const body = instance['content']['body'];
  if (!Array.isArray(body)) return bindings;
  for (const statement of body) {
    if (
      !isRecord(statement) ||
      statement['type'] !== 'VariableDeclaration' ||
      !Array.isArray(statement['declarations'])
    )
      continue;
    for (const declaration of statement['declarations']) {
      if (
        !isRecord(declaration) ||
        !isRecord(declaration['id']) ||
        declaration['id']['type'] !== 'Identifier' ||
        typeof declaration['id']['name'] !== 'string'
      )
        continue;
      const initializer = declaration['init'];
      if (isRecord(initializer) && initializer['type'] === 'ObjectExpression')
        bindings.set(declaration['id']['name'], initializer);
      if (isRecord(initializer) && initializer['type'] === 'Literal')
        bindings.set(declaration['id']['name'], initializer['value']);
    }
  }
  return bindings;
}

export function styleObjectDeclarations(expression: unknown, source: string): Map<string, string> {
  const declarations = new Map<string, string>();
  const root: unknown = parseSvelte(source, { modern: true });
  const bindings = isRecord(root) ? staticBindings(root['instance']) : new Map<string, unknown>();
  collectObjectDeclarations(expression, bindings, declarations);
  return declarations;
}

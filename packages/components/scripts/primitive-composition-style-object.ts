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
  if (
    expression['type'] === 'ConditionalExpression' ||
    expression['type'] === 'LogicalExpression'
  ) {
    const consequentDeclarations = new Map<string, string>();
    const alternateDeclarations = new Map<string, string>();
    collectObjectDeclarations(
      expression['consequent'] ?? expression['left'],
      bindings,
      consequentDeclarations,
    );
    collectObjectDeclarations(
      expression['alternate'] ?? expression['right'],
      bindings,
      alternateDeclarations,
    );
    for (const [property, value] of [...consequentDeclarations, ...alternateDeclarations]) {
      const existing = declarations.get(property);
      if (
        property !== 'display' ||
        existing === undefined ||
        value === 'grid' ||
        value === 'inline-grid'
      )
        declarations.set(property, value);
    }
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
  const mutableBindings = new Set<string>();
  if (!isRecord(instance) || !isRecord(instance['content'])) return bindings;
  const body = instance['content']['body'];
  if (!Array.isArray(body)) return bindings;
  for (const statement of body) {
    if (!isRecord(statement)) continue;
    if (statement['type'] === 'VariableDeclaration' && Array.isArray(statement['declarations'])) {
      for (const declaration of statement['declarations']) {
        if (
          !isRecord(declaration) ||
          !isRecord(declaration['id']) ||
          declaration['id']['type'] !== 'Identifier' ||
          typeof declaration['id']['name'] !== 'string'
        )
          continue;
        if (statement['kind'] !== 'const') {
          mutableBindings.add(declaration['id']['name']);
          bindings.delete(declaration['id']['name']);
          continue;
        }
        const initializer = declaration['init'];
        if (
          isRecord(initializer) &&
          ['ObjectExpression', 'ConditionalExpression', 'LogicalExpression'].includes(
            String(initializer['type']),
          )
        )
          bindings.set(declaration['id']['name'], initializer);
        else if (isRecord(initializer) && initializer['type'] === 'Literal')
          bindings.set(declaration['id']['name'], initializer['value']);
        else bindings.delete(declaration['id']['name']);
      }
      continue;
    }
    const expression = statement['type'] === 'ExpressionStatement' ? statement['expression'] : null;
    if (
      !isRecord(expression) ||
      expression['type'] !== 'AssignmentExpression' ||
      expression['operator'] !== '=' ||
      !isRecord(expression['left']) ||
      expression['left']['type'] !== 'Identifier' ||
      typeof expression['left']['name'] !== 'string'
    )
      continue;
    if (!mutableBindings.has(expression['left']['name'])) continue;
    const assignedValue = expression['right'];
    if (isRecord(assignedValue) && assignedValue['type'] === 'ObjectExpression')
      bindings.set(expression['left']['name'], assignedValue);
    else if (isRecord(assignedValue) && assignedValue['type'] === 'Literal')
      bindings.set(expression['left']['name'], assignedValue['value']);
    else bindings.delete(expression['left']['name']);
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

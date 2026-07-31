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
  rawExpression: unknown,
  bindings: ReadonlyMap<string, readonly unknown[]>,
): string | undefined {
  const expression = unwrapTypeExpression(rawExpression);
  if (!isRecord(expression)) return undefined;
  if (
    expression['type'] === 'Literal' &&
    (typeof expression['value'] === 'string' || typeof expression['value'] === 'number')
  )
    return String(expression['value']);
  if (expression['type'] === 'Identifier' && typeof expression['name'] === 'string') {
    const candidates = bindings.get(expression['name']) ?? [];
    // A reassignable binding with more than one reachable static value (an
    // initializer plus a later handler write, say) can't be flattened to a
    // single scalar — treat it the same as an unresolved dynamic value
    // rather than arbitrarily picking one candidate.
    if (candidates.length !== 1) return undefined;
    const binding = candidates[0];
    return typeof binding === 'string' || typeof binding === 'number' ? String(binding) : undefined;
  }
  return undefined;
}

function unwrapTypeExpression(expression: unknown): unknown {
  if (!isRecord(expression)) return expression;
  if (
    expression['type'] === 'TSAsExpression' ||
    expression['type'] === 'TSSatisfiesExpression' ||
    expression['type'] === 'TSNonNullExpression'
  )
    return unwrapTypeExpression(expression['expression']);
  return expression;
}

function mergeDeclarations(
  base: ReadonlyMap<string, string>,
  additions: ReadonlyMap<string, string>,
): Map<string, string> {
  return new Map([...base, ...additions]);
}

function collectObjectDeclarationBranches(
  rawExpression: unknown,
  bindings: ReadonlyMap<string, readonly unknown[]>,
): Map<string, string>[] {
  const expression = unwrapTypeExpression(rawExpression);
  if (!isRecord(expression)) return [new Map()];
  if (expression['type'] === 'Identifier' && typeof expression['name'] === 'string') {
    const candidates = bindings.get(expression['name']);
    if (candidates === undefined) return [new Map()];
    // Every reachable static value for this binding — e.g. its initializer
    // *and* a later handler reassignment — is a possible render state and
    // must be checked independently, the same way a ConditionalExpression's
    // branches are.
    return candidates.flatMap((candidate) => collectObjectDeclarationBranches(candidate, bindings));
  }
  if (
    expression['type'] === 'ConditionalExpression' ||
    expression['type'] === 'LogicalExpression'
  ) {
    return [
      ...collectObjectDeclarationBranches(expression['consequent'] ?? expression['left'], bindings),
      ...collectObjectDeclarationBranches(expression['alternate'] ?? expression['right'], bindings),
    ];
  }
  if (expression['type'] !== 'ObjectExpression' || !Array.isArray(expression['properties']))
    return [new Map()];
  let branches = [new Map<string, string>()];
  for (const property of expression['properties']) {
    if (!isRecord(property)) continue;
    if (property['type'] === 'SpreadElement') {
      const spreadBranches = collectObjectDeclarationBranches(property['argument'], bindings);
      branches = branches.flatMap((branch) =>
        spreadBranches.map((spreadBranch) => mergeDeclarations(branch, spreadBranch)),
      );
      continue;
    }
    if (property['type'] !== 'Property' || property['computed'] === true) continue;
    const propertyName = staticPropertyName(property);
    if (propertyName === undefined) continue;
    const normalizedPropertyName = cssPropertyName(propertyName);
    const normalizedValue =
      staticValue(property['value'], bindings)?.toLowerCase() ?? 'var(--cinder-dynamic-value)';
    for (const branch of branches) branch.set(normalizedPropertyName, normalizedValue);
  }
  return branches;
}

function declaredNamesInPattern(pattern: unknown, into: Set<string>): void {
  if (!isRecord(pattern)) return;
  if (pattern['type'] === 'Identifier' && typeof pattern['name'] === 'string') {
    into.add(pattern['name']);
    return;
  }
  if (pattern['type'] === 'RestElement') {
    declaredNamesInPattern(pattern['argument'], into);
    return;
  }
  if (pattern['type'] === 'AssignmentPattern') {
    declaredNamesInPattern(pattern['left'], into);
    return;
  }
  if (pattern['type'] === 'ArrayPattern' && Array.isArray(pattern['elements'])) {
    for (const element of pattern['elements']) declaredNamesInPattern(element, into);
    return;
  }
  if (pattern['type'] === 'ObjectPattern' && Array.isArray(pattern['properties']))
    for (const property of pattern['properties']) {
      if (!isRecord(property)) continue;
      declaredNamesInPattern(
        property['type'] === 'RestElement' ? property['argument'] : property['value'],
        into,
      );
    }
}

// Whole-function shadow check: does this function (excluding further-nested
// function bodies, whose own shadowing is evaluated independently) declare a
// local binding with this name anywhere?
function declaresNameWithinFunctionScope(node: unknown, name: string): boolean {
  if (!isRecord(node)) return false;
  if (
    node['type'] === 'FunctionDeclaration' ||
    node['type'] === 'FunctionExpression' ||
    node['type'] === 'ArrowFunctionExpression'
  )
    return false;
  if (node['type'] === 'VariableDeclarator') {
    const names = new Set<string>();
    declaredNamesInPattern(node['id'], names);
    if (names.has(name)) return true;
  }
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      if (value.some((item) => declaresNameWithinFunctionScope(item, name))) return true;
    } else if (isRecord(value) && declaresNameWithinFunctionScope(value, name)) {
      return true;
    }
  }
  return false;
}

function resolvedAssignmentValue(
  rawValue: unknown,
  bindings: ReadonlyMap<string, unknown[]> = new Map(),
): { set: true; values: unknown[] } | { set: false } {
  const value = unwrapTypeExpression(rawValue);
  if (
    isRecord(value) &&
    ['ObjectExpression', 'ConditionalExpression', 'LogicalExpression'].includes(
      String(value['type']),
    )
  )
    return { set: true, values: [value] };
  if (isRecord(value) && value['type'] === 'Literal')
    return { set: true, values: [value['value']] };
  if (isRecord(value) && value['type'] === 'Identifier' && typeof value['name'] === 'string') {
    const candidates = bindings.get(value['name']);
    if (candidates !== undefined && candidates.length > 0)
      return { set: true, values: [...candidates] };
  }
  return { set: false };
}

function staticBindings(instance: unknown): Map<string, unknown[]> {
  const bindings = new Map<string, unknown[]>();
  const mutableBindings = new Set<string>();
  if (!isRecord(instance) || !isRecord(instance['content'])) return bindings;
  const body = instance['content']['body'];
  if (!Array.isArray(body)) return bindings;

  // Pass 1: collect top-level `let`/`var` declarations (module-scope mutable
  // bindings) and their initial value, in source order.
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
      const name = declaration['id']['name'];
      if (statement['kind'] !== 'const') mutableBindings.add(name);
      const resolved = resolvedAssignmentValue(declaration['init']);
      if (resolved.set) bindings.set(name, resolved.values);
      else bindings.delete(name);
    }
  }
  if (mutableBindings.size === 0) return bindings;

  // Pass 2: apply every reassignment of a tracked mutable binding, including
  // writes made inside function bodies — a click handler reassigning a
  // shared mutable style object must not evade detection just because the
  // write isn't a top-level statement — but not writes inside a function
  // that locally shadows the same name (its own param or a nested
  // `let`/`const`/`var` declaration).
  //
  // A top-level (synchronous, pre-render) reassignment overwrites the prior
  // value, since only the last one is ever actually rendered. A write made
  // inside a function body happens at some indeterminate *later* time (if
  // the handler ever runs) and does not retroactively change what the
  // initial render looked like, so it's recorded as an *additional*
  // reachable value rather than replacing the existing one — the same way a
  // ConditionalExpression's branches are both kept.
  const walk = (
    node: unknown,
    shadowed: ReadonlySet<string>,
    insideFunction: boolean,
    conditional = false,
  ): void => {
    if (!isRecord(node)) return;
    let currentShadowed = shadowed;
    let currentInsideFunction = insideFunction;
    if (node['type'] === 'IfStatement') {
      if (isRecord(node['test']))
        walk(node['test'], currentShadowed, currentInsideFunction, conditional);
      if (isRecord(node['consequent']))
        walk(node['consequent'], currentShadowed, currentInsideFunction, true);
      if (isRecord(node['alternate']))
        walk(node['alternate'], currentShadowed, currentInsideFunction, true);
      return;
    }
    if (node['type'] === 'ConditionalExpression') {
      if (isRecord(node['test']))
        walk(node['test'], currentShadowed, currentInsideFunction, conditional);
      if (isRecord(node['consequent']))
        walk(node['consequent'], currentShadowed, currentInsideFunction, true);
      if (isRecord(node['alternate']))
        walk(node['alternate'], currentShadowed, currentInsideFunction, true);
      return;
    }
    if (
      node['type'] === 'FunctionDeclaration' ||
      node['type'] === 'FunctionExpression' ||
      node['type'] === 'ArrowFunctionExpression'
    ) {
      currentInsideFunction = true;
      const localNames = new Set<string>();
      if (Array.isArray(node['params']))
        for (const parameter of node['params']) declaredNamesInPattern(parameter, localNames);
      const newlyShadowed = [...mutableBindings].filter(
        (name) =>
          !currentShadowed.has(name) &&
          (localNames.has(name) || declaresNameWithinFunctionScope(node['body'], name)),
      );
      if (newlyShadowed.length > 0)
        currentShadowed = new Set([...currentShadowed, ...newlyShadowed]);
    }
    if (
      node['type'] === 'AssignmentExpression' &&
      node['operator'] === '=' &&
      isRecord(node['left']) &&
      node['left']['type'] === 'Identifier' &&
      typeof node['left']['name'] === 'string' &&
      mutableBindings.has(node['left']['name']) &&
      !currentShadowed.has(node['left']['name'])
    ) {
      const name = node['left']['name'];
      const resolved = resolvedAssignmentValue(node['right'], bindings);
      if (currentInsideFunction) {
        if (resolved.set) bindings.set(name, [...(bindings.get(name) ?? []), ...resolved.values]);
      } else if (resolved.set && conditional) {
        bindings.set(name, [...(bindings.get(name) ?? []), ...resolved.values]);
      } else if (resolved.set) {
        bindings.set(name, resolved.values);
      } else {
        bindings.delete(name);
      }
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value))
        for (const item of value) walk(item, currentShadowed, currentInsideFunction, conditional);
      else if (isRecord(value)) walk(value, currentShadowed, currentInsideFunction, conditional);
    }
  };
  for (const statement of body) walk(statement, new Set(), false);

  return bindings;
}

export function styleObjectDeclarationBranches(
  expression: unknown,
  source: string,
): Map<string, string>[] {
  const root: unknown = parseSvelte(source, { modern: true });
  const bindings = isRecord(root) ? staticBindings(root['instance']) : new Map<string, unknown[]>();
  return collectObjectDeclarationBranches(expression, bindings);
}

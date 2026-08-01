import { parse as parseSvelte } from 'svelte/compiler';

type UnknownRecord = Record<string, unknown>;
const unresolvedBinding = Symbol('unresolved-binding');
const knownUndefinedBinding = Symbol('known-undefined-binding');

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

function staticNullish(
  rawExpression: unknown,
  bindings: ReadonlyMap<string, readonly unknown[]>,
): boolean | undefined {
  const expression = unwrapTypeExpression(rawExpression);
  if (expression === unresolvedBinding) return undefined;
  if (expression === knownUndefinedBinding) return true;
  if (!isRecord(expression)) return expression === null || expression === undefined;
  if (expression['type'] === 'Literal') return expression['value'] === null;
  if (expression['type'] === 'Identifier' && typeof expression['name'] === 'string') {
    if (expression['name'] === 'undefined' && !bindings.has('undefined')) return true;
    const candidates = bindings.get(expression['name']);
    if (candidates === undefined || candidates.length !== 1) return undefined;
    return staticNullish(candidates[0], bindings);
  }
  if (expression['type'] === 'UnaryExpression' && expression['operator'] === 'void') return true;
  if (
    expression['type'] === 'ObjectExpression' ||
    expression['type'] === 'ArrayExpression' ||
    expression['type'] === 'FunctionExpression' ||
    expression['type'] === 'ArrowFunctionExpression' ||
    expression['type'] === 'ClassExpression'
  )
    return false;
  return undefined;
}

function staticTruthiness(
  rawExpression: unknown,
  bindings: ReadonlyMap<string, readonly unknown[]>,
): boolean | undefined {
  const expression = unwrapTypeExpression(rawExpression);
  if (expression === unresolvedBinding) return undefined;
  if (expression === knownUndefinedBinding) return false;
  if (!isRecord(expression)) return expression === undefined ? undefined : Boolean(expression);
  if (expression['type'] === 'Literal') return Boolean(expression['value']);
  if (expression['type'] === 'ObjectExpression' || expression['type'] === 'ArrayExpression')
    return true;
  if (
    expression['type'] === 'FunctionExpression' ||
    expression['type'] === 'ArrowFunctionExpression' ||
    expression['type'] === 'ClassExpression'
  )
    return true;
  if (expression['type'] === 'Identifier' && typeof expression['name'] === 'string') {
    if (expression['name'] === 'undefined' && !bindings.has('undefined')) return false;
    const candidates = bindings.get(expression['name']);
    if (candidates === undefined || candidates.length !== 1) return undefined;
    return staticTruthiness(candidates[0], bindings);
  }
  if (expression['type'] === 'UnaryExpression' && expression['operator'] === 'void') return false;
  if (expression['type'] === 'UnaryExpression' && expression['operator'] === '!') {
    const value = staticTruthiness(expression['argument'], bindings);
    return value === undefined ? undefined : !value;
  }
  if (expression['type'] === 'LogicalExpression') {
    const left = expression['left'];
    const leftTruthiness = staticTruthiness(left, bindings);
    const operator = expression['operator'];
    if (operator === '&&') {
      if (leftTruthiness === false) return false;
      return leftTruthiness === true ? staticTruthiness(expression['right'], bindings) : undefined;
    }
    if (operator === '||') {
      if (leftTruthiness === true) return true;
      return leftTruthiness === false ? staticTruthiness(expression['right'], bindings) : undefined;
    }
    if (operator === '??') {
      const leftNullish = staticNullish(left, bindings);
      return leftNullish === true
        ? staticTruthiness(expression['right'], bindings)
        : leftNullish === false
          ? leftTruthiness
          : undefined;
    }
  }
  return undefined;
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
    if (expression['type'] === 'LogicalExpression') {
      const left = expression['left'];
      const leftTruthiness = staticTruthiness(left, bindings);
      const operator = expression['operator'];
      const leftNullish = staticNullish(left, bindings);
      const rightOnly =
        (operator === '&&' && leftTruthiness === true) ||
        (operator === '||' && leftTruthiness === false) ||
        (operator === '??' && leftNullish === true);
      const leftOnly =
        (operator === '&&' && leftTruthiness === false) ||
        (operator === '||' && leftTruthiness === true) ||
        (operator === '??' && leftNullish === false);
      if (rightOnly) return collectObjectDeclarationBranches(expression['right'], bindings);
      if (leftOnly) return collectObjectDeclarationBranches(left, bindings);
    }
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
  if (
    node['type'] === 'VariableDeclaration' &&
    node['kind'] === 'var' &&
    Array.isArray(node['declarations'])
  )
    for (const declaration of node['declarations']) {
      if (!isRecord(declaration)) continue;
      const names = new Set<string>();
      declaredNamesInPattern(declaration['id'], names);
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

function mergeValues(values: readonly unknown[]): unknown[] {
  return [...new Set(values)];
}

function unconditionallyAbruptStatement(statement: unknown): boolean {
  if (!isRecord(statement)) return false;
  if (
    statement['type'] === 'BreakStatement' ||
    statement['type'] === 'ContinueStatement' ||
    statement['type'] === 'ReturnStatement' ||
    statement['type'] === 'ThrowStatement'
  )
    return true;
  if (statement['type'] === 'IfStatement')
    return (
      isRecord(statement['consequent']) &&
      unconditionallyAbruptStatement(statement['consequent']) &&
      isRecord(statement['alternate']) &&
      unconditionallyAbruptStatement(statement['alternate'])
    );
  return (
    statement['type'] === 'BlockStatement' &&
    Array.isArray(statement['body']) &&
    statement['body'].length > 0 &&
    unconditionallyAbruptStatement(statement['body'][statement['body'].length - 1])
  );
}

function staticBindings(instance: unknown): Map<string, unknown[]> {
  const bindings = new Map<string, unknown[]>();
  const mutableBindings = new Set<string>();
  const callbackBindings = new Map<string, unknown[]>();
  const callbackFrames: Map<string, unknown[]>[] = [];
  const localAliasFrames: Map<string, unknown[]>[] = [];
  const synchronousFunctions = new WeakSet<object>();
  if (!isRecord(instance) || !isRecord(instance['content'])) return bindings;
  const body = instance['content']['body'];
  if (!Array.isArray(body)) return bindings;

  // Collect top-level mutable binding names before walking the body. Values
  // themselves are resolved by the walk so aliases observe assignments that
  // precede their declaration in source order.
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
    }
  }

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
  const valuesWithCallbackState = (name: string, values: readonly unknown[]): unknown[] =>
    mergeValues([...values, ...(callbackBindings.get(name) ?? [])]);
  const cloneBindings = (): Map<string, unknown[]> =>
    new Map([...bindings].map(([name, values]) => [name, [...values]] as const));
  const visibleAliasBindings = (): Map<string, unknown[]> => {
    const visible = new Map(bindings);
    for (const frame of localAliasFrames)
      for (const [name, values] of frame) visible.set(name, values);
    return visible;
  };
  const mergeBindingStates = (
    base: Map<string, unknown[]>,
    branch: Map<string, unknown[]>,
  ): void => {
    bindings.clear();
    const names = new Set([...base.keys(), ...branch.keys()]);
    for (const name of names) {
      const values = mergeValues([...(base.get(name) ?? []), ...(branch.get(name) ?? [])]);
      if (values.length > 0) bindings.set(name, values);
    }
  };
  const breakTargets: Array<{
    label: string | undefined;
    states: Map<string, unknown[]>[] | undefined;
  }> = [];
  const continueTargets: Array<{ states: Map<string, unknown[]>[] }> = [];
  const resolveDeclaration = (name: string, kind: string, initializer: unknown): void => {
    if (initializer === undefined || initializer === null) {
      // `var name;` preserves a prior value, while an uninitialized `let`
      // declaration makes the binding unknown.
      if (kind === 'var' && bindings.has(name)) return;
      const callbackValues = callbackBindings.get(name) ?? [];
      if (callbackValues.length > 0) bindings.set(name, [...callbackValues]);
      else if (name === 'undefined') bindings.set(name, [knownUndefinedBinding]);
      else bindings.delete(name);
      return;
    }
    const resolved = resolvedAssignmentValue(initializer, bindings);
    if (resolved.set) {
      const values = valuesWithCallbackState(name, resolved.values);
      if (values.length > 0) bindings.set(name, values);
      else bindings.delete(name);
    } else {
      const callbackValues = callbackBindings.get(name) ?? [];
      if (callbackValues.length > 0) bindings.set(name, [...callbackValues]);
      else if (name === 'undefined') bindings.set(name, [unresolvedBinding]);
      else bindings.delete(name);
    }
  };
  const walk = (
    node: unknown,
    shadowed: ReadonlySet<string>,
    insideFunction: boolean,
    controlLabel?: string,
  ): void => {
    if (!isRecord(node)) return;
    let pushedAliasBlock = false;
    let blockBindingBase: Map<string, unknown[]> | undefined;
    let currentShadowed = shadowed;
    let currentInsideFunction = insideFunction;
    if (node['type'] === 'BreakStatement') {
      const label =
        isRecord(node['label']) && typeof node['label']['name'] === 'string'
          ? node['label']['name']
          : undefined;
      const target = label
        ? breakTargets.findLast((candidate) => candidate.label === label)
        : breakTargets.at(-1);
      target?.states?.push(cloneBindings());
      return;
    }
    if (node['type'] === 'ContinueStatement') {
      continueTargets.at(-1)?.states.push(cloneBindings());
      return;
    }
    if (node['type'] === 'LabeledStatement') {
      const label =
        isRecord(node['label']) && typeof node['label']['name'] === 'string'
          ? node['label']['name']
          : undefined;
      if (isRecord(node['body'])) walk(node['body'], currentShadowed, currentInsideFunction, label);
      return;
    }
    if (node['type'] === 'TryStatement') {
      const base = cloneBindings();
      const alternatives: Map<string, unknown[]>[] = [];
      if (isRecord(node['block'])) {
        walk(node['block'], currentShadowed, currentInsideFunction);
        alternatives.push(cloneBindings());
      }
      bindings.clear();
      for (const [name, values] of base) bindings.set(name, [...values]);
      if (isRecord(node['handler'])) {
        walk(node['handler'], currentShadowed, currentInsideFunction);
        alternatives.push(cloneBindings());
      }
      bindings.clear();
      for (const [name, values] of alternatives[0] ?? base) bindings.set(name, [...values]);
      for (const alternative of alternatives.slice(1))
        mergeBindingStates(cloneBindings(), alternative);
      if (isRecord(node['finalizer']))
        walk(node['finalizer'], currentShadowed, currentInsideFunction);
      return;
    }
    if (node['type'] === 'SwitchStatement') {
      const interruptedStates: Map<string, unknown[]>[] = [];
      breakTargets.push({ label: controlLabel, states: interruptedStates });
      if (isRecord(node['discriminant']))
        walk(node['discriminant'], currentShadowed, currentInsideFunction);
      const cases = Array.isArray(node['cases']) ? node['cases'].filter(isRecord) : [];
      const base = cloneBindings();
      const staticCaseValue = (value: unknown): unknown => {
        if (
          value === null ||
          typeof value === 'string' ||
          typeof value === 'number' ||
          typeof value === 'boolean'
        )
          return value;
        if (isRecord(value) && value['type'] === 'Literal') return value['value'];
        if (
          isRecord(value) &&
          value['type'] === 'Identifier' &&
          typeof value['name'] === 'string'
        ) {
          const candidates = bindings.get(value['name']) ?? [];
          if (candidates.length === 1) return staticCaseValue(candidates[0]);
        }
        return undefined;
      };
      const discriminantValue = staticCaseValue(node['discriminant']);
      const starts: Array<{ index: number; state: Map<string, unknown[]> }> = [];
      let testState = new Map(base);
      let matched = false;
      let defaultIndex: number | undefined;
      for (let index = 0; index < cases.length; index++) {
        const caseNode = cases[index];
        if (caseNode === undefined) continue;
        if (isRecord(caseNode['test'])) {
          bindings.clear();
          for (const [name, values] of testState) bindings.set(name, [...values]);
          walk(caseNode['test'], currentShadowed, currentInsideFunction);
          testState = cloneBindings();
          const caseValue = staticCaseValue(caseNode['test']);
          if (discriminantValue !== undefined && caseValue !== undefined) {
            if (Object.is(discriminantValue, caseValue)) {
              starts.push({ index, state: new Map(testState) });
              matched = true;
              break;
            }
          } else if (discriminantValue === undefined || caseValue === undefined)
            starts.push({ index, state: new Map(testState) });
        } else if (defaultIndex === undefined) defaultIndex = index;
      }
      if (!matched && defaultIndex !== undefined)
        starts.push({ index: defaultIndex, state: new Map(testState) });
      else if (discriminantValue === undefined)
        starts.push({ index: cases.length, state: new Map(testState) });
      const terminalStates: Map<string, unknown[]>[] = [];
      for (const start of starts) {
        bindings.clear();
        for (const [name, values] of start.state) bindings.set(name, [...values]);
        for (let index = start.index; index < cases.length; index++) {
          const caseNode = cases[index];
          if (caseNode === undefined) continue;
          if (!Array.isArray(caseNode['consequent'])) continue;
          for (const statement of caseNode['consequent']) {
            walk(statement, currentShadowed, currentInsideFunction);
            if (unconditionallyAbruptStatement(statement)) break;
          }
          if (caseNode['consequent'].some(unconditionallyAbruptStatement)) break;
        }
        terminalStates.push(cloneBindings());
      }
      breakTargets.pop();
      let continuingState = terminalStates.shift() ?? base;
      for (const interruptedState of interruptedStates) {
        mergeBindingStates(continuingState, interruptedState);
        continuingState = cloneBindings();
      }
      for (const terminalState of terminalStates) {
        mergeBindingStates(continuingState, terminalState);
        continuingState = cloneBindings();
      }
      return;
    }
    if (node['type'] === 'IfStatement') {
      const testTruthiness = staticTruthiness(node['test'], bindings);
      if (isRecord(node['test'])) walk(node['test'], currentShadowed, currentInsideFunction);
      const base = new Map([...bindings].map(([name, values]) => [name, [...values]] as const));
      const callbackFrame = callbackFrames.at(-1);
      const baseCallbackFrame = callbackFrame
        ? new Map([...callbackFrame].map(([name, values]) => [name, [...values]] as const))
        : undefined;
      const branchCallbackFrames: Map<string, unknown[]>[] = [];
      const branchValues: Map<string, unknown[]>[] = [];
      const branchesToWalk =
        testTruthiness === true
          ? [node['consequent']]
          : testTruthiness === false
            ? [node['alternate']]
            : [node['consequent'], node['alternate']];
      for (const branch of branchesToWalk) {
        bindings.clear();
        for (const [name, values] of base) bindings.set(name, [...values]);
        if (callbackFrame) {
          callbackFrame.clear();
          for (const [name, values] of baseCallbackFrame ?? [])
            callbackFrame.set(name, [...values]);
        }
        if (isRecord(branch)) walk(branch, currentShadowed, currentInsideFunction);
        if (isRecord(branch)) {
          const localNames = new Set<string>();
          const collect = (candidate: unknown): void => {
            if (!isRecord(candidate)) return;
            if (
              candidate['type'] === 'FunctionDeclaration' ||
              candidate['type'] === 'FunctionExpression' ||
              candidate['type'] === 'ArrowFunctionExpression'
            )
              return;
            if (
              candidate['type'] === 'VariableDeclaration' &&
              (candidate['kind'] === 'let' || candidate['kind'] === 'const') &&
              Array.isArray(candidate['declarations'])
            )
              for (const declaration of candidate['declarations'])
                if (isRecord(declaration)) declaredNamesInPattern(declaration['id'], localNames);
            for (const value of Object.values(candidate))
              if (Array.isArray(value)) value.forEach(collect);
              else if (isRecord(value)) collect(value);
          };
          collect(branch);
          for (const name of localNames) {
            const previous = base.get(name);
            if (previous === undefined) bindings.delete(name);
            else bindings.set(name, [...previous]);
          }
        }
        if (callbackFrame)
          branchCallbackFrames.push(
            new Map([...callbackFrame].map(([name, values]) => [name, [...values]] as const)),
          );
        branchValues.push(
          new Map([...bindings].map(([name, values]) => [name, [...values]] as const)),
        );
      }
      bindings.clear();
      const names = new Set([
        ...base.keys(),
        ...branchValues.flatMap((branch) => [...branch.keys()]),
      ]);
      for (const name of names) {
        const merged = [...new Set(branchValues.flatMap((branch) => branch.get(name) ?? []))];
        if (merged.length > 0) bindings.set(name, merged);
        else bindings.delete(name);
      }
      if (callbackFrame) {
        callbackFrame.clear();
        for (const name of new Set(branchCallbackFrames.flatMap((branch) => [...branch.keys()]))) {
          const values = mergeValues(
            branchCallbackFrames.flatMap((branch) => branch.get(name) ?? []),
          );
          if (values.length > 0) callbackFrame.set(name, values);
        }
      }
      return;
    }
    if (node['type'] === 'ConditionalExpression') {
      if (isRecord(node['test'])) walk(node['test'], currentShadowed, currentInsideFunction);
      const base = new Map([...bindings].map(([name, values]) => [name, [...values]] as const));
      const callbackFrame = callbackFrames.at(-1);
      const baseCallbackFrame = callbackFrame
        ? new Map([...callbackFrame].map(([name, values]) => [name, [...values]] as const))
        : undefined;
      const branchCallbackFrames: Map<string, unknown[]>[] = [];
      const branchCandidates =
        staticTruthiness(node['test'], base) === true
          ? [node['consequent']]
          : staticTruthiness(node['test'], base) === false
            ? [node['alternate']]
            : [node['consequent'], node['alternate']];
      const branches = branchCandidates.map((branch) => {
        bindings.clear();
        for (const [name, values] of base) bindings.set(name, [...values]);
        if (callbackFrame) {
          callbackFrame.clear();
          for (const [name, values] of baseCallbackFrame ?? [])
            callbackFrame.set(name, [...values]);
        }
        if (isRecord(branch)) walk(branch, currentShadowed, currentInsideFunction);
        if (callbackFrame)
          branchCallbackFrames.push(
            new Map([...callbackFrame].map(([name, values]) => [name, [...values]] as const)),
          );
        return new Map([...bindings].map(([name, values]) => [name, [...values]] as const));
      });
      bindings.clear();
      const names = new Set([...base.keys(), ...branches.flatMap((branch) => [...branch.keys()])]);
      for (const name of names) {
        const merged = [...new Set(branches.flatMap((branch) => branch.get(name) ?? []))];
        if (merged.length > 0) bindings.set(name, merged);
        else bindings.delete(name);
      }
      if (callbackFrame) {
        callbackFrame.clear();
        for (const name of new Set(branchCallbackFrames.flatMap((branch) => [...branch.keys()]))) {
          const values = mergeValues(
            branchCallbackFrames.flatMap((branch) => branch.get(name) ?? []),
          );
          if (values.length > 0) callbackFrame.set(name, values);
        }
      }
      return;
    }
    if (
      node['type'] === 'ForStatement' ||
      node['type'] === 'ForInStatement' ||
      node['type'] === 'ForOfStatement'
    ) {
      const loopBinding = node['type'] === 'ForStatement' ? node['init'] : node['left'];
      const loopShadowed = new Set(currentShadowed);
      const loopLocalNames = new Set<string>();
      if (
        isRecord(loopBinding) &&
        loopBinding['type'] === 'VariableDeclaration' &&
        (loopBinding['kind'] === 'let' || loopBinding['kind'] === 'const') &&
        Array.isArray(loopBinding['declarations'])
      )
        for (const declaration of loopBinding['declarations'])
          if (isRecord(declaration)) {
            declaredNamesInPattern(declaration['id'], loopShadowed);
            declaredNamesInPattern(declaration['id'], loopLocalNames);
          }
      const loopTruthinessBindings = new Map(bindings);
      for (const name of loopLocalNames) loopTruthinessBindings.set(name, [unresolvedBinding]);
      if (
        isRecord(loopBinding) &&
        loopBinding['type'] === 'VariableDeclaration' &&
        Array.isArray(loopBinding['declarations'])
      )
        for (const declaration of loopBinding['declarations']) {
          if (
            !isRecord(declaration) ||
            !isRecord(declaration['id']) ||
            declaration['id']['type'] !== 'Identifier' ||
            typeof declaration['id']['name'] !== 'string'
          )
            continue;
          const name = declaration['id']['name'];
          if (declaration['init'] === null || declaration['init'] === undefined) {
            loopTruthinessBindings.set(name, [knownUndefinedBinding]);
            continue;
          }
          const resolved = resolvedAssignmentValue(declaration['init'], loopTruthinessBindings);
          loopTruthinessBindings.set(name, resolved.set ? resolved.values : [unresolvedBinding]);
        }
      const literalTruthiness = (expression: unknown): boolean | undefined => {
        return staticTruthiness(expression, loopTruthinessBindings);
      };
      const guaranteedBody = (): boolean => {
        if (node['type'] === 'ForStatement') {
          const test = node['test'];
          return test === null || test === undefined || literalTruthiness(test) === true;
        }
        const right = node['right'];
        if (!isRecord(right)) return false;
        if (right['type'] === 'ArrayExpression' && Array.isArray(right['elements']))
          return right['elements'].length > 0;
        return false;
      };
      const definitelyEmptyBody = (): boolean => {
        if (node['type'] === 'ForStatement') return literalTruthiness(node['test']) === false;
        const right = node['right'];
        return (
          isRecord(right) &&
          right['type'] === 'ArrayExpression' &&
          Array.isArray(right['elements']) &&
          right['elements'].length === 0
        );
      };
      const endsWithAbruptExit = (candidate: unknown): boolean => {
        if (!isRecord(candidate)) return false;
        if (
          candidate['type'] === 'BreakStatement' ||
          candidate['type'] === 'ReturnStatement' ||
          candidate['type'] === 'ThrowStatement'
        )
          return true;
        return (
          candidate['type'] === 'BlockStatement' &&
          Array.isArray(candidate['body']) &&
          candidate['body'].length > 0 &&
          endsWithAbruptExit(candidate['body'][candidate['body'].length - 1])
        );
      };
      const canExitAfterEnteringStableTest = (candidate: unknown, testName: string): boolean => {
        if (!isRecord(candidate)) return false;
        if (
          candidate['type'] === 'FunctionDeclaration' ||
          candidate['type'] === 'FunctionExpression' ||
          candidate['type'] === 'ArrowFunctionExpression'
        )
          return false;
        if (
          candidate['type'] === 'BreakStatement' ||
          candidate['type'] === 'ReturnStatement' ||
          candidate['type'] === 'ThrowStatement' ||
          candidate['type'] === 'CallExpression'
        )
          return true;
        if (
          candidate['type'] === 'AssignmentExpression' &&
          isRecord(candidate['left']) &&
          candidate['left']['type'] === 'Identifier' &&
          candidate['left']['name'] === testName
        )
          return true;
        if (
          candidate['type'] === 'UpdateExpression' &&
          isRecord(candidate['argument']) &&
          candidate['argument']['type'] === 'Identifier' &&
          candidate['argument']['name'] === testName
        )
          return true;
        return Object.values(candidate).some((value) =>
          Array.isArray(value)
            ? value.some((item) => canExitAfterEnteringStableTest(item, testName))
            : canExitAfterEnteringStableTest(value, testName),
        );
      };
      const hasOnlyZeroEntryTerminalState =
        node['type'] === 'ForStatement' &&
        isRecord(node['test']) &&
        node['test']['type'] === 'Identifier' &&
        typeof node['test']['name'] === 'string' &&
        !canExitAfterEnteringStableTest(node['body'], node['test']['name']) &&
        !canExitAfterEnteringStableTest(node['update'], node['test']['name']);

      if (node['type'] !== 'ForStatement' && isRecord(node['right']))
        walk(node['right'], loopShadowed, currentInsideFunction);
      if (isRecord(loopBinding)) {
        if (
          loopBinding['type'] === 'VariableDeclaration' &&
          (loopBinding['kind'] === 'let' || loopBinding['kind'] === 'const') &&
          Array.isArray(loopBinding['declarations'])
        ) {
          for (const declaration of loopBinding['declarations'])
            if (isRecord(declaration) && isRecord(declaration['init']))
              walk(declaration['init'], loopShadowed, currentInsideFunction);
        } else walk(loopBinding, loopShadowed, currentInsideFunction);
      }
      if (isRecord(node['test'])) walk(node['test'], loopShadowed, currentInsideFunction);

      const beforeBody = cloneBindings();
      if (!definitelyEmptyBody() && !hasOnlyZeroEntryTerminalState && isRecord(node['body'])) {
        bindings.clear();
        for (const [name, values] of beforeBody) bindings.set(name, [...values]);
        const interruptedStates: Map<string, unknown[]>[] = [];
        const continuedStates: Map<string, unknown[]>[] = [];
        breakTargets.push({ label: controlLabel, states: interruptedStates });
        continueTargets.push({ states: continuedStates });
        walk(node['body'], loopShadowed, currentInsideFunction);
        continueTargets.pop();
        breakTargets.pop();
        if (
          node['type'] === 'ForStatement' &&
          isRecord(node['update']) &&
          !endsWithAbruptExit(node['body'])
        )
          walk(node['update'], loopShadowed, currentInsideFunction);
        let afterBody = cloneBindings();
        for (const continuedState of continuedStates) {
          mergeBindingStates(afterBody, continuedState);
          afterBody = cloneBindings();
        }
        for (const interruptedState of interruptedStates) {
          mergeBindingStates(afterBody, interruptedState);
          afterBody = cloneBindings();
        }
        if (!guaranteedBody()) mergeBindingStates(beforeBody, afterBody);
      } else {
        bindings.clear();
        for (const [name, values] of beforeBody) bindings.set(name, [...values]);
      }
      for (const name of loopShadowed) {
        const previous = beforeBody.get(name);
        if (previous === undefined) bindings.delete(name);
        else bindings.set(name, [...previous]);
      }
      return;
    }
    if (
      node['type'] === 'FunctionDeclaration' ||
      node['type'] === 'FunctionExpression' ||
      node['type'] === 'ArrowFunctionExpression'
    ) {
      currentInsideFunction = true;
      callbackFrames.push(new Map());
      localAliasFrames.push(new Map());
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
    } else if (node['type'] === 'BlockStatement' && Array.isArray(node['body'])) {
      localAliasFrames.push(new Map());
      pushedAliasBlock = true;
      blockBindingBase = cloneBindings();
      const lexicalNames = new Set<string>();
      for (const statement of node['body']) {
        if (
          !isRecord(statement) ||
          statement['type'] !== 'VariableDeclaration' ||
          (statement['kind'] !== 'let' && statement['kind'] !== 'const') ||
          !Array.isArray(statement['declarations'])
        )
          continue;
        for (const declaration of statement['declarations'])
          if (isRecord(declaration)) declaredNamesInPattern(declaration['id'], lexicalNames);
      }
      const newlyShadowed = [...mutableBindings].filter(
        (name) => !currentShadowed.has(name) && lexicalNames.has(name),
      );
      if (newlyShadowed.length > 0)
        currentShadowed = new Set([...currentShadowed, ...newlyShadowed]);
    }
    if (node['type'] === 'VariableDeclaration' && Array.isArray(node['declarations'])) {
      for (const declaration of node['declarations']) {
        if (
          !isRecord(declaration) ||
          !isRecord(declaration['id']) ||
          declaration['id']['type'] !== 'Identifier' ||
          typeof declaration['id']['name'] !== 'string'
        )
          continue;
        if (
          currentInsideFunction &&
          (!isRecord(declaration['init']) || declaration['init']['type'] !== 'ObjectExpression')
        )
          continue;
        if (currentInsideFunction) {
          const resolved = resolvedAssignmentValue(declaration['init'], visibleAliasBindings());
          if (resolved.set)
            localAliasFrames.at(-1)?.set(declaration['id']['name'], resolved.values);
          continue;
        }
        resolveDeclaration(
          declaration['id']['name'],
          typeof node['kind'] === 'string' ? node['kind'] : 'let',
          declaration['init'],
        );
      }
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
      const aliasBindings = new Map(bindings);
      for (const frame of localAliasFrames)
        for (const [alias, values] of frame) aliasBindings.set(alias, values);
      const resolved = resolvedAssignmentValue(node['right'], aliasBindings);
      if (currentInsideFunction) {
        if (resolved.set) {
          const currentFrame = callbackFrames.at(-1);
          const previousCallbackValues = currentFrame?.get(name) ?? [];
          const allCallbackValues = callbackBindings.get(name) ?? [];
          const currentValues = bindings.get(name) ?? [];
          const isStyleObjectValue = (value: unknown): boolean => {
            if (!isRecord(value)) return false;
            if (value['type'] === 'ObjectExpression') return true;
            if (value['type'] === 'ConditionalExpression')
              return [value['consequent'], value['alternate']].some(
                (branch) => isRecord(branch) && branch['type'] === 'ObjectExpression',
              );
            return (
              value['type'] === 'LogicalExpression' &&
              isRecord(value['right']) &&
              value['right']['type'] === 'ObjectExpression'
            );
          };
          if (
            [...currentValues, ...allCallbackValues, ...resolved.values].some(isStyleObjectValue)
          ) {
            const priorCallbackSet = new Set(previousCallbackValues);
            currentFrame?.set(name, mergeValues(resolved.values));
            bindings.set(
              name,
              mergeValues([
                ...currentValues.filter((value) => !priorCallbackSet.has(value)),
                ...resolved.values,
              ]),
            );
          } else {
            currentFrame?.set(name, mergeValues([...previousCallbackValues, ...resolved.values]));
            bindings.set(
              name,
              mergeValues([
                ...currentValues.filter((value) => !new Set(previousCallbackValues).has(value)),
                ...resolved.values,
              ]),
            );
          }
        }
      } else if (resolved.set) {
        bindings.set(name, valuesWithCallbackState(name, resolved.values));
      } else {
        const callbackValues = callbackBindings.get(name) ?? [];
        if (callbackValues.length > 0) bindings.set(name, [...callbackValues]);
        else bindings.delete(name);
      }
    }
    const synchronousCallee =
      node['type'] === 'CallExpression' &&
      isRecord(node['callee']) &&
      (node['callee']['type'] === 'FunctionExpression' ||
        node['callee']['type'] === 'ArrowFunctionExpression')
        ? node['callee']
        : undefined;
    if (synchronousCallee) synchronousFunctions.add(synchronousCallee);
    for (const value of Object.values(node)) {
      if (Array.isArray(value))
        for (const item of value) walk(item, currentShadowed, currentInsideFunction);
      else if (isRecord(value)) walk(value, currentShadowed, currentInsideFunction);
    }
    if (pushedAliasBlock) {
      localAliasFrames.pop();
      if (blockBindingBase && node['type'] === 'BlockStatement' && Array.isArray(node['body'])) {
        const lexicalNames = new Set<string>();
        for (const statement of node['body'])
          if (
            isRecord(statement) &&
            statement['type'] === 'VariableDeclaration' &&
            (statement['kind'] === 'let' || statement['kind'] === 'const') &&
            Array.isArray(statement['declarations'])
          )
            for (const declaration of statement['declarations'])
              if (isRecord(declaration)) declaredNamesInPattern(declaration['id'], lexicalNames);
        for (const name of lexicalNames) {
          const previous = blockBindingBase.get(name);
          if (previous === undefined) bindings.delete(name);
          else bindings.set(name, [...previous]);
        }
      }
    }
    if (
      node['type'] === 'FunctionDeclaration' ||
      node['type'] === 'FunctionExpression' ||
      node['type'] === 'ArrowFunctionExpression'
    ) {
      const frame = callbackFrames.pop();
      localAliasFrames.pop();
      const synchronous = synchronousFunctions.has(node);
      if (synchronous) synchronousFunctions.delete(node);
      if (frame) {
        if (synchronous && callbackFrames.length > 0) {
          const parentFrame = callbackFrames.at(-1)!;
          for (const [name, values] of frame)
            parentFrame.set(name, mergeValues([...(parentFrame.get(name) ?? []), ...values]));
        } else if (!synchronous) {
          for (const [name, values] of frame)
            callbackBindings.set(
              name,
              mergeValues([...(callbackBindings.get(name) ?? []), ...values]),
            );
        }
      }
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

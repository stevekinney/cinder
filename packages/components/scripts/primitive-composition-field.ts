import { parse as parseSvelte } from 'svelte/compiler';

type UnknownRecord = Record<string, unknown>;

type FieldEvidence = {
  count: number;
  isolatedMessages: boolean;
  labelCount: number;
  rootLabelCount: number;
  terms: string;
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function parseSvelteFragment(source: string): UnknownRecord | undefined {
  const root: unknown = parseSvelte(source, { modern: true });
  if (!isRecord(root) || !isRecord(root['fragment'])) return undefined;
  return root['fragment'];
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

function staticStringValuesFromExpression(
  rawExpression: unknown,
  bindings: ReadonlyMap<string, readonly string[]>,
): string[] {
  const expression = unwrapTypeExpression(rawExpression);
  if (!isRecord(expression)) return [];
  if (expression['type'] === 'Literal' && typeof expression['value'] === 'string')
    return [expression['value']];
  if (
    expression['type'] === 'TemplateLiteral' &&
    Array.isArray(expression['expressions']) &&
    expression['expressions'].length === 0 &&
    Array.isArray(expression['quasis']) &&
    isRecord(expression['quasis'][0])
  ) {
    const value = expression['quasis'][0]['value'];
    return isRecord(value) && typeof value['cooked'] === 'string' ? [value['cooked']] : [];
  }
  if (expression['type'] === 'Identifier' && typeof expression['name'] === 'string')
    return [...(bindings.get(expression['name']) ?? [])];
  return [];
}

function mergeStringValues(...values: (readonly string[])[]): string[] {
  return [...new Set(values.flat())];
}

function collectPatternNames(pattern: unknown, into: Set<string>): void {
  if (!isRecord(pattern)) return;
  if (pattern['type'] === 'Identifier' && typeof pattern['name'] === 'string') {
    into.add(pattern['name']);
    return;
  }
  if (pattern['type'] === 'VariableDeclarator') {
    collectPatternNames(pattern['id'], into);
    return;
  }
  if (pattern['type'] === 'RestElement') {
    collectPatternNames(pattern['argument'], into);
    return;
  }
  if (pattern['type'] === 'AssignmentPattern') {
    collectPatternNames(pattern['left'], into);
    return;
  }
  if (pattern['type'] === 'ArrayPattern' && Array.isArray(pattern['elements'])) {
    for (const element of pattern['elements']) collectPatternNames(element, into);
    return;
  }
  if (pattern['type'] === 'ObjectPattern' && Array.isArray(pattern['properties'])) {
    for (const property of pattern['properties']) {
      if (!isRecord(property)) continue;
      collectPatternNames(
        property['type'] === 'RestElement' ? property['argument'] : property['value'],
        into,
      );
    }
  }
}

function collectFunctionScopedNames(node: unknown, into: Set<string>): void {
  if (!isRecord(node)) return;
  if (
    node['type'] === 'FunctionDeclaration' ||
    node['type'] === 'FunctionExpression' ||
    node['type'] === 'ArrowFunctionExpression'
  )
    return;
  if (
    node['type'] === 'VariableDeclaration' &&
    node['kind'] === 'var' &&
    Array.isArray(node['declarations'])
  )
    for (const declaration of node['declarations']) collectPatternNames(declaration, into);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) for (const item of value) collectFunctionScopedNames(item, into);
    else if (isRecord(value)) collectFunctionScopedNames(value, into);
  }
}

function staticStringBindings(source: string): Map<string, string[]> {
  const root: unknown = parseSvelte(source, { modern: true });
  const bindings = new Map<string, string[]>();
  const callbackBindings = new Map<string, string[]>();
  const deferredFunctions: Array<{
    node: UnknownRecord;
    shadowed: ReadonlySet<string>;
  }> = [];
  let deferFunctions = true;
  if (!isRecord(root)) return bindings;
  const walk = (node: unknown, shadowed: ReadonlySet<string> = new Set()): void => {
    if (!isRecord(node)) return;
    if (
      deferFunctions &&
      (node['type'] === 'FunctionDeclaration' ||
        node['type'] === 'FunctionExpression' ||
        node['type'] === 'ArrowFunctionExpression')
    ) {
      deferredFunctions.push({ node, shadowed: new Set(shadowed) });
      return;
    }
    let currentShadowed = shadowed;
    if (
      node['type'] === 'VariableDeclaration' &&
      ['const', 'let', 'var'].includes(String(node['kind'])) &&
      Array.isArray(node['declarations'])
    ) {
      for (const declaration of node['declarations']) {
        if (
          !isRecord(declaration) ||
          !isRecord(declaration['id']) ||
          declaration['id']['type'] !== 'Identifier' ||
          typeof declaration['id']['name'] !== 'string'
        )
          continue;
        const name = declaration['id']['name'];
        const values = staticStringValuesFromExpression(declaration['init'], bindings);
        const callbackValues = callbackBindings.get(name) ?? [];
        if (values.length > 0) bindings.set(name, mergeStringValues(values, callbackValues));
        else if (declaration['init'] === null || declaration['init'] === undefined) {
          if (node['kind'] !== 'var' || !bindings.has(name)) bindings.set(name, []);
        } else if (callbackValues.length > 0) bindings.set(name, [...callbackValues]);
        else bindings.delete(name);
      }
    }
    if (node['type'] === 'IfStatement') {
      if (isRecord(node['test'])) walk(node['test'], currentShadowed);
      const base = new Map([...bindings].map(([name, values]) => [name, [...values]] as const));
      const branches = [node['consequent'], node['alternate']].map((branch) => {
        bindings.clear();
        for (const [name, values] of base) bindings.set(name, [...values]);
        if (isRecord(branch)) walk(branch, currentShadowed);
        return new Map([...bindings].map(([name, values]) => [name, [...values]] as const));
      });
      bindings.clear();
      const names = new Set([...base.keys(), ...branches.flatMap((branch) => [...branch.keys()])]);
      for (const name of names) {
        bindings.set(name, [...new Set(branches.flatMap((branch) => branch.get(name) ?? []))]);
      }
      return;
    }
    if (node['type'] === 'ConditionalExpression') {
      if (isRecord(node['test'])) walk(node['test'], currentShadowed);
      const base = new Map([...bindings].map(([name, values]) => [name, [...values]] as const));
      const branches = [node['consequent'], node['alternate']].map((branch) => {
        bindings.clear();
        for (const [name, values] of base) bindings.set(name, [...values]);
        if (isRecord(branch)) walk(branch, currentShadowed);
        return new Map([...bindings].map(([name, values]) => [name, [...values]] as const));
      });
      bindings.clear();
      const names = new Set([...base.keys(), ...branches.flatMap((branch) => [...branch.keys()])]);
      for (const name of names)
        bindings.set(name, [...new Set(branches.flatMap((branch) => branch.get(name) ?? []))]);
      return;
    }
    if (
      node['type'] === 'ForStatement' ||
      node['type'] === 'ForInStatement' ||
      node['type'] === 'ForOfStatement'
    ) {
      const declaration = node['type'] === 'ForStatement' ? node['init'] : node['left'];
      if (
        isRecord(declaration) &&
        declaration['type'] === 'VariableDeclaration' &&
        (declaration['kind'] === 'let' || declaration['kind'] === 'const') &&
        Array.isArray(declaration['declarations'])
      ) {
        const localNames = new Set<string>();
        for (const declarator of declaration['declarations'])
          if (isRecord(declarator)) collectPatternNames(declarator['id'], localNames);
        const loopShadowed = new Set([...currentShadowed, ...localNames]);
        for (const child of Object.values(node)) {
          if (Array.isArray(child)) for (const item of child) walk(item, loopShadowed);
          else if (isRecord(child)) walk(child, loopShadowed);
        }
        return;
      }
    }
    if (
      node['type'] === 'FunctionDeclaration' ||
      node['type'] === 'FunctionExpression' ||
      node['type'] === 'ArrowFunctionExpression'
    ) {
      const localNames = new Set<string>();
      if (Array.isArray(node['params']))
        for (const parameter of node['params']) collectPatternNames(parameter, localNames);
      if (isRecord(node['body'])) {
        collectFunctionScopedNames(node['body'], localNames);
        if (node['body']['type'] === 'BlockStatement' && Array.isArray(node['body']['body']))
          for (const statement of node['body']['body'])
            if (
              isRecord(statement) &&
              statement['type'] === 'VariableDeclaration' &&
              (statement['kind'] === 'let' || statement['kind'] === 'const') &&
              Array.isArray(statement['declarations'])
            )
              for (const declaration of statement['declarations'])
                if (isRecord(declaration)) collectPatternNames(declaration['id'], localNames);
      }
      currentShadowed = new Set([...shadowed, ...localNames]);
      const base = new Map([...bindings].map(([name, values]) => [name, [...values]] as const));
      if (isRecord(node['body'])) walk(node['body'], currentShadowed);
      const terminal = new Map([...bindings].map(([name, values]) => [name, [...values]] as const));
      bindings.clear();
      const names = new Set([...base.keys(), ...terminal.keys()]);
      for (const name of names) {
        if (localNames.has(name)) {
          if (base.has(name)) bindings.set(name, [...base.get(name)!]);
          continue;
        }
        const baseValues = base.get(name) ?? [];
        const callbackValues = (terminal.get(name) ?? []).filter(
          (value) => !baseValues.includes(value),
        );
        if (callbackValues.length > 0)
          callbackBindings.set(
            name,
            mergeStringValues(callbackBindings.get(name) ?? [], callbackValues),
          );
        bindings.set(name, mergeStringValues(baseValues, callbackBindings.get(name) ?? []));
      }
      return;
    } else if (node['type'] === 'BlockStatement' && Array.isArray(node['body'])) {
      const localNames = new Set<string>();
      for (const statement of node['body'])
        if (
          isRecord(statement) &&
          statement['type'] === 'VariableDeclaration' &&
          (statement['kind'] === 'let' || statement['kind'] === 'const') &&
          Array.isArray(statement['declarations'])
        )
          for (const declaration of statement['declarations'])
            if (isRecord(declaration)) collectPatternNames(declaration['id'], localNames);
      currentShadowed = new Set([...shadowed, ...localNames]);
    }
    if (
      node['type'] === 'AssignmentExpression' &&
      node['operator'] === '+=' &&
      isRecord(node['left']) &&
      node['left']['type'] === 'Identifier' &&
      typeof node['left']['name'] === 'string' &&
      !currentShadowed.has(node['left']['name'])
    ) {
      const name = node['left']['name'];
      const rightValues = staticStringValuesFromExpression(node['right'], bindings);
      const combined = (bindings.get(name) ?? []).flatMap((previous) =>
        rightValues.map((right) => previous + right),
      );
      const callbackValues = callbackBindings.get(name) ?? [];
      if (combined.length > 0) bindings.set(name, mergeStringValues(combined, callbackValues));
      else if (callbackValues.length > 0) bindings.set(name, [...callbackValues]);
      else bindings.delete(name);
    }
    if (
      node['type'] === 'AssignmentExpression' &&
      node['operator'] === '=' &&
      isRecord(node['left']) &&
      node['left']['type'] === 'Identifier' &&
      typeof node['left']['name'] === 'string' &&
      !currentShadowed.has(node['left']['name'])
    ) {
      const name = node['left']['name'];
      const values = staticStringValuesFromExpression(node['right'], bindings);
      const callbackValues = callbackBindings.get(name) ?? [];
      if (values.length > 0) bindings.set(name, mergeStringValues(values, callbackValues));
      else if (callbackValues.length > 0) bindings.set(name, [...callbackValues]);
      else bindings.delete(name);
    }
    for (const child of Object.values(node)) {
      if (Array.isArray(child)) for (const item of child) walk(item, currentShadowed);
      else if (isRecord(child)) walk(child, currentShadowed);
    }
  };
  const body =
    isRecord(root['instance']) && isRecord(root['instance']['content'])
      ? root['instance']['content']['body']
      : undefined;
  if (Array.isArray(body)) for (const statement of body) walk(statement);
  deferFunctions = false;
  for (const deferred of deferredFunctions) walk(deferred.node, deferred.shadowed);
  const walkTemplateExpressions = (node: unknown): void => {
    if (!isRecord(node)) return;
    if (node['type'] === 'ExpressionTag' && isRecord(node['expression'])) walk(node['expression']);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) for (const child of value) walkTemplateExpressions(child);
      else if (isRecord(value)) walkTemplateExpressions(value);
    }
  };
  walkTemplateExpressions(root['fragment']);
  return bindings;
}

function isCanonicalFieldComponent(node: UnknownRecord): boolean {
  if (node['type'] !== 'Component' || typeof node['name'] !== 'string') return false;
  return node['name'] === 'FormField' || node['name'].startsWith('FormField.');
}

function localMarkupEvidence(
  node: unknown,
  source: string,
  bindings: ReadonlyMap<string, readonly string[]>,
): { labelCount: number; terms: string } {
  if (!isRecord(node) || isCanonicalFieldComponent(node)) return { labelCount: 0, terms: '' };
  const resolvedElementNames =
    node['type'] === 'RegularElement'
      ? typeof node['name'] === 'string'
        ? [node['name']]
        : []
      : node['type'] === 'SvelteElement'
        ? staticStringValuesFromExpression(node['tag'], bindings)
        : [];
  const labelCount = resolvedElementNames.filter((name) => name.toLowerCase() === 'label').length;
  const terms: string[] = [];
  if (node['type'] === 'Text' && typeof node['data'] === 'string') terms.push(node['data']);
  if (
    node['type'] === 'ExpressionTag' &&
    typeof node['start'] === 'number' &&
    typeof node['end'] === 'number'
  ) {
    const before = source.slice(Math.max(0, node['start'] - 24), node['start']);
    if (!/\bon(?:click|keydown|keyup|input|change|focus|blur)\s*=|\bon:/i.test(before))
      terms.push(source.slice(node['start'], node['end']));
  }
  if (
    node['type'] === 'Attribute' &&
    typeof node['name'] === 'string' &&
    !node['name'].startsWith('on') &&
    !node['name'].startsWith('on:') &&
    typeof node['start'] === 'number' &&
    typeof node['end'] === 'number'
  )
    terms.push(source.slice(node['start'], node['end']));
  return { labelCount, terms: terms.join(' ') };
}

function emptyFieldEvidence(): FieldEvidence {
  return {
    count: 0,
    isolatedMessages: false,
    labelCount: 0,
    rootLabelCount: 0,
    terms: '',
  };
}

function summarizeFieldEvidence(
  localEvidence: { labelCount: number; terms: string },
  childEvidence: readonly FieldEvidence[],
): FieldEvidence {
  let count = 0;
  let labelCount = localEvidence.labelCount;
  const terms = [localEvidence.terms];
  const deferredMessageTerms: string[] = [];
  const hasDirectLabel =
    localEvidence.labelCount > 0 || childEvidence.some((evidence) => evidence.rootLabelCount > 0);
  for (const evidence of childEvidence) {
    count += evidence.count;
    if (evidence.count > 0) continue;
    if (evidence.isolatedMessages && !hasDirectLabel) {
      deferredMessageTerms.push(evidence.terms);
      continue;
    }
    labelCount += evidence.labelCount;
    terms.push(evidence.terms);
  }
  let combinedTerms = terms.join(' ');
  if (labelCount === 0 && deferredMessageTerms.length > 0)
    combinedTerms = `${combinedTerms} ${deferredMessageTerms.join(' ')}`;
  const qualifies =
    /(?:description|help(?:text)?|hint|assist)/i.test(combinedTerms) &&
    /(?:error|validation|invalid|message)/i.test(combinedTerms);
  if (qualifies && labelCount > 0)
    return {
      count: count + labelCount,
      isolatedMessages: false,
      labelCount: 0,
      rootLabelCount: 0,
      terms: '',
    };
  return {
    count,
    isolatedMessages: qualifies && labelCount === 0,
    labelCount,
    rootLabelCount: localEvidence.labelCount,
    terms: combinedTerms,
  };
}

function qualifyingFieldLabelBranches(
  node: unknown,
  source: string,
  bindings: ReadonlyMap<string, readonly string[]>,
): FieldEvidence[] {
  if (!isRecord(node)) return [emptyFieldEvidence()];
  // A canonical `<FormField>`'s own props (label/description/error) aren't
  // hand-rolled evidence — but its rendered children (a child snippet can
  // still hand-roll a label/description/error wrapper) must keep being
  // inspected below, via the general recursion's `attributes` key skip for
  // Component nodes. Only its own local markup evidence is suppressed here.
  if (node['type'] === 'HtmlTag' && isRecord(node['expression'])) {
    const evidences = staticStringValuesFromExpression(node['expression'], bindings).flatMap(
      (html) => {
        const nested = parseSvelteFragment(html);
        return nested === undefined ? [] : qualifyingFieldLabelBranches(nested, html, bindings);
      },
    );
    if (evidences.length > 0) return evidences;
  }
  const localEvidence = localMarkupEvidence(node, source, bindings);
  let combinations: FieldEvidence[][] = [[]];
  for (const [key, value] of Object.entries(node)) {
    if (node['type'] === 'Component' && key === 'attributes') continue;
    const children = Array.isArray(value) ? value : [value];
    for (const child of children) {
      if (!isRecord(child)) continue;
      const branches = qualifyingFieldLabelBranches(child, source, bindings);
      combinations = combinations.flatMap((combination) =>
        branches.map((branch) => [...combination, branch]),
      );
    }
  }
  return combinations.map((childEvidence) => summarizeFieldEvidence(localEvidence, childEvidence));
}

export function fieldWrapperCount(source: string): number {
  const fragment = parseSvelteFragment(source);
  return fragment === undefined
    ? 0
    : Math.max(
        0,
        ...qualifyingFieldLabelBranches(fragment, source, staticStringBindings(source)).map(
          (evidence) => evidence.count,
        ),
      );
}

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

function staticStringFromExpression(
  rawExpression: unknown,
  bindings: ReadonlyMap<string, readonly string[]>,
): string | undefined {
  const expression = unwrapTypeExpression(rawExpression);
  if (!isRecord(expression)) return undefined;
  if (expression['type'] === 'Literal' && typeof expression['value'] === 'string')
    return expression['value'];
  if (
    expression['type'] === 'TemplateLiteral' &&
    Array.isArray(expression['expressions']) &&
    expression['expressions'].length === 0 &&
    Array.isArray(expression['quasis']) &&
    isRecord(expression['quasis'][0])
  ) {
    const value = expression['quasis'][0]['value'];
    return isRecord(value) && typeof value['cooked'] === 'string' ? value['cooked'] : undefined;
  }
  if (expression['type'] === 'Identifier' && typeof expression['name'] === 'string') {
    const values = bindings.get(expression['name']);
    return values?.length === 1 ? values[0] : undefined;
  }
  return undefined;
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

function collectPatternNames(pattern: unknown, into: Set<string>): void {
  if (!isRecord(pattern)) return;
  if (pattern['type'] === 'Identifier' && typeof pattern['name'] === 'string')
    into.add(pattern['name']);
  else if (pattern['type'] === 'VariableDeclarator') collectPatternNames(pattern['id'], into);
  else
    for (const value of Object.values(pattern)) {
      if (Array.isArray(value)) for (const item of value) collectPatternNames(item, into);
      else if (isRecord(value)) collectPatternNames(value, into);
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
  if (!isRecord(root) || !isRecord(root['instance']) || !isRecord(root['instance']['content']))
    return bindings;
  const body = root['instance']['content']['body'];
  if (!Array.isArray(body)) return bindings;
  for (const statement of body) {
    if (
      !isRecord(statement) ||
      statement['type'] !== 'VariableDeclaration' ||
      !['const', 'let', 'var'].includes(String(statement['kind']))
    )
      continue;
    const declarations = statement['declarations'];
    if (!Array.isArray(declarations)) continue;
    for (const declaration of declarations) {
      if (
        !isRecord(declaration) ||
        !isRecord(declaration['id']) ||
        declaration['id']['type'] !== 'Identifier' ||
        typeof declaration['id']['name'] !== 'string'
      )
        continue;
      const values = staticStringValuesFromExpression(declaration['init'], bindings);
      if (values.length > 0) bindings.set(declaration['id']['name'], values);
      else if (declaration['init'] !== null && declaration['init'] !== undefined)
        bindings.delete(declaration['id']['name']);
    }
  }
  const walk = (node: unknown, shadowed: ReadonlySet<string> = new Set()): void => {
    if (!isRecord(node)) return;
    let currentShadowed = shadowed;
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
      if (isRecord(node['body'])) collectFunctionScopedNames(node['body'], localNames);
      currentShadowed = new Set([...shadowed, ...localNames]);
      const base = new Map([...bindings].map(([name, values]) => [name, [...values]] as const));
      if (isRecord(node['body'])) walk(node['body'], currentShadowed);
      const terminal = new Map([...bindings].map(([name, values]) => [name, [...values]] as const));
      bindings.clear();
      const names = new Set([...base.keys(), ...terminal.keys()]);
      for (const name of names)
        bindings.set(name, [
          ...new Set([...(base.get(name) ?? []), ...(terminal.get(name) ?? [])]),
        ]);
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
      node['operator'] === '=' &&
      isRecord(node['left']) &&
      node['left']['type'] === 'Identifier' &&
      typeof node['left']['name'] === 'string' &&
      !currentShadowed.has(node['left']['name'])
    ) {
      const name = node['left']['name'];
      const values = staticStringValuesFromExpression(node['right'], bindings);
      if (values.length > 0) bindings.set(name, values);
      else bindings.delete(name);
    }
    for (const child of Object.values(node)) {
      if (Array.isArray(child)) for (const item of child) walk(item, currentShadowed);
      else if (isRecord(child)) walk(child, currentShadowed);
    }
  };
  for (const statement of body) walk(statement);
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

function qualifyingFieldLabels(
  node: unknown,
  source: string,
  bindings: ReadonlyMap<string, readonly string[]>,
): FieldEvidence {
  if (!isRecord(node))
    return {
      count: 0,
      isolatedMessages: false,
      labelCount: 0,
      rootLabelCount: 0,
      terms: '',
    };
  // A canonical `<FormField>`'s own props (label/description/error) aren't
  // hand-rolled evidence — but its rendered children (a child snippet can
  // still hand-roll a label/description/error wrapper) must keep being
  // inspected below, via the general recursion's `attributes` key skip for
  // Component nodes. Only its own local markup evidence is suppressed here.
  if (node['type'] === 'HtmlTag' && isRecord(node['expression'])) {
    const html = staticStringFromExpression(node['expression'], bindings);
    if (html !== undefined) {
      const nested = parseSvelteFragment(html);
      return nested === undefined
        ? {
            count: 0,
            isolatedMessages: false,
            labelCount: 0,
            rootLabelCount: 0,
            terms: '',
          }
        : qualifyingFieldLabels(nested, html, bindings);
    }
  }
  const localEvidence = localMarkupEvidence(node, source, bindings);
  let count = 0;
  let labelCount = localEvidence.labelCount;
  const terms = [localEvidence.terms];
  const deferredMessageTerms: string[] = [];
  const childEvidence: FieldEvidence[] = [];
  for (const [key, value] of Object.entries(node)) {
    if (node['type'] === 'Component' && key === 'attributes') continue;
    const children = Array.isArray(value) ? value : [value];
    for (const child of children) {
      if (!isRecord(child)) continue;
      childEvidence.push(qualifyingFieldLabels(child, source, bindings));
    }
  }
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

export function fieldWrapperCount(source: string): number {
  const fragment = parseSvelteFragment(source);
  return fragment === undefined
    ? 0
    : qualifyingFieldLabels(fragment, source, staticStringBindings(source)).count;
}

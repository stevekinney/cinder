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

function staticStringFromExpression(
  expression: unknown,
  bindings: ReadonlyMap<string, string>,
): string | undefined {
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
  if (expression['type'] === 'Identifier' && typeof expression['name'] === 'string')
    return bindings.get(expression['name']);
  return undefined;
}

function staticStringBindings(source: string): Map<string, string> {
  const root: unknown = parseSvelte(source, { modern: true });
  const bindings = new Map<string, string>();
  if (!isRecord(root) || !isRecord(root['instance']) || !isRecord(root['instance']['content']))
    return bindings;
  const body = root['instance']['content']['body'];
  if (!Array.isArray(body)) return bindings;
  for (const statement of body) {
    if (
      !isRecord(statement) ||
      statement['type'] !== 'VariableDeclaration' ||
      statement['kind'] !== 'const'
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
      const value = staticStringFromExpression(declaration['init'], bindings);
      if (value !== undefined) bindings.set(declaration['id']['name'], value);
    }
  }
  return bindings;
}

function isCanonicalFieldComponent(node: UnknownRecord): boolean {
  if (node['type'] !== 'Component' || typeof node['name'] !== 'string') return false;
  return node['name'] === 'FormField' || node['name'].startsWith('FormField.');
}

function localMarkupEvidence(
  node: unknown,
  source: string,
  bindings: ReadonlyMap<string, string>,
): { labelCount: number; terms: string } {
  if (!isRecord(node) || isCanonicalFieldComponent(node)) return { labelCount: 0, terms: '' };
  const resolvedElementName =
    node['type'] === 'RegularElement'
      ? node['name']
      : node['type'] === 'SvelteElement'
        ? staticStringFromExpression(node['tag'], bindings)
        : undefined;
  const labelCount =
    typeof resolvedElementName === 'string' && resolvedElementName.toLowerCase() === 'label'
      ? 1
      : 0;
  const terms: string[] = [];
  if (node['type'] === 'Text' && typeof node['data'] === 'string') terms.push(node['data']);
  if (
    node['type'] === 'ExpressionTag' &&
    typeof node['start'] === 'number' &&
    typeof node['end'] === 'number'
  )
    terms.push(source.slice(node['start'], node['end']));
  if (
    node['type'] === 'Attribute' &&
    typeof node['start'] === 'number' &&
    typeof node['end'] === 'number'
  )
    terms.push(source.slice(node['start'], node['end']));
  return { labelCount, terms: terms.join(' ') };
}

function qualifyingFieldLabels(
  node: unknown,
  source: string,
  bindings: ReadonlyMap<string, string>,
): FieldEvidence {
  if (!isRecord(node) || isCanonicalFieldComponent(node))
    return {
      count: 0,
      isolatedMessages: false,
      labelCount: 0,
      rootLabelCount: 0,
      terms: '',
    };
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

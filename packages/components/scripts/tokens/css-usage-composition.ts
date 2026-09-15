import { parse as parseCss } from 'postcss';
import selectorParser from 'postcss-selector-parser';
import { parse as parseSvelte } from 'svelte/compiler';
import * as typescript from 'typescript';

import type { DeclarationIdentity, DeclarationRecord } from './css-usage-inventory-extraction';

export type CompositionSource = {
  path: string;
  content: string;
  stylesheetEntry?: boolean;
};

export type ElementEvidence = {
  sourceFile: string;
  offset: number;
  line: number;
  column: number;
  tagName: string;
  id: string | undefined;
  classes: ReadonlySet<string>;
  attributes: ReadonlyMap<string, string | undefined>;
  ownerStylesheets: ReadonlySet<string>;
};

export type SelectorEvidence = {
  alternatives: readonly SelectorAlternative[];
};

type SelectorAlternative = {
  classes: ReadonlySet<string>;
  attributes: readonly {
    name: string;
    operator: string | undefined;
    value: string | undefined;
    insensitive: boolean | undefined;
  }[];
  tagName: string | undefined;
  id: string | undefined;
  supported: boolean;
};

type CssImport = { from: string; to: string };

export type CompositionCaches = {
  selectors: Map<string, SelectorEvidence | undefined>;
  candidates: Map<string, DeclarationRecord[]>;
  terminals: Map<string, ElementEvidence[]>;
};

export function createCompositionCaches(): CompositionCaches {
  return { selectors: new Map(), candidates: new Map(), terminals: new Map() };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function lineAt(source: string, offset: number): number {
  return source.slice(0, Math.max(0, offset)).split('\n').length;
}

function staticString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (!isRecord(value)) return undefined;
  if (value['type'] === 'Literal' && typeof value['value'] === 'string') return value['value'];
  if (value['type'] === 'TemplateLiteral') {
    const quasis = value['quasis'];
    if (Array.isArray(quasis) && quasis.length === 1) {
      const raw = quasis[0];
      if (isRecord(raw) && isRecord(raw['value']) && typeof raw['value']['raw'] === 'string')
        return raw['value']['raw'];
    }
  }
  return undefined;
}

function attributeValue(value: unknown): string | undefined {
  if (value === true) return '';
  if (!Array.isArray(value)) return staticString(value);
  const parts = value.map((part: unknown) => {
    if (!isRecord(part)) return undefined;
    return part['type'] === 'Text' ? staticString(part['data']) : staticString(part['expression']);
  });
  return parts.every((part) => part !== undefined) ? parts.join('') : undefined;
}

function addClasses(value: unknown, classes: Set<string>): void {
  const text = staticString(value);
  if (text !== undefined) {
    text
      .split(/\s+/)
      .filter(Boolean)
      .forEach((name) => classes.add(name));
    return;
  }
  if (!isRecord(value)) return;
  if (
    value['type'] === 'CallExpression' &&
    isRecord(value['callee']) &&
    value['callee']['type'] === 'Identifier' &&
    value['callee']['name'] === 'classNames' &&
    Array.isArray(value['arguments'])
  ) {
    value['arguments'].forEach((argument) => addClasses(argument, classes));
    return;
  }
  if (value['type'] === 'ArrayExpression' && Array.isArray(value['elements'])) {
    value['elements'].forEach((item) => addClasses(item, classes));
    return;
  }
  if (value['type'] !== 'ObjectExpression' || !Array.isArray(value['properties'])) return;
  for (const property of value['properties']) {
    if (!isRecord(property) || property['type'] !== 'Property') continue;
    const enabled = property['value'];
    if (!isRecord(enabled) || enabled['type'] !== 'Literal' || enabled['value'] !== true) continue;
    const propertyKey = property['key'];
    if (isRecord(propertyKey) && propertyKey['type'] === 'Identifier' && !property['computed']) {
      if (typeof propertyKey['name'] === 'string') classes.add(propertyKey['name']);
    } else addClasses(propertyKey, classes);
  }
}

function elementEvidence(
  source: CompositionSource,
  ownerStylesheets: ReadonlySet<string>,
): ElementEvidence[] {
  let ast: Record<string, unknown>;
  try {
    const parsed: unknown = parseSvelte(source.content, { modern: false });
    if (!isRecord(parsed)) return [];
    ast = parsed;
  } catch {
    return [];
  }
  const evidence: ElementEvidence[] = [];
  const visit = (node: unknown): void => {
    if (!isRecord(node)) return;
    if (node['type'] === 'RegularElement' || node['type'] === 'Element') {
      const classes = new Set<string>();
      const attributes = new Map<string, string | undefined>();
      let id: string | undefined;
      const nodeAttributes = node['attributes'];
      if (Array.isArray(nodeAttributes)) {
        for (const attribute of nodeAttributes) {
          if (!isRecord(attribute) || typeof attribute['name'] !== 'string') continue;
          const staticValue = attributeValue(attribute['value']);
          attributes.set(attribute['name'], staticValue);
          if (attribute['name'] === 'id') id = staticValue;
          if (attribute['name'] !== 'class') continue;
          const value = attribute['value'];
          if (typeof value === 'string') addClasses(value, classes);
          else if (Array.isArray(value))
            for (const part of value) {
              if (!isRecord(part)) continue;
              if (part['type'] === 'Text') addClasses(part['data'], classes);
              else if (part['type'] === 'ExpressionTag' || part['type'] === 'MustacheTag')
                addClasses(part['expression'], classes);
            }
        }
      }
      const start = typeof node['start'] === 'number' ? node['start'] : 0;
      const tagName = typeof node['name'] === 'string' ? node['name'] : '';
      evidence.push({
        sourceFile: source.path,
        offset: start,
        line: lineAt(source.content, start),
        column: start - source.content.lastIndexOf('\n', start - 1),
        tagName,
        id,
        classes,
        attributes,
        ownerStylesheets,
      });
    }
    for (const [key, child] of Object.entries(node)) {
      if (key === 'css' || key === 'attributes') continue;
      if (Array.isArray(child)) child.forEach(visit);
      else visit(child);
    }
  };
  visit(ast['html'] ?? ast['fragment']);
  return evidence;
}

function finalCompound(selector: string): SelectorEvidence | undefined {
  const alternatives: SelectorAlternative[] = [];
  try {
    selectorParser((root) => {
      root.each((complex) => {
        let compound: selectorParser.Node[] = [];
        for (const node of complex.nodes) {
          if (node.type === 'combinator') compound = [];
          else compound.push(node);
        }
        const classes = new Set<string>();
        const attributes: SelectorAlternative['attributes'][number][] = [];
        let tagName: string | undefined;
        let id: string | undefined;
        let supported = compound.length > 0;
        for (const node of compound) {
          if (node.type === 'class') classes.add(node.value);
          else if (node.type === 'attribute')
            attributes.push({
              name: node.attribute,
              operator: node.operator,
              value: node.value,
              insensitive: node.insensitive,
            });
          else if (node.type === 'tag') tagName = node.value;
          else if (node.type === 'id') id = node.value;
          else if (node.type === 'pseudo' || node.type === 'universal') supported = false;
        }
        if (compound.length === 0 || (!classes.size && !attributes.length && !tagName && !id))
          supported = false;
        alternatives.push({ classes, attributes, tagName, id, supported });
      });
    }).processSync(selector);
  } catch {
    return undefined;
  }
  return alternatives.length ? { alternatives } : undefined;
}

export function selectorEvidence(selector: string | null): SelectorEvidence | undefined {
  return selector === null ? undefined : finalCompound(selector);
}

export function selectorMatchesElement(
  selector: SelectorEvidence,
  element: ElementEvidence,
): boolean {
  return selector.alternatives.some(
    (alternative) =>
      alternative.supported &&
      (!alternative.tagName || alternative.tagName === element.tagName) &&
      (!alternative.id || alternative.id === element.id) &&
      [...alternative.classes].every((name) => element.classes.has(name)) &&
      alternative.attributes.every((attribute) => {
        if (!element.attributes.has(attribute.name)) return false;
        const actual = element.attributes.get(attribute.name);
        if (actual === undefined || !attribute.operator) return true;
        const left = attribute.insensitive ? actual.toLowerCase() : actual;
        const right = attribute.insensitive ? attribute.value?.toLowerCase() : attribute.value;
        if (right === undefined) return false;
        switch (attribute.operator) {
          case '=':
            return left === right;
          case '~=':
            return right !== '' && left.split(/\s+/).includes(right);
          case '|=':
            return left === right || left.startsWith(`${right}-`);
          case '^=':
            return right !== '' && left.startsWith(right);
          case '$=':
            return right !== '' && left.endsWith(right);
          case '*=':
            return right !== '' && left.includes(right);
          default:
            return false;
        }
      }),
  );
}

export function declarationIdentityKey(identity: DeclarationIdentity): string {
  return JSON.stringify([
    identity.file,
    identity.line,
    identity.column,
    identity.property,
    identity.value,
    identity.selector,
    identity.atRules,
  ]);
}

export function declarationMatchesElement(
  declaration: DeclarationRecord,
  element: ElementEvidence,
  caches?: CompositionCaches,
): boolean {
  const selector = caches
    ? caches.selectors.has(declaration.selector ?? '')
      ? caches.selectors.get(declaration.selector ?? '')
      : caches.selectors
          .set(declaration.selector ?? '', selectorEvidence(declaration.selector))
          .get(declaration.selector ?? '')
    : selectorEvidence(declaration.selector);
  return selector !== undefined && selectorMatchesElement(selector, element);
}

function resolveImport(
  from: string,
  imported: string,
  files: ReadonlySet<string>,
): string | undefined {
  if (!imported.startsWith('.')) return undefined;
  const parts = from.split('/');
  parts.pop();
  const candidate = [...parts, ...imported.split('/')].filter(Boolean);
  const normalized: string[] = [];
  for (const part of candidate) {
    if (part === '.') continue;
    if (part === '..') normalized.pop();
    else normalized.push(part);
  }
  const path = normalized.join('/');
  for (const option of [path, `${path}.css`, `${path}/index.css`])
    if (files.has(option)) return option;
  return undefined;
}

function cssImports(source: CompositionSource, files: ReadonlySet<string>): CssImport[] {
  if (!source.path.endsWith('.css')) return [];
  const imports: CssImport[] = [];
  try {
    const root = parseCss(source.content, { from: source.path });
    root.walkAtRules('import', (rule) => {
      const match = rule.params.match(/^['"]([^'"]+)['"]/);
      const target = match?.[1] && resolveImport(source.path, match[1], files);
      if (target) imports.push({ from: source.path, to: target });
    });
  } catch {
    return [];
  }
  return imports;
}

export function importedStylesheets(
  source: CompositionSource,
  files: ReadonlySet<string>,
): string[] {
  if (source.path.endsWith('.css')) return [];
  const scripts: string[] = [];
  if (source.path.endsWith('.svelte')) {
    try {
      const parsed: unknown = parseSvelte(source.content, { modern: false });
      if (!isRecord(parsed)) return [];
      const ast = parsed;
      for (const key of ['instance', 'module']) {
        const script = ast[key];
        if (!isRecord(script) || !isRecord(script['content'])) continue;
        const start = script['content']['start'];
        const end = script['content']['end'];
        if (typeof start === 'number' && typeof end === 'number')
          scripts.push(source.content.slice(start, end));
      }
    } catch {
      return [];
    }
  } else scripts.push(source.content);
  const imports = new Set<string>();
  for (const script of scripts) {
    const file = typescript.createSourceFile(
      source.path,
      script,
      typescript.ScriptTarget.Latest,
      true,
      typescript.ScriptKind.TSX,
    );
    const visit = (node: typescript.Node): void => {
      if (
        typescript.isImportDeclaration(node) &&
        typescript.isStringLiteral(node.moduleSpecifier)
      ) {
        const target = node.moduleSpecifier.text;
        if (target.endsWith('.css')) {
          const resolved = resolveImport(source.path, target, files);
          if (resolved) imports.add(resolved);
        }
      }
      if (
        typescript.isCallExpression(node) &&
        node.expression.kind === typescript.SyntaxKind.ImportKeyword &&
        node.arguments.length === 1
      ) {
        const argument = node.arguments[0]!;
        if (typescript.isStringLiteral(argument) && argument.text.endsWith('.css')) {
          const resolved = resolveImport(source.path, argument.text, files);
          if (resolved) imports.add(resolved);
        }
      }
      typescript.forEachChild(node, visit);
    };
    visit(file);
  }
  return [...imports].sort();
}

export function reachableStylesheets(sources: readonly CompositionSource[]): ReadonlySet<string> {
  const files = new Set(
    sources.filter((source) => source.path.endsWith('.css')).map((source) => source.path),
  );
  const imports = sources.flatMap((source) => cssImports(source, files));
  const edges = new Map<string, string[]>();
  for (const edge of imports) edges.set(edge.from, [...(edges.get(edge.from) ?? []), edge.to]);
  const reachable = new Set(
    sources.filter((source) => source.stylesheetEntry).map((source) => source.path),
  );
  for (const imported of sources.flatMap((source) => importedStylesheets(source, files)))
    reachable.add(imported);
  const pending = [...reachable];
  while (pending.length) {
    const current = pending.pop()!;
    for (const next of edges.get(current) ?? []) {
      if (reachable.has(next)) continue;
      reachable.add(next);
      pending.push(next);
    }
  }
  return reachable;
}

export function compositionElements(sources: readonly CompositionSource[]): ElementEvidence[] {
  const files = new Set(
    sources.filter((source) => source.path.endsWith('.css')).map((source) => source.path),
  );
  const cssEdges = new Map<string, string[]>();
  for (const source of sources)
    if (files.has(source.path))
      cssEdges.set(
        source.path,
        cssImports(source, files).map((edge) => edge.to),
      );
  return sources
    .filter((source) => source.path.endsWith('.svelte'))
    .flatMap((source) => {
      const ownerStylesheets = new Set<string>();
      const sidecar = source.path.replace(/\.svelte$/, '.css');
      if (files.has(sidecar)) ownerStylesheets.add(sidecar);
      try {
        const parsed: unknown = parseSvelte(source.content, { modern: false });
        if (isRecord(parsed) && isRecord(parsed['css'])) ownerStylesheets.add(source.path);
      } catch {
        // The element parser below reports malformed Svelte as no evidence.
      }
      for (const imported of importedStylesheets(source, files)) ownerStylesheets.add(imported);
      const pending = [...ownerStylesheets];
      while (pending.length) {
        const current = pending.pop()!;
        for (const imported of cssEdges.get(current) ?? []) {
          if (ownerStylesheets.has(imported)) continue;
          ownerStylesheets.add(imported);
          pending.push(imported);
        }
      }
      return elementEvidence(source, ownerStylesheets);
    });
}

export function compositionCandidates(
  name: string,
  element: ElementEvidence,
  declarations: readonly DeclarationRecord[],
  reachable: ReadonlySet<string>,
  caches?: CompositionCaches,
): DeclarationRecord[] {
  const key = `${name}|${element.sourceFile}|${element.offset}`;
  if (caches?.candidates.has(key)) return caches.candidates.get(key)!;
  const candidates = declarations.filter(
    (declaration) =>
      declaration.property === name &&
      declaration.property.startsWith('--') &&
      reachable.has(declaration.sourceFile) &&
      element.ownerStylesheets.has(declaration.sourceFile) &&
      declarationMatchesElement(declaration, element, caches),
  );
  caches?.candidates.set(key, candidates);
  return candidates;
}

export function terminalElements(
  declaration: DeclarationRecord,
  elements: readonly ElementEvidence[],
  reachable: ReadonlySet<string>,
  caches?: CompositionCaches,
): ElementEvidence[] {
  if (!reachable.has(declaration.sourceFile)) return [];
  const key = declarationIdentityKey(declaration);
  if (caches?.terminals.has(key)) return caches.terminals.get(key)!;
  const terminals = elements.filter((element) =>
    declarationMatchesElement(declaration, element, caches),
  );
  caches?.terminals.set(key, terminals);
  return terminals;
}

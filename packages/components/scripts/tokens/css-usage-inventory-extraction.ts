import { parse as parseCss, type Declaration } from 'postcss';
import valueParser from 'postcss-value-parser';
import { parse as parseSvelte } from 'svelte/compiler';
import { dynamicRecord, isRecord, numberField } from './css-inventory-diagnostics';
import type { Diagnostic, DynamicRecord, Source } from './css-usage-inventory';
import { runtimeExtract } from './css-usage-inventory-runtime';
import {
  extractSvelteStyleAttribute,
  extractSvelteSvgAttribute,
  SVG_STRUCTURAL_NODES,
} from './css-usage-inventory-svelte';
export type AtRuleLocation = { name: string; parameters: string };
export type DeclarationIdentity = {
  file: string;
  line: number;
  column: number;
  property: string;
  value: string;
  selector: string | null;
  atRules: AtRuleLocation[];
};
export type DeclarationRecord = DeclarationIdentity & { refs: string[]; sourceFile: string };

export type ExtractedSource = {
  declarations: DeclarationRecord[];
  dynamic: DynamicRecord[];
  diagnostics: Diagnostic[];
};
function position(text: string, offset: number): { line: number; column: number } {
  const before = text.slice(0, Math.max(0, offset));
  const lineStart = before.lastIndexOf('\n') + 1;
  return { line: before.split('\n').length, column: offset - lineStart + 1 };
}
function offsetAt(text: string, start: number, line: number, column: number): number {
  let offset = start;
  let currentLine = 1;
  while (currentLine < line) {
    const newline = text.indexOf('\n', offset);
    if (newline < 0) return text.length;
    offset = newline + 1;
    currentLine++;
  }
  return offset + column - 1;
}
export function cssReferences(value: string): string[] {
  const references: string[] = [];
  valueParser(value).walk((node) => {
    if (node.type !== 'function' || node.value.toLowerCase() !== 'var') return;
    const variable = node.nodes?.find(
      (child) => child.type === 'word' && child.value.startsWith('--'),
    );
    if (variable) references.push(variable.value);
  });
  return references;
}
function declarationIdentity(
  file: string,
  declaration: Declaration,
  source: string,
  rootOffset: number,
  lineOffset: number,
  selectorOverride: string | null | undefined,
): DeclarationRecord {
  const start = declaration.source?.start ?? { line: 1, column: 1 };
  const offset = offsetAt(source, rootOffset, Math.max(1, start.line - lineOffset), start.column);
  const pos = position(source, offset);
  const atRules: AtRuleLocation[] = [];
  let selector: string | null = selectorOverride ?? null;
  let cursor = declaration.parent;
  while (cursor && cursor.type !== 'root') {
    if (cursor.type === 'rule' && selectorOverride === undefined && selector === null) {
      selector = cursor.selector;
    }
    if (cursor.type === 'atrule') {
      atRules.unshift({ name: cursor.name, parameters: cursor.params });
    }
    cursor = cursor.parent;
  }
  return {
    file,
    line: pos.line,
    column: pos.column,
    property: declaration.prop,
    value: declaration.value,
    selector,
    atRules,
    refs: cssReferences(declaration.value),
    sourceFile: file,
  };
}
export function parseSurface(
  file: string,
  source: string,
  text: string,
  offset: number,
  kind: string,
  diagnostics: Diagnostic[],
): DeclarationRecord[] {
  const wrapped =
    kind === 'svelte-inline' || kind === 'runtime-style' ? `:root {\n${text}\n}` : text;
  const lineOffset = kind === 'svelte-inline' || kind === 'runtime-style' ? 1 : 0;
  try {
    const root = parseCss(wrapped, { from: file });
    const records: DeclarationRecord[] = [];
    root.walkDecls((declaration) => {
      const selectorOverride =
        kind === 'svelte-inline' || kind === 'runtime-style' ? null : undefined;
      records.push(
        declarationIdentity(file, declaration, source, offset, lineOffset, selectorOverride),
      );
    });
    return records;
  } catch {
    const pos = position(source, offset);
    diagnostics.push({
      file,
      line: pos.line,
      column: pos.column,
      kind: 'parse-error',
      reason: `Unable to parse ${kind} CSS`,
    });
    return [];
  }
}
function svelteExtract(source: Source): ExtractedSource {
  const result: ExtractedSource = { declarations: [], dynamic: [], diagnostics: [] };
  let ast: Record<string, unknown>;
  try {
    ast = parseSvelte(source.content, { modern: false });
  } catch {
    result.diagnostics.push({
      file: source.path,
      line: 1,
      column: 1,
      kind: 'parse-error',
      reason: 'Unable to parse Svelte source',
    });
    return result;
  }
  const css = ast['css'];
  if (isRecord(css) && isRecord(css['content'])) {
    const content = css['content'];
    if (typeof content['styles'] === 'string' && typeof content['start'] === 'number')
      result.declarations.push(
        ...parseSurface(
          source.path,
          source.content,
          content['styles'],
          content['start'],
          'svelte-style',
          result.diagnostics,
        ),
      );
  }
  const visited = new Set<object>();
  const visit = (node: unknown, inSvgNamespace = false): void => {
    if (!node || typeof node !== 'object') return;
    if (visited.has(node)) return;
    visited.add(node);
    if (!isRecord(node)) return;
    const record = node;
    const elementName = typeof record['name'] === 'string' ? record['name'] : null;
    const isElement = record['type'] === 'Element';
    const isSvgElement = isElement && (inSvgNamespace || elementName === 'svg');
    const isStructuralNode =
      !isElement && typeof record['type'] === 'string' && SVG_STRUCTURAL_NODES.has(record['type']);
    const childInSvgNamespace = isSvgElement
      ? elementName !== 'foreignObject'
      : inSvgNamespace && isStructuralNode;
    if (Array.isArray(record['attributes']))
      for (const attribute of record['attributes']) {
        if (!attribute || typeof attribute !== 'object') continue;
        if (!isRecord(attribute)) continue;
        const value = attribute;
        if (isSvgElement) extractSvelteSvgAttribute(source, value, result, parseSurface);
        if (value['type'] === 'Attribute' && value['name'] === 'style') {
          const values = Array.isArray(value['value']) ? value['value'] : [];
          extractSvelteStyleAttribute(source, value, values, result, parseSurface);
        }
        if (value['type'] === 'StyleDirective') {
          const parts = Array.isArray(value['value']) ? value['value'] : [];
          const name = value['name'];
          const part = parts[0];
          const expression = source.content.slice(
            numberField(value, 'start') ?? 0,
            numberField(value, 'end') ?? 0,
          );
          if (
            parts.length === 1 &&
            isRecord(part) &&
            part['type'] === 'Text' &&
            typeof part['data'] === 'string' &&
            typeof name === 'string' &&
            typeof part['start'] === 'number'
          )
            result.declarations.push(
              ...parseSurface(
                source.path,
                source.content,
                `${name}: ${part['data']};`,
                numberField(value, 'start') ?? part['start'],
                'svelte-inline',
                result.diagnostics,
              ),
            );
          else if (
            parts.length === 1 &&
            isRecord(part) &&
            part['type'] === 'MustacheTag' &&
            isRecord(part['expression']) &&
            part['expression']['type'] === 'Literal' &&
            typeof part['expression']['value'] === 'string' &&
            typeof name === 'string' &&
            typeof part['start'] === 'number'
          )
            result.declarations.push(
              ...parseSurface(
                source.path,
                source.content,
                `${name}: ${part['expression']['value']};`,
                numberField(value, 'start') ?? part['start'],
                'svelte-inline',
                result.diagnostics,
              ),
            );
          else {
            result.dynamic.push(
              dynamicRecord(
                source,
                numberField(value, 'start') ?? 0,
                'svelte-style-directive',
                typeof value['name'] === 'string' ? value['name'] : '',
                expression,
              ),
            );
            result.diagnostics.push({
              ...dynamicRecord(
                source,
                numberField(value, 'start') ?? 0,
                'svelte-style-directive',
                typeof value['name'] === 'string' ? value['name'] : '',
                expression,
              ),
              kind: 'unsupported-surface',
              reason: 'Dynamic style directive requires reviewed mapping',
            });
          }
        }
      }
    for (const [key, child] of Object.entries(record)) {
      if (key === 'expression' || key === 'css' || key === 'attributes') continue;
      if (Array.isArray(child)) for (const item of child) visit(item, childInSvgNamespace);
      else if (child && typeof child === 'object') visit(child, childInSvgNamespace);
    }
  };
  visit(ast['html']);
  for (const script of [ast['instance'], ast['module']]) {
    if (!isRecord(script) || !isRecord(script['content'])) continue;
    const content = script['content'];
    if (typeof content['start'] !== 'number' || typeof content['end'] !== 'number') continue;
    const scriptResult = runtimeExtract(
      source,
      content['start'],
      source.content.slice(content['start'], content['end']),
      parseSurface,
    );
    result.declarations.push(...scriptResult.declarations);
    result.dynamic.push(...scriptResult.dynamic);
    result.diagnostics.push(...scriptResult.diagnostics);
  }
  return result;
}
export function extractSource(source: Source): ExtractedSource {
  if (source.path.endsWith('.css')) {
    const diagnostics: Diagnostic[] = [];
    return {
      declarations: parseSurface(
        source.path,
        source.content,
        source.content,
        0,
        'css',
        diagnostics,
      ),
      dynamic: [],
      diagnostics,
    };
  }
  if (source.path.endsWith('.svelte')) return svelteExtract(source);
  if (/[.]tsx?$|[.](jsx?|mjs|cjs)$/.test(source.path))
    return runtimeExtract(source, 0, source.content, parseSurface);
  return { declarations: [], dynamic: [], diagnostics: [] };
}

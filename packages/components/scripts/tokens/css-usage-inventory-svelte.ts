import { dynamicRecord, isRecord, numberField } from './css-inventory-diagnostics';
import type { Diagnostic, Source } from './css-usage-inventory';
import type { DeclarationRecord, ExtractedSource } from './css-usage-inventory-extraction';

export const SVG_STRUCTURAL_NODES = new Set([
  'AwaitBlock',
  'CatchBlock',
  'EachBlock',
  'ElseBlock',
  'IfBlock',
  'KeyBlock',
  'SnippetBlock',
  'ThenBlock',
]);

type ParseSurface = (
  file: string,
  source: string,
  text: string,
  offset: number,
  kind: string,
  diagnostics: Diagnostic[],
) => DeclarationRecord[];

const SVG_PRESENTATION_PROPERTIES = new Set([
  'alignment-baseline',
  'baseline-shift',
  'clip',
  'clip-path',
  'clip-rule',
  'color',
  'color-interpolation',
  'color-interpolation-filters',
  'color-rendering',
  'cursor',
  'direction',
  'display',
  'dominant-baseline',
  'fill',
  'fill-opacity',
  'fill-rule',
  'filter',
  'flood-color',
  'flood-opacity',
  'font-family',
  'font-size',
  'font-size-adjust',
  'font-stretch',
  'font-style',
  'font-variant',
  'font-weight',
  'glyph-orientation-horizontal',
  'glyph-orientation-vertical',
  'image-rendering',
  'letter-spacing',
  'lighting-color',
  'marker-end',
  'marker-mid',
  'marker-start',
  'mask',
  'opacity',
  'overflow',
  'paint-order',
  'pointer-events',
  'shape-rendering',
  'stop-color',
  'stop-opacity',
  'stroke',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-opacity',
  'stroke-width',
  'text-anchor',
  'text-decoration',
  'text-rendering',
  'unicode-bidi',
  'vector-effect',
  'visibility',
  'word-spacing',
  'writing-mode',
]);

export function extractSvelteSvgAttribute(
  source: Source,
  attribute: Record<string, unknown>,
  result: ExtractedSource,
  parseSurface: ParseSurface,
): void {
  if (
    attribute['type'] !== 'Attribute' ||
    typeof attribute['name'] !== 'string' ||
    !SVG_PRESENTATION_PROPERTIES.has(attribute['name'])
  )
    return;
  const parts = Array.isArray(attribute['value']) ? attribute['value'] : [];
  const staticValue = parts.every(
    (part) => isRecord(part) && part['type'] === 'Text' && typeof part['data'] === 'string',
  )
    ? parts.map((part) => (isRecord(part) ? part['data'] : '')).join('')
    : null;
  const attributeStart = numberField(attribute, 'start') ?? 0;
  const expression = source.content.slice(
    attributeStart,
    numberField(attribute, 'end') ?? attributeStart,
  );
  if (staticValue !== null) {
    result.declarations.push(
      ...parseSurface(
        source.path,
        source.content,
        `${attribute['name']}: ${staticValue};`,
        attributeStart,
        'svelte-svg-attribute',
        result.diagnostics,
      ),
    );
    return;
  }
  const dynamic = dynamicRecord(
    source,
    attributeStart,
    'svelte-svg-attribute',
    attribute['name'],
    expression,
  );
  result.dynamic.push(dynamic);
  result.diagnostics.push({
    ...dynamic,
    kind: 'unsupported-surface',
    reason: 'Dynamic SVG presentation attribute requires reviewed mapping',
  });
}

export function extractSvelteStyleAttribute(
  source: Source,
  attribute: Record<string, unknown>,
  values: unknown[],
  result: ExtractedSource,
  parseSurface: ParseSurface,
): void {
  let buffer = '';
  let bufferStart = numberField(attribute, 'start') ?? 0;
  const holes: { start: number; end: number; expression: string }[] = [];
  let quote: '"' | "'" | null = null;
  let escaped = false;
  let comment = false;
  let parentheses = 0;
  const flush = (): void => {
    if (holes.length > 0) {
      const property = buffer.match(/^\s*([\w-]+)\s*:/)?.[1] ?? null;
      // Parse the placeholder-filled surface so malformed static CSS still
      // produces a diagnostic, but discard declarations that contain holes.
      parseSurface(
        source.path,
        source.content,
        buffer,
        bufferStart,
        'svelte-inline',
        result.diagnostics,
      );
      for (const hole of holes) {
        const dynamic = dynamicRecord(
          source,
          hole.start,
          'svelte-style-attribute',
          property,
          hole.expression,
        );
        result.dynamic.push(dynamic);
        result.diagnostics.push({
          ...dynamic,
          kind: 'unsupported-surface',
          reason: 'Dynamic style attribute requires reviewed mapping',
        });
      }
    } else if (buffer.trim()) {
      result.declarations.push(
        ...parseSurface(
          source.path,
          source.content,
          buffer,
          bufferStart,
          'svelte-inline',
          result.diagnostics,
        ),
      );
    }
    buffer = '';
    holes.length = 0;
  };
  const appendText = (data: string, partStart: number): void => {
    let cursor = 0;
    while (cursor < data.length) {
      if (!buffer && holes.length === 0) bufferStart = partStart + cursor;
      const character = data[cursor];
      const next = data[cursor + 1];
      if (comment) {
        buffer += character;
        if (character === '*' && next === '/') {
          buffer += next;
          cursor += 2;
          comment = false;
          continue;
        }
        cursor++;
        continue;
      }
      if (quote) {
        buffer += character;
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === quote) quote = null;
        cursor++;
        continue;
      }
      if (character === '/' && next === '*') {
        buffer += '/*';
        cursor += 2;
        comment = true;
        continue;
      }
      if (character === '"' || character === "'") quote = character;
      else if (character === '(') parentheses++;
      else if (character === ')' && parentheses > 0) parentheses--;
      buffer += character;
      cursor++;
      if (character === ';' && parentheses === 0) flush();
    }
  };
  for (const part of values) {
    if (!isRecord(part)) continue;
    const partStart = numberField(part, 'start') ?? bufferStart;
    if (part['type'] === 'Text' && typeof part['data'] === 'string') {
      appendText(part['data'], partStart);
    } else {
      const partEnd = numberField(part, 'end') ?? partStart;
      if (!buffer && holes.length === 0) bufferStart = partStart;
      holes.push({
        start: partStart,
        end: partEnd,
        expression: source.content.slice(partStart, partEnd),
      });
      buffer += ' '.repeat(Math.max(1, partEnd - partStart));
    }
  }
  flush();
}

import { parse, type DefaultTreeAdapterTypes } from 'parse5';
import ts from 'typescript';
import { dynamicRecord } from './css-inventory-diagnostics';
import type { Diagnostic, Source } from './css-usage-inventory';
import {
  appendMapped,
  decodeJavaScriptText,
  mapSlice,
  maskDynamicValues,
  type MappedText,
} from './css-usage-inventory-emitted-text';
import type { DeclarationRecord, ExtractedSource } from './css-usage-inventory-extraction';
import { extractLiveLiterals } from './css-usage-inventory-live-producers';

type SurfaceParser = (
  file: string,
  source: string,
  text: string,
  offset: number,
  kind: string,
  diagnostics: Diagnostic[],
  offsetMap?: readonly number[],
) => DeclarationRecord[];

const placeholder = (index: number): string => `__CINDER_DYNAMIC_${index}__`;

function isLiveLiteral(
  node: ts.Node,
  liveLiterals: ReadonlySet<ts.StringLiteralLike | ts.TemplateExpression>,
): boolean {
  return (ts.isStringLiteralLike(node) || ts.isTemplateExpression(node)) && liveLiterals.has(node);
}

function offsetOf(sourceFile: ts.SourceFile, node: ts.Node): number {
  return node.getStart(sourceFile);
}

function reportMalformedMarkup(
  source: Source,
  mapped: MappedText,
  result: ExtractedSource,
): boolean {
  if (mapped.malformedOffsets === undefined) return false;
  for (const offset of mapped.malformedOffsets) {
    const dynamic = dynamicRecord(
      source,
      offset,
      'runtime-html-unresolved',
      null,
      'malformed escape sequence',
    );
    result.dynamic.push(dynamic);
    result.diagnostics.push({
      ...dynamic,
      kind: 'unsupported-surface',
      reason: 'Malformed or unmappable JavaScript escape prevented emitted markup decoding',
    });
  }
  return true;
}

function parseEmittedMarkup(
  source: Source,
  mapped: MappedText,
  result: ExtractedSource,
  parseSurface: SurfaceParser,
): void {
  const parseRange = (start: number, end: number, kind: string): void => {
    const value = mapSlice(mapped, start, end);
    const masked = maskDynamicValues(value);
    result.declarations.push(
      ...parseSurface(
        source.path,
        source.content,
        masked.text,
        value.sourceOffsets[0] ?? 0,
        kind,
        result.diagnostics,
        masked.sourceOffsets,
      ),
    );
  };
  const unsupportedAttribute = (offset: number): void => {
    const record = dynamicRecord(
      source,
      mapped.sourceOffsets[offset] ?? 0,
      'runtime-html-unresolved',
      null,
      'encoded HTML style attribute',
    );
    result.dynamic.push(record);
    result.diagnostics.push({
      ...record,
      kind: 'unsupported-surface',
      reason: 'HTML attribute decoding changes source characters and requires reviewed mapping',
    });
  };
  const visit = (node: DefaultTreeAdapterTypes.Node): void => {
    if ('tagName' in node) {
      // Raw script text, comments, and ordinary text nodes are not CSS attributes.
      if (node.tagName === 'script') return;
      const location = node.sourceCodeLocation;
      if (node.tagName === 'style' && location?.startTag) {
        parseRange(
          location.startTag.endOffset,
          location.endTag?.startOffset ?? location.endOffset,
          'runtime-html-style-tag',
        );
      }
      const style = node.attrs.find((attribute) => attribute.name === 'style');
      if (style && style.value !== '') {
        const attribute = location?.attrs?.['style'];
        if (!attribute) unsupportedAttribute(location?.startOffset ?? 0);
        else {
          let start = mapped.text.indexOf('=', attribute.startOffset) + 1;
          while (/\s/.test(mapped.text[start] ?? '') && start < attribute.endOffset) start++;
          const quote = mapped.text[start];
          const quoted = quote === '"' || quote === "'";
          if (quoted) start++;
          const end = quoted ? attribute.endOffset - 1 : attribute.endOffset;
          if (mapped.text.slice(start, end) !== style.value) unsupportedAttribute(start);
          else parseRange(start, end, 'runtime-html-style-attribute');
        }
      }
    }
    if ('childNodes' in node) for (const child of node.childNodes) visit(child);
  };
  visit(parse(mapped.text, { sourceCodeLocationInfo: true }));
}

function templateText(
  sourceFile: ts.SourceFile,
  node: ts.TemplateExpression,
): { mapped: MappedText; dynamicOffsets: number[] } {
  const nodeStart = node.getStart(sourceFile);
  const mapped: MappedText = { text: '', sourceOffsets: [] };
  const dynamicOffsets: number[] = [];
  let rawStart = nodeStart + 1;
  for (const [index, span] of node.templateSpans.entries()) {
    const interpolationStart =
      index === 0 ? node.head.end - 2 : node.templateSpans[index - 1]!.literal.end - 2;
    appendMapped(
      mapped,
      decodeJavaScriptText(sourceFile.text.slice(rawStart, interpolationStart), rawStart),
    );
    const interpolationEnd = span.literal.getStart(sourceFile) + 1;
    const marker = placeholder(index);
    mapped.text += marker;
    mapped.sourceOffsets.push(...Array.from({ length: marker.length }, () => interpolationStart));
    dynamicOffsets.push(interpolationStart);
    rawStart = interpolationEnd;
  }
  appendMapped(
    mapped,
    decodeJavaScriptText(sourceFile.text.slice(rawStart, node.end - 1), rawStart),
  );
  return { mapped, dynamicOffsets };
}

function extractLiteral(
  source: Source,
  sourceFile: ts.SourceFile,
  node: ts.StringLiteralLike | ts.TemplateExpression,
  result: ExtractedSource,
  parseSurface: SurfaceParser,
  liveLiterals: ReadonlySet<ts.StringLiteralLike | ts.TemplateExpression>,
): void {
  if (!isLiveLiteral(node, liveLiterals)) return;
  if (ts.isTemplateExpression(node)) {
    const rendered = templateText(sourceFile, node);
    const malformed = reportMalformedMarkup(source, rendered.mapped, result);
    if (!malformed) parseEmittedMarkup(source, rendered.mapped, result, parseSurface);
    for (const [index, dynamicOffset] of rendered.dynamicOffsets.entries()) {
      const expression = node.templateSpans[index]?.expression.getText(sourceFile) ?? '';
      result.dynamic.push(
        dynamicRecord(source, dynamicOffset, 'runtime-html-interpolation', null, expression),
      );
      result.diagnostics.push({
        ...dynamicRecord(source, dynamicOffset, 'runtime-html-interpolation', null, expression),
        kind: 'unsupported-surface',
        reason:
          'Dynamic emitted HTML interpolation may introduce CSS and requires reviewed mapping',
      });
    }
  } else {
    const start = offsetOf(sourceFile, node) + 1;
    const mapped = decodeJavaScriptText(sourceFile.text.slice(start, node.end - 1), start);
    if (!reportMalformedMarkup(source, mapped, result))
      parseEmittedMarkup(source, mapped, result, parseSurface);
  }
}

/** Extracts CSS only from TypeScript markup values that reach an owned output boundary. */
export function extractEmittedLiterals(
  source: Source,
  parseSurface: SurfaceParser,
): ExtractedSource {
  const result: ExtractedSource = { declarations: [], dynamic: [], diagnostics: [] };
  const sourceFile = ts.createSourceFile(
    source.path,
    source.content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const live = extractLiveLiterals(sourceFile);
  const liveLiterals = live.literals;
  for (const [unresolved, reason] of [
    ...live.recipeUnresolved.map(
      (node) => [node, 'Live preview recipe producer could not be statically resolved'] as const,
    ),
    ...live.responseUnresolved.map(
      (node) => [node, 'Live response HTML producer could not be statically resolved'] as const,
    ),
  ]) {
    const dynamic = dynamicRecord(
      source,
      unresolved.getStart(sourceFile),
      'runtime-html-unresolved',
      null,
      unresolved.getText(sourceFile),
    );
    result.dynamic.push(dynamic);
    result.diagnostics.push({
      ...dynamic,
      kind: 'unsupported-surface',
      reason,
    });
  }
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteralLike(node) || ts.isTemplateExpression(node))
      extractLiteral(source, sourceFile, node, result, parseSurface, liveLiterals);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return result;
}

/** Extracts CSS from a raw HTML source while preserving source offsets. */
export function extractEmittedMarkup(source: Source, parseSurface: SurfaceParser): ExtractedSource {
  const result: ExtractedSource = { declarations: [], dynamic: [], diagnostics: [] };
  parseEmittedMarkup(
    source,
    {
      text: source.content,
      sourceOffsets: Array.from({ length: source.content.length }, (_, index) => index),
    },
    result,
    parseSurface,
  );
  return result;
}

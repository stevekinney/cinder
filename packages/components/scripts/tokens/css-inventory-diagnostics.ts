import type { Diagnostic, DynamicRecord, Source } from './css-usage-inventory';
import type { ExtractedSource } from './css-usage-inventory-extraction';

export function dynamicRecord(
  source: Source,
  offset: number,
  kind: string,
  property: string | null,
  expression: string,
): DynamicRecord {
  const before = source.content.slice(0, Math.max(0, offset));
  const lineStart = before.lastIndexOf('\n') + 1;
  return {
    file: source.path,
    line: before.split('\n').length,
    column: offset - lineStart + 1,
    kind,
    property,
    expression,
  };
}
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}
export function numberField(value: Record<string, unknown>, key: string): number | undefined {
  const result = value[key];
  return typeof result === 'number' ? result : undefined;
}

export function reportUnsupported(
  result: ExtractedSource,
  source: Source,
  offset: number,
  property: string | null,
  expression: string,
  reason: string,
): void {
  const dynamic: DynamicRecord = {
    file: source.path,
    line: source.content.slice(0, offset).split('\n').length,
    column: offset - (source.content.lastIndexOf('\n', offset - 1) + 1) + 1,
    kind: 'runtime-style-sink',
    property,
    expression,
  };
  result.dynamic.push(dynamic);
  const diagnostic: Diagnostic = { ...dynamic, kind: 'unsupported-surface', reason };
  result.diagnostics.push(diagnostic);
}

/**
 * Approximate client-side preview of `weft codegen`'s output (plan §9.7
 * T7.5: "codegen panel (renders `weft codegen`-equivalent output from
 * `/api/v1/registry` in CodeBlock)"; design `Weft UI.dc.html` "System"
 * § HEALTH & LEASE).
 *
 * ## Why this is a preview, not the real emitter
 *
 * The real emitter (`weft/src/cli/codegen-emit.ts`, a byte-stable
 * JSON-Schema → `.d.ts` generator covering the full subset
 * `definitionSchemaToJsonSchema` produces) is CLI-internal — not exported
 * from any `@lostgradient/weft` public subpath (verified against the
 * package's `exports` map), so this module cannot import and reuse it. Rather
 * than silently re-deriving a parallel implementation that could drift from
 * the real emitter's behavior and be mistaken for it, this generator covers
 * only the common JSON Schema shapes (object/properties/required,
 * string/number/boolean, enum, array, nullable) and falls back to `unknown`
 * for anything else — the same falls-back-honestly posture the real emitter
 * documents for itself. The panel using this module labels it a preview and
 * links to the real `weft codegen` command for the exact, complete output.
 */
import { extractSchemaFields, type RegistrySchemaField } from './registry-view.ts';

function isJsonSchemaTypeString(value: unknown): value is string {
  return typeof value === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNullable(fragment: unknown): boolean {
  if (typeof fragment !== 'object' || fragment === null) return false;
  if (!isRecord(fragment)) return false;
  const type = fragment['type'];
  return Array.isArray(type) && type.includes('null');
}

/** Best-effort TypeScript type expression for one property's schema fragment. */
function tsTypeExpression(field: RegistrySchemaField, fragment: unknown): string {
  const record = isRecord(fragment) ? fragment : {};

  if (Array.isArray(record['enum']) && record['enum'].every((entry) => typeof entry === 'string')) {
    return record['enum'].map((entry) => JSON.stringify(entry)).join(' | ');
  }

  const base = (() => {
    switch (field.type) {
      case 'string':
        return 'string';
      case 'number':
      case 'integer':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'array': {
        const items = record['items'];
        const itemType =
          isRecord(items) && isJsonSchemaTypeString(items['type']) ? items['type'] : 'unknown';
        return `${itemType}[]`;
      }
      default:
        return 'unknown';
    }
  })();

  return isNullable(fragment) ? `${base} | null` : base;
}

/**
 * Renders a `.d.ts`-flavored TypeScript interface preview for one workflow's
 * input schema. Returns `undefined` when the schema has no top-level
 * `properties` to preview (matches `extractSchemaFields`'s own fallback).
 */
export function previewInterface(
  interfaceName: string,
  schema: Record<string, unknown> | undefined,
): string | undefined {
  if (!schema) return undefined;
  const properties = isRecord(schema['properties']) ? schema['properties'] : undefined;
  if (!properties) return undefined;

  const fields = extractSchemaFields(schema);
  if (fields.length === 0) return undefined;

  const lines = fields.map((field) => {
    const optional = field.required ? '' : '?';
    return `  ${field.name}${optional}: ${tsTypeExpression(field, properties[field.name])};`;
  });

  return [`export interface ${interfaceName} {`, ...lines, '}'].join('\n');
}

/** PascalCase-ish interface name for a workflow type, e.g. `order-processing` → `OrderProcessingInput`. */
export function inputInterfaceName(workflowType: string): string {
  const pascal = workflowType
    .split(/[^a-zA-Z0-9]+/)
    .filter((segment) => segment.length > 0)
    .map((segment) => segment[0]?.toUpperCase() + segment.slice(1))
    .join('');
  return `${pascal}Input`;
}

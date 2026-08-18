import type { JsonSchemaTypeName } from './json-schema-editor-types.ts';

export const PRIMITIVE_TYPES: readonly JsonSchemaTypeName[] = [
  'string',
  'number',
  'integer',
  'boolean',
  'null',
  'object',
  'array',
];

/** Keywords with dedicated form controls. Other keywords are preserved without editing. */
export const EDITABLE_KEYWORDS = new Set([
  'type',
  'title',
  'description',
  'default',
  'examples',
  'const',
  'minLength',
  'maxLength',
  'pattern',
  'format',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'properties',
  'required',
  'additionalProperties',
  'items',
  'minItems',
  'maxItems',
  'uniqueItems',
  'oneOf',
  'anyOf',
  'allOf',
  'not',
  '$ref',
  '$schema',
]);

export const DEFAULT_COLLAPSE_DEPTH = 3;
export const MAX_RENDER_DEPTH = 30;

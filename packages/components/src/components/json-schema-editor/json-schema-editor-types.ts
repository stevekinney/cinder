/**
 * Public types for the JsonSchemaEditor component.
 *
 * Naming rule: every type referenced from JsonSchemaEditorProps is prefixed
 * with `JsonSchema*` or `JsonSchemaEditor*` and exported from the package
 * barrel.
 */

export type JsonSchemaTypeName =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'null'
  | 'object'
  | 'array';

/** Drafts the editor can validate against. */
export type JsonSchemaKnownDraft = '2020-12' | '2019-09' | 'draft-07';

/** All draft states, including the unknown-but-encountered case. */
export type JsonSchemaDraft = JsonSchemaKnownDraft | 'unknown';

export type JsonSchemaEditorView = 'form' | 'json' | 'diff';

export type JsonSchemaEditorMode = 'edit' | 'readonly';

/**
 * A JSON Schema document. May be a boolean (allow-all / deny-all) or an
 * object with editable + preserved keywords.
 */
export type JsonSchemaValue = boolean | JsonSchemaObject;

/**
 * Structural shape of an object-form schema. We type the keywords the editor
 * edits explicitly; everything else round-trips through the index signature.
 */
export interface JsonSchemaObject {
  $schema?: string | undefined;
  $id?: string | undefined;
  $ref?: string | undefined;
  type?: JsonSchemaTypeName | JsonSchemaTypeName[] | undefined;
  title?: string | undefined;
  description?: string | undefined;
  default?: unknown;
  examples?: unknown[] | undefined;
  enum?: unknown[] | undefined;
  const?: unknown;

  // String constraints
  minLength?: number | undefined;
  maxLength?: number | undefined;
  pattern?: string | undefined;
  format?: string | undefined;

  // Number constraints
  minimum?: number | undefined;
  maximum?: number | undefined;
  exclusiveMinimum?: number | undefined;
  exclusiveMaximum?: number | undefined;
  multipleOf?: number | undefined;

  // Object constraints
  properties?: Record<string, JsonSchemaValue> | undefined;
  required?: string[] | undefined;
  additionalProperties?: JsonSchemaValue | undefined;

  // Array constraints
  items?: JsonSchemaValue | undefined;
  minItems?: number | undefined;
  maxItems?: number | undefined;
  uniqueItems?: boolean | undefined;

  // Composition
  oneOf?: JsonSchemaValue[] | undefined;
  anyOf?: JsonSchemaValue[] | undefined;
  allOf?: JsonSchemaValue[] | undefined;
  not?: JsonSchemaValue | undefined;

  // Round-trip bag for unmodeled keywords. The editor reads and writes the
  // typed slots above; everything else is preserved verbatim.
  [key: string]: unknown;
}

export type JsonSchemaValidationError = {
  path: string;
  message: string;
  keyword: string;
};

export type JsonSchemaValidationStatus = 'valid' | 'invalid' | 'pending';

export type JsonSchemaValidationResult = {
  status: JsonSchemaValidationStatus;
  /** Meta-schema valid. Always meaningful, even when status is `pending`. */
  valid: boolean;
  errors: JsonSchemaValidationError[];
  /** `null` when compile is deferred or not yet run. */
  compilable: boolean | null;
  compileError?: string;
};

export type JsonSchemaEditorChangeEvent = {
  schema: JsonSchemaValue;
  jsonString: string;
};

export type JsonSchemaEditorRevertEvent = {
  restoredFrom: 'original-schema' | 'original-text';
};

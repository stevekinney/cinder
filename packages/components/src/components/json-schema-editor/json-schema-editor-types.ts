/**
 * Public types for the JSONSchemaEditor component.
 *
 * Naming rule: every type referenced from JSONSchemaEditorProps is prefixed
 * with `JSONSchema*` or `JSONSchemaEditor*` and exported from the package
 * barrel.
 */

export type JSONSchemaTypeName =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'null'
  | 'object'
  | 'array';

/** Drafts the editor can validate against. */
export type JSONSchemaKnownDraft = '2020-12' | '2019-09' | 'draft-07';

/** All draft states, including the unknown-but-encountered case. */
export type JSONSchemaDraft = JSONSchemaKnownDraft | 'unknown';

export type JSONSchemaEditorView = 'form' | 'json' | 'diff';

export type JSONSchemaEditorMode = 'edit' | 'readonly';

/**
 * A JSON Schema document. May be a boolean (allow-all / deny-all) or an
 * object with editable + preserved keywords.
 */
export type JSONSchemaValue = boolean | JSONSchemaObject;

/**
 * Structural shape of an object-form schema. We type the keywords the editor
 * edits explicitly; everything else round-trips through the index signature.
 */
export interface JSONSchemaObject {
  $schema?: string;
  $id?: string;
  $ref?: string;
  type?: JSONSchemaTypeName | JSONSchemaTypeName[];
  title?: string;
  description?: string;
  default?: unknown;
  examples?: unknown[];
  enum?: unknown[];
  const?: unknown;

  // String constraints
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;

  // Number constraints
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;

  // Object constraints
  properties?: Record<string, JSONSchemaValue>;
  required?: string[];
  additionalProperties?: JSONSchemaValue;

  // Array constraints
  items?: JSONSchemaValue;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;

  // Composition
  oneOf?: JSONSchemaValue[];
  anyOf?: JSONSchemaValue[];
  allOf?: JSONSchemaValue[];
  not?: JSONSchemaValue;

  // Round-trip bag for unmodeled keywords. The editor reads and writes the
  // typed slots above; everything else is preserved verbatim.
  [key: string]: unknown;
}

export type JSONSchemaValidationError = {
  path: string;
  message: string;
  keyword: string;
};

export type JSONSchemaValidationStatus = 'valid' | 'invalid' | 'pending' | 'compile-deferred';

export type JSONSchemaValidationResult = {
  status: JSONSchemaValidationStatus;
  /** Meta-schema valid. Always meaningful, even when status is `pending`. */
  valid: boolean;
  errors: JSONSchemaValidationError[];
  /** `null` when compile is deferred or not yet run. */
  compilable: boolean | null;
  compileError?: string;
};

export type JSONSchemaEditorChangeEvent = {
  schema: JSONSchemaValue;
  jsonString: string;
};

export type JSONSchemaEditorRevertEvent = {
  restoredFrom: 'original-schema' | 'original-text';
};

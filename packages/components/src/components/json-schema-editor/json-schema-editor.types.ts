import type {
  JsonSchemaEditorChangeEvent,
  JsonSchemaEditorRevertEvent,
  JsonSchemaEditorView,
  JsonSchemaKnownDraft,
  JsonSchemaValidationResult,
  JsonSchemaValue,
} from './json-schema-editor-types.ts';

export type {
  JsonSchemaDraft,
  JsonSchemaEditorChangeEvent,
  JsonSchemaEditorMode,
  JsonSchemaEditorRevertEvent,
  JsonSchemaEditorView,
  JsonSchemaKnownDraft,
  JsonSchemaTypeName,
  JsonSchemaValidationError,
  JsonSchemaValidationResult,
  JsonSchemaValidationStatus,
  JsonSchemaValue,
} from './json-schema-editor-types.ts';

/** Props for the JsonSchemaEditor component. */
export type JsonSchemaEditorProps = {
  /** Required for ARIA wiring. */
  id: string;
  /** The schema being edited. May be a string (JSON text) or pre-parsed value. */
  schema: JsonSchemaValue | string;
  /** Optional explicit baseline; defaults to the initial `schema`. */
  original?: JsonSchemaValue | string;
  /** Changing this triggers a full reset (history clears). */
  schemaKey?: string;
  /** Active view: form / json / diff. Bindable. */
  view?: JsonSchemaEditorView;
  /** Read-only mode disables all mutations. */
  readonly?: boolean;
  /** Maximum history entries (default 100). */
  maxHistory?: number;
  /** Force a draft override regardless of $schema. */
  draftOverride?: JsonSchemaKnownDraft;
  onchange?: (event: JsonSchemaEditorChangeEvent) => void;
  onrevert?: (event: JsonSchemaEditorRevertEvent) => void;
  onvalidate?: (result: JsonSchemaValidationResult) => void;
  /** Additional class merged onto the `.cinder-jse` root element. */
  class?: string;
};

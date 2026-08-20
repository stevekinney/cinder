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

type JsonSchemaEditorCommonProps = {
  /** Required for ARIA wiring. */
  id: string;
  /** Optional explicit baseline; defaults to the initial schema input. */
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
  /** Request that the parent replace `schema` with a committed editor value. */
  onValueChangeRequest?: (event: JsonSchemaEditorChangeEvent) => unknown;
  onRevert?: (event: JsonSchemaEditorRevertEvent) => void;
  onValidate?: (result: JsonSchemaValidationResult) => void;
  /** Additional class merged onto the `.cinder-jse` root element. */
  class?: string;
};

/** Parent-owned schema state. Every editor commit requests a parent update. */
type ControlledJsonSchemaEditorProps = {
  /** Parent-owned schema. Requires `onValueChangeRequest`; do not combine with `defaultSchema`. */
  schema: JsonSchemaValue | string;
  /**
   * Request that the parent replace `schema` with a committed editor value.
   * The parent may respond asynchronously; it must eventually provide the
   * accepted or replacement schema so the editor can reconcile the request.
   * Return that schema, or a promise for it, to settle an unchanged rejection.
   * A later commit is restored to the parent schema until that response arrives.
   */
  onValueChangeRequest: (event: JsonSchemaEditorChangeEvent) => unknown;
  /** Observe a schema change after the parent accepts the request. */
  onSchemaChange?: (event: JsonSchemaEditorChangeEvent) => void;
  /** Omit `schema` to use this as the initial value of an uncontrolled editor. */
  defaultSchema?: never;
};

/** Locally managed editor initialized from an explicitly supplied schema. */
type SchemaSeededJsonSchemaEditorProps = {
  schema: JsonSchemaValue | string;
  defaultSchema?: never;
  onValueChangeRequest?: never;
  onSchemaChange?: (event: JsonSchemaEditorChangeEvent) => void;
};

/** Component-owned schema state initialized once from `defaultSchema`. */
type UncontrolledJsonSchemaEditorProps = {
  /** Initial schema for an uncontrolled editor. Defaults to an empty schema. */
  defaultSchema?: JsonSchemaValue | string;
  /** `defaultSchema` is only an initial value; omit `schema` for local state ownership. */
  schema?: never;
  /** Controlled editors alone request a parent state update. */
  onValueChangeRequest?: never;
  /** Observe committed changes without taking control of the schema value. */
  onSchemaChange?: (event: JsonSchemaEditorChangeEvent) => void;
};

/** Props for the JsonSchemaEditor component. */
export type JsonSchemaEditorProps = JsonSchemaEditorCommonProps &
  (
    | ControlledJsonSchemaEditorProps
    | SchemaSeededJsonSchemaEditorProps
    | UncontrolledJsonSchemaEditorProps
  );

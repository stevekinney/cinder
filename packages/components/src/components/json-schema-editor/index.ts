import './json-schema-editor.css';
import JsonSchemaEditor from './json-schema-editor.svelte';

export default JsonSchemaEditor;
export type {
  JsonSchemaDraft,
  JsonSchemaEditorChangeEvent,
  JsonSchemaEditorMode,
  JsonSchemaEditorProps,
  JsonSchemaEditorRevertEvent,
  JsonSchemaEditorView,
  JsonSchemaKnownDraft,
  JsonSchemaTypeName,
  JsonSchemaValidationError,
  JsonSchemaValidationResult,
  JsonSchemaValidationStatus,
  JsonSchemaValue,
} from './json-schema-editor.types.ts';
export { JsonSchemaEditor };

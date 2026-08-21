import type { createEditorState } from './json-schema-editor-state.svelte.ts';
import type {
  JsonSchemaEditorChangeEvent,
  JsonSchemaEditorRevertEvent,
  JsonSchemaKnownDraft,
  JsonSchemaValidationResult,
  JsonSchemaValue,
} from './json-schema-editor-types.ts';

export interface CreateEditorStateOptions {
  schema: JsonSchemaValue | string;
  original?: JsonSchemaValue | string;
  draftOverride?: JsonSchemaKnownDraft;
  readonly?: boolean;
  /** Controlled editors preserve each requested change as a distinct history entry. */
  controlled?: boolean;
  maxHistory?: number;
  onSchemaChange?: (event: JsonSchemaEditorChangeEvent) => void;
  onRevert?: (event: JsonSchemaEditorRevertEvent) => void;
  onValidate?: (result: JsonSchemaValidationResult) => void;
}

export type EditorState = ReturnType<typeof createEditorState>;

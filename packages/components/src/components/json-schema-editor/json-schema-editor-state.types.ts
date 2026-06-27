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
  maxHistory?: number;
  onchange?: (event: JsonSchemaEditorChangeEvent) => void;
  onrevert?: (event: JsonSchemaEditorRevertEvent) => void;
  onvalidate?: (result: JsonSchemaValidationResult) => void;
}

export type EditorState = ReturnType<typeof createEditorState>;

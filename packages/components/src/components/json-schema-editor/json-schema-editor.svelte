<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status beta
   * @purpose Multi-view editor for authoring JSON Schema documents with form, raw JSON, and diff modes plus undo history and validation.
   * @tag form
   * @tag editor
   * @useWhen Letting users edit a JSON Schema with a guided form alongside the raw source.
   * @useWhen Reviewing schema changes against a baseline via the built-in diff view.
   * @avoidWhen Editing arbitrary free-form JSON with no schema semantics — use a plain code editor instead.
   * @related markdown-editor, review-editor
   */
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
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import Implementation from './json-schema-editor-impl.svelte';
  import type { JsonSchemaEditorProps } from './json-schema-editor.types.ts';

  let { view = $bindable('form'), class: className, ...rest }: JsonSchemaEditorProps = $props();

  const mergedClassName = $derived(classNames(className));
</script>

<Implementation bind:view class={mergedClassName} {...rest} />

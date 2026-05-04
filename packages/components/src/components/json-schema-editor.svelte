<script lang="ts" module>
  import type { JsonSchemaEditorProps as JsonSchemaEditorImplementationProps } from './json-schema-editor/json-schema-editor.svelte';

  export type JsonSchemaEditorProps = JsonSchemaEditorImplementationProps;

  export type {
    JsonSchemaEditorView,
    JsonSchemaEditorMode,
  } from './json-schema-editor/json-schema-editor.svelte';

  export type {
    JsonSchemaValue,
    JsonSchemaTypeName,
    JsonSchemaDraft,
    JsonSchemaKnownDraft,
    JsonSchemaValidationError,
    JsonSchemaValidationStatus,
    JsonSchemaValidationResult,
    JsonSchemaEditorChangeEvent,
    JsonSchemaEditorRevertEvent,
  } from './json-schema-editor/json-schema-editor-types.ts';
</script>

<script lang="ts">
  import { classNames } from '../utilities/class-names.ts';

  import Implementation from './json-schema-editor/json-schema-editor.svelte';

  let { view = $bindable('form'), class: className, ...rest }: JsonSchemaEditorProps = $props();

  const mergedClassName = $derived(classNames(className));
</script>

<Implementation bind:view class={mergedClassName} {...rest} />
